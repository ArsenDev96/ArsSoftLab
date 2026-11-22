// M1.4E.1: the current (M1.4E) Playground connection at exact phases, 3x.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const OUT = "docs/m1.4e1/work/before";
import { mkdirSync } from "node:fs"; mkdirSync(OUT, { recursive: true });
const page = await launch({ width: 1648, height: 928 });
const R = { x: 860, y: 480, w: 560, h: 130 };
try {
  await page.goto(process.env.URL || "http://localhost:3002/lab-v2");
  await page.mouseMove(4, 924); await sleep(900);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const shot = async (f, scale = 3) => { const r = await page.send("Page.captureScreenshot", { format: "png", clip: { x: cam.x + R.x * cam.k, y: cam.y + R.y * cam.k, width: R.w * cam.k, height: R.h * cam.k, scale } }); writeFileSync(`${OUT}/${f}`, Buffer.from(r.data, "base64")); };
  await shot("0-rest-3x.png");
  const c = await page.center('[data-hotspot="playground"]');
  await page.mouseMove(c.x, c.y); await sleep(20);
  for (const t of [200, 380, 560, 640, 700, 2400]) {
    await page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`);
    await page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
    await shot(`t${t}-3x.png`);
  }
} finally { await page.close(); }
