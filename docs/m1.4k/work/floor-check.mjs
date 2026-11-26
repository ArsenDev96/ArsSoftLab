// M1.4K.10: the floor tone per mode, through the selector, the lab's own entries and Back / Forward (default Chrome,
// 1648 x 928). Cinematic defaults to the tone, Lite to the untoned floor; ?floor=approved|original wins in both.
//   node floor-check.mjs   (BASE to choose the server)   -> results/floor-check.json
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const ST = `(() => ({ search: location.search, tone: !!document.querySelector('[data-v2-floor="tone"]'), lite: !!document.querySelector('[data-lab-render="lite"]'),
  selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null, same: window.__m === 1 }))()`;
const page = await launch({ width: 1648, height: 928 });
const errors = [];
page.on((m) => {
  if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
});
await page.send("Runtime.enable");
const res = { steps: [] };
const step = (name, pass, s) => { res.steps.push({ name, pass, ...s }); console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(s)); };
const st = () => page.eval(ST);
const until = async (pred) => { const t0 = Date.now(); for (;;) { const s = await st(); if (pred(s) || Date.now() - t0 > 15000) return s; await sleep(40); } };
const pick = async (label) => { const c = await page.eval(`(() => { const l = [...document.querySelectorAll("[data-render-selector] label")].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); const b = l.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`); await page.click(c.x, c.y); };
const open = async (q) => { await page.goto(`${BASE}/lab-v2${q}`); await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); window.__m = 1; return 1; })()`); await page.mouseMove(4, 924); await sleep(1200); };

// Direct links.
for (const [q, tone, lite] of [["", true, false], ["?render=lite", false, true], ["?floor=original", false, false], ["?floor=approved&render=lite", true, true], ["?floor=original&render=lite", false, true], ["?station=engineering&project=sqlorbit", true, false]]) {
  await open(q); const s = await st();
  step(`direct /lab-v2${q}`, s.tone === tone && s.lite === lite, s);
}
// Default: the selector, a station and project, Escape, Back / Forward.
await open("?station=engineering&project=sqlorbit");
await pick("Lite"); let s = await until((x) => x.lite);
step("Lite: untoned, selection and parameters kept, no reload", !s.tone && s.same && s.selected === "engineering" && s.project === "sqlorbit" && s.search === "?station=engineering&project=sqlorbit&render=lite", s);
await sleep(600); await pick("Cinematic"); s = await until((x) => !x.lite);
step("Cinematic: toned again, render removed", s.tone && s.same && s.selected === "engineering" && s.search === "?station=engineering&project=sqlorbit", s);
await page.eval("(history.back(), 1)"); s = await until((x) => x.lite);
step("Back -> Lite, untoned", !s.tone && s.lite && s.selected === "engineering", s);
await page.eval("(history.forward(), 1)"); s = await until((x) => !x.lite);
step("Forward -> Cinematic, toned", s.tone && !s.lite && s.selected === "engineering", s);
await page.key("Escape", "Escape", 27); await sleep(1200); s = await st();
step("Escape: lab home, toned", s.tone && s.selected === null && s.search === "", s);
await page.eval("(history.back(), 1)"); await sleep(1200); s = await st();
step("Back -> Engineering / SQLOrbit again, toned", s.tone && s.selected === "engineering" && s.project === "sqlorbit", s);
// Explicit original: kept through both modes.
await open("?floor=original");
await pick("Lite"); s = await until((x) => x.lite);
step("floor=original -> Lite: untoned, floor kept", !s.tone && s.search === "?floor=original&render=lite", s);
await sleep(600); await pick("Cinematic"); s = await until((x) => !x.lite);
step("floor=original -> Cinematic: still untoned", !s.tone && s.search === "?floor=original", s);
// Explicit approved in Lite.
await open("?floor=approved&render=lite");
await pick("Cinematic"); s = await until((x) => !x.lite);
step("floor=approved, Lite -> Cinematic: toned, floor kept", s.tone && s.search === "?floor=approved", s);
step("no console errors", errors.length === 0, { errors });
res.pass = res.steps.every((x) => x.pass);
console.log(res.pass ? "ALL PASS" : "SOME FAILED");
writeFileSync(new URL("./results/floor-check.json", import.meta.url), JSON.stringify(res, null, 1) + "\n");
await page.close(); process.exit(0);
