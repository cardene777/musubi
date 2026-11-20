import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The definition versions this command reads are the dated folders under schema/, so the dates
// live in one place. The folder sits next to src/ in the repository and next to dist/ when installed.
export const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));

export const definitionVersions: readonly string[] = readdirSync(schemaDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort();

export const latestDefinition = definitionVersions[definitionVersions.length - 1];

// The definition versions whose schema lets a follow carry a field, read from the schemas so that
// no date is written in the code.
function versionsKnowing(field: string): ReadonlySet<string> {
  return new Set(
    definitionVersions.filter((version) => {
      const schema = JSON.parse(readFileSync(`${schemaDir}${version}/musubi.schema.json`, "utf8"));
      return schema?.$defs?.followed?.properties?.[field] !== undefined;
    }),
  );
}

// "optional" makes a follow optional (decision record 0007), and "when" names the languages for
// which musubi install installs the provider of an optional follow (decision record 0009).
export const optionalVersions = versionsKnowing("optional");
export const whenVersions = versionsKnowing("when");

// Agents read a content file whole; Agent Skills suggests keeping SKILL.md under this many lines.
export const READ_LINES = 500;
