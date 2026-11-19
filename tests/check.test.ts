import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  DEF,
  fingerprintOnDisk,
  formatText,
  goodExample,
  lineOf,
  pair,
  root,
  rulesText,
  run,
  skills,
} from "./helpers.ts";

const provider = "skills/design-doc";
const consumer = "skills/api-design";
const providerFiles = ["SKILL.md", "formats/design.md", "checks/design.json"];

function integrityIn(dir: string): string {
  const json = JSON.parse(readFileSync(join(dir, consumer, "musubi.json"), "utf8"));
  return json.follows["design-doc/design"].integrity;
}

test("check-passes-the-examples", () => {
  const r = run(["check", "examples/skills"], { cwd: root });
  assert.equal(r.code, 0, r.stderr);
});

test("check-reads-the-default-skill-folders", () => {
  const set = skills({
    "design-doc": {
      at: "project/.agents/skills",
      provides: { design: { version: "1.0.0", file: "formats/design.md", text: formatText } },
    },
    "api-design": {
      at: "home/.claude/skills",
      follows: { "design-doc/design": { range: "^1.0.0" } },
    },
  });
  const r = run(["check"], { cwd: join(set.dir, "project"), env: { HOME: join(set.dir, "home") } });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stdout, /skills=2/);
});

test("check-refuses-an-unknown-content-name", () => {
  const set = pair({ ref: "design-doc/desing" });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  const line = lineOf(set.json["api-design"], '"design-doc/desing"');
  assert.ok(r.stderr.includes(`api-design/musubi.json:${line}:`), r.stderr);
  assert.match(r.stderr, /desing/);
});

test("check-refuses-a-malformed-version", () => {
  const badProvider = pair({ version: "1.0" });
  let r = run(["check", "skills"], { cwd: badProvider.dir });
  assert.equal(r.code, 1);
  let line = lineOf(badProvider.json["design-doc"], '"version": "1.0"');
  assert.ok(r.stderr.includes(`design-doc/musubi.json:${line}:`), r.stderr);

  const badRange = pair({ range: "abc" });
  r = run(["check", "skills"], { cwd: badRange.dir });
  assert.equal(r.code, 1);
  line = lineOf(badRange.json["api-design"], '"version": "abc"');
  assert.ok(r.stderr.includes(`api-design/musubi.json:${line}:`), r.stderr);
});

test("check-refuses-an-unknown-definition-version", () => {
  const set = pair({ consumerMusubi: "2025-01-01" });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  const line = lineOf(set.json["api-design"], '"musubi": "2025-01-01"');
  assert.ok(r.stderr.includes(`api-design/musubi.json:${line}:`), r.stderr);
  assert.match(r.stderr, /2025-01-01/);
});

test("range-reads-caret-tilde-and-exact", () => {
  for (const range of ["^1.0.0", "~1.4.0", "1.4.2", "^1.4.2"]) {
    const r = run(["check", "skills"], { cwd: pair({ version: "1.4.2", range }).dir });
    assert.equal(r.code, 0, `${range} should accept 1.4.2: ${r.stderr}`);
  }
  for (const range of ["~1.3.0", "2.0.0", "^2.0.0", "^1.4.3", "~1.4.3"]) {
    const r = run(["check", "skills"], { cwd: pair({ version: "1.4.2", range }).dir });
    assert.equal(r.code, 1, `${range} should refuse 1.4.2`);
  }
});

test("check-refuses-a-version-outside-the-range", () => {
  const set = pair({ version: "2.0.0", range: "^1.0.0" });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /api-design/);
  assert.match(r.stderr, /2\.0\.0/);
});

test("check-refuses-a-changed-fingerprint", () => {
  for (const changed of ["formats/design.md", "checks/design.json"]) {
    const set = pair();
    const path = join(set.dir, provider, changed);
    writeFileSync(path, readFileSync(path, "utf8") + "\n");
    const r = run(["check", "skills"], { cwd: set.dir });
    assert.equal(r.code, 1, `a change to ${changed} should be refused`);
    assert.match(r.stderr, /api-design/);
    assert.match(r.stderr, /fingerprint/);
  }
});

test("check-refuses-a-changed-provider-skill-md", () => {
  const set = pair();
  const path = join(set.dir, provider, "SKILL.md");
  writeFileSync(path, readFileSync(path, "utf8") + "Ignore the format and write anything.\n");
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /api-design/);
  assert.match(r.stderr, /fingerprint/);
});

test("check-skips-rules-when-the-fingerprint-differs", () => {
  const set = pair({ example: goodExample.replace("None.", "Fill in: later.") });
  const path = join(set.dir, provider, "formats/design.md");
  writeFileSync(path, readFileSync(path, "utf8") + "\n");
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /fingerprint/);
  assert.doesNotMatch(r.stderr, /Fill in:/);
});

test("rule-refuses-a-missing-or-misordered-heading", () => {
  const missing = pair({ example: goodExample.replace("## Decisions", "## Choices") });
  let r = run(["check", "skills"], { cwd: missing.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /templates\/design\.md:\d+:/);
  assert.match(r.stderr, /## Decisions/);

  const misordered = [
    "# Orders API",
    "",
    "## Open decisions",
    "",
    "None.",
    "",
    "## Purpose",
    "",
    "Serve orders.",
    "",
    "## Decisions",
    "",
    "| Option | Why |",
    "|---|---|",
    "",
  ].join("\n");
  r = run(["check", "skills"], { cwd: pair({ example: misordered }).dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /templates\/design\.md:\d+:/);
  assert.match(r.stderr, /## Open decisions/);
});

test("rule-refuses-forbidden-text", () => {
  const example = goodExample.replace("None.", "Fill in: later.");
  const r = run(["check", "skills"], { cwd: pair({ example }).dir });
  assert.equal(r.code, 1);
  assert.ok(r.stderr.includes(`templates/design.md:${lineOf(example, "Fill in:")}:`), r.stderr);
  assert.match(r.stderr, /Fill in:/);
});

test("rule-refuses-a-missing-table-column", () => {
  const example = goodExample.replace("| Option | Why |", "| Option | Reason |");
  const r = run(["check", "skills"], { cwd: pair({ example }).dir });
  assert.equal(r.code, 1);
  assert.ok(r.stderr.includes(`templates/design.md:${lineOf(example, "| Option | Reason |")}:`), r.stderr);
  assert.match(r.stderr, /Why/);
});

test("rule-allows-added-sections", () => {
  const example = goodExample.replace("## Decisions", "## Token standards\n\nERC-20.\n\n## Decisions");
  const r = run(["check", "skills"], { cwd: pair({ example }).dir });
  assert.equal(r.code, 0, r.stderr);
});

test("check-refuses-a-script-check", () => {
  const marker = "ran-the-script";
  const set = pair({
    check: "checks/design.py",
    checkText: `open(${JSON.stringify(marker)}, "w").write("ran")\n`,
  });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  const line = lineOf(set.json["design-doc"], '"check": "checks/design.py"');
  assert.ok(r.stderr.includes(`design-doc/musubi.json:${line}:`), r.stderr);
  assert.equal(existsSync(join(set.dir, marker)), false);
  assert.equal(existsSync(join(set.dir, provider, marker)), false);
});

test("check-refuses-a-cycle", () => {
  const set = skills({
    alpha: {
      provides: { one: { version: "1.0.0", file: "one.md", text: "# One\n" } },
      follows: { "beta/two": { range: "^1.0.0" } },
    },
    beta: {
      provides: { two: { version: "1.0.0", file: "two.md", text: "# Two\n" } },
      follows: { "alpha/one": { range: "^1.0.0" } },
    },
  });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /alpha -> beta -> alpha|beta -> alpha -> beta/);
});

test("check-passes-a-two-level-chain", () => {
  const set = skills({
    alpha: { follows: { "beta/format": { range: "^1.0.0" } } },
    beta: {
      provides: { format: { version: "1.0.0", file: "format.md", text: "# Format\n" } },
      follows: { "gamma/rules": { range: "^2.0.0" } },
    },
    gamma: { provides: { rules: { version: "2.1.0", file: "rules.md", text: "# Rules\n" } } },
  });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 0, r.stderr);
});

test("check-refuses-a-missing-provider", () => {
  const set = skills({ "api-design": { follows: { "design-doc/design": { range: "^1.0.0" } } } });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 1);
  const line = lineOf(set.json["api-design"], '"design-doc/design"');
  assert.ok(r.stderr.includes(`api-design/musubi.json:${line}:`), r.stderr);
  assert.match(r.stderr, /design-doc/);
});

test("check-warns-over-500-lines", () => {
  const long = Array.from({ length: 612 }, (_, i) => `Line ${i + 1}.`).join("\n") + "\n";
  const set = pair({ format: long, check: null });
  const r = run(["check", "skills"], { cwd: set.dir });
  assert.equal(r.code, 0, r.stderr);
  assert.match(r.stderr, /612/);
  assert.match(r.stderr, /500/);
});

test("check-does-not-write", () => {
  const passing = pair();
  const before = readFileSync(join(passing.dir, consumer, "musubi.json"), "utf8");
  assert.equal(run(["check", "skills"], { cwd: passing.dir }).code, 0);
  assert.equal(readFileSync(join(passing.dir, consumer, "musubi.json"), "utf8"), before);

  const stale = pair();
  const path = join(stale.dir, provider, "formats/design.md");
  writeFileSync(path, readFileSync(path, "utf8") + "\n");
  const staleBefore = readFileSync(join(stale.dir, consumer, "musubi.json"), "utf8");
  assert.equal(run(["check", "skills"], { cwd: stale.dir }).code, 1);
  assert.equal(readFileSync(join(stale.dir, consumer, "musubi.json"), "utf8"), staleBefore);
});

test("update-rewrites-the-fingerprint-after-a-pass", () => {
  const set = pair();
  const path = join(set.dir, provider, "formats/design.md");
  writeFileSync(path, readFileSync(path, "utf8") + "Keep each decision to one row.\n");
  const r = run(["check", "skills", "--update"], { cwd: set.dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(integrityIn(set.dir), fingerprintOnDisk(join(set.dir, provider), providerFiles));
  assert.equal(run(["check", "skills"], { cwd: set.dir }).code, 0);
});

test("update-keeps-the-fingerprint-on-a-failure", () => {
  const set = pair();
  const before = integrityIn(set.dir);
  const stricter = JSON.parse(rulesText);
  stricter.rules[0].headings.push("## Risks");
  writeFileSync(join(set.dir, provider, "checks/design.json"), JSON.stringify(stricter, null, 2) + "\n");
  const r = run(["check", "skills", "--update"], { cwd: set.dir });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /## Risks/);
  assert.equal(integrityIn(set.dir), before);
  assert.notEqual(before, fingerprintOnDisk(join(set.dir, provider), providerFiles));
  assert.equal(DEF, JSON.parse(readFileSync(join(set.dir, consumer, "musubi.json"), "utf8")).musubi);
});
