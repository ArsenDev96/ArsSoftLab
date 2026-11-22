#!/usr/bin/env node
// M1.4F: Creative Studio and Experience recovered from the approved artwork in
// /lab-v2. Captures at the same 1648 x 928 viewport and camera as earlier
// milestones, plus targeted checks: the two stations' hover and selection, the
// layers loading, Playground unchanged (rest and full lift), the homepage
// unchanged, keyboard, deep links, reduced motion, console errors.
//
//   node scripts/visual/m14f-capture.mjs        (BASE default http://localhost:3002)
//
// Writes docs/m1.4f/work/captures/{v2,home}/*.png and checks.json.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./cdp.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "docs/m1.4f/work/captures");
const BASE = process.env.BASE || "http://localhost:3002";
const W = 1648;
const H = 928;
const NO_DEV = "nextjs-portal{display:none!important}";
/** Scene rects. */
const CREATIVE = { x: 40, y: 480, w: 520, h: 330 };
const EXPERIENCE = { x: 1150, y: 480, w: 521, h: 330 };
const PLAYGROUND = { x: 860, y: 300, w: 600, h: 300 };
const CREATIVE_3X = { x: 90, y: 500, w: 430, h: 290 };
const EXPERIENCE_3X = { x: 1185, y: 500, w: 486, h: 300 };
const checks = { base: BASE };

async function open(path, opts = {}) {
  const page = await launch({ width: W, height: H, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });
  await page.goto(BASE + path);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, H - 4);
  await sleep(1000);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const seek = (t) => page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const shot = async (dir, file, r = null, scale = 1) => {
    mkdirSync(join(OUT, dir), { recursive: true });
    const p = r ? { format: "png", clip: { x: cam.x + r.x * cam.k, y: cam.y + r.y * cam.k, width: Math.min(r.w * cam.k, W - 1 - (cam.x + r.x * cam.k)), height: r.h * cam.k, scale } } : { format: "png" };
    const res = await page.send("Page.captureScreenshot", p);
    writeFileSync(join(OUT, dir, file), Buffer.from(res.data, "base64"));
  };
  return { page, errors, cam, seek, shot };
}

const layers = (page) =>
  page.eval(`(() => Object.fromEntries([...document.querySelectorAll("[data-v2-station] img, [data-v2-object]")].map((e) => [e.dataset.v2Recovered || e.dataset.v2Object, { loaded: e.complete && e.naturalWidth > 0, size: e.naturalWidth + "x" + e.naturalHeight, blend: getComputedStyle(e).mixBlendMode, src: e.getAttribute("src") }])))()`);
const state = (page) =>
  page.eval(`(() => ({
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    url: location.pathname + location.search,
    lift_px: (() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); if (!l) return null; const t = getComputedStyle(l).transform; return t === "none" ? 0 : +(new DOMMatrix(t).f / (l.offsetWidth / 1672)).toFixed(2); })(),
    icons: Object.fromEntries([...document.querySelectorAll("[data-station]")].map((e) => [e.dataset.station, e.querySelectorAll(".lab-station-icon").length])),
  }))()`);

// --before: the generated station images (M1.4D-M1.4E.3) put back in place of the recovered layers,
// with their own transform (scene-v2-data.ts), for the 3x before/after only.
if (process.argv.includes("--before")) {
  const { page, shot } = await open("/lab-v2");
  const GEN = {
    creative: { src: "/scene/v2/stations/creative-studio.png", scale: 0.67677, tx: 40.31, ty: 178.8 },
    experience: { src: "/scene/v2/stations/experience.png", scale: 0.62204, tx: 635.18, ty: 232.58 },
  };
  await page.eval(`(async () => {
    const GEN = ${JSON.stringify(GEN)};
    const u = (n) => "calc(var(--u) * " + n + ")";
    const waits = [];
    for (const [id, g] of Object.entries(GEN)) {
      const host = document.querySelector('[data-v2-station="' + id + '"]');
      host.querySelectorAll("img").forEach((e) => (e.style.display = "none"));
      const img = document.createElement("img");
      img.src = g.src;
      img.className = "absolute max-w-none select-none";
      Object.assign(img.style, { left: 0, top: 0, width: u(1672), height: u(941), transformOrigin: "0 0", transform: "translate(" + u(g.tx) + ", " + u(g.ty) + ") scale(" + g.scale + ")" });
      host.append(img);
      waits.push(img.decode());
    }
    await Promise.all(waits);
    return 1;
  })()`);
  await sleep(300);
  await shot("before", "creative-3x.png", CREATIVE_3X, 3);
  await shot("before", "experience-3x.png", EXPERIENCE_3X, 3);
  await shot("before", "rest.png");
  await page.close();
  process.exit(0);
}

// /lab-v2 at rest, both stations, the whole scene, Playground.
{
  const { page, errors, cam, seek, shot } = await open("/lab-v2");
  checks.camera = cam;
  checks.v2_layers = await layers(page);
  await shot("v2", "rest.png");
  await shot("v2", "creative-1x.png", CREATIVE);
  await shot("v2", "experience-1x.png", EXPERIENCE);
  await shot("v2", "creative-3x.png", CREATIVE_3X, 3);
  await shot("v2", "experience-3x.png", EXPERIENCE_3X, 3);
  await shot("v2", "playground-rest-1x.png", PLAYGROUND);
  // Pointer over each station's own (recovered) platform: its hotspot, its connection charging.
  for (const [id, pt] of [["creative", [360, 720]], ["experience", [1300, 720]]]) {
    await page.mouseMove(cam.x + pt[0] * cam.k, cam.y + pt[1] * cam.k);
    await sleep(40);
    await seek(2400);
    checks[`hover_${id}`] = await state(page);
    await shot("v2", `${id}-hovered-1x.png`, id === "creative" ? CREATIVE : EXPERIENCE);
    await page.eval(`(() => { document.getAnimations().forEach((a) => a.finish()); return 1; })()`);
    await page.mouseMove(4, H - 4);
    await sleep(1600);
  }
  // Playground fully lifted (unchanged).
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y);
  await sleep(40);
  await seek(2400);
  checks.playground_lifted = await state(page);
  await shot("v2", "playground-lifted-1x.png", PLAYGROUND);
  await shot("v2", "playground-lifted.png");
  checks.v2_errors = errors;
  await page.close();
}
// Keyboard: Tab to the Creative Studio and Experience titles; Enter selects; Escape returns.
{
  const { page, errors } = await open("/lab-v2");
  const found = {};
  for (let i = 0; i < 40 && !found.experience; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(30);
    const st = await page.eval(`(() => { const e = document.activeElement; return e && e.closest("h2") ? e.closest("[data-station]")?.dataset.station ?? "" : ""; })()`);
    if (st === "creative" && !found.creative) {
      found.creative = i + 1;
      await sleep(400);
      found.creative_focus = await state(page);
    }
    if (st === "experience") {
      found.experience = i + 1;
      await sleep(400);
      found.experience_focus = await state(page);
      await page.key("Enter", "Enter", 13);
      await sleep(1200);
      found.experience_selected = await state(page);
      await page.key("Escape", "Escape", 27);
      await sleep(1200);
      found.experience_after_escape = await state(page);
    }
  }
  checks.keyboard = { ...found, errors };
  await page.close();
}
for (const id of ["creative", "experience"]) {
  const { page, errors, shot } = await open(`/lab-v2?station=${id}`);
  await sleep(800);
  checks[`deep_link_${id}`] = { ...(await state(page)), errors };
  await shot("v2", `deep-link-${id}.png`);
  await page.close();
}
{
  const { page, errors, cam, shot } = await open("/lab-v2", { reducedMotion: true });
  await page.mouseMove(cam.x + 360 * cam.k, cam.y + 720 * cam.k);
  await sleep(800);
  checks.reduced_motion_creative = { ...(await state(page)), errors };
  await shot("v2", "reduced-motion-creative-hover-1x.png", CREATIVE);
  await page.close();
}
// The approved homepage, at rest (compared with M1.4E.1's capture by m14f-sheets.py).
{
  const page = await launch({ width: W, height: H });
  const urls = [];
  await page.send("Network.enable");
  page.on((m) => {
    if (m.method === "Network.requestWillBeSent") urls.push(m.params.request.url);
  });
  await page.goto(BASE + "/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_DEV)}; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, H - 4);
  await sleep(1400);
  mkdirSync(join(OUT, "home"), { recursive: true });
  const res = await page.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, "home", "rest.png"), Buffer.from(res.data, "base64"));
  checks.homepage = { v2_requests: urls.filter((u) => u.includes("/scene/v2/")).length, ...(await state(page)) };
  await page.close();
}

writeFileSync(join(OUT, "checks.json"), JSON.stringify(checks, null, 1) + "\n");
console.log(JSON.stringify(checks, null, 1));
