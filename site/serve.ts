#!/usr/bin/env node
// Serves the built site from site/dist on this machine, at http://localhost:3810/ unless PORT is set.
// It reads only files inside site/dist and answers nothing else.
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";

const dist = resolve(import.meta.dirname, "dist");
const port = Number(process.env.PORT ?? 3810);
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(join(dist, "index.html"))) {
  process.stderr.write("musubi site: site/dist has no pages; run node site/build.ts first\n");
  process.exit(1);
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  let file = normalize(join(dist, path));
  if (file !== dist && !file.startsWith(dist + sep)) {
    response.writeHead(404).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found\n");
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
}).listen(port, "127.0.0.1", () => {
  process.stderr.write(`musubi site: http://localhost:${port}/\n`);
});
