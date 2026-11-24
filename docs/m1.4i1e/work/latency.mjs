// M1.4I.1E: does letting go take longer? Leave -> hover cleared, measured in the page, with the bridges and (same page) without them.
import { IDS, POWERED, REST, open, sleep } from "../../m1.4i/work/lib.mjs";
import { P } from "./points.mjs";
const L = await open("/lab-v2", { gpu: true });
const S = ([x, y]) => [L.cam.x + x * L.cam.k, L.cam.y + y * L.cam.k];
await L.page.eval(`(() => { window.__ev = {}; document.addEventListener("pointerout", (e) => { if (e.target.dataset?.hotspot && !e.relatedTarget?.dataset?.hotspot) window.__ev.out = performance.now(); }, true); const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents"); new MutationObserver(() => { if (!d.dataset.labHover) window.__ev.off = performance.now(); }).observe(d, { attributes: true }); window.__fr = []; let last = performance.now(); (function f() { const n = performance.now(); window.__fr.push(n - last); last = n; requestAnimationFrame(f); })(); return 1; })()`);
const res = {};
for (const round of ["with", "without", "with again", "without again"]) {
  await L.page.eval(round.startsWith("without")
    ? `(() => { window.__kept = [...document.querySelectorAll("[data-bridge]")].flatMap((e) => [e, e.previousElementSibling]).map((e) => [e, e.style.display, e.disabled]); window.__kept.forEach(([e]) => { if (e.tagName === "STYLE") e.sheet.disabled = true; else e.style.display = "none"; }); return 1; })()`
    : `(() => { (window.__kept ?? []).forEach(([e, d]) => { if (e.tagName === "STYLE") e.sheet.disabled = false; else e.style.display = d; }); return 1; })()`);
  for (const id of ["playground", "creative"]) {
    const t = [], f = [];
    for (let k = 0; k < 6; k++) {
      await L.page.mouseMove(...S(P[id].art)); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(500);
      await L.page.eval("(window.__ev = {}, window.__fr = [], 1)");
      await L.page.mouseMove(...S(P[id].empty)); await sleep(600);
      const r = await L.page.eval("[window.__ev.off - window.__ev.out, Math.max(...window.__fr)]");
      t.push(Math.round(r[0])); f.push(Math.round(r[1]));
      await L.settle((s) => IDS.every((i) => REST[i](s[i])), 6000); await sleep(200);
    }
    console.log(round.padEnd(14), id.padEnd(11), "leave -> off ms:", t.join(" "), " longest frame:", f.join(" "));
  }
}
await L.page.close();
process.exit(0);
