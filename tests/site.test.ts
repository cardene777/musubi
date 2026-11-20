import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { root, skillMd, tree } from "./helpers.ts";

const build = join(root, "site", "build.ts");
const BASE = "https://musubi.example";

const provider = (version: string) =>
  JSON.stringify({ musubi: "2026-11-19", provides: { design: { version, file: "formats/design.md" } } });
const consumer = JSON.stringify({
  musubi: "2026-11-19",
  follows: { "design-doc/design": { version: "^1.0.0", integrity: "sha256-AAAA" } },
});

// Two repositories: alice lists a provider, a consumer, and a folder without musubi.json, and keeps
// one more skill it does not list; bob lists a provider with the same name as alice's.
function fixture(extra: Record<string, string> = {}) {
  return tree({
    "registry/alice/skills-a.json": JSON.stringify({ skills: ["skills/design-doc", "skills/api-design", "skills/missing-json"] }),
    "registry/bob/tools.json": JSON.stringify({ skills: ["design-doc"] }),
    "source/alice/skills-a/skills/design-doc/SKILL.md": skillMd("design-doc"),
    "source/alice/skills-a/skills/design-doc/musubi.json": provider("1.0.0"),
    "source/alice/skills-a/skills/api-design/SKILL.md": skillMd("api-design"),
    "source/alice/skills-a/skills/api-design/musubi.json": consumer,
    "source/alice/skills-a/skills/unlisted/SKILL.md": skillMd("unlisted"),
    "source/alice/skills-a/skills/unlisted/musubi.json": consumer,
    "source/alice/skills-a/skills/missing-json/SKILL.md": skillMd("missing-json"),
    "source/bob/tools/design-doc/SKILL.md": skillMd("design-doc"),
    "source/bob/tools/design-doc/musubi.json": provider("2.0.0"),
    ...extra,
  });
}

function run(dir: string) {
  assert.ok(existsSync(build), "site/build.ts is missing");
  const out = join(dir, "out");
  const r = spawnSync(
    process.execPath,
    [build, "--registry", join(dir, "registry"), "--source", join(dir, "source"), "--out", out, "--base-url", BASE],
    { cwd: dir, encoding: "utf8" },
  );
  return { out, code: r.status, stdout: r.stdout, stderr: r.stderr };
}

function built(dir = fixture()) {
  const r = run(dir);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  return r;
}

const page = (out: string, path: string) => {
  const file = join(out, path, "index.html");
  assert.ok(existsSync(file), `${path}/index.html was not written`);
  return readFileSync(file, "utf8");
};

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const htmlFiles = (dir: string) => walk(dir).filter((path) => path.endsWith(".html"));

// The rows of the skills list, keyed by the data-skill attribute (<owner>/<repo>/<skill>).
function rows(html: string): Map<string, string> {
  const found = new Map<string, string>();
  for (const match of html.matchAll(/<tr data-skill="([^"]+)">([\s\S]*?)<\/tr>/g)) found.set(match[1], match[2]);
  return found;
}

const section = (html: string, name: string) => {
  const match = new RegExp(`<section data-section="${name}">([\\s\\S]*?)</section>`).exec(html);
  assert.ok(match, `no ${name} section`);
  return match[1];
};

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function headings(path: string): string[] {
  let fenced = false;
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => {
      if (line.startsWith("```")) fenced = !fenced;
      return !fenced && /^#{1,3} /.test(line);
    })
    .map((line) => line.replace(/^#+ /, "").replace(/`/g, ""));
}

test("site-renders-the-spec-in-both-languages", () => {
  const { out } = built();
  for (const [path, spec, lang] of [
    ["spec", "musubi.md", "en"],
    ["ja/spec", "musubi.ja.md", "ja"],
  ]) {
    const html = page(out, path);
    assert.match(html, new RegExp(`<html lang="${lang}"`));
    for (const heading of headings(join(root, "spec", spec))) {
      assert.ok(html.includes(escape(heading)), `${path} has no heading "${heading}"`);
    }
  }
});

test("site-reads-the-spec-without-a-copy", () => {
  assert.ok(existsSync(build), "site/build.ts is missing");
  const sentence = readFileSync(join(root, "spec", "musubi.md"), "utf8")
    .split("\n")
    .find((line) => line.startsWith("A skill declares"));
  assert.ok(sentence, "the spec lost its overview sentence");
  const sources = walk(join(root, "site")).filter((path) => !relative(join(root, "site"), path).startsWith("dist"));
  for (const path of sources) {
    assert.ok(!readFileSync(path, "utf8").includes(sentence.slice(0, 60)), `${relative(root, path)} copies the spec`);
  }
});

test("site-lists-registered-skills", () => {
  const { out } = built();
  const list = rows(page(out, "skills"));
  const design = list.get("alice/skills-a/design-doc");
  assert.ok(design, "alice's design-doc is not listed");
  assert.match(design, /alice\/skills-a/);
  assert.match(design, /design/);
  assert.match(design, /1\.0\.0/);
  const api = list.get("alice/skills-a/api-design");
  assert.ok(api, "api-design is not listed");
  assert.match(api, /design-doc\/design/);
  assert.match(api, /\^1\.0\.0/);
});

test("site-leaves-out-unregistered-skills", () => {
  const { out } = built();
  const html = page(out, "skills");
  assert.ok(!html.includes("unlisted"), "a skill the registry does not name is listed");
  assert.ok(!existsSync(join(out, "skills", "alice", "skills-a", "unlisted")), "a page was written for an unlisted skill");
});

test("site-skill-page-shows-both-directions", () => {
  const { out } = built();
  const edge = 'data-edge="alice/skills-a/api-design -&gt; alice/skills-a/design-doc"';
  const provider = page(out, "skills/alice/skills-a/design-doc");
  assert.match(section(provider, "followed-by"), /api-design/);
  assert.ok(provider.includes("<svg"), "the provider page has no graph");
  assert.ok(provider.includes(edge) || provider.includes(edge.replace("&gt;", ">")), "the provider page draws no arrow from api-design");
  const follower = page(out, "skills/alice/skills-a/api-design");
  const follows = section(follower, "follows");
  assert.match(follows, /design-doc\/design/);
  assert.match(follows, /\^1\.0\.0/);
  assert.match(follows, /href="[^"]*skills\/alice\/skills-a\/design-doc\/"/);
  assert.ok(follower.includes(edge) || follower.includes(edge.replace("&gt;", ">")), "the follower page draws no arrow to design-doc");
});

test("site-tells-apart-same-skill-names", () => {
  const { out } = built();
  page(out, "skills/alice/skills-a/design-doc");
  const bob = page(out, "skills/bob/tools/design-doc");
  assert.match(bob, /2\.0\.0/);
  const list = rows(page(out, "skills"));
  assert.match(list.get("alice/skills-a/design-doc") ?? "", /alice\/skills-a/);
  assert.match(list.get("bob/tools/design-doc") ?? "", /bob\/tools/);
  const follows = section(page(out, "skills/alice/skills-a/api-design"), "follows");
  assert.match(follows, /skills\/alice\/skills-a\/design-doc\//, "api-design is not bound to the design-doc of its own repository");
  assert.ok(!follows.includes("bob/tools"), "api-design was bound to bob's design-doc");
});

test("site-names-unreadable-entries", () => {
  const r = run(fixture());
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(r.stderr, /registry\/alice\/skills-a\.json/);
  assert.match(r.stderr, /skills\/missing-json/);
  assert.ok(!existsSync(join(r.out, "skills", "alice", "skills-a", "missing-json")));
  assert.ok(!rows(page(r.out, "skills")).has("alice/skills-a/missing-json"));
});

test("site-pages-the-list-by-50", () => {
  const files: Record<string, string> = {
    "registry/carol/many.json": JSON.stringify({ skills: Array.from({ length: 51 }, (_, i) => `s${String(i).padStart(2, "0")}`) }),
  };
  for (let i = 0; i < 51; i += 1) {
    const name = `s${String(i).padStart(2, "0")}`;
    files[`source/carol/many/${name}/SKILL.md`] = skillMd(name);
    files[`source/carol/many/${name}/musubi.json`] = provider("1.0.0");
  }
  const { out } = built(tree(files));
  const first = page(out, "skills");
  const second = page(out, "skills/page/2");
  assert.equal(rows(first).size, 50);
  assert.equal(rows(second).size, 1);
  for (const html of [first, second]) assert.equal(html.match(/<nav class="pager"/g)?.length, 2, "a list page lacks a pager at the top or bottom");
  assert.ok(!existsSync(join(out, "skills", "page", "3")));
  page(out, "ja/skills/page/2");
});

test("site-header-switches-the-language", () => {
  const { out } = built();
  const pages = htmlFiles(out);
  assert.ok(pages.length > 0);
  for (const file of pages) {
    const html = readFileSync(file, "utf8");
    const name = relative(out, file);
    assert.match(html, /<link rel="alternate" hreflang="en" href="[^"]+"/, `${name} has no hreflang en`);
    assert.match(html, /<link rel="alternate" hreflang="ja" href="[^"]+"/, `${name} has no hreflang ja`);
    const link = /<a [^>]*data-lang-switch[^>]*href="([^"]+)"|<a [^>]*href="([^"]+)"[^>]*data-lang-switch/.exec(html);
    assert.ok(link, `${name} has no language switch in its header`);
    const target = (link[1] ?? link[2]).replace(BASE, "");
    assert.ok(target.startsWith("/") && target.endsWith("/"), `${name} switches to ${target}, which is not a page path`);
    assert.ok(existsSync(join(out, target, "index.html")), `${name} switches to ${target}, which was not written`);
  }
});

test("site-writes-the-search-files", () => {
  const { out } = built();
  const sitemap = readFileSync(join(out, "sitemap.xml"), "utf8");
  for (const file of htmlFiles(out)) {
    const path = relative(out, file).replace(/index\.html$/, "");
    assert.ok(sitemap.includes(`<loc>${BASE}/${path}</loc>`), `sitemap.xml does not list /${path}`);
    const html = readFileSync(file, "utf8");
    const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
    assert.ok(ld, `${path} has no JSON-LD`);
    JSON.parse(ld[1]);
  }
  const llms = readFileSync(join(out, "llms.txt"), "utf8");
  assert.ok(llms.includes(`${BASE}/spec/`), "llms.txt does not link the definition");
  assert.ok(llms.includes(`${BASE}/skills/alice/skills-a/design-doc/`), "llms.txt does not link the skill pages");
});

// The tag of each <link> or <meta> whose attribute matches, so a test can read its other attributes.
const tags = (html: string, kind: "link" | "meta", match: RegExp) =>
  [...html.matchAll(new RegExp(`<${kind}\\b[^>]*>`, "g"))].map((m) => m[0]).filter((tag) => match.test(tag));
const href = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "";

// The width and height a PNG file records in its IHDR chunk.
function pngSize(path: string): { width: number; height: number } {
  const bytes = readFileSync(path);
  assert.equal(bytes.subarray(1, 4).toString("latin1"), "PNG", `${path} is not a PNG`);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("site-pages-name-the-icons", () => {
  const { out } = built();
  for (const file of htmlFiles(out)) {
    const html = readFileSync(file, "utf8");
    const name = relative(out, file);
    for (const rel of [/\srel="icon"/, /\srel="apple-touch-icon"/]) {
      const [tag] = tags(html, "link", rel);
      assert.ok(tag, `${name} names no ${rel.source}`);
      const target = href(tag, "href");
      assert.ok(target.startsWith("/") && !target.startsWith("//"), `${name} reads ${target} from outside the site`);
      assert.ok(existsSync(join(out, target)), `${name} names ${target}, which was not written`);
    }
  }
});

test("site-icons-have-the-sizes-the-browsers-read", () => {
  const { out } = built();
  const html = page(out, ".");
  const touch = href(tags(html, "link", /\srel="apple-touch-icon"/)[0] ?? "", "href");
  assert.ok(touch, "the home page names no apple-touch-icon");
  assert.deepEqual(pngSize(join(out, touch)), { width: 180, height: 180 });
  const share = href(tags(html, "meta", /property="og:image"/)[0] ?? "", "content").replace(BASE, "");
  assert.ok(share, "the home page names no og:image");
  assert.deepEqual(pngSize(join(out, share)), { width: 1200, height: 630 });
  const svg = href(tags(html, "link", /\srel="icon"/)[0] ?? "", "href");
  assert.match(readFileSync(join(out, svg), "utf8"), /^<svg [^>]*viewBox="/, `${svg} is not an SVG with a viewBox`);
});

test("site-pages-name-the-share-image", () => {
  const { out } = built();
  for (const file of htmlFiles(out)) {
    const html = readFileSync(file, "utf8");
    const name = relative(out, file);
    const [tag] = tags(html, "meta", /property="og:image"/);
    assert.ok(tag, `${name} has no og:image`);
    const content = href(tag, "content");
    assert.ok(content.startsWith(`${BASE}/`), `${name} names ${content} for og:image, which does not start with the base URL`);
    assert.ok(existsSync(join(out, content.replace(BASE, ""))), `${name} names ${content}, which was not written`);
  }
});

test("site-header-shows-the-logo", () => {
  const { out } = built();
  for (const file of htmlFiles(out)) {
    const html = readFileSync(file, "utf8");
    const brand = /<a class="brand"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    assert.ok(brand, `${relative(out, file)} has no brand link in its header`);
    assert.match(brand[1], /^<svg class="logo"[\s\S]*<\/svg>musubi$/, `${relative(out, file)} has no logo left of the name`);
  }
});

test("site-home-follows-the-chosen-design", () => {
  const { out } = built();
  for (const path of [".", "ja"]) {
    const html = page(out, path);
    const order = [...html.matchAll(/<section [^>]*data-home="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(order, ["hero", "how", "registered", "next"], `${path}: the home sections are not in the chosen order`);
    const binding = /<figure class="binding"[^>]*>([\s\S]*?)<\/figure>/.exec(html);
    assert.ok(binding, `${path}: the hero has no binding diagram`);
    assert.match(binding[1], /data-provider="alice\/skills-a\/design-doc"/, `${path}: the diagram does not show the provider`);
    assert.match(binding[1], /data-follower="alice\/skills-a\/api-design"/, `${path}: the diagram does not show the follower`);
    const tabs = [...html.matchAll(/<button [^>]*data-cmd="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(tabs, ["npm install -g musubi-cli", "pnpm add -g musubi-cli", "npx musubi-cli check skills"]);
    assert.equal([...html.matchAll(/data-step="\d"/g)].length, 3, `${path}: the how section does not have three steps`);
    assert.match(html, /prefers-reduced-motion|data-motion/, `${path}: the hero has no motion`);
  }
});

test("site-pages-share-one-stylesheet", () => {
  const { out } = built();
  for (const file of htmlFiles(out)) {
    const html = readFileSync(file, "utf8");
    const name = relative(out, file);
    const sheets = tags(html, "link", /\srel="stylesheet"/).map((tag) => href(tag, "href")).filter((h) => h.startsWith("/"));
    assert.deepEqual(sheets, ["/assets/site.css"], `${name} reads other stylesheets`);
    assert.equal([...html.matchAll(/<header class="header">/g)].length, 1, `${name} has no single header`);
    assert.equal([...html.matchAll(/<footer class="footer">/g)].length, 1, `${name} has no single footer`);
  }
});

test("site-defaults-to-the-public-url", () => {
  const dir = fixture();
  const out = join(dir, "public");
  const r = spawnSync(process.execPath, [build, "--registry", join(dir, "registry"), "--source", join(dir, "source"), "--out", out], {
    cwd: dir,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const PUBLIC = "https://musubi.cardene.dev";
  for (const path of [".", "ja", "spec"]) {
    const html = page(out, path);
    const canonical = href(tags(html, "link", /rel="canonical"/)[0] ?? "", "href");
    assert.ok(canonical.startsWith(`${PUBLIC}/`), `${path}: the canonical URL ${canonical} does not start with ${PUBLIC}/`);
    const share = href(tags(html, "meta", /property="og:image"/)[0] ?? "", "content");
    assert.ok(share.startsWith(`${PUBLIC}/`), `${path}: og:image ${share} does not start with ${PUBLIC}/`);
  }
  const locs = [...readFileSync(join(out, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, "sitemap.xml lists no page");
  for (const loc of locs) assert.ok(loc.startsWith(`${PUBLIC}/`), `sitemap.xml lists ${loc}, which does not start with ${PUBLIC}/`);
});

test("site-writes-the-pages-files", () => {
  const { out } = built();
  assert.ok(existsSync(join(out, "CNAME")), "CNAME was not written");
  assert.equal(readFileSync(join(out, "CNAME"), "utf8"), "musubi.example\n", "CNAME does not hold the host of the base URL");
  assert.ok(existsSync(join(out, ".nojekyll")), ".nojekyll was not written");
  assert.equal(readFileSync(join(out, ".nojekyll"), "utf8"), "", ".nojekyll is not empty");
});

test("registry-entries-are-well-formed", () => {
  const registry = join(root, "registry");
  assert.ok(existsSync(registry), "registry/ is missing");
  const entries = readdirSync(registry);
  assert.ok(entries.length > 0, "registry/ is empty");
  for (const owner of entries) {
    assert.ok(statSync(join(registry, owner)).isDirectory(), `registry/${owner} is not an owner folder`);
    for (const file of readdirSync(join(registry, owner))) {
      const name = `registry/${owner}/${file}`;
      assert.match(file, /^[A-Za-z0-9_.-]+\.json$/, `${name} is not <repo>.json`);
      const value = JSON.parse(readFileSync(join(registry, owner, file), "utf8"));
      assert.deepEqual(Object.keys(value), ["skills"], `${name} holds fields other than skills`);
      assert.ok(Array.isArray(value.skills) && value.skills.length > 0, `${name} lists no skills`);
      assert.equal(new Set(value.skills).size, value.skills.length, `${name} lists a folder twice`);
      for (const path of value.skills) {
        assert.equal(typeof path, "string");
        assert.ok(!path.startsWith("/") && !path.split("/").includes("..") && !path.endsWith("/"), `${name} lists ${path}, which is not a folder inside the repository`);
      }
    }
  }
});

test("registry-lists-the-first-skills", () => {
  const registry = join(root, "registry");
  assert.ok(existsSync(registry), "registry/ is missing");
  const owner = readdirSync(registry).find((name) => existsSync(join(registry, name, "agent-shuriken.json")));
  assert.ok(owner, "registry/ has no agent-shuriken entry");
  const { skills } = JSON.parse(readFileSync(join(registry, owner, "agent-shuriken.json"), "utf8"));
  assert.deepEqual([...skills].sort(), [
    "plugins/doc-formats/skills/design-doc",
    "plugins/evm-dev/skills/contract-design",
    "plugins/evm-dev/skills/dapp-architecture",
    "plugins/evm-dev/skills/financial-standards",
    "plugins/evm-dev/skills/multichain-design",
    "plugins/evm-dev/skills/wallet-design",
  ]);
});
