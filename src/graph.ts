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
// A line leaves its box from a small round port and ends in a ">" head just left of the box it points to.
const PORT_R = 3.5;
const HEAD_GAP = 3;
const HEAD_LEN = 7;
const HEAD_HALF = 5.5;
// Lines into one box arrive this far apart, kept this far inside the box's top and bottom.
const ENTRY_GAP = 12;
const ENTRY_MARGIN = 10;
// The light runs along each line once a loop. Its trail is three strokes, measured in hundredths of
// the line, so every line takes the same time from end to end. The light travels for TRAVEL of the
// loop, reaches the head at ARRIVE, and the head lights up as it arrives.
const LOOP = "2.4s";
const TAILS: Array<[number, number, number]> = [
  [26, 5, 0.14],
  [15, 3, 0.4],
  [6, 2.2, 0.95],
];
const TRAVEL = 0.8;
const REACH = 100 + TAILS[0][0];
const ARRIVE = (TRAVEL * 100) / REACH;

const labelWidth = (label: string) => Math.ceil(label.length * LABEL_CHAR);
const num = (value: number) => String(Math.round(value * 100) / 100);
const times = (...values: number[]) => values.map((v) => String(Math.round(v * 1000) / 1000)).join(";");

// Ids of the lines, so the light can follow them. The prefix comes from the edges, so two graphs on
// one page do not share ids and the same graph always gets the same ids.
function idPrefix(edges: GraphEdge[]): string {
  let hash = 0x811c9dc5;
  for (const char of edges.map((e) => e.key).join("\n")) {
    hash ^= char.codePointAt(0) as number;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `musubi-${hash.toString(36)}`;
}

// The line, its moving light, its head, and its port. The line comes first, so readers of the SVG
// that take an edge's first path get the line.
function edgeLight(id: string, d: string, start: [number, number], tip: [number, number]): string {
  const loop = `dur="${LOOP}" repeatCount="indefinite"`;
  const tails = TAILS.map(
    ([length, width, opacity]) =>
      `<path class="tail" d="${d}" pathLength="100" stroke-width="${width}" opacity="${opacity}" stroke-dasharray="${length} 300">` +
      `<animate attributeName="stroke-dashoffset" values="${length};${length - REACH};${length - REACH}" keyTimes="${times(0, TRAVEL, 1)}" ${loop}/></path>`,
  ).join("");
  const [tx, ty] = tip;
  const head = `M${num(tx - HEAD_LEN)},${num(ty - HEAD_HALF)} L${num(tx)},${num(ty)} L${num(tx - HEAD_LEN)},${num(ty + HEAD_HALF)}`;
  const flash = `<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="${times(0, ARRIVE - 0.035, ARRIVE + 0.015, ARRIVE + 0.225, 1)}" ${loop}/>`;
  return [
    `<path class="line" id="${id}" d="${d}"/>`,
    tails,
    `<path class="chevron" d="${head}"/>`,
    `<path class="chevron flash" d="${head}">${flash}</path>`,
    `<circle class="dot" r="3"><animateMotion ${loop} calcMode="linear" keyPoints="0;1;1" keyTimes="${times(0, ARRIVE, 1)}"><mpath href="#${id}"/></animateMotion>`,
    `<animate attributeName="opacity" values="1;1;0;0" keyTimes="${times(0, ARRIVE, ARRIVE + 0.025, 1)}" ${loop}/></circle>`,
    `<circle class="port" cx="${num(start[0])}" cy="${num(start[1])}" r="${PORT_R}"/>`,
  ].join("");
}

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

  // Lines into one box arrive at different heights, in the order of the boxes they come from, so their
  // heads do not sit on one point and the lines do not cross on the way in.
  const middle = (id: string) => y(placed.get(id) as { column: number; row: number }) + NODE_H / 2;
  const entry = new Map<GraphEdge, number>();
  for (const to of new Set(drawn.map((e) => e.to))) {
    const into = drawn.filter((e) => e.to === to).sort((a, b) => middle(a.from) - middle(b.from) || drawn.indexOf(a) - drawn.indexOf(b));
    const step = into.length > 1 ? Math.min(ENTRY_GAP, (NODE_H - 2 * ENTRY_MARGIN) / (into.length - 1)) : 0;
    into.forEach((e, i) => entry.set(e, (i - (into.length - 1) / 2) * step));
  }

  const prefix = idPrefix(drawn);
  const seen = new Map<string, number>();
  const edgeSvg = drawn
    .map((e, i) => {
      const a = placed.get(e.from) as { column: number; row: number };
      const b = placed.get(e.to) as { column: number; row: number };
      const x1 = x(a) + NODE_W;
      const y1 = y(a) + NODE_H / 2;
      const sx = x1 + PORT_R;
      const xs = x1 + (run.get(a.column) as number);
      const tip = x(b) - HEAD_GAP;
      const x2 = tip - 0.5;
      const y2 = y(b) + NODE_H / 2 + (entry.get(e) as number);
      const k = seen.get(e.from) ?? 0;
      seen.set(e.from, k + 1);
      const straight = Math.abs(y1 - y2) < 0.01;
      // A box's only line, when it does not bend, carries its label over its middle. Every other label
      // sits over the straight run its box's lines share, before any of them bends.
      const alone = straight && (stack.get(e.from) as number) === 1;
      const mid = (xs + x2) / 2;
      const d = alone
        ? `M${num(sx)},${num(y1)} H${num(x2)}`
        : straight
          ? `M${num(sx)},${num(y1)} H${num(xs)} H${num(x2)}`
          : `M${num(sx)},${num(y1)} H${num(xs)} C${num(mid)},${num(y1)} ${num(mid)},${num(y2)} ${num(x2)},${num(y2)}`;
      const centre = alone ? (sx + x2) / 2 : (sx + xs) / 2;
      const labelW = labelWidth(e.label);
      return [
        `<g class="edge" data-edge="${attribute(e.key)}">`,
        edgeLight(`${prefix}-${i}`, d, [x1, y1], [tip, y2]),
        `<text class="label" x="${num(centre - labelW / 2)}" y="${num(y1 - LABEL_RISE - k * LABEL_STEP)}" font-size="${LABEL_SIZE}" textLength="${labelW}" lengthAdjust="spacingAndGlyphs">${escape(e.label)}</text>`,
        "</g>",
      ].join("");
    })
    .join("\n");
  const nodeSvg = [...placed.values()]
    .map((p) => {
      const n = p.node;
      const classes = ["node", n.missing ? "missing" : "", n.current ? "current" : ""].filter(Boolean).join(" ");
      const cx = num(x(p) + NODE_W / 2);
      const box = [
        `<rect x="${x(p)}" y="${y(p)}" width="${NODE_W}" height="${NODE_H}" rx="10"/>`,
        `<text class="name" x="${cx}" y="${num(y(p) + 22)}" text-anchor="middle" dominant-baseline="central">${escape(n.name)}</text>`,
        `<text class="detail" x="${cx}" y="${num(y(p) + 43)}" text-anchor="middle" dominant-baseline="central">${escape(n.detail)}</text>`,
      ].join("");
      const inner = n.href ? `<a href="${attribute(n.href)}">${box}</a>` : box;
      return `<g class="${classes}" data-skill="${attribute(n.id)}">${inner}</g>`;
    })
    .join("\n");
  // Lines come after the boxes, so the half of each port that sits over a box's edge stays visible.
  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Skill dependency graph">
${nodeSvg}
${edgeSvg}
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
.edge .line { fill: none; stroke: var(--line); stroke-width: 1.5; stroke-linecap: round; }
.edge .tail { fill: none; stroke: var(--accent); stroke-linecap: round; }
.edge .dot { fill: var(--accent); filter: drop-shadow(0 0 2px var(--accent)) drop-shadow(0 0 5px var(--accent)); }
.edge .chevron { fill: none; stroke: var(--line); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.edge .chevron.flash { stroke: var(--accent); opacity: 0; filter: drop-shadow(0 0 4px var(--accent)); }
.edge .port { fill: var(--bg); stroke: var(--line); stroke-width: 1.5; }
.edge text { fill: var(--muted); font: 11px ui-monospace, "JetBrains Mono", Menlo, monospace; }
@media (prefers-reduced-motion: reduce) { .edge .tail, .edge .dot, .edge .flash { display: none; } }
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
