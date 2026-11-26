// M1.4K.4: what is still animating (and what is redrawn) while a station is hovered, full vs lite. Default Chrome.
//   node lite-anim.mjs   -> results/lite-anim.json
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const out = {};
for (const mode of ["full", "lite"]) {
  const page = await launch({ width: 1648, height: 928 });
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
    window.__f = []; (function f(t) { window.__f.push(t); requestAnimationFrame(f); })(performance.now()); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2500);
  const list = `document.getAnimations().map((a) => { const t = a.effect?.target; const n = t ? (t.tagName + "." + String(t.getAttribute("class") ?? "").split(" ").slice(0, 3).join(".") + (t.dataset?.zone ? "[" + t.dataset.zone + "]" : "")) : "?"; return [a.constructor.name, a.transitionProperty ?? a.animationName ?? "", n, a.playState]; })`;
  const fps = async (ms) => { await page.eval("(window.__f.length = 0, 1)"); await sleep(ms); return page.eval("(() => { const f = window.__f; return +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1); })()"); };
  const r = { idleFps: await fps(1500), idleAnims: await page.eval(list) };
  for (const id of ["engineering", "playground"]) {
    const c = await page.center(`[data-hotspot="${id}"]`); await page.mouseMove(c.x, c.y); await sleep(2500);
    r[id] = { settledFps: await fps(1500), anims: await page.eval(list) };
    await page.mouseMove(4, 924); await sleep(2600);
  }
  out[mode] = r;
  console.log(mode, "idle fps", r.idleFps, "anims", r.idleAnims.length, "| eng settled fps", r.engineering.settledFps, "anims", r.engineering.anims.length, "| pg settled fps", r.playground.settledFps, "anims", r.playground.anims.length);
  for (const k of ["idleAnims"]) console.log("  idle:", JSON.stringify(r[k].slice(0, 12)));
  console.log("  eng:", JSON.stringify(r.engineering.anims.slice(0, 15)));
  console.log("  pg:", JSON.stringify(r.playground.anims.slice(0, 15)));
  await page.close();
}
writeFileSync(new URL("./results/lite-anim.json", import.meta.url), JSON.stringify(out, null, 1) + "\n");
process.exit(0);
