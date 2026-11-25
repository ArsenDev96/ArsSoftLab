// M1.4I.2.1: every pixel on the AZIZ chip's outline (whole CSS px, as a mouse reports them): still from rest through the lift, one click.
// The click's target is recorded and stopped, so the station stays as it is.   node chip-outline.mjs <label> <none|candidate> <w> <h>
import { writeFileSync } from "node:fs";
import { IDS, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
const [label, variant = "none", w = "1648", h = "928"] = process.argv.slice(2);
const L = await open("/lab-v2", { gpu: true, width: +w, height: +h });
const { page } = L;
if (variant === "candidate") await page.eval(`(() => { const e = document.createElement("style"); e.textContent = '@media (prefers-reduced-motion: no-preference){[data-lab-hover="playground"]:not([data-lab-selected="playground"]) #lab-stations [data-lift="playground"] .lab-chip:hover::after{top:50%!important;height:calc(50% + var(--u) * 20)!important}}'; document.head.append(e); return 1; })()`);
const px = await page.eval(`(() => {
  window.__clicks = [];
  window.addEventListener("click", (e) => { const b = e.target.closest?.("button"); window.__clicks.push(b ? b.textContent.trim() : e.target.dataset?.bridge ? "bridge" : e.target.closest?.("[data-station]") ? "label" : "nothing"); e.stopImmediatePropagation(); e.preventDefault(); }, true);
  window.__sparks = 0; const a = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks++; return a.apply(this, x); };
  const b = document.querySelector('section[data-station="playground"] h2 button'), r = b.getBoundingClientRect();
  const on = (x, y) => document.elementFromPoint(x, y)?.closest?.("button") === b, out = [];
  for (let y = Math.floor(r.top) - 1; y <= r.bottom + 1; y++) for (let x = Math.floor(r.left) - 1; x <= r.right + 1; x++) if (on(x, y) && !(on(x - 1, y) && on(x + 1, y) && on(x, y - 1) && on(x, y + 1))) out.push([x, y]);
  return { out, box: [r.left, r.top, r.right, r.bottom] }; })()`);
const rows = [];
for (const [x, y] of px.out) {
  await page.eval("(document.activeElement?.blur?.(), 1)");
  await L.off();
  await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 8000);
  await sleep(60);
  await page.eval("(window.__clicks = [], window.__sparks = 0, 1)");
  await page.mouseMove(x, y);
  await sleep(1300);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
  await sleep(40);
  const s = await page.eval("({ c: window.__clicks, n: window.__sparks })");
  rows.push({ x, y, click: s.c[0], sparks: s.n, ok: (s.c[0] === "Playground" || s.c[0] === "AZIZ") && s.n === 1 });
}
writeFileSync(`out/titleoutline-${label}.json`, JSON.stringify({ variant, w, h, box: px.box, rows }) + "\n");
const bad = rows.filter((r) => !r.ok);
console.log(label, variant, `${w}x${h}`, "box", px.box.map((v) => v.toFixed(2)).join(), "outline px", rows.length, "lost", bad.length, JSON.stringify(bad.map((r) => [r.x, r.y, r.click, r.sparks])), "errors", JSON.stringify(L.errors));
await page.close();
process.exit(0);
