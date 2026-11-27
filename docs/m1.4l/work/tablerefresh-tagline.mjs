// M1.4L.4B polish: how the TableRefresh hero tagline wraps at 1648 x 928 and 390 x 844 (default Chrome, dev server).
//   BASE=http://localhost:3000 node tablerefresh-tagline.mjs
//     -> work/results/tablerefresh-tagline.txt, work/captures/tablerefresh-hero-{1648x928,390x844}.png
// Reads the rendered lines of the tagline (one Range per word, grouped by line), checks the text, the line count, that
// no line is a single word, and that the hero has no horizontal overflow; captures the hero.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const CAP = fileURLToPath(new URL("./captures/", import.meta.url)); mkdirSync(CAP, { recursive: true });
const TAGLINE = "Keep TablePress tables updated without losing control of your data.";
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const errors = [];

for (const [width, height, touch] of [[1648, 928, false], [390, 844, true]]) {
  const page = await launch({ width, height, touch });
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(`${width}: ${JSON.stringify(m.params).slice(0, 200)}`); });
  const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); });
  await page.send("Page.navigate", { url: `${BASE}/lab-v2/projects/tablerefresh` }); await loaded;
  await page.eval("document.fonts.ready.then(() => true)");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await sleep(300);
  const r = await page.eval(`(() => {
    const p = document.querySelector("h1").nextElementSibling; const t = p.firstChild; const text = t.textContent;
    const words = []; const re = /\\S+/g; let m;
    while ((m = re.exec(text))) { const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); words.push({ w: m[0], top: Math.round(rg.getBoundingClientRect().top) }); }
    const rows = []; for (const w of words) { const last = rows[rows.length - 1]; if (last && Math.abs(last.top - w.top) < 4) last.words.push(w.w); else rows.push({ top: w.top, words: [w.w] }); }
    const b = p.getBoundingClientRect(); const cs = getComputedStyle(p); const hero = document.querySelector("article header").getBoundingClientRect();
    return { text, lines: rows.map((x) => x.words.join(" ")), box: [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)], font: cs.fontSize, maxWidth: cs.maxWidth,
      hero: [Math.round(hero.left), Math.round(hero.top + scrollY), Math.round(hero.width), Math.round(hero.height)], overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  })()`);
  const tag = `${width}x${height}`;
  console.log(tag, JSON.stringify(r));
  check(`${tag}: tagline text is the approved line`, r.text === TAGLINE, r.text);
  check(`${tag}: wraps into 2 or 3 lines, none a single word`, r.lines.length >= 2 && r.lines.length <= 3 && r.lines.every((l) => l.split(" ").length >= 2), r.lines.map((l) => `"${l}"`).join(" / "));
  check(`${tag}: no horizontal overflow`, !r.overflow);
  lines.push(`      ${tag}: font ${r.font}, max-width ${r.maxWidth}, tagline box ${r.box.join(",")}, hero ${r.hero.join(",")}`);
  const clip = { x: 0, y: 0, width, height: Math.min(r.hero[1] + r.hero[3] + 40, 2000), scale: 1 };
  writeFileSync(CAP + `tablerefresh-hero-${tag}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip })).data, "base64"));
  await page.close();
}
check("no console errors or exceptions", errors.length === 0, errors.slice(0, 2).join(" ‖ ") || "none");
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "tablerefresh-tagline.txt", lines.join("\n") + "\n");
process.exit(fail ? 1 : 0);
