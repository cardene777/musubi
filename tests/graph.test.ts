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
