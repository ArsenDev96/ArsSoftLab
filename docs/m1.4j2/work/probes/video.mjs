// M1.4J.2 video, frame-stepped (the office GPU can't screencast the page smoothly): the real page, every animation paused and
// moved 1/60 s at a time, each frame encoded at its true time. Its smoothness is not a performance result.
//   node video.mjs <out.webm>
import { writeFileSync } from "node:fs";
import { encodeWebm } from "../../../../scripts/visual/encode-webm.mjs";
import { ARRIVE, BASE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2], DT = 1000 / 60, A = ARRIVE.educational;
const L = await open("/lab-v2", { gpu: true });
const { page, cam } = L;
const C = { x: 518, y: 206, w: 640, h: 400 };
await page.eval(`(window.__step = (dt) => { for (const a of document.getAnimations()) { if (!a.__seen) { a.__seen = true; a.pause(); a.currentTime = 0; } const end = a.effect.getComputedTiming().endTime; const t = (Number(a.currentTime) || 0) + dt; if (end !== Infinity && t >= end) a.finish(); else a.currentTime = t; } return 1; }, 1)`);
// New transitions are caught before they run: paused at the moment they start.
await page.eval(`(() => { const hold = (e) => { for (const a of document.getAnimations()) if (!a.__seen) { a.__seen = true; a.pause(); a.currentTime = 0; } }; document.addEventListener("transitionrun", hold, true); document.addEventListener("animationstart", hold, true); return 1; })()`);
const images = [], seq = [], log = [];
let clock = 0;
const grab = async () => {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([page.send("Page.captureScreenshot", { format: "jpeg", quality: 90, clip: { x: cam.x + C.x * cam.k, y: cam.y + C.y * cam.k, width: C.w * cam.k, height: C.h * cam.k, scale: 1.5 / cam.k } }).catch(() => null), sleep(8000)]);
    if (r?.data) return images.push(r.data) - 1;
  }
  throw new Error("no frame");
};
const run = async (ms) => {
  for (let t = 0; t < ms - 1e-6; t += DT) {
    const y = await page.eval(`(window.__step(${DT}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => { const t = getComputedStyle(document.querySelector(".edu-v2 .edu-rise")).transform; r(t === "none" ? 0 : +(-new DOMMatrix(t).f).toFixed(2)); }))))`);
    seq.push([await grab(), DT]);
    clock += DT;
    log.push([Math.round(clock), y]);
  }
};
const hold = async (ms) => { seq.push([seq.length ? seq.at(-1)[0] : await grab(), ms]); clock += ms; };
const c = await page.center('[data-hotspot="educational"]');
const on = async (x = c.x, y = c.y) => { await page.mouseMove(x, y); await sleep(40); };
// The page's own 90 ms hover grace runs in real time; the stepped clock stands still meanwhile.
const off = async () => { await L.away(); await sleep(60); };
await grab(); await hold(500);
await on(); await run(A + 1700); await hold(500);
await off(); await run(1100);
// Left during the rise.
await on(); await run(A + 300); await off(); await run(900);
// Quick return while it sinks.
await on(); await run(A + 1000); await off(); await run(200); await on(); await run(A + 1300);
// Across the hover bridge to AriMap.
const chip = await page.center('section[data-station="educational"] li:nth-child(1) button');
for (let k = 1; k <= 40; k++) { await page.mouseMove(c.x + ((chip.x - c.x) * k) / 40, c.y + ((chip.y - c.y) * k) / 40); await run(DT); }
await run(500);
await off(); await run(1100); await hold(400);
const hovered = await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
await page.close();
const r = await encodeWebm({ images, sequence: seq, origin: BASE + "/icon.svg", bitrate: 9e6 });
writeFileSync(OUT, r.file);
console.log(JSON.stringify({ captured: images.length, encoded: r.frames, seconds: +(seq.reduce((t, [, m]) => t + m, 0) / 1000).toFixed(1), kb: Math.round(r.file.length / 1024), w: r.width, h: r.height, hovered, maxY: Math.max(...log.map((x) => x[1])), largestStep: Math.max(...log.slice(1).map((x, i) => Math.abs(x[1] - log[i][1]))) }));
process.exit(0);
