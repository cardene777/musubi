import { readFileSync } from "node:fs";
import { definitionVersions } from "./definition.ts";
import { isObject, JsonError, parseLocated, pointer } from "./json.ts";
import type { Report } from "./report.ts";

// A check is a JSON file of rules. musubi reads the rules itself; it never runs provider code.
export type Rule =
  | { kind: "headings"; headings: string[] }
  | { kind: "forbid"; text: string[] }
  | { kind: "table-columns"; heading: string; columns: string[] };

const FIELDS: Record<Rule["kind"], Record<string, "string" | "strings">> = {
  headings: { headings: "strings" },
  forbid: { text: "strings" },
  "table-columns": { heading: "string", columns: "strings" },
};

// Reads and validates a rules file, reporting each mistake at its line. Returns null when it is unusable.
export function readRules(path: string, report: Report): Rule[] | null {
  let located;
  try {
    located = parseLocated(readFileSync(path, "utf8"));
  } catch (error) {
    if (error instanceof JsonError) report.problem(path, error.line, `not valid JSON: ${error.message}`);
    else report.problem(path, 1, "the check file cannot be read");
    return null;
  }
  const { value, lines } = located;
  const at = (...keys: string[]) => lines.get(pointer(...keys)) ?? 1;
  if (!isObject(value)) {
    report.problem(path, 1, "a check file holds one JSON object");
    return null;
  }
  let usable = true;
  for (const key of Object.keys(value)) {
    if (key !== "$schema" && key !== "musubi" && key !== "rules") {
      report.problem(path, at(key), `unknown field "${key}"`);
      usable = false;
    }
  }
  if (typeof value.musubi !== "string" || !definitionVersions.includes(value.musubi)) {
    report.problem(path, at("musubi"), `"musubi" must name a definition version (${definitionVersions.join(", ")})`);
    usable = false;
  }
  if (!Array.isArray(value.rules)) {
    report.problem(path, at("rules"), '"rules" must be a list of rules');
    return null;
  }
  const rules: Rule[] = [];
  value.rules.forEach((rule, index) => {
    const line = lines.get(`/rules/${index}`) ?? 1;
    if (!isObject(rule) || typeof rule.kind !== "string" || !(rule.kind in FIELDS)) {
      report.problem(path, line, `rule ${index + 1} has no known "kind" (${Object.keys(FIELDS).join(", ")})`);
      usable = false;
      return;
    }
    const fields = FIELDS[rule.kind as Rule["kind"]];
    for (const key of Object.keys(rule)) {
      if (key !== "kind" && !(key in fields)) {
        report.problem(path, lines.get(`/rules/${index}${pointer(key)}`) ?? line, `rule ${index + 1} has an unknown field "${key}"`);
        usable = false;
      }
    }
    for (const [key, type] of Object.entries(fields)) {
      const field = rule[key];
      const ok =
        type === "string"
          ? typeof field === "string" && field !== ""
          : Array.isArray(field) && field.length > 0 && field.every((item) => typeof item === "string" && item !== "");
      if (!ok) {
        report.problem(path, line, `rule ${index + 1} needs "${key}" as ${type === "string" ? "text" : "a list of text"}`);
        usable = false;
      }
    }
    rules.push(rule as Rule);
  });
  return usable ? rules : null;
}

type Line = { number: number; text: string };

// Lines outside fenced code blocks, with their 1-based numbers.
function prose(text: string): Line[] {
  let fenced = false;
  const out: Line[] = [];
  text.split("\n").forEach((raw, index) => {
    const line = raw.replace(/\s+$/, "");
    if (line.startsWith("```") || line.startsWith("~~~")) {
      fenced = !fenced;
      return;
    }
    if (!fenced) out.push({ number: index + 1, text: line });
  });
  return out;
}

const level = (text: string) => /^(#{1,6}) /.exec(text)?.[1].length ?? 0;

function cells(row: string): string[] {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export type Finding = { line: number; message: string };

// Applies the rules to one example. Sections the consumer added are skipped, because each rule
// looks only for what it requires.
export function applyRules(rules: Rule[], text: string): Finding[] {
  const lines = prose(text);
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.kind === "headings") {
      let previous: { heading: string; line: number } | null = null;
      for (const heading of rule.headings) {
        const found = lines.find((line) => line.text === heading);
        if (!found) {
          findings.push({ line: previous?.line ?? 1, message: `the heading "${heading}" is missing` });
          continue;
        }
        if (previous && found.number < previous.line) {
          findings.push({ line: found.number, message: `the heading "${heading}" must come after "${previous.heading}"` });
        }
        previous = { heading, line: found.number };
      }
    } else if (rule.kind === "forbid") {
      for (const needle of rule.text) {
        for (const line of lines) {
          if (line.text.includes(needle)) findings.push({ line: line.number, message: `"${needle}" must not remain` });
        }
      }
    } else {
      const start = lines.findIndex((line) => line.text === rule.heading);
      if (start === -1) {
        findings.push({ line: 1, message: `no heading "${rule.heading}" to hold the table` });
        continue;
      }
      const depth = level(rule.heading);
      const section: Line[] = [];
      for (const line of lines.slice(start + 1)) {
        const l = level(line.text);
        if (l > 0 && l <= depth) break;
        section.push(line);
      }
      const header = section.findIndex(
        (line, i) => line.text.startsWith("|") && /^\|[-:| ]+\|$/.test(section[i + 1]?.text ?? ""),
      );
      if (header === -1) {
        findings.push({ line: lines[start].number, message: `no table under "${rule.heading}"` });
        continue;
      }
      const have = cells(section[header].text);
      for (const column of rule.columns) {
        if (!have.includes(column)) {
          findings.push({
            line: section[header].number,
            message: `the table under "${rule.heading}" has no column "${column}"`,
          });
        }
      }
    }
  }
  return findings;
}
