#!/usr/bin/env node
// M1.4E: /lab-v2 with the recovered central A and foreground, plus targeted
// checks (Playground lift and arcade, pointer, keyboard, deep link, reduced
// motion). Same viewport and camera as M1.4D (asserted).
//
//   node scripts/visual/m14e-capture.mjs        (V2_URL default http://localhost:3002)
//
// Writes docs/m1.4e/work/captures/*.png and checks.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4e/work/captures");
mkdirSync(OUT, { recursive: true });
const V2 = process.env.V2_URL || "http://localhost:3002";
const W = 1648;
const H = 928;
const STATION = { x: 1000, y: 300, w: 440, h: 320 };
const GAP = { x: 1050, y: 495, w: 340, h: 80 };
const HUBR = { x: 600, y: 470, w: 480, h: 270 };
const FGL = { x: 1, y: 640, w: 469, h: 299 };
const FGR = { x: 1380, y: 740, w: 290, h: 199 };
const NO_LINES = ".lab-charge-dim{visibility:hidden!important}";
const NO_V2_SHADOW = ".lab-v2-shadow{visibility:hidden!important}";
const LIFT = '.lab-lift[data-lift="playground"]{transform:translateY(calc(var(--u) * -18)) scale(1.01)!important;transition:none!important}';
const NO_DEV = "nextjs-portal{display:none!important}";
const M14D_CAMERA = { x: -0.4453125, y: 0, k: 0.9861786034688995 };

const checks = {};

async function open(url, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(url);
  await page.mouseMove(4, H - 4);
  await sleep(900);
  const cam = () => page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const css = (t) => page.eval(`(() => { document.getElementById("ev")?.remove(); const s = document.createElement("style"); s.id = "ev"; s.textContent = ${JSON.stringify(NO_DEV + t)}; document.head.append(s); return 1; })()`).then(() => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`));
  const shot = async (file, r = null, scale = 1) => {
    const c = await cam();
    const p = r ? { format: "png", clip: { x: c.x + r.x * c.k, y: c.y + r.y * c.k, width: r.w * c.k, height: r.h * c.k, scale } } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(OUT, file), Buffer.from(res.data, "base64"));
  };
  await css("");
  return { page, errors, cam, css, shot };
}

{
  const { page, errors, cam, css, shot } = await open(`${V2}/lab-v2`);
  checks.camera = await cam();
  checks.camera_same_as_m14d = JSON.stringify(checks.camera) === JSON.stringify(M14D_CAMERA);
  checks.recovered = await page.eval(`[...document.querySelectorAll("[data-v2-recovered]")].map((i) => [i.dataset.v2Recovered, i.naturalWidth, i.naturalHeight, getComputedStyle(i).mixBlendMode])`);
  checks.generated_hub_drawn = await page.eval(`!!document.querySelector('[data-v2-object="hub"]')`);
  await shot("v2-with-connections.png");
  await css(NO_LINES);
  await shot("v2-no-connections.png");
  await css("");
  await shot("hub-1x.png", HUBR);
  await shot("hub-3x.png", HUBR, 3);
  await shot("fg-left-1x.png", FGL);
  await shot("fg-left-3x.png", FGL, 3);
  await shot("fg-right-3x.png", FGR, 3);
  await shot("pg-rest.png", STATION);
  await css(LIFT);
  checks.manual_lift_px = await page.eval(`new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f`);
  await shot("pg-lifted.png", STATION);
  await shot("pg-lifted-gap-3x.png", GAP, 3);
  await css(LIFT + NO_V2_SHADOW);
  await shot("pg-lifted-no-shadow.png", STATION);
  await shot("pg-lifted-no-shadow-gap-3x.png", GAP, 3);
  checks.static_errors = errors;
  await page.close();
}

// Behaviour: pointer through the foreground, real hover lift + arcade, energy at the hub, keyboard.
{
  const { page, errors, shot } = await open(`${V2}/lab-v2`);
  // What the pointer hits over the books, the mug and the plant: never a recovered layer.
  checks.hit_test = await page.eval(`(() => { const c = document.querySelector(".lab-camera").getBoundingClientRect(); const k = c.width / 1672; const at = (x, y) => { const e = document.elementFromPoint(c.left + x * k, c.top + y * k); return e ? (e.dataset.v2Recovered ? "RECOVERED LAYER" : (e.closest("[data-hotspot]")?.dataset.hotspot ?? e.tagName)) : null; }; return { books: at(100, 820), mug: at(265, 840), steam: at(280, 740), plant: at(1600, 900), creative_platform: at(300, 690), hub: at(840, 600) }; })()`);
  const cc = await page.center('[data-hotspot="creative"]');
  await page.mouseMove(cc.x, cc.y);
  await sleep(600);
  checks.creative_hover = await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  await page.mouseMove(4, H - 4);
  await sleep(800);
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(3200);
  checks.playground_hover = await page.eval(`(() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); const a = document.querySelector('[data-arcade="playground"]'); return { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, lift_px: new DOMMatrix(getComputedStyle(l).transform).f, arcade_opacity: +getComputedStyle(a).opacity, arcade_state: a.dataset.state ?? null }; })()`);
  await shot("pg-hover-live.png", STATION);
  await shot("v2-hover-playground.png");
  await page.mouseMove(4, H - 4);
  await sleep(1500);
  checks.after_leave_lift_px = await page.eval(`new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f`);
  // Keyboard, as in M1.4D: Tab to Playground, Enter, Escape.
  let found = null;
  for (let i = 0; i < 30 && !found; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(40);
    const d = await page.eval(`(() => { const e = document.activeElement; return e ? (e.getAttribute("aria-label") || e.textContent || "").trim() : ""; })()`);
    if (/playground/i.test(d)) found = i + 1;
  }
  await page.key("Enter", "Enter", 13);
  await sleep(1200);
  checks.keyboard = { tabs: found, ...(await page.eval(`({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, url: location.pathname + location.search })`)) };
  await page.key("Escape", "Escape", 27);
  await sleep(800);
  checks.keyboard.after_escape = await page.eval(`location.pathname + location.search`);
  checks.behaviour_errors = errors;
  await page.close();
}
{
  const { page, errors } = await open(`${V2}/lab-v2?station=playground`);
  checks.deep_link = await page.eval(`({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, lift_px: new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f })`);
  checks.deep_link_errors = errors;
  await page.close();
}
{
  const { page, errors } = await open(`${V2}/lab-v2`, { reducedMotion: true });
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(1200);
  checks.reduced_motion = await page.eval(`({ hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, lift_px: new DOMMatrix(getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform).f })`);
  checks.reduced_errors = errors;
  await page.close();
}
{
  // The homepage still never loads anything from /scene/v2/.
  const { page } = await open(`${V2}/`);
  checks.homepage_v2_requests = await page.eval(`performance.getEntriesByType("resource").map((e) => new URL(e.name).pathname).filter((p) => p.startsWith("/scene/v2/"))`);
  const res = await page.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, "approved-rest.png"), Buffer.from(res.data, "base64"));
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 1) + "\n");
console.log(JSON.stringify(checks, null, 1));
