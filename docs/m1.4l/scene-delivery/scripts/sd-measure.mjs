// M1.4R.1: scene delivery under emulated networks. node sd-measure.mjs <base> <trials> <out.json> [routes] [visits] [nets]
//   routes: cinematic,lite        visits: initial,repeat,repeat-fresh        nets: 50-20,12-70 (Mbps-RTTms)
// One Chrome (fresh profile) per cell, warmed by one unthrottled visit of the route, so every trial has the same warm
// GPU state; only the network and HTTP cache differ.
//   initial       HTTP cache cleared before the visit
//   repeat        a priming visit (current server headers), then the measured visit: HTTP disk cache as left by it
//   repeat-fresh  as repeat, but served through a TEST-ONLY local proxy that rewrites "Cache-Control" on /scene/*
//                 responses to "public, max-age=86400" (emulates any fresh-cache option within its lifetime, as a CDN
//                 or proxy header rule would; the app, its files and config are untouched)
// Every cell goes through a local proxy, so all cells share the same path: port P_PASS passes headers unchanged,
// port P_FRESH rewrites /scene/* Cache-Control. (DevTools Fetch interception was tried first: Chrome's HTTP cache keeps
// the original headers, so it does not emulate a header change.)
// Before each measured visit the tab goes to another site (127.0.0.1), so the visit gets a new renderer process: no
// in-memory image cache, only the HTTP disk cache. Memory-cache hits are counted to confirm it.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../first-paint/scripts/cdp2.mjs";

const [BASE, TRIALS = "7", OUT, ROUTES_ARG = "cinematic,lite", VISITS_ARG = "initial,repeat,repeat-fresh", NETS_ARG = "50-20,12-70"] = process.argv.slice(2);
const ROUTES = { cinematic: "/lab-v2", lite: "/lab-v2?render=lite", home: "/" };
const OTHER_SITE = BASE.replace("localhost", "127.0.0.1") + "/favicon.ico";

const POLL = `(() => {
  const s = (window.__sd = { gateFirst: null, gateFull: null, plate: null, gateStyle: null });
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === "STYLE" && /lab-plate-gate\\{opacity:1\\}/.test(n.textContent) && s.gateStyle === null) s.gateStyle = performance.now(); }).observe(document, { childList: true, subtree: true });
  const tick = () => {
    const g = [...document.querySelectorAll(".lab-plate-gate")];
    if (g.length) { const o = Math.max(...g.map((e) => Number(getComputedStyle(e).opacity))); if (o > 0.01 && s.gateFirst === null) s.gateFirst = performance.now(); if (o >= 0.99 && s.gateFull === null) s.gateFull = performance.now(); }
    const p = document.querySelector('img[src*="static-lite/plate"]');
    if (p && p.complete && p.naturalWidth > 0 && s.plate === null) s.plate = performance.now();
    if (performance.now() < 15000 && (s.gateFull === null || (document.querySelector('img[src*="static-lite/plate"]') && s.plate === null))) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;
const COLLECT = `(() => { const p = Object.fromEntries(performance.getEntriesByType("paint").map((x) => [x.name, x.startTime])); const n = performance.getEntriesByType("navigation")[0]; const r = (x) => x == null ? null : Math.round(x);
  return { fcp: r(p["first-contentful-paint"]), load: r(n.loadEventEnd), gateStyle: r(window.__sd.gateStyle), gateFirst: r(window.__sd.gateFirst), gateFull: r(window.__sd.gateFull), plate: r(window.__sd.plate), timeOrigin: performance.timeOrigin }; })()`;

const loadOf = (page) => new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
async function go(page, url) { const l = loadOf(page); await page.send("Page.navigate", { url }); await l; }
const NO_THROTTLE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const net = (s) => { const [mbps, rtt] = s.split("-").map(Number); return { offline: false, latency: rtt, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (mbps * 1e6) / 8 }; };

async function prime(page, url, fresh) {
  let off = null;
  if (fresh) {
    await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/scene/*", requestStage: "Response" }] });
    off = page.on(async (m) => {
      if (m.method !== "Fetch.requestPaused") return;
      const p = m.params;
      const headers = (p.responseHeaders ?? []).filter((h) => h.name.toLowerCase() !== "cache-control").concat([{ name: "Cache-Control", value: "public, max-age=86400" }]);
      try { await page.send("Fetch.continueResponse", { requestId: p.requestId, responseCode: p.responseStatusCode, responseHeaders: headers }); }
      catch { const b = await page.send("Fetch.getResponseBody", { requestId: p.requestId }); await page.send("Fetch.fulfillRequest", { requestId: p.requestId, responseCode: p.responseStatusCode, responseHeaders: headers, body: b.base64Encoded ? b.body : Buffer.from(b.body).toString("base64") }); }
    });
  }
  await go(page, url);
  await sleep(1500);
  if (fresh) { off(); await page.send("Fetch.disable"); }
}

async function measured(page, url, conditions) {
  // network log for this visit only
  const reqs = new Map(); const extra = new Map();
  const off = page.on((m) => {
    const p = m.params;
    if (m.method === "Network.requestWillBeSent") reqs.set(p.requestId, { url: p.request.url, ts: p.timestamp, type: p.type });
    if (m.method === "Network.requestServedFromCache") { const r = reqs.get(p.requestId); if (r) r.memory = true; }
    if (m.method === "Network.responseReceivedExtraInfo") extra.set(p.requestId, p.statusCode);
    if (m.method === "Network.responseReceived") { const r = reqs.get(p.requestId); if (r) { r.status = p.response.status; r.disk = !!p.response.fromDiskCache; r.memory = r.memory || !!p.response.fromMemoryCache; } }
    if (m.method === "Network.loadingFinished") { const r = reqs.get(p.requestId); if (r) { r.bytes = p.encodedDataLength; r.end = p.timestamp; } }
  });
  await page.send("Network.emulateNetworkConditions", conditions);
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: POLL });
  await go(page, url);
  // wait for the gate to finish fading (Cinematic) or the plate (Lite), then a little longer; cap at 12 s
  for (let t = 0; t < 12000; t += 200) { const s = await page.eval("window.__sd && (window.__sd.gateFull !== null || window.__sd.plate !== null)").catch(() => false); if (s) break; await sleep(200); }
  await sleep(1200);
  const m = await page.eval(COLLECT);
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  await page.send("Network.emulateNetworkConditions", NO_THROTTLE);
  off();
  const doc = [...reqs.values()].find((r) => r.type === "Document" && r.url.startsWith(url.split("?")[0]));
  const t0 = doc?.ts ?? 0;
  const scene = [...reqs.entries()].filter(([, r]) => new URL(r.url).pathname.startsWith("/scene/")).map(([id, r]) => ({ ...r, wire: extra.get(id) ?? null }));
  const rel = (ts) => (ts ? Math.round((ts - t0) * 1000) : null);
  const network = scene.filter((r) => !r.disk && !r.memory);
  const lastEnd = Math.max(...scene.map((r) => rel(r.end) ?? 0));
  return {
    ...m,
    sceneVisible: m.gateFirst ?? m.plate, sceneFull: m.gateFull ?? m.plate,
    sceneRequests: scene.length,
    diskHits: scene.filter((r) => r.disk).length, memoryHits: scene.filter((r) => r.memory).length,
    revalidated304: network.filter((r) => r.wire === 304).length, downloaded200: network.filter((r) => r.wire === 200).length,
    networkBytes: network.reduce((s, r) => s + (r.bytes ?? 0), 0),
    imageDeliveryEnd: lastEnd,
    sceneReady: Math.max(lastEnd, m.gateFull ?? m.plate ?? 0),
  };
}

import http from "node:http";
const UP = new URL(BASE);
const agent = new http.Agent({ keepAlive: true });
function proxy(port, rewrite) {
  const srv = http.createServer((req, res) => {
    const up = http.request({ host: UP.hostname, port: UP.port, path: req.url, method: req.method, headers: { ...req.headers, host: UP.host }, agent }, (ur) => {
      const h = { ...ur.headers };
      if (rewrite && req.url.startsWith("/scene/")) h["cache-control"] = "public, max-age=86400";
      res.writeHead(ur.statusCode, h); ur.pipe(res);
    });
    up.on("error", () => { res.writeHead(502); res.end(); });
    req.pipe(up);
  });
  return new Promise((ok) => srv.listen(port, "localhost", () => ok(srv)));
}
const P_PASS = 3101, P_FRESH = 3102;
const servers = [await proxy(P_PASS, false), await proxy(P_FRESH, true)];
const results = [];
for (const route of ROUTES_ARG.split(",")) for (const nets of NETS_ARG.split(",")) for (const visit of VISITS_ARG.split(",")) {
  const url = `http://localhost:${visit === "repeat-fresh" ? P_FRESH : P_PASS}` + ROUTES[route];
  const page = await launch();
  try {
    await page.send("Page.enable"); await page.send("Network.enable");
    await go(page, url); await sleep(2000); // warm-up: GPU pipelines for this route, unthrottled, discarded
    for (let i = 0; i < Number(TRIALS); i++) {
      await go(page, OTHER_SITE);
      await page.send("Network.clearBrowserCache");
      if (visit !== "initial") { await prime(page, url, false); await go(page, OTHER_SITE); }
      const r = await measured(page, url, net(nets));
      results.push({ route, net: nets, visit, trial: i, ...r });
      console.log(route, nets, visit, i, JSON.stringify({ fcp: r.fcp, vis: r.sceneVisible, full: r.sceneFull, ready: r.sceneReady, req: r.sceneRequests, disk: r.diskHits, mem: r.memoryHits, r304: r.revalidated304, d200: r.downloaded200, KB: Math.round(r.networkBytes / 1024), deliv: r.imageDeliveryEnd }));
    }
  } finally { await page.close(); }
}
servers.forEach((x) => x.close()); agent.destroy();
writeFileSync(OUT, JSON.stringify({ base: BASE, proxied: true, trials: Number(TRIALS), collectedAt: new Date().toISOString(), results }, null, 1));
