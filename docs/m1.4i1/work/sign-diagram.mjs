// M1.4I.1C: the hit region over the real page, before / at rest / raised -> ../playground-sign-region.png
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { open } from "../../m1.4i/work/lib.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const B = { x: 1040, y: 280, w: 380, h: 290 };
const L = await open("/lab-v2", { gpu: true });
const clip = { x: L.cam.x + B.x * L.cam.k, y: L.cam.y + B.y * L.cam.k, width: B.w * L.cam.k, height: B.h * L.cam.k, scale: 1.6 };
const cut = async () => (await L.page.send("Page.captureScreenshot", { format: "jpeg", quality: 88, clip })).data;
const mapOf = () => L.page.eval(`(() => { const o = []; for (let y = ${B.y}; y < ${B.y + B.h}; y++) { let r = ""; for (let x = ${B.x}; x < ${B.x + B.w}; x++) { const e = document.elementFromPoint(${L.cam.x} + (x + 0.5) * ${L.cam.k}, ${L.cam.y} + (y + 0.5) * ${L.cam.k}); r += e?.dataset?.hotspot === "playground" ? "p" : e?.closest?.('[data-station="playground"]') ? "L" : "."; } o.push(r); } return o; })()`);
const rest = [await cut(), await mapOf()];
await L.page.mouseMove(L.cam.x + 1205 * L.cam.k, L.cam.y + 440 * L.cam.k);
await sleep(2600);
const up = [await cut(), await mapOf()];
await L.page.close();
const old = [[1060, 505], [1095, 478], [1112, 400], [1130, 352], [1262, 352], [1270, 452], [1330, 458], [1372, 490], [1376, 540], [1340, 556], [1100, 556], [1060, 540]];
const page = await launch({ width: 1560, height: 440 });
await page.eval(`(async () => {
  document.body.style.cssText = "margin:0;background:#111;font:15px sans-serif;color:#eee;display:flex;gap:12px;padding:8px";
  const B = ${JSON.stringify(B)}, K = 500 / B.w;
  for (const [t, img, map, old] of ${JSON.stringify([["Before (at rest)", rest[0], null, old], ["After, at rest", rest[0], rest[1], null], ["After, raised", up[0], up[1], null]])}) {
    const d = document.createElement("div"), c = document.createElement("canvas"); c.width = 500; c.height = Math.round(B.h * K);
    const i = new Image(); i.src = "data:image/jpeg;base64," + img; await i.decode();
    const g = c.getContext("2d"); g.drawImage(i, 0, 0, c.width, c.height);
    g.fillStyle = "rgb(0 255 140 / 0.28)";
    if (old) { g.beginPath(); old.forEach(([x, y], k) => g[k ? "lineTo" : "moveTo"]((x - B.x) * K, (y - B.y) * K)); g.fill(); }
    if (map) map.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "p") { g.fillStyle = "rgb(0 255 140 / 0.28)"; g.fillRect(x * K, y * K, K, K); } else if (ch === "L") { g.fillStyle = "rgb(80 160 255 / 0.3)"; g.fillRect(x * K, y * K, K, K); } }));
    const h = document.createElement("div"); h.textContent = t; h.style.paddingBottom = "6px"; d.append(h, c); document.body.append(d);
  }
  return 1;
})()`);
await sleep(300);
await page.screenshot(join(HERE, "..", "playground-sign-region.png"));
await page.close();
process.exit(0);
