import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The definition versions this command reads are the dated folders under schema/, so the dates
// live in one place. The folder sits next to src/ in the repository and next to dist/ when installed.
export const schemaDir = fileURLToPath(new URL("../schema/", import.meta.url));

export const definitionVersions: readonly string[] = readdirSync(schemaDir)
  .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
  .sort();

export const latestDefinition = definitionVersions[definitionVersions.length - 1];

// Agents read a content file whole; Agent Skills suggests keeping SKILL.md under this many lines.
export const READ_LINES = 500;
