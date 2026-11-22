#!/usr/bin/env node
// M1.3F evidence: platform power (every station's amber platform strips are
// unpowered at rest and light from the connection's arrival point outward).
//
//   node scripts/visual/platform-power-evidence.mjs --url http://localhost:3000 --out docs/m1.3f [--no-video]
//
// Writes to --out: idle.png, <station>-powered.png, platform-power.webm (real
// time, full lab at desktop size), probes.txt; to --out/checks: a mid-spread
// frame and the overlay on/off difference map. Lightweight: real-time probes
// only, no frame stepping, no benchmarks.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { compareImages, prepare } from "./compare.mjs";
import { recordWebm } from "./record.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", "docs/m1.3f"));
const VIDEO = !argv.includes("--no-video");
const W = 1648;
const H = 928;
const IDS = ["educational", "engineering", "playground", "creative", "experience"];
/** SURGE_ARRIVE_MS (scene-fx.ts). */
const ARRIVE = { educational: 460, engineering: 620, playground: 650, creative: 640, experience: 660 };
mkdirSync(join(OUT, "checks"), { recursive: true });

const lines = [];
const note = (name, ok, detail) => {
  lines.push(`${ok ? "OK  " : "BAD "} ${name}  ${JSON.stringify(detail)}`);
  console.log(lines.at(-1));
};

/** --pw of every station's static overlay, plus the lifted copies and Playground's lift. */
/** A station's power: the mean --pw of its strip parts (M1.3F.1: several parts along the path). */
const PW = `(sel) => { const v = [...document.querySelectorAll(sel)].map((e) => +getComputedStyle(e).getPropertyValue("--pw")); return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) : null; }`;
const STATE = `(() => {
  const pw = ${PW};
  const s = { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null };
  for (const id of ${JSON.stringify(IDS)}) s[id] = pw('.lab-plate-gate > .lab-power-dim[data-power="' + id + '"]');
  for (const id of ["engineering", "playground"]) s[id + "Lift"] = pw('.lab-lift .lab-power-dim[data-power="' + id + '"]');
  const lift = document.querySelector('.lab-lift[data-lift="playground"]:not(.lab-station)');
  const t = getComputedStyle(lift).transform;
  s.playgroundLiftPx = t === "none" ? 0 : +new DOMMatrixReadOnly(t).m42.toFixed(2);
  s.u = +(document.querySelector(".lab-camera").getBoundingClientRect().width / 1672).toFixed(4);
  return s;
})()`;
const state = (page) => page.eval(STATE);

/**
 * Samples one station's power every frame for `ms`, from the moment the
 * lab's hover changes to `until` (a station id, or null for leaving), while
 * `act` moves the pointer.
 */
async function sample(page, id, until, ms, act) {
  const run = page.eval(`new Promise((res) => {
    const target = ${JSON.stringify(until)};
    const mine = [...document.querySelectorAll('.lab-power-dim[data-power="${id}"]')];
    const others = [...document.querySelectorAll(".lab-power-dim")].filter((e) => e.dataset.power !== "${id}");
    const v = (e) => +getComputedStyle(e).getPropertyValue("--pw");
    const out = []; let t0 = null;
    const f = () => {
      const h = document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null;
      if (t0 === null && h === target) t0 = performance.now();
      // first: the most-lit part; all: the least-lit part (every strip lit).
      if (t0 !== null) {
        const parts = mine.map(v);
        out.push({ t: Math.round(performance.now() - t0), pw: Math.max(...parts), all: Math.min(...parts), parts, other: Math.max(...others.map(v)) });
      }
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

// 1. Stills and timing probes (real time) -------------------------------------
{
  const page = await launch({ width: W, height: H, gpu: true });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(800);
    const idle = await state(page);
    note("Idle: every platform unpowered", IDS.every((id) => idle[id] === 0) && idle.engineeringLift === 0 && idle.playgroundLift === 0, idle);
    await page.screenshot(join(OUT, "idle.png"));

    for (const id of IDS) {
      const c = await center(page, id);
      const on = await sample(page, id, id, 1900, () => page.mouseMove(c.x, c.y));
      const start = first(on, (s) => s.pw > 0.005);
      const full = first(on, (s) => s.all >= 0.995);
      const mono = on.every((s, k) => k === 0 || s.parts.every((v, j) => v >= on[k - 1].parts[j] - 1e-6));
      // Path order: when each part (static copy, DOM order = path order per piece) first lights.
      const partStart = on[0].parts.map((_, j) => first(on, (s) => s.parts[j] > 0.005));
      const st = await state(page);
      await page.screenshot(join(OUT, `${id}-powered.png`));
      const ok = start !== null && Math.abs(start - ARRIVE[id]) <= 60 && full !== null && full - start >= 150 && full - start <= 460 && mono && on.every((s) => s.other === 0);
      note(`${id}: unpowered until the energy arrives, then lights along its strips (monotonic), nothing else powers`, ok, {
        arriveMs: ARRIVE[id],
        firstLightMs: start,
        allLitMs: full,
        spreadMs: full !== null && start !== null ? full - start : null,
        partsFirstLightMs: partStart,
        maxOther: Math.max(...on.map((s) => s.other)),
        pw: st[id],
        ...(id === "playground" ? { liftPx: st.playgroundLiftPx, liftExpect: -18 * st.u, inLiftPw: st.playgroundLift } : {}),
        ...(id === "engineering" ? { inLiftPw: st.engineeringLift } : {}),
      });
      if (id === "playground") {
        note("Playground: still lifts 18 px; its strips ride the lift (the lifted copy is powered with it)", Math.abs(st.playgroundLiftPx + 18 * st.u) < 0.1 && st.playgroundLift === 1, { liftPx: st.playgroundLiftPx, expect: +(-18 * st.u).toFixed(2), inLiftPw: st.playgroundLift });
      }
      const off = await sample(page, id, null, 900, () => offScene(page));
      const zero = first(off, (s) => s.pw <= 0.001);
      const drainMono = off.every((s, k) => k === 0 || s.pw <= off[k - 1].pw + 1e-6);
      note(`${id}: leaving drains it back to the arrival point and it ends unpowered`, zero !== null && zero <= 500 && drainMono && off.at(-1).pw === 0, { drainedMs: zero, end: off.at(-1).pw });
      await sleep(500);
    }

    // A frame mid-spread (Experience, the widest platform): every animation
    // is paused in-page once the front is under halfway, for the still only.
    {
      const c = await center(page, "experience");
      const held = page.eval(`new Promise((res) => {
        const el = document.querySelector('.lab-power-dim[data-power="experience"]');
        const f = () => { const pw = +getComputedStyle(el).getPropertyValue("--pw"); if (pw >= 0.4) { document.getAnimations().forEach((a) => a.pause()); res(pw); } else requestAnimationFrame(f); };
        requestAnimationFrame(f);
      })`);
      await page.mouseMove(c.x, c.y);
      const pw = await held;
      await page.screenshot(join(OUT, "checks", "experience-mid-spread.png"));
      await page.eval(`document.getAnimations().forEach((a) => a.play()), true`);
      note("Experience mid-spread frame captured (partly powered)", pw > 0 && pw < 1, { pw: +pw.toFixed(3) });
      await offScene(page);
      await sleep(1200);
    }

    // Leaving before the energy arrives: the platform never lights.
    {
      const c = await center(page, "playground");
      const s = await sample(page, "playground", "playground", 1300, async () => {
        await page.mouseMove(c.x, c.y);
        await sleep(300);
        await offScene(page);
      });
      note("Early exit (300 ms, before arrival): Playground's strips never light", Math.max(...s.map((x) => x.pw)) === 0, { maxPw: Math.max(...s.map((x) => x.pw)) });
      await sleep(600);
    }

    // Fast switching: only the last station ends powered.
    {
      for (const id of ["engineering", "playground", "educational"]) {
        const c = await center(page, id);
        await page.mouseMove(c.x, c.y);
        await sleep(id === "educational" ? 0 : 220);
      }
      const c = await center(page, "creative");
      await page.mouseMove(c.x, c.y);
      await sleep(1600);
      const s = await state(page);
      note("Fast switching (Engineering → Playground → Educational → Creative): only Creative powered", s.creative === 1 && ["educational", "engineering", "playground", "experience"].every((k) => s[k] === 0) && s.playgroundLift === 0, s);
      // Powered station → another: the first drains while the second charges.
      const e = await center(page, "experience");
      await page.mouseMove(e.x, e.y);
      await sleep(700);
      const s2 = await state(page);
      note("Switching from a powered station: it drains, the new one powers", s2.creative === 0 && s2.experience > 0, { creative: s2.creative, experience: s2.experience });
      await offScene(page);
      await sleep(1200);
    }

    // Keyboard focus.
    {
      await page.eval(`document.querySelector("#station-educational-trigger").focus(), true`);
      await sleep(ARRIVE.educational + 600);
      const s = await state(page);
      await page.eval(`document.activeElement.blur(), true`);
      await sleep(800);
      const s2 = await state(page);
      note("Keyboard focus powers the platform the same way; blur unpowers it", s.hover === "educational" && s.educational === 1 && s2.educational === 0, { focused: s.educational, blurred: s2.educational });
    }

    // Selection (click) and back.
    {
      const c = await center(page, "creative");
      await page.click(c.x, c.y);
      await sleep(1500);
      const s = await state(page);
      await page.key("Escape", "Escape", 27);
      await sleep(400);
      const s2 = await state(page);
      await page.eval(`document.activeElement?.blur?.(), true`);
      await offScene(page);
      await sleep(1600);
      const s3 = await state(page);
      note("Click: selected station powered (others not); Escape keeps it while focused; then unpowered", s.selected === "creative" && s.creative === 1 && s.experience === 0 && s2.creative === 1 && s3.creative === 0 && !s3.selected, {
        selected: s.creative,
        afterEscape: s2.creative,
        rest: s3.creative,
      });
    }

    // Composition: identical outside the strips with and without the overlays.
    {
      await offScene(page);
      await sleep(400);
      await page.freezeAnimations(0);
      await page.screenshot(join(OUT, "checks", "idle-frozen.png"));
      await page.eval(`(document.head.insertAdjacentHTML("beforeend", "<style data-no-power>.lab-power-dim{display:none!important}</style>"), true)`);
      await sleep(200);
      await page.screenshot(join(OUT, "checks", "idle-frozen-no-overlay.png"));
      await page.eval(`(document.querySelector("style[data-no-power]").remove(), true)`);
      const boxes = await page.eval(`[...document.querySelectorAll(".lab-power-dim")].filter((e) => !e.closest(".lab-lift")).map((e) => { const b = e.getBoundingClientRect(); return [Math.floor(b.left) - 1, Math.floor(b.top) - 1, Math.ceil(b.right) + 1, Math.ceil(b.bottom) + 1]; })`);
      const cmp = await launch({ width: 400, height: 300 });
      try {
        await prepare(cmp);
        const outside = await compareImages(cmp, join(OUT, "checks", "idle-frozen.png"), join(OUT, "checks", "idle-frozen-no-overlay.png"), { exclude: boxes });
        const all = await compareImages(cmp, join(OUT, "checks", "idle-frozen.png"), join(OUT, "checks", "idle-frozen-no-overlay.png"), { heatmapPath: join(OUT, "checks", "overlay-difference.png"), gain: 3 });
        // 1/255 at a few layer-edge pixels is 8-bit compositing rounding.
        note("Room composition: overlays change nothing outside the five strip boxes (≤ 1/255)", outside.max <= 1 && outside.over2 === 0, { outside, inside: { max: all.max, over12: all.over12 } });
      } finally {
        await cmp.close();
      }
    }
  } finally {
    await page.close();
  }
}

// 2. Reduced motion ---------------------------------------------------------------
{
  const page = await launch({ width: W, height: H, reducedMotion: true });
  try {
    await page.goto(URL_);
    await offScene(page);
    await sleep(500);
    const c = await center(page, "experience");
    await page.mouseMove(c.x, c.y);
    await sleep(350);
    const on = await page.eval(`(() => { const e = document.querySelector('.lab-power-dim[data-power="experience"]'); const cs = getComputedStyle(e); return { opacity: +cs.opacity, mask: cs.maskImage || cs.webkitMaskImage, surge: getComputedStyle(document.querySelector(".lab-surge")).display }; })()`);
    await offScene(page);
    await sleep(450);
    const off = await page.eval(`+getComputedStyle(document.querySelector('.lab-power-dim[data-power="experience"]')).opacity`);
    await page.screenshot(join(OUT, "checks", "reduced-motion-idle.png"));
    note("Reduced motion: powered at once by a short cross-fade, no front, no travelling light", on.opacity === 0 && on.mask === "none" && on.surge === "none" && off === 1, { on, offOpacity: off });
  } finally {
    await page.close();
  }
}

// 3. Recording: real time, full lab at desktop size --------------------------------
if (VIDEO) {
  const r = await recordWebm({
    url: URL_,
    width: W,
    height: H,
    out: join(OUT, "platform-power.webm"),
    prepare: async (page) => {
      await offScene(page);
      await sleep(600);
    },
    act: async (page) => {
      for (const id of ["educational", "playground", "creative", "experience", "engineering"]) {
        const c = await center(page, id);
        await page.mouseMove(c.x, c.y);
        await sleep(id === "playground" ? 2300 : 1900);
        await offScene(page);
        await sleep(1100);
      }
    },
  });
  console.log(`platform-power.webm: ${r.frames} captured frames, ${r.seconds} s at ${r.fps} fps`);
}

writeFileSync(join(OUT, "probes.txt"), lines.join("\n") + "\n");
const bad = lines.filter((l) => l.startsWith("BAD")).length;
console.log(bad ? `${bad} probe(s) failed` : "all probes OK");
process.exitCode = bad ? 1 : 0;
