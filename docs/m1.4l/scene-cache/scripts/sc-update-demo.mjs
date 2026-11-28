// M1.4R.2: node sc-update-demo.mjs [lifetime-seconds=5]. Uses port 3105 and a file in the OS temp folder; nothing in the repository.
// Staleness bound demo (audit criterion 5) without touching public/: a scratch server serves one file with
// "public, max-age=LIFE" and a weak size-mtime ETag (Next's public/ scheme), the file is overwritten in place, and the
// page fetches it with the browser's normal HTTP cache. Server hits are counted.
import http from "node:http"; import { writeFileSync, readFileSync, statSync, mkdirSync } from "node:fs"; import { join } from "node:path"; import { tmpdir } from "node:os";
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";
const LIFE = Number(process.argv[2] ?? 5), DIR = join(tmpdir(), "m14r2-update-demo"), F = join(DIR, "asset.txt"); mkdirSync(DIR, { recursive: true });
let hits = []; writeFileSync(F, "version-1");
const srv = http.createServer((req, res) => {
  if (req.url === "/") { res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" }); return res.end("<!doctype html><title>t</title>"); }
  const s = statSync(F), etag = `W/"${s.size.toString(16)}-${s.mtimeMs.toString(16)}"`;
  hits.push(`${req.url} ${req.headers["if-none-match"] ? "conditional" : "plain"}`);
  if (req.headers["if-none-match"] === etag) { res.writeHead(304, { etag, "cache-control": `public, max-age=${LIFE}` }); return res.end(); }
  res.writeHead(200, { etag, "cache-control": `public, max-age=${LIFE}`, "content-type": "text/plain" }); res.end(readFileSync(F));
});
await new Promise((ok) => srv.listen(3105, "localhost", ok));
const page = await launch(); await page.goto("http://localhost:3105/");
const get = (u) => page.eval(`fetch(${JSON.stringify(u)}).then((r) => r.text())`);
const step = async (label, u) => { hits = []; const body = await get(u); console.log(`${label.padEnd(58)} -> ${body.padEnd(10)} server saw: ${hits.join(", ") || "nothing"}`); };
const t0 = Date.now(); const at = () => `t=${((Date.now() - t0) / 1000).toFixed(1)}s`;
await step(`${at()} first load`, "/asset.txt");
writeFileSync(F, "version-2!"); console.log(`${at()} file overwritten in place (new size and mtime)`);
await step(`${at()} same URL, within the lifetime`, "/asset.txt");
await step(`${at()} new URL (as a renamed file would get)`, "/asset.txt?new-path");
await sleep((LIFE + 1) * 1000);
await step(`${at()} same URL, after the lifetime`, "/asset.txt");
await step(`${at()} same URL, again`, "/asset.txt");
await page.close(); srv.close();
