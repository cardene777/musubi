import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { root } from "./helpers.ts";

const dir = join(root, "examples", "skills");

function exampleSkills(): string[] {
  assert.ok(existsSync(dir), "examples/skills is missing");
  const names = readdirSync(dir).filter((name) => existsSync(join(dir, name, "SKILL.md")));
  assert.equal(names.length, 2, "examples/skills should hold one provider and one consumer");
  return names;
}

function frontmatterKeys(text: string): string[] {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md has no frontmatter");
  return match[1]
    .split("\n")
    .filter((line) => /^[a-z-]+:/.test(line))
    .map((line) => line.split(":")[0]);
}

test("examples-keep-the-agent-skills-frontmatter", () => {
  for (const name of exampleSkills()) {
    const text = readFileSync(join(dir, name, "SKILL.md"), "utf8");
    assert.deepEqual(frontmatterKeys(text).sort(), ["description", "name"], name);
    assert.match(text, new RegExp(`^name: ${name}$`, "m"));
  }
});

test("examples-point-at-the-schema", () => {
  for (const name of exampleSkills()) {
    const path = join(dir, name, "musubi.json");
    const json = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(typeof json.$schema, "string", `${name}/musubi.json has no $schema`);
    const target = resolve(dirname(path), json.$schema);
    assert.ok(target.startsWith(join(root, "schema")), `${name}/musubi.json points outside schema/`);
    assert.ok(existsSync(target), `${name}/musubi.json points at a missing schema`);
  }
});

test("examples-consumer-body-has-the-three-lines", () => {
  const consumers = exampleSkills().filter((name) => {
    const json = JSON.parse(readFileSync(join(dir, name, "musubi.json"), "utf8"));
    return json.follows !== undefined;
  });
  assert.equal(consumers.length, 1, "examples/skills should hold one consumer");
  const body = readFileSync(join(dir, consumers[0], "SKILL.md"), "utf8");
  const lines = body.split("\n");
  assert.ok(lines.some((line) => line.includes("`design`") && line.includes("`design-doc`")), "no line naming the content");
  assert.ok(lines.some((line) => line.includes("musubi check")), "no line comparing fingerprints before reading");
  assert.ok(lines.some((line) => line.includes("not installed")), "no line stopping when the provider is missing");
});
