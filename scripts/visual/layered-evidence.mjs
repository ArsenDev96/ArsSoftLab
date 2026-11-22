#!/usr/bin/env node
// M1.3H evidence: the experimental layered Playground against the approved
// M1.3E version. Needs two servers: the default build (--orig) and one built
// with NEXT_PUBLIC_PLAYGROUND_LAYERED=on (--url). Lightweight: stills, a few
// real-time probes, one short recording.
//
//   node scripts/visual/layered-evidence.mjs --orig http://localhost:3000 --url http://localhost:3001 --out docs/m1.3h [--no-video]
//
// Run `node scripts/make-playground-layered.mjs --preview docs/m1.3h` first
// (clean background, asset preview, crops).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { compareImages, composeGrid, prepare } from "./compare.mjs";
import { recordWebm } from "./record.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const ORIG = opt("orig", "http://localhost:3000");
const URL_ = opt("url", "http://localhost:3001");
const OUT = resolve(opt("out", "docs/m1.3h"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
/** Scene region around Playground's base (the gap) and around the whole station. */
const GAP = { x: 1050, y: 470, w: 340, h: 100 };
const STATION = { x: 1040, y: 325, w: 360, h: 250 };
const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep{visibility:hidden!important}";
mkdirSync(join(OUT, "checks"), { recursive: true });

const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};

const offScene = (page) => page.mouseMove(4, H - 4);
const hotspot = (page) => page.center('[data-hotspot="playground"]');
const css = (page, text) => page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(text)}; document.head.append(s); return true; })()`);
/** Scene px -> screen clip at `scale`. */
const clipOf = async (page, r, scale) => {
  const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  return { x: s.x + r.x * s.k, y: s.y + r.y * s.k, width: r.w * s.k, height: r.h * s.k, scale };
};
const shot = async (page, path, region, scale = 1) => {
  const r = await page.send("Page.captureScreenshot", { format: "png", ...(region ? { clip: await clipOf(page, region, scale) } : {}) });
  writeFileSync(path, Buffer.from(r.data, "base64"));
};
/** Lift state: the station's transform, its label's, the arcade screen's position, the shadow, the line charge. */
const STATE = `(() => {
  const u = document.querySelector(".lab-camera").getBoundingClientRect().width / 1672;
  const m = (el) => { const t = el ? getComputedStyle(el).transform : "none"; const d = new DOMMatrixReadOnly(t === "none" ? undefined : t); return { y: +(d.m42 / u).toFixed(2), s: +d.a.toFixed(4) }; };
  const group = document.querySelector('[data-station-layer="playground"]');
  const arcade = document.querySelector('.lab-lift[data-lift="playground"] .lab-arcade');
  const parts = [...document.querySelectorAll('[data-charge-window="playground"][data-charge-kind="dim"]')].map((w) => {
    const t = getComputedStyle(w).transform;
    const s = (t === "none" ? 0 : new DOMMatrixReadOnly(t).m41) / u;
    return Math.max(0, Math.min(1, s / (w.offsetWidth / u - 40)));
  });
  return {
    layered: group?.dataset.layered === "true",
    visible: group ? getComputedStyle(group).visibility : null,
    lift: m(document.querySelector('.lab-lift[data-lift="playground"]:not(.lab-station)')),
    label: m(document.querySelector('.lab-station.lab-lift[data-lift="playground"]')),
    arcadeTop: arcade ? +(arcade.getBoundingClientRect().top / u).toFixed(2) : null,
    shadow: +getComputedStyle(document.querySelector('.lab-lift-shadow[data-lift="playground"]')).opacity,
    shadowDisplay: getComputedStyle(document.querySelector('.lab-lift-shadow[data-lift="playground"]')).display,
    background: +(document.querySelector('[data-station-layer="playground"] > div > img').getBoundingClientRect().top / u).toFixed(2),
    line: parts.length ? +Math.min(...parts).toFixed(3) : null,
  };
})()`;
const state = (page) => page.eval(STATE);

// 1. Idle: original vs experimental ------------------------------------------
for (const [name, url] of [["original", ORIG], ["experimental", URL_]]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(url);
    await offScene(page);
    await sleep(700);
    await shot(page, join(OUT, `checks/idle-${name}.png`));
    await shot(page, join(OUT, `checks/idle-${name}-station-2x.png`), STATION, 2);
    if (name === "experimental") {
      const s = await state(page);
      note("Experimental idle: layered Playground loaded and at rest (shown from the energy's arrival, like the approved one)", s.layered && s.visible === "hidden" && s.lift.y === 0 && s.shadow === 0, s);
      // How close the layers recompose the plate if they are shown at rest
      // (Chrome resamples each layer separately): for the notes.
      await css(page, '.lab-station-layer[data-ready][data-layered]{visibility:visible!important;transition:none!important}');
      await sleep(150);
      await shot(page, join(OUT, "checks/idle-experimental-layers-shown.png"));
    }
  } finally {
    await page.close();
  }
}
{
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    const d = await compareImages(page, join(OUT, "checks/idle-original.png"), join(OUT, "checks/idle-experimental.png"), { heatmapPath: join(OUT, "checks/idle-diff-x40.png") });
    note("Idle: experimental vs original, whole frame (per-pixel max channel difference, 0-255; a few px of ambient noise allowed)", d.over12 === 0 && d.over2 <= 5, d);
    const shown = await compareImages(page, join(OUT, "checks/idle-original.png"), join(OUT, "checks/idle-experimental-layers-shown.png"), { heatmapPath: join(OUT, "checks/idle-layers-shown-diff-x40.png") });
    note("For reference: the layers shown at rest vs the plate (separate resampling; not shipped this way)", true, shown);
    await composeGrid(
      page,
      [
        { label: "Original (approved M1.3E), at rest", path: join(OUT, "checks/idle-original-station-2x.png") },
        { label: "Experimental layered (M1.3H), at rest", path: join(OUT, "checks/idle-experimental-station-2x.png") },
      ],
      join(OUT, "idle-comparison.png"),
      { columns: 2 },
    );
  } finally {
    await page.close();
  }
}

// 2. Lifted, with and without the shadow; the approved version for reference ---
for (const [name, url] of [["original", ORIG], ["experimental", URL_]]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(url);
    await offScene(page);
    await sleep(500);
    const rest = await state(page);
    const c = await hotspot(page);
    await page.mouseMove(c.x, c.y);
    await sleep(2200);
    const up = await state(page);
    await page.freezeAnimations(0);
    await sleep(80);
    const tag = name === "experimental" ? "" : "-original";
    await shot(page, join(OUT, `playground-lifted${tag}.png`));
    await shot(page, join(OUT, `checks/lifted${tag}-3x.png`), GAP, 3);
    await css(page, NO_SHADOW);
    await sleep(80);
    await shot(page, join(OUT, `playground-lifted-no-shadow${tag}.png`));
    await shot(page, join(OUT, `checks/lifted-no-shadow${tag}-3x.png`), GAP, 3);
    if (name === "experimental") {
      note("Lift: the whole station rises 18 px with 1% scale; label and chips with it", Math.abs(up.lift.y + 18) < 0.2 && up.lift.s === 1.01 && Math.abs(up.label.y - up.lift.y) < 0.01 && up.label.s === up.lift.s, { lift: up.lift, label: up.label });
      note("Arcade screen rides the lift (moved with the station, still inside it)", rest.arcadeTop !== null && up.arcadeTop < rest.arcadeTop - 15, { rest: rest.arcadeTop, lifted: up.arcadeTop });
      note("Floor stays put: background layer unmoved; contact shadow on", up.background === rest.background && up.shadow === 1, { background: [rest.background, up.background], shadow: up.shadow });
      note("Power connection fully charged when lifted (unchanged system)", up.line >= 0.99, { line: up.line });
    }
  } finally {
    await page.close();
  }
}

// 3. Return to idle, keyboard, reduced motion -------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(700);
    await shot(page, join(OUT, "checks/rest-before.png"), STATION);
    const c = await hotspot(page);
    await page.mouseMove(c.x, c.y);
    await sleep(2000);
    await offScene(page);
    await sleep(2200);
    await shot(page, join(OUT, "checks/rest-after.png"), STATION);
    const s = await state(page);
    const probe = await launch({ width: 400, height: 300 });
    try {
      await prepare(probe);
      const d = await compareImages(probe, join(OUT, "checks/rest-before.png"), join(OUT, "checks/rest-after.png"));
      note("Return to idle: station down, shadow off, layers hidden, the station's area matches idle", s.lift.y === 0 && s.shadow === 0 && s.visible === "hidden" && d.max <= 2, { lift: s.lift, shadow: s.shadow, diff: d });
    } finally {
      await probe.close();
    }

    await page.eval(`document.querySelector("#station-playground-trigger").focus(), true`);
    await sleep(2000);
    const on = await state(page);
    await page.eval(`document.activeElement.blur(), true`);
    await sleep(1500);
    const off = await state(page);
    note("Keyboard focus lifts the station (after the charge); blur lowers it", Math.abs(on.lift.y + 18) < 0.2 && on.line >= 0.99 && off.lift.y === 0 && off.shadow === 0, { focused: on.lift, line: on.line, blurred: off.lift });
  } finally {
    await page.close();
  }
}
{
  const page = await launch({ width: W, height: H, reducedMotion: true });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(500);
    const c = await hotspot(page);
    await page.mouseMove(c.x, c.y);
    await sleep(600);
    const s = await state(page);
    note("Reduced motion: layered station shown, no lift, no contact shadow", s.visible === "visible" && s.lift.y === 0 && s.shadowDisplay === "none", { visible: s.visible, lift: s.lift, shadow: s.shadowDisplay });
  } finally {
    await page.close();
  }
}

// 4. Sheets --------------------------------------------------------------------------
{
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    await composeGrid(
      page,
      [
        { label: "Approved M1.3E, lifted, as shipped", path: join(OUT, "checks/lifted-original-3x.png") },
        { label: "Approved M1.3E, lifted, shadow layers off", path: join(OUT, "checks/lifted-no-shadow-original-3x.png") },
        { label: "Experimental M1.3H, lifted", path: join(OUT, "checks/lifted-3x.png") },
        { label: "Experimental M1.3H, lifted, shadow off", path: join(OUT, "checks/lifted-no-shadow-3x.png") },
      ],
      join(OUT, "lift-gap-3x.png"),
      { columns: 1 },
    );
    if (existsSync(join(OUT, "checks/crop-clean.png")))
      await composeGrid(
        page,
        [
          { label: "Plate (the approved artwork)", path: join(OUT, "checks/crop-plate.png") },
          { label: "Clean background: Playground removed, hidden area synthesised", path: join(OUT, "checks/crop-clean.png") },
        ],
        join(OUT, "clean-background.png"),
        { columns: 2, scale: 2 },
      );
  } finally {
    await page.close();
  }
}

// 5. Recording -------------------------------------------------------------------------
if (VIDEO) {
  const r = await recordWebm({
    url: URL_,
    width: W,
    height: H,
    out: join(OUT, "playground-layered.webm"),
    prepare: async (page) => {
      await offScene(page);
      await sleep(600);
    },
    act: async (page) => {
      const c = await hotspot(page);
      await page.mouseMove(c.x, c.y);
      await sleep(3200);
      await offScene(page);
      await sleep(1800);
    },
  });
  console.log(`playground-layered.webm: ${r.frames} captured frames, ${r.seconds} s at ${r.fps} fps`);
}

writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
const bad = lines.filter((l) => l.startsWith("BAD")).length;
console.log(bad ? `${bad} probe(s) failed` : "all probes OK");
process.exitCode = bad ? 1 : 0;
