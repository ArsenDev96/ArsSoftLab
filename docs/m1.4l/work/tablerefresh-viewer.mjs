// M1.4L.4B: TableRefresh's stacked screenshots and the shared full-size viewer, focused check (default Chrome, dev server).
//   BASE=http://localhost:3000 node tablerefresh-viewer.mjs
//     -> work/results/tablerefresh-viewer.{txt,json}, work/captures/tablerefresh-viewer-{desktop,mobile}.png
// 1. Desktop 1648 x 928: three screenshots stacked in the content column, in order, at their own proportions, with
//    numbered titles; open, Previous, Next, arrow keys (with wrap-around), Tab trap, focus rings, image click keeps it
//    open, backdrop click / Escape / Close each close and return focus; wheel scrolling is locked; Enter and Space
//    open; the tall screenshot fits; no motion; no overflow.
// 2. Mobile 390 x 844 (touch): stacked at the screen's width; open by tap, fit, touch scroll lock, credits, backdrop tap.
// 3. Reduced motion: still no motion, and the controls' colour transitions are off.
// 4. Without JavaScript the screenshot is a link to its full-size file.
// 5. Smoke: AriMap's portrait row still opens its viewer (5 screens); SQLOrbit has no gallery or viewer.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const CAP = fileURLToPath(new URL("./captures/", import.meta.url)); mkdirSync(CAP, { recursive: true });
const lines = [];
const data = {};
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const until = async (page, expr, ms = 15000) => { for (let t = 0; t < ms; t += 100) { if (await page.eval(expr)) return true; await sleep(100); } return false; };
const errors = [];
const watch = (page, tag) => page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(`${tag}: ${JSON.stringify(m.params).slice(0, 240)}`); });
const shot = async (page, file) => writeFileSync(CAP + file, Buffer.from((await page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
const key = (page, key, code, keyCode, modifiers = 0, text) => page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? { text } : {}) }).then(() => page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers }));
const TAB = (page, shift) => key(page, "Tab", "Tab", 9, shift ? 8 : 0);
const LINK = (i) => `document.querySelector('a[data-viewer-index="${i}"]')`;
const DIALOG = `document.querySelector("dialog")`;
const PAGE = "/lab-v2/projects/tablerefresh";
const FILES = ["tables", "setup", "conflict"].map((n) => `/projects/tablerefresh/${n}.webp`);
const SIZES = [[1280, 900], [1280, 900], [1280, 1664]];

async function openPage(opts, path = PAGE) {
  const page = await launch(opts); watch(page, `${opts.width}x${opts.height}${opts.reducedMotion ? " reduced" : ""} ${path}`);
  const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); });
  await page.send("Page.navigate", { url: `${BASE}${path}` }); await loaded;
  await page.eval("document.fonts.ready.then(() => true)");
  // The screenshots load lazily: scroll through the page as a visitor would, then wait for every image.
  await page.eval("(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); return 1; })()");
  for (let i = 0; i < 150 && !(await page.eval("[...document.images].every((i) => i.complete && i.naturalWidth > 0)")); i++) await sleep(100);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  // Hydrated: React's props are on the gallery's wrapper (the click handler lives there).
  await until(page, `(() => { const w = ${LINK(0)}?.closest("ol")?.parentElement; return !!w && Object.keys(w).some((k) => k.startsWith("__reactProps")); })()`);
  return page;
}
/** Scroll screenshot i into the middle of the viewport and return its centre. */
const linkCentre = (page, i) => page.eval(`(() => { const a = ${LINK(i)}; a.scrollIntoView({ block: "center" }); const b = a.querySelector("img").getBoundingClientRect(); return { x: b.x + b.width / 2, y: Math.max(b.y, 0) + Math.min(b.height, innerHeight) / 2 }; })()`);
const state = (page) => page.eval(`(() => {
  const d = ${DIALOG}; const vw = innerWidth, vh = innerHeight;
  if (!d) return { open: false, active: document.activeElement?.getAttribute("data-viewer-index") ?? document.activeElement?.tagName, bodyOverflow: document.body.style.overflow, scrollY };
  const img = d.querySelector("img"); const b = img.getBoundingClientRect(); const a = document.activeElement; const cs = getComputedStyle(a);
  return {
    open: d.open, modal: d.matches(":modal"), name: d.getAttribute("aria-labelledby") ? document.getElementById(d.getAttribute("aria-labelledby")).textContent.trim() : d.getAttribute("aria-label"),
    description: d.getAttribute("aria-describedby") ? document.getElementById(d.getAttribute("aria-describedby")).textContent.trim() : null,
    counter: d.querySelector("p[aria-hidden]").textContent.replace(/\\s+/g, " ").trim(), live: d.querySelector("[aria-live]").textContent,
    src: img.getAttribute("src"), alt: img.alt.length, natural: [img.naturalWidth, img.naturalHeight], box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)],
    ratio: +(b.height / b.width).toFixed(3), inViewport: b.left >= 0 && b.top >= 0 && b.right <= vw + 0.5 && b.bottom <= vh + 0.5, notUpscaled: b.width <= img.naturalWidth + 0.5,
    hOverflow: d.scrollWidth > d.clientWidth || document.documentElement.scrollWidth > document.documentElement.clientWidth,
    activeInside: d.contains(a) && a !== d, active: (a.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 30), ring: a.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2,
    bodyOverflow: document.body.style.overflow, scrollY,
    motion: [d, img, d.firstElementChild].map((e) => { const s = getComputedStyle(e); return s.transitionDuration + "/" + s.animationName; }).join(" "),
    cssAnimations: document.getAnimations().filter((x) => !(x instanceof CSSTransition)).length,
    imageTransitions: document.getAnimations().filter((x) => x.effect?.target === img || x.effect?.target === d).length,
    buttonTransition: getComputedStyle(d.querySelector("button")).transitionDuration,
  };
})()`);
const gallery = (page) => page.eval(`(() => {
  const ol = document.querySelector("a[data-viewer-index]").closest("ol"); const o = ol.getBoundingClientRect();
  const col = ol.closest("section").querySelector(":scope > div.min-w-0").getBoundingClientRect();
  const lis = [...ol.children];
  return {
    ol: [Math.round(o.left), Math.round(o.top + scrollY), Math.round(o.width)], column: [Math.round(col.left), Math.round(col.width)],
    r: lis.map((l) => { const b = l.querySelector("img").getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), +b.width.toFixed(1), +b.height.toFixed(1)]; }),
    ratios: lis.map((l) => { const b = l.querySelector("img").getBoundingClientRect(); return +(b.height / b.width).toFixed(3); }),
    titles: lis.map((l) => l.querySelector("figcaption span span:last-child")?.textContent), numbers: lis.map((l) => l.querySelector("figcaption [aria-hidden]")?.textContent),
    hrefs: lis.map((l) => l.querySelector("a").getAttribute("href")), names: lis.map((l) => l.querySelector("a").textContent.trim().slice(-17)),
    current: lis.map((l) => l.querySelector("img").currentSrc.replace(location.origin, "")),
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
})()`);
const wantRatios = SIZES.map(([w, h]) => +(h / w).toFixed(3));

// ---------------------------------------------------------------------------------------------------------------
// 1. Desktop
{
  const page = await openPage({ width: 1648, height: 928 });
  const g = await gallery(page); data.desktopGallery = g;
  const stacked = g.r.every((b, i) => b[0] === g.r[0][0] && (i === 0 || b[1] > g.r[i - 1][1] + g.r[i - 1][3]));
  check("desktop: three screenshots stacked in order, numbered, with titles", g.r.length === 3 && stacked && g.titles.join() === "Tables,Setup,Edit conflict" && g.numbers.join() === "01,02,03", g.titles.join(" · "));
  check("desktop: each at the content column's full width, in its own proportions", g.r.every((b) => Math.abs(b[2] - g.column[1]) < 1 && b[0] === g.column[0]) && g.ratios.every((r, i) => Math.abs(r - wantRatios[i]) < 0.005), `${g.r.map((b) => `${b[2]}x${b[3]}`).join(", ")} in a ${g.column[1]} px column`);
  check("each screenshot links to its original WebP; link named by its alt text + (view full size)", g.hrefs.join() === FILES.join() && g.names.every((n) => n === "(view full size)"), g.hrefs.join(" "));
  check("desktop: no horizontal overflow", !g.overflow);

  // Open screenshot 02 with a click.
  const c = await linkCentre(page, 1); await sleep(150);
  const y0 = await page.eval("scrollY");
  await page.click(c.x, c.y); await until(page, `!!${DIALOG}?.open`, 5000); await sleep(150);
  let s = await state(page); data.desktopOpen = s;
  check("click opens a modal dialog", s.open && s.modal, `name "${s.name}"`);
  check("dialog named by the screen, described by its caption", s.name.includes("Setup") && s.description === "Choose a table, paste a CSV or Google Sheets link, and choose how often to sync.", s.description);
  check("counter 2 / 3, announced as 'Screenshot 2 of 3: Setup'", s.counter === "2 / 3" && s.live === "Screenshot 2 of 3: Setup", s.counter);
  check("shows the original file, with alt text", s.src === FILES[1] && s.natural.join() === "1280,900" && s.alt > 80, `${s.src} ${s.natural.join("x")}`);
  check("wide image fits the viewport, keeps its proportions, never upscaled", s.inViewport && Math.abs(s.ratio - wantRatios[1]) < 0.01 && s.notUpscaled, `${s.box[2]}x${s.box[3]} at ${s.box[0]},${s.box[1]}, ratio ${s.ratio}`);
  check("no horizontal overflow while open", !s.hOverflow);
  check("focus moves to Close", s.activeInside && s.active === "Close", s.active);
  check("no opening motion (no animation or transition on dialog or image)", s.cssAnimations === 0 && s.imageTransitions === 0 && /^0s\/none 0s\/none 0s\/none$/.test(s.motion), s.motion);
  check("credits shown under the caption (desktop)", await page.eval(`${DIALOG}.textContent.includes("Google's public sample sheet")`));

  // Background scroll lock (wheel over the viewer).
  await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 824, y: 464, deltaX: 0, deltaY: 800 }); await sleep(400);
  s = await state(page);
  check("page does not scroll behind the viewer", s.bodyOverflow === "hidden" && s.scrollY === y0, `scrollY ${y0} -> ${s.scrollY}`);

  // Next / Previous buttons, then the arrow keys, with wrap-around.
  const btn = (label) => page.eval(`(() => { const b = [...${DIALOG}.querySelectorAll("button")].find((b) => b.textContent.trim() === "${label}"); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const nb = await btn("Next screenshot"); await page.click(nb.x, nb.y); await sleep(150);
  const afterNext = await state(page); data.desktopTall = afterNext;
  check("Next button: 3 / 3 Edit conflict", afterNext.counter === "3 / 3" && afterNext.src === FILES[2] && afterNext.name.includes("Edit conflict"), `${afterNext.counter} ${afterNext.name}`);
  check("tall image (1280 x 1664) fits the viewport height, keeps its proportions", afterNext.inViewport && Math.abs(afterNext.ratio - wantRatios[2]) < 0.01 && afterNext.notUpscaled, `${afterNext.box[2]}x${afterNext.box[3]}`);
  await shot(page, "tablerefresh-viewer-desktop.png");
  const pb = await btn("Previous screenshot"); await page.click(pb.x, pb.y); await sleep(150);
  const afterPrev = await state(page);
  check("Previous button: back to 2 / 3", afterPrev.counter === "2 / 3", afterPrev.counter);
  check("no image-switching motion", afterNext.cssAnimations === 0 && afterNext.imageTransitions === 0);
  await key(page, "ArrowRight", "ArrowRight", 39); await sleep(100); const r1 = (await state(page)).counter;
  await key(page, "ArrowRight", "ArrowRight", 39); await sleep(100); const wrapFwd = (await state(page)).counter;
  await key(page, "ArrowLeft", "ArrowLeft", 37); await sleep(100); const wrapBack = (await state(page)).counter;
  check("Right / Left arrows step through the screens", r1 === "3 / 3", r1);
  check("arrows wrap: 3 -> 1 -> 3", wrapFwd === "1 / 3" && wrapBack === "3 / 3", `${wrapFwd}, ${wrapBack}`);
  await key(page, "ArrowLeft", "ArrowLeft", 37); await sleep(100);

  // Tab trap and focus rings: eight Tabs forward and four back, focus never leaves.
  const seen = [];
  for (let i = 0; i < 8; i++) { await TAB(page); seen.push(await state(page)); }
  for (let i = 0; i < 4; i++) { await TAB(page, true); seen.push(await state(page)); }
  check("Tab and Shift+Tab stay inside the viewer", seen.every((t) => t.open && t.activeInside), seen.slice(0, 4).map((t) => t.active).join(" | "));
  check("every control in the viewer shows the focus ring", seen.every((t) => t.ring), [...new Set(seen.map((t) => t.active))].join(", "));

  // Clicking the image itself keeps it open.
  s = await state(page);
  await page.click(s.box[0] + s.box[2] / 2, s.box[1] + s.box[3] / 2); await sleep(250);
  check("clicking the image does not close", (await state(page)).open);

  // Backdrop click (empty space left of the image) closes and returns focus to the screenshot that opened it.
  const bx = s.box[0] - 40, by = s.box[1] + s.box[3] / 2;
  const onBackdrop = await page.eval(`document.elementFromPoint(${bx}, ${by})?.hasAttribute("data-viewer-backdrop")`);
  await page.click(bx, by); await sleep(250);
  s = await state(page);
  check("backdrop click closes, focus returns to screenshot 02", onBackdrop && !s.open && s.active === "1", `point on backdrop: ${onBackdrop}, focus on index ${s.active}`);
  check("scrolling restored after close, position kept", s.bodyOverflow === "" && s.scrollY === y0, `scrollY ${s.scrollY}`);

  // Keyboard: Enter opens, Escape closes, focus returns with its ring.
  await page.eval(`${LINK(2)}.focus()`);
  await key(page, "Enter", "Enter", 13, 0, "\r"); await until(page, `!!${DIALOG}?.open`, 3000); await sleep(100);
  const ent = await state(page);
  await key(page, "Escape", "Escape", 27); await sleep(250);
  const esc = await state(page);
  const ring = await page.eval(`(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2; })()`);
  check("Enter on screenshot 03 opens it", ent.open && ent.counter === "3 / 3", ent.counter);
  check("Escape closes, focus returns to screenshot 03 with its focus ring", !esc.open && esc.active === "2" && ring, `focus on index ${esc.active}, ring ${ring}`);

  // Space opens; the Close button closes.
  await key(page, " ", "Space", 32, 0, " "); await until(page, `!!${DIALOG}?.open`, 3000); await sleep(100);
  const sp = await state(page);
  const cb = await btn("Close"); await page.click(cb.x, cb.y); await sleep(250);
  const cl = await state(page);
  check("Space opens (and the same key press does not close it)", sp.open && sp.counter === "3 / 3" && sp.active === "Close", sp.counter);
  check("Close button closes, focus returns to screenshot 03", !cl.open && cl.active === "2", `focus on index ${cl.active}`);
  check("URL unchanged by the viewer", (await page.eval("location.pathname + location.search")) === PAGE);
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Mobile 390 x 844 (touch)
{
  const page = await openPage({ width: 390, height: 844, touch: true });
  const g = await gallery(page); data.mobileGallery = g;
  check("mobile: three stacked at the content width (342 px), in order, own proportions", g.r.length === 3 && g.r.every((b) => b[0] === 24 && Math.round(b[2]) === 342) && g.ratios.every((r, i) => Math.abs(r - wantRatios[i]) < 0.005) && g.titles.join() === "Tables,Setup,Edit conflict", g.r.map((b) => `${b[2]}x${b[3]}`).join(", "));
  check("mobile: no horizontal overflow", !g.overflow);

  const ct = await linkCentre(page, 2); await sleep(150);
  const y0 = await page.eval("scrollY");
  await page.tap(ct.x, ct.y); await until(page, `!!${DIALOG}?.open`, 5000); await sleep(200);
  let s = await state(page); data.mobileOpen = s;
  check("tap opens screenshot 03 (3 / 3 Edit conflict)", s.open && s.modal && s.counter === "3 / 3" && s.name.includes("Edit conflict"), s.counter);
  check("mobile: tall image fits the viewport in its proportions", s.inViewport && Math.abs(s.ratio - wantRatios[2]) < 0.01, `${s.box[2]}x${s.box[3]} at ${s.box[0]},${s.box[1]}`);
  check("mobile: caption and credits line visible below the image", await page.eval(`(() => { const d = ${DIALOG}; const p = d.querySelector("p[id]").getBoundingClientRect(); const sm = d.querySelector("summary").getBoundingClientRect(); return p.bottom <= innerHeight && sm.bottom <= innerHeight && sm.height > 0; })()`));
  check("mobile: no horizontal overflow while open", !s.hOverflow);
  await shot(page, "tablerefresh-viewer-mobile.png");
  await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 650 }] });
  for (let yy = 620; yy >= 250; yy -= 30) { await page.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: yy }] }); await sleep(16); }
  await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(500);
  s = await state(page);
  check("mobile: swipe does not scroll the page behind", s.open && s.scrollY === y0, `scrollY ${y0} -> ${s.scrollY}`);
  await page.eval(`${DIALOG}.querySelector("summary").click()`); await sleep(100);
  const credits = await page.eval(`(() => { const d = ${DIALOG}; const det = d.querySelector("details"); const img = d.querySelector("img").getBoundingClientRect(); return { open: det.open, text: det.textContent.includes("fictional data"), fits: det.getBoundingClientRect().bottom <= innerHeight && img.top >= 0 }; })()`);
  check("mobile: Image credits expand to the source line, still within the screen", credits.open && credits.text && credits.fits, JSON.stringify(credits));
  await page.tap(250, 30); await sleep(300);
  s = await state(page);
  check("mobile: backdrop tap closes, focus returns to screenshot 03", !s.open && s.active === "2" && s.scrollY === y0, `focus on index ${s.active}`);
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------
// 3. Reduced motion
{
  const page = await openPage({ width: 1648, height: 928, reducedMotion: true });
  const c = await linkCentre(page, 0); await sleep(100);
  await page.click(c.x, c.y); await until(page, `!!${DIALOG}?.open`, 5000);
  await key(page, "ArrowRight", "ArrowRight", 39); await sleep(100);
  const s = await state(page);
  check("reduced motion: opens and steps with no animation; control transitions off", s.open && s.counter === "2 / 3" && s.cssAnimations === 0 && s.imageTransitions === 0 && s.buttonTransition === "0s", `button transition ${s.buttonTransition}`);
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Without JavaScript, and 5. AriMap and SQLOrbit smoke
{
  const page = await launch({ width: 1648, height: 928 }); watch(page, "no-js");
  await page.send("Emulation.setScriptExecutionDisabled", { value: true });
  const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); });
  await page.send("Page.navigate", { url: `${BASE}${PAGE}` }); await loaded;
  const nj = await page.eval(`(() => { const a = document.querySelector('a[data-viewer-index="0"]'); a.scrollIntoView({ block: "center" }); const b = a.getBoundingClientRect(); return { href: a.getAttribute("href"), x: b.x + b.width / 2, y: b.y + b.height / 2, dialog: !!document.querySelector("dialog") }; })()`);
  await page.click(nj.x, nj.y); await sleep(1200);
  const after = await page.eval(`({ path: location.pathname, type: document.contentType })`);
  check("without JavaScript the screenshot opens its full-size file", nj.href === FILES[0] && !nj.dialog && after.path === nj.href && after.type === "image/webp", `${after.path} (${after.type})`);
  await page.close();
}
{
  const page = await openPage({ width: 1648, height: 928 }, "/lab-v2/projects/arimap");
  const n = await page.eval(`document.querySelectorAll("a[data-viewer-index]").length`);
  const c = await linkCentre(page, 1); await sleep(150);
  await page.click(c.x, c.y); await until(page, `!!${DIALOG}?.open`, 5000); await sleep(100);
  const s = await state(page);
  check("AriMap smoke: five-screen row still opens the viewer (2 / 5 Find)", n === 5 && s.open && s.counter === "2 / 5" && s.name.includes("Find"), `${n} links, ${s.counter}`);
  await page.goto(`${BASE}/lab-v2/projects/sqlorbit`);
  const sq = await page.eval(`({ h1: document.querySelector("h1")?.textContent, viewerLinks: document.querySelectorAll("a[data-viewer-index]").length, dialog: !!document.querySelector("dialog"), sections: [...document.querySelectorAll("section h2")].map((h) => h.textContent), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })`);
  data.sqlorbit = sq;
  check("SQLOrbit smoke: page renders, no gallery or viewer, no overflow", sq.h1 === "SQLOrbit" && sq.viewerLinks === 0 && !sq.dialog && !sq.overflow, sq.sections.join(" · "));
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ‖ ") || "none");
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "tablerefresh-viewer.txt", lines.join("\n") + "\n");
writeFileSync(RES + "tablerefresh-viewer.json", JSON.stringify(data, null, 1) + "\n");
process.exit(fail ? 1 : 0);
