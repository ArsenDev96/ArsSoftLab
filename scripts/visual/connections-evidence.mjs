#!/usr/bin/env node
// M1.3G evidence: the five power connections (unpowered at rest, charged
// behind the spark from the A, draining back on leave) and their timing
// against the platform strips.
//
//   node scripts/visual/connections-evidence.mjs --url http://localhost:3000 --out docs/m1.3g [--no-video]
//
// Writes to --out: idle.png, <station>-powered.png, closeups.png (every
// connection at rest and powered), connections.webm (real time), probes.txt;
// --out/checks: a mid-charge frame. Lightweight: real-time probes, no
// frame stepping, no benchmarks.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { composeGrid, prepare } from "./compare.mjs";
import { recordWebm } from "./record.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", "docs/m1.3g"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
const IDS = ["educational", "engineering", "playground", "creative", "experience"];
/** SURGE_ARRIVE_MS (scene-fx.ts); the spark lands 50 ms earlier (EnergySurge). */
const ARRIVE = { educational: 460, engineering: 620, playground: 650, creative: 640, experience: 660 };
mkdirSync(join(OUT, "checks"), { recursive: true });

// Route boxes (scene px) for the close-ups, from the generated route files.
const ROOT = resolve(import.meta.dirname, "../..");
const routesTs = readFileSync(join(ROOT, "components/lab/charge-routes.ts"), "utf8");
const BOXES = Object.fromEntries(Object.entries(JSON.parse(routesTs.slice(routesTs.indexOf("= {") + 2).replace(/;\s*$/, ""))).map(([id, r]) => [id, r.box]));
{
  const pg = readFileSync(join(ROOT, "components/lab/playground-route.ts"), "utf8");
  const pts = JSON.parse(pg.match(/PLAYGROUND_ROUTE[^=]*= (\[\[.*?\]\]);/s)[1]);
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  BOXES.playground = { x: Math.min(...xs) - 30, y: Math.min(...ys) - 30, w: Math.max(...xs) - Math.min(...xs) + 60, h: Math.max(...ys) - Math.min(...ys) + 60 };
}

const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};

/**
 * In-page: a station's line charge (each part's charge window: how far it
 * has moved, 0 = unpowered, 1 = powered) and its platform power (--pw).
 */
const MEASURE = `(id) => {
  const u = document.querySelector(".lab-camera").getBoundingClientRect().width / 1672;
  const parts = [...document.querySelectorAll('[data-charge-window="' + id + '"][data-charge-kind="dim"]')].map((w) => {
    const t = getComputedStyle(w).transform;
    const s = (t === "none" ? 0 : new DOMMatrixReadOnly(t).m41) / u;
    const span = w.offsetWidth / u - 40;
    return Math.max(0, Math.min(1, s / span));
  });
  const pw = [...document.querySelectorAll('.lab-plate-gate > .lab-power-dim[data-power="' + id + '"]')].map((e) => +getComputedStyle(e).getPropertyValue("--pw"));
  return { line: parts.reduce((a, b) => a + b, 0) / parts.length, lineMin: Math.min(...parts), parts, plat: Math.max(...pw) };
}`;
const measure = (page, id) => page.eval(`(${MEASURE})(${JSON.stringify(id)})`);
const allLines = (page) => page.eval(`Object.fromEntries(${JSON.stringify(IDS)}.map((id) => [id, +(${MEASURE})(id).line.toFixed(3)]))`);

/** Samples a station every frame for `ms` from when the lab's hover becomes `until`, while `act` runs. */
async function sample(page, id, until, ms, act) {
  const run = page.eval(`new Promise((res) => {
    const m = ${MEASURE};
    const out = []; let t0 = null;
    const f = () => {
      const h = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null;
      if (t0 === null && h === ${JSON.stringify(until)}) t0 = performance.now();
      if (t0 !== null) out.push({ t: Math.round(performance.now() - t0), ...m(${JSON.stringify(id)}) });
      if (t0 === null || performance.now() - t0 < ${ms}) requestAnimationFrame(f); else res(out);
    };
    requestAnimationFrame(f);
  })`);
  await sleep(30);
  await act();
  return run;
}
const first = (s, pred) => s.find(pred)?.t ?? null;
const offScene = (page) => page.mouseMove(4, H - 4);
const center = (page, id) => page.center(`[data-hotspot="${id}"]`);

// 1. Stills and probes (real time) --------------------------------------------
let scale = 1;
{
  const page = await launch({ width: W, height: H, gpu: true });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(800);
    scale = await page.eval(`document.querySelector(".lab-camera").getBoundingClientRect().width / 1672`);
    const idle = await allLines(page);
    const unpowered = await page.eval(`[...document.querySelectorAll(".lab-charge-unpowered")].every((e) => +getComputedStyle(e).opacity === 1)`);
    note("Idle: all five connections unpowered, no energy moving", Object.values(idle).every((v) => v === 0) && unpowered && (await page.eval(`document.getAnimations().filter((a) => a.playState === "running" && a.effect?.target?.closest?.(".lab-surge")).length`)) === 0, { idle, unpowered });
    await page.screenshot(join(OUT, "idle.png"));

    for (const id of IDS) {
      const c = await center(page, id);
      const on = await sample(page, id, id, ARRIVE[id] + 1100, () => page.mouseMove(c.x, c.y));
      const lineStart = first(on, (s) => s.line > 0.01);
      const lineFull = first(on, (s) => s.lineMin >= 0.99);
      const platStart = first(on, (s) => s.plat > 0.005);
      const mid = on.find((s) => s.t >= (ARRIVE[id] - 50) / 2);
      const mono = on.every((s, k) => k === 0 || s.line >= on[k - 1].line - 1e-4);
      const others = await allLines(page);
      await page.screenshot(join(OUT, `${id}-powered.png`));
      note(`${id}: charges progressively from the A behind the spark, fully powered as it arrives; platform only after arrival`,
        lineStart !== null && lineStart < 200 && mono && mid.line > 0.15 && mid.line < 0.85 && lineFull !== null && Math.abs(lineFull - (ARRIVE[id] - 50)) <= 80 && platStart !== null && platStart >= ARRIVE[id] - 20 && Object.entries(others).every(([k, v]) => k === id || v === 0),
        { arriveMs: ARRIVE[id], lineStartMs: lineStart, halfwayLine: +mid.line.toFixed(2), lineFullMs: lineFull, platformFirstLightMs: platStart, othersPowered: Object.entries(others).filter(([k, v]) => k !== id && v > 0).map(([k]) => k) });
      const off = await sample(page, id, null, 1500, () => offScene(page));
      const lineZero = first(off, (s) => s.line <= 0.001);
      const platZero = first(off, (s) => s.plat <= 0.001);
      const drainMono = off.every((s, k) => k === 0 || s.line <= off[k - 1].line + 1e-4);
      note(`${id}: leaving drains the platform, then the line back to the A; nothing stays powered`, lineZero !== null && platZero !== null && platZero <= lineZero && drainMono && off.at(-1).line === 0 && off.at(-1).plat === 0, { platformDrainedMs: platZero, lineDrainedMs: lineZero });
      await sleep(400);
    }

    // A frame mid-charge (Experience): animations paused in-page once the line is ~half charged.
    {
      const c = await center(page, "experience");
      const held = page.eval(`new Promise((res) => { const m = ${MEASURE}; const f = () => { const s = m("experience"); if (s.line >= 0.5) { document.getAnimations().forEach((a) => a.pause()); res(s); } else requestAnimationFrame(f); }; requestAnimationFrame(f); })`);
      await page.mouseMove(c.x, c.y);
      const s = await held;
      await page.screenshot(join(OUT, "checks", "experience-mid-charge.png"));
      await page.eval(`document.getAnimations().forEach((a) => a.play()), true`);
      note("Mid-charge frame: line part-charged behind the spark, platform still unpowered", s.line > 0 && s.line < 1 && s.plat === 0, { line: +s.line.toFixed(2), parts: s.parts.map((v) => +v.toFixed(2)), platform: s.plat });
      await offScene(page);
      await sleep(1600);
    }

    // Leaving before arrival.
    {
      const c = await center(page, "creative");
      const s = await sample(page, "creative", "creative", 1800, async () => {
        await page.mouseMove(c.x, c.y);
        await sleep(260);
        await offScene(page);
      });
      note("Early exit (260 ms): the line drains back, the platform never powers", Math.max(...s.map((x) => x.plat)) === 0 && s.at(-1).line === 0 && Math.max(...s.map((x) => x.line)) < 0.7, { maxLine: +Math.max(...s.map((x) => x.line)).toFixed(2), maxPlatform: Math.max(...s.map((x) => x.plat)), endLine: s.at(-1).line });
    }

    // Rapid switching: only the last station ends powered.
    {
      for (const id of ["engineering", "educational", "experience"]) {
        const c = await center(page, id);
        await page.mouseMove(c.x, c.y);
        await sleep(180);
      }
      const c = await center(page, "creative");
      await page.mouseMove(c.x, c.y);
      await sleep(ARRIVE.creative + 1500);
      const all = await allLines(page);
      note("Rapid switching (Engineering → Educational → Experience → Creative): only Creative's line powered", all.creative >= 0.99 && Object.entries(all).every(([k, v]) => k === "creative" || v === 0), all);
      await offScene(page);
      await sleep(1600);
    }

    // Repeated quick hovers end clean.
    {
      const c = await center(page, "engineering");
      for (let k = 0; k < 4; k++) {
        await page.mouseMove(c.x, c.y);
        await sleep(150);
        await offScene(page);
        await sleep(120);
      }
      await sleep(1600);
      const all = await allLines(page);
      note("Repeated quick hovers: everything back to unpowered", Object.values(all).every((v) => v === 0), all);
    }

    // Keyboard focus and blur.
    {
      await page.eval(`document.querySelector("#station-experience-trigger").focus(), true`);
      await sleep(ARRIVE.experience + 600);
      const on = await measure(page, "experience");
      await page.eval(`document.activeElement.blur(), true`);
      await sleep(1600);
      const off = await measure(page, "experience");
      note("Keyboard focus charges the line and powers the platform; blur drains both", on.lineMin >= 0.99 && on.plat === 1 && off.line === 0 && off.plat === 0, { focused: on, blurred: { line: off.line, plat: off.plat } });
    }

    // Click during charging, then Escape.
    {
      const c = await center(page, "educational");
      await page.mouseMove(c.x, c.y);
      await sleep(200);
      await page.click(c.x, c.y);
      await sleep(900);
      const sel = await page.eval(`(() => ({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, unpowered: +getComputedStyle(document.querySelector('.lab-charge-dim[data-zone="educational"] .lab-charge-unpowered')).opacity }))()`);
      const st = await measure(page, "educational");
      await page.key("Escape", "Escape", 27);
      await page.eval(`document.activeElement?.blur?.(), true`);
      await offScene(page);
      await sleep(1800);
      const after = await allLines(page);
      note("Click while charging: selected, line and platform powered; Escape then leaving: all unpowered", sel.selected === "educational" && (sel.unpowered === 0 || st.lineMin >= 0.99) && st.plat === 1 && Object.values(after).every((v) => v === 0), { ...sel, line: st.lineMin, platform: st.plat, after });
    }
  } finally {
    await page.close();
  }
}

// 2. Direct URL and reduced motion --------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(`${URL_}/?station=experience`);
    await sleep(700);
    const s = await page.eval(`(() => ({ selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, unpowered: Object.fromEntries(${JSON.stringify(IDS)}.map((id) => [id, +getComputedStyle(document.querySelector('.lab-charge-dim[data-zone="' + id + '"] .lab-charge-unpowered')).opacity])) }))()`);
    note("Direct URL (?station=experience): its connection powered at once, the others unpowered", s.selected === "experience" && s.unpowered.experience === 0 && Object.entries(s.unpowered).every(([k, v]) => k === "experience" || v === 1), s);
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
    const c = await center(page, "engineering");
    await page.mouseMove(c.x, c.y);
    await sleep(400);
    const on = await page.eval(`(() => ({ unpowered: +getComputedStyle(document.querySelector('.lab-charge-dim[data-zone="engineering"] .lab-charge-unpowered')).opacity, surge: getComputedStyle(document.querySelector(".lab-surge")).display, lift: getComputedStyle(document.querySelector('.lab-lift[data-lift="engineering"]:not(.lab-station)')).transform }))()`);
    await offScene(page);
    await sleep(500);
    const off = await page.eval(`+getComputedStyle(document.querySelector('.lab-charge-dim[data-zone="engineering"] .lab-charge-unpowered')).opacity`);
    note("Reduced motion: no spark, no lift; the line is powered by a short cross-fade and back", on.unpowered === 0 && on.surge === "none" && on.lift === "none" && off === 1, { on, offUnpowered: off });
  } finally {
    await page.close();
  }
}

// 3. Close-ups: each connection at rest and powered -------------------------------
{
  const page = await launch({ width: 400, height: 300 });
  try {
    await prepare(page);
    const items = IDS.flatMap((id) => {
      const b = BOXES[id];
      const crop = [b.x * scale, b.y * scale, (b.x + b.w) * scale, (b.y + b.h) * scale].map((v) => Math.round(v));
      return [
        { label: `${id}: at rest`, path: join(OUT, "idle.png"), crop },
        { label: `${id}: powered`, path: join(OUT, `${id}-powered.png`), crop },
      ];
    });
    // One sheet per connection (they differ in shape), then listed in NOTES.
    for (let k = 0; k < IDS.length; k++) await composeGrid(page, items.slice(k * 2, k * 2 + 2), join(OUT, `closeup-${IDS[k]}.png`), { columns: 1, scale: 2 });
  } finally {
    await page.close();
  }
}

// 4. Recording -----------------------------------------------------------------------
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
      for (const id of ["educational", "engineering", "creative", "experience", "playground"]) {
        const c = await center(page, id);
        await page.mouseMove(c.x, c.y);
        await sleep(ARRIVE[id] + 1300);
        await offScene(page);
        await sleep(1500);
      }
    },
  });
  console.log(`connections.webm: ${r.frames} captured frames, ${r.seconds} s at ${r.fps} fps`);
}

writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
const bad = lines.filter((l) => l.startsWith("BAD")).length;
console.log(bad ? `${bad} probe(s) failed` : "all probes OK");
process.exitCode = bad ? 1 : 0;
