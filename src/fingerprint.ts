import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The fingerprint of one content: sha256 over each file's path, byte length, and bytes, in the
// order the provider's SKILL.md, the content file, and the check file, written as `sha256-<base64>`.
export function fingerprint(skillDir: string, paths: string[]): string {
  const hash = createHash("sha256");
  for (const path of paths) {
    const bytes = readFileSync(join(skillDir, path));
    hash.update(`${path}\n${bytes.length}\n`);
    hash.update(bytes);
    hash.update("\n");
  }
  return `sha256-${hash.digest("base64")}`;
}

export const INTEGRITY = /^sha256-[A-Za-z0-9+/]{43}=$/;
