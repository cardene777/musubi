import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { root } from "./helpers.ts";

// Lines outside fenced code blocks, so headings inside examples are not counted.
function prose(text: string): string[] {
  let fenced = false;
  return text.split("\n").filter((line) => {
    if (line.startsWith("```")) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
}

function shape(path: string) {
  const text = readFileSync(path, "utf8");
  const lines = prose(text);
  return {
    headings: lines.filter((line) => /^#{1,6} /.test(line)).length,
    tables: lines.filter((line) => /^\|[-:| ]+\|$/.test(line)).length,
    fences: text.split("\n").filter((line) => line.startsWith("```")).length,
  };
}

function englishDocs(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith(".md") && !name.endsWith(".ja.md")) found.push(path);
    }
  };
  for (const name of ["README.md", "GLOSSARY.md"]) if (existsSync(join(root, name))) found.push(join(root, name));
  for (const dir of ["docs", "spec"]) if (existsSync(join(root, dir))) walk(join(root, dir));
  return found;
}

function sections(path: string): string[] {
  return prose(readFileSync(path, "utf8"))
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3).trim());
}

const spec = join(root, "spec", "musubi.md");
const specJa = join(root, "spec", "musubi.ja.md");

test("spec-has-the-six-sections", () => {
  assert.ok(existsSync(spec), "spec/musubi.md is missing");
  assert.ok(existsSync(specJa), "spec/musubi.ja.md is missing");
  const english = sections(spec);
  for (const name of [
    "Provider declaration",
    "Consumer declaration",
    "Discovery and loading",
    "Versions and fingerprints",
    "Re-checking",
    "Relation to existing systems",
  ]) {
    assert.ok(english.includes(name), `spec/musubi.md has no section ${name}`);
  }
  const japanese = sections(specJa);
  for (const name of ["出す側の宣言", "使う側の宣言", "見つけ方と読み込み方", "版と指紋", "確かめ直し方", "既にある仕組みとの関係"]) {
    assert.ok(japanese.includes(name), `spec/musubi.ja.md has no section ${name}`);
  }
});

test("spec-lists-the-rule-kinds", () => {
  assert.ok(existsSync(spec), "spec/musubi.md is missing");
  const text = readFileSync(spec, "utf8");
  assert.ok(sections(spec).includes("Check rules"), "spec/musubi.md has no section Check rules");
  for (const kind of ["`headings`", "`forbid`", "`table-columns`"]) assert.ok(text.includes(kind), `no rule kind ${kind}`);
  assert.ok(sections(specJa).includes("検査の決まり"), "spec/musubi.ja.md has no section 検査の決まり");
});

test("doc-pairs-have-the-same-shape", () => {
  const docs = englishDocs();
  assert.ok(docs.length > 0);
  for (const path of docs) {
    const ja = path.replace(/\.md$/, ".ja.md");
    const name = relative(root, path);
    assert.ok(existsSync(ja), `${name} has no Japanese counterpart`);
    assert.deepEqual(shape(ja), shape(path), `${name} and its Japanese counterpart differ in shape`);
  }
});

test("readme-links-the-spec-and-shows-the-example", () => {
  for (const [readme, link] of [
    ["README.md", "](spec/musubi.md)"],
    ["README.ja.md", "](spec/musubi.ja.md)"],
  ]) {
    const text = readFileSync(join(root, readme), "utf8");
    assert.ok(text.includes(link), `${readme} does not link ${link}`);
    const blocks = text.split("```json").slice(1).map((part) => part.split("```")[0]);
    assert.ok(blocks.some((block) => block.includes('"provides"')), `${readme} has no provider example`);
    assert.ok(blocks.some((block) => block.includes('"follows"')), `${readme} has no consumer example`);
  }
});

test("spec-shows-the-run-line-for-a-script", () => {
  const line =
    "Run the `verify` of the `design-doc` skill: open the `design-doc` skill by name and run the file it names for `verify`.";
  for (const path of [spec, specJa]) {
    assert.ok(readFileSync(path, "utf8").includes(line), `${path} does not show the run line`);
  }
});

test("readme-shows-how-to-register", () => {
  for (const readme of ["README.md", "README.ja.md"]) {
    const text = readFileSync(join(root, readme), "utf8");
    for (const part of ["registry/<owner>/<repo>.json", "node site/build.ts"]) {
      assert.ok(text.includes(part), `${readme} does not show ${part}`);
    }
  }
});

test("readme-shows-the-npm-install", () => {
  for (const readme of ["README.md", "README.ja.md"]) {
    const text = readFileSync(join(root, readme), "utf8");
    for (const command of ["npm install -g musubi-cli", "npx musubi-cli check"]) {
      assert.ok(text.includes(command), `${readme} does not show ${command}`);
    }
  }
});
