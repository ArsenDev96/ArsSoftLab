// M1.4Q: one traced navigation. node fp-trace.mjs <base> <route> <cold|warm> <out-prefix> [extra chrome flag e.g. --disable-gpu]
// Writes <out-prefix>.json.gz (DevTools-loadable trace) and <out-prefix>.summary.json.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";

const [BASE, ROUTE, COND, OUT] = process.argv.slice(2);
const CATS = [
  "toplevel", "devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame",
  "loading", "blink.user_timing", "v8.execute", "gpu", "viz", "cc", "benchmark", "disabled-by-default-devtools.screenshot", "navigation", "browser",
];

const page = await launch({ width: 1648, height: 928 });
await page.send("Page.enable");
const loadOf = () => new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
if (COND === "warm") {
  // the same route once, discarded; then about:blank and an empty HTTP cache
  let l = loadOf(); await page.send("Page.navigate", { url: BASE + ROUTE }); await l; await sleep(1500);
  l = loadOf(); await page.send("Page.navigate", { url: "about:blank" }); await l;
  await page.send("Network.enable"); await page.send("Network.clearBrowserCache");
}
await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: CATS, excludedCategories: ["*"] } });
await sleep(300);
const l = loadOf();
await page.send("Page.navigate", { url: BASE + ROUTE });
await l;
await sleep(2500);
const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
await page.send("Tracing.end");
const h = await done;
const chunks = [];
for (;;) { const x = await page.send("IO.read", { handle: h, size: 1 << 20 }); chunks.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "utf8")); if (x.eof) break; }
await page.close();
const raw = Buffer.concat(chunks);
writeFileSync(`${OUT}.json.gz`, gzipSync(raw));

// ---------- summary ----------
const parsed = JSON.parse(raw.toString("utf8"));
const ev = parsed.traceEvents ?? parsed;
const tn = {}, pn = {};
for (const e of ev) if (e.ph === "M") { if (e.name === "thread_name") tn[`${e.pid}:${e.tid}`] = e.args.name; if (e.name === "process_name") pn[e.pid] = e.args.name; }
const fcpEv = ev.filter((e) => e.name === "firstContentfulPaint").at(-1);
const navEv = ev.filter((e) => e.name === "navigationStart" && e.pid === fcpEv?.pid && e.args?.data?.documentLoaderURL?.startsWith("http")).at(-1)
  ?? ev.filter((e) => e.name === "navigationStart" && e.pid === fcpEv?.pid).at(-1);
const t0 = navEv.ts, tF = fcpEv.ts;
const ms = (ts) => Math.round((ts - t0) / 100) / 10;
const mark = (name) => { const e = ev.filter((x) => x.name === name && x.pid === fcpEv.pid && x.ts >= t0).sort((a, b) => a.ts - b.ts)[0]; return e ? ms(e.ts) : null; };
const milestones = {
  fcp: ms(tF),
  firstPaintEvent: mark("firstPaint"),
  responseStart: (() => { const e = ev.find((x) => x.name === "ResourceReceiveResponse" && x.ts >= t0); return e ? ms(e.ts) : null; })(),
  domContentLoaded: mark("domContentLoadedEventEnd"),
  load: mark("loadEventEnd"),
  lcpCandidates: ev.filter((e) => e.name === "largestContentfulPaint::Candidate" && e.pid === fcpEv.pid).map((e) => ms(e.ts)),
};

// Self time per (process, thread, event name) for complete events in [t0, tF] (nesting resolved per thread).
function selfTimes(from, to) {
  const byThread = new Map();
  for (const e of ev) {
    if (e.ph !== "X" || !e.dur || e.ts < from || e.ts > to) continue;
    const k = `${e.pid}:${e.tid}`;
    (byThread.get(k) ?? byThread.set(k, []).get(k)).push(e);
  }
  const out = {};
  for (const [k, list] of byThread) {
    list.sort((a, b) => a.ts - b.ts || b.dur - a.dur);
    const stack = [];
    const self = new Map();
    for (const e of list) {
      while (stack.length && stack.at(-1).ts + stack.at(-1).dur <= e.ts) stack.pop();
      const end = Math.min(e.ts + e.dur, to);
      const d = Math.max(0, end - e.ts);
      self.set(e, (self.get(e) ?? 0) + d);
      if (stack.length) { const p = stack.at(-1); self.set(p, (self.get(p) ?? 0) - Math.min(d, p.ts + p.dur - e.ts)); }
      stack.push(e);
    }
    const thread = `${pn[k.split(":")[0]] ?? "?"}/${tn[k] ?? k}${k.split(":")[0] == fcpEv.pid ? " (page renderer)" : ""}`;
    for (const [e, d] of self) { if (d <= 0) continue; const key = `${thread} :: ${e.name}`; out[key] = (out[key] ?? 0) + d / 1000; }
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 3).slice(0, 40).map(([k, v]) => [k, Math.round(v * 10) / 10]);
}
// Busy time per thread in the window (top-level events only).
function busy(from, to) {
  const out = {};
  for (const e of ev) {
    if (e.ph !== "X" || !e.dur || e.ts + e.dur < from || e.ts > to) continue;
    if (!["ThreadControllerImpl::RunTask", "RunTask", "ThreadPool_RunTask"].includes(e.name)) continue;
    const k = `${pn[e.pid] ?? "?"}/${tn[`${e.pid}:${e.tid}`] ?? e.tid}${e.pid === fcpEv.pid ? " (page renderer)" : ""}`;
    out[k] = (out[k] ?? 0) + (Math.min(e.ts + e.dur, to) - Math.max(e.ts, from)) / 1000;
  }
  return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, v]) => [k, Math.round(v)]);
}
// Frames: the page renderer's compositor frame pipeline before FCP.
const frameEvents = ev.filter((e) => e.pid === fcpEv.pid && ["BeginFrame", "BeginMainThreadFrame", "Commit", "ActivateLayerTree", "DrawFrame", "NeedsBeginFrameChanged", "RasterTask", "ImageDecodeTask", "Decode Image"].includes(e.name) && e.ts >= t0 && e.ts <= tF + 200000);
const firstOf = (n) => { const e = frameEvents.filter((x) => x.name === n).sort((a, b) => a.ts - b.ts)[0]; return e ? ms(e.ts) : null; };
const count = (n, upTo = tF) => frameEvents.filter((x) => x.name === n && x.ts <= upTo).length;
const sumDur = (n) => Math.round(frameEvents.filter((x) => x.name === n && x.ts <= tF).reduce((s, x) => s + (x.dur ?? 0), 0) / 1000);
const pipeline = {
  firstBeginMainThreadFrame: firstOf("BeginMainThreadFrame"), firstCommit: firstOf("Commit"), firstActivate: firstOf("ActivateLayerTree"), firstDrawFrame: firstOf("DrawFrame"),
  commitsBeforeFcp: count("Commit"), rasterTasksBeforeFcp: count("RasterTask"), rasterMsBeforeFcp: sumDur("RasterTask"),
  imageDecodeTasksBeforeFcp: count("ImageDecodeTask"), imageDecodeMsBeforeFcp: sumDur("ImageDecodeTask"), decodeImageMsBeforeFcp: sumDur("Decode Image"),
};
// Screenshots (for visual milestones, analysed separately)
const shots = ev.filter((e) => e.name === "Screenshot" && e.ts >= t0).map((e) => ({ t: ms(e.ts), id: e.id, data: e.args.snapshot }));
const summary = { route: ROUTE, cond: COND, milestones, pipeline, busyBeforeFcp: busy(t0, tF), selfBeforeFcp: selfTimes(t0, tF), shots: shots.length };
writeFileSync(`${OUT}.summary.json`, JSON.stringify(summary, null, 1));
writeFileSync(`${OUT}.shots.json`, JSON.stringify(shots));
console.log(JSON.stringify({ route: ROUTE, cond: COND, milestones, pipeline }, null, 0));
