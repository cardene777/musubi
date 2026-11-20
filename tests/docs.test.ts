import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { DROPPED_JA, root } from "./helpers.ts";

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
  for (const name of [
    "providerの宣言",
    "consumerの宣言",
    "見つけ方と読み込み方",
    "バージョンとフィンガープリント",
    "再チェック",
    "既存の仕組みとの関係",
  ]) {
    assert.ok(japanese.includes(name), `spec/musubi.ja.md has no section ${name}`);
  }
});

test("spec-lists-the-rule-kinds", () => {
  assert.ok(existsSync(spec), "spec/musubi.md is missing");
  const text = readFileSync(spec, "utf8");
  assert.ok(sections(spec).includes("Check rules"), "spec/musubi.md has no section Check rules");
  for (const kind of ["`headings`", "`forbid`", "`table-columns`"]) assert.ok(text.includes(kind), `no rule kind ${kind}`);
  assert.ok(sections(specJa).includes("チェックのルール"), "spec/musubi.ja.md has no section チェックのルール");
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

test("publishing-doc-shows-the-manual-steps", () => {
  for (const [doc, readme] of [
    ["docs/publishing.md", "README.md"],
    ["docs/publishing.ja.md", "README.ja.md"],
  ]) {
    assert.ok(existsSync(join(root, doc)), `${doc} is missing`);
    const text = readFileSync(join(root, doc), "utf8");
    for (const part of ["pnpm site:publish", "musubi.cardene.dev", "CNAME", "TXT", "gh-pages"]) {
      assert.ok(text.includes(part), `${doc} does not show ${part}`);
    }
    assert.ok(readFileSync(join(root, readme), "utf8").includes(`](${doc})`), `${readme} does not link ${doc}`);
  }
  const scripts = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {};
  assert.equal(scripts["site:publish"], "node site/publish.ts", "package.json has no site:publish script that runs site/publish.ts");
});

test("publishing-doc-says-to-sign-in-to-gh", () => {
  for (const doc of ["docs/publishing.md", "docs/publishing.ja.md"]) {
    const text = readFileSync(join(root, doc), "utf8");
    const block = [...text.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).find((code) => code.includes("gh auth login"));
    assert.ok(block, `${doc} has no command block that signs in with gh auth login`);
    assert.ok(text.includes("musubi-skills"), `${doc} does not say the publish searches the topic musubi-skills`);
  }
});

// The Japanese counterpart of every English document the shape test reads.
const japaneseDocs = () => englishDocs().map((path) => path.replace(/\.md$/, ".ja.md")).filter((path) => existsSync(path));
// Lines outside fenced blocks with inline code taken out, so code, keys, and commands are not read.
const plain = (path: string) => prose(readFileSync(path, "utf8")).map((line) => line.replace(/`[^`]*`/g, ""));

test("ja-doc-headings-have-no-comma", () => {
  const docs = japaneseDocs();
  assert.ok(docs.length > 0);
  const found = docs.flatMap((path) =>
    plain(path)
      .filter((line) => /^#{1,6} /.test(line) && line.includes("、"))
      .map((line) => `${relative(root, path)}: ${line}`),
  );
  assert.deepEqual(found, [], "Japanese headings have 、");
});

test("ja-docs-use-the-glossary-terms", () => {
  const found = japaneseDocs().flatMap((path) =>
    plain(path).flatMap((line) => DROPPED_JA.filter((word) => line.includes(word)).map((word) => `${relative(root, path)}: ${word}: ${line.trim()}`)),
  );
  assert.deepEqual(found, [], "Japanese documents use words the glossary replaced");
});

test("glossary-names-the-chosen-terms", () => {
  const terms = prose(readFileSync(join(root, "GLOSSARY.ja.md"), "utf8"))
    .filter((line) => /^\| /.test(line) && !/^\|[-:| ]+\|$/.test(line))
    .map((line) => line.split("|")[1].trim().replace(/`/g, ""));
  for (const term of ["provider", "consumer", "コンテンツ", "フィンガープリント", "チェック", "バージョンの範囲", "定義のバージョン"]) {
    assert.ok(terms.includes(term), `GLOSSARY.ja.md does not define ${term}`);
  }
});
