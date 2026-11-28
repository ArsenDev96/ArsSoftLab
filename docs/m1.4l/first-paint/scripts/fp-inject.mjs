// M1.4Q diagnostic only: FCP in "primed-other" with one class of drawing feature switched off by injected CSS (test browser only).
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp2.mjs";
const [BASE, TRIALS, OUT, ROUTES_ARG] = process.argv.slice(2);
const ALL = { "404": "/m14q-not-a-page", home: "/", cinematic: "/lab-v2", lite: "/lab-v2?render=lite", project: "/lab-v2/projects/sqlorbit" };
const NEUTRAL = "data:text/html,<!doctype html><body style='background:%23111;color:%23eee;font:20px sans-serif'><p>neutral page</p></body>";
const VARIANTS = {
  baseline: "",
  "no-images": "img,image,svg image{visibility:hidden!important} *{background-image:none!important}",
  "no-filters-shadows": "*,*::before,*::after{filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;text-shadow:none!important}",
  "no-blend-masks": "*,*::before,*::after{mix-blend-mode:normal!important;mask:none!important;-webkit-mask:none!important}",
  "no-gradients": "*,*::before,*::after{background-image:none!important}",
};
const inject = (css) => `(() => { window.__fp = { lcp: [] }; if (!${JSON.stringify(css)}) return; const add = () => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(css)}; document.documentElement.appendChild(s); }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); })()`;
const loadOf = (p) => new Promise((ok) => { const off = p.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
const go = async (p, u) => { const l = loadOf(p); await p.send("Page.navigate", { url: u }); await l; };
const results = [];
for (const route of ROUTES_ARG.split(",")) for (const [v, css] of Object.entries(VARIANTS)) for (let i = 0; i < Number(TRIALS); i++) {
  const page = await launch();
  try {
    await page.send("Page.enable"); await go(page, NEUTRAL); await sleep(1500);
    await page.send("Page.addScriptToEvaluateOnNewDocument", { source: inject(css) });
    await go(page, BASE + ALL[route]); await sleep(1500);
    const fcp = await page.eval(`Math.round(performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime ?? -1)`);
    results.push({ route, variant: v, trial: i, fcp }); console.log(route, v, i, fcp);
  } finally { await page.close(); }
}
writeFileSync(OUT, JSON.stringify({ base: BASE, results }, null, 1));
