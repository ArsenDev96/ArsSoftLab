#!/usr/bin/env node
// M1.3I evidence: the experimental 2.5D scene (NEXT_PUBLIC_LAB_LAYERED=on)
// against the approved default build and the reference artwork. Needs two
// servers: the default build (--orig) and the experimental one (--url,
// `npm run build:layered`). Lightweight: stills, real-time probes,
// one short recording.
//
//   node scripts/visual/scene25d-evidence.mjs --orig http://localhost:3000 --url http://localhost:3001 --out docs/m1.3i [--no-video]
//
// Run `node scripts/make-scene-layers.mjs --preview docs/m1.3i` first (the
// environment previews used in environment-3x.png).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const OUT = resolve(opt("out", "docs/m1.3i"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
/** Scene regions: Playground with its connection; the gap; the connection's floor part; all five lines. */
const STAGE = { x: 880, y: 320, w: 520, h: 270 };
/** Playground alone (the stage also takes in the Educational globe's ambient orbit). */
const STATION = { x: 1040, y: 325, w: 360, h: 250 };
const GAP = { x: 1050, y: 470, w: 340, h: 100 };
const LINE = { x: 930, y: 525, w: 175, h: 55 };
const LINES = { x: 470, y: 425, w: 790, h: 310 };
/** Hides every shadow layer (approved and experimental) for the honest view of the floor. */
const NO_SHADOW = ".lab-lift-shadow,.lab-lift-penumbra,.lab-gap-sweep,.lab-depth-shadow{visibility:hidden!important}";
mkdirSync(join(OUT, "checks"), { recursive: true });

/** Where the charge windows of each line meet (part joints) and end, in scene px. */
const tsJson = (file, name) => {
  const src = readFileSync(resolve(file), "utf8");
  const eq = src.indexOf("=", src.indexOf(name));
  return JSON.parse(src.slice(eq + 1, src.indexOf(";\n", eq)).trim());
};
const WINDOW_SEAMS = (() => {
  const routes = Object.values(tsJson("components/lab/charge-routes.ts", "CHARGE_ROUTES"));
  const pg = tsJson("components/lab/playground-route.ts", "PLAYGROUND_ROUTE");
  const bend = +readFileSync(resolve("components/lab/playground-route.ts"), "utf8").match(/PLAYGROUND_ROUTE_BEND = (\d+)/)[1];
  routes.push({ route: pg, starts: [0, bend] });
  return routes.flatMap(({ route, starts }) => [route[0], route.at(-1), ...starts.slice(1).map((k) => route[k])]);
})();
let camera = null;

const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};

const offScene = (page) => page.mouseMove(4, H - 4);
const hotspot = (page, id = "playground") => page.center(`[data-hotspot="${id}"]`);
const css = (page, text) => page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(text)}; document.head.append(s); return true; })()`);
const clipOf = async (page, r, scale) => {
  const s = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  return { x: s.x + r.x * s.k, y: s.y + r.y * s.k, width: r.w * s.k, height: r.h * s.k, scale };
};
const shot = async (page, path, region, scale = 1) => {
  const r = await page.send("Page.captureScreenshot", { format: "png", ...(region ? { clip: await clipOf(page, region, scale) } : {}) });
  writeFileSync(path, Buffer.from(r.data, "base64"));
};
const compare = async (a, b, heat) => {
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    return await compareImages(page, a, b, heat ? { heatmapPath: heat } : {});
  } finally {
    await page.close();
  }
};

/** Everything that should (or should not) move with the lift. */
const STATE = `(() => {
  const u = document.querySelector(".lab-camera").getBoundingClientRect().width / 1672;
  const q = (s) => document.querySelector(s);
  const m = (el) => { const t = el ? getComputedStyle(el).transform : "none"; const d = new DOMMatrixReadOnly(t === "none" ? undefined : t); return { y: +(d.m42 / u).toFixed(2), s: +d.a.toFixed(4) }; };
  const top = (el) => (el ? +(el.getBoundingClientRect().top / u).toFixed(2) : null);
  const op = (el) => (el ? +(+getComputedStyle(el).opacity).toFixed(3) : null);
  const charge = (id) => {
    const parts = [...document.querySelectorAll('[data-charge-window="' + id + '"][data-charge-kind="dim"]')].map((w) => {
      const t = getComputedStyle(w).transform;
      const s = (t === "none" ? 0 : new DOMMatrixReadOnly(t).m41) / u;
      return Math.max(0, Math.min(1, s / (w.offsetWidth / u - 40)));
    });
    return parts.length ? parts.map((p) => +p.toFixed(3)) : null;
  };
  const group = q('[data-station-layer="playground"]');
  const refl = q('.lab-reflection[data-reflection="playground"]');
  const depth = q('.lab-depth[data-depth="playground"]');
  const strip = q('.lab-lift[data-lift="playground"] .lab-power-on');
  return {
    layered: group?.dataset.layered === "true",
    visible: group ? getComputedStyle(group).visibility : null,
    lift: m(q('.lab-lift[data-lift="playground"]:not(.lab-station)')),
    label: m(q('.lab-station.lab-lift[data-lift="playground"]')),
    arcadeTop: top(q('.lab-lift[data-lift="playground"] .lab-arcade')),
    arcade: op(q('.lab-lift[data-lift="playground"] .lab-arcade')),
    backdrop: top(q('[data-station-layer="playground"] > div > img')),
    foundation: top(q('[data-foundation="playground"]')),
    unlit: top(q(".lab-depth-unlit")),
    unlitOpacity: op(q(".lab-depth-unlit")),
    environment: top(q(".lab-environment")),
    lineTrace: top(q('[data-charge-window="playground"][data-charge-kind="dim"] img')),
    lp: depth ? +(+getComputedStyle(depth).getPropertyValue("--lp")).toFixed(3) : null,
    contact: op(q(".lab-depth-contact")),
    ambient: op(q(".lab-depth-ambient")),
    reflection: refl ? { ...m(refl), opacity: op(refl) } : null,
    strip: strip ? +(+getComputedStyle(strip).getPropertyValue("--pw")).toFixed(3) : null,
    stripLight: op(q('.lab-lift[data-lift="playground"] .lab-lift-light')),
    line: charge("playground"),
  };
})()`;
const state = (page) => page.eval(STATE);
const full = (s) => s.line && Math.min(...s.line) >= 0.99;
const none = (s) => s.line && Math.max(...s.line) <= 0.01;

// 0. No loading flash: the gated layers never show before every gated image
//    (plate, environment corrections, line traces and lit lines, the
//    reflection) has decoded. ----------------------------------------------------
for (const [name, url] of [["approved", ORIG], ["experimental", URL_]]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.send("Page.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      // Checked on every rendered frame (requestAnimationFrame), so only what
      // could actually be painted counts (before the stylesheet applies,
      // nothing is painted).
      source: `window.__flash = { checks: 0, bad: 0, at: null, done: false };
        requestAnimationFrame(function frame() {
          if (window.__flash.done) return;
          requestAnimationFrame(frame);
          const gates = [...document.querySelectorAll(".lab-plate-gate")];
          if (!gates.length || !gates.some((g) => +getComputedStyle(g).opacity > 0)) return;
          window.__flash.checks++;
          const pending = [...document.querySelectorAll(".lab-plate-gate img[data-gate]")].filter((i) => !(i.complete && i.naturalWidth > 0));
          if (pending.length) { window.__flash.bad++; window.__flash.at = pending.map((i) => i.getAttribute("src")).slice(0, 3); }
          if (gates.every((g) => +getComputedStyle(g).opacity >= 0.99)) window.__flash.done = true;
        });`,
    });
    await page.goto(url);
    await sleep(800);
    const f = await page.eval("window.__flash");
    const n = await page.eval(`document.querySelectorAll(".lab-plate-gate img[data-gate]").length`);
    note(`No loading flash (${name}): the scene appears only once its ${n} gated images are decoded`, f.checks > 0 && f.done && f.bad === 0, f);
  } finally {
    await page.close();
  }
}

// 1. Idle: approved vs experimental, and the reference. ------------------------
for (const [name, url] of [["approved", ORIG], ["experimental", URL_]]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(url);
    await offScene(page);
    await sleep(800);
    await shot(page, join(OUT, `checks/idle-${name}.png`));
    camera ??= await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
    await shot(page, join(OUT, `checks/idle-${name}-stage-2x.png`), STAGE, 2);
    await shot(page, join(OUT, `checks/idle-${name}-lines.png`), LINES, 1);
    await shot(page, join(OUT, `checks/idle-${name}-line-3x.png`), LINE, 3);
    if (name === "experimental") {
      const s = await state(page);
      note("Experimental idle: layered Playground loaded, at rest (layers shown from the energy's arrival), lines unpowered", s.layered && s.visible === "hidden" && s.lift.y === 0 && s.lp === 0 && none(s), { visible: s.visible, lift: s.lift, lp: s.lp, line: s.line });
    }
  } finally {
    await page.close();
  }
}
{
  const d = await compare(join(OUT, "checks/idle-approved.png"), join(OUT, "checks/idle-experimental.png"), join(OUT, "checks/idle-diff-x40.png"));
  // The charge windows meet at part joints and stop at the line ends. There
  // the approved build shows a hairline of the plate's baked, lit line
  // between windows; the experimental floor has no line to leak.
  const seams = WINDOW_SEAMS.map(([x, y]) => [camera.x + x * camera.k, camera.y + y * camera.k]).map(([x, y]) => [Math.floor(x - 10), Math.floor(y - 10), Math.ceil(x + 10), Math.ceil(y + 10)]);
  const page0 = await launch({ width: 400, height: 300 });
  let ds;
  try {
    await prepare(page0);
    ds = await compareImages(page0, join(OUT, "checks/idle-approved.png"), join(OUT, "checks/idle-experimental.png"), { exclude: seams });
    await composeGrid(
      page0,
      [
        { label: "Approved: Creative line, window joint (the baked lit line leaks between windows)", path: join(OUT, "checks/idle-approved.png"), crop: [550, 660, 600, 690] },
        { label: "Experimental: same joint (line-free floor between windows)", path: join(OUT, "checks/idle-experimental.png"), crop: [550, 660, 600, 690] },
      ],
      join(OUT, "checks/window-seams-8x.png"),
      { columns: 2, scale: 8, pixelated: true },
    );
    // The largest remaining difference: the plate's own sharp lit core just
    // past Playground's bend (no approved overlay there), which the layered
    // build draws from the line layer through the rotated charge window.
    const worst = [960, 545, 1025, 575].map((v) => Math.round(v * camera.k));
    await composeGrid(
      page0,
      [
        { label: "Approved: Playground line past the bend (the plate's own core)", path: join(OUT, "checks/idle-approved.png"), crop: worst },
        { label: "Experimental: the same core from the line layer (charge window resampling)", path: join(OUT, "checks/idle-experimental.png"), crop: worst },
      ],
      join(OUT, "checks/idle-worst-8x.png"),
      { columns: 1, scale: 8, pixelated: true },
    );
  } finally {
    await page0.close();
  }
  note(`Idle: experimental vs approved, whole frame, outside the ${seams.length} window joints and line ends (20 x 20 px each): near-identical (< 0.03% of px over 12/255, none over 50)`, ds.over12 <= 0.0003 * ds.width * ds.height && ds.max <= 50 && ds.mean < 0.05, ds);
  note("Idle, including the joints and ends (for the notes: there the approved build leaks the baked line; checks/window-seams-8x.png)", true, d);
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    const ref = [STAGE.x, STAGE.y, STAGE.x + STAGE.w, STAGE.y + STAGE.h];
    await composeGrid(
      page,
      [
        { label: "Reference (approved-lab-design.png)", path: resolve("reference/approved-lab-design.png"), crop: ref },
        { label: "Approved implementation (default build), at rest", path: join(OUT, "checks/idle-approved-stage-2x.png") },
        { label: "Experimental 2.5D (M1.3I), at rest", path: join(OUT, "checks/idle-experimental-stage-2x.png") },
      ],
      join(OUT, "idle-comparison.png"),
      { columns: 3 },
    );
  } finally {
    await page.close();
  }
}

// 2. Lifted, with and without shadows; charging; the approved version for reference.
const lifted = {};
for (const [name, url] of [["approved", ORIG], ["experimental", URL_]]) {
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(url);
    await offScene(page);
    await sleep(500);
    const rest = await state(page);
    const c = await hotspot(page);
    await page.mouseMove(c.x, c.y);
    await sleep(330);
    const mid = await state(page);
    await shot(page, join(OUT, `checks/charging-${name}-line-3x.png`), LINE, 3);
    await sleep(2200);
    const up = await state(page);
    await page.freezeAnimations(0);
    await sleep(80);
    const tag = name === "experimental" ? "" : "-approved";
    await shot(page, join(OUT, `playground-lifted${tag}.png`));
    await shot(page, join(OUT, `checks/lifted${tag}-3x.png`), GAP, 3);
    await shot(page, join(OUT, `checks/charged-${name}-line-3x.png`), LINE, 3);
    await shot(page, join(OUT, `checks/charged-${name}-lines.png`), LINES, 1);
    await css(page, NO_SHADOW);
    await sleep(80);
    await shot(page, join(OUT, `playground-lifted-no-shadow${tag}.png`));
    await shot(page, join(OUT, `checks/lifted-no-shadow${tag}-3x.png`), GAP, 3);
    lifted[name] = { rest, mid, up };
    if (name === "experimental") {
      note("Lift: the station rises 18 px with 1% scale; label and chips with it", Math.abs(up.lift.y + 18) < 0.2 && up.lift.s === 1.01 && Math.abs(up.label.y - up.lift.y) < 0.01, { lift: up.lift, label: up.label });
      note("Arcade screen rides the lift and is running", rest.arcadeTop !== null && up.arcadeTop < rest.arcadeTop - 15 && up.arcade === 1, { rest: rest.arcadeTop, lifted: up.arcadeTop, opacity: up.arcade });
      note("Platform strips lit on the moving platform (power front complete, light on)", up.strip === 1 && up.stripLight > 0.5, { pw: up.strip, light: up.stripLight });
      note("Grounded: the environment, clean background, foundation joint and connection layers do not move", up.environment === rest.environment && up.backdrop === rest.backdrop && up.foundation === rest.foundation && up.lineTrace === rest.lineTrace && up.unlit === rest.unlit, {
        environment: [rest.environment, up.environment],
        backdrop: [rest.backdrop, up.backdrop],
        foundation: [rest.foundation, up.foundation],
        line: [rest.lineTrace, up.lineTrace],
      });
      note("Connection charges progressively (part-way 330 ms after hover) and is fully powered when lifted", mid.line && Math.max(...mid.line) > 0 && Math.min(...mid.line) < 1 && full(up), { mid: mid.line, lifted: up.line });
      note("Shadows follow height (M1.3J.5 strengths): contact eased to ~0.14 at full lift, ambient 0.75", up.lp === 1 && Math.abs(up.contact - 0.1375) < 0.02 && Math.abs(up.ambient - 0.75) < 0.01, { lp: up.lp, contact: up.contact, ambient: up.ambient });
      note("Contact highlight fades with height (M1.3J.5): the unlit floor layer fully in when lifted, no foundation joint", up.unlitOpacity === 1 && rest.unlitOpacity === 0 && up.foundation === null, { unlit: [rest.unlitOpacity, up.unlitOpacity], foundation: up.foundation });
      note("Reflection follows height: dropped 9 px (half the lift), faded to 0.65", up.reflection && Math.abs(up.reflection.y - 9) < 0.1 && Math.abs(up.reflection.opacity - 0.65) < 0.01, up.reflection);
    }
  } finally {
    await page.close();
  }
}

{
  // The lines' area with Playground lifted, minus the station itself (its
  // shadow, reflection and gap are the intended change).
  const k = camera.k;
  const station = [Math.floor((1035 - LINES.x) * k), 0, 9999, Math.ceil((580 - LINES.y) * k)];
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    const d = await compareImages(page, join(OUT, "checks/charged-approved-lines.png"), join(OUT, "checks/charged-experimental-lines.png"), { exclude: [station], heatmapPath: join(OUT, "checks/charged-diff-x40.png") });
    note("Powered: the five connections and the central platform vs the approved build, Playground station excluded (for the notes: the vector core and the line layers drawn through the charge windows)", true, d);
  } finally {
    await page.close();
  }
}

// 3. Drain, return to idle, switching stations, keyboard, reduced motion. -----
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(800);
    await shot(page, join(OUT, "checks/rest-before.png"), STATION);
    await shot(page, join(OUT, "checks/rest-before-lines.png"), LINES);
    const c = await hotspot(page);
    await page.mouseMove(c.x, c.y);
    await sleep(2000);
    await offScene(page);
    const draining = [];
    for (let t = 0; t < 16; t++) {
      await sleep(90);
      draining.push((await state(page)).line);
    }
    await sleep(2000);
    await shot(page, join(OUT, "checks/rest-after.png"), STATION);
    await shot(page, join(OUT, "checks/rest-after-lines.png"), LINES);
    const s = await state(page);
    const d = await compare(join(OUT, "checks/rest-before.png"), join(OUT, "checks/rest-after.png"), join(OUT, "checks/rest-diff-x40.png"));
    const dl = await compare(join(OUT, "checks/rest-before-lines.png"), join(OUT, "checks/rest-after-lines.png"));
    // Each sample: [part at the A, part at the station]. Draining runs from
    // the station end back toward the A: the station part empties first.
    const stationFirst = draining.some((l) => l && l[1] < 0.5 && l[0] > 0.5);
    const decreasing = draining.every((l, k) => !k || (l[0] <= draining[k - 1][0] + 1e-3 && l[1] <= draining[k - 1][1] + 1e-3));
    note("Drain: on leave the connection retracts toward the A (station end first, never refilling)", stationFirst && decreasing, { draining });
    note("Return to idle: station down, --lp 0, reflection home, line unpowered; the area matches idle", s.lift.y === 0 && s.lp === 0 && s.reflection.y === 0 && none(s) && d.max <= 2 && dl.over12 === 0, { lift: s.lift, lp: s.lp, reflection: s.reflection, line: s.line, station: d, lines: dl });

    // Switching: Playground -> Engineering mid-lift -> away. No stale state.
    await page.mouseMove(c.x, c.y);
    await sleep(900);
    const e = await hotspot(page, "engineering");
    await page.mouseMove(e.x, e.y);
    await sleep(1500);
    const onEng = await state(page);
    await offScene(page);
    await sleep(2400);
    const after = await state(page);
    note("Switching to Engineering mid-lift: Playground drops, its line drains, nothing left on", onEng.lift.y === 0 && onEng.lp === 0 && none(onEng) && after.lift.y === 0 && none(after) && after.visible === "hidden", { onEngineering: { lift: onEng.lift, lp: onEng.lp, line: onEng.line }, after: { lift: after.lift, line: after.line, visible: after.visible } });

    await page.eval(`document.querySelector("#station-playground-trigger").focus(), true`);
    await sleep(2200);
    const on = await state(page);
    await page.eval(`document.activeElement.blur(), true`);
    await sleep(1800);
    const off = await state(page);
    note("Keyboard focus powers and lifts the station; blur lowers it and drains the line", Math.abs(on.lift.y + 18) < 0.2 && full(on) && on.lp === 1 && off.lift.y === 0 && off.lp === 0 && none(off), { focused: { lift: on.lift, line: on.line, lp: on.lp }, blurred: { lift: off.lift, line: off.line, lp: off.lp } });
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
    await sleep(700);
    const s = await state(page);
    const dim = await page.eval(`[...document.querySelectorAll('[data-charge-window="playground"][data-charge-kind="dim"]')].map((w) => +getComputedStyle(w).opacity)`);
    note("Reduced motion: no lift, --lp 0 (no shadow, reflection unmoved), connection shown powered at once", s.lift.y === 0 && s.lp === 0 && s.reflection.y === 0 && dim.every((o) => o === 0), { lift: s.lift, lp: s.lp, reflection: s.reflection, unpoweredOpacity: dim });
  } finally {
    await page.close();
  }
}

// 4. Sheets. ---------------------------------------------------------------------
{
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    await composeGrid(
      page,
      [
        { label: "Approved (default build), lifted, as shipped", path: join(OUT, "checks/lifted-approved-3x.png") },
        { label: "Approved, lifted, shadow layers off", path: join(OUT, "checks/lifted-no-shadow-approved-3x.png") },
        { label: "Experimental 2.5D (M1.3I), lifted", path: join(OUT, "checks/lifted-3x.png") },
        { label: "Experimental 2.5D (M1.3I), lifted, shadows off", path: join(OUT, "checks/lifted-no-shadow-3x.png") },
      ],
      join(OUT, "lift-gap-3x.png"),
      { columns: 1 },
    );
    await composeGrid(
      page,
      [
        { label: "Approved, unpowered", path: join(OUT, "checks/idle-approved-line-3x.png") },
        { label: "Experimental, unpowered (trace layer over a line-free floor)", path: join(OUT, "checks/idle-experimental-line-3x.png") },
        { label: "Approved, charging", path: join(OUT, "checks/charging-approved-line-3x.png") },
        { label: "Experimental, charging", path: join(OUT, "checks/charging-experimental-line-3x.png") },
        { label: "Approved, powered", path: join(OUT, "checks/charged-approved-line-3x.png") },
        { label: "Experimental, powered (lit layer + glow + vector core)", path: join(OUT, "checks/charged-experimental-line-3x.png") },
      ],
      join(OUT, "connections-3x.png"),
      { columns: 2 },
    );
    if (existsSync(join(OUT, "checks/env-creative-rest-3x.png")))
      await composeGrid(
        page,
        [
          { label: "Creative line: approved rest (unpowered line)", path: join(OUT, "checks/env-creative-rest-3x.png") },
          { label: "Creative line: environment layer (no line)", path: join(OUT, "checks/env-creative-environment-3x.png") },
          { label: "Playground line: approved rest", path: join(OUT, "checks/env-playground-rest-3x.png") },
          { label: "Playground line: environment layer (no line)", path: join(OUT, "checks/env-playground-environment-3x.png") },
          { label: "Playground strip reflection: approved rest", path: join(OUT, "checks/env-reflection-rest-3x.png") },
          { label: "Playground strip reflection: environment layer (removed)", path: join(OUT, "checks/env-reflection-environment-3x.png") },
        ],
        join(OUT, "environment-3x.png"),
        { columns: 2 },
      );
  } finally {
    await page.close();
  }
}

// 5. Recording: the connection charges along the floor, Playground rises, the
//    connection stays on the ground, everything returns. ------------------------
if (VIDEO) {
  const r = await recordWebm({
    url: URL_,
    width: W,
    height: H,
    out: join(OUT, "connections.webm"),
    prepare: async (page) => {
      await offScene(page);
      await sleep(600);
    },
    act: async (page) => {
      const c = await hotspot(page);
      await page.mouseMove(c.x, c.y);
      await sleep(3400);
      await offScene(page);
      await sleep(2000);
    },
  });
  console.log(`connections.webm: ${r.frames} captured frames, ${r.seconds} s at ${r.fps} fps`);
}

writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
const bad = lines.filter((l) => l.startsWith("BAD")).length;
console.log(bad ? `${bad} probe(s) failed` : "all probes OK");
process.exitCode = bad ? 1 : 0;
