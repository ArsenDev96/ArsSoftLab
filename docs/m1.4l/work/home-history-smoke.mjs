// M1.4L.2: homepage Back / Forward smoke test (LabState.tsx is shared with `/`). Default Chrome, 1648 x 928.
//   node home-history-smoke.mjs   -> work/results/home-history-smoke.txt
// In-page selection pushes one entry per change; Back and Forward walk them and restore the selection without adding
// entries; a deep link loads without pushing; Escape returns to the lab and Back restores the deep link.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const until = async (page, expr, ms = 8000) => { for (let t = 0; t < ms; t += 100) { if (await page.eval(expr)) return true; await sleep(100); } return false; };
const errors = [];
const page = await launch();
page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(JSON.stringify(m.params).slice(0, 200)); });
const state = () => page.eval(`({ url: location.pathname + location.search, len: history.length, open: document.querySelector("[data-station-panel][data-open]")?.dataset.stationPanel ?? null, project: [...document.querySelectorAll('[data-station-panel][data-open] button[aria-pressed="true"]')].map((b) => b.textContent).join() || null })`);
const at = (url, open, project) => `location.pathname + location.search === ${JSON.stringify(url)} && (document.querySelector("[data-station-panel][data-open]")?.dataset.stationPanel ?? null) === ${JSON.stringify(open)} && ([...document.querySelectorAll('[data-station-panel][data-open] button[aria-pressed="true"]')].map((b) => b.textContent).join() || null) === ${JSON.stringify(project)}`;
const step = async (name, action, url, open, project, len) => {
  if (action) await page.eval(action);
  const ok = await until(page, at(url, open, project));
  await sleep(500); // let any stray push happen before reading the history length
  const s = await state();
  check(name, ok && s.url === url && (len === undefined || s.len === len), JSON.stringify(s));
  return s;
};

// In-page selection, then Back and Forward through it.
await page.goto(`${BASE}/`);
const s0 = await state();
const s1 = await step("select Engineering: one entry", `document.getElementById("station-engineering-trigger").click()`, "/?station=engineering", "engineering", null, s0.len + 1);
const s2 = await step("select SQLOrbit: one entry", `[...document.querySelectorAll('[data-station-panel="engineering"] button[aria-pressed]')].find((b) => b.textContent === "SQLOrbit").click()`, "/?station=engineering&project=sqlorbit", "engineering", "SQLOrbit", s1.len + 1);
await step("Back: station only, no entry added", "history.back()", "/?station=engineering", "engineering", null, s2.len);
await step("Back: the lab", "history.back()", "/", null, null, s2.len);
await step("Forward: station", "history.forward()", "/?station=engineering", "engineering", null, s2.len);
await step("Forward: station and project", "history.forward()", "/?station=engineering&project=sqlorbit", "engineering", "SQLOrbit", s2.len);

// A deep link loads without pushing; Escape returns; Back restores it; Forward returns to the lab.
await page.goto(`${BASE}/?station=engineering&project=sqlorbit`);
const d0 = await step("deep link: selected, nothing pushed on load", null, "/?station=engineering&project=sqlorbit", "engineering", "SQLOrbit");
const d1 = await step("Escape: back to the lab, one entry", `document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })) || window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`, "/", null, null, d0.len + 1);
await step("Back: the deep link again", "history.back()", "/?station=engineering&project=sqlorbit", "engineering", "SQLOrbit", d1.len);
await step("Forward: the lab", "history.forward()", "/", null, null, d1.len);

// The homepage still offers no project page.
const r = await page.eval(`({ links: document.querySelectorAll('a[href*="/projects/"]').length })`);
check("no project-page links on /", r.links === 0, JSON.stringify(r));
check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ; "));
await page.close();
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "home-history-smoke.txt", lines.join("\n") + "\n");
process.exit(0);
