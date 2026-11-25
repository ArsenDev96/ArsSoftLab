// M1.4J.2: the raised station against the resting one, alone on black, at the same frozen moment of the sequence.
// Every layer that stays behind, drifts or is drawn twice shows up once the shift is taken out (align.py).
//   node align.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const A = ARRIVE.educational;
const shot = async (p, n) => {
  for (let k = 0; k < 5; k++) {
    const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(8000)]);
    if (r?.data) return writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64"));
  }
  throw new Error("no screenshot " + n);
};
const css = (p, id, text) => p.page.eval(`(() => { let e = document.getElementById(${JSON.stringify(id)}); if (!e) { e = document.createElement("style"); e.id = ${JSON.stringify(id)}; document.head.append(e); } e.textContent = ${JSON.stringify(text)}; return 1; })()`);
const ISOLATE = `(() => {
  const s = document.querySelector("[data-scene-variant]"), st = document.querySelector(".edu-v2");
  for (const c of s.children) if (!c.contains(st) && c.tagName !== "STYLE") c.style.setProperty("display", "none", "important");
  for (let e = s; e && e !== document.body; e = e.parentElement) { for (const c of e.parentElement.children) if (c !== e && !["STYLE", "SCRIPT", "LINK"].includes(c.tagName)) c.style.setProperty("opacity", "0", "important"); e.style.setProperty("background", "none", "important"); }
  document.documentElement.style.background = document.body.style.background = "#000";
  return 1; })()`;
const lift = (d) => `.edu-lift{--dl:${d / 10}!important;transition:none!important}`;
for (const [set, hide] of [["station", '[data-strip-share="spill"],[data-strip-share="streak"],[data-edu^="stable-spill"],[data-edu^="stable-streak"]{display:none!important}'], ["floor", ".edu-rise{display:none!important}"]]) {
  const p = await open("/lab-v2", { gpu: true });
  if (set === "station") await p.page.eval(ISOLATE);
  await css(p, "hide", hide);
  await p.finish();
  if (set === "station") for (const d of [0, 3, 5, 7, 10]) { await css(p, "lift", lift(d)); await sleep(350); await shot(p, `station-rest-${d}`); }
  const c = await p.page.center('[data-hotspot="educational"]');
  await p.page.mouseMove(c.x, c.y);
  await p.frame();
  for (const t of set === "station" ? [40, 110, 160, 230, 300, 400, 500, 620, 740, 1500, 4200] : [1500]) {
    await p.seek(A + t);
    for (const d of set === "station" ? [0, 3, 5, 7, 10] : [0, 5, 10]) { await css(p, "lift", lift(d)); await sleep(350); await shot(p, `${set}-${t}-${d}`); }
  }
  // Leaving: the wave and the ring running back.
  if (set === "station") {
    await css(p, "lift", "");
    await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
    await sleep(200);
    await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
    await p.away();
    await p.frame();
    for (const t of [60, 200, 330]) { await p.seek(t); for (const d of [0, 3, 5, 7, 10]) { await css(p, "lift", lift(d)); await sleep(350); await shot(p, `station-leave${t}-${d}`); } }
  }
  console.log(set, "errors", JSON.stringify(p.errors));
  await p.page.close();
}
process.exit(0);
