// M1.4R.2: Cinematic scene delivery against the real production servers, no proxy.
//   node sc-measure.mjs <out.json> <trials> <label=base,...> [visits] [nets]
//   e.g. node sc-measure.mjs delivery.json 7 baseline=http://localhost:3103,prototype=http://localhost:3100
// Same method as ../../scene-delivery/scripts/sd-measure.mjs (M1.4R.1), minus its local proxy:
// - one Chrome with a fresh profile per cell, warmed by one unthrottled visit, so every trial has the same warm GPU state
// - before each measured visit the tab goes to another site (127.0.0.1), forcing a new renderer process, so only the
//   HTTP disk cache can help (memory-cache hits are counted to confirm it)
//   initial  HTTP cache cleared before the visit
//   repeat   HTTP cache cleared, one priming visit (unthrottled), then the measured visit
// - cells are interleaved: for each network and visit type, every server in turn
// Console errors, warnings and uncaught exceptions are recorded per trial.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../first-paint/scripts/cdp2.mjs";

const [OUT, TRIALS = "7", SERVERS_ARG, VISITS_ARG = "initial,repeat", NETS_ARG = "50-20,12-70"] = process.argv.slice(2);
const SERVERS = SERVERS_ARG.split(",").map((s) => { const [label, base] = s.split("="); return { label, base }; });
const ROUTE = "/lab-v2";

const POLL = `(() => {
  const s = (window.__sd = { gateFirst: null, gateFull: null, gateStyle: null });
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === "STYLE" && /lab-plate-gate\\{opacity:1\\}/.test(n.textContent) && s.gateStyle === null) s.gateStyle = performance.now(); }).observe(document, { childList: true, subtree: true });
  const tick = () => {
    const g = [...document.querySelectorAll(".lab-plate-gate")];
    if (g.length) { const o = Math.max(...g.map((e) => Number(getComputedStyle(e).opacity))); if (o > 0.01 && s.gateFirst === null) s.gateFirst = performance.now(); if (o >= 0.99 && s.gateFull === null) s.gateFull = performance.now(); }
    if (performance.now() < 15000 && s.gateFull === null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})()`;
const COLLECT = `(() => { const p = Object.fromEntries(performance.getEntriesByType("paint").map((x) => [x.name, x.startTime])); const n = performance.getEntriesByType("navigation")[0]; const r = (x) => x == null ? null : Math.round(x);
  return { fcp: r(p["first-contentful-paint"]), load: r(n.loadEventEnd), gateStyle: r(window.__sd.gateStyle), gateFirst: r(window.__sd.gateFirst), gateFull: r(window.__sd.gateFull) }; })()`;

const loadOf = (page) => new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
async function go(page, url) { const l = loadOf(page); await page.send("Page.navigate", { url }); await l; }
const NO_THROTTLE = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
const net = (s) => { const [mbps, rtt] = s.split("-").map(Number); return { offline: false, latency: rtt, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (mbps * 1e6) / 8 }; };

async function measured(page, url, conditions) {
  const reqs = new Map(); const extra = new Map(); const errors = [];
  const off = page.on((m) => {
    const p = m.params;
    if (m.method === "Network.requestWillBeSent") reqs.set(p.requestId, { url: p.request.url, ts: p.timestamp, type: p.type });
    if (m.method === "Network.requestServedFromCache") { const r = reqs.get(p.requestId); if (r) r.memory = true; }
    if (m.method === "Network.responseReceivedExtraInfo") extra.set(p.requestId, p.statusCode);
    if (m.method === "Network.responseReceived") { const r = reqs.get(p.requestId); if (r) { r.status = p.response.status; r.disk = !!p.response.fromDiskCache; r.memory = r.memory || !!p.response.fromMemoryCache; r.cc = p.response.headers["cache-control"] ?? p.response.headers["Cache-Control"] ?? null; } }
    if (m.method === "Network.loadingFinished") { const r = reqs.get(p.requestId); if (r) { r.bytes = p.encodedDataLength; r.end = p.timestamp; } }
    if (m.method === "Network.loadingFailed") { const r = reqs.get(p.requestId); if (r) r.failed = p.errorText; }
    if (m.method === "Runtime.exceptionThrown") errors.push(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`.slice(0, 300));
    if (m.method === "Runtime.consoleAPICalled" && (p.type === "error" || p.type === "warning")) errors.push(`console.${p.type}: ${p.args.map((a) => a.value ?? a.description ?? "").join(" ")}`.slice(0, 300));
    if (m.method === "Log.entryAdded" && (p.entry.level === "error" || p.entry.level === "warning")) errors.push(`log.${p.entry.level}: ${p.entry.text} ${p.entry.url ?? ""}`.slice(0, 300));
  });
  await page.send("Network.emulateNetworkConditions", conditions);
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: POLL });
  await go(page, url);
  for (let t = 0; t < 12000; t += 200) { const s = await page.eval("window.__sd && window.__sd.gateFull !== null").catch(() => false); if (s) break; await sleep(200); }
  await sleep(1200);
  const m = await page.eval(COLLECT);
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  await page.send("Network.emulateNetworkConditions", NO_THROTTLE);
  off();
  const doc = [...reqs.values()].find((r) => r.type === "Document" && r.url.startsWith(url.split("?")[0]));
  const t0 = doc?.ts ?? 0;
  const rel = (ts) => (ts ? Math.round((ts - t0) * 1000) : null);
  const scene = [...reqs.entries()].filter(([, r]) => new URL(r.url).pathname.startsWith("/scene/")).map(([id, r]) => ({ ...r, wire: extra.get(id) ?? null }));
  const v2 = scene.filter((r) => new URL(r.url).pathname.startsWith("/scene/v2/"));
  const network = (xs) => xs.filter((r) => !r.disk && !r.memory);
  const lastEnd = Math.max(...scene.map((r) => rel(r.end) ?? 0));
  return {
    ...m,
    sceneVisible: m.gateFirst, sceneFull: m.gateFull,
    sceneRequests: scene.length, v2Requests: v2.length,
    diskHits: scene.filter((r) => r.disk).length, memoryHits: scene.filter((r) => r.memory).length,
    revalidated304: network(scene).filter((r) => r.wire === 304).length, downloaded200: network(scene).filter((r) => r.wire === 200).length,
    v2Revalidated304: network(v2).filter((r) => r.wire === 304).length, v2Downloaded200: network(v2).filter((r) => r.wire === 200).length, v2DiskHits: v2.filter((r) => r.disk).length,
    networkBytes: network(scene).reduce((s, r) => s + (r.bytes ?? 0), 0),
    v2CacheControl: [...new Set(v2.map((r) => r.cc))],
    failed: scene.filter((r) => r.failed).length,
    imageDeliveryEnd: lastEnd,
    sceneReady: Math.max(lastEnd, m.gateFull ?? 0),
    errors,
  };
}

const results = [];
for (const nets of NETS_ARG.split(",")) for (const visit of VISITS_ARG.split(",")) for (const { label, base } of SERVERS) {
  const url = base + ROUTE;
  const other = base.replace("localhost", "127.0.0.1") + "/favicon.ico";
  const page = await launch();
  try {
    await page.send("Page.enable"); await page.send("Network.enable"); await page.send("Runtime.enable"); await page.send("Log.enable");
    await go(page, url); await sleep(2000); // warm-up: GPU pipelines for this route, unthrottled, discarded
    for (let i = 0; i < Number(TRIALS); i++) {
      await go(page, other);
      await page.send("Network.clearBrowserCache");
      if (visit === "repeat") { await go(page, url); await sleep(1500); await go(page, other); }
      const r = await measured(page, url, net(nets));
      results.push({ server: label, net: nets, visit, trial: i, ...r });
      console.log(label, nets, visit, i, JSON.stringify({ fcp: r.fcp, vis: r.sceneVisible, full: r.sceneFull, ready: r.sceneReady, req: r.sceneRequests, disk: r.diskHits, mem: r.memoryHits, r304: r.revalidated304, d200: r.downloaded200, KB: Math.round(r.networkBytes / 1024), err: r.errors.length }));
    }
  } finally { await page.close(); }
}
writeFileSync(OUT, JSON.stringify({ servers: SERVERS.map((s) => s.label), route: ROUTE, trials: Number(TRIALS), proxied: false, collectedAt: new Date().toISOString(), results }, null, 1));
