// M1.4K.4: lite mode's interaction checks (default Chrome, 1648 x 928). Concise, not a regression suite.
//   node lite-interact.mjs   -> results/lite-interact.json
//   keyboard   real Tab order to Engineering's and Playground's titles: the station lights (powered, not lifted);
//              Enter selects it (URL keeps render=lite); Tab to its first chip, Enter selects the project; Escape
//              returns, focus back on the title
//   deep link  ?station / ?project / ?floor=approved with render=lite render in their state, no errors
//   reduced    lite with prefers-reduced-motion: hover powers both stations, nothing lifts
//   others     lite: Educational, Creative Studio and Experience still send the pulse (unchanged)
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const res = {};
const ok = (name, pass, detail) => { res[name] = { pass, ...detail }; console.log(pass ? "PASS" : "FAIL", name, JSON.stringify(detail)); };
const STATE = `(() => {
  const op = (e) => (e ? +getComputedStyle(e).opacity : null);
  const dims = [...document.querySelectorAll('.lab-power-dim[data-power="engineering"]')];
  const pgLift = [...document.querySelectorAll('.lab-lift[data-lift="playground"]')].find((e) => !e.classList.contains("lab-station"));
  const engRise = document.querySelector('[data-eng="body"]');
  return {
    search: location.search,
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null,
    focus: document.activeElement?.id || document.activeElement?.textContent?.trim().slice(0, 30) || null,
    engLit: dims.length ? +(1 - Math.max(...dims.map(op))).toFixed(2) : null,
    pgLit: +(1 - op(document.querySelector(".lab-v2-strip-off"))).toFixed(2),
    engY: engRise ? getComputedStyle(engRise).transform : null,
    pgTransform: pgLift ? getComputedStyle(pgLift).transform : null,
    lite: !!document.querySelector('[data-lab-render="lite"]'),
    surges: [...document.querySelectorAll("[data-surge]")].map((e) => e.dataset.surge),
  };
})()`;
const open = async (q, opts = {}) => {
  const page = await launch({ width: 1648, height: 928, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  });
  await page.send("Runtime.enable");
  await page.goto(BASE + "/lab-v2" + q);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(2000);
  return { page, errors, st: () => page.eval(STATE) };
};

// Keyboard (both modes: lite must keep full mode's behaviour, including where focus lands).
const keyboardFocus = {};
for (const mode of ["full", "lite"]) {
  const { page, errors, st } = await open(`?render=${mode}`);
  for (const id of ["engineering", "playground"]) {
    let found = false;
    for (let k = 0; k < 60 && !found; k++) { await page.key("Tab", "Tab", 9); await sleep(40); found = (await page.eval("document.activeElement?.id")) === `station-${id}-trigger`; }
    await sleep(500);
    const lit = await st();
    await page.key("Enter", "Enter", 13); await sleep(1200);
    const sel = await st();
    // Its first chip: Tab on from the title (the panel takes focus on open, so start from the title again).
    await page.eval(`(document.getElementById("station-${id}-trigger").focus(), 1)`);
    let chip = false;
    for (let k = 0; k < 8 && !chip; k++) { await page.key("Tab", "Tab", 9); await sleep(40); chip = await page.eval(`!!document.activeElement?.closest('[data-station="${id}"] .lab-chip, [data-station="${id}"] li')`); }
    await page.key("Enter", "Enter", 13); await sleep(900);
    const proj = await st();
    await page.key("Escape", "Escape", 27); await sleep(1200);
    const back = await st();
    keyboardFocus[`${mode} ${id}`] = back.focus;
    // Escape from a project: focus stays where it was (the chip, not in the hero panel), in both modes (LabState).
    ok(`keyboard ${mode} ${id}`, found && lit.hover === id && (mode === "full" || (id === "engineering" ? lit.engLit === 1 : lit.pgLit === 1)) && sel.selected === id && sel.search.includes(`render=${mode}`) && chip && !!proj.project && back.selected === null && (mode === "full" || back.focus === keyboardFocus[`full ${id}`]) && back.search === `?render=${mode}`,
      { found, lit: { hover: lit.hover, engLit: lit.engLit, pgLit: lit.pgLit, engY: lit.engY, pgTransform: lit.pgTransform }, selected: sel.search, chipFocused: chip, project: proj.search, back: { search: back.search, focus: back.focus } });
    await page.eval("(document.activeElement?.blur?.(), 1)"); await page.mouseMove(4, 924); await sleep(800);
  }
  ok(`keyboard ${mode} errors`, errors.length === 0, { errors });
  await page.close();
}

// Deep links.
for (const [q, want] of [
  ["?station=engineering&render=lite", { selected: "engineering", project: null }],
  ["?station=playground&project=aziz&render=lite", { selected: "playground", project: "aziz" }],
  ["?render=lite&station=engineering&project=sqlorbit", { selected: "engineering", project: "sqlorbit" }],
  ["?floor=approved&render=lite", { selected: null, project: null }],
]) {
  const { page, errors, st } = await open(q);
  const s = await st();
  const tone = await page.eval(`!!document.querySelector('[data-v2-floor="tone"]')`);
  ok(`deep link ${q}`, s.lite && s.selected === want.selected && s.project === want.project && errors.length === 0 && (!q.includes("floor") || tone) && s.search.includes("render=lite"),
    { search: s.search, selected: s.selected, project: s.project, engLit: s.engLit, pgLit: s.pgLit, engY: s.engY, pgTransform: s.pgTransform, floorTone: tone, errors });
  await page.close();
}

// Reduced motion, lite.
{
  const { page, errors, st } = await open("?render=lite", { reducedMotion: true });
  const out = {};
  for (const id of ["engineering", "playground"]) {
    const c = await page.center(`[data-hotspot="${id}"]`); await page.mouseMove(c.x, c.y); await sleep(600);
    out[id] = await st(); await page.mouseMove(4, 924); await sleep(800);
  }
  ok("reduced motion lite", out.engineering.engLit === 1 && out.playground.pgLit === 1 && out.playground.pgTransform === "none" && errors.length === 0,
    { engineering: { engLit: out.engineering.engLit, engY: out.engineering.engY }, playground: { pgLit: out.playground.pgLit, pgTransform: out.playground.pgTransform }, errors });
  await page.close();
}

// The other three stations in lite: unchanged, the pulse still fires.
{
  const { page, errors, st } = await open("?render=lite");
  await page.eval(`(() => { window.__fired = []; const an = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.hasAttribute("data-surge-mover")) window.__fired.push(this.closest("[data-surge]").dataset.surge); return an.apply(this, x); }; return 1; })()`);
  const fired = {};
  for (const id of ["educational", "creative", "experience", "engineering", "playground"]) {
    await page.eval("(window.__fired.length = 0, 1)");
    const c = await page.center(`[data-hotspot="${id}"]`); await page.mouseMove(c.x, c.y); await sleep(1500);
    fired[id] = [...new Set(await page.eval("window.__fired"))];
    await page.mouseMove(4, 924); await sleep(1500);
  }
  const s = await st();
  ok("other stations unchanged in lite", ["educational", "creative", "experience"].every((i) => fired[i].includes(i)) && fired.engineering.length === 0 && fired.playground.length === 0 && errors.length === 0,
    { pulseFired: fired, surgeGroupsMounted: s.surges, errors });
  await page.close();
}
writeFileSync(new URL("./results/lite-interact.json", import.meta.url), JSON.stringify(res, null, 1) + "\n");
process.exit(0);
