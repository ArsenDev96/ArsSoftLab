// M1.4K.5B: the Cinematic / Lite selector, one short pass (default Chrome, 1648 x 928).
//   node selector-check.mjs   -> results/selector-check.json, captures/selector/*.png
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const OUT = new URL("./captures/selector/", import.meta.url); mkdirSync(OUT, { recursive: true });
const res = { steps: [] };
const step = (name, pass, detail = {}) => { res.steps.push({ name, pass, ...detail }); console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(detail)); };
const STATE = `(() => ({
  search: location.search,
  lite: !!document.querySelector('[data-lab-render="lite"]'),
  shown: document.querySelector("[data-render-selector]")?.dataset.renderSelector ?? null,
  checked: document.querySelector('input[name="lab-render-mode"]:checked')?.value ?? null,
  selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
  project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null,
  tone: !!document.querySelector('[data-v2-floor="tone"]'),
  sameDocument: window.__marker === 1,
}))()`;

async function run(opts, tag) {
  const page = await launch({ width: 1648, height: 928, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  });
  await page.send("Runtime.enable");
  const st = () => page.eval(STATE);
  const until = async (pred, ms = 15000) => { const t0 = Date.now(); for (;;) { const s = await st(); if (pred(s) || Date.now() - t0 > ms) return { ...s, ms: Date.now() - t0 }; await sleep(50); } };
  const clickOption = async (label) => { const c = await page.eval(`(() => { const l = [...document.querySelectorAll("[data-render-selector] label")].find((e) => e.textContent.trim() === ${JSON.stringify(label)}); const b = l.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`); await page.click(c.x, c.y); };
  return { page, errors, st, until, clickOption, tag };
}

// 1. Mouse, both modes, parameters kept, no reload, Back / Forward.
{
  const { page, errors, st, until, clickOption } = await run({}, "default");
  await page.goto(`${BASE}/lab-v2?floor=approved&station=engineering&project=sqlorbit`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); window.__marker = 1; return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2000);
  let s = await st();
  step("default is Cinematic", !s.lite && s.shown === "full" && s.checked === "full" && !s.search.includes("render"), s);
  await page.screenshot(new URL("cinematic-selected.png", OUT).pathname.slice(1));

  await clickOption("Lite");
  s = await until((x) => x.lite);
  step("Lite: no reload, parameters kept, selection kept", s.lite && s.shown === "lite" && s.checked === "lite" && s.sameDocument && /floor=approved/.test(s.search) && /station=engineering/.test(s.search) && /project=sqlorbit/.test(s.search) && /render=lite/.test(s.search) && s.selected === "engineering" && s.project === "sqlorbit" && s.tone, { ...s, switchMs: s.ms });
  await sleep(800);
  await page.screenshot(new URL("lite-selected.png", OUT).pathname.slice(1));

  await page.eval("(history.back(), 1)");
  s = await until((x) => !x.lite);
  step("Back -> Cinematic", !s.lite && s.shown === "full" && s.checked === "full" && !s.search.includes("render") && s.sameDocument && s.selected === "engineering", s);
  await page.eval("(history.forward(), 1)");
  s = await until((x) => x.lite);
  step("Forward -> Lite", s.lite && s.shown === "lite" && /render=lite/.test(s.search) && s.sameDocument && s.selected === "engineering", s);

  // The lab's own history entries in Lite: Escape (a new entry, no station), then Back / Forward over both kinds.
  await page.key("Escape", "Escape", 27); await sleep(1200);
  s = await st();
  step("Lite: Escape returns to the lab, mode kept", s.lite && s.selected === null && s.search === "?floor=approved&render=lite", s);
  await clickOption("Cinematic");
  s = await until((x) => !x.lite);
  step("Cinematic again: parameter removed, others kept", !s.lite && s.search === "?floor=approved" && s.sameDocument, s);
  await page.eval("(history.back(), 1)"); s = await until((x) => x.lite);
  step("Back -> Lite, lab home", s.lite && s.search === "?floor=approved&render=lite" && s.selected === null, s);
  await page.eval("(history.back(), 1)"); await sleep(1500); s = await until((x) => x.selected === "engineering");
  step("Back -> Lite with Engineering selected (the lab's entry)", s.lite && s.selected === "engineering" && s.project === "sqlorbit" && s.shown === "lite", s);
  await page.mouseMove(4, 924); await sleep(400);
  step("no console errors (mouse)", errors.length === 0, { errors });
  await page.close();
}

// 2. Keyboard: Tab to the group, visible focus, arrow keys choose.
{
  const { page, errors, st, until } = await run({}, "keyboard");
  await page.goto(`${BASE}/lab-v2?station=playground`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); window.__marker = 1; return 1; })()`);
  await page.mouseMove(4, 924); await sleep(1500);
  let found = false, tabs = 0;
  for (; tabs < 40 && !found; tabs++) { await page.key("Tab", "Tab", 9); await sleep(30); found = await page.eval(`document.activeElement?.name === "lab-render-mode"`); }
  const ring = await page.eval(`(() => { const l = document.activeElement.closest("label"); const c = getComputedStyle(l); return { on: document.activeElement.value, outline: c.outlineStyle + " " + c.outlineWidth + " " + c.outlineColor, focusVisible: document.activeElement.matches(":focus-visible") }; })()`);
  step("Tab reaches the selector with a visible focus ring", found && ring.focusVisible && ring.outline.startsWith("solid") && ring.outline.includes("2px"), { tabs, ...ring });
  await page.screenshot(new URL("focus.png", OUT).pathname.slice(1));
  await page.key("ArrowRight", "ArrowRight", 39);
  let s = await until((x) => x.lite);
  const focusKept = await page.eval(`document.activeElement?.name === "lab-render-mode" && document.activeElement.value`);
  step("ArrowRight chooses Lite, focus stays on the selector", s.lite && /station=playground/.test(s.search) && /render=lite/.test(s.search) && s.sameDocument && focusKept === "lite", { ...s, focusKept });
  await page.key("ArrowLeft", "ArrowLeft", 37);
  s = await until((x) => !x.lite);
  step("ArrowLeft chooses Cinematic", !s.lite && s.search === "?station=playground" && s.sameDocument, s);
  step("no console errors (keyboard)", errors.length === 0, { errors });
  await page.close();
}

// 3. Reduced motion: both modes work; the selector has no motion of its own.
{
  const { page, errors, until, clickOption } = await run({ reducedMotion: true }, "reduced");
  await page.goto(`${BASE}/lab-v2`);
  await page.eval(`(() => { window.__marker = 1; return 1; })()`);
  await sleep(1500);
  const tr = await page.eval(`getComputedStyle(document.querySelector("[data-render-selector] label")).transitionDuration`);
  await clickOption("Lite"); let s = await until((x) => x.lite);
  const ok1 = s.lite && s.sameDocument;
  await clickOption("Cinematic"); s = await until((x) => !x.lite);
  step("reduced motion: both modes, no transitions on the selector", ok1 && !s.lite && s.search === "" && /^0s(, 0s)*$/.test(tr) && errors.length === 0, { transitionDuration: tr, errors });
  await page.close();
}
res.pass = res.steps.every((x) => x.pass);
writeFileSync(new URL("./results/selector-check.json", import.meta.url), JSON.stringify(res, null, 1) + "\n");
console.log(res.pass ? "ALL PASS" : "SOME FAILED");
process.exit(0);
