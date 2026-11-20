import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { latestDefinition } from "../src/definition.ts";
import { DEF, fingerprintOnDisk, formatText, run, skills } from "./helpers.ts";

function fixture() {
  return skills({
    "design-doc": {
      provides: {
        design: { version: "1.2.0", file: "formats/design.md", text: formatText, check: "checks/design.json" },
      },
    },
    "api-design": { noJson: true },
  });
}

test("add-writes-the-range-and-fingerprint", () => {
  const set = fixture();
  const consumer = join(set.dir, "skills/api-design");
  const r = run(["add", "design-doc/design"], { cwd: consumer });
  assert.equal(r.code, 0, r.stderr);
  const json = JSON.parse(readFileSync(join(consumer, "musubi.json"), "utf8"));
  assert.equal(json.musubi, latestDefinition);
  const follow = json.follows["design-doc/design"];
  assert.equal(follow.version, "^1.2.0");
  assert.equal(
    follow.integrity,
    fingerprintOnDisk(join(set.dir, "skills/design-doc"), ["SKILL.md", "formats/design.md", "checks/design.json"]),
  );
});

test("add-prints-the-body-lines", () => {
  const set = fixture();
  const r = run(["add", "design-doc/design"], { cwd: join(set.dir, "skills/api-design") });
  assert.equal(r.code, 0, r.stderr);
  const lines = r.stdout.split("\n").filter((line) => line.trim() !== "");
  assert.ok(lines.some((line) => line.includes("`design`") && line.includes("`design-doc`")), r.stdout);
  assert.ok(lines.some((line) => line.includes("musubi check")), r.stdout);
  assert.ok(lines.some((line) => line.includes("not installed")), r.stdout);
});

test("add-refuses-an-unknown-content", () => {
  const set = fixture();
  const consumer = join(set.dir, "skills/api-design");
  const r = run(["add", "design-doc/nope"], { cwd: consumer });
  assert.equal(r.code, 1);
  assert.match(r.stderr, /design-doc\/nope/);
  assert.equal(existsSync(join(consumer, "musubi.json")), false);
});

// addLines <file>: the lines musubi add prints for a content stored in a file of that name.
function addLines(file: string): string[] {
  const set = skills({
    "design-doc": { provides: { thing: { version: "1.0.0", file, text: "content\n" } } },
    "api-design": { noJson: true },
  });
  const r = run(["add", "design-doc/thing"], { cwd: join(set.dir, "skills/api-design") });
  assert.equal(r.code, 0, r.stderr);
  return r.stdout.split("\n").filter((line) => line.trim() !== "" && !line.startsWith("musubi add:"));
}

const RUN_LINE =
  "Run the `thing` of the `design-doc` skill: open the `design-doc` skill by name and run the file it names for `thing`.";
const SCRIPTS = ["scripts/a.py", "scripts/a.sh", "scripts/a.bash", "scripts/a.js", "scripts/a.mjs", "scripts/a.cjs", "scripts/a.ts", "scripts/A.PY"];

test("add-prints-the-run-line-for-a-script", () => {
  for (const file of SCRIPTS) {
    const lines = addLines(file);
    assert.equal(lines[0], RUN_LINE, file);
    assert.equal(lines.length, 3, file);
  }
});

test("add-does-not-call-a-script-a-format", () => {
  for (const file of SCRIPTS) {
    for (const line of addLines(file)) {
      assert.doesNotMatch(line, /format|read the file/, `${file}: ${line}`);
    }
  }
});

test("add-keeps-the-format-lines", () => {
  assert.deepEqual(addLines("formats/thing.md"), [
    "Write in the `thing` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `thing`.",
    "If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.",
    "If the `design-doc` skill is not installed, do not start: tell the user that `design-doc` is missing and how to install it, then stop.",
  ]);
});

test("add-prints-the-format-line-for-other-files", () => {
  for (const file of ["data/thing.json", "notes/thing.txt", "THING"]) {
    assert.match(addLines(file)[0], /^Write in the `thing` format of the `design-doc` skill: /, file);
  }
});

test("add-writes-an-optional-follow", () => {
  const set = fixture();
  const consumer = join(set.dir, "skills/api-design");
  writeFileSync(join(consumer, "musubi.json"), `${JSON.stringify({ musubi: DEF }, null, 2)}\n`);
  const r = run(["add", "design-doc/design", "--optional"], { cwd: consumer });
  assert.equal(r.code, 0, r.stderr);
  const json = JSON.parse(readFileSync(join(consumer, "musubi.json"), "utf8"));
  assert.equal(json.musubi, "2026-11-20", "add --optional did not raise the definition version that knows optional");
  assert.equal(json.follows["design-doc/design"].optional, true);
  assert.equal(json.follows["design-doc/design"].version, "^1.2.0");
  assert.deepEqual(r.stdout.trim().split("\n"), [
    "When the `design-doc` skill is installed, write in the `design` format of the `design-doc` skill: open the `design-doc` skill by name and read the file it names for `design`.",
    "If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.",
    "If the `design-doc` skill is not installed, go on without the `design` of `design-doc`.",
  ]);
});

test("add-writes-the-languages-of-an-optional-follow", () => {
  const set = fixture();
  const consumer = join(set.dir, "skills/api-design");
  writeFileSync(join(consumer, "musubi.json"), `${JSON.stringify({ musubi: DEF }, null, 2)}\n`);
  const r = run(["add", "design-doc/design", "--optional", "--lang", "ja"], { cwd: consumer });
  assert.equal(r.code, 0, r.stderr);
  const json = JSON.parse(readFileSync(join(consumer, "musubi.json"), "utf8"));
  assert.equal(json.musubi, "2026-11-21", "add --lang did not raise the definition version that knows when");
  assert.equal(json.follows["design-doc/design"].optional, true);
  assert.deepEqual(json.follows["design-doc/design"].when, { languages: ["ja"] });
});

test("add-refuses-languages-without-optional", () => {
  const set = fixture();
  const consumer = join(set.dir, "skills/api-design");
  const r = run(["add", "design-doc/design", "--lang", "ja"], { cwd: consumer });
  assert.equal(r.code, 2, r.stderr);
  assert.match(r.stderr, /--lang needs --optional/, r.stderr);
  assert.ok(!existsSync(join(consumer, "musubi.json")), "add wrote musubi.json although it refused");
});
