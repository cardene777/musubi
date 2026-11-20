import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { definitionVersions, optionalVersions } from "./definition.ts";
import { INTEGRITY } from "./fingerprint.ts";
import { isObject, JsonError, parseLocated, pointer } from "./json.ts";
import type { Report } from "./report.ts";
import { readRules, type Rule } from "./rules.ts";
import { parseRange, parseVersion, type Range, type Version } from "./semver.ts";

export type Skill = { name: string; dir: string };

// The folders the agents read skills from, in the project and in the home folder.
const FOLDERS = [".claude/skills", ".agents/skills", ".github/skills", ".gemini/skills"];

export function defaultRoots(cwd: string, home: string): string[] {
  return [cwd, home].flatMap((base) => FOLDERS.map((folder) => resolve(base, folder)));
}

// Every folder directly under a root that holds a SKILL.md is a skill, named by its folder.
// When two roots hold the same name, the first root wins, as it does for the agents.
export function discover(roots: string[], report: Report): Map<string, Skill> {
  const skills = new Map<string, Skill>();
  const seen = new Set<string>();
  for (const root of roots.map((r) => resolve(r))) {
    if (seen.has(root) || !existsSync(root) || !statSync(root).isDirectory()) continue;
    seen.add(root);
    for (const name of readdirSync(root).sort()) {
      const dir = join(root, name);
      if (!existsSync(join(dir, "SKILL.md"))) continue;
      const first = skills.get(name);
      if (first) {
        report.warn(`${report.where(dir)} is shadowed by ${report.where(first.dir)}, which has the same name`);
        continue;
      }
      skills.set(name, { name, dir });
    }
  }
  return skills;
}

export type Provided = {
  name: string;
  version: Version | null;
  file: string | null;
  check: string | null;
  rules: Rule[] | null;
  line: number;
  versionLine: number;
};

export type Follow = {
  ref: string;
  skill: string;
  content: string;
  range: Range | null;
  integrity: string | null;
  examples: string[];
  optional: boolean;
  line: number;
  versionLine: number;
  integrityLine: number;
};

export type Declaration = {
  skill: Skill;
  path: string;
  text: string;
  provides: Map<string, Provided>;
  follows: Follow[];
};

const TOP = new Set(["$schema", "musubi", "provides", "follows"]);
const PROVIDED = new Set(["version", "file", "check"]);
const FOLLOWED = new Set(["version", "integrity", "examples"]);
const REF = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

// A path written in musubi.json must name a file inside the skill's own folder.
function inside(skill: Skill, path: unknown): string | null {
  if (typeof path !== "string" || path === "" || isAbsolute(path)) return null;
  const full = resolve(skill.dir, path);
  const rel = relative(skill.dir, full);
  return rel.startsWith("..") || isAbsolute(rel) ? null : rel.split("\\").join("/");
}

// Reads a skill's musubi.json and reports every mistake in it at its line.
export function readDeclaration(skill: Skill, report: Report): Declaration | null {
  const path = join(skill.dir, "musubi.json");
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8");
  const declaration: Declaration = { skill, path, text, provides: new Map(), follows: [] };
  let located;
  try {
    located = parseLocated(text);
  } catch (error) {
    report.problem(path, error instanceof JsonError ? error.line : 1, `not valid JSON: ${(error as Error).message}`);
    return declaration;
  }
  const { value, lines } = located;
  const at = (...keys: string[]) => lines.get(pointer(...keys)) ?? 1;
  if (!isObject(value)) {
    report.problem(path, 1, "musubi.json holds one JSON object");
    return declaration;
  }
  for (const key of Object.keys(value)) if (!TOP.has(key)) report.problem(path, at(key), `unknown field "${key}"`);
  if (typeof value.musubi !== "string" || !definitionVersions.includes(value.musubi)) {
    const named = typeof value.musubi === "string" ? ` "${value.musubi}" is not one of them` : "";
    report.problem(path, at("musubi"), `"musubi" must name a definition version (${definitionVersions.join(", ")});${named}`);
  }

  if (value.provides !== undefined) {
    if (!isObject(value.provides)) report.problem(path, at("provides"), '"provides" must map content names to entries');
    else {
      for (const [name, entry] of Object.entries(value.provides)) {
        const line = at("provides", name);
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) report.problem(path, line, `the content name "${name}" must be lowercase words joined by "-"`);
        if (!isObject(entry)) {
          report.problem(path, line, `"${name}" must be an object with "version" and "file"`);
          continue;
        }
        for (const key of Object.keys(entry)) if (!PROVIDED.has(key)) report.problem(path, at("provides", name, key), `unknown field "${key}" in "${name}"`);
        const version = typeof entry.version === "string" ? parseVersion(entry.version) : null;
        const versionLine = lines.get(pointer("provides", name, "version")) ?? line;
        if (!version) report.problem(path, versionLine, `the version of "${name}" must be MAJOR.MINOR.PATCH, such as 1.0.0`);
        const file = inside(skill, entry.file);
        if (!file) report.problem(path, at("provides", name, "file"), `the file of "${name}" must be a path inside the skill folder`);
        else if (!existsSync(join(skill.dir, file))) report.problem(path, at("provides", name, "file"), `the file "${file}" of "${name}" does not exist`);
        let check: string | null = null;
        let rules: Rule[] | null = null;
        if (entry.check !== undefined) {
          const checkLine = at("provides", name, "check");
          check = inside(skill, entry.check);
          if (!check) report.problem(path, checkLine, `the check of "${name}" must be a path inside the skill folder`);
          else if (!check.endsWith(".json")) {
            report.problem(path, checkLine, `the check of "${name}" must be a JSON rules file; musubi never runs provider code`);
            check = null;
          } else if (!existsSync(join(skill.dir, check))) {
            report.problem(path, checkLine, `the check "${check}" of "${name}" does not exist`);
            check = null;
          } else rules = readRules(join(skill.dir, check), report);
        }
        declaration.provides.set(name, { name, version, file: file && existsSync(join(skill.dir, file)) ? file : null, check, rules, line, versionLine });
      }
    }
  }

  if (value.follows !== undefined) {
    if (!isObject(value.follows)) report.problem(path, at("follows"), '"follows" must map "skill/content" names to entries');
    else {
      for (const [ref, entry] of Object.entries(value.follows)) {
        const line = at("follows", ref);
        if (!REF.test(ref)) {
          report.problem(path, line, `"${ref}" must name a content as "<skill>/<content>"`);
          continue;
        }
        if (!isObject(entry)) {
          report.problem(path, line, `"${ref}" must be an object with "version" and "integrity"`);
          continue;
        }
        const knowsOptional = typeof value.musubi === "string" && optionalVersions.has(value.musubi);
        for (const key of Object.keys(entry)) {
          if (!FOLLOWED.has(key) && !(key === "optional" && knowsOptional)) report.problem(path, at("follows", ref, key), `unknown field "${key}" in "${ref}"`);
        }
        if (knowsOptional && entry.optional !== undefined && typeof entry.optional !== "boolean") {
          report.problem(path, at("follows", ref, "optional"), `"optional" of "${ref}" must be true or false`);
        }
        const versionLine = lines.get(pointer("follows", ref, "version")) ?? line;
        const range = typeof entry.version === "string" ? parseRange(entry.version) : null;
        if (!range) report.problem(path, versionLine, `the version range of "${ref}" must be ^X.Y.Z, ~X.Y.Z, or X.Y.Z`);
        const integrityLine = lines.get(pointer("follows", ref, "integrity")) ?? line;
        const integrity = typeof entry.integrity === "string" && INTEGRITY.test(entry.integrity) ? entry.integrity : null;
        if (!integrity) report.problem(path, integrityLine, `the fingerprint of "${ref}" must be sha256-<base64>; run musubi add to write it`);
        const examples: string[] = [];
        if (entry.examples !== undefined) {
          if (!Array.isArray(entry.examples)) report.problem(path, at("follows", ref, "examples"), `"examples" of "${ref}" must be a list of paths`);
          else {
            entry.examples.forEach((example, index) => {
              const exampleLine = lines.get(`${pointer("follows", ref, "examples")}/${index}`) ?? line;
              const file = inside(skill, example);
              if (!file) report.problem(path, exampleLine, `the example "${String(example)}" must be a path inside the skill folder`);
              else if (!existsSync(join(skill.dir, file))) report.problem(path, exampleLine, `the example "${file}" does not exist`);
              else examples.push(file);
            });
          }
        }
        const [skillName, content] = ref.split("/");
        const optional = knowsOptional && entry.optional === true;
        declaration.follows.push({ ref, skill: skillName, content, range, integrity, examples, optional, line, versionLine, integrityLine });
      }
    }
  }
  return declaration;
}

// The files a fingerprint covers, in the order the definition fixes.
export function fingerprintFiles(provided: Provided): string[] {
  return ["SKILL.md", provided.file ?? "", ...(provided.check ? [provided.check] : [])];
}
