import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { formatText, run, skillMd, skills, tree } from "./helpers.ts";

// The definition version that knows optional follows (issue #29) and the one that knows "when" (issue #38).
const OPTIONAL = "2026-11-20";
const LANGUAGES = "2026-11-21";

type Follow = { optional?: boolean; languages?: string[]; range?: string; integrity?: string };

// A source laid out like a plugin repository: each skill sits a few folders down, not directly in a
// skills folder, so the command has to find it by its folder name.
function source(o: Follow & { providerVersion?: string; provider?: boolean } = {}) {
  const defs: Parameters<typeof skills>[0] = {
    "api-design": {
      at: "plugins/api/skills",
      musubi: o.languages ? LANGUAGES : o.optional ? OPTIONAL : undefined,
      follows: { "design-doc/design": { range: o.range ?? "^1.0.0", integrity: o.integrity } },
      json: (json) => {
        const follow = (json.follows as Record<string, Record<string, unknown>>)["design-doc/design"];
        if (o.optional) follow.optional = true;
        if (o.languages) follow.when = { languages: o.languages };
        return json;
      },
    },
  };
  if (o.provider !== false) {
    defs["design-doc"] = {
      at: "plugins/doc-formats/skills",
      provides: { design: { version: o.providerVersion ?? "1.0.0", file: "formats/design.md", text: formatText } },
    };
  }
  return skills(defs).dir;
}

// A project folder and an empty home folder, so the command never reads the skills of the machine.
function place() {
  const project = tree({});
  return { project, home: tree({}), dest: join(project, ".claude", "skills") };
}

function install(args: string[], where: { project: string; home: string }, env: Record<string, string> = {}) {
  return run(["install", ...args], { cwd: where.project, env: { HOME: where.home, ...env } });
}

const installed = (dest: string, name: string) => existsSync(join(dest, name, "SKILL.md"));

test("install-copies-the-skill-and-its-required-provider", () => {
  const from = source();
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.ok(installed(where.dest, "design-doc"), "the provider design-doc was not installed");
  assert.equal(readFileSync(join(where.dest, "design-doc", "formats", "design.md"), "utf8"), formatText);
  assert.ok(existsSync(join(where.dest, "api-design", "musubi.json")), "musubi.json of api-design was not copied");
  assert.match(r.stdout, /musubi check: ok/, r.stdout);
});

test("install-follows-the-chain", () => {
  const from = skills({
    alpha: { at: "a/skills", follows: { "beta/rules": { range: "^1.0.0" } } },
    beta: {
      at: "b/skills",
      provides: { rules: { version: "1.0.0", file: "rules.md", text: "# Rules\n" } },
      follows: { "gamma/words": { range: "^1.0.0" } },
    },
    gamma: { at: "c/deep/skills", provides: { words: { version: "1.0.0", file: "words.md", text: "# Words\n" } } },
  }).dir;
  const where = place();
  const r = install(["alpha", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 0, r.stderr);
  for (const name of ["alpha", "beta", "gamma"]) assert.ok(installed(where.dest, name), `${name} was not installed`);
});

test("install-leaves-out-an-optional-follow", () => {
  const from = source({ optional: true });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.ok(!installed(where.dest, "design-doc"), "the provider of an optional follow was installed without being asked");
  assert.match(r.stdout, /design-doc/, r.stdout);
  assert.match(r.stdout, /--with design-doc/, r.stdout);
});

test("install-adds-an-optional-follow-the-user-names", () => {
  const from = source({ optional: true });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest, "--with", "design-doc"], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.ok(installed(where.dest, "design-doc"), "--with design-doc did not install the provider");
});

test("install-adds-an-optional-follow-whose-language-matches", () => {
  const from = source({ optional: true, languages: ["ja"] });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest, "--lang", "ja-JP"], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.ok(installed(where.dest, "design-doc"), "--lang ja-JP did not install the provider of a follow for ja");
});

test("install-leaves-out-an-optional-follow-of-another-language", () => {
  const from = source({ optional: true, languages: ["ja"] });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest, "--lang", "en"], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.ok(!installed(where.dest, "design-doc"), "--lang en installed the provider of a follow for ja");
  assert.match(r.stdout, /--with design-doc/, r.stdout);
});

test("install-refuses-a-missing-required-provider", () => {
  const from = source({ provider: false });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stderr, /design-doc/, r.stderr);
  assert.match(r.stderr, /no source holds a skill named design-doc/, r.stderr);
  assert.ok(!installed(where.dest, "api-design"), "api-design was installed although its provider is missing");
});

test("install-refuses-a-provider-outside-the-range", () => {
  const from = source({ providerVersion: "2.0.0" });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 1, r.stderr);
  assert.match(r.stderr, /api-design accepts \^1\.0\.0 of design-doc\/design, but design-doc provides 2\.0\.0/, r.stderr);
  assert.ok(!installed(where.dest, "api-design"), "api-design was installed although the provider is out of range");
  assert.ok(!installed(where.dest, "design-doc"), "design-doc was installed although it is out of range");
});

test("install-keeps-an-installed-skill", () => {
  const from = source();
  const where = place();
  const mine = join(where.dest, "design-doc");
  mkdirSync(join(mine, "formats"), { recursive: true });
  for (const file of ["SKILL.md", "musubi.json", "formats/design.md"]) {
    writeFileSync(join(mine, file), readFileSync(join(from, "plugins/doc-formats/skills/design-doc", file)));
  }
  writeFileSync(join(mine, "mine.txt"), "kept\n");
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed");
  assert.equal(readFileSync(join(mine, "mine.txt"), "utf8"), "kept\n", "the installed design-doc was replaced");
  assert.match(r.stdout, /design-doc is already installed/, r.stdout);
});

test("install-reads-a-git-repository", () => {
  const from = source();
  const git = (...args: string[]) => {
    const r = spawnSync("git", ["-c", "user.name=musubi", "-c", "user.email=musubi@example.invalid", ...args], { cwd: from, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  };
  git("init", "--quiet");
  git("add", ".");
  git("commit", "--quiet", "-m", "skills");
  const where = place();
  const temp = tree({});
  const r = install(["api-design", "--from", `file://${from}`, "--to", where.dest], where, { TMPDIR: temp });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(where.dest, "api-design"), "api-design was not installed from the git repository");
  assert.ok(installed(where.dest, "design-doc"), "design-doc was not installed from the git repository");
  assert.ok(!existsSync(join(where.dest, "api-design", ".git")), "the clone's .git folder was copied");
  assert.deepEqual(readdirSync(temp), [], "the temporary clone was left behind");
});

test("install-picks-the-first-existing-skills-folder", () => {
  const from = source();
  const where = place();
  for (const folder of [".agents/skills", ".gemini/skills"]) mkdirSync(join(where.project, folder), { recursive: true });
  const r = install(["api-design", "--from", from], where);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(installed(join(where.project, ".agents/skills"), "api-design"), "api-design did not go to .agents/skills");
  assert.ok(!installed(join(where.project, ".gemini/skills"), "api-design"), "api-design went to .gemini/skills");
});

test("install-refuses-without-a-skills-folder", () => {
  const from = source();
  const where = place();
  const r = install(["api-design", "--from", from], where);
  assert.equal(r.code, 2, r.stderr);
  assert.match(r.stderr, /name one with --to/, r.stderr);
  assert.deepEqual(readdirSync(where.project), [], "the command wrote into the project");
});

test("install-refuses-without-a-source", () => {
  const where = place();
  const r = install(["api-design", "--to", where.dest], where);
  assert.equal(r.code, 2, r.stderr);
  assert.match(r.stderr, /name at least one source with --from/, r.stderr);
  assert.ok(!existsSync(where.dest), "the command wrote the skills folder");
});

test("install-refuses-an-ambiguous-skill-name", () => {
  const from = source();
  const other = join(from, "plugins", "copy", "skills", "design-doc");
  mkdirSync(other, { recursive: true });
  writeFileSync(join(other, "SKILL.md"), skillMd("design-doc"));
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 1, r.stderr);
  assert.ok(r.stderr.includes("plugins/doc-formats/skills/design-doc"), r.stderr);
  assert.ok(r.stderr.includes("plugins/copy/skills/design-doc"), r.stderr);
  assert.ok(!installed(where.dest, "api-design"), "api-design was installed although design-doc is ambiguous");
});

test("install-checks-after-installing", () => {
  const from = source({ integrity: `sha256-${"B".repeat(43)}=` });
  const where = place();
  const r = install(["api-design", "--from", from, "--to", where.dest], where);
  assert.equal(r.code, 1, r.stderr);
  assert.ok(installed(where.dest, "design-doc"), "design-doc was not installed before the check");
  assert.match(r.stderr, /the fingerprint of design-doc\/design does not match/, r.stderr);
});
