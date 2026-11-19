import { relative } from "node:path";

export type Problem = { file: string; line: number; message: string };

// Collects problems as `<file>:<line>: <message>` and warnings, with paths relative to the
// folder the command runs in.
export class Report {
  readonly problems: Problem[] = [];
  readonly warnings: string[] = [];
  private readonly cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  problem(file: string, line: number, message: string): void {
    this.problems.push({ file, line, message });
  }

  warn(message: string): void {
    this.warnings.push(message);
  }

  where(file: string): string {
    return relative(this.cwd, file) || file;
  }

  print(): void {
    for (const warning of this.warnings) process.stderr.write(`warning: ${warning}\n`);
    for (const p of this.problems) process.stderr.write(`${this.where(p.file)}:${p.line}: ${p.message}\n`);
  }
}
