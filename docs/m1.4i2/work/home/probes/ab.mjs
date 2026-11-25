// This machine only: 1) every crop against its full-frame source; 2) the same frozen frame drawn from the crops and, in the
// same page, from the full-frame files with M1.4I.2's wrapper clips removed. Not the office's before/after comparison.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { ARRIVE, IDS, open, sleep } from "../../../../m1.4i/work/lib.mjs";
import { shot, viewer } from "./px.mjs";
mkdirSync("cap/ab", { recursive: true });
const crops = Object.fromEntries([...readFileSync(new URL("../../../../../components/lab/scene-crops.ts", import.meta.url), "utf8").matchAll(/"(\/scene[^"]+)": (\{[^}]+\})/g)].map((m) => [m[1], JSON.parse(m[2])]));
const px = await viewer();
const out = { crops: null, frames: {} };
{
  const p = await open("/lab-v2", { gpu: true });
  out.crops = await p.page.eval(`(async () => {
    const C = ${JSON.stringify(crops)}; const r = [];
    const load = async (s) => createImageBitmap(await (await fetch(s)).blob(), { premultiplyAlpha: "none", colorSpaceConversion: "none" });
    for (const [src, c] of Object.entries(C)) {
      const a = await load(src), b = await load(c.src);
      const px = (draw) => { const k = new OffscreenCanvas(1672, 941), g = k.getContext("2d", { willReadFrequently: true }); draw(g); return g.getImageData(0, 0, 1672, 941).data; };
      const A = px((g) => g.drawImage(a, 0, 0)), B = px((g) => g.drawImage(b, c.x, c.y));
      let bad = 0, max = 0; for (let i = 0; i < A.length; i += 4) { if (A[i + 3] === 0 && B[i + 3] === 0) continue; const m = Math.max(...[0, 1, 2, 3].map((k) => Math.abs(A[i + k] - B[i + k]))); if (m) bad++; if (m > max) max = m; }
      r.push({ src, full: [a.width, a.height], crop: [b.width, b.height, c.w, c.h], bad, max });
    }
    return r; })()`);
  const bad = out.crops.filter((c) => c.bad || c.full[0] !== 1672 || c.full[1] !== 941 || c.crop[0] !== c.crop[2] || c.crop[1] !== c.crop[3]);
  console.log(`crops ${out.crops.length}, differing ${bad.length}`, JSON.stringify(bad));
  await p.page.close();
}
const REVERT = `(() => {
  const C = ${JSON.stringify(Object.fromEntries(Object.entries(crops).map(([s, c]) => [c.src, s])))};
  window.__undo = []; let n = 0, k = 0;
  for (const i of document.querySelectorAll("svg image")) { const s = C[i.getAttribute("href")]; if (!s) continue; const old = ["href", "x", "y", "width", "height"].map((a) => [a, i.getAttribute(a)]); for (const [a, v] of [["href", s], ["x", 0], ["y", 0], ["width", 1672], ["height", 941]]) i.setAttribute(a, v); window.__undo.push(() => old.forEach(([a, v]) => i.setAttribute(a, v))); n++; }
  const clipped = [...document.querySelectorAll('.eng-caps,[data-cre-swap="anim"],[data-exp-swap="anim"],[data-eng][data-eng-swap="anim"],.eng-v2 *,canvas')].filter((e, j, a) => a.indexOf(e) === j && e.style.clipPath.startsWith("inset(") && (e.matches('.eng-caps,[data-cre-swap="anim"],[data-exp-swap="anim"],[data-eng][data-eng-swap="anim"]') || (e.style.maskImage || e.style.webkitMaskImage || "").includes("engineering-screen-mask")));
  for (const e of clipped) { const v = e.style.clipPath; e.style.clipPath = "none"; window.__undo.push(() => { e.style.clipPath = v; }); k++; }
  return [n, k]; })()`;
const UNDO = `(window.__undo.forEach((f) => f()), 1)`;
const decodeAll = (page) => page.eval(`Promise.all([...document.querySelectorAll("svg image")].map((i) => { const n = new Image(); n.src = i.getAttribute("href"); return n.decode().catch(() => 0); })).then(() => 1)`);
const compare = async (p, name) => {
  await sleep(350);
  await px.put("a", await shot(p.page, `ab/${name}`));
  const [n, k] = await p.page.eval(REVERT);
  await decodeAll(p.page); await p.frame(); await sleep(600);
  await px.put("b", await shot(p.page, `ab/${name}-fullframe`));
  await p.page.eval(UNDO);
  await decodeAll(p.page); await p.frame(); await sleep(400);
  await px.put("c", await shot(p.page, null));
  const r = { images: n, wrappers: k, cropsVsFull: await px.diff("a", "b"), noise: await px.diff("a", "c") };
  out.frames[name] = r;
  console.log(name, JSON.stringify(r));
  writeFileSync("out/ab.json", JSON.stringify(out, null, 1));
};
for (const [n, path] of [["idle", "/lab-v2"], ["idle-tone", "/lab-v2?floor=approved"]]) {
  const p = await open(path, { gpu: true });
  await sleep(800); await p.finish();
  await compare(p, n);
  await p.page.close();
}
const MID = { engineering: [280], educational: [450], playground: [120, 220, 320], creative: [370], experience: [430] };
for (const id of IDS) {
  const p = await open("/lab-v2", { gpu: true });
  await p.finish();
  const c = await p.page.center(`[data-hotspot="${id}"]`);
  await p.page.mouseMove(c.x, c.y);
  await p.frame();
  for (const t of MID[id]) { await p.seek(ARRIVE[id] + t); await compare(p, `${id}-mid-${t}`); }
  await p.seek(ARRIVE[id] + 2400);
  await sleep(350);
  await compare(p, `${id}-powered`);
  await p.page.close();
}
await px.close();
process.exit(0);
