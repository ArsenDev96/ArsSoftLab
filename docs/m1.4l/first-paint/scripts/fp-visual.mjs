// M1.4Q: scene-visible timing from trace screenshots. node fp-visual.mjs <base> <trials> <out.json> <conds> <routes>
// conds: cold | primed-other | warm (route seen once before, HTTP cache cleared) | swgpu (cold, --disable-gpu)
import { writeFileSync } from "node:fs";
import { launch, sleep } from "./cdp2.mjs";

const [BASE, TRIALS, OUT, CONDS, ROUTES_ARG] = process.argv.slice(2);
const ALL = { "404": "/m14q-not-a-page", home: "/", cinematic: "/lab-v2", lite: "/lab-v2?render=lite", project: "/lab-v2/projects/sqlorbit" };
const ROUTES = ROUTES_ARG.split(",").map((k) => [k, ALL[k]]);
const NEUTRAL = "data:text/html,<!doctype html><body style='background:%23111;color:%23eee;font:20px sans-serif'><p>neutral page</p></body>";
const CATS = ["loading", "blink.user_timing", "devtools.timeline", "disabled-by-default-devtools.screenshot"];

const helper = await launch({ width: 400, height: 300 });
async function luma(b64) {
  // mean luma of the whole frame and of the scene band (rows 55–95 %), from the JPEG
  return helper.eval(`(async () => {
    const r = await fetch("data:image/jpeg;base64,${b64}"); const bmp = await createImageBitmap(await r.blob());
    const c = new OffscreenCanvas(bmp.width, bmp.height); const x = c.getContext("2d"); x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, bmp.width, bmp.height).data; let all = 0, band = 0, nb = 0;
    const y0 = Math.floor(bmp.height * 0.55), y1 = Math.floor(bmp.height * 0.95);
    for (let y = 0; y < bmp.height; y++) for (let i = 0; i < bmp.width; i++) { const k = (y * bmp.width + i) * 4; const l = 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]; all += l; if (y >= y0 && y < y1) { band += l; nb++; } }
    return { all: all / (bmp.width * bmp.height), band: band / nb };
  })()`);
}
const loadOf = (page) => new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
async function go(page, url) { const l = loadOf(page); await page.send("Page.navigate", { url }); await l; }

const results = [];
for (const cond of CONDS.split(",")) {
  for (const [route, path] of ROUTES) {
    for (let i = 0; i < Number(TRIALS); i++) {
      const page = await launch(cond === "swgpu" ? { extraArgs: ["--disable-gpu"] } : {});
      try {
        await page.send("Page.enable"); await page.send("Network.enable");
        if (cond === "primed-other") { await go(page, NEUTRAL); await sleep(1500); }
        if (cond === "warmcache") { await go(page, BASE + path); await sleep(1500); await go(page, "about:blank"); }
        if (cond === "warm") { await go(page, BASE + path); await sleep(1500); await go(page, "about:blank"); await page.send("Network.clearBrowserCache"); }
        if (process.env.THROTTLE) { const [mbps, rtt] = process.env.THROTTLE.split(",").map(Number); await page.send("Network.emulateNetworkConditions", { offline: false, latency: rtt, downloadThroughput: (mbps * 1e6) / 8, uploadThroughput: (mbps * 1e6) / 8 }); }
        await page.send("Tracing.start", { transferMode: "ReturnAsStream", traceConfig: { includedCategories: CATS, excludedCategories: ["*"] } });
        await go(page, BASE + path);
        await sleep(process.env.THROTTLE ? 4500 : 2500);
        const done = new Promise((ok) => { const o = page.on((m) => { if (m.method === "Tracing.tracingComplete") { o(); ok(m.params.stream); } }); });
        await page.send("Tracing.end");
        const h = await done; const chunks = [];
        for (;;) { const x = await page.send("IO.read", { handle: h, size: 1 << 20 }); chunks.push(x.base64Encoded ? Buffer.from(x.data, "base64") : Buffer.from(x.data, "utf8")); if (x.eof) break; }
        const p = JSON.parse(Buffer.concat(chunks).toString("utf8")); const ev = p.traceEvents ?? p;
        const nav = ev.filter((e) => e.name === "navigationStart" && e.args?.data?.documentLoaderURL === BASE + path).sort((a, b) => a.ts - b.ts).at(-1);
        const fcpE = ev.filter((e) => e.name === "firstContentfulPaint" && e.pid === nav.pid && e.ts >= nav.ts).sort((a, b) => a.ts - b.ts)[0];
        const t0 = nav.ts; const ms = (ts) => Math.round((ts - t0) / 1000);
        const shots = ev.filter((e) => e.name === "Screenshot" && e.ts >= t0).sort((a, b) => a.ts - b.ts);
        const frames = [];
        for (const s of shots) frames.push({ t: ms(s.ts), ...(await luma(s.args.snapshot)) });
        const fin = frames.at(-1);
        // frames before the new document's first dark frame are still the previous page (about:blank is white)
        const ownIdx = frames.findIndex((f) => f.all < 200);
        const own = ownIdx < 0 ? [] : frames.slice(ownIdx);
        const first = (f) => own.find(f)?.t ?? null;
        const r = {
          cond, route, trial: i, fcp: ms(fcpE.ts),
          firstNonBlank: first((f) => f.all > 3),
          scene50: first((f) => f.band >= 0.5 * fin.band), scene90: first((f) => f.band >= 0.9 * fin.band),
          finalBand: Math.round(fin.band), firstDark: own[0]?.t ?? null, frames: frames.map((f) => [f.t, Math.round(f.all), Math.round(f.band)]),
        };
        results.push(r);
        console.log(JSON.stringify(r));
      } finally {
        await page.close();
      }
    }
  }
}
await helper.close();
writeFileSync(OUT, JSON.stringify({ base: BASE, results }, null, 1));
