import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { root } from "./helpers.ts";

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

test("package-has-no-runtime-dependencies", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.deepEqual(pkg.dependencies ?? {}, {});
  assert.equal(pkg.bin?.musubi, "dist/cli.js");
  assert.equal(pkg.license, "MIT");
  assert.ok(existsSync(join(root, "LICENSE")), "LICENSE is missing");
  assert.match(readFileSync(join(root, "LICENSE"), "utf8"), /^MIT License/);
});

test("definition-versions-come-from-schema-folders", () => {
  const schema = join(root, "schema");
  assert.ok(existsSync(schema), "schema/ is missing");
  const dated = readdirSync(schema).filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name));
  assert.ok(dated.length > 0, "schema/ has no dated folder");
  for (const name of dated) assert.ok(existsSync(join(schema, name, "musubi.schema.json")), `${name} has no schema`);
  const src = join(root, "src");
  assert.ok(existsSync(src), "src/ is missing");
  const sources = filesUnder(src).filter((path) => path.endsWith(".ts"));
  assert.ok(sources.length > 0, "src/ has no sources");
  for (const path of sources) assert.doesNotMatch(readFileSync(path, "utf8"), /\d{4}-\d{2}-\d{2}/, path);
});

test("build-runs-from-dist", () => {
  assert.ok(existsSync(join(root, "tsconfig.build.json")), "tsconfig.build.json is missing");
  const build = spawnSync(join(root, "node_modules/.bin/tsc"), ["-p", "tsconfig.build.json"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(build.status, 0, build.stdout + build.stderr);
  const r = spawnSync(process.execPath, [join(root, "dist/cli.js"), "check", "examples/skills"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
});
