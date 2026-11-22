#!/usr/bin/env node
// M1.3J.2: real-browser comparison sheets for the floor under Playground's
// lift: the M1.3I floor, LaMa c2 and the hybrid candidates, each integrated
// in turn with the existing pipeline (scripts/inpaint-playground.mjs) and
// captured in the experimental build (:3001) lifted, with every shadow off.
//
// The viewport is the scene's own size (1672 x 941), so one screenshot
// pixel is one scene pixel; 3x and 4x are nearest-neighbour enlargements of
// those true pixels (no browser smoothing that would hide or invent grain).
//
//   node scripts/hybrid-floor-compare.mjs [--keep <name>] [--url http://localhost:3001]
//
// Ends with the floor cleared (the M1.3I floor) unless --keep names an entry.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "./visual/cdp.mjs";
import { composeGrid, prepare } from "./visual/compare.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "docs/m1.3j/hybrid");
const RECORDS = "docs/m1.3j/hybrid/records";
const argv = process.argv.slice(2);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const URL_ = opt("url", "http://localhost:3001");
const KEEP = opt("keep", null);

const ENTRIES = [
  { name: "m1.3i", label: "M1.3I floor (current baseline)", cand: null },
  { name: "c2-env-2x-floor", label: "LaMa c2", cand: "docs/m1.3j/lama/candidates/c2-env-2x-floor.png" },
  { name: "h1-s2", label: "h1: c2 below 2 px + real grain", cand: "docs/m1.3j/hybrid/candidates/h1-s2.png" },
  { name: "h2-s4", label: "h2: c2 below 4 px + real floor above", cand: "docs/m1.3j/hybrid/candidates/h2-s4.png" },
  { name: "h3-s8", label: "h3: c2 below 8 px + real floor above", cand: "docs/m1.3j/hybrid/candidates/h3-s8.png" },
  { name: "h2-s4-seamless", label: "h2 + seamless ends (final)", cand: "docs/m1.3j/hybrid/candidates/h2-s4-seamless.png" },
];
/** Scene rectangles. */
const STATION = { x: 1040, y: 325, w: 360, h: 250 };
const GAP = { x: 1050, y: 470, w: 340, h: 100 };
const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep,.lab-depth-shadow{visibility:hidden!important}";

const node = (...args) => execFileSync(process.execPath, [join(ROOT, "scripts/inpaint-playground.mjs"), ...args], { cwd: ROOT, stdio: "pipe" }).toString();
const use = (e) => (e.cand ? node("integrate", e.cand, "--name", e.name, "--root", RECORDS) : node("clear"));

async function capture(e) {
  const dir = join(OUT, "shots", e.name);
  mkdirSync(dir, { recursive: true });
  const page = await launch({ width: 1672, height: 941 });
  const shot = async (file, r) => {
    const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
    if (s.k !== 1 || s.x !== 0 || s.y !== 0) throw new Error(`scene not 1:1 in the viewport: ${JSON.stringify(s)}`);
    const res = await page.send("Page.captureScreenshot", { format: "png", clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 } });
    writeFileSync(join(dir, file), Buffer.from(res.data, "base64"));
  };
  try {
    await page.goto(URL_);
    await page.mouseMove(4, 930);
    await sleep(700);
    const c = await page.center('[data-hotspot="playground"]');
    await page.mouseMove(c.x, c.y);
    await sleep(2300);
    await page.freezeAnimations(0);
    await shot("lifted-station.png", STATION);
    await shot("lifted-gap.png", GAP);
    await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(NO_SHADOW)}; document.head.append(s); return 1; })()`);
    await sleep(150);
    await shot("lifted-no-shadow-station.png", STATION);
    await shot("lifted-no-shadow-gap.png", GAP);
  } finally {
    await page.close();
  }
  return dir;
}

const dirs = {};
for (const e of ENTRIES) {
  use(e);
  dirs[e.name] = await capture(e);
  console.log(`captured ${e.name}`);
}
if (KEEP) use(ENTRIES.find((e) => e.name === KEEP));
else node("clear");

const page = await launch({ width: 400, height: 300 });
try {
  await prepare(page);
  const items = (file, crop) => ENTRIES.map((e) => ({ label: e.label, path: join(dirs[e.name], file), crop }));
  // Normal size: what a desktop viewer sees.
  await composeGrid(page, items("lifted-no-shadow-station.png"), join(OUT, "compare-1x-no-shadow.png"), { columns: 3 });
  await composeGrid(page, items("lifted-station.png"), join(OUT, "compare-1x-shadows-on.png"), { columns: 3 });
  // 3x: the whole gap, true pixels.
  await composeGrid(page, items("lifted-no-shadow-gap.png", [0, 20, 340, 95]), join(OUT, "compare-3x-no-shadow.png"), { columns: 1, scale: 3, pixelated: true });
  // 4x: left end, centre, right end of the gap.
  const parts = [
    ["left", [0, 25, 120, 92]],
    ["centre", [110, 30, 230, 97]],
    ["right", [220, 25, 340, 92]],
  ];
  const four = [];
  for (const e of ENTRIES) for (const [n, crop] of parts) four.push({ label: `${e.label} (${n})`, path: join(dirs[e.name], "lifted-no-shadow-gap.png"), crop });
  await composeGrid(page, four, join(OUT, "compare-4x-no-shadow.png"), { columns: 3, scale: 4, pixelated: true });
  // The final candidate against the M1.3I floor and c2 only, 4x, shadows on and off.
  const pick = ENTRIES.filter((e) => ["m1.3i", "c2-env-2x-floor", "h2-s4-seamless"].includes(e.name));
  const final4 = [];
  for (const file of ["lifted-no-shadow-gap.png", "lifted-gap.png"]) for (const e of pick) final4.push({ label: `${e.label}${file.includes("no-shadow") ? ", shadows off" : ", shadows on"}`, path: join(dirs[e.name], file), crop: [0, 25, 340, 97] });
  await composeGrid(page, final4, join(OUT, "final-4x.png"), { columns: 1, scale: 4, pixelated: true });
} finally {
  await page.close();
}
console.log(`sheets in ${OUT}; floor: ${KEEP ?? "cleared (M1.3I)"}`);
