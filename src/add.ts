import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { load } from "./check.ts";
import { definitionVersions, latestDefinition, optionalVersions, whenVersions } from "./definition.ts";
import { fingerprint } from "./fingerprint.ts";
import { isObject } from "./json.ts";
import { Report } from "./report.ts";
import { format } from "./semver.ts";
import { fingerprintFiles } from "./skills.ts";

// Content files an agent runs rather than reads, told apart by their extension in any case.
const SCRIPT = /\.(py|sh|bash|js|mjs|cjs|ts)$/i;

// The three lines a consumer's SKILL.md body carries for one content it follows. The first line
// tells the agent to run a script and to read anything else as a format. For an optional follow the
// first line applies only when the provider is installed, and the last one goes on without it.
export function bodyLines(skill: string, content: string, file: string, optional = false): string[] {
  const how = SCRIPT.test(file)
    ? `run the \`${content}\` of the \`${skill}\` skill: open the \`${skill}\` skill by name and run the file it names for \`${content}\`.`
    : `write in the \`${content}\` format of the \`${skill}\` skill: open the \`${skill}\` skill by name and read the file it names for \`${content}\`.`;
  return [
    optional ? `When the \`${skill}\` skill is installed, ${how}` : how[0].toUpperCase() + how.slice(1),
    "If the `musubi` command is available, run `musubi check` before reading, and stop if it fails.",
    optional
      ? `If the \`${skill}\` skill is not installed, go on without the \`${content}\` of \`${skill}\`.`
      : `If the \`${skill}\` skill is not installed, do not start: tell the user that \`${skill}\` is missing and how to install it, then stop.`,
  ];
}

// Run in a consumer skill's folder: writes the range and the fingerprint of one content into its
// musubi.json and prints the lines to put in its SKILL.md body. The languages, given only with
// optional, become "when" of the follow.
export function add(ref: string, roots: string[], cwd: string, optional = false, languages: string[] = []): number {
  const report = new Report(cwd);
  const fail = (message: string) => {
    report.print();
    process.stderr.write(`musubi add: ${message}\n`);
    return 1;
  };
  if (!existsSync(join(cwd, "SKILL.md"))) return fail("run this in the folder of the skill that follows the content");
  const [skillName, content] = ref.split("/");
  if (!skillName || !content || ref.split("/").length !== 2) return fail(`"${ref}" must name a content as <skill>/<content>`);
  const { skills, declarations } = load(roots, report);
  const provider = skills.get(skillName);
  if (!provider) return fail(`no skill named ${skillName} is installed, so ${ref} cannot be added`);
  const provided = declarations.get(skillName)?.provides.get(content);
  if (!provided) return fail(`${skillName} provides no content named ${content}, so ${ref} cannot be added`);
  if (!provided.version || !provided.file) return fail(`the declaration of ${ref} has mistakes; run musubi check to see them`);

  const path = join(cwd, "musubi.json");
  let json: Record<string, unknown> = { musubi: latestDefinition };
  if (existsSync(path)) {
    const current: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (!isObject(current)) return fail("musubi.json holds something other than one JSON object");
    json = current;
  }
  // The fields written need a definition version that knows them. A file whose version does not is
  // moved to the earliest version that does, so that older musubi commands still read it.
  const knows = (version: unknown) =>
    typeof version === "string" && (!optional || optionalVersions.has(version)) && (languages.length === 0 || whenVersions.has(version));
  if (!knows(json.musubi)) json.musubi = definitionVersions.find(knows) ?? latestDefinition;
  const follows = isObject(json.follows) ? json.follows : {};
  // Keep fields the consumer already wrote, such as examples, after the ones this command owns.
  const { version: _version, integrity: _integrity, optional: _optional, when: _when, ...kept } = isObject(follows[ref]) ? follows[ref] : {};
  follows[ref] = {
    version: `^${format(provided.version)}`,
    integrity: fingerprint(provider.dir, fingerprintFiles(provided)),
    ...(optional ? { optional: true } : {}),
    ...(languages.length > 0 ? { when: { languages } } : {}),
    ...kept,
  };
  json.follows = follows;
  writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`);
  process.stderr.write(`musubi add: wrote ${ref} ^${format(provided.version)} to ${basename(cwd)}/musubi.json\n`);
  process.stdout.write(`${bodyLines(skillName, content, provided.file, optional).join("\n")}\n`);
  return 0;
}
