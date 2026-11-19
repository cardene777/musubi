// Shared fixtures for the musubi tests.
// Every fixture lives in its own temporary folder, removed when the test file ends.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after } from "node:test";

export const root = resolve(import.meta.dirname, "..");
export const cli = join(root, "src", "cli.ts");
export const DEF = "2026-11-19";

const made: string[] = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

// Writes the files under a new temporary folder and returns its path.
export function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "musubi-test-"));
  made.push(dir);
  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

export type Result = { code: number | null; stdout: string; stderr: string };

// Runs the musubi command from the source tree.
export function run(args: string[], opts: { cwd: string; env?: Record<string, string> }): Result {
  assert.ok(existsSync(cli), "the musubi command is missing at src/cli.ts");
  const r = spawnSync(process.execPath, [cli, ...args], {
    cwd: opts.cwd,
    env: { ...process.env, ...opts.env },
    encoding: "utf8",
  });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

// The fingerprint the definition specifies: sha256 over each file's path, byte length, and bytes,
// in the order SKILL.md, the content file, the check file.
export function fingerprintOf(files: Array<[string, string | Buffer]>): string {
  const hash = createHash("sha256");
  for (const [path, body] of files) {
    const bytes = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    hash.update(`${path}\n${bytes.length}\n`);
    hash.update(bytes);
    hash.update("\n");
  }
  return `sha256-${hash.digest("base64")}`;
}

export function fingerprintOnDisk(skillDir: string, paths: string[]): string {
  return fingerprintOf(paths.map((p) => [p, readFileSync(join(skillDir, p))]));
}

export function skillMd(name: string, body = "Body.\n"): string {
  return `---\nname: ${name}\ndescription: Test skill ${name}.\n---\n\n${body}`;
}

export const formatText = [
  "# Design",
  "",
  "## Purpose",
  "",
  "Fill in: why this exists.",
  "",
  "## Decisions",
  "",
  "| Option | Why |",
  "|---|---|",
  "",
  "## Open decisions",
  "",
  "Fill in: what is still open.",
  "",
].join("\n");

export const rulesText =
  JSON.stringify(
    {
      musubi: DEF,
      rules: [
        { kind: "headings", headings: ["## Purpose", "## Decisions", "## Open decisions"] },
        { kind: "forbid", text: ["Fill in:"] },
        { kind: "table-columns", heading: "## Decisions", columns: ["Option", "Why"] },
      ],
    },
    null,
    2,
  ) + "\n";

export const goodExample = [
  "# Orders API",
  "",
  "## Purpose",
  "",
  "Serve orders to the shop.",
  "",
  "## Decisions",
  "",
  "| Option | Why |",
  "|---|---|",
  "| REST | Simple to call |",
  "",
  "## Open decisions",
  "",
  "None.",
  "",
].join("\n");

export type Content = { version: string; file: string; text: string; check?: string; checkText?: string };
export type Follow = { range: string; examples?: Record<string, string>; integrity?: string };
export type SkillDef = {
  at?: string;
  body?: string;
  musubi?: string;
  provides?: Record<string, Content>;
  follows?: Record<string, Follow>;
  json?: (json: Record<string, unknown>) => Record<string, unknown>;
  noJson?: boolean;
};

const placeholder = `sha256-${"A".repeat(43)}=`;

// Builds a set of skills under `<base>/<name>/` with correct fingerprints unless a follow overrides them.
export function skills(defs: Record<string, SkillDef>, base = "skills"): { dir: string; json: Record<string, string> } {
  const files: Record<string, string> = {};
  const skillText: Record<string, string> = {};
  for (const [name, def] of Object.entries(defs)) {
    const at = def.at ?? base;
    skillText[name] = skillMd(name, def.body);
    files[`${at}/${name}/SKILL.md`] = skillText[name];
    for (const content of Object.values(def.provides ?? {})) {
      files[`${at}/${name}/${content.file}`] = content.text;
      if (content.check) files[`${at}/${name}/${content.check}`] = content.checkText ?? rulesText;
    }
  }
  const json: Record<string, string> = {};
  for (const [name, def] of Object.entries(defs)) {
    if (def.noJson) continue;
    const at = def.at ?? base;
    const body: Record<string, unknown> = { musubi: def.musubi ?? DEF };
    if (def.provides) {
      body.provides = Object.fromEntries(
        Object.entries(def.provides).map(([key, c]) => [
          key,
          { version: c.version, file: c.file, ...(c.check ? { check: c.check } : {}) },
        ]),
      );
    }
    if (def.follows) {
      body.follows = Object.fromEntries(
        Object.entries(def.follows).map(([ref, follow]) => {
          const [providerName, contentName] = ref.split("/");
          const provided = defs[providerName]?.provides?.[contentName];
          const integrity =
            follow.integrity ??
            (provided
              ? fingerprintOf([
                  ["SKILL.md", skillText[providerName]],
                  [provided.file, provided.text],
                  ...(provided.check ? [[provided.check, provided.checkText ?? rulesText] as [string, string]] : []),
                ])
              : placeholder);
          for (const [path, text] of Object.entries(follow.examples ?? {})) files[`${at}/${name}/${path}`] = text;
          return [
            ref,
            { version: follow.range, integrity, ...(follow.examples ? { examples: Object.keys(follow.examples) } : {}) },
          ];
        }),
      );
    }
    const text = JSON.stringify(def.json ? def.json(body) : body, null, 2) + "\n";
    files[`${at}/${name}/musubi.json`] = text;
    json[name] = text;
  }
  return { dir: tree(files), json };
}

export type PairOptions = {
  version?: string;
  range?: string;
  ref?: string;
  format?: string;
  check?: string | null;
  checkText?: string;
  example?: string;
  integrity?: string;
  consumerMusubi?: string;
};

// One provider (design-doc, content design) and one consumer (api-design) under skills/.
export function pair(o: PairOptions = {}) {
  return skills({
    "design-doc": {
      provides: {
        design: {
          version: o.version ?? "1.0.0",
          file: "formats/design.md",
          text: o.format ?? formatText,
          ...(o.check === null ? {} : { check: o.check ?? "checks/design.json", checkText: o.checkText }),
        },
      },
    },
    "api-design": {
      musubi: o.consumerMusubi,
      follows: {
        [o.ref ?? "design-doc/design"]: {
          range: o.range ?? "^1.0.0",
          integrity: o.integrity,
          examples: { "templates/design.md": o.example ?? goodExample },
        },
      },
    },
  });
}

// The 1-based line of the first line that contains the needle.
export function lineOf(text: string, needle: string): number {
  const index = text.split("\n").findIndex((line) => line.includes(needle));
  assert.notEqual(index, -1, `fixture has no line with ${needle}`);
  return index + 1;
}
