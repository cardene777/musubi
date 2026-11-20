import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { DEF, root } from "./helpers.ts";

const schemaPath = join(root, "schema", DEF, "musubi.schema.json");

function validator() {
  assert.ok(existsSync(schemaPath), `the schema is missing at schema/${DEF}/musubi.schema.json`);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  return ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")));
}

const provider = (version: string) => ({ musubi: DEF, provides: { design: { version, file: "formats/design.md" } } });
const consumer = (range: string) => ({
  musubi: DEF,
  follows: { "design-doc/design": { version: range, integrity: `sha256-${"A".repeat(43)}=` } },
});

test("schema-accepts-the-examples", () => {
  const validate = validator();
  const dir = join(root, "examples", "skills");
  assert.ok(existsSync(dir), "examples/skills is missing");
  const files = readdirSync(dir)
    .map((name) => join(dir, name, "musubi.json"))
    .filter((path) => existsSync(path));
  assert.equal(files.length, 2, "examples/skills should hold one provider and one consumer");
  for (const path of files) {
    const json = JSON.parse(readFileSync(path, "utf8"));
    assert.ok(validate(json), `${path}: ${JSON.stringify(validate.errors)}`);
  }
});

test("schema-rejects-a-bad-version", () => {
  const validate = validator();
  assert.ok(validate(provider("1.0.0")));
  assert.ok(validate(consumer("^1.0.0")));
  assert.equal(validate(provider("1.0")), false);
  assert.equal(validate(consumer("abc")), false);
});

test("schema-rejects-an-unknown-field", () => {
  const validate = validator();
  assert.equal(validate({ ...provider("1.0.0"), extra: true }), false);
  const nested = provider("1.0.0");
  (nested.provides.design as Record<string, unknown>).kind = "format";
  assert.equal(validate(nested), false);
});

test("schema-accepts-an-optional-follow", () => {
  const next = join(root, "schema", "2026-11-20", "musubi.schema.json");
  assert.ok(existsSync(next), "the schema is missing at schema/2026-11-20/musubi.schema.json");
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validateNext = ajv.compile(JSON.parse(readFileSync(next, "utf8")));
  const follow = (musubi: string, value: unknown) => ({
    musubi,
    follows: { "design-doc/design": { version: "^1.0.0", integrity: `sha256-${"A".repeat(43)}=`, optional: value } },
  });
  assert.ok(validateNext(follow("2026-11-20", true)), JSON.stringify(validateNext.errors));
  assert.ok(validateNext(follow("2026-11-20", false)), JSON.stringify(validateNext.errors));
  assert.equal(validateNext(follow("2026-11-20", "yes")), false);
  assert.equal(validator()(follow(DEF, true)), false, "the 2026-11-19 schema accepts optional");
});
