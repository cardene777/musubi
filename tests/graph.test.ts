import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { root, run, tree } from "./helpers.ts";

test("graph-writes-the-skills-and-edges", () => {
  const out = join(tree({}), "graph.html");
  const r = run(["graph", "examples/skills", "--out", out], { cwd: root });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(existsSync(out), "graph.html was not written");
  const html = readFileSync(out, "utf8");
  assert.match(html, /design-doc/);
  assert.match(html, /api-design/);
  assert.match(html, /data-edge="api-design -> design-doc\/design"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});
