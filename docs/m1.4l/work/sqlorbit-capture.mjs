// M1.4L.2: SQLOrbit's project page at three sizes: full-page and first-screen captures, plus layout measurements.
//   node sqlorbit-capture.mjs   -> work/captures/sqlorbit-page-<w>x<h>[-fold].png, work/results/sqlorbit-layout.json
// Measures: horizontal overflow (document and any element past the right edge), the header in use, the smallest
// text size, heading outline, and each section's box. The dev overlay is hidden.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const DIR = fileURLToPath(new URL("./captures/", import.meta.url)); mkdirSync(DIR, { recursive: true });
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const SIZES = [[1648, 928], [1366, 768], [390, 844, true]];
const out = {};
for (const [width, height, touch] of SIZES) {
  const page = await launch({ width, height, touch: !!touch });
  const errors = [];
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(JSON.stringify(m.params).slice(0, 300)); });
  await page.goto(`${BASE}/lab-v2/projects/sqlorbit`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(2, height - 2); await sleep(500);
  const m = await page.eval(`(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const vw = document.documentElement.clientWidth;
    const past = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > vw + 0.5 && !e.closest("[aria-hidden=true]") && getComputedStyle(e).visibility !== "hidden"; }).map((e) => e.tagName + "." + (e.className?.baseVal ?? e.className).toString().slice(0, 40));
    const texts = [...document.querySelectorAll("main *, header *")].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length && !e.closest(".sr-only"));
    const sizes = texts.map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).sort((a, b) => a.px - b.px);
    const visibleHeader = [...document.querySelectorAll("header")].filter((h) => h.getClientRects().length && !h.closest("article")).map((h) => h.querySelector("nav") ? "site" : "compact");
    return {
      docWidth: document.documentElement.scrollWidth, viewport: vw, docHeight: document.documentElement.scrollHeight,
      scrollable: getComputedStyle(document.body).overflowY, pastRightEdge: past,
      header: visibleHeader, h1: { text: document.querySelector("h1").textContent, px: parseFloat(getComputedStyle(document.querySelector("h1")).fontSize) },
      headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName + " " + h.textContent.trim()),
      smallestText: sizes.slice(0, 3), sections: [...document.querySelectorAll("section")].map((s) => ({ h: s.querySelector("h2").textContent, ...r(s) })),
      scene: !!document.querySelector("[data-zone], .lab-camera"),
    };
  })()`);
  m.errors = errors;
  out[`${width}x${height}`] = m;
  console.log(`${width}x${height}`, JSON.stringify(m));
  writeFileSync(DIR + `sqlorbit-page-${width}x${height}-fold.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  writeFileSync(DIR + `sqlorbit-page-${width}x${height}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: m.docHeight, scale: 1 } })).data, "base64"));
  await page.close();
}
writeFileSync(RES + "sqlorbit-layout.json", JSON.stringify(out, null, 1) + "\n");
process.exit(0);
