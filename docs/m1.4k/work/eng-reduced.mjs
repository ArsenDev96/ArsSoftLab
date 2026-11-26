// M1.4K.8: Engineering with reduced motion: hover, then leave and come back 110 ms after the hover drops.
// Expected (existing policy): its lights answer in a short cross-fade, the station never lifts.   node eng-reduced.mjs
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const page = await launch({ width: 1648, height: 928, reducedMotion: true });
const errors = [];
page.on((m) => { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text); });
await page.goto(BASE + "/lab-v2");
const S = `(() => { const k = document.querySelector(".lab-camera").offsetWidth / 1672, ty = (e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : -new DOMMatrix(t).f; };
  const v2 = document.querySelector(".eng-v2"), n = (v) => +(+getComputedStyle(v2).getPropertyValue(v)).toFixed(3);
  return { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, y: +(Math.max(0, ...[...document.querySelectorAll(".eng-rise")].map(ty)) / k).toFixed(3),
    pw: +Math.max(0, ...[...document.querySelectorAll('.lab-power-dim[data-power="engineering"]')].map((e) => +getComputedStyle(e).getPropertyValue("--pw"))).toFixed(3), ef: n("--ef"), es: n("--es") }; })()`;
await page.mouseMove(4, 924); await sleep(2000);
const c = await page.center('[data-hotspot="engineering"]');
let maxY = 0; const watch = async (ms) => { for (let t = 0; t < ms; t += 30) { maxY = Math.max(maxY, (await page.eval(S)).y); await sleep(30); } };
await page.mouseMove(c.x, c.y); await watch(400); const at400 = await page.eval(S); await watch(800);
await page.mouseMove(4, 924); for (let k = 0; k < 100 && (await page.eval(S)).hover; k++) await sleep(5); await sleep(110);
await page.mouseMove(c.x, c.y); await watch(400); const back400 = await page.eval(S); await watch(1000);
const r = { at400, back400, maxLiftPx: maxY, errors, pass: at400.pw === 1 && at400.ef === 1 && back400.pw === 1 && back400.ef === 1 && maxY === 0 && errors.length === 0 };
console.log(JSON.stringify(r)); await page.close(); process.exit(0);
