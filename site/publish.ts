#!/usr/bin/env node
// Publishes the site to GitHub Pages:
//   node site/publish.ts [--registry <folder>] [--source <folder>] [--base-url <url>]
// It runs only on main with nothing uncommitted, builds the site into a temporary folder with
// site/build.ts, and adds one commit holding those pages on top of the gh-pages branch of the origin
// remote, creating the branch the first time. It never rewrites gh-pages, never changes the working
// tree, and sends nothing when the build fails. docs/publishing.md has the one-time settings.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const BRANCH = "gh-pages";

// A reason to stop without publishing; `code` is the exit code (2 for a wrong option).
class Refusal extends Error {
  code: number;
  constructor(message: string, code = 1) {
    super(message);
    this.code = code;
  }
}

function git(cwd: string, args: string[]) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { code: r.status ?? 1, out: (r.stdout ?? "").trim(), err: (r.stderr ?? "").trim() };
}

function must(cwd: string, args: string[]): string {
  const r = git(cwd, args);
  if (r.code !== 0) throw new Refusal(`git ${args.join(" ")} failed: ${r.err}`);
  return r.out;
}

function publish(args: string[], cwd: string, tmp: string) {
  if (args.includes("--out")) throw new Refusal("publish chooses the build folder itself; drop --out", 2);
  const branch = must(cwd, ["branch", "--show-current"]);
  if (branch !== "main") throw new Refusal(`publish runs on main, and this checkout is on ${branch || "a detached HEAD"}`);
  if (must(cwd, ["status", "--porcelain"]) !== "") throw new Refusal("there are uncommitted changes; commit them on main first");
  const head = must(cwd, ["rev-parse", "HEAD"]);
  const remote = must(cwd, ["remote", "get-url", "origin"]);

  const out = join(tmp, "site");
  const built = spawnSync(process.execPath, [join(root, "site", "build.ts"), ...args, "--out", out], { stdio: "inherit" });
  if (built.status !== 0) throw new Refusal("the build failed, so nothing was published");
  // The marker only lets the build replace its own folder; the published pages do not need it.
  rmSync(join(out, ".musubi-site"), { force: true });

  const pages = join(tmp, "pages");
  const listed = git(cwd, ["ls-remote", "--exit-code", "--heads", "origin", BRANCH]);
  if (listed.code === 0) {
    must(tmp, ["clone", "--quiet", "--branch", BRANCH, "--single-branch", remote, pages]);
  } else if (listed.code === 2) {
    must(tmp, ["init", "--quiet", "-b", BRANCH, pages]);
    must(pages, ["remote", "add", "origin", remote]);
  } else {
    throw new Refusal(`could not read the branches of origin: ${listed.err}`);
  }
  for (const name of readdirSync(pages)) if (name !== ".git") rmSync(join(pages, name), { recursive: true, force: true });
  cpSync(out, pages, { recursive: true });
  must(pages, ["add", "--all"]);
  if (git(pages, ["diff", "--cached", "--quiet"]).code === 0) {
    process.stdout.write(`musubi publish: ${BRANCH} already holds these pages; nothing was sent\n`);
    return;
  }
  must(pages, ["commit", "--quiet", "-m", `Publish the site built from ${head}`]);
  must(pages, ["push", "--quiet", "origin", BRANCH]);
  process.stdout.write(`musubi publish: sent ${BRANCH} ${must(pages, ["rev-parse", "--short", "HEAD"])}, built from ${head.slice(0, 7)}\n`);
}

const tmp = mkdtempSync(join(tmpdir(), "musubi-publish-"));
try {
  publish(process.argv.slice(2), process.cwd(), tmp);
} catch (error) {
  if (!(error instanceof Refusal)) throw error;
  process.stderr.write(`musubi publish: ${error.message}\n`);
  process.exitCode = error.code;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
