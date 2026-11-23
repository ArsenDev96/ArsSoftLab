// M1.4I.1D: what must not change. Seeked frames of an ordinary visit and leave, idle, stable, direct link, reduced motion.
//   node qr-approved.mjs <label>            capture        node qr-approved.mjs compare a b      differences
// and what a quick return looks like: node qr-approved.mjs evidence <label>
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";
import { open as openLab } from "../../m1.4i/work/lib.mjs";
import { HERE, LIB, STATIONS } from "./qr-lib.mjs";

const IDS = Object.keys(STATIONS);
// Each station with its floor and label.
const BOX = { creative: { x: 20, y: 500, w: 570, h: 420 }, educational: { x: 640, y: 215, w: 400, h: 375 }, experience: { x: 1025, y: 505, w: 645, h: 415 } };
const AFTER = [-20, 20, 60, 110, 160, 220, 300, 380, 460, 540, 620, 700, 780, 860, 960, 1100];
const OFF = [30, 80, 150, 220, 300, 380, 450, 600];
const NAMES = (id) => ["idle", "on-0", "on-300", ...AFTER.map((t) => `on+${t}`), "stable", ...OFF.map((t) => `off-${t}`), "idle-after", "link", "reduced-idle", "reduced-on"].map((n) => `${id}-${n}`);
const shot = async (L, id, file, scale = 1) => {
  const b = BOX[id], k = L.cam.k;
  const clip = { x: Math.round(L.cam.x + b.x * k), y: Math.round(L.cam.y + b.y * k), width: Math.round(b.w * k), height: Math.round(b.h * k), scale };
  writeFileSync(file, Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png", clip })).data, "base64"));
};
const [cmd, a, b] = process.argv.slice(2);

if (cmd === "compare") {
  const page = await launch();
  await prepare(page);
  for (const id of IDS) {
    const groups = { 0: [], "1-2": [], more: [] };
    for (const n of NAMES(id)) {
      let r = null;
      for (const side of b.split(",")) {
        const c = await compareImages(page, join(HERE, `qr-px-${a}`, `${n}.png`), join(HERE, `qr-px-${side}`, `${n}.png`));
        if (!r || c.max < r.max) r = c;
      }
      groups[r.max === 0 ? 0 : r.max <= 2 ? "1-2" : "more"].push(r.max > 2 ? `${n} max ${r.max} over2 ${r.over2} over12 ${r.over12}` : n.slice(id.length + 1));
    }
    console.log(id, `identical ${groups[0].length}, 1-2 of 255: ${groups["1-2"].length} [${groups["1-2"].join(" ")}], more: ${groups.more.length} ${groups.more.join("; ")}`);
  }
  await page.close();
  process.exit(0);
}

if (cmd === "evidence") {
  // Real pointer: leave part-way, return; then the page stopped at one moment of the new cycle.
  const DIR = join(HERE, `qr-ev-${a}`);
  mkdirSync(DIR, { recursive: true });
  for (const [id, at, gap, moments] of [
    ["creative", 470, 60, { charging: -240, arrived: 200 }],
    ["educational", 100, 40, { pulse: -150 }],
    ["educational", 420, 100, { arrived: 110 }],
    ["experience", 160, 90, { pulse: -240 }],
    ["experience", 500, 60, { arrived: 25 }],
  ])
    for (const [name, t] of Object.entries(moments)) {
      const L = await openLab("/lab-v2", { gpu: true });
      await L.page.eval(LIB(id));
      await L.hover(id);
      await sleep(STATIONS[id].arrive + at - 90);
      await L.off();
      await L.page.eval(`window.__q.until(() => window.__q.hov() === null)`);
      await sleep(gap);
      await L.hover(id);
      await L.page.eval(`window.__q.until(() => window.__q.hov() === "${id}")`);
      await L.page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))).then(() => 1)`);
      await L.seek(STATIONS[id].arrive + t);
      await sleep(250);
      await shot(L, id, join(DIR, `${id}-${name}.png`), 1.5);
      console.log(id, name, JSON.stringify(await L.page.eval("(({ nums, lights, pulse, pw }) => ({ nums, lights, pulse, pw }))(window.__q.sample())")));
      await L.page.close();
    }
  process.exit(0);
}

const DIR = join(HERE, `qr-px-${cmd}`);
mkdirSync(DIR, { recursive: true });
for (const id of IDS) {
  const f = (n) => join(DIR, `${id}-${n}.png`);
  let L = await openLab("/lab-v2", { gpu: true });
  await shot(L, id, f("idle"));
  await L.hover(id);
  await sleep(120);
  for (const t of [0, 300]) {
    await L.seek(t);
    await sleep(70);
    await shot(L, id, f(`on-${t}`));
  }
  for (const t of AFTER) {
    await L.seek(STATIONS[id].arrive + t);
    await sleep(70);
    await shot(L, id, f(`on+${t}`));
  }
  await L.finish();
  await L.finish();
  await L.page.eval("(document.getAnimations().forEach((x) => { if (x.playState === 'running' && !(x instanceof CSSTransition)) { x.pause(); x.currentTime = 0; } }), 1)");
  await sleep(200);
  await shot(L, id, f("stable"));
  await L.away();
  await L.frame();
  for (const t of OFF) {
    await L.seek(t);
    await sleep(70);
    await shot(L, id, f(`off-${t}`));
  }
  await L.finish();
  await L.finish();
  await sleep(300);
  await shot(L, id, f("idle-after"));
  await L.page.close();
  L = await openLab(`/lab-v2?station=${id}`, { gpu: true });
  await L.page.eval("(document.getAnimations().forEach((x) => { if (!(x instanceof CSSTransition)) { x.pause(); x.currentTime = 0; } }), 1)");
  await sleep(300);
  await shot(L, id, f("link"));
  await L.page.close();
  L = await openLab("/lab-v2", { gpu: true, reducedMotion: true });
  await shot(L, id, f("reduced-idle"));
  await L.hover(id);
  await sleep(800);
  await shot(L, id, f("reduced-on"));
  await L.page.close();
}
process.exit(0);
