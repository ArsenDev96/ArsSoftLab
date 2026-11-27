// Static Lite experiment: does ?render=static look and behave like ?render=lite? (default Chrome, 1648 x 928)
//   node static-compare.mjs   -> captures/static/compare/<mode>-<state>.png, results/static-compare.json
// Then static-compare.py diffs the captures.
//   look         rest, each station hovered (settled), Engineering selected, SQLOrbit selected: labels included
//   hit regions  a 6 px grid over the stage: which station (hotspot, bridge or label) the pointer would reach,
//                at rest and while Playground is hovered (bridges only take the pointer while their station is)
//   behaviour    chips of all five stations, keyboard (Tab to a title, Enter, Tab + Enter on its chip, Escape),
//                deep link, Open project -> project page -> Back to the lab keeps the mode
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const CAP = fileURLToPath(new URL("./captures/static/compare/", import.meta.url)); mkdirSync(CAP, { recursive: true });
const RES = fileURLToPath(new URL("./results/", import.meta.url));
const STATIONS = ["engineering", "educational", "playground", "creative", "experience"];
const AWAY = [4, 924];
const out = {};
const errors = [];

const GRID = `(() => {
  const st = document.querySelector("[data-lab-render]") ?? document.querySelector('[data-scene-variant="v2"]').closest(".overflow-hidden");
  const b = st.getBoundingClientRect(); const cells = [];
  for (let y = Math.max(0, b.top) + 3; y < Math.min(innerHeight, b.bottom); y += 6) for (let x = Math.max(0, b.left) + 3; x < Math.min(innerWidth, b.right); x += 6) {
    const e = document.elementFromPoint(x, y);
    const z = e?.closest("[data-hotspot],[data-bridge],[data-station]");
    cells.push(z ? (z.dataset.hotspot ? "h:" + z.dataset.hotspot : z.dataset.bridge ? "b:" + z.dataset.bridge : "l:" + z.dataset.station) : "");
  }
  return cells.join(",");
})()`;

for (const mode of ["lite", "static"]) {
  const page = await launch({ width: 1648, height: 928 });
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(`${mode}: ${JSON.stringify(m.params).slice(0, 200)}`); });
  await page.goto(`${BASE}/lab-v2?render=${mode}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  const r = (out[mode] = { mode, rendered: await page.eval(`document.querySelector("[data-lab-render]")?.dataset.labRender ?? null`) });
  const shot = async (name) => writeFileSync(CAP + `${mode}-${name}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const hovered = () => page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);

  await page.mouseMove(...AWAY); await sleep(1500);
  await shot("rest");
  r.gridRest = await page.eval(GRID);
  for (const id of STATIONS) {
    const c = await page.center(`[data-station="${id}"] .lab-station-title`);
    await page.mouseMove(c.x, c.y); await sleep(1200);
    if ((await hovered()) !== id) throw new Error(`${mode}: ${id} not hovered`);
    await shot(`hover-${id}`);
    if (id === "playground") r.gridHoverPlayground = await page.eval(GRID);
    await page.mouseMove(...AWAY); await sleep(900);
  }
  // Selection by clicking Engineering's platform target (its title's centre would toggle it the same way).
  const hs = await page.center('[data-station="engineering"] .lab-station-title');
  await page.click(hs.x, hs.y); await sleep(300); await page.mouseMove(...AWAY); await sleep(1500);
  r.selected = await page.eval(`({ search: location.search, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, camera: getComputedStyle(document.querySelector(".lab-camera") ?? document.body).transform })`);
  await shot("selected-engineering");
  const chip = await page.center('[data-station="engineering"] .lab-chip');
  await page.click(chip.x, chip.y); await sleep(300); await page.mouseMove(...AWAY); await sleep(1500);
  r.project = await page.eval(`location.search`);
  await shot("selected-sqlorbit");
  await page.key("Escape", "Escape", 27); await sleep(1200);
  r.afterEscape = await page.eval(`location.search`);

  // Chips of all five stations: hover, click, check, Escape.
  r.chips = [];
  for (const id of STATIONS) {
    const c = await page.center(`[data-station="${id}"] .lab-chip`);
    await page.mouseMove(c.x, c.y); await sleep(300);
    await page.click(c.x, c.y); await sleep(400);
    r.chips.push(await page.eval(`({ id: ${JSON.stringify(id)}, search: location.search, pressed: document.querySelector('[data-station="${id}"] .lab-chip').getAttribute("aria-pressed") })`));
    await page.key("Escape", "Escape", 27); await sleep(700);
    await page.mouseMove(...AWAY); await sleep(300);
  }

  // Keyboard: Tab to Educational's title (lights it), Enter selects, Tab + Enter on its chip, Escape.
  // Real Tab presses from the top of the page, so focus is keyboard focus (:focus-visible), as a visitor's.
  await page.eval(`document.activeElement?.blur(); 1`);
  let guard = 0;
  while (guard++ < 40 &&!(await page.eval(`document.activeElement?.closest('[data-station="educational"]') && document.activeElement.classList.contains("lab-station-title")`))) { await page.key("Tab", "Tab", 9); await sleep(80); }
  await sleep(400);
  const kb = { focusLit: await hovered() };
  await page.key("Enter", "Enter", 13); await sleep(500);
  kb.enter = await page.eval("location.search");
  await page.key("Tab", "Tab", 9); await sleep(100);
  kb.chipFocused = await page.eval(`document.activeElement?.textContent ?? null`);
  await page.key("Enter", "Enter", 13); await sleep(500);
  kb.chipEnter = await page.eval("location.search");
  await page.key("Escape", "Escape", 27); await sleep(800);
  kb.escape = await page.eval("location.search");
  r.keyboard = kb;

  // Deep link, then Open project -> the project page -> Back to the lab.
  await page.goto(`${BASE}/lab-v2?station=engineering&project=sqlorbit&render=${mode}`);
  r.deepLink = await page.eval(`({ search: location.search, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null, power: getComputedStyle(document.querySelector('[data-static-power="engineering"]') ?? document.body).opacity })`);
  const open = await page.eval(`(() => { const a = document.querySelector('a[href^="/lab-v2/projects/sqlorbit"]'); if (!a) return null; a.click(); return a.getAttribute("href"); })()`);
  for (let i = 0; i < 100 && !(await page.eval(`location.pathname.startsWith("/lab-v2/projects/")`)); i++) await sleep(100);
  await sleep(500);
  const back = await page.eval(`(() => { const a = [...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Back to the lab"); a.click(); return a.getAttribute("href"); })()`);
  for (let i = 0; i < 100 && !(await page.eval(`location.pathname === "/lab-v2" && !!document.querySelector("[data-lab-selected]")`)); i++) await sleep(100);
  await sleep(500);
  r.projectRoundTrip = { open, back, landed: await page.eval(`location.pathname + location.search`), rendered: await page.eval(`document.querySelector("[data-lab-render]")?.dataset.labRender ?? null`) };
  await page.close();
}

const grid = (k) => { const a = out.lite[k].split(","), b = out.static[k].split(","); const diff = a.filter((x, i) => x !== b[i]).length; return { cells: a.length, differ: diff, stations: [...new Set(a)].filter(Boolean).sort().join(" ") }; };
const summary = {
  rendered: [out.lite.rendered, out.static.rendered],
  hitRegionsRest: grid("gridRest"),
  hitRegionsHoverPlayground: grid("gridHoverPlayground"),
  errors,
};
for (const m of ["lite", "static"]) { delete out[m].gridRest; delete out[m].gridHoverPlayground; }
writeFileSync(RES + "static-compare.json", JSON.stringify({ summary, ...out }, null, 1) + "\n");
console.log(JSON.stringify({ summary, ...out }, null, 1));
process.exit(0);
