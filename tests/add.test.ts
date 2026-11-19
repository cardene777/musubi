import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
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
  assert.equal(json.musubi, DEF);
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
