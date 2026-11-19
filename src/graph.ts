import { writeFileSync } from "node:fs";
import { load } from "./check.ts";
import { Report } from "./report.ts";
import { format } from "./semver.ts";

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inside a quoted attribute only "&", "<", and the quote need escaping, so edges keep their "->".
const attribute = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// A box in the graph. `id` tells boxes apart; `name` and `detail` are the two lines drawn in it.
export type GraphNode = { id: string; name: string; detail: string; missing?: boolean; current?: boolean; href?: string };
// An arrow from the skill that follows to the skill that provides. `key` goes into data-edge.
export type GraphEdge = { from: string; to: string; label: string; key: string };

const NODE_W = 232;
const NODE_H = 64;
const GAP_X = 160;
const GAP_Y = 26;
const PAD = 24;

// Draws each node as a box and each edge as an arrow from the follower to the provider, as one SVG.
// A node's column is the length of the longest chain of nodes that follow it, so providers sit to the
// right of the skills that follow them and every arrow points right.
export function graphSvg(nodes: GraphNode[], edges: GraphEdge[]): { svg: string; width: number; height: number } {
  const depth = new Map<string, number>();
  const column = (id: string, seen: Set<string>): number => {
    if (depth.has(id)) return depth.get(id) as number;
    if (seen.has(id)) return 0;
    seen.add(id);
    const followers = edges.filter((e) => e.to === id).map((e) => column(e.from, seen) + 1);
    const value = followers.length > 0 ? Math.max(...followers) : 0;
    depth.set(id, value);
    return value;
  };
  const placed = new Map<string, { node: GraphNode; column: number; row: number }>();
  const rows = new Map<number, number>();
  for (const node of nodes) {
    const c = column(node.id, new Set());
    const row = rows.get(c) ?? 0;
    rows.set(c, row + 1);
    placed.set(node.id, { node, column: c, row });
  }
  const columns = Math.max(1, ...[...placed.values()].map((p) => p.column + 1));
  const maxRows = Math.max(1, ...rows.values());
  const width = PAD * 2 + columns * NODE_W + (columns - 1) * GAP_X;
  const height = PAD * 2 + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
  // Columns with fewer boxes are centred against the tallest column.
  const top = (c: number) => (height - PAD * 2 - ((rows.get(c) ?? 1) * NODE_H + ((rows.get(c) ?? 1) - 1) * GAP_Y)) / 2;
  const x = (p: { column: number }) => PAD + p.column * (NODE_W + GAP_X);
  const y = (p: { column: number; row: number }) => PAD + top(p.column) + p.row * (NODE_H + GAP_Y);

  const edgeSvg = edges
    .filter((e) => placed.has(e.from) && placed.has(e.to))
    .map((e) => {
      const a = placed.get(e.from) as { column: number; row: number };
      const b = placed.get(e.to) as { column: number; row: number };
      const x1 = x(a) + NODE_W;
      const y1 = y(a) + NODE_H / 2;
      const x2 = x(b);
      const y2 = y(b) + NODE_H / 2;
      const mid = (x1 + x2) / 2;
      return [
        `<g class="edge" data-edge="${attribute(e.key)}">`,
        `<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2 - 6},${y2}" marker-end="url(#arrow)"/>`,
        `<text x="${x1 + 12}" y="${y1 - 8}">${escape(e.label)}</text>`,
        "</g>",
      ].join("");
    })
    .join("\n");
  const nodeSvg = [...placed.values()]
    .map((p) => {
      const n = p.node;
      const classes = ["node", n.missing ? "missing" : "", n.current ? "current" : ""].filter(Boolean).join(" ");
      const box = [
        `<rect x="${x(p)}" y="${y(p)}" width="${NODE_W}" height="${NODE_H}" rx="10"/>`,
        `<text class="name" x="${x(p) + 14}" y="${y(p) + 26}">${escape(n.name)}</text>`,
        `<text class="detail" x="${x(p) + 14}" y="${y(p) + 46}">${escape(n.detail)}</text>`,
      ].join("");
      const inner = n.href ? `<a href="${attribute(n.href)}">${box}</a>` : box;
      return `<g class="${classes}" data-skill="${attribute(n.id)}">${inner}</g>`;
    })
    .join("\n");
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Skill dependency graph">
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>
${edgeSvg}
${nodeSvg}
</svg>`;
  return { svg, width, height };
}

// Writes one self-contained HTML page that draws each skill as a box and each followed content as
// an arrow from the consumer to the provider. Providers sit to the right of the skills that follow them.
export function graph(roots: string[], out: string, cwd: string): number {
  const report = new Report(cwd);
  const { declarations } = load(roots, report);
  const edges: GraphEdge[] = [];
  const follows: Array<{ from: string; ref: string; range: string }> = [];
  for (const declaration of declarations.values()) {
    for (const follow of declaration.follows) {
      const range = follow.range?.text ?? "?";
      follows.push({ from: declaration.skill.name, ref: follow.ref, range });
      edges.push({
        from: declaration.skill.name,
        to: follow.skill,
        label: `${follow.content} ${range}`,
        key: `${declaration.skill.name} -> ${follow.ref}`,
      });
    }
  }
  const names = [...new Set<string>([...declarations.keys(), ...edges.map((e) => e.to)])].sort();
  const nodes: GraphNode[] = names.map((name) => {
    const provides = [...(declarations.get(name)?.provides.values() ?? [])].map(
      (p) => `${p.name} ${p.version ? format(p.version) : "?"}`,
    );
    const detail = provides.length > 0 ? `provides ${provides.join(", ")}` : declarations.has(name) ? "follows only" : "not installed";
    return { id: name, name, detail, missing: !declarations.has(name) };
  });
  const { svg } = graphSvg(nodes, edges);
  const rowsHtml = follows
    .map((f) => `<tr><td>${escape(f.from)}</td><td>${escape(f.ref)}</td><td>${escape(f.range)}</td></tr>`)
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
<p>Each arrow runs from a skill to the content it follows. ${nodes.length} skills, ${follows.length} followed contents.</p>
<div class="canvas">
${svg}
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
  process.stderr.write(`musubi graph: wrote ${report.where(out)} (skills=${nodes.length}, follows=${follows.length})\n`);
  return 0;
}
