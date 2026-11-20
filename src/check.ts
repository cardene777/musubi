import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { READ_LINES } from "./definition.ts";
import { fingerprint } from "./fingerprint.ts";
import { Report } from "./report.ts";
import { applyRules } from "./rules.ts";
import { type Declaration, discover, fingerprintFiles, readDeclaration, type Skill } from "./skills.ts";
import { format, satisfies } from "./semver.ts";

export type Loaded = { skills: Map<string, Skill>; declarations: Map<string, Declaration> };

export function load(roots: string[], report: Report): Loaded {
  const skills = discover(roots, report);
  const declarations = new Map<string, Declaration>();
  for (const skill of skills.values()) {
    const declaration = readDeclaration(skill, report);
    if (declaration) declarations.set(skill.name, declaration);
  }
  return { skills, declarations };
}

// Follows form a graph from each skill to the skills it follows. A cycle makes an agent read the
// same content again and again, so the first cycle found is refused with its path.
function findCycle(declarations: Map<string, Declaration>): string[] | null {
  const state = new Map<string, "open" | "done">();
  const path: string[] = [];
  const visit = (name: string): string[] | null => {
    if (state.get(name) === "done") return null;
    if (state.get(name) === "open") return [...path.slice(path.indexOf(name)), name];
    state.set(name, "open");
    path.push(name);
    for (const follow of declarations.get(name)?.follows ?? []) {
      if (!declarations.has(follow.skill)) continue;
      const cycle = visit(follow.skill);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(name, "done");
    return null;
  };
  for (const name of [...declarations.keys()].sort()) {
    const cycle = visit(name);
    if (cycle) return cycle;
  }
  return null;
}

export function check(roots: string[], cwd: string, update: boolean): number {
  const report = new Report(cwd);
  const { skills, declarations } = load(roots, report);
  let follows = 0;
  const rewrites: Array<{ declaration: Declaration; line: number; from: string; to: string }> = [];

  for (const declaration of declarations.values()) {
    const consumer = declaration.skill.name;
    for (const follow of declaration.follows) {
      follows += 1;
      const provider = skills.get(follow.skill);
      if (!provider && follow.optional) {
        report.warn(`${consumer} follows ${follow.ref} only when ${follow.skill} is installed; it is not, so this follow was skipped`);
        continue;
      }
      if (!provider) {
        report.problem(declaration.path, follow.line, `${consumer} follows ${follow.ref}, but no skill named ${follow.skill} is installed`);
        continue;
      }
      const provided = declarations.get(follow.skill)?.provides.get(follow.content);
      if (!provided) {
        report.problem(declaration.path, follow.line, `${consumer} follows ${follow.ref}, but ${follow.skill} provides no content named ${follow.content}`);
        continue;
      }
      if (!provided.version || !provided.file || !follow.range) continue;
      if (!satisfies(provided.version, follow.range)) {
        report.problem(
          declaration.path,
          follow.versionLine,
          `${consumer} accepts ${follow.range.text} of ${follow.ref}, but ${follow.skill} provides ${format(provided.version)}`,
        );
        continue;
      }
      const body = readFileSync(join(provider.dir, provided.file), "utf8");
      const lineCount = body.split("\n").length - (body.endsWith("\n") ? 1 : 0);
      if (lineCount > READ_LINES) {
        report.warn(`${follow.ref} is ${lineCount} lines, over the ${READ_LINES} lines Agent Skills suggests for SKILL.md; agents read it whole`);
      }
      const now = fingerprint(provider.dir, fingerprintFiles(provided));
      const changed = follow.integrity !== null && now !== follow.integrity;
      if (changed && !update) {
        report.problem(
          declaration.path,
          follow.integrityLine,
          `${consumer}: the fingerprint of ${follow.ref} does not match, so its content changed after the last check; ` +
            "review the change and run musubi check --update",
        );
        continue;
      }
      const before = report.problems.length;
      if (provided.rules) {
        for (const example of follow.examples) {
          const path = join(declaration.skill.dir, example);
          for (const finding of applyRules(provided.rules, readFileSync(path, "utf8"))) {
            report.problem(path, finding.line, `${finding.message} (${follow.ref})`);
          }
        }
      }
      if (changed && follow.integrity && report.problems.length === before) {
        rewrites.push({ declaration, line: follow.integrityLine, from: follow.integrity, to: now });
      }
    }
  }

  const cycle = findCycle(declarations);
  if (cycle) {
    const first = declarations.get(cycle[0]);
    const follow = first?.follows.find((f) => f.skill === cycle[1]);
    report.problem(first?.path ?? cwd, follow?.line ?? 1, `the skills follow each other in a cycle: ${cycle.join(" -> ")}`);
  }

  for (const rewrite of rewrites) {
    const lines = readFileSync(rewrite.declaration.path, "utf8").split("\n");
    lines[rewrite.line - 1] = lines[rewrite.line - 1].replace(rewrite.from, rewrite.to);
    writeFileSync(rewrite.declaration.path, lines.join("\n"));
  }

  report.print();
  if (report.problems.length > 0) {
    process.stderr.write(`musubi check: ${report.problems.length} problem${report.problems.length === 1 ? "" : "s"}\n`);
    return 1;
  }
  const updated = rewrites.length > 0 ? `, updated=${rewrites.length}` : "";
  process.stdout.write(`musubi check: ok (skills=${skills.size}, follows=${follows}${updated})\n`);
  return 0;
}
