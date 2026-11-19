#!/usr/bin/env node
import { homedir } from "node:os";
import { resolve } from "node:path";
import { add } from "./add.ts";
import { check } from "./check.ts";
import { graph } from "./graph.ts";
import { defaultRoots } from "./skills.ts";

const USAGE = `usage:
  musubi check [<skills folder>...] [--update]
      Checks every musubi.json in the folders. Without folders it reads .claude/skills, .agents/skills,
      .github/skills, and .gemini/skills in this folder and in the home folder.
      --update rewrites a fingerprint after its content passes the check again.
  musubi add <skill>/<content> [<skills folder>...]
      Run in a skill's folder: makes the skill follow the content and prints the lines for its SKILL.md.
  musubi graph [<skills folder>...] [--out <file>]
      Writes an HTML page of the skills and the contents they follow (default musubi-graph.html).
`;

function main(argv: string[]): number {
  const [command, ...rest] = argv;
  const cwd = process.cwd();
  const flags = new Set(rest.filter((arg) => arg.startsWith("--")));
  const positional: string[] = [];
  let out = "musubi-graph.html";
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === "--out") {
      out = rest[i + 1] ?? "";
      i += 1;
    } else if (!rest[i].startsWith("--")) positional.push(rest[i]);
  }
  const unknown = [...flags].filter((flag) => !(command === "check" && flag === "--update") && !(command === "graph" && flag === "--out"));
  if (command === "--help" || command === "-h") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (unknown.length > 0 || (command === "graph" && out === "")) {
    process.stderr.write(`musubi: unknown or incomplete option ${unknown[0] ?? "--out"}\n${USAGE}`);
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
      return add(ref, roots(given, [resolve(cwd, "..")]), cwd);
    }
    case "graph":
      return graph(roots(positional), resolve(cwd, out), cwd);
  }
  process.stderr.write(USAGE);
  return 2;
}

process.exitCode = main(process.argv.slice(2));
