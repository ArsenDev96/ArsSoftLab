// M1.4R.1: scene asset inventory per route. node sd-inventory.mjs <base> <out.json>
// One fresh Chrome per route, no throttling. Dimensions are read from the files' headers in Node, never by loading them in the page. Records every request (CDP Network) and maps each /scene/ asset to how the
// page uses it, and whether a PlateGate script waits for it (same selector logic as components/lab/PlateGate.tsx).
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../first-paint/scripts/cdp2.mjs";

const [BASE = "http://localhost:3100", OUT = "inventory.json"] = process.argv.slice(2);
const ROUTES = { home: "/", cinematic: "/lab-v2", lite: "/lab-v2?render=lite" };
const PAGE_MAP = `(async () => {
  const abs = (u) => u ? new URL(u, location.href).pathname + new URL(u, location.href).search : null;
  const crops = CSS.supports("object-view-box", "none");
  const uses = {};
  const add = (u, how, el) => { if (!u || !u.includes("/scene/")) return; (uses[u] ??= { how: new Set(), inGateLayer: false, gated: false }); uses[u].how.add(how); if (el && el.closest(".lab-plate-gate")) uses[u].inGateLayer = true; };
  document.querySelectorAll("img").forEach((i) => add(abs(i.currentSrc || i.getAttribute("src")), "img", i));
  document.querySelectorAll("image").forEach((i) => { add(abs(i.getAttribute("href")), "svg-image", i); if (i.getAttribute("data-full")) add(abs(i.getAttribute("data-full")), "svg-image data-full (fallback, unused when object-view-box is supported)", i); });
  document.querySelectorAll("link[rel=preload]").forEach((l) => add(abs(l.getAttribute("href")), "preload", null));
  for (const el of document.querySelectorAll("*")) { const bg = getComputedStyle(el).backgroundImage; for (const m of bg.matchAll(/url\\("?([^")]+)"?\\)/g)) add(abs(m[1]), "css-background", el);
    const mk = getComputedStyle(el).maskImage || getComputedStyle(el).webkitMaskImage; if (mk) for (const m of mk.matchAll(/url\\("?([^")]+)"?\\)/g)) add(abs(m[1]), "css-mask", el); }
  // PlateGate: each inline gate script waits for img[data-gate] (and, with svgImages, image[data-gate]) inside its parent.
  const gates = [...document.querySelectorAll("script")].filter((s) => /__labGate=1/.test(s.textContent || ""));
  const gateInfo = gates.map((s) => { const root = s.parentElement; const svg = /image\\[data-gate\\]/.test(s.textContent); const els = [...root.querySelectorAll(svg ? "img[data-gate],image[data-gate]" : "img[data-gate]")];
    const urls = els.map((e) => e instanceof HTMLImageElement ? abs(e.currentSrc || e.getAttribute("src")) : abs(crops ? e.getAttribute("href") : e.getAttribute("data-full")));
    urls.forEach((u) => { (uses[u] ??= { how: new Set(["?"]), inGateLayer: true, gated: false }); uses[u].gated = true; }); return { svgImages: svg, waitsFor: new Set(urls).size }; });
  const dims = {}; // read from the files in Node: an in-page new Image() would itself fetch (M1.4R.1 probe artefact)
  return { gates: gateInfo, objectViewBox: crops, uses: Object.fromEntries(Object.entries(uses).map(([u, v]) => [u, { how: [...v.how], inGateLayer: v.inGateLayer, gated: v.gated, dims: dims[u] ?? null }])),
    rt: Object.fromEntries(performance.getEntriesByType("resource").map((r) => [new URL(r.name).pathname + new URL(r.name).search, { start: Math.round(r.startTime), end: Math.round(r.responseEnd), blocking: r.renderBlockingStatus, initiator: r.initiatorType }])) };
})()`;

import { readFileSync, existsSync } from "node:fs";
const PUBLIC = process.env.PUBLIC_DIR;
function dimsOf(urlPath) {
  const f = PUBLIC + decodeURIComponent(urlPath.split("?")[0]);
  if (!PUBLIC || !existsSync(f)) return null;
  const b = readFileSync(f);
  if (b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    const c = b.toString("ascii", 12, 16);
    if (c === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
    if (c === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
    if (c === "VP8 ") return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  }
  return null;
}
const out = {};
for (const [name, path] of Object.entries(ROUTES)) {
  const page = await launch();
  const reqs = new Map();
  page.on((m) => {
    const p = m.params;
    if (m.method === "Network.requestWillBeSent") reqs.set(p.requestId, { url: p.request.url, type: p.type, priority: p.request.initialPriority });
    if (m.method === "Network.responseReceived") { const r = reqs.get(p.requestId); if (r) { const h = Object.fromEntries(Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v])); Object.assign(r, { status: p.response.status, mime: p.response.mimeType, cacheControl: h["cache-control"] ?? null, etag: h["etag"] ?? null, lastModified: h["last-modified"] ?? null, contentEncoding: h["content-encoding"] ?? null, contentLength: h["content-length"] ? Number(h["content-length"]) : null, protocol: p.response.protocol, fromCache: !!(p.response.fromDiskCache || p.response.fromMemoryCache) }); } }
    if (m.method === "Network.loadingFinished") { const r = reqs.get(p.requestId); if (r) r.transferBytes = p.encodedDataLength; }
  });
  await page.send("Network.enable");
  await page.send("Page.enable");
  const loaded = new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
  await page.send("Page.navigate", { url: BASE + path });
  await loaded;
  await sleep(4500); // past the gate's 4 s fallback, so late requests are included
  const map = await page.eval(PAGE_MAP);
  const requests = [...reqs.values()].filter((r) => r.url.startsWith(BASE)).map((r) => { const u = new URL(r.url); const key = u.pathname + u.search; return { ...r, url: key, dims: key.startsWith("/scene/") ? dimsOf(key) : null, use: map.uses[key] ?? null, rt: map.rt[key] ?? null }; });
  out[name] = { route: path, gates: map.gates, objectViewBox: map.objectViewBox, requests, referencedNotFetched: Object.entries(map.uses).filter(([u]) => !requests.some((r) => r.url === u)).map(([u, v]) => ({ url: u, how: v.how, inGateLayer: v.inGateLayer, gated: v.gated, dims: dimsOf(u), bytes: (() => { try { return readFileSync(PUBLIC + u.split("?")[0]).length; } catch { return null; } })() })) };
  console.log(name, "requests", requests.length, "scene", requests.filter((r) => r.url.startsWith("/scene/")).length, "gates", JSON.stringify(map.gates));
  await page.close();
}
writeFileSync(OUT, JSON.stringify({ base: BASE, collectedAt: new Date().toISOString(), routes: out }, null, 1));
