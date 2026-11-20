#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import { add } from "./add.ts";
import { check } from "./check.ts";
import { graph } from "./graph.ts";
import { install } from "./install.ts";
import { defaultRoots, LANGUAGE_TAG } from "./skills.ts";

const USAGE = `usage:
  musubi check [<skills folder>...] [--update]
      Checks every musubi.json in the folders. Without folders it reads .claude/skills, .agents/skills,
      .github/skills, and .gemini/skills in this folder and in the home folder.
      --update rewrites a fingerprint after its content passes the check again.
  musubi add <skill>/<content> [<skills folder>...] [--optional [--lang <language>]...]
      Run in a skill's folder: makes the skill follow the content and prints the lines for its SKILL.md.
      --optional makes the follow optional: the skill reads the content only when the provider is installed.
      --lang writes the languages for which musubi install installs the provider of the optional follow.
  musubi install <skill>... --from <folder or git URL>... [--to <skills folder>] [--with <skill>]... [--lang <language>]...
      Installs the skills and the skills they follow, found by folder name in the sources, then runs musubi check.
      Without --to it installs into the first of .claude/skills, .agents/skills, .github/skills, and
      .gemini/skills in this folder. The provider of an optional follow is installed only when --with names
      it or a --lang language matches the follow's "when".
  musubi graph [<skills folder>...] [--out <file>]
      Writes an HTML page of the skills and the contents they follow (default musubi-graph.html).
`;

// The options each command takes: flags stand alone, and the others take the word after them.
const FLAGS: Record<string, string[]> = { check: ["--update"], add: ["--optional"] };
const VALUES: Record<string, string[]> = { add: ["--lang"], install: ["--from", "--to", "--with", "--lang"], graph: ["--out"] };

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  const cwd = process.cwd();
  const flags = new Set<string>();
  const values = new Map<string, string[]>();
  const positional: string[] = [];
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) positional.push(arg);
    else if (FLAGS[command]?.includes(arg)) flags.add(arg);
    else if (VALUES[command]?.includes(arg) && rest[i + 1] !== undefined && !rest[i + 1].startsWith("--") && rest[i + 1] !== "") {
      values.set(arg, [...(values.get(arg) ?? []), rest[i + 1]]);
      i += 1;
    } else {
      process.stderr.write(`musubi: unknown or incomplete option ${arg}\n${USAGE}`);
      return 2;
    }
  }
  const all = (option: string) => values.get(option) ?? [];
  const last = (option: string) => all(option).at(-1);
  const badTag = all("--lang").find((tag) => !LANGUAGE_TAG.test(tag));
  if (badTag !== undefined) {
    process.stderr.write(`musubi: --lang takes a language tag such as ja or ja-JP, not "${badTag}"\n`);
    return 2;
  }
  const roots = (given: string[], extra: string[] = []) =>
    given.length > 0 ? given.map((r) => resolve(cwd, r)) : [...extra, ...defaultRoots(cwd, homedir())];
  switch (command) {
    case "check":
      return check(roots(positional), cwd, flags.has("--update"));
    case "add": {
      const [ref, ...given] = positional;
      if (!ref) break;
      if (all("--lang").length > 0 && !flags.has("--optional")) {
        process.stderr.write("musubi add: --lang needs --optional, because only an optional follow names languages\n");
        return 2;
      }
      return add(ref, roots(given, [resolve(cwd, "..")]), cwd, flags.has("--optional"), all("--lang"));
    }
    case "install":
      if (positional.length === 0) break;
      if (all("--from").length === 0) {
        process.stderr.write("musubi install: name at least one source with --from, a folder or a git URL\n");
        return 2;
      }
      return install({
        names: positional,
        sources: all("--from"),
        to: last("--to") ?? null,
        with: all("--with"),
        languages: all("--lang"),
        cwd,
        home: homedir(),
      });
    case "graph":
      return graph(roots(positional), resolve(cwd, last("--out") ?? "musubi-graph.html"), cwd);
  }
  process.stderr.write(USAGE);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
