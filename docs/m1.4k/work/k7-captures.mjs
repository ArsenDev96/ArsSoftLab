// M1.4K: frozen captures (the page's own animations paused at the sequence's own times). 1648 x 928 unless stated.   node k7-captures.mjs <out dir> [set,set]
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, HEIGHT, IDS, SEQ, lab, sleep } from "./core.mjs";
const OUT = process.argv[2], sets = process.argv[3]?.split(",");
const want = (s) => !sets || sets.includes(s);
mkdirSync(OUT, { recursive: true });
const HALF = { engineering: 247, educational: 290, playground: 185, creative: 293, experience: 301 };
const BOX = { engineering: [236, 300, 400, 290], educational: [636, 210, 400, 330], playground: [1040, 290, 400, 300], creative: [60, 490, 520, 330], experience: [1160, 490, 512, 350] };
const END = { engineering: [548, 504, 80, 60], educational: [798, 448, 80, 60], playground: [1060, 500, 100, 75], creative: [470, 664, 90, 68], experience: [1172, 664, 90, 68] };
const FOOT = { engineering: [250, 500, 360, 80], educational: [660, 450, 360, 75], playground: [1050, 490, 350, 90], creative: [90, 720, 440, 90], experience: [1190, 715, 482, 100] };
const HUB = [620, 470, 450, 210];
const info = {};
const shot = async (L, n, r, scale = 1, fmt = "png") => {
  for (let k = 0; k < 5; k++) {
    const clip = r ? { x: L.cam.x + r[0] * L.cam.k, y: L.cam.y + r[1] * L.cam.k, width: r[2] * L.cam.k, height: r[3] * L.cam.k, scale } : undefined;
    const q = await Promise.race([L.page.send("Page.captureScreenshot", { format: fmt, ...(fmt === "jpeg" ? { quality: 93 } : {}), ...(clip ? { clip } : {}) }).catch(() => null), sleep(9000)]);
    if (q?.data) return writeFileSync(`${OUT}/${n}.${fmt === "jpeg" ? "jpg" : "png"}`, Buffer.from(q.data, "base64"));
  }
  throw new Error("no screenshot " + n);
};
const FREEZE = `(() => { const go = () => document.getAnimations().forEach((a) => a.pause()); new MutationObserver((_, o) => { o.disconnect(); go(); queueMicrotask(go); requestAnimationFrame(go); }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`;
const finishAll = (L) => L.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
for (const [tone, path] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"]]) {
  if (want("phases") || want("full")) {
    const L = await lab(path); await L.finish(); await sleep(400);
    if (want("full")) await shot(L, `full-${tone}`);
    await L.page.close();
  }
  if (want("phases")) for (const id of IDS) {
    const L = await lab(path); await L.finish(); await sleep(300);
    const snap = async (p) => { await sleep(300); info[`${tone}-${id}-${p}`] = { y: (await L.st())[id].y, level: (await L.st())[id].level }; await shot(L, `${tone}-${id}-${p}`, BOX[id], 1.6); await shot(L, `${tone}-${id}-${p}.end`, END[id], 6); await shot(L, `${tone}-${id}-${p}.foot`, FOOT[id], 2.4); if (["idle", "stable", "returned"].includes(p)) await shot(L, `${tone}-${id}-${p}.scene`); };
    await snap("idle");
    await L.on(id); await L.frame();
    const A = ARRIVE[id];
    for (const [p, t] of [["spark", -180], ["arrival", 0], ["early", 130], ["half", HALF[id]], ["full", Math.max(SEQ[id], 800)], ["stable", 2400]]) { await L.seek(A + t); await snap(p); }
    await finishAll(L); await sleep(200); await L.page.eval(FREEZE); await L.away(); await L.frame(); await L.seek(150); await snap("partial");
    await finishAll(L); await sleep(1400); await snap("returned");
    console.log(tone, id, "errors", JSON.stringify(L.errors)); await L.page.close();
  }
}
if (want("hub")) { const L = await lab(); await L.finish(); await sleep(300); await shot(L, "hub-rest", HUB, 2.4); for (const id of IDS) { await L.rest(); await L.on(id); await L.settle(() => false, 2600); await shot(L, `hub-${id}`, HUB, 2.4); } await L.page.close(); }
if (want("seams")) {
  const L = await lab(); await L.finish(); await sleep(300);
  for (const [n, r, s] of [["tl", [0, 0, 560, 320], 2.2], ["tr", [1112, 0, 560, 320], 2.2], ["eng", [220, 360, 420, 230], 3], ["edu", [620, 260, 420, 260], 3], ["pg", [1020, 300, 420, 280], 3], ["hub", HUB, 3], ["cre", [0, 470, 600, 440], 2.4], ["exp", [1140, 480, 532, 440], 2.4], ["floor", [560, 660, 560, 281], 2.2], ["books", [0, 690, 470, 251], 3]]) await shot(L, `seam-${n}`, r, s);
  await L.page.close();
}
if (want("raised")) for (const id of IDS) { const L = await lab(); await L.on(id); await sleep(ARRIVE[id] + SEQ[id] + 900); await shot(L, `raised-${id}`, BOX[id], 3); await L.page.close(); }
if (want("viewport")) for (const [w, h] of [[1366, 768], [1648, 928], [1920, 1080], [2560, 1080]]) {
  const L = await lab("/lab-v2", { width: w, height: h });
  await L.finish(); await sleep(400); await shot(L, `vp-${w}x${h}-idle`, null, 1, "jpeg");
  for (const id of IDS) { await L.rest(); await L.on(id); await sleep(ARRIVE[id] + SEQ[id] + 800); await shot(L, `vp-${w}x${h}-${id}`, null, 1, "jpeg"); }
  await L.page.close();
}
writeFileSync(`${OUT}/info${sets ? "-" + sets.join("-") : ""}.json`, JSON.stringify(info) + "\n");
console.log(JSON.stringify(info).slice(0, 3000));
process.exit(0);
