// M1.4Q first-paint measurement. node fp-measure.mjs <base> <trials> <out.json> [conditions=cold,warm,warmcache]
// cold       a new Chrome (fresh profile, empty HTTP and code caches) per trial; the route is its first navigation
// warm       one Chrome per route; about:blank, clear the HTTP cache, then the route (code cache can stay warm in V8 isolate? no: new renderer per navigation)
// warmcache  as warm, but the HTTP cache is kept (a repeat visit)
// Times are ms from the document's navigation start (performance.timeOrigin), except launchMs (Chrome start to DevTools ready).
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";

const [BASE = "http://localhost:3100", TRIALS = "7", OUT = "fp-results.json", CONDS = "cold,warm,warmcache"] = process.argv.slice(2);
const ROUTES = [
  ["404", "/m14q-not-a-page"],
  ["home", "/"],
  ["cinematic", "/lab-v2"],
  ["lite", "/lab-v2?render=lite"],
  ["project", "/lab-v2/projects/sqlorbit"],
];

const OBSERVE = `(() => {
  const fp = (window.__fp = { lcp: [], longtasks: [], hydrStart: null, hydrLink: null });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fp.lcp.push({ t: e.startTime, size: e.size, tag: e.element?.tagName ?? null, text: (e.element?.textContent ?? "").trim().slice(0, 30), url: e.url ? e.url.replace(location.origin, "") : "", }); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fp.longtasks.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: "longtask", buffered: true }); } catch {}
  // Hydration proxies: hydrateRoot marks its container (the document) first; React then claims each server node (fiber key).
  const poll = () => {
    if (fp.hydrStart === null && Object.keys(document).some((k) => k.startsWith("__reactContainer"))) fp.hydrStart = performance.now();
    const a = document.querySelector("a[href]");
    if (fp.hydrLink === null && a && Object.keys(a).some((k) => k.startsWith("__reactFiber"))) fp.hydrLink = performance.now();
    if (fp.hydrLink === null && performance.now() < 15000) setTimeout(poll, 5);
  };
  poll();
})()`;

const COLLECT = `(() => {
  const nav = performance.getEntriesByType("navigation")[0];
  const paint = Object.fromEntries(performance.getEntriesByType("paint").map((p) => [p.name, p.startTime]));
  const res = performance.getEntriesByType("resource");
  const kind = (r) => /\\.css(\\?|$)/.test(r.name) ? "css" : /\\.woff2?(\\?|$)/.test(r.name) ? "font" : /\\.js(\\?|$)/.test(r.name) ? "js" : /\\.(png|webp|jpe?g|avif|svg)(\\?|$)|_next\\/image/.test(r.name) ? "img" : "other";
  const by = {};
  for (const r of res) { const k = kind(r); (by[k] ??= { n: 0, bytes: 0, firstEnd: Infinity, lastEnd: 0 }); const b = by[k]; b.n++; b.bytes += r.transferSize || r.encodedBodySize || 0; b.firstEnd = Math.min(b.firstEnd, r.responseEnd); b.lastEnd = Math.max(b.lastEnd, r.responseEnd); }
  for (const b of Object.values(by)) { b.firstEnd = Math.round(b.firstEnd); b.lastEnd = Math.round(b.lastEnd); }
  const fp = window.__fp;
  const lcp = fp.lcp.at(-1) ?? null;
  const r = (x) => (x == null ? null : Math.round(x));
  const preFcpLong = fp.longtasks.filter(([s]) => s < (paint["first-contentful-paint"] ?? 0));
  return {
    responseStart: r(nav.responseStart), responseEnd: r(nav.responseEnd), domInteractive: r(nav.domInteractive),
    dcl: r(nav.domContentLoadedEventEnd), load: r(nav.loadEventEnd), htmlBytes: nav.transferSize || nav.encodedBodySize,
    fp: r(paint["first-paint"]), fcp: r(paint["first-contentful-paint"]), lcp: r(lcp?.t), lcpEl: lcp ? (lcp.url || lcp.tag + ":" + lcp.text) : null, lcpCandidates: fp.lcp.length,
    hydrStart: r(fp.hydrStart), hydrLink: r(fp.hydrLink),
    longtasks: fp.longtasks, preFcpLongMs: preFcpLong.reduce((s, [, d]) => s + d, 0),
    res: by, domNodes: document.getElementsByTagName("*").length,
  };
})()`;

async function measureOne(page, url, { clearCache }) {
  await page.send("Page.enable");
  await page.send("Network.enable");
  const blank = new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
  await page.send("Page.navigate", { url: "about:blank" });
  await blank;
  if (clearCache) await page.send("Network.clearBrowserCache");
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
  const loaded = new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
  await page.send("Page.navigate", { url });
  await loaded;
  await sleep(2500); // let LCP settle and hydration finish
  const out = await page.eval(COLLECT);
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  return out;
}

const env = {};
const results = [];
const conds = CONDS.split(",");
for (const cond of conds) {
  for (const [name, path] of ROUTES) {
    if (cond === "cold") {
      for (let i = 0; i < Number(TRIALS); i++) {
        const t0 = performance.now();
        const page = await launch({ width: 1648, height: 928 });
        const launchMs = Math.round(performance.now() - t0);
        try {
          if (!env.ua) {
            env.ua = await page.eval("navigator.userAgent");
            env.gl = await page.eval(`(() => { const c = document.createElement("canvas").getContext("webgl"); const d = c && c.getExtension("WEBGL_debug_renderer_info"); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : "none"; })()`);
          }
          const m = await measureOne(page, BASE + path, { clearCache: false });
          results.push({ cond, route: name, trial: i, launchMs, ...m });
          console.log(cond, name, i, `launch ${launchMs}`, `fcp ${m.fcp}`, `lcp ${m.lcp}`, `hydr ${m.hydrLink}`, m.lcpEl);
        } finally {
          await page.close();
        }
      }
    } else {
      const page = await launch({ width: 1648, height: 928 });
      try {
        // one discarded warm-up visit of the route, so the browser, GPU process and server are all warm
        await measureOne(page, BASE + path, { clearCache: true });
        for (let i = 0; i < Number(TRIALS); i++) {
          const m = await measureOne(page, BASE + path, { clearCache: cond === "warm" });
          results.push({ cond, route: name, trial: i, ...m });
          console.log(cond, name, i, `fcp ${m.fcp}`, `lcp ${m.lcp}`, `hydr ${m.hydrLink}`, m.lcpEl);
        }
      } finally {
        await page.close();
      }
    }
  }
}
writeFileSync(OUT, JSON.stringify({ env, base: BASE, trials: Number(TRIALS), results }, null, 1));
console.log("env", env);
