// M1.4K.5A: short checks of the five-station lite mode (default Chrome, 1648 x 928).
//   node lite5-check.mjs   -> results/lite5-check.json
//   activate   each station: hovered, its strips powered within 400 ms, nothing lifted (station layers, labels, Playground)
//   chips      each station's first chip: hover, click -> its project selected; the camera stays (lite) / moves (full)
//   switching  all five in turn, 500 ms each: only the last one lit at the end
//   console    no errors; no pulse fired in lite
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const IDS = ["engineering", "educational", "playground", "creative", "experience"];
const STATE = `(() => {
  const op = (e) => +getComputedStyle(e).opacity;
  const ty = (e) => { const t = getComputedStyle(e).transform; return t === "none" ? 0 : Math.abs(new DOMMatrix(t).f); };
  const lit = {};
  for (const id of ${JSON.stringify(IDS)}) {
    if (id === "playground") { lit[id] = +(1 - op(document.querySelector(".lab-v2-strip-off"))).toFixed(2); continue; }
    const d = [...document.querySelectorAll('.lab-power-dim[data-power="' + id + '"]')];
    lit[id] = +(1 - Math.max(...d.map(op))).toFixed(2);
  }
  const moved = [...document.querySelectorAll(".eng-rise,.edu-rise,.cre-rise,.exp-rise,.lab-lift,.lab-station")].map(ty);
  return { hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, search: location.search, lit, maxLiftPx: +Math.max(0, ...moved).toFixed(2),
    camera: getComputedStyle(document.querySelector(".lab-camera")).transform };
})()`;
const res = {};
for (const mode of ["lite", "full"]) {
  const page = await launch({ width: 1648, height: 928 });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  });
  await page.send("Runtime.enable");
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
    window.__fired = 0; const an = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.hasAttribute("data-surge-mover")) window.__fired++; return an.apply(this, x); }; return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2500);
  const C = {}; for (const id of IDS) C[id] = await page.center(`[data-hotspot="${id}"]`);
  const r = (res[mode] = { activate: {}, chips: {}, errors });
  if (mode === "lite") {
    for (const id of IDS) {
      await page.mouseMove(C[id].x, C[id].y); await sleep(400);
      const s = await page.eval(STATE); await sleep(1100);
      const later = await page.eval(STATE);
      r.activate[id] = { pass: s.hover === id && s.lit[id] === 1 && s.maxLiftPx === 0 && later.maxLiftPx === 0, litAt400ms: s.lit[id], maxLiftPx: Math.max(s.maxLiftPx, later.maxLiftPx) };
      await page.mouseMove(4, 924); await sleep(900);
    }
    for (const id of IDS) { await page.mouseMove(C[id].x, C[id].y); await sleep(500); }
    await sleep(400);
    const end = await page.eval(STATE);
    r.switching = { pass: end.hover === "experience" && end.lit.experience === 1 && IDS.filter((i) => i !== "experience").every((i) => end.lit[i] === 0), lit: end.lit };
    await page.mouseMove(4, 924); await sleep(1200);
  }
  for (const id of IDS) {
    const c0 = await page.center(`[data-station="${id}"] .lab-chip`); await page.mouseMove(c0.x, c0.y); await sleep(mode === "lite" ? 500 : 1800);
    const c = await page.center(`[data-station="${id}"] .lab-chip`);
    await page.click(c.x, c.y); await sleep(1300);
    const s = await page.eval(STATE);
    r.chips[id] = { pass: s.search.includes(`station=${id}`) && s.search.includes("project=") && (mode === "lite" ? s.camera === "none" : s.camera !== "none"), search: s.search, camera: s.camera === "none" ? "none" : "moved", chipMovedPx: +Math.hypot(c.x - c0.x, c.y - c0.y).toFixed(1), maxLiftPx: s.maxLiftPx };
    await page.key("Escape", "Escape", 27); await sleep(1200);
    await page.mouseMove(4, 924); await sleep(1500);
  }
  r.pulsesFired = await page.eval("window.__fired");
  r.home = await page.eval("location.search");
  for (const [k, v] of Object.entries(r)) console.log(mode, k, JSON.stringify(v));
  await page.close();
}
writeFileSync(new URL("./results/lite5-check.json", import.meta.url), JSON.stringify(res, null, 1) + "\n");
process.exit(0);
