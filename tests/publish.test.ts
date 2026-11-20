import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fakeGh, root, skillMd, tree } from "./helpers.ts";

const publish = join(root, "site", "publish.ts");

// Git runs with no global or system configuration and a fixed identity, so the tests do not
// depend on the machine's git settings and never reach a real repository.
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Test",
  GIT_AUTHOR_EMAIL: "test@example.invalid",
  GIT_COMMITTER_NAME: "Test",
  GIT_COMMITTER_EMAIL: "test@example.invalid",
};

function git(cwd: string, ...args: string[]) {
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  return { code: r.status, out: r.stdout.trim(), err: r.stderr };
}

function ok(cwd: string, ...args: string[]) {
  const r = git(cwd, ...args);
  assert.equal(r.code, 0, `git ${args.join(" ")}: ${r.err}`);
  return r.out;
}

// A bare repository stands in for GitHub, and `work` is a clone of it with one commit on main.
// The registry lists one provider and one skill that follows it, read from the source folder.
function fixture() {
  const dir = tree({
    "registry/alice/skills-a.json": JSON.stringify({ skills: ["skills/design-doc", "skills/api-design"] }),
    "source/alice/skills-a/skills/design-doc/SKILL.md": skillMd("design-doc"),
    "source/alice/skills-a/skills/design-doc/musubi.json": JSON.stringify({
      musubi: "2026-11-19",
      provides: { design: { version: "1.0.0", file: "formats/design.md" } },
    }),
    "source/alice/skills-a/skills/design-doc/formats/design.md": "# Design\n",
    "source/alice/skills-a/skills/api-design/SKILL.md": skillMd("api-design"),
    "source/alice/skills-a/skills/api-design/musubi.json": JSON.stringify({
      musubi: "2026-11-19",
      follows: { "design-doc/design": { version: "^1.0.0", integrity: `sha256-${"A".repeat(43)}=` } },
    }),
  });
  ok(dir, "init", "--quiet", "--bare", "-b", "main", "origin.git");
  ok(dir, "clone", "--quiet", join(dir, "origin.git"), "work");
  const work = join(dir, "work");
  writeFileSync(join(work, "README.md"), "musubi\n");
  ok(work, "add", "README.md");
  ok(work, "commit", "--quiet", "-m", "first");
  ok(work, "push", "--quiet", "origin", "main");
  return { dir, work, origin: join(dir, "origin.git") };
}

function run(f: { dir: string; work: string }, ...extra: string[]) {
  assert.ok(existsSync(publish), "site/publish.ts is missing");
  const args = ["--registry", join(f.dir, "registry"), "--source", join(f.dir, "source"), ...extra];
  const r = spawnSync(process.execPath, [publish, ...args], { cwd: f.work, env: { ...env, PATH: fakeGh(f.dir) }, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

const published = (origin: string) => git(origin, "rev-parse", "--verify", "--quiet", "refs/heads/gh-pages").code === 0;

test("publish-commits-the-site-to-gh-pages", () => {
  const f = fixture();
  const r = run(f);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.ok(published(f.origin), "the remote has no gh-pages branch after publishing");
  assert.equal(ok(f.origin, "rev-list", "--count", "gh-pages"), "1", "gh-pages does not hold one commit");
  const files = ok(f.origin, "ls-tree", "-r", "--name-only", "gh-pages").split("\n");
  for (const file of ["index.html", "ja/index.html", "spec/index.html", "assets/site.css", "sitemap.xml", "CNAME", ".nojekyll"]) {
    assert.ok(files.includes(file), `gh-pages does not hold ${file}`);
  }
  assert.equal(ok(f.origin, "show", "gh-pages:CNAME"), "musubi.cardene.dev", "gh-pages:CNAME does not name the public host");
});

test("publish-adds-to-gh-pages-without-rewriting-it", () => {
  const f = fixture();
  assert.equal(run(f).code, 0);
  const first = ok(f.origin, "rev-parse", "gh-pages");
  writeFileSync(
    join(f.dir, "source/alice/skills-a/skills/design-doc/musubi.json"),
    JSON.stringify({ musubi: "2026-11-19", provides: { design: { version: "1.1.0", file: "formats/design.md" } } }),
  );
  const r = run(f);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const second = ok(f.origin, "rev-parse", "gh-pages");
  assert.notEqual(second, first, "the second publish did not add a commit");
  assert.equal(git(f.origin, "merge-base", "--is-ancestor", first, second).code, 0, "the second publish rewrote gh-pages");
  assert.equal(ok(f.origin, "rev-list", "--count", "gh-pages"), "2");
});

test("publish-leaves-the-working-tree-alone", () => {
  const f = fixture();
  writeFileSync(join(f.work, ".gitignore"), "ignored.txt\n");
  ok(f.work, "add", ".gitignore");
  ok(f.work, "commit", "--quiet", "-m", "ignore");
  writeFileSync(join(f.work, "ignored.txt"), "kept\n");
  const before = {
    head: ok(f.work, "rev-parse", "HEAD"),
    branch: ok(f.work, "branch", "--show-current"),
    status: ok(f.work, "status", "--porcelain", "--ignored"),
    worktrees: ok(f.work, "worktree", "list"),
    branches: ok(f.work, "branch", "--list"),
  };
  const r = run(f);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const after = {
    head: ok(f.work, "rev-parse", "HEAD"),
    branch: ok(f.work, "branch", "--show-current"),
    status: ok(f.work, "status", "--porcelain", "--ignored"),
    worktrees: ok(f.work, "worktree", "list"),
    branches: ok(f.work, "branch", "--list"),
  };
  assert.deepEqual(after, before, "publishing changed the working tree, the branch, or the worktrees");
});

test("publish-refuses-unmerged-or-uncommitted-work", () => {
  const off = fixture();
  ok(off.work, "switch", "--quiet", "-c", "feature");
  const r1 = run(off);
  assert.notEqual(r1.code, 0, "publishing from a branch other than main was not refused");
  assert.match(r1.stderr, /main/, "the refusal does not say that publishing runs on main");
  assert.ok(!published(off.origin), "a refused publish still sent gh-pages");

  const dirty = fixture();
  writeFileSync(join(dirty.work, "README.md"), "changed\n");
  const r2 = run(dirty);
  assert.notEqual(r2.code, 0, "publishing with uncommitted changes was not refused");
  assert.match(r2.stderr, /uncommitted|commit/, "the refusal does not name the uncommitted changes");
  assert.ok(!published(dirty.origin), "a refused publish still sent gh-pages");
});

test("publish-refuses-when-the-build-fails", () => {
  assert.ok(existsSync(publish), "site/publish.ts is missing");
  const f = fixture();
  // A registry that is a file, not a folder, makes the build stop with an error.
  writeFileSync(join(f.dir, "not-a-folder"), "");
  const args = ["--registry", join(f.dir, "not-a-folder"), "--source", join(f.dir, "source")];
  const r = spawnSync(process.execPath, [publish, ...args], { cwd: f.work, env: { ...env, PATH: fakeGh(f.dir) }, encoding: "utf8" });
  assert.notEqual(r.status, 0, "publishing went on after the build failed");
  assert.ok(!published(f.origin), "gh-pages was sent although the build failed");
});
