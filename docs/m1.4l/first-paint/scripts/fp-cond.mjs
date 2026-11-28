// M1.4Q controlled conditions. node fp-cond.mjs <base> <trials> <out.json> <conds> [routes]
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launch, sleep } from "./cdp2.mjs";

const [BASE, TRIALS, OUT, CONDS, ROUTES_ARG] = process.argv.slice(2);
const ALL = { "404": "/m14q-not-a-page", home: "/", cinematic: "/lab-v2", lite: "/lab-v2?render=lite", project: "/lab-v2/projects/sqlorbit" };
const ROUTES = (ROUTES_ARG ?? Object.keys(ALL).join(",")).split(",").map((k) => [k, ALL[k]]);
const NEUTRAL = "data:text/html,<!doctype html><title>x</title><body style='background:%23111;color:%23eee;font:20px sans-serif'><p>neutral page</p></body>";

const OBSERVE = `(() => {
  const fp = (window.__fp = { lcp: [], hydrLink: null });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) fp.lcp.push(e.startTime); }).observe({ type: "largest-contentful-paint", buffered: true }); } catch {}
  const poll = () => { const a = document.querySelector("a[href]"); if (a && Object.keys(a).some((k) => k.startsWith("__reactFiber"))) { fp.hydrLink = performance.now(); return; } if (performance.now() < 15000) setTimeout(poll, 5); };
  poll();
})()`;
const COLLECT = `(() => { const n = performance.getEntriesByType("navigation")[0]; const p = Object.fromEntries(performance.getEntriesByType("paint").map((x) => [x.name, x.startTime])); const r = (x) => x == null ? null : Math.round(x);
  return { responseEnd: r(n.responseEnd), dcl: r(n.domContentLoadedEventEnd), load: r(n.loadEventEnd), fcp: r(p["first-contentful-paint"]), lcp: r(window.__fp.lcp.at(-1)), hydrLink: r(window.__fp.hydrLink) }; })()`;

const loadOf = (page) => new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
async function go(page, url) { const l = loadOf(page); await page.send("Page.navigate", { url }); await l; }
async function measure(page, url) {
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", { source: OBSERVE });
  await go(page, url);
  await sleep(2000);
  const m = await page.eval(COLLECT);
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
  return m;
}

const results = [];
for (const cond of CONDS.split(",")) {
  for (const [route, path] of ROUTES) {
    const url = BASE + path;
    const persistent = join(tmpdir(), `m14q-profile-${route}`);
    if (cond === "warm-profile") {
      // prime the persistent profile once with this route (discarded)
      rmSync(persistent, { recursive: true, force: true });
      const p = await launch({ profileDir: persistent });
      await p.send("Page.enable"); await go(p, url); await sleep(2500); await p.close(); await sleep(500);
    }
    for (let i = 0; i < Number(TRIALS); i++) {
      const opts = {
        cold: {}, "cold-idle": {}, "primed-other": {}, "warm-profile": { profileDir: persistent },
        "cold-ganesh": { extraArgs: ["--disable-features=SkiaGraphite"] }, "cold-swgpu": { extraArgs: ["--disable-gpu"] },
      }[cond];
      const page = await launch(opts);
      try {
        await page.send("Page.enable"); await page.send("Network.enable");
        if (cond === "cold-idle") await sleep(3000);
        if (cond === "primed-other") { await go(page, NEUTRAL); await sleep(1500); }
        if (cond === "warm-profile") await page.send("Network.clearBrowserCache");
        const m = await measure(page, url);
        results.push({ cond, route, trial: i, ...m });
        console.log(cond, route, i, JSON.stringify(m));
      } finally {
        await page.close();
      }
    }
  }
}
writeFileSync(OUT, JSON.stringify({ base: BASE, results }, null, 1));
