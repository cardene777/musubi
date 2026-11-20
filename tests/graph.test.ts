import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { type GraphEdge, type GraphNode, graphSvg } from "../src/graph.ts";
import { root, run, tree } from "./helpers.ts";

test("graph-writes-the-skills-and-edges", () => {
  const out = join(tree({}), "graph.html");
  const r = run(["graph", "examples/skills", "--out", out], { cwd: root });
  assert.equal(r.code, 0, r.stderr);
  assert.ok(existsSync(out), "graph.html was not written");
  const html = readFileSync(out, "utf8");
  assert.match(html, /design-doc/);
  assert.match(html, /api-design/);
  assert.match(html, /data-edge="api-design -> design-doc\/design"/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});

type Box = { left: number; top: number; right: number; bottom: number };
type Point = [number, number];
type Edge = { key: string; points: Point[]; start: Point; straightTo: number | null; label: Box };

const node = (name: string): GraphNode => ({ id: name, name, detail: "follows 2 contents" });
const edge = (from: string, to: string, label: string): GraphEdge => ({ from, to, label, key: `${from} -> ${to} ${label}` });

// Five skills that follow one provider, the shape the screenshot showed with labels under lines.
const fanIn = () => {
  const followers = ["contract-design", "dapp-architecture", "financial-standards", "multichain-design", "wallet-design"];
  return graphSvg(
    [...followers, "design-doc"].map(node),
    followers.map((f) => edge(f, "design-doc", "design, verify ^1.0.0")),
  ).svg;
};

// One skill that follows two contents of one provider and one content of another.
const fanOut = () =>
  graphSvg(
    ["api-design", "design-doc", "schema-kit"].map(node),
    [
      edge("api-design", "design-doc", "design ^1.0.0"),
      edge("api-design", "design-doc", "verify ^1.0.0"),
      edge("api-design", "schema-kit", "schema ^2.1.0"),
    ],
  ).svg;

const attr = (tag: string, name: string) => {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
};

// Points along a path made of M, H, V, L, and C commands with absolute coordinates.
function trace(d: string): { points: Point[]; start: Point; straightTo: number | null } {
  const tokens = d.match(/[MHVLC]|-?\d+(?:\.\d+)?/g) ?? [];
  const points: Point[] = [];
  let at: Point = [0, 0];
  let start: Point | null = null;
  let straightTo: number | null = null;
  let i = 0;
  let commands = 0;
  const num = () => Number(tokens[i++]);
  const line = (to: Point) => {
    for (let s = 0; s <= 40; s++) points.push([at[0] + ((to[0] - at[0]) * s) / 40, at[1] + ((to[1] - at[1]) * s) / 40]);
    at = to;
  };
  while (i < tokens.length) {
    const command = tokens[i++];
    commands++;
    if (command === "M") {
      at = [num(), num()];
      start ??= at;
      points.push(at);
    } else if (command === "H" || command === "V" || command === "L") {
      const to: Point = command === "H" ? [num(), at[1]] : command === "V" ? [at[0], num()] : [num(), num()];
      if (commands === 2 && to[1] === at[1]) straightTo = to[0];
      line(to);
    } else if (command === "C") {
      const [c1, c2, end]: Point[] = [
        [num(), num()],
        [num(), num()],
        [num(), num()],
      ];
      for (let s = 0; s <= 200; s++) {
        const t = s / 200;
        const u = 1 - t;
        points.push([
          u ** 3 * at[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * end[0],
          u ** 3 * at[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * end[1],
        ]);
      }
      at = end;
    } else {
      assert.fail(`unexpected path command ${command} in ${d}`);
    }
  }
  assert.ok(start, `the path ${d} has no start`);
  return { points, start, straightTo };
}

// Each edge with its path and the box its label covers. The label's width is the textLength the
// graph declares, so the box does not depend on the font the browser picks.
function edges(svg: string): Edge[] {
  const found: Edge[] = [];
  for (const match of svg.matchAll(/<g class="edge" data-edge="([^"]*)">([\s\S]*?)<\/g>/g)) {
    const path = /<path [^>]*\bd="([^"]+)"/.exec(match[2]);
    const text = /<text\b[^>]*>/.exec(match[2]);
    assert.ok(path, `edge ${match[1]} has no path`);
    assert.ok(text, `edge ${match[1]} has no label`);
    const width = attr(text[0], "textLength");
    const size = attr(text[0], "font-size");
    assert.ok(width && size, `the label of ${match[1]} does not declare its textLength and font-size`);
    const x = Number(attr(text[0], "x"));
    const y = Number(attr(text[0], "y"));
    const label = { left: x, top: y - Number(size), right: x + Number(width), bottom: y + Number(size) * 0.3 };
    found.push({ key: match[1], ...trace(path[1]), label });
  }
  assert.ok(found.length > 0, "the graph has no edges");
  return found;
}

const inside = ([x, y]: Point, b: Box) => x > b.left && x < b.right && y > b.top && y < b.bottom;
const overlap = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

test("graph-labels-stay-clear-of-every-line", () => {
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
  ]) {
    const all = edges(svg);
    for (const a of all) {
      for (const b of all) {
        const hit = b.points.find((p) => inside(p, a.label));
        assert.equal(hit, undefined, `${name}: the line of ${b.key} runs through the label of ${a.key} at ${hit}`);
        if (a !== b) assert.ok(!overlap(a.label, b.label), `${name}: the labels of ${a.key} and ${b.key} overlap`);
      }
    }
  }
});

// The boxes of a graph by skill id, read from each node group's rect.
function boxes(svg: string): Map<string, Box & { texts: string[] }> {
  const found = new Map<string, Box & { texts: string[] }>();
  for (const match of svg.matchAll(/<g class="node[^"]*" data-skill="([^"]*)">([\s\S]*?)<\/g>/g)) {
    const rect = /<rect\b[^>]*>/.exec(match[2]);
    assert.ok(rect, `node ${match[1]} has no rect`);
    const left = Number(attr(rect[0], "x"));
    const top = Number(attr(rect[0], "y"));
    const right = left + Number(attr(rect[0], "width"));
    const bottom = top + Number(attr(rect[0], "height"));
    found.set(match[1], { left, top, right, bottom, texts: [...match[2].matchAll(/<text\b[^>]*>/g)].map((t) => t[0]) });
  }
  assert.ok(found.size > 0, "the graph has no boxes");
  return found;
}

// The groups of each edge, for the elements that draw the light and the head.
const edgeGroups = (svg: string) => [...svg.matchAll(/<g class="edge" data-edge="([^"]*)">([\s\S]*?)<\/g>/g)];
const end = (e: Edge) => e.points[e.points.length - 1];
const near = (a: number, b: number) => Math.abs(a - b) <= 1;

test("graph-centers-the-text-in-each-box", () => {
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
  ]) {
    for (const [id, box] of boxes(svg)) {
      assert.equal(box.texts.length, 2, `${name}: ${id} does not draw a name and a detail`);
      for (const text of box.texts) {
        assert.equal(attr(text, "text-anchor"), "middle", `${name}: a text of ${id} is not anchored at its middle: ${text}`);
        assert.ok(near(Number(attr(text, "x")), (box.left + box.right) / 2), `${name}: a text of ${id} is not at the middle of its box: ${text}`);
      }
    }
  }
});

test("graph-centers-a-label-over-a-straight-line", () => {
  const svg = graphSvg(["contract-design", "design-doc"].map(node), [edge("contract-design", "design-doc", "design, verify ^1.0.0")]).svg;
  const [e] = edges(svg);
  const from = boxes(svg).get("contract-design") as Box;
  const to = boxes(svg).get("design-doc") as Box;
  assert.ok(e.points.every((p) => p[1] === e.start[1]), `the line ${e.key} is not straight`);
  assert.equal(e.straightTo, end(e)[0], `the line ${e.key} does not run straight to its end`);
  assert.ok(end(e)[0] > from.right && end(e)[0] <= to.left, `the line ${e.key} does not end at the box it points to`);
  const centre = (e.label.left + e.label.right) / 2;
  assert.ok(near(centre, (e.start[0] + end(e)[0]) / 2), `the label of ${e.key} is centred at ${centre}, not over its line`);
});

test("graph-centers-labels-on-the-straight-run", () => {
  // Two skills follow one provider with labels of different widths, so each label is centred on its own.
  const twoFollowers = graphSvg(
    ["api-design", "contract-design", "design-doc"].map(node),
    [edge("api-design", "design-doc", "design ^1.0.0"), edge("contract-design", "design-doc", "design, verify ^1.0.0")],
  ).svg;
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
    ["two skills follow one with labels of different widths", twoFollowers],
  ]) {
    for (const e of edges(svg)) {
      const centre = (e.label.left + e.label.right) / 2;
      const run = (e.start[0] + (e.straightTo as number)) / 2;
      assert.ok(near(centre, run), `${name}: the label of ${e.key} is centred at ${centre}, not at ${run} over its straight run`);
    }
  }
});

test("graph-spreads-arrows-into-one-box", () => {
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
  ]) {
    const all = edges(svg);
    for (const box of boxes(svg).values()) {
      const ends = all.map(end).filter((p) => p[0] <= box.left && p[0] > box.left - 10 && p[1] > box.top && p[1] < box.bottom);
      const ys = ends.map((p) => p[1]).sort((a, b) => a - b);
      for (let i = 1; i < ys.length; i++) {
        assert.ok(ys[i] - ys[i - 1] >= 8, `${name}: two lines enter a box ${ys[i] - ys[i - 1]}px apart, at ${ys[i - 1]} and ${ys[i]}`);
      }
    }
  }
});

test("graph-edges-carry-the-flowing-light", () => {
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
  ]) {
    assert.doesNotMatch(svg, /marker-end=/, `${name}: the graph still draws its heads as markers`);
    const all = edges(svg);
    const ids = new Set<string>();
    const sources = boxes(svg);
    for (const [index, group] of edgeGroups(svg).entries()) {
      const key = group[1];
      const body = group[2];
      const e = all[index];
      const line = /<path class="line" id="([^"]+)"/.exec(body);
      assert.ok(line, `${name}: ${key} has no line with an id`);
      assert.ok(!ids.has(line[1]), `${name}: the id ${line[1]} is used twice`);
      ids.add(line[1]);
      assert.match(body, new RegExp(`<circle class="dot"[^>]*>[\\s\\S]*?<animateMotion\\b[\\s\\S]*?<mpath href="#${line[1]}"`), `${name}: ${key} has no light that follows its line`);
      assert.match(body, /<path class="tail"[^>]*>\s*<animate attributeName="stroke-dashoffset"/, `${name}: ${key} has no trail that moves along its line`);
      const head = /<path class="chevron" d="M(-?[\d.]+),(-?[\d.]+) L(-?[\d.]+),(-?[\d.]+) L(-?[\d.]+),(-?[\d.]+)"/.exec(body);
      assert.ok(head, `${name}: ${key} has no ">" head`);
      const [x1, y1, tipX, tipY, x3, y3] = head.slice(1).map(Number);
      assert.ok(near(tipX, end(e)[0] + 0.5) && near(tipY, end(e)[1]), `${name}: the head of ${key} is not at the end of its line`);
      assert.ok(x1 < tipX && x3 < tipX && y1 < tipY && y3 > tipY, `${name}: the head of ${key} does not point right`);
      assert.match(body, /<path class="chevron flash"[^>]*>\s*<animate attributeName="opacity"/, `${name}: the head of ${key} does not light up`);
      const port = /<circle class="port" cx="(-?[\d.]+)" cy="(-?[\d.]+)"/.exec(body);
      assert.ok(port, `${name}: ${key} has no round port where it leaves its box`);
      const from = [...sources.values()].find((b) => near(b.right, Number(port[1])) && Number(port[2]) > b.top && Number(port[2]) < b.bottom);
      assert.ok(from, `${name}: the port of ${key} is not on the right edge of a box`);
      assert.ok(near(Number(port[2]), e.start[1]), `${name}: the line of ${key} does not leave from its port`);
    }
  }
});

// The rules inside each `@media (prefers-reduced-motion: reduce)` block of a style sheet.
function reducedMotionRules(css: string): string {
  let rules = "";
  for (const match of css.matchAll(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{/g)) {
    let depth = 1;
    let i = (match.index as number) + match[0].length;
    const startAt = i;
    while (depth > 0 && i < css.length) {
      if (css[i] === "{") depth++;
      if (css[i] === "}") depth--;
      i++;
    }
    rules += css.slice(startAt, i - 1);
  }
  return rules;
}

test("graph-hides-the-light-when-motion-is-reduced", () => {
  const out = join(tree({}), "graph.html");
  const r = run(["graph", "examples/skills", "--out", out], { cwd: root });
  assert.equal(r.code, 0, r.stderr);
  for (const [name, css] of [
    ["site/site.css", readFileSync(join(root, "site", "site.css"), "utf8")],
    ["the musubi graph page", readFileSync(out, "utf8")],
  ]) {
    const rules = reducedMotionRules(css);
    const hidden = [...rules.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => /display:\s*none/.test(m[2])).map((m) => m[1]);
    for (const part of [".tail", ".dot", ".flash"]) {
      assert.ok(
        hidden.some((selectors) => selectors.includes(part)),
        `${name} does not hide ${part} when motion is reduced`,
      );
    }
  }
});

test("graph-edges-run-straight-under-their-labels", () => {
  for (const [name, svg] of [
    ["five skills follow one", fanIn()],
    ["one skill follows two", fanOut()],
  ]) {
    for (const e of edges(svg)) {
      assert.ok(e.straightTo !== null, `${name}: ${e.key} does not start with a straight run`);
      assert.ok(e.label.left >= e.start[0], `${name}: the label of ${e.key} starts left of its box`);
      assert.ok(e.label.bottom < e.start[1], `${name}: the label of ${e.key} is not above its line`);
      assert.ok(
        (e.straightTo as number) >= e.label.right,
        `${name}: ${e.key} bends at ${e.straightTo}, before its label ends at ${e.label.right}`,
      );
    }
  }
});
