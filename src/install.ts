import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative, resolve } from "node:path";
import { check } from "./check.ts";
import { Report } from "./report.ts";
import { format, satisfies } from "./semver.ts";
import { type Declaration, defaultRoots, discover, FOLDERS, type Follow, readDeclaration, type Skill } from "./skills.ts";

export type InstallOptions = {
  names: string[];
  sources: string[];
  to: string | null;
  with: string[];
  languages: string[];
  cwd: string;
  home: string;
};

// A source the user named with --from, read from a folder on disk or from a clone of a git repository.
type Source = { given: string; dir: string; skills: Map<string, string[]> };

const GIT_URL = /^(?:https?|ssh|git|file):\/\/|^[^@\s]+@[^:\s]+:/;

// Every folder in the source that holds a SKILL.md is a skill named by its folder, however deep it
// sits, because repositories keep skills under plugins/<name>/skills/ or .claude/skills/ alike.
function skillsIn(root: string): Map<string, string[]> {
  const found = new Map<string, string[]>();
  const seen = new Set<string>();
  const walk = (dir: string) => {
    const real = realpathSync(dir);
    if (seen.has(real)) return;
    seen.add(real);
    if (dir !== root && existsSync(join(dir, "SKILL.md"))) {
      found.set(basename(dir), [...(found.get(basename(dir)) ?? []), dir]);
      return;
    }
    for (const name of readdirSync(dir).sort()) {
      if (name === ".git" || name === "node_modules") continue;
      const path = join(dir, name);
      if (statSync(path, { throwIfNoEntry: false })?.isDirectory()) walk(path);
    }
  };
  walk(root);
  return found;
}

// A follow's provider is installed without being named when one of the user's languages has the
// same primary language as one of the follow's, so ja-JP matches ja.
function languageMatches(follow: Follow, languages: string[]): boolean {
  const primary = (tag: string) => tag.split("-")[0].toLowerCase();
  return follow.languages.some((tag) => languages.some((language) => primary(language) === primary(tag)));
}

export function install(o: InstallOptions): number {
  let to: string;
  if (o.to !== null) to = resolve(o.cwd, o.to);
  else {
    const first = FOLDERS.map((folder) => resolve(o.cwd, folder)).find((dir) => statSync(dir, { throwIfNoEntry: false })?.isDirectory());
    if (!first) {
      process.stderr.write(`musubi install: no skills folder (${FOLDERS.join(", ")}) in this folder; name one with --to\n`);
      return 2;
    }
    to = first;
  }

  const temporary: string[] = [];
  try {
    const sources: Source[] = [];
    for (const given of o.sources) {
      const folder = resolve(o.cwd, given);
      if (statSync(folder, { throwIfNoEntry: false })?.isDirectory()) {
        sources.push({ given, dir: folder, skills: skillsIn(folder) });
        continue;
      }
      if (!GIT_URL.test(given)) {
        process.stderr.write(`musubi install: the source "${given}" is neither a folder nor a git URL\n`);
        return 2;
      }
      const clone = mkdtempSync(join(tmpdir(), "musubi-install-"));
      temporary.push(clone);
      const git = spawnSync("git", ["clone", "--quiet", "--depth", "1", given, join(clone, "repo")], { encoding: "utf8" });
      if (git.status !== 0) {
        const why = git.error?.message ?? git.stderr.trim().split("\n").at(-1) ?? "";
        process.stderr.write(`musubi install: could not clone ${given}: ${why}\n`);
        return 1;
      }
      sources.push({ given, dir: join(clone, "repo"), skills: skillsIn(join(clone, "repo")) });
    }

    // The skills an agent already reads, in the order musubi check reads them, with --to first.
    const quiet = new Report(o.cwd);
    const roots = [to, ...defaultRoots(o.cwd, o.home)];
    const installed = discover(roots, quiet);
    const problems: string[] = [];
    const copies: Array<{ skill: Skill; source: Source }> = [];
    const kept: Skill[] = [];
    const declarations = new Map<string, Declaration | null>();
    const bound: Array<{ consumer: string; follow: Follow }> = [];
    const leftOut: Array<{ consumer: string; follow: Follow }> = [];

    // Walks the follows from the named skills: a required follow always brings its provider, and an
    // optional one only when the user names the provider or a language matches.
    const queue: Array<{ name: string; need?: { consumer: string; follow: Follow } }> = o.names.map((name) => ({ name }));
    while (queue.length > 0) {
      const { name, need } = queue.shift() as (typeof queue)[number];
      if (declarations.has(name)) continue;
      let skill = installed.get(name);
      if (skill) kept.push(skill);
      else {
        const source = sources.find((s) => s.skills.has(name));
        const dirs = source?.skills.get(name) ?? [];
        if (!source) {
          problems.push(
            need ? `no source holds a skill named ${name}, which ${need.consumer} follows for ${need.follow.ref}` : `no source holds a skill named ${name}`,
          );
          declarations.set(name, null);
          continue;
        }
        if (dirs.length > 1) {
          const paths = dirs.map((dir) => relative(source.dir, dir).split("\\").join("/"));
          problems.push(`the source ${source.given} holds more than one skill named ${name}: ${paths.join(", ")}`);
          declarations.set(name, null);
          continue;
        }
        skill = { name, dir: dirs[0] };
        if (existsSync(join(to, name))) problems.push(`${join(to, name)} already exists and holds no SKILL.md, so ${name} cannot be installed there`);
        copies.push({ skill, source });
      }
      const declaration = readDeclaration(skill, quiet);
      declarations.set(name, declaration);
      for (const follow of declaration?.follows ?? []) {
        const wanted = !follow.optional || o.with.includes(follow.skill) || languageMatches(follow, o.languages);
        if (!wanted) {
          leftOut.push({ consumer: name, follow });
          continue;
        }
        bound.push({ consumer: name, follow });
        queue.push({ name: follow.skill, need: { consumer: name, follow } });
      }
    }

    // A provider must provide the content at a version the consumer accepts before anything is copied.
    for (const { consumer, follow } of bound) {
      const declaration = declarations.get(follow.skill);
      if (declaration === null) continue;
      const provided = declaration?.provides.get(follow.content);
      if (!provided) problems.push(`${consumer} follows ${follow.ref}, but ${follow.skill} provides no content named ${follow.content}`);
      else if (provided.version && follow.range && !satisfies(provided.version, follow.range)) {
        problems.push(`${consumer} accepts ${follow.range.text} of ${follow.ref}, but ${follow.skill} provides ${format(provided.version)}`);
      }
    }
    if (problems.length > 0) {
      for (const problem of problems) process.stderr.write(`musubi install: ${problem}\n`);
      process.stderr.write("musubi install: nothing was installed\n");
      return 1;
    }

    const where = (path: string) => relative(o.cwd, path) || path;
    mkdirSync(to, { recursive: true });
    for (const { skill, source } of copies) {
      cpSync(skill.dir, join(to, skill.name), { recursive: true, dereference: true, filter: (path) => basename(path) !== ".git" });
      process.stdout.write(`installed ${skill.name} from ${source.given} (${relative(source.dir, skill.dir).split("\\").join("/")}) into ${where(to)}\n`);
    }
    for (const skill of kept) process.stdout.write(`${skill.name} is already installed in ${where(skill.dir)}, so it was kept as it is\n`);
    for (const { consumer, follow } of leftOut) {
      if (declarations.has(follow.skill)) continue;
      process.stdout.write(`left out ${follow.skill}, which ${consumer} follows only when it is installed; add it with --with ${follow.skill}\n`);
    }
    for (const name of o.with) {
      if (!declarations.has(name)) process.stderr.write(`warning: --with ${name} names no optional follow of the skills installed\n`);
    }
    return check(roots, o.cwd, false);
  } finally {
    for (const dir of temporary) rmSync(dir, { recursive: true, force: true });
  }
}
