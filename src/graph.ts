import { writeFileSync } from "node:fs";
import { load } from "./check.ts";
import { Report } from "./report.ts";
import { format } from "./semver.ts";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inside a quoted attribute only "&", "<", and the quote need escaping, so edges keep their "->".
const attribute = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

type Node = { name: string; column: number; row: number; provides: string[] };
type Edge = { from: string; to: string; ref: string; range: string };

const NODE_W = 220;
const NODE_H = 64;
const GAP_X = 120;
const GAP_Y = 28;
const PAD = 24;

// Writes one self-contained HTML page that draws each skill as a box and each followed content as
// an arrow from the consumer to the provider. Providers sit to the right of the skills that follow them.
export function graph(roots: string[], out: string, cwd: string): number {
  const report = new Report(cwd);
  const { declarations } = load(roots, report);
  const edges: Edge[] = [];
  for (const declaration of declarations.values()) {
    for (const follow of declaration.follows) {
      edges.push({ from: declaration.skill.name, to: follow.skill, ref: follow.ref, range: follow.range?.text ?? "?" });
    }
  }
  const names = new Set<string>([...declarations.keys(), ...edges.map((e) => e.to)]);
  // A skill's column is the length of the longest chain of skills that follow it, so arrows point right.
  const depth = new Map<string, number>();
  const column = (name: string, seen: Set<string>): number => {
    if (depth.has(name)) return depth.get(name) as number;
    if (seen.has(name)) return 0;
    seen.add(name);
    const followers = edges.filter((e) => e.to === name).map((e) => column(e.from, seen) + 1);
    const value = followers.length > 0 ? Math.max(...followers) : 0;
    depth.set(name, value);
    return value;
  };
  const nodes = new Map<string, Node>();
  const rows = new Map<number, number>();
  for (const name of [...names].sort()) {
    const c = column(name, new Set());
    const row = rows.get(c) ?? 0;
    rows.set(c, row + 1);
    const provides = [...(declarations.get(name)?.provides.values() ?? [])].map(
      (p) => `${p.name} ${p.version ? format(p.version) : "?"}`,
    );
    nodes.set(name, { name, column: c, row, provides });
  }
  const columns = Math.max(1, ...[...nodes.values()].map((n) => n.column + 1));
  const maxRows = Math.max(1, ...rows.values());
  const width = PAD * 2 + columns * NODE_W + (columns - 1) * GAP_X;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
  const x = (n: Node) => PAD + n.column * (NODE_W + GAP_X);
  const y = (n: Node) => PAD + n.row * (NODE_H + GAP_Y);

  const edgeSvg = edges
    .map((e) => {
      const a = nodes.get(e.from) as Node;
      const b = nodes.get(e.to) as Node;
      const x1 = x(a) + NODE_W;
      const y1 = y(a) + NODE_H / 2;
      const x2 = x(b);
      const y2 = y(b) + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      const label = `${e.ref.split("/")[1]} ${e.range}`;
      return [
        `<g class="edge" data-edge="${attribute(`${e.from} -> ${e.ref}`)}">`,
        `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 6},${y2}" marker-end="url(#arrow)"/>`,
        `<text x="${mid}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle">${escape(label)}</text>`,
        "</g>",
      ].join("");
    })
    .join("\n");
  const nodeSvg = [...nodes.values()]
    .map((n) => {
      const detail = n.provides.length > 0 ? `provides ${n.provides.join(", ")}` : declarations.has(n.name) ? "follows only" : "not installed";
      return [
        `<g class="node${declarations.has(n.name) ? "" : " missing"}" data-skill="${attribute(n.name)}">`,
        `<rect x="${x(n)}" y="${y(n)}" width="${NODE_W}" height="${NODE_H}" rx="10"/>`,
        `<text class="name" x="${x(n) + 14}" y="${y(n) + 26}">${escape(n.name)}</text>`,
        `<text class="detail" x="${x(n) + 14}" y="${y(n) + 46}">${escape(detail)}</text>`,
        "</g>",
      ].join("");
    })
    .join("\n");
  const rowsHtml = edges
    .map((e) => `<tr><td>${escape(e.from)}</td><td>${escape(e.ref)}</td><td>${escape(e.range)}</td></tr>`)
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skill dependencies</title>
<style>
:root { --bg: #f7f7f5; --fg: #1d1d1b; --muted: #5f5f5a; --box: #ffffff; --line: #8a8a84; --accent: #2f6f5e; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --fg: #ecece8; --muted: #a3a39c; --box: #22221f; --line: #77776f; --accent: #6fbfa6; } }
body { margin: 0; padding: 24px 16px; background: var(--bg); color: var(--fg); font: 15px/1.5 system-ui, sans-serif; }
h1 { font-size: 20px; margin: 0 0 4px; }
p { margin: 0 0 16px; color: var(--muted); }
.canvas { overflow-x: auto; }
svg text { fill: var(--fg); font: 13px system-ui, sans-serif; }
.node rect { fill: var(--box); stroke: var(--accent); stroke-width: 1.5; }
.node.missing rect { stroke: #c0503a; stroke-dasharray: 5 4; }
.node .name { font-weight: 600; font-size: 14px; }
.node .detail { fill: var(--muted); font-size: 12px; }
.edge path { fill: none; stroke: var(--line); stroke-width: 1.5; }
.edge text { fill: var(--muted); font-size: 12px; }
#arrow path { fill: var(--line); }
table { border-collapse: collapse; margin-top: 20px; }
th, td { text-align: left; padding: 6px 14px 6px 0; border-bottom: 1px solid var(--line); }
</style>
</head>
<body>
<h1>Skill dependencies</h1>
<p>Each arrow runs from a skill to the content it follows. ${nodes.size} skills, ${edges.length} followed contents.</p>
<div class="canvas">
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Skill dependency graph">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
${edgeSvg}
${nodeSvg}
</svg>
</div>
<table>
<thead><tr><th>Skill</th><th>Follows</th><th>Range</th></tr></thead>
<tbody>
${rowsHtml}
</tbody>
</table>
</body>
</html>
`;
  writeFileSync(out, html);
  report.print();
  process.stderr.write(`musubi graph: wrote ${report.where(out)} (skills=${nodes.size}, follows=${edges.length})\n`);
  return 0;
}
