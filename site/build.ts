#!/usr/bin/env node
// Builds the musubi site into one folder of static pages:
//   node site/build.ts [--registry <folder>] [--source <folder>] [--out <folder>] [--base-url <url>]
// It reads the definition from spec/ and the registry from registry/<owner>/<repo>.json, takes each
// listed skill's musubi.json and SKILL.md from GitHub (or from --source/<owner>/<repo>/<folder>), and
// writes the English pages at / and the Japanese pages at /ja/, with sitemap.xml, robots.txt, and llms.txt.
// A listed folder whose musubi.json cannot be read is named on stderr and left out of the site.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, posix, resolve } from "node:path";
import { latestDefinition } from "../src/definition.ts";
import { type GraphEdge, type GraphNode, graphSvg } from "../src/graph.ts";
import { escape, render } from "./markdown.ts";
import { fill, type Key, type Lang, TEXT } from "./text.ts";

const root = resolve(import.meta.dirname, "..");
const DEFAULT_BASE = "https://musubi-skills.pages.dev";
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
  pointer:
    '<path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/>',
};
const icon = (name: string, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;

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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Space+Grotesk:wght@400;500;600;700&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<script>try{var m=localStorage.getItem("musubi-theme");if(m==="light"||m==="dark")document.documentElement.dataset.theme=m}catch(e){}</script>
<script type="application/ld+json">${json({ "@context": "https://schema.org", ...page.ld })}</script>
</head>
<body>
<header class="header"><div class="wrap">
<div class="left">
<a class="brand" href="${at(page.lang, "/")}">${icon("link", 22)}musubi</a>
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
document.querySelectorAll("[data-copy]").forEach(function(b){b.addEventListener("click",function(){if(navigator.clipboard)navigator.clipboard.writeText(b.getAttribute("data-copy"))})});
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

function homePage(o: Options, lang: Lang, skills: Skill[], arrows: Link[], example: { file: string; text: string }): Page {
  const t = TEXT[lang];
  const repos = new Set(skills.map((s) => `${s.owner}/${s.repo}`)).size;
  const follows = arrows.reduce((n, a) => n + a.follows.length, 0);
  const body = `<div class="wrap">
<section class="hero">
<div>
<p class="eyebrow">${escape(t.eyebrow)}</p>
<h1>${escape(t.heroTitle)}</h1>
<p class="lead">${escape(t.heroLead)}</p>
<div class="actions"><a class="button primary" href="${at(lang, "/spec/")}">${escape(t.readDefinition)}${icon("arrow")}</a><a class="button secondary" href="${at(lang, "/skills/")}">${escape(t.browseSkills)}</a></div>
<div class="install"><span class="muted">$</span><span>npm install -g musubi-cli</span><button class="button-copy" type="button" data-copy="npm install -g musubi-cli" aria-label="${escape(t.copy)}">${icon("copy", 15)}</button></div>
</div>
<div class="example"><header><span class="file">${escape(example.file)}</span><span class="kind">follows</span></header><pre><code>${escape(example.text.trim())}</code></pre></div>
</section>
${
  skills.length > 0
    ? `<section class="registered">
${graph(lang, skills, arrows.filter((a) => a.to))}
<div>
<p class="eyebrow">${escape(t.registeredEyebrow)}</p>
<h2>${escape(t.registeredHeading)}</h2>
<p>${escape(t.registeredBody)}</p>
<div class="stats"><div><strong>${skills.length}</strong><span>${escape(t.statSkills)}</span></div><div><strong>${repos}</strong><span>${escape(t.statRepositories)}</span></div><div><strong>${follows}</strong><span>${escape(t.statFollows)}</span></div></div>
<a class="more" href="${at(lang, "/skills/")}">${escape(t.seeAll)}${icon("arrow")}</a>
</div>
</section>`
    : ""
}
<section class="list-yours"><div><h2>${escape(t.listYours)}</h2><p>${escape(t.listYoursBody)}</p></div><a class="button secondary" href="${repoUrl}/blob/HEAD/${t.readme}${t.howToRegisterAnchor}">${icon("pull")}${escape(t.howToRegister)}</a></section>
</div>`;
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
  const consumer = skills.find((s) => s.follows.length > 0);
  const example = consumer
    ? { file: `${consumer.name}/musubi.json`, text: consumer.text }
    : { file: "api-design/musubi.json", text: readFileSync(join(root, "examples", "skills", "api-design", "musubi.json"), "utf8") };

  mkdirSync(join(o.out, "assets"), { recursive: true });
  writeFileSync(join(o.out, MARKER), "Written by node site/build.ts. The next build replaces this folder.\n");
  copyFileSync(join(root, "site", "site.css"), join(o.out, "assets", "site.css"));
  const paths: string[] = [];
  const pages = Math.max(1, Math.ceil(skills.length / PER_PAGE));
  for (const lang of LANGS) {
    const all: Page[] = [homePage(o, lang, skills, arrows, example), specPage(o, lang)];
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
  process.stderr.write(`musubi site: wrote ${o.out} (pages=${paths.length}, skills=${skills.length}, warnings=${warnings.length})\n`);
}

await main();
