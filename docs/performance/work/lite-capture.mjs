// M1.4K.4: frozen captures and a DOM snapshot of /lab-v2, full or lite. Default Chrome (no GPU flags), 1648 x 928.
//   node lite-capture.mjs <label> [query]   -> captures/lite/<label>/{rest,engineering,playground}.png, dom.html, styles.txt
//   REDUCED=1: with prefers-reduced-motion
// Each state on a fresh page; a hovered state is frozen 2400 ms after the station's arrival (every animation paused there).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARRIVE, open, sleep } from "../../m1.4k/work/lib.mjs";
// Not core.mjs's lab(): its state hook expects every station's spark layers, which lite mode doesn't mount.
const lab = async (path, opts) => {
  const L = await open(path, opts);
  const on = async (id) => { const c = await L.page.center(`[data-hotspot="${id}"]`); await L.page.mouseMove(c.x, c.y); };
  const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  return { ...L, on, hov };
};
const HERE = dirname(fileURLToPath(import.meta.url));
const [label = "before", query = ""] = process.argv.slice(2);
const OUT = join(HERE, "captures", "lite", label);
mkdirSync(OUT, { recursive: true });
const info = {};
// STATES: e.g. "rest,educational,creative,experience" (M1.4K.5A); default rest, Engineering, Playground.
for (const state of process.env.STATES ? process.env.STATES.split(",") : ["rest", "engineering", "playground"]) {
  const L = await lab("/lab-v2" + query, { gpu: false, reducedMotion: process.env.REDUCED === "1" });
  await sleep(800);
  if (state !== "rest") {
    await L.on(state);
    await L.frame();
    await L.seek(ARRIVE[state] + 2400);
  } else await L.frame();
  await sleep(400);
  if (state === "rest") {
    // Everything the scene and labels render, and every inline stylesheet: full mode must be byte-identical.
    writeFileSync(join(OUT, "dom.html"), await L.page.eval(`document.querySelector("main").outerHTML`));
    writeFileSync(join(OUT, "styles.txt"), await L.page.eval(`[...document.querySelectorAll("main style")].map((s) => s.textContent).join("\\n")`));
  }
  info[state] = { hover: await L.hov(), errors: L.errors, layers: await L.page.eval(`document.querySelectorAll("main *").length`) };
  writeFileSync(join(OUT, `${state}.png`), Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  console.log(label, state, JSON.stringify(info[state]));
  await L.page.close();
}
writeFileSync(join(OUT, "info.json"), JSON.stringify(info, null, 1) + "\n");
process.exit(0);
