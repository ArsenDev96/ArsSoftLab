// M1.4I.1D: Experience's floor left of the platform (the corrected disc): never brighter in a quick return than powered.
import { open as openLab, sleep } from "../../m1.4i/work/lib.mjs";
import { LIB, STATIONS } from "./qr-lib.mjs";
const id = "experience", A = STATIONS[id].arrive;
const L = await openLab("/lab-v2", { gpu: true });
await L.page.eval(LIB(id));
const k = L.cam.k, R = { x: L.cam.x + 1036 * k, y: L.cam.y + 735 * k, width: 150 * k, height: 130 * k, scale: 1 };
const lum = async () => {
  const d = (await L.page.send("Page.captureScreenshot", { format: "png", clip: R })).data;
  return L.page.eval(`(async () => { const i = new Image(); i.src = "data:image/png;base64,${d}"; await i.decode(); const c = new OffscreenCanvas(i.width, i.height), g = c.getContext("2d"); g.drawImage(i, 0, 0); const p = g.getImageData(0, 0, i.width, i.height).data; let s = 0; const v = []; for (let n = 0; n < p.length; n += 4) { const y = 0.2126 * p[n] + 0.7152 * p[n + 1] + 0.0722 * p[n + 2]; s += y; v.push(y); } v.sort((a, b) => a - b); return [+(s / v.length).toFixed(2), +v[Math.floor(v.length * 0.99)].toFixed(1)]; })()`);
};
console.log("idle   mean, 99%:", await lum());
await L.hover(id);
await sleep(A + 2000);
const full = await lum();
console.log("powered mean, 99%:", full);
let worst = [0, 0];
for (const [at, gap] of [[100, 40], [160, 90], [250, 60], [400, 100], [600, 60], [800, 140], [1050, 60], [1400, 20], [1400, 200]]) {
  await L.away();
  for (let i = 0; i < 120 && !(await L.page.eval("window.__q.rest()")); i++) await sleep(60);
  const row = [];
  for (const t of [100, A - 40, A + 30, A + 120, A + 260, A + 500]) {
    await L.away();
    for (let i = 0; i < 120 && !(await L.page.eval("window.__q.rest()")); i++) await sleep(60);
    await L.hover(id);
    await sleep(A + at - 90);
    await L.off();
    await L.page.eval(`window.__q.until(() => window.__q.hov() === null)`);
    await sleep(gap);
    await L.hover(id);
    await L.page.eval(`window.__q.until(() => window.__q.hov() === "${id}").then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => 1)`);
    await L.seek(t);
    await sleep(120);
    const v = await lum();
    worst = [Math.max(worst[0], v[0]), Math.max(worst[1], v[1])];
    row.push(v[0]);
    await L.page.eval("(document.getAnimations().forEach((x) => x.play()), 1)");
  }
  console.log(`left ${at}, gap ${gap}: mean at +100 / just before / +30 / +120 / +260 / +500 after arrival:`, row.join(" "));
}
console.log("highest anywhere mean, 99%:", worst, "powered", full);
await L.page.close();
process.exit(0);
