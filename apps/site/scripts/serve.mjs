// Plain static file server for out/ (no Next server): proves the export needs no backend.
//   node scripts/serve.mjs [port]      honours SITE_BASE_PATH
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const out = resolve(import.meta.dirname, "../out");
const base = process.env.SITE_BASE_PATH ?? "";
const port = Number(process.argv[2] ?? 3041);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export function serve(listenPort = port) {
  const server = createServer((req, res) => {
    let path = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
    if (base) {
      if (!path.startsWith(base)) return void res.writeHead(404).end();
      path = path.slice(base.length) || "/";
    }
    let file = join(out, path);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) {
      res.writeHead(404, { "content-type": TYPES[".html"] });
      return void createReadStream(join(out, "404.html")).pipe(res);
    }
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(listenPort, () => ok(server)));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await serve();
  console.log(`serving out/ at http://localhost:${port}${base}/`);
}
