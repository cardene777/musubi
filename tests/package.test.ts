import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { root, tree } from "./helpers.ts";

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

function manifest() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const url: string = (typeof pkg.repository === "string" ? pkg.repository : pkg.repository?.url) ?? "";
  return { pkg, url };
}

// Files git tracks, plus new files it does not ignore, that are still on disk.
function repoFiles(): string[] {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return [...new Set(r.stdout.split("\0").filter(Boolean))].filter((path) => existsSync(join(root, path)));
}

// Copies the repository files into a new folder, where dist/ does not exist, and packs them with npm,
// so the package is built the way npm publish builds it.
let packed: { tarball: string; files: string[] } | undefined;
function pack() {
  if (packed) return packed;
  const dir = tree({});
  const copy = join(dir, "repo");
  for (const path of repoFiles()) {
    mkdirSync(dirname(join(copy, path)), { recursive: true });
    copyFileSync(join(root, path), join(copy, path));
  }
  assert.ok(!existsSync(join(copy, "dist")), "the copy already has dist/");
  symlinkSync(join(root, "node_modules"), join(copy, "node_modules"), "dir");
  const out = join(dir, "out");
  mkdirSync(out);
  const r = spawnSync("npm", ["pack", "--json", "--loglevel", "error", "--pack-destination", out], {
    cwd: copy,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const [info] = JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
  packed = { tarball: join(out, info.filename), files: info.files.map((file: { path: string }) => file.path) };
  return packed;
}

test("package-is-musubi-cli", () => {
  const { pkg, url } = manifest();
  assert.equal(pkg.name, "musubi-cli");
  assert.equal(pkg.version, "0.1.0");
  assert.equal(pkg.private, undefined, "npm publish refuses a package marked private");
  assert.match(url, /^git\+https:\/\/github\.com\/[^/]+\/musubi\.git$/, "repository does not point at github.com/<owner>/musubi");
});

test("packed-command-checks-the-examples", () => {
  const { tarball, files } = pack();
  assert.ok(files.includes("dist/cli.js"), "the package has no dist/cli.js, so npm pack did not build it");
  const prefix = tree({});
  const install = spawnSync(
    "npm",
    ["install", "--global", "--prefix", prefix, "--offline", "--no-audit", "--no-fund", "--loglevel", "error", tarball],
    { encoding: "utf8" },
  );
  assert.equal(install.status, 0, install.stdout + install.stderr);
  const r = spawnSync(join(prefix, "bin", "musubi"), ["check", "examples/skills"], { cwd: root, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^musubi check: ok/m);
});

test("packed-files-leave-out-the-sources", () => {
  const { files } = pack();
  assert.ok(files.includes("package.json"), "the package lists no files");
  const leaked = files.filter((path) => /^(src|tests|examples|\.ikkan|node_modules)\//.test(path));
  assert.deepEqual(leaked, [], "the package holds files that are not shipped");
});

test("account-name-only-in-license-and-package", () => {
  const owner = /github\.com\/([^/]+)\/musubi/.exec(manifest().url)?.[1];
  assert.ok(owner, "package.json has no repository URL to read the owner from");
  // Registry entries name their repository's owner, and the site design draws real entries,
  // so registry/ and design/ may hold it too.
  const found = repoFiles()
    .filter((path) => path !== "LICENSE" && path !== "package.json" && !/^(registry|design)\//.test(path))
    .filter((path) => readFileSync(join(root, path)).includes(owner));
  assert.deepEqual(found, [], "files other than LICENSE, package.json, registry/, and design/ name the account");
});

test("packed-files-leave-out-the-site", () => {
  const { files } = pack();
  const leaked = files.filter((path) => /^(site|registry|design)\//.test(path));
  assert.deepEqual(leaked, [], "the package holds the site, the registry, or the design");
});
