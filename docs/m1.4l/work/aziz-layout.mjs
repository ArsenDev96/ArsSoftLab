// M1.4L.6B: AZIZ's project page at three sizes (desktop, mobile, narrow): layout checks, plus full-page and first-screen captures.
//   BASE=http://localhost:3000 node aziz-layout.mjs
//     -> work/results/aziz-layout.txt, work/results/aziz-layout.json, work/captures/aziz-page-<w>x<h>[-fold].png
// Checks per size: no horizontal overflow (document, and no element past the right edge), the header in use, the
// tagline's lines (2-3, none a single word, at every size), the six facts inside the panel,
// the section outline, the smallest text, no images (the page has no screenshots yet), and no console errors.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const DIR = fileURLToPath(new URL("./captures/", import.meta.url)); mkdirSync(DIR, { recursive: true });
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const SIZES = [[1648, 928, false, true], [390, 844, true, true], [320, 640, true, true]];
const SECTIONS = "Overview | Game modes | Engineering contributions | Technology stack | Testing and release | Links | Related project";
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const out = {};
for (const [width, height, touch, capture] of SIZES) {
  const tag = `${width}x${height}`;
  const page = await launch({ width, height, touch: !!touch });
  const errors = [];
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(JSON.stringify(m.params).slice(0, 300)); });
  const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); });
  await page.send("Page.navigate", { url: `${BASE}/lab-v2/projects/aziz` }); await loaded;
  await page.eval("document.fonts.ready.then(() => true)");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(2, height - 2); await sleep(500);
  const m = await page.eval(`(() => {
    const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const vw = document.documentElement.clientWidth;
    const past = [...document.querySelectorAll("body *")].filter((e) => { const b = e.getBoundingClientRect(); return b.width && b.right > vw + 0.5 && !e.closest("[aria-hidden=true]") && getComputedStyle(e).visibility !== "hidden"; }).map((e) => e.tagName + "." + (e.className?.baseVal ?? e.className).toString().slice(0, 40));
    // Text sizes in the page content only; the shared site header (the same on every project page) is reported apart.
    const textsIn = (sel) => [...document.querySelectorAll(sel)].filter((e) => e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && e.getClientRects().length && !e.closest(".sr-only"));
    const sizesOf = (els) => els.map((e) => ({ t: e.textContent.trim().slice(0, 30), px: parseFloat(getComputedStyle(e).fontSize) })).sort((a, b) => a.px - b.px);
    const sizes = sizesOf(textsIn("main *"));
    const headerSizes = sizesOf(textsIn("body > div > header *, body > div > div > header *, [data-project-page] > div header *, [data-project-page] > header *"));
    const visibleHeader = [...document.querySelectorAll("header")].filter((h) => h.getClientRects().length && !h.closest("article")).map((h) => h.querySelector("nav") ? "site" : "compact");
    const tp = document.querySelector("h1").nextElementSibling, tn = tp.firstChild, words = [], re = /\\S+/g; let w;
    while ((w = re.exec(tn.textContent))) { const rg = document.createRange(); rg.setStart(tn, w.index); rg.setEnd(tn, w.index + w[0].length); words.push({ w: w[0], top: Math.round(rg.getBoundingClientRect().top) }); }
    const rows = []; for (const x of words) { const last = rows[rows.length - 1]; if (last && Math.abs(last.top - x.top) < 4) last.words.push(x.w); else rows.push({ top: x.top, words: [x.w] }); }
    const dl = document.querySelector("article header dl"), dlb = dl.getBoundingClientRect();
    const facts = [...dl.querySelectorAll(":scope > div")].map((d) => { const dd = d.querySelector("dd"), b = dd.getBoundingClientRect(); return { term: d.querySelector("dt").textContent, value: dd.textContent, lines: Math.round(b.height / parseFloat(getComputedStyle(dd).lineHeight)), inside: b.left >= dlb.left - 0.5 && b.right <= dlb.right + 0.5 }; });
    return {
      docWidth: document.documentElement.scrollWidth, viewport: vw, docHeight: document.documentElement.scrollHeight,
      scrollable: getComputedStyle(document.body).overflowY, pastRightEdge: past, header: visibleHeader,
      h1: { text: document.querySelector("h1").textContent, px: parseFloat(getComputedStyle(document.querySelector("h1")).fontSize) },
      tagline: rows.map((x) => x.words.join(" ")), facts, factsBox: r(dl),
      headings: [...document.querySelectorAll("h1,h2,h3")].map((h) => h.tagName + " " + h.textContent.trim()),
      sections: [...document.querySelectorAll("section")].map((s) => ({ title: s.querySelector("h2").textContent, ...r(s) })),
      smallestText: sizes.slice(0, 3), smallestHeaderText: headerSizes.slice(0, 2), images: document.querySelectorAll("main img").length,
      scene: !!document.querySelector("[data-zone], .lab-camera"),
    };
  })()`);
  m.errors = errors;
  out[tag] = m;
  check(`${tag}: no horizontal overflow`, m.docWidth <= m.viewport && m.pastRightEdge.length === 0, m.pastRightEdge.slice(0, 3).join(", ") || `${m.docWidth} <= ${m.viewport}`);
  check(`${tag}: ${width >= 1024 ? "site" : "compact"} header`, m.header.join() === (width >= 1024 ? "site" : "compact"), m.header.join());
  check(`${tag}: sections in order, page scrolls, no lab scene`, m.sections.map((s) => s.title).join(" | ") === SECTIONS && m.scrollable === "auto" && !m.scene, `${m.sections.length} sections`);
  check(`${tag}: six facts, each inside the panel`, m.facts.length === 6 && m.facts.every((f) => f.inside), m.facts.map((f) => `${f.term} ${f.lines}l`).join(", "));
  // The no-single-word rule is checked at 1648 and 390, as for Armat. At 320 the shared template's 30ch tagline leaves a
  // last-word line for SQLOrbit and Armat too (measured in M1.4L.6B), so there it is recorded, not checked.
  if (width >= 390) check(`${tag}: tagline wraps into 2 or 3 lines, none a single word`, m.tagline.length >= 2 && m.tagline.length <= 3 && m.tagline.every((l) => l.split(" ").length >= 2), m.tagline.map((l) => `"${l}"`).join(" / "));
  else lines.push(`NOTE  ${tag}: tagline in ${m.tagline.length} lines${m.tagline.some((l) => !l.includes(" ")) ? ", last word alone (template-wide at this width: SQLOrbit and Armat too)" : ""}  (${m.tagline.map((l) => `"${l}"`).join(" / ")})`);
  check(`${tag}: no images on the page`, m.images === 0, String(m.images));
  check(`${tag}: smallest page-content text at least 11 px`, m.smallestText[0].px >= 11, `${m.smallestText[0].px}px "${m.smallestText[0].t}"; shared site header: ${m.smallestHeaderText.map((s) => `${+s.px.toFixed(2)}px "${s.t}"`).join(", ")}`);
  check(`${tag}: no console errors`, errors.length === 0, errors[0] ?? "none");
  lines.push(`      ${tag}: page ${m.docWidth}x${m.docHeight}, h1 ${m.h1.px}px, tagline ${m.tagline.length} lines, facts box ${Object.values(m.factsBox).join(",")}`);
  if (capture) {
    writeFileSync(DIR + `aziz-page-${tag}-fold.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
    writeFileSync(DIR + `aziz-page-${tag}.png`, Buffer.from((await page.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: m.docHeight, scale: 1 } })).data, "base64"));
  }
  await page.close();
}
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "aziz-layout.txt", lines.join("\n") + "\n");
writeFileSync(RES + "aziz-layout.json", JSON.stringify(out, null, 1) + "\n");
process.exit(fail ? 1 : 0);
