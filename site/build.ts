#!/usr/bin/env node
// Builds the musubi site into one folder of static pages:
//   node site/build.ts [--registry <folder>] [--source <folder>] [--out <folder>] [--base-url <url>]
// It reads the definition from spec/ and the registry from registry/<owner>/<repo>.json, takes each
// listed skill's musubi.json and SKILL.md from GitHub (or from --source/<owner>/<repo>/<folder>), and
// writes the English pages at / and the Japanese pages at /ja/, with sitemap.xml, robots.txt, and llms.txt,
// and the CNAME and .nojekyll files GitHub Pages reads (site/publish.ts sends the folder there).
// A listed folder whose musubi.json cannot be read is named on stderr and left out of the site.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, posix, resolve } from "node:path";
import { latestDefinition } from "../src/definition.ts";
import { type GraphEdge, type GraphNode, graphSvg } from "../src/graph.ts";
import { escape, render } from "./markdown.ts";
import { fill, type Key, type Lang, TEXT } from "./text.ts";

const root = resolve(import.meta.dirname, "..");
const DEFAULT_BASE = "https://musubi.cardene.dev";
const PER_PAGE = 50;
const LANGS: Lang[] = ["en", "ja"];
const MARKER = ".musubi-site";

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const repoUrl = String(pkg.repository?.url ?? "").replace(/^git\+/, "").replace(/\.git$/, "");

type Options = { registry: string; source: string | null; out: string; base: string };
type Provided = { name: string; version: string; file: string; check: string };
type Followed = { ref: string; skill: string; content: string; range: string };
type Skill = {
  id: string;
  owner: string;
  repo: string;
  folder: string;
  name: string;
  description: string;
  provides: Provided[];
  follows: Followed[];
  text: string;
};
type Entry = { owner: string; repo: string; file: string; skills: string[] };
// One arrow: every content `from` follows in `to` (or in a skill not on the site, named `missing`).
type Link = { from: Skill; to: Skill | null; missing: string; follows: Followed[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value : "");

function options(argv: string[]): Options {
  const o: Options = {
    registry: join(root, "registry"),
    source: null,
    out: join(root, "site", "dist"),
    base: DEFAULT_BASE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i + 1];
    const take = () => {
      if (value === undefined || value.startsWith("--")) usage(`${argv[i]} needs a value`);
      i += 1;
      return value;
    };
    if (argv[i] === "--registry") o.registry = resolve(take());
    else if (argv[i] === "--source") o.source = resolve(take());
    else if (argv[i] === "--out") o.out = resolve(take());
    else if (argv[i] === "--base-url") o.base = take().replace(/\/+$/, "");
    else usage(`unknown option ${argv[i]}`);
  }
  return o;
}

function usage(message: string): never {
  process.stderr.write(`musubi site: ${message}\nusage: node site/build.ts [--registry <folder>] [--source <folder>] [--out <folder>] [--base-url <url>]\n`);
  process.exit(2);
}

function readRegistry(dir: string, warn: (message: string) => void): Entry[] {
  if (!existsSync(dir)) {
    warn(`${dir} does not exist; the list is empty`);
    return [];
  }
  const entries: Entry[] = [];
  for (const owner of readdirSync(dir).sort()) {
    const ownerDir = join(dir, owner);
    if (!statSync(ownerDir).isDirectory()) continue;
    for (const file of readdirSync(ownerDir).sort()) {
      if (!file.endsWith(".json")) continue;
      const name = `registry/${owner}/${file}`;
      let value: unknown;
      try {
        value = JSON.parse(readFileSync(join(ownerDir, file), "utf8"));
      } catch (error) {
        warn(`${name}: not valid JSON (${(error as Error).message}); left out`);
        continue;
      }
      if (!isObject(value) || !Array.isArray(value.skills) || !value.skills.every((s) => typeof s === "string")) {
        warn(`${name}: "skills" must list the skill folders as strings; left out`);
        continue;
      }
      const skills: string[] = [];
      for (const raw of value.skills as string[]) {
        const folder = raw.replace(/^\.\//, "").replace(/\/+$/, "");
        if (folder === "" || folder.startsWith("/") || folder.split("/").includes("..")) {
          warn(`${name}: ${raw} is not a folder inside the repository; left out`);
        } else if (!skills.includes(folder)) skills.push(folder);
      }
      entries.push({ owner, repo: file.slice(0, -".json".length), file: name, skills });
    }
  }
  return entries;
}

async function readFile(o: Options, entry: Entry, folder: string, file: string): Promise<string | null> {
  if (o.source) {
    const path = join(o.source, entry.owner, entry.repo, folder, file);
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  }
  const path = [...folder.split("/"), file].map(encodeURIComponent).join("/");
  try {
    const response = await fetch(`https://raw.githubusercontent.com/${entry.owner}/${entry.repo}/HEAD/${path}`);
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

// The description in the SKILL.md frontmatter, on one line or folded over indented lines.
function description(skillMd: string): string {
  const front = /^---\n([\s\S]*?)\n---/.exec(skillMd.replace(/\r\n/g, "\n"));
  if (!front) return "";
  const lines = front[1].split("\n");
  const at = lines.findIndex((line) => line.startsWith("description:"));
  if (at < 0) return "";
  let value = lines[at].slice("description:".length).trim();
  if (value === "" || value === ">" || value === "|" || value === ">-" || value === "|-") {
    const rest: string[] = [];
    for (const line of lines.slice(at + 1)) {
      if (!/^\s+\S/.test(line)) break;
      rest.push(line.trim());
    }
    value = rest.join(" ");
  }
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

function readSkill(entry: Entry, folder: string, text: string, skillMd: string): Skill | string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return `musubi.json is not valid JSON (${(error as Error).message})`;
  }
  if (!isObject(value)) return "musubi.json does not hold one JSON object";
  const provides = isObject(value.provides)
    ? Object.entries(value.provides)
        .filter(([, v]) => isObject(v))
        .map(([name, v]) => {
          const p = v as Record<string, unknown>;
          return { name, version: str(p.version), file: str(p.file), check: str(p.check) };
        })
    : [];
  const follows = isObject(value.follows)
    ? Object.entries(value.follows)
        .filter(([ref]) => /^[^/]+\/[^/]+$/.test(ref))
        .map(([ref, v]) => {
          const [skill, content] = ref.split("/");
          return { ref, skill, content, range: isObject(v) ? str(v.version) : "" };
        })
    : [];
  const name = basename(folder);
  return {
    id: `${entry.owner}/${entry.repo}/${name}`,
    owner: entry.owner,
    repo: entry.repo,
    folder,
    name,
    description: description(skillMd),
    provides,
    follows,
    text,
  };
}

// A consumer binds to the provider of that name in its own repository first, then to the only
// listed skill with that name. Otherwise the provider is shown as not listed on the site.
function links(skills: Skill[]): Link[] {
  const byName = new Map<string, Skill[]>();
  for (const skill of skills) byName.set(skill.name, [...(byName.get(skill.name) ?? []), skill]);
  const grouped = new Map<string, Link>();
  for (const skill of skills) {
    for (const follow of skill.follows) {
      const candidates = byName.get(follow.skill) ?? [];
      const to =
        candidates.find((c) => c.owner === skill.owner && c.repo === skill.repo) ?? (candidates.length === 1 ? candidates[0] : null);
      const key = `${skill.id} -> ${to ? to.id : `missing:${follow.skill}`}`;
      const link = grouped.get(key) ?? { from: skill, to, missing: follow.skill, follows: [] };
      link.follows.push(follow);
      grouped.set(key, link);
    }
  }
  return [...grouped.values()];
}

const label = (link: Link) => {
  const ranges = new Set(link.follows.map((f) => f.range));
  return ranges.size === 1
    ? `${link.follows.map((f) => f.content).join(", ")} ${[...ranges][0]}`
    : link.follows.map((f) => `${f.content} ${f.range}`).join(", ");
};

// Paths are written without the language; the Japanese page of /x/ is /ja/x/.
const at = (lang: Lang, path: string) => (lang === "ja" ? `/ja${path}` : path);
const skillPath = (skill: Skill) => `/skills/${skill.owner}/${skill.repo}/${skill.name}/`;
const listPath = (page: number) => (page === 1 ? "/skills/" : `/skills/page/${page}/`);

// Icons from Lucide (ISC license), drawn inline so the pages load no script or font for them.
const ICONS: Record<string, string> = {
  link: '<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  github:
    '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  folder:
    '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  pull: '<circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><line x1="6" x2="6" y1="9" y2="21"/>',
  book: '<path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  pointer:
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
};
const icon = (name: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

// The header mark is the tab icon drawn inline, with its two colors taken from the theme.
const logo = readFileSync(join(root, "site", "assets", "icon.svg"), "utf8")
  .trim()
  .replace('<svg xmlns="http://www.w3.org/2000/svg"', '<svg class="logo" width="26" height="26" aria-hidden="true"')
  .replace('stroke="#22D3EE"', 'class="provider"')
  .replace('stroke="#A78BFA"', 'class="follower"')
  .replace('fill="#22D3EE" stroke="none"', 'class="knot"');
if (!/class="provider"[\s\S]*class="follower"[\s\S]*class="knot"/.test(logo)) throw new Error("site/assets/icon.svg no longer has the colors the header logo replaces");

const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");

type Page = {
  lang: Lang;
  path: string;
  title: string;
  description: string;
  body: string;
  ld: Record<string, unknown>;
  nav?: "definition" | "skills";
};

function layout(o: Options, page: Page): string {
  const t = TEXT[page.lang];
  const url =(lang: Lang) => `${o.base}${at(lang, page.path)}`;
  const navLink = (key: "definition" | "skills", text: Key, path: string) =>
    `<a href="${at(page.lang, path)}"${page.nav === key ? ' aria-current="page"' : ""}>${escape(t[text])}</a>`;
  const langPart = (lang: Lang) =>
    lang === page.lang
      ? `<span aria-current="true">${escape(TEXT[lang].langName)}</span>`
      : `<a data-lang-switch hreflang="${lang}" lang="${lang}" href="${at(lang, page.path)}">${escape(TEXT[lang].langName)}</a>`;
  return `<!doctype html>
<html lang="${page.lang}" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(page.title)}</title>
<meta name="description" content="${escape(page.description)}">
<link rel="canonical" href="${url(page.lang)}">
<link rel="alternate" hreflang="en" href="${url("en")}">
<link rel="alternate" hreflang="ja" href="${url("ja")}">
<link rel="alternate" hreflang="x-default" href="${url("en")}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="musubi">
<meta property="og:title" content="${escape(page.title)}">
<meta property="og:description" content="${escape(page.description)}">
<meta property="og:url" content="${url(page.lang)}">
<meta property="og:locale" content="${page.lang === "en" ? "en_US" : "ja_JP"}">
<meta property="og:image" content="${o.base}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1a1d24">
<link rel="icon" href="/assets/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<script>document.documentElement.classList.add("js");try{var m=localStorage.getItem("musubi-theme");if(m==="light"||m==="dark")document.documentElement.dataset.theme=m}catch(e){}</script>
<script type="application/ld+json">${json({ "@context": "https://schema.org", ...page.ld })}</script>
</head>
<body>
<header class="header"><div class="wrap">
<div class="left">
<a class="brand" href="${at(page.lang, "/")}">${logo}musubi</a>
<nav class="nav">${navLink("definition", "navDefinition", "/spec/")}${navLink("skills", "navSkills", "/skills/")}<a href="${repoUrl}">GitHub</a></nav>
</div>
<div class="right">
<div class="lang">${LANGS.map(langPart).join("")}</div>
<button class="icon-button" type="button" data-theme-toggle aria-label="${escape(t.themeToggle)}"><span class="when-dark">${icon("moon")}</span><span class="when-light">${icon("sun")}</span></button>
</div>
</div></header>
<main>
${page.body}
</main>
<footer class="footer"><div class="wrap">
<a class="muted" href="${repoUrl}/blob/HEAD/LICENSE">${escape(t.license)}</a>
<div class="versions"><span>${escape(fill(t.definitionFooter, { date: latestDefinition }))}</span><a class="muted" href="https://www.npmjs.com/package/musubi-cli">musubi-cli ${escape(pkg.version)}</a></div>
</div></footer>
<script>
document.querySelector("[data-theme-toggle]").addEventListener("click",function(){var r=document.documentElement,m=r.dataset.theme==="light"?"dark":"light";r.dataset.theme=m;try{localStorage.setItem("musubi-theme",m)}catch(e){}});
document.querySelectorAll("[data-copy]").forEach(function(b){b.addEventListener("click",function(){if(navigator.clipboard)navigator.clipboard.writeText(b.getAttribute("data-copy")).catch(function(){});b.classList.add("done");setTimeout(function(){b.classList.remove("done")},1200)})});
</script>
</body>
</html>
`;
}

function nodeFor(lang: Lang, skill: Skill, current: boolean): GraphNode {
  const t = TEXT[lang];
  const detail =
    skill.provides.length > 0
      ? fill(t.providesDetail, { names: skill.provides.map((p) => p.name).join(", ") })
      : fill(t.followsDetail, { n: skill.follows.length });
  return { id: skill.id, name: skill.name, detail, current, href: at(lang, skillPath(skill)) };
}

function graph(lang: Lang, nodes: Skill[], arrows: Link[], current?: Skill): string {
  const graphNodes: GraphNode[] = nodes.map((s) => nodeFor(lang, s, s === current));
  for (const arrow of arrows) {
    if (!arrow.to && !graphNodes.some((n) => n.id === `missing:${arrow.missing}`)) {
      graphNodes.push({ id: `missing:${arrow.missing}`, name: arrow.missing, detail: TEXT[lang].notListed, missing: true });
    }
  }
  const edges: GraphEdge[] = arrows.map((a) => {
    const to = a.to ? a.to.id : `missing:${a.missing}`;
    return { from: a.from.id, to, label: label(a), key: `${a.from.id} -> ${to}` };
  });
  return `<div class="graph">${graphSvg(graphNodes, edges).svg}</div>`;
}

// The hero draws one provider and the registered skills that follow it, and the motion raises the
// provider's version and checks each follower again. The provider is the one most skills follow.
type Figure = {
  provider: { id: string; name: string; href: string | null; provides: Provided[] };
  followers: Array<{ id: string; name: string; href: string | null }>;
  more: number;
  cord: string;
  bump: string;
};
const FIGURE_FOLLOWERS = 5;
const LIST_ROWS = 6;
const examples = join(root, "examples", "skills");
const exampleJson = (name: string) => readFileSync(join(examples, name, "musubi.json"), "utf8");
const nextMinor = (version: string) => {
  const m = /^(\d+)\.(\d+)\.\d+/.exec(version);
  return m ? `${m[1]}.${Number(m[2]) + 1}.0` : "";
};

function figure(lang: Lang, skills: Skill[], arrows: Link[]): Figure {
  const byProvider = new Map<Skill, Link[]>();
  for (const a of arrows) if (a.to && a.to.provides.length > 0) byProvider.set(a.to, [...(byProvider.get(a.to) ?? []), a]);
  let best: [Skill, Link[]] | undefined;
  for (const entry of byProvider) if (!best || entry[1].length > best[1].length) best = entry;
  if (best) {
    const [provider, followed] = best;
    const labels = new Set(followed.map(label));
    return {
      provider: { id: provider.id, name: provider.name, href: at(lang, skillPath(provider)), provides: provider.provides },
      followers: followed.slice(0, FIGURE_FOLLOWERS).map((l) => ({ id: l.from.id, name: l.from.name, href: at(lang, skillPath(l.from)) })),
      more: Math.max(0, followed.length - FIGURE_FOLLOWERS),
      cord: labels.size === 1 ? [...labels][0] : provider.name,
      bump: followed[0].follows[0].content,
    };
  }
  // With no registered skill following another, the hero draws the two skills under examples/.
  const entry: Entry = { owner: "examples", repo: "skills", file: "examples/skills", skills: [] };
  const provider = readSkill(entry, "design-doc", exampleJson("design-doc"), "") as Skill;
  const follower = readSkill(entry, "api-design", exampleJson("api-design"), "") as Skill;
  const [link] = links([provider, follower]);
  return {
    provider: { id: provider.id, name: provider.name, href: null, provides: provider.provides },
    followers: [{ id: follower.id, name: follower.name, href: null }],
    more: 0,
    cord: label(link),
    bump: link.follows[0].content,
  };
}

const STATUS =
  '<svg class="tick" viewBox="0 0 16 16" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6.6"/><path d="M5.2 8.2l1.9 1.9 3.7-3.9"/></svg>' +
  '<svg class="spin" viewBox="0 0 16 16" fill="none" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.6"/></svg>';

function figureHtml(lang: Lang, f: Figure): string {
  const t = TEXT[lang];
  const box = (href: string | null, cls: string, inner: string, attrs = "") =>
    href ? `<a class="${cls}" href="${href}"${attrs}>${inner}</a>` : `<div class="${cls}"${attrs}>${inner}</div>`;
  const rows = f.provider.provides
    .map((p) => {
      const next = p.name === f.bump ? nextMinor(p.version) : "";
      const badge = next ? `<span class="badge">${escape(t.changed)}</span>` : "";
      return `<div class="prow"${next ? ` data-bump="${escape(next)}"` : ""}><span class="flash"></span><span class="c">${escape(p.name)}</span><span class="v">${escape(p.version)}</span>${badge}<span class="f">${escape(p.file)}</span></div>`;
    })
    .join("");
  const followers = f.followers
    .map((s, i) =>
      box(s.href, "frow", `<span class="bar"></span><span class="st">${STATUS}</span><span class="n">${escape(s.name)}</span><span class="s">${escape(t.checked)}</span>`, ` style="--i:${i}" data-follower="${escape(s.id)}"`),
    )
    .join("");
  const more = f.more > 0 ? box(f.provider.href, "frow more", escape(fill(t.moreFollowers, { n: f.more })), ` style="--i:${f.followers.length}"`) : "";
  return `<figure class="binding" data-motion data-checking="${escape(t.checking)}" data-checked="${escape(t.checked)}">
<div class="card provider draw" style="--d:500" data-provider="${escape(f.provider.id)}">${box(f.provider.href, "head", `<span class="name">${escape(f.provider.name)}</span><span class="chip provides">provides</span>`)}${rows}</div>
<div class="cord" aria-hidden="true"><span class="line"></span><span class="pulse"></span><span class="label">${icon("link", 14)}follows ${escape(f.cord)}</span></div>
<div class="card followers">${followers}${more}</div>
<figcaption class="sr">${escape(fill(t.bindingCaption, { provider: f.provider.name, n: f.followers.length + f.more }))}</figcaption>
</figure>`;
}

// A declaration under examples/ shown as code: the provided content or followed reference in a color,
// the other keys brighter than the values, and a fingerprint cut short so the line fits the column.
function declaration(name: string, key: "provides" | "follows", mark: string): string {
  const value = JSON.parse(exampleJson(name))[key] as Record<string, unknown>;
  const text = `"${key}": ${JSON.stringify(value, null, 2)}`.replace(/"(sha256-[A-Za-z0-9+/]{4})[A-Za-z0-9+/=]+"/g, '"$1…"');
  const names = new Set(Object.keys(value).map((k) => JSON.stringify(k)));
  return text.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|([^"]+)/g, (_, str: string | undefined, colon: string | undefined, other: string | undefined) => {
    if (other !== undefined) return escape(other);
    if (colon) return `<span class="${names.has(str as string) ? mark : "key"}">${escape(str as string)}</span>${colon}`;
    return escape(str as string);
  });
}

// What musubi check prints for the skills under examples/ after their provider's content changes, and
// after --update. The build runs the command on a copy, so the page shows the command's own words.
function transcript(): Array<{ kind: string; text: string }> {
  const dir = mkdtempSync(join(tmpdir(), "musubi-site-"));
  try {
    cpSync(examples, join(dir, "skills"), { recursive: true });
    appendFileSync(join(dir, "skills", "design-doc", "formats", "design.md"), "\n- One more rule.\n");
    const run = (args: string[]) => {
      const result = spawnSync(process.execPath, [join(root, "src", "cli.ts"), "check", "skills", ...args], { cwd: dir, encoding: "utf8" });
      return `${result.stderr}${result.stdout}`
        .split("\n")
        .filter((line) => line !== "" && !line.startsWith("(node:"))
        .map((text) => ({ kind: !text.startsWith("musubi check:") ? "out" : / ok /.test(text) ? "ok" : "err", text }));
    };
    return [
      { kind: "cmd", text: "$ musubi check skills" },
      ...run([]),
      { kind: "cmd", text: "$ musubi check skills --update" },
      ...run(["--update"]),
    ];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const COMMANDS = [
  { tool: "npm", command: "npm install -g musubi-cli" },
  { tool: "pnpm", command: "pnpm add -g musubi-cli" },
  { tool: "npx", command: "npx musubi-cli check skills" },
];

// Runs the hero's motion, the install tabs, and the sections that rise into view. Without script,
// or with reduced motion asked for, every part is shown at rest.
const HOME_SCRIPT = `<script>
(function(){
var reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
var tabs=[].slice.call(document.querySelectorAll(".tabs [data-cmd]")),cmd=document.querySelector(".install .t"),copy=document.querySelector(".install .copy");
tabs.forEach(function(b){b.addEventListener("click",function(){tabs.forEach(function(x){x.setAttribute("aria-selected",String(x===b))});cmd.textContent=b.dataset.cmd;copy.setAttribute("data-copy",b.dataset.cmd)})});
var term=document.querySelector(".term");
function count(el){var n=+el.dataset.count,t0=performance.now();function step(t){var p=Math.min(1,(t-t0)/900);el.textContent=Math.round(n*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(step)}requestAnimationFrame(step)}
function type(){var lines=[].slice.call(term.children).map(function(s){return[s.className,s.textContent]}),i=0;term.style.minHeight=term.offsetHeight+"px";term.textContent="";
function next(){if(i>=lines.length){var c=document.createElement("span");c.className="caret";term.appendChild(c);return}var l=lines[i++],s=document.createElement("span"),isCmd=l[0]==="line-cmd",j=0;s.className=l[0];term.appendChild(s);
(function ch(){s.textContent=l[1].slice(0,++j);if(j<l[1].length)setTimeout(ch,isCmd?34:4);else{term.appendChild(document.createTextNode("\\n"));setTimeout(next,isCmd?360:120)}})()}next()}
var io=!reduce&&"IntersectionObserver" in window?new IntersectionObserver(function(es){es.forEach(function(e){if(!e.isIntersecting)return;var el=e.target;el.classList.add("in");io.unobserve(el);if(el.contains(term))setTimeout(type,400);el.querySelectorAll("[data-count]").forEach(count)})},{threshold:.2}):null;
document.querySelectorAll(".reveal").forEach(function(el){io?io.observe(el):el.classList.add("in")});
var fig=document.querySelector(".binding"),hero=document.querySelector(".hero"),bump=fig.querySelector("[data-bump]");
if(reduce||!bump)return;
var rows=[].slice.call(fig.querySelectorAll("[data-follower]")),pulse=fig.querySelector(".pulse"),cord=fig.querySelector(".cord"),ver=bump.querySelector(".v"),before=ver.textContent,after=bump.dataset.bump;
function status(r,cls,text){r.classList.remove("checking","rechecked");if(cls)r.classList.add(cls);r.querySelector(".s").textContent=text}
function story(){if(document.hidden)return setTimeout(story,1000);
rows.forEach(function(r){status(r,"",fig.dataset.checked)});bump.classList.remove("changed");ver.textContent=before;
setTimeout(function(){bump.classList.add("changed");ver.textContent=after},900);
setTimeout(function(){pulse.animate([{top:"0px",opacity:0},{opacity:1,offset:.15},{opacity:1,offset:.85},{top:(cord.offsetHeight-10)+"px",opacity:0}],{duration:800,easing:"cubic-bezier(.4,0,.2,1)"})},1700);
rows.forEach(function(r,i){setTimeout(function(){status(r,"checking",fig.dataset.checking)},2500+i*260);setTimeout(function(){status(r,"rechecked",fig.dataset.checked)},3400+i*260)});
setTimeout(function(){bump.classList.remove("changed")},6400);setTimeout(story,8200)}
setTimeout(function(){hero.classList.remove("motion");story()},3000);
})();
</script>`;

function homePage(o: Options, lang: Lang, skills: Skill[], arrows: Link[], lines: Array<{ kind: string; text: string }>): Page {
  const t = TEXT[lang];
  const repos = new Set(skills.map((s) => `${s.owner}/${s.repo}`)).size;
  const follows = arrows.reduce((n, a) => n + a.follows.length, 0);
  const tabs = COMMANDS.map(
    (c, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-cmd="${escape(c.command)}">${escape(c.tool)}</button>`,
  ).join("");
  const step = (n: number, title: string, body: string, head: string, code: string, cls = "") =>
    `<li class="step" data-step="${n}"><span class="num">0${n}</span><h3>${escape(title)}</h3><p>${escape(body)}</p><div class="code"><div class="ch">${escape(head)}</div><pre${cls ? ` class="${cls}"` : ""}>${code}</pre></div></li>`;
  const row = (i: number, s: Skill, detail: string, right: string) =>
    `<a class="irow" href="${at(lang, skillPath(s))}"><span class="i">${String(i + 1).padStart(2, "0")}</span><span class="t"><b>${escape(s.name)}</b><span>${escape(detail)}</span></span>${right ? `<span class="r">${escape(right)}</span>` : ""}</a>`;
  const providers = skills
    .filter((s) => s.provides.length > 0)
    .map((s) => ({ s, n: arrows.filter((a) => a.to === s).length }))
    .sort((a, b) => b.n - a.n || a.s.name.localeCompare(b.s.name))
    .slice(0, LIST_ROWS)
    .map(({ s, n }, i) => row(i, s, s.provides.map((p) => `${p.name} ${p.version}`).join(", "), fill(t.followedByCount, { n })))
    .join("");
  const consumers = skills
    .filter((s) => s.follows.length > 0)
    .slice(0, LIST_ROWS)
    .map((s, i) => row(i, s, s.follows.map((f) => `${f.ref} ${f.range}`).join(", "), ""))
    .join("");
  const stat = (n: number, text: string) => `<div><strong data-count="${n}">${n}</strong><span>${escape(text)}</span></div>`;
  const body = `<div class="wrap">
<section class="hero" data-home="hero">
<div>
<p class="eyebrow draw" style="--d:0">${escape(t.eyebrow)}</p>
<h1 class="draw" style="--d:80">${escape(t.heroTitle)}</h1>
<p class="lead draw" style="--d:200">${escape(t.heroLead)}</p>
<div class="install draw" style="--d:300"><div class="tabs" role="tablist" aria-label="${escape(t.installLabel)}">${tabs}</div><div class="cmd"><span class="p">$</span><code class="t">${escape(COMMANDS[0].command)}</code><button class="copy" type="button" data-copy="${escape(COMMANDS[0].command)}" aria-label="${escape(t.copy)}">${icon("copy")}</button></div></div>
<div class="actions draw" style="--d:380"><a class="button primary" href="${at(lang, "/spec/")}">${escape(t.readDefinition)}${icon("arrow")}</a><a class="button secondary" href="${at(lang, "/skills/")}">${escape(t.browseSkills)}</a></div>
</div>
${figureHtml(lang, figure(lang, skills, arrows))}
</section>
<script>if(!matchMedia("(prefers-reduced-motion: reduce)").matches)document.querySelector(".hero").classList.add("motion")</script>
<section class="how reveal" data-home="how">
<div class="sec-head"><p class="eyebrow">${escape(t.howEyebrow)}</p><h2>${escape(t.howHeading)}</h2></div>
<ol class="steps">
${step(1, t.step1Title, t.step1Body, "design-doc/musubi.json", declaration("design-doc", "provides", "k"))}
${step(2, t.step2Title, t.step2Body, "api-design/musubi.json", declaration("api-design", "follows", "k2"))}
${step(3, t.step3Title, t.step3Body, t.terminal, lines.map((l) => `<span class="line-${l.kind}">${escape(l.text)}</span>`).join("\n"), "term")}
</ol>
</section>
${
  skills.length > 0
    ? `<section class="registered reveal" data-home="registered">
<div class="sec-row"><div class="sec-head"><p class="eyebrow">${escape(t.registeredEyebrow)}</p><h2>${escape(t.registeredHeading)}</h2></div><a class="more" href="${at(lang, "/skills/")}">${escape(t.seeAll)}${icon("arrow")}</a></div>
<div class="cols">
<div class="card col"><div class="chd">${escape(t.listProviders)}</div>${providers}<div class="nums">${stat(skills.length, t.statSkills)}${stat(repos, t.statRepositories)}${stat(follows, t.statFollows)}</div></div>
<div class="card col"><div class="chd">${escape(t.listFollowers)}</div>${consumers || `<p class="empty">${escape(t.noFollows)}</p>`}</div>
</div>
</section>`
    : ""
}
<section class="next reveal" data-home="next">
<a class="ncard" href="${at(lang, "/spec/")}">${icon("book", 22)}<h3>${escape(t.definitionCardTitle)}</h3><p>${escape(fill(t.definitionCardBody, { date: latestDefinition }))}</p><span class="go">${escape(t.readDefinition)}${icon("arrow")}</span></a>
<a class="ncard" href="${repoUrl}/blob/HEAD/${t.readme}${t.howToRegisterAnchor}">${icon("pull", 22)}<h3>${escape(t.listYours)}</h3><p>${escape(t.listYoursBody)}</p><span class="go">${escape(t.howToRegister)}${icon("arrow")}</span></a>
</section>
</div>
${HOME_SCRIPT}`;
  return {
    lang,
    path: "/",
    title: `musubi: ${t.heroTitle}`,
    description: t.siteDescription,
    body,
    ld: { "@type": "WebSite", name: "musubi", url: `${o.base}${at(lang, "/")}`, inLanguage: lang, description: t.siteDescription },
  };
}

function specPage(o: Options, lang: Lang): Page {
  const t = TEXT[lang];
  const file = lang === "en" ? "musubi.md" : "musubi.ja.md";
  const link = (href: string) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const [path, hash] = href.split("#");
    const target = posix.normalize(posix.join("spec", path));
    const anchor = hash ? `#${hash}` : "";
    if (target === "spec/musubi.md") return `/spec/${anchor}`;
    if (target === "spec/musubi.ja.md") return `/ja/spec/${anchor}`;
    return `${repoUrl}/blob/HEAD/${target}${anchor}`;
  };
  const doc = render(readFileSync(join(root, "spec", file), "utf8"), link);
  const toc = doc.headings
    .map((h) => `<a${h.level > 2 ? ' class="sub"' : ""} href="#${h.id}">${escape(h.text)}</a>`)
    .join("\n");
  const body = `<div class="wrap"><div class="definition">
<nav class="toc" aria-label="${escape(t.contents)}"><strong>${escape(t.contents)}</strong>
${toc}
</nav>
<article class="article">
<div class="version"><span class="chip">${escape(fill(t.definitionVersion, { date: latestDefinition }))}</span>${t.normativeNote ? `<span>${escape(t.normativeNote)}</span>` : ""}</div>
<h1>${escape(doc.title)}</h1>
${doc.html}
</article>
</div></div>`;
  return {
    lang,
    path: "/spec/",
    title: `${doc.title} | musubi`,
    description: t.siteDescription,
    body,
    nav: "definition",
    ld: {
      "@type": "TechArticle",
      headline: doc.title,
      inLanguage: lang,
      url: `${o.base}${at(lang, "/spec/")}`,
      version: latestDefinition,
      ...(lang === "ja" ? { translationOfWork: { "@id": `${o.base}/spec/` } } : {}),
    },
  };
}

function pager(lang: Lang, page: number, pages: number): string {
  const t = TEXT[lang];
  const item = (n: number) =>
    n === page ? `<span aria-current="page">${n}</span>` : `<a href="${at(lang, listPath(n))}">${n}</a>`;
  const prev =
    page > 1
      ? `<a href="${at(lang, listPath(page - 1))}" rel="prev">${icon("left", 15)}${escape(t.previous)}</a>`
      : `<span class="disabled">${icon("left", 15)}${escape(t.previous)}</span>`;
  const next =
    page < pages
      ? `<a href="${at(lang, listPath(page + 1))}" rel="next">${escape(t.next)}${icon("right", 15)}</a>`
      : `<span class="disabled">${escape(t.next)}${icon("right", 15)}</span>`;
  return `<nav class="pager" aria-label="${escape(t.pageLabel)}">${prev}${Array.from({ length: pages }, (_, i) => item(i + 1)).join("")}${next}</nav>`;
}

function listPage(o: Options, lang: Lang, skills: Skill[], arrows: Link[], page: number, pages: number): Page {
  const t = TEXT[lang];
  const shown = skills.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const followers = (s: Skill) => arrows.filter((a) => a.to === s).length;
  const repos = new Set(skills.map((s) => `${s.owner}/${s.repo}`)).size;
  const rows = shown
    .map((s) => {
      const provides = s.provides.length
        ? `<div class="inline">${s.provides.map((p) => `<span class="chip provides">${escape(`${p.name} ${p.version}`)}</span>`).join("")}</div>`
        : '<span class="muted">—</span>';
      const follows = s.follows.length
        ? `<div class="stack">${s.follows.map((f) => `<span class="chip follows">${escape(`${f.ref} ${f.range}`)}</span>`).join("")}</div>`
        : '<span class="muted">—</span>';
      const n = followers(s);
      return `<tr data-skill="${escape(s.id)}"><td><a class="name" href="${at(lang, skillPath(s))}">${escape(s.name)}</a><span class="repo">${escape(`${s.owner}/${s.repo}`)}</span></td><td>${provides}</td><td>${follows}</td><td class="count${n === 0 ? " muted" : ""}">${n}</td></tr>`;
    })
    .join("\n");
  const body = `<div class="wrap">
<div class="page-title"><div><h1>${escape(t.skillsTitle)}</h1><p>${escape(fill(t.skillsSubtitle, { skills: skills.length, repos }))}</p></div><a class="button secondary" href="${repoUrl}/blob/HEAD/${t.readme}${t.howToRegisterAnchor}">${icon("pull")}${escape(t.howToRegister)}</a></div>
${pager(lang, page, pages)}
<div class="table-scroll"><table class="skills">
<thead><tr><th>${escape(t.colSkill)}</th><th>${escape(t.colProvides)}</th><th>${escape(t.colFollows)}</th><th>${escape(t.colFollowedBy)}</th></tr></thead>
<tbody>
${rows}
</tbody>
</table></div>
${pager(lang, page, pages)}
</div>`;
  return {
    lang,
    path: listPath(page),
    title: `${t.skillsPageTitle}${page > 1 ? ` (${fill(t.pageOf, { page })})` : ""} | musubi`,
    description: fill(t.skillsSubtitle, { skills: skills.length, repos }),
    body,
    nav: "skills",
    ld: {
      "@type": "ItemList",
      name: t.skillsPageTitle,
      numberOfItems: skills.length,
      itemListElement: shown.map((s, i) => ({
        "@type": "ListItem",
        position: (page - 1) * PER_PAGE + i + 1,
        url: `${o.base}${at(lang, skillPath(s))}`,
        name: `${s.owner}/${s.repo}/${s.name}`,
      })),
    },
  };
}

function skillPage(o: Options, lang: Lang, skill: Skill, arrows: Link[]): Page {
  const t = TEXT[lang];
  const outgoing = arrows.filter((a) => a.from === skill);
  const incoming = arrows.filter((a) => a.to === skill);
  const near = [skill, ...outgoing.flatMap((a) => (a.to ? [a.to] : [])), ...incoming.map((a) => a.from)];
  const nodes = [...new Set(near)].sort((a, b) => a.id.localeCompare(b.id));
  const role = skill.provides.length > 0 ? "provider" : "consumer";
  const sourceUrl = `https://github.com/${skill.owner}/${skill.repo}/tree/HEAD/${skill.folder}`;
  const provides = skill.provides.length
    ? skill.provides
        .map(
          (p) =>
            `<div class="content"><div class="top"><strong>${escape(p.name)}</strong><span class="chip provides">${escape(p.version)}</span></div><div class="file">${escape(p.file)}</div>${p.check ? `<div class="file check">${escape(`${t.check} ${p.check}`)}</div>` : ""}</div>`,
        )
        .join("")
    : `<p class="empty">${escape(t.noProvides)}</p>`;
  const followedBy = incoming.length
    ? `<ul class="people">${incoming
        .map(
          (a) =>
            `<li><a href="${at(lang, skillPath(a.from))}">${escape(a.from.name)}<span class="repo">${escape(`${a.from.owner}/${a.from.repo}`)}</span></a><span class="chip follows">${escape(label(a))}</span></li>`,
        )
        .join("")}</ul>`
    : `<p class="empty">${escape(t.noFollowers)}</p>`;
  const follows = outgoing.length
    ? `<ul class="people">${outgoing
        .flatMap((a) =>
          a.follows.map((f) => {
            const name = a.to
              ? `<a href="${at(lang, skillPath(a.to))}">${escape(f.ref)}<span class="repo">${escape(`${a.to.owner}/${a.to.repo}`)}</span></a>`
              : `<span>${escape(f.ref)}<span class="repo">${escape(t.notListed)}</span></span>`;
            return `<li>${name}<span class="chip follows">${escape(f.range)}</span></li>`;
          }),
        )
        .join("")}</ul>`
    : `<p class="empty">${escape(t.noFollows)}</p>`;
  const body = `<div class="wrap wide"><div class="skill">
<div>
<div class="crumb"><a href="${at(lang, "/skills/")}">${escape(t.navSkills)}</a>${icon("right", 14)}<span>${escape(skill.name)}</span></div>
<div class="title-row"><h1>${escape(skill.name)}</h1><span class="role ${role}">${escape(role === "provider" ? t.roleProvider : t.roleConsumer)}</span></div>
${skill.description ? `<p class="description">${escape(skill.description)}</p>` : ""}
${graph(lang, nodes, [...outgoing, ...incoming], skill)}
<p class="hint">${icon("pointer", 15)}${escape(t.graphHint)}</p>
</div>
<aside class="panel">
<section data-section="source"><h2>${escape(t.source)}</h2><a class="source" href="https://github.com/${skill.owner}/${skill.repo}">${icon("github", 15)}${escape(`${skill.owner}/${skill.repo}`)}</a><a class="source" href="${sourceUrl}">${icon("folder", 15)}${escape(skill.folder)}</a></section>
<section data-section="provides"><h2>${escape(t.provides)}<span>${skill.provides.length}</span></h2>${provides}</section>
<section data-section="followed-by"><h2>${escape(t.followedBy)}<span>${incoming.length}</span></h2>${followedBy}</section>
<section data-section="follows"><h2>${escape(t.follows)}<span>${skill.follows.length}</span></h2>${follows}</section>
</aside>
</div></div>`;
  const url = (s: Skill) => `${o.base}${at(lang, skillPath(s))}`;
  return {
    lang,
    path: skillPath(skill),
    title: `${fill(t.skillTitle, { name: skill.name, repo: `${skill.owner}/${skill.repo}` })} | musubi`,
    description: skill.description || fill(t.skillTitle, { name: skill.name, repo: `${skill.owner}/${skill.repo}` }),
    body,
    nav: "skills",
    ld: {
      "@type": "SoftwareSourceCode",
      "@id": url(skill),
      name: skill.name,
      description: skill.description,
      url: url(skill),
      codeRepository: `https://github.com/${skill.owner}/${skill.repo}`,
      inLanguage: lang,
      isBasedOn: outgoing.flatMap((a) => (a.to ? [{ "@id": url(a.to) }] : [])),
      hasPart: skill.provides.map((p) => ({ "@type": "CreativeWork", name: `${skill.name}/${p.name}`, version: p.version })),
    },
  };
}

function writePage(out: string, html: string, path: string) {
  const dir = join(out, path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), html);
}

async function main() {
  const o = options(process.argv.slice(2));
  const warnings: string[] = [];
  const warn = (message: string) => {
    warnings.push(message);
    process.stderr.write(`warning: ${message}\n`);
  };
  if (existsSync(o.out) && readdirSync(o.out).length > 0) {
    if (!existsSync(join(o.out, MARKER))) usage(`${o.out} holds files this command did not write; choose another --out`);
    rmSync(o.out, { recursive: true, force: true });
  }

  const skills: Skill[] = [];
  for (const entry of readRegistry(o.registry, warn)) {
    for (const folder of entry.skills) {
      const [text, skillMd] = await Promise.all([readFile(o, entry, folder, "musubi.json"), readFile(o, entry, folder, "SKILL.md")]);
      if (text === null) {
        warn(`${entry.file}: ${folder}: musubi.json was not found; left out`);
        continue;
      }
      const skill = readSkill(entry, folder, text, skillMd ?? "");
      if (typeof skill === "string") warn(`${entry.file}: ${folder}: ${skill}; left out`);
      else if (skills.some((s) => s.id === skill.id)) warn(`${entry.file}: ${folder}: another listed folder is also named ${skill.name}; left out`);
      else skills.push(skill);
    }
  }
  skills.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const arrows = links(skills);
  const lines = transcript();

  mkdirSync(join(o.out, "assets"), { recursive: true });
  writeFileSync(join(o.out, MARKER), "Written by node site/build.ts. The next build replaces this folder.\n");
  copyFileSync(join(root, "site", "site.css"), join(o.out, "assets", "site.css"));
  for (const file of readdirSync(join(root, "site", "assets"))) copyFileSync(join(root, "site", "assets", file), join(o.out, "assets", file));
  const paths: string[] = [];
  const pages = Math.max(1, Math.ceil(skills.length / PER_PAGE));
  for (const lang of LANGS) {
    const all: Page[] = [homePage(o, lang, skills, arrows, lines), specPage(o, lang)];
    for (let page = 1; page <= pages; page += 1) all.push(listPage(o, lang, skills, arrows, page, pages));
    for (const skill of skills) all.push(skillPage(o, lang, skill, arrows));
    for (const page of all) {
      writePage(o.out, layout(o, page), at(lang, page.path));
      paths.push(at(lang, page.path));
    }
  }
  writeFileSync(
    join(o.out, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map((p) => `<url><loc>${o.base}${p}</loc></url>`).join("\n")}\n</urlset>\n`,
  );
  writeFileSync(join(o.out, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${o.base}/sitemap.xml\n`);
  const llms = [
    "# musubi",
    "",
    `> ${TEXT.en.siteDescription}`,
    "",
    "## Definition",
    "",
    `- [The musubi definition](${o.base}/spec/): the normative English text, definition version ${latestDefinition}`,
    `- [musubiの定義](${o.base}/ja/spec/): the Japanese translation`,
    `- [Source and README](${repoUrl}): how to install the musubi command and list a skill`,
    "",
    "## Skills",
    "",
    ...skills.map((s) => {
      const parts = [
        s.provides.length ? `provides ${s.provides.map((p) => `${p.name} ${p.version}`).join(", ")}` : "",
        s.follows.length ? `follows ${s.follows.map((f) => `${f.ref} ${f.range}`).join(", ")}` : "",
      ].filter(Boolean);
      return `- [${s.name} (${s.owner}/${s.repo})](${o.base}${skillPath(s)}): ${[s.description, parts.join("; ")].filter(Boolean).join(" ")}`;
    }),
    "",
  ].join("\n");
  writeFileSync(join(o.out, "llms.txt"), llms);
  // GitHub Pages serves the site under the host named in CNAME, and .nojekyll has it serve the files
  // as they are instead of running them through Jekyll.
  writeFileSync(join(o.out, "CNAME"), `${new URL(o.base).host}\n`);
  writeFileSync(join(o.out, ".nojekyll"), "");
  process.stderr.write(`musubi site: wrote ${o.out} (pages=${paths.length}, skills=${skills.length}, warnings=${warnings.length})\n`);
}

await main();
