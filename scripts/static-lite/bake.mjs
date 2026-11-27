// Lite's flattened scene, step 1 of 2: capture the layered Lite scene as flat frames. Development tool only.
//   npx next dev -p 3002   (the layered scene is reachable only on a development server)
//   node scripts/static-lite/bake.mjs [--captures <dir>]   -> <dir>/{rest,rest-2,on-<station>}.png, then bake.py
// Default <dir>: <os temp>/arssoftlab-static-lite. BASE overrides the server (default http://localhost:3002).
//
// The source is `/lab-v2?render=lite&lite=layered`: the layered Lite scene (LabScene `lite`), kept for this purpose.
// The viewport is the scene's own 1672 x 941, so the stage is drawn at scale 1 and each capture is exactly the composited
// scene. Everything that stays live HTML in Lite is hidden first: the header, the hero and explore cue, and the station
// labels and chips (opacity 0, so they still take the pointer: hovering a station's title powers it for its capture).
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, sleep } from "../visual/cdp.mjs";

const BASE = process.env.BASE || "http://localhost:3002";
const at = process.argv.indexOf("--captures");
const OUT = at > 0 ? process.argv[at + 1] : join(tmpdir(), "arssoftlab-static-lite");
mkdirSync(OUT, { recursive: true });
const STATIONS = ["engineering", "educational", "playground", "creative", "experience"];
const HIDE = [
  "nextjs-portal{display:none!important}",
  "header{visibility:hidden!important}",
  "[data-lab-render] ~ *{visibility:hidden!important}",
  "#lab-stations .lab-station{opacity:0!important;transition:none!important}",
].join("");

const page = await launch({ width: 1672, height: 941 });
await page.goto(`${BASE}/lab-v2?render=lite&lite=layered`);
if (!(await page.eval(`!!document.querySelector('[data-lab-render="lite"] [data-scene-variant="v2"]')`))) {
  throw new Error("Not the layered Lite scene: is this a development server (next dev)?");
}
await page.eval(`(() => { const s = document.createElement("style"); s.textContent = ${JSON.stringify(HIDE)}; document.head.append(s); return 1; })()`);
const stage = await page.eval(`(() => { const b = document.querySelector("[data-lab-render]").getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; })()`);
if (stage.join() !== "0,0,1672,941") throw new Error(`stage not at scale 1: ${stage}`);
const shot = async (name) => writeFileSync(join(OUT, name + ".png"), Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
const hovered = () => page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);

await page.mouseMove(3, 3); await sleep(2000);
await shot("rest");
for (const id of STATIONS) {
  const c = await page.center(`[data-station="${id}"] .lab-station-title`);
  await page.mouseMove(c.x, c.y); await sleep(1500);
  if ((await hovered()) !== id) throw new Error(`${id} not hovered`);
  await shot(`on-${id}`);
  await page.mouseMove(3, 3); await sleep(1500);
}
// A second rest frame, after every station has been on and off: bake.py checks the two are identical.
await shot("rest-2");
console.log(`Captured into ${OUT}`);
await page.close();
process.exit(0);
