// M1.4I.1B: what must not change. Seeked frames of an ordinary visit and an ordinary leave, the stable and idle
// looks, selection, and the keyboard / Escape / Back / direct link / reduced-motion behaviour.
//   node docs/m1.4i1/work/eng-approved.mjs <label>          captures + behaviour
//   node docs/m1.4i1/work/eng-approved.mjs compare a b      pixel differences
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";
import { open as openLab, POWERED, READ, REST } from "../../m1.4i/work/lib.mjs";
import { open } from "./eng-return.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ON_TIMES = [0, 300, 600, 625, 680, 720, 760, 800, 840, 880, 920, 960, 1000, 1040, 1080, 1120, 1160, 1190, 1230, 1500, 1700];
const OFF_TIMES = [30, 70, 110, 150, 200, 250, 300, 350, 395, 420, 600];
const BOX = { x: 225, y: 375, w: 420, h: 310 }; // Engineering, its floor and label
const NAMES = [...ON_TIMES.map((t) => `on-${t}`), ...OFF_TIMES.map((t) => `off-${t}`), "idle", "stable", "idle-after", "deeplink", "reduced-on", "reduced-idle"];

if (process.argv[2] === "compare") {
  const [a, b] = process.argv.slice(3);
  const page = await launch();
  await prepare(page);
  let worst = 0;
  for (const n of NAMES) {
    const r = await compareImages(page, join(HERE, `eng-${a}`, `${n}.png`), join(HERE, `eng-${b}`, `${n}.png`));
    worst = Math.max(worst, r.max);
    console.log(n.padEnd(14), `max ${r.max} over2 ${r.over2} over12 ${r.over12}`);
  }
  console.log("worst", worst);
  await page.close();
  process.exit(0);
}

const label = process.argv[2];
const DIR = join(HERE, `eng-${label}`);
mkdirSync(DIR, { recursive: true });
const clipShot = async (page, cam, name) => {
  const clip = { x: Math.round(cam.x + BOX.x * cam.k), y: Math.round(cam.y + BOX.y * cam.k), width: Math.round(BOX.w * cam.k), height: Math.round(BOX.h * cam.k), scale: 1 };
  writeFileSync(join(DIR, `${name}.png`), Buffer.from((await page.send("Page.captureScreenshot", { format: "png", clip })).data, "base64"));
};

{
  // Seeked frames, as the review captures do it.
  const L = await openLab("/lab-v2", { gpu: true });
  await clipShot(L.page, L.cam, "idle");
  await L.hover("engineering");
  await sleep(120);
  for (const t of ON_TIMES) {
    await L.seek(t);
    await sleep(60);
    await clipShot(L.page, L.cam, `on-${t}`);
  }
  await L.finish();
  await L.finish();
  await L.page.eval("document.getAnimations().forEach((a) => { if (a.playState === 'running' && !(a instanceof CSSTransition)) { a.pause(); a.currentTime = 0; } })");
  await sleep(200);
  await clipShot(L.page, L.cam, "stable");
  await L.away();
  await L.frame();
  for (const t of OFF_TIMES) {
    await L.seek(t);
    await sleep(60);
    await clipShot(L.page, L.cam, `off-${t}`);
  }
  await L.finish();
  await L.finish();
  await sleep(300);
  await clipShot(L.page, L.cam, "idle-after");
  await L.page.close();
}
const out = {};
{
  const L = await openLab("/lab-v2?station=engineering", { gpu: true });
  await L.page.eval("document.getAnimations().forEach((a) => { if (!(a instanceof CSSTransition)) { a.pause(); a.currentTime = 0; } })");
  await sleep(300);
  await clipShot(L.page, L.cam, "deeplink");
  out.deeplink = (await L.read()).engineering;
  await L.page.close();
}
{
  const L = await openLab("/lab-v2", { gpu: true, reducedMotion: true });
  await clipShot(L.page, L.cam, "reduced-idle");
  await L.hover("engineering");
  await sleep(700);
  await clipShot(L.page, L.cam, "reduced-on");
  await L.away();
  await L.page.close();
}

// Behaviour, frame by frame.
const { page, errors, call } = await open();
const brief = (f) => ({ hover: f.hover, sel: f.sel, es: f.es, ef: f.ef, bars: +f.eb.reduce((a, b) => a + b, 0).toFixed(2), off: f.off, stable: f.stable, pw: f.pw });
const stats = (log) => ({ frames: log.length, minEs: Math.min(...log.map((f) => f.es)), minBars: +Math.min(...log.map((f) => f.eb.reduce((a, b) => a + b, 0))).toFixed(2), maxOff: Math.max(...log.map((f) => f.off)), scanFrames: log.filter((f) => f.band > 0.02).length, capFrames: log.filter((f) => f.caps > 0.02).length, hovers: [...new Set(log.map((f) => `${f.hover}/${f.sel}`))], end: brief(log.at(-1)) });
const rec = async (act, ms) => {
  await page.eval("(window.__q.start(), 1)");
  await act();
  await sleep(ms);
  return call("window.__q.stop()");
};
const rest = async () => { for (let i = 0; i < 100 && !(await page.eval("window.__q.rest()")); i++) await sleep(60); };
const title = `document.getElementById("station-engineering-trigger")`;
const tabTo = async () => { for (let i = 0; i < 30; i++) { await page.key("Tab", "Tab", 9); if (await page.eval(`document.activeElement === ${title}`)) return i + 1; } return null; };

out.keyboardFocus = { tabs: null };
let log = await rec(async () => { out.keyboardFocus.tabs = await tabTo(); }, 1800);
Object.assign(out.keyboardFocus, stats(log));
log = await rec(() => page.key("Enter", "Enter", 13), 1500);
out.enterSelects = stats(log);
log = await rec(() => page.key("Escape", "Escape", 27), 1800);
out.escapeKeyboard = { ...stats(log), focusBack: await page.eval(`document.activeElement === ${title}`) };
log = await rec(() => page.key("Tab", "Tab", 9), 900);
out.tabOn = stats(log);
await page.eval("(document.activeElement.blur(), 1)");
await rest();

const c = await page.center('[data-hotspot="engineering"]');
log = await rec(async () => { await page.mouseMove(c.x, c.y); await sleep(1700); await page.click(c.x, c.y); }, 1500);
out.click = stats(log);
log = await rec(() => page.key("Escape", "Escape", 27), 1800);
out.escapePointerOver = stats(log);
await page.mouseMove(4, 924);
await page.eval("(document.activeElement.blur(), 1)");
await rest();

// Click while the spark is travelling, then Escape with the pointer away.
log = await rec(async () => { await page.mouseMove(c.x, c.y); await sleep(300); await page.click(c.x, c.y); }, 1800);
out.clickWhileCharging = stats(log);
await page.mouseMove(4, 924);
await sleep(300);
log = await rec(() => page.key("Escape", "Escape", 27), 1800);
out.escapePointerAway = stats(log);
await page.eval("(document.activeElement.blur(), 1)");
await rest();

// Browser Back from a selection.
await page.mouseMove(c.x, c.y);
await sleep(1500);
await page.click(c.x, c.y);
await sleep(1200);
await page.mouseMove(4, 924);
log = await rec(() => page.eval("(history.back(), 1)"), 1800);
out.browserBack = stats(log);
await page.eval("(document.activeElement.blur(), 1)");
await rest();
out.restAtEnd = await page.eval("window.__q.rest()");
out.errors = errors;
await page.close();

// The other stations, powered and back to rest.
{
  const L = await openLab("/lab-v2", { gpu: true });
  out.others = {};
  for (const id of ["educational", "playground", "creative", "experience", "engineering"]) {
    await L.hover(id);
    const powered = await L.settle((s) => POWERED[id](s[id]));
    await L.away();
    out.others[id] = { powered, rest: await L.settle((s) => REST[id](s[id])) };
  }
  out.othersErrors = L.errors;
  await L.page.close();
}
writeFileSync(join(HERE, `eng-approved-${label}.json`), JSON.stringify(out, null, 1) + "\n");
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
process.exit(0);
