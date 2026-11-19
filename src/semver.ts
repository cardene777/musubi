// Content versions are MAJOR.MINOR.PATCH, and ranges are `^X.Y.Z`, `~X.Y.Z`, or an exact `X.Y.Z`,
// read the way npm reads them.

export type Version = readonly [number, number, number];
export type Range = { text: string; min: Version; below: Version };

const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(text: string): Version | null {
  const match = VERSION.exec(text);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

export function parseRange(text: string): Range | null {
  const operator = text.startsWith("^") || text.startsWith("~") ? text[0] : "";
  const min = parseVersion(text.slice(operator.length));
  if (!min) return null;
  const [major, minor, patch] = min;
  let below: Version;
  if (operator === "^") {
    if (major > 0) below = [major + 1, 0, 0];
    else if (minor > 0) below = [0, minor + 1, 0];
    else below = [0, 0, patch + 1];
  } else if (operator === "~") {
    below = [major, minor + 1, 0];
  } else {
    below = [major, minor, patch + 1];
  }
  return { text, min, below };
}

function compare(a: Version, b: Version): number {
  for (let i = 0; i < 3; i += 1) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function satisfies(version: Version, range: Range): boolean {
  return compare(version, range.min) >= 0 && compare(version, range.below) < 0;
}

export function format(version: Version): string {
  return version.join(".");
}
