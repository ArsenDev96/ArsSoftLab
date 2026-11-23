// station-switching.webm: the real page, its own animations stepped 1/30 s at a time (this GPU can't screencast the
// page smoothly), encoded at their true timing. Every switch goes straight from one station to the next.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeWebm } from "../../../scripts/visual/encode-webm.mjs";
import { ARRIVE, BASE, IDS, POWERED, REST, ROOT, SEQ, open, sleep } from "./lib.mjs";

const FPS = 30;
const DT = 1000 / FPS;
const { page, hover, off, read, shot } = await open("/lab-v2");
await page.eval(`(window.__step = (dt) => { for (const a of document.getAnimations()) { if (!a.__seen) { a.__seen = true; a.pause(); a.currentTime = 0; } const end = a.effect.getComputedTiming().endTime; const t = (Number(a.currentTime) || 0) + dt; if (end !== Infinity && t >= end) a.finish(); else a.currentTime = t; } return 1; }, 1)`);
const images = [], seq = [];
const grab = async () => images.push((await page.send("Page.captureScreenshot", { format: "jpeg", quality: 86 })).data) - 1;
const frames = async (ms) => {
  for (let t = 0; t < ms; t += DT) {
    await page.eval(`(window.__step(${DT}), new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))))`);
    seq.push([await grab(), DT]);
  }
};
const log = [];
seq.push([await grab(), 600]);
for (const id of ["engineering", "educational", "playground", "creative", "experience", "engineering"]) {
  await hover(id);
  await sleep(30);
  await frames(ARRIVE[id] + SEQ[id] + 500);
  const s = await read();
  log.push([id, { powered: POWERED[id](s[id]), others_at_rest: IDS.filter((o) => o !== id).every((o) => REST[o](s[o])) }]);
}
for (const id of ["educational", "playground", "experience", "creative", "engineering", "educational", "playground", "experience"]) {
  await hover(id);
  await sleep(20);
  await frames(230);
}
await frames(ARRIVE.experience + SEQ.experience + 300);
log.push(["after the sweep", { experience_powered: POWERED.experience((await read()).experience), others_at_rest: await read().then((s) => IDS.filter((o) => o !== "experience").every((o) => REST[o](s[o]))) }]);
await off();
await sleep(160);
await frames(1300);
const end = await read();
log.push(["at the end", { all_at_rest: IDS.every((o) => REST[o](end[o])) }]);
seq.push([await grab(), 700]);
await page.close();
const r = await encodeWebm({ images, sequence: seq, origin: BASE + "/icon.svg" });
writeFileSync(join(ROOT, "docs/m1.4i/station-switching.webm"), r.file);
console.log(JSON.stringify({ frames: images.length, encoded: r.frames, kb: Math.round(r.file.length / 1024), seconds: +(seq.reduce((t, [, m]) => t + m, 0) / 1000).toFixed(1), log }));
