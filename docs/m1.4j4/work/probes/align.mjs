// M1.4J.4: the raised station against the resting one, alone on black, at the same frozen moment of the sequence.
// A layer that stays behind, drifts or is drawn twice shows up once the shift is taken out (align.py).
// "Alone": the station group without what stays on purpose (the spill), so both are the same picture. d 0 is held "off the floor, not yet moved",
// so the strip light's rising part is on at every height.
//   node align.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.experience;
const shot = async (p, n) => { for (let k = 0; k < 5; k++) { const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(8000)]); if (r?.data) return writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); } throw new Error("no screenshot " + n); };
const css = (p, id, text) => p.page.eval(`(() => { let e = document.getElementById(${JSON.stringify(id)}); if (!e) { e = document.createElement("style"); e.id = ${JSON.stringify(id)}; document.head.append(e); } e.textContent = ${JSON.stringify(text)}; return 1; })()`);
const ISOLATE = `(() => {
  const s = document.querySelector("[data-scene-variant]"), st = document.querySelector(".exp-v2");
  for (const c of s.children) if (!c.contains(st) && c.tagName !== "STYLE") c.style.setProperty("display", "none", "important");
  for (let e = s; e && e !== document.body; e = e.parentElement) { for (const c of e.parentElement.children) if (c !== e && !["STYLE", "SCRIPT", "LINK"].includes(c.tagName)) c.style.setProperty("opacity", "0", "important"); e.style.setProperty("background", "none", "important"); }
  document.documentElement.style.background = document.body.style.background = "#000";
  return 1; })()`;
const lift = (d) => `.exp-lift{--xl:${Math.max(0.001, d / 10)}!important;transition:none!important}.exp-rise{transform:translateY(${-d}px)!important}`;
const HIDE = '[data-exp="light-stable-spill"],[data-exp^="strip-spill"]{display:none!important}';
for (const set of ["trail", "station"]) {
  const p = await open("/lab-v2", { gpu: true });
  await p.page.eval(ISOLATE);
  await css(p, "hide", HIDE + (set === "trail" ? '[data-exp="station"]{visibility:hidden!important}' : ""));
  await p.finish();
  const all = async (m) => { for (const d of [0, 3, 5, 7, 10]) { await css(p, "lift", lift(d)); await sleep(220); await shot(p, `${set}-${m}-${d}`); } };
  await all("rest");
  const c = await p.page.center('[data-hotspot="experience"]'); await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const t of [40, 150, 200, 250, 320, 388, 460, 545, 620, 700, 760, 820, 900, 1500]) { await p.seek(A + t); await all(t); }
  await css(p, "lift", "");
  await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`); await sleep(200);
  await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await p.away(); await p.frame();
  for (const t of [60, 200, 330]) { await p.seek(t); await all("leave" + t); }
  console.log(set, "errors", JSON.stringify(p.errors)); await p.page.close();
}
process.exit(0);
