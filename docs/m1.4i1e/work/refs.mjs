// M1.4I.1E: what must not change. node refs.mjs <label>; node refs.mjs compare a b
// Homepage: markup of the station layer, hit map at rest and with each station hovered, pixels. /lab-v2: hit map and pixels at
// rest, focus order, accessible names, Playground lifted.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";
import { IDS } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const dir = (l) => join(HERE, `refs-${l}`);
const PAGES = { home: "/", v2: "/lab-v2" };
if (process.argv[2] === "compare") {
  const [a, b] = process.argv.slice(3);
  const A = JSON.parse(readFileSync(join(dir(a), "refs.json"))), B = JSON.parse(readFileSync(join(dir(b), "refs.json")));
  const page = await launch();
  await prepare(page);
  for (const n of Object.keys(PAGES)) {
    console.log(n, "markup", A[n].markup === B[n].markup, "markup without bridges", A[n].markup === B[n].bare, "tabs", JSON.stringify(A[n].tabs) === JSON.stringify(B[n].tabs), A[n].tabs.length, "tree", JSON.stringify(A[n].ax) === JSON.stringify(B[n].ax), B[n].ax.length);
    for (const k of Object.keys(A[n].maps)) { let d = 0; A[n].maps[k].forEach((r, y) => [...r].forEach((c, x) => { if (c !== B[n].maps[k][y][x]) d++; })); console.log("   hit map", k, "points changed", d, "of", A[n].maps[k].length * A[n].maps[k][0].length); }
    for (const s of ["idle"]) for (let i = 0; i < 3; i++) {
      let best = null;
      for (let j = 0; j < 3; j++) { const c = await compareImages(page, join(dir(a), `${n}-${s}-${i}.png`), join(dir(b), `${n}-${s}-${j}.png`)); if (!best || c.mean < best.mean) best = c; }
      console.log("   pixels", s, i, `max ${best.max} over2 ${best.over2}`);
    }
  }
  await page.close();
  process.exit(0);
}
const D = dir(process.argv[2]);
mkdirSync(D, { recursive: true });
const out = {};
for (const [n, path] of Object.entries(PAGES))
  for (let i = 0; i < 3; i++) {
    const page = await launch({ gpu: true });
    await page.goto("http://localhost:3002" + path);
    await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
    await page.mouseMove(4, 924);
    await sleep(1800);
    await page.freezeAnimations(0);
    await sleep(200);
    await page.screenshot(join(D, `${n}-idle-${i}.png`));
    if (i === 0) {
      const map = () => page.eval(`(() => { const rows = []; for (let y = 2; y < 928; y += 4) { let r = ""; for (let x = 2; x < 1648; x += 4) { const e = document.elementFromPoint(x, y); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" }[h] : s ? "L" : b ? "B" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`);
      const o = (out[n] = { maps: {} });
      // Without bridges, their styles and the moving label's own attributes: what is left must be what was there.
      o.markup = await page.eval(`document.getElementById("lab-stations").outerHTML`);
      o.bare = await page.eval(`(() => { const c = document.getElementById("lab-stations").cloneNode(true); c.querySelectorAll("[data-bridge]").forEach((e) => e.remove()); c.querySelectorAll("style").forEach((e) => { if (e.textContent.includes("data-bridge")) e.remove(); }); return c.outerHTML; })()`);
      o.maps.rest = await map();
      if (n === "home") for (const id of IDS) { const c = await page.center(`[data-hotspot="${id}"]`); await page.mouseMove(c.x, c.y); await sleep(2200); o.maps[id] = await map(); await page.mouseMove(4, 924); await sleep(1600); }
      o.tabs = [];
      for (let k = 0; k < 26; k++) { await page.key("Tab", "Tab", 9); o.tabs.push(await page.eval(`(() => { const e = document.activeElement; return e === document.body ? "body" : e.tagName + "|" + (e.id || "") + "|" + (e.getAttribute("aria-label") ?? e.textContent.trim()); })()`)); }
      const ax = (await page.send("Accessibility.getFullAXTree")).nodes.filter((x) => !x.ignored && x.role?.value !== "InlineTextBox");
      o.ax = ax.map((x) => `${x.role?.value}:${x.name?.value ?? ""}`);
    }
    await page.close();
  }
writeFileSync(join(D, "refs.json"), JSON.stringify(out) + "\n");
console.log("ok", Object.keys(out), out.v2.tabs.length, out.v2.ax.length);
process.exit(0);
