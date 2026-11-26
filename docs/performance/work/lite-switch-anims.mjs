// M1.4K.4: what transitions after a switch from Engineering to Playground (or, FROM=idle, a hover from rest), sampled after the move.
//   node lite-switch-anims.mjs [full|lite]
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const mode = process.argv[2] ?? "lite";
const page = await launch({ width: 1648, height: 928 });
await page.goto(`${BASE}/lab-v2?render=${mode}`);
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
const E = await page.center('[data-hotspot="engineering"]'), P = await page.center('[data-hotspot="playground"]');
// FROM=idle: hover Engineering from rest (no prior hover); otherwise switch Engineering -> Playground.
const fromIdle = process.env.FROM === "idle";
if (!fromIdle) { await page.mouseMove(E.x, E.y); await sleep(1500); }
const list = `document.getAnimations().filter((a) => a.playState === "running").map((a) => { const t = a.effect?.target; const b = t?.getBoundingClientRect?.(); return (a.transitionProperty ?? a.animationName ?? a.constructor.name) + " " + (t ? t.tagName + "." + String(t.getAttribute("class") ?? "").split(" ").slice(0, 2).join(".") + (t.dataset?.zone ? "[" + t.dataset.zone + "]" : "") + (t.dataset?.station ? "{" + t.dataset.station + "}" : "") : "?") + (b ? " " + Math.round(b.width) + "x" + Math.round(b.height) : ""); })`;
const T = fromIdle ? E : P;
await page.mouseMove(T.x, T.y);
const t0 = Date.now(), out = {};
for (const at of fromIdle ? [100, 300, 500, 700, 900] : [50, 250, 450, 700]) { await sleep(at - (Date.now() - t0)); out[at] = await page.eval(list); }
for (const [k, v] of Object.entries(out)) { const c = {}; for (const x of v) c[x] = (c[x] ?? 0) + 1; console.log(k, "ms:", v.length, JSON.stringify(c)); }
writeFileSync(new URL(`./results/lite-switch-anims-${mode}${fromIdle ? "-idle" : ""}.json`, import.meta.url), JSON.stringify(out, null, 1) + "\n");
await page.close(); process.exit(0);
