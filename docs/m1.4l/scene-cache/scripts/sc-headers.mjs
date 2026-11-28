// M1.4R.2: response headers of representative URLs. node sc-headers.mjs <out.json> <label=base,...>
// Plain GET, then a conditional GET with the returned ETag (with an explicit "Cache-Control: max-age=0": fetch()
// otherwise adds "no-cache" to any request carrying If-None-Match, which makes the server answer 200), HEAD and a Range request for the scene files.
import { writeFileSync } from "node:fs";

const [OUT, SERVERS_ARG] = process.argv.slice(2);
const SERVERS = SERVERS_ARG.split(",").map((s) => { const [label, base] = s.split("="); return { label, base }; });
const URLS = {
  "scene/v2 (Cinematic)": ["/scene/v2/environment/lab-background.png", "/scene/v2/connections/creative-studio.png", "/scene/v2/m14i2/m14h1-engineering-strip-light.png", "/scene/v2/stations/playground.png"],
  "scene/v2 edge cases": ["/scene/v2/does-not-exist.png", "/scene/v2", "/scene/v2/", "/scene/V2/stations/playground.png", "/scene/v2x/a.png", "/scene/v2/stations/playground.png?v=1"],
  "other /scene folders": ["/scene/activation/core.png", "/scene/layers25d/environment-corrections.png", "/scene/lab-plate.webp"],
  "Static Lite": ["/scene/static-lite/plate.webp", "/scene/static-lite/on-creative.webp"],
  "hashed Next.js assets": [], // filled from the /lab-v2 HTML
  "HTML": ["/", "/lab-v2", "/lab-v2?render=lite", "/lab-v2?station=experience", "/lab-v2/projects/arimap"],
  "other public files": ["/icon.svg", "/favicon.ico"],
};
const pick = (r) => ({ status: r.status, cacheControl: r.headers.get("cache-control"), etag: r.headers.get("etag") ? (r.headers.get("etag").startsWith("W/") ? "weak" : "strong") : null, lastModified: !!r.headers.get("last-modified") });

const out = {};
for (const { label, base } of SERVERS) {
  const html = await (await fetch(base + "/lab-v2")).text();
  const groups = structuredClone(URLS);
  groups["hashed Next.js assets"] = [...new Set(html.match(/\/_next\/static\/[^"']+\.(?:js|css)/g))].sort((a, b) => (a.endsWith(".css") ? -1 : 1) - (b.endsWith(".css") ? -1 : 1)).slice(0, 3);
  out[label] = {};
  for (const [group, urls] of Object.entries(groups)) {
    out[label][group] = {};
    for (const u of urls) {
      const r = await fetch(base + u, { redirect: "manual" });
      await r.arrayBuffer();
      const row = pick(r);
      if (u.startsWith("/scene/") && r.status === 200) {
        const etag = r.headers.get("etag");
        const c = await fetch(base + u, { headers: { "If-None-Match": etag, "Cache-Control": "max-age=0" } }); await c.arrayBuffer();
        const h = await fetch(base + u, { method: "HEAD" });
        const g = await fetch(base + u, { headers: { Range: "bytes=0-99" } }); await g.arrayBuffer();
        Object.assign(row, { conditional: pick(c), head: pick(h), range: pick(g) });
      }
      out[label][group][u] = row;
    }
  }
}
writeFileSync(OUT, JSON.stringify({ collectedAt: new Date().toISOString(), servers: out }, null, 1));
for (const [label, groups] of Object.entries(out)) for (const [g, rows] of Object.entries(groups)) for (const [u, r] of Object.entries(rows))
  console.log(`${label.padEnd(10)} ${g.padEnd(22)} ${u.padEnd(52)} ${r.status} ${r.cacheControl ?? "(none)"}${r.conditional ? `  | 304: ${r.conditional.status} ${r.conditional.cacheControl}  HEAD: ${r.head.cacheControl}  206: ${r.range.status} ${r.range.cacheControl}` : ""}`);
