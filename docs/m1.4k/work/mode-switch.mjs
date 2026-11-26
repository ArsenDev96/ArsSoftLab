// M1.4K.6 (home verification): frame timing across a Cinematic <-> Lite switch made with the header selector (mouse click).
//   node mode-switch.mjs [path] [rounds]   (BASE to choose the server; MSYS_NO_PATHCONV=1 in Git Bash)
// Per switch: click -> radio shows the choice (optimistic), click -> the scene is in the new mode, and the frames
// from the click to 1.5 s after the scene changed (fps, p95, worst, frames over 50 / 100 ms). Rounds 0 = first
// switch after load (cold), later rounds warm.
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const path = process.argv[2] ?? "/lab-v2";
const ROUNDS = +(process.argv[3] ?? 2);
const page = await launch({ width: 1648, height: 928 });
const errors = [];
page.on((m) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
});
await page.goto(BASE + path);
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s);
  window.__f = []; window.__rec = false; window.__ev = {};
  (function f(t) { if (window.__rec) { window.__f.push(t);
    const lite = !!document.querySelector('[data-lab-render="lite"]'), chk = document.querySelector('input[name="lab-render-mode"]:checked')?.value;
    if (window.__want && chk === window.__want && !window.__ev.radio) window.__ev.radio = t;
    if (window.__want && lite === (window.__want === "lite") && !window.__ev.scene) window.__ev.scene = t; }
    requestAnimationFrame(f); })(performance.now()); return 1; })()`);
await page.mouseMove(4, 924); await sleep(2500);
const stat = (f) => { const d = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b), q = (p) => +(d[Math.min(d.length - 1, Math.floor(d.length * p))] ?? 0).toFixed(1);
  return { frames: f.length, fps: +((f.length - 1) / ((f.at(-1) - f[0]) / 1000)).toFixed(1), p95Ms: q(0.95), maxMs: +(d.at(-1) ?? 0).toFixed(1), over50: d.filter((x) => x > 50).length, over100: d.filter((x) => x > 100).length }; };
const out = [];
for (let r = 0; r < ROUNDS; r++) for (const [label, want] of [["Lite", "lite"], ["Cinematic", "full"]]) {
  const c = await page.eval(`(() => { const l = [...document.querySelectorAll("[data-render-selector] label")].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); const b = l.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
  await page.mouseMove(c.x, c.y); await sleep(300);
  await page.eval(`(window.__f.length = 0, window.__ev = {}, window.__want = ${JSON.stringify(want)}, window.__rec = true, 1)`);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
  const t0 = await page.eval("performance.now()");
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 });
  for (let k = 0; k < 300 && !(await page.eval("!!window.__ev.scene")); k++) await sleep(20);
  await sleep(1500);
  const { f, ev, search } = await page.eval("(window.__rec = false, { f: window.__f.slice(), ev: window.__ev, search: location.search })");
  const row = { round: r, to: label, radioMs: ev.radio ? Math.round(ev.radio - t0) : null, sceneMs: ev.scene ? Math.round(ev.scene - t0) : null, search, ...stat(f) };
  out.push(row); console.log(JSON.stringify(row));
  await page.mouseMove(4, 924); await sleep(1200);
}
console.log("errors", JSON.stringify(errors));
await page.close(); process.exit(0);
