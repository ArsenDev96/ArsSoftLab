// M1.4R.2 A/B capture (from M1.4P): node sc-capture.mjs <out-dir> <base> [warm]. warm: one visit, another site, then the captured visit (images from the HTTP cache where allowed).
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";
const BASE = process.argv[3]; const WARM = process.argv[4] === "warm";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const FP = `[...document.querySelectorAll("body *")].filter((e) => !e.closest("nextjs-portal, script, style")).map((e) => {
  const b = e.getBoundingClientRect(); const s = getComputedStyle(e);
  return [e.tagName, Math.round(b.x * 10) / 10, Math.round(b.y * 10) / 10, Math.round(b.width * 10) / 10, Math.round(b.height * 10) / 10, s.display, s.visibility, s.opacity, s.transform, s.color, s.overflow].join("|");
}).join("\\n")`;
const CASES = [
  ["home-1648", "/", 1648, 928],
  ["home-1920", "/", 1920, 945],
  ["home-exp-1648", "/?station=experience", 1648, 928],
  ["v2-full-1648", "/lab-v2", 1648, 928],
  ["v2-full-1920", "/lab-v2", 1920, 945],
  ["v2-full-exp-1648", "/lab-v2?station=experience", 1648, 928],
  ["v2-lite-1648", "/lab-v2?render=lite", 1648, 928],
  ["v2-lite-exp-1648", "/lab-v2?station=experience&render=lite", 1648, 928],
  ["v2-mobile-390", "/lab-v2", 390, 844],
  ["v2-mobile-exp-390", "/lab-v2?station=experience", 390, 844],
];
for (const [name, path, w, h] of CASES) {
  const page = await launch({ width: w, height: h });
  try {
    await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    if (WARM) { await page.goto(BASE + path); await sleep(1500); await page.goto(BASE.replace("localhost", "127.0.0.1") + "/favicon.ico"); }
    await page.goto(BASE + path);
    await sleep(1500);
    await page.freezeAnimations(0);
    await page.finishTransitions();
    await sleep(200);
    writeFileSync(`${OUT}/${name}.txt`, await page.eval(FP));
    await page.screenshot(`${OUT}/${name}.png`);
    console.log("captured", name);
  } finally {
    await page.close();
  }
}
