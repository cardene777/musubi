// A JSON reader that remembers the line of every key, so problems can name the file and line.

export class JsonError extends Error {
  readonly line: number;
  constructor(message: string, line: number) {
    super(message);
    this.line = line;
  }
}

export type Located = {
  value: unknown;
  // JSON Pointer (RFC 6901) of each object member and array item to the line it starts on.
  lines: Map<string, number>;
};

export function pointer(...keys: string[]): string {
  return keys.map((key) => `/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`).join("");
}

export function parseLocated(text: string): Located {
  let i = 0;
  let line = 1;
  const lines = new Map<string, number>([["", 1]]);

  const fail = (message: string): never => {
    throw new JsonError(message, line);
  };

  const space = () => {
    while (i < text.length) {
      const c = text[i];
      if (c === "\n") {
        line += 1;
        i += 1;
      } else if (c === " " || c === "\t" || c === "\r") {
        i += 1;
      } else {
        break;
      }
    }
  };

  const string = (): string => {
    const start = i;
    i += 1;
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\n") fail("a string runs past the end of the line");
      i += text[i] === "\\" ? 2 : 1;
    }
    if (i >= text.length) fail("a string is not closed");
    i += 1;
    try {
      return JSON.parse(text.slice(start, i)) as string;
    } catch {
      return fail("a string has an invalid escape");
    }
  };

  const value = (at: string): unknown => {
    space();
    const c = text[i];
    if (c === "{") {
      i += 1;
      const object: Record<string, unknown> = {};
      space();
      if (text[i] === "}") {
        i += 1;
        return object;
      }
      for (;;) {
        space();
        if (text[i] !== '"') fail("expected a key in double quotes");
        const keyLine = line;
        const key = string();
        if (Object.hasOwn(object, key)) fail(`the key "${key}" appears twice`);
        space();
        if (text[i] !== ":") fail(`expected ":" after "${key}"`);
        i += 1;
        const child = at + pointer(key);
        lines.set(child, keyLine);
        object[key] = value(child);
        space();
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "}") {
          i += 1;
          return object;
        }
        fail('expected "," or "}"');
      }
    }
    if (c === "[") {
      i += 1;
      const array: unknown[] = [];
      space();
      if (text[i] === "]") {
        i += 1;
        return array;
      }
      for (;;) {
        space();
        const child = `${at}/${array.length}`;
        lines.set(child, line);
        array.push(value(child));
        space();
        if (text[i] === ",") {
          i += 1;
          continue;
        }
        if (text[i] === "]") {
          i += 1;
          return array;
        }
        fail('expected "," or "]"');
      }
    }
    if (c === '"') return string();
    const literal = /^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.exec(text.slice(i));
    if (!literal) return fail("expected a value");
    i += literal[0].length;
    return JSON.parse(literal[0]);
  };

  const result = value("");
  space();
  if (i < text.length) fail("unexpected text after the JSON value");
  return { value: result, lines };
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
