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
// Labels are drawn in a monospace face at this size, and each declares its width as textLength,
// so the room left for them does not depend on the font the viewer has.
const LABEL_SIZE = 11;
const LABEL_CHAR = LABEL_SIZE * 0.6;
const LABEL_INSET = 12;
const LABEL_RISE = 8;
const LABEL_STEP = 15;
const BEND_ROOM = 96;

const labelWidth = (label: string) => Math.ceil(label.length * LABEL_CHAR);

// Draws each node as a box and each edge as an arrow from the follower to the provider, as one SVG.
// A node's column is the length of the longest chain of nodes that follow it, so providers sit to the
// right of the skills that follow them and every arrow points right.
// Every arrow leaves its box in a straight line that runs past the longest label leaving that column,
// and only bends after it, so no line crosses a label. Labels of one box stack upward over its line.
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
  const drawn = edges.filter((e) => placed.has(e.from) && placed.has(e.to));
  // The straight run out of a column ends past the widest label that leaves any box in it.
  const run = new Map<number, number>();
  const stack = new Map<string, number>();
  for (const e of drawn) {
    const c = (placed.get(e.from) as { column: number }).column;
    run.set(c, Math.max(run.get(c) ?? 0, LABEL_INSET * 2 + labelWidth(e.label)));
    stack.set(e.from, (stack.get(e.from) ?? 0) + 1);
  }
  const gap = Math.max(GAP_X, ...[...run.values()].map((r) => r + BEND_ROOM));
  const stacked = Math.max(1, ...stack.values());
  // Room above the first row for the highest label of a box with many arrows.
  const head = PAD + Math.max(0, LABEL_RISE + LABEL_SIZE + (stacked - 1) * LABEL_STEP - (PAD + NODE_H / 2));

  const columns = Math.max(1, ...[...placed.values()].map((p) => p.column + 1));
  const maxRows = Math.max(1, ...rows.values());
  const width = PAD * 2 + columns * NODE_W + (columns - 1) * gap;
  const height = head + PAD + maxRows * NODE_H + (maxRows - 1) * GAP_Y;
  // Columns with fewer boxes are centred against the tallest column.
  const top = (c: number) => (height - head - PAD - ((rows.get(c) ?? 1) * NODE_H + ((rows.get(c) ?? 1) - 1) * GAP_Y)) / 2;
  const x = (p: { column: number }) => PAD + p.column * (NODE_W + gap);
  const y = (p: { column: number; row: number }) => head + top(p.column) + p.row * (NODE_H + GAP_Y);

  const seen = new Map<string, number>();
  const edgeSvg = drawn
    .map((e) => {
      const a = placed.get(e.from) as { column: number; row: number };
      const b = placed.get(e.to) as { column: number; row: number };
      const x1 = x(a) + NODE_W;
      const y1 = y(a) + NODE_H / 2;
      const xs = x1 + (run.get(a.column) as number);
      const x2 = x(b) - 6;
      const y2 = y(b) + NODE_H / 2;
      const bend = (x2 - xs) / 2;
      const k = seen.get(e.from) ?? 0;
      seen.set(e.from, k + 1);
      return [
        `<g class="edge" data-edge="${attribute(e.key)}">`,
        `<path d="M${x1},${y1} H${xs} C${xs + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}" marker-end="url(#arrow)"/>`,
        `<text class="label" x="${x1 + LABEL_INSET}" y="${y1 - LABEL_RISE - k * LABEL_STEP}" font-size="${LABEL_SIZE}" textLength="${labelWidth(e.label)}" lengthAdjust="spacingAndGlyphs">${escape(e.label)}</text>`,
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
.edge text { fill: var(--muted); font: 11px ui-monospace, "JetBrains Mono", Menlo, monospace; }
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
