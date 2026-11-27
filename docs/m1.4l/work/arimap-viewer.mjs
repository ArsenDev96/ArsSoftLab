// M1.4L.3C: AriMap's screenshot gallery and full-size viewer, focused check (default Chrome, dev server).
//   node arimap-viewer.mjs   -> work/results/arimap-viewer.txt, work/results/arimap-viewer.json,
//                               work/captures/arimap-viewer-{desktop,mobile}.png, arimap-gallery-mobile-centred.png
// 1. Desktop 1648 x 928: the five-across staggered row unchanged; open, Previous, Next, arrow keys (with wrap-around),
//    Tab trap, focus rings, image click keeps it open, backdrop click / Escape / Close each close and return focus;
//    wheel scrolling is locked; Enter and Space open; no motion; no overflow.
// 2. Mobile 390 x 844 (touch): two across with screen 05 centred at the same width; open by tap, fit, touch scroll lock.
// 3. Reduced motion: still no motion, and the controls' colour transitions are off.
// 4. Without JavaScript the screenshot is a link to its full-size file.
// 5. SQLOrbit smoke: page renders, no viewer links, no errors.
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
const shot = async (page, file, clip) => writeFileSync(CAP + file, Buffer.from((await page.send("Page.captureScreenshot", { format: "png", ...(clip ? { captureBeyondViewport: true, clip: { ...clip, scale: 1 } } : {}) })).data, "base64"));
const key = (page, key, code, keyCode, modifiers = 0, text) => page.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, modifiers, ...(text ? { text } : {}) }).then(() => page.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode, modifiers }));
const TAB = (page, shift) => key(page, "Tab", "Tab", 9, shift ? 8 : 0);
const LINK = (i) => `document.querySelector('a[data-viewer-index="${i}"]')`;
const DIALOG = `document.querySelector("dialog")`;

async function openPage(opts) {
  const page = await launch(opts); watch(page, `${opts.width}x${opts.height}${opts.reducedMotion ? " reduced" : ""}`);
  const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); });
  await page.send("Page.navigate", { url: `${BASE}/lab-v2/projects/arimap` }); await loaded;
  await page.eval("document.fonts.ready.then(() => true)");
  // The gallery loads lazily: scroll through it as a visitor would, then wait for every image.
  await page.eval("(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); return 1; })()");
  for (let i = 0; i < 100 && !(await page.eval("[...document.images].every((i) => i.complete && i.naturalWidth > 0)")); i++) await sleep(100);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  // Hydrated: React's props are on the gallery's wrapper (the click handler lives there).
  await until(page, `(() => { const w = ${LINK(0)}?.closest("ol")?.parentElement; return !!w && Object.keys(w).some((k) => k.startsWith("__reactProps")); })()`);
  return page;
}
/** Scroll screenshot i into the middle of the viewport and return its centre. */
const linkCentre = (page, i) => page.eval(`(() => { const a = ${LINK(i)}; a.scrollIntoView({ block: "center" }); const b = a.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
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

// ---------------------------------------------------------------------------------------------------------------
// 1. Desktop
{
  const page = await openPage({ width: 1648, height: 928 });
  const g = await page.eval(`(() => { const lis = [...document.querySelectorAll("ol > li")].filter((l) => l.querySelector("a[data-viewer-index]")); const r = lis.map((l) => { const b = l.querySelector("img").getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top + scrollY), Math.round(b.width), Math.round(b.height)]; }); return { r, titles: lis.map((l) => l.querySelector("figcaption span span:last-child")?.textContent), hrefs: lis.map((l) => l.querySelector("a").getAttribute("href")), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  data.desktopGallery = g;
  const oneRow = g.r.every((b, i) => i === 0 || b[0] > g.r[i - 1][0]);
  const stagger = g.r.map((b) => b[1] - g.r[0][1]);
  check("desktop gallery: five across in one row, original order", g.r.length === 5 && oneRow && g.titles.join() === "Home,Find,Travel,Quick Challenge,Results", g.titles.join(" · "));
  check("desktop gallery: 198 x 351 each, stagger 0/56/0/56/0 px", g.r.every((b) => b[2] === 198 && b[3] === 351) && stagger.join() === "0,56,0,56,0", `${g.r[0][2]}x${g.r[0][3]}, offsets ${stagger.join("/")}`);
  check("each screenshot links to its 720 x 1280 WebP", g.hrefs.join() === ["home", "find", "travel", "quick-challenge", "results"].map((n) => `/projects/arimap/${n}.webp`).join(), g.hrefs[1]);
  check("desktop gallery: no horizontal overflow", !g.overflow);

  // Open screenshot 02 with a click.
  const c = await linkCentre(page, 1); await sleep(150);
  const y0 = await page.eval("scrollY");
  await page.click(c.x, c.y); await until(page, `!!${DIALOG}?.open`, 5000); await sleep(150);
  let s = await state(page); data.desktopOpen = s;
  check("click opens a modal dialog", s.open && s.modal, `name "${s.name}"`);
  check("dialog named by the screen, described by its caption", s.name.includes("Find") && s.description === "Five questions, one per country, with optional help.", s.description);
  check("counter 2 / 5, announced as 'Screenshot 2 of 5: Find'", s.counter === "2 / 5" && s.live === "Screenshot 2 of 5: Find", s.counter);
  check("shows the original file, with alt text", s.src === "/projects/arimap/find.webp" && s.natural.join() === "720,1280" && s.alt > 20, `${s.src} ${s.natural.join("x")}`);
  check("image fits the viewport, keeps 9:16, never upscaled", s.inViewport && Math.abs(s.ratio - 1.778) < 0.01 && s.notUpscaled, `${s.box[2]}x${s.box[3]} at ${s.box[0]},${s.box[1]}, ratio ${s.ratio}`);
  check("no horizontal overflow while open", !s.hOverflow);
  check("focus moves to Close", s.activeInside && s.active === "Close", s.active);
  check("no opening motion (no animation or transition on dialog or image)", s.cssAnimations === 0 && s.imageTransitions === 0 && /^0s\/none 0s\/none 0s\/none$/.test(s.motion), s.motion);
  await shot(page, "arimap-viewer-desktop.png");

  // Background scroll lock (wheel over the viewer).
  await page.send("Input.dispatchMouseEvent", { type: "mouseWheel", x: 824, y: 464, deltaX: 0, deltaY: 800 }); await sleep(400);
  s = await state(page);
  check("page does not scroll behind the viewer", s.bodyOverflow === "hidden" && s.scrollY === y0, `scrollY ${y0} -> ${s.scrollY}`);

  // Next / Previous buttons, then the arrow keys, with wrap-around.
  const btn = (label) => page.eval(`(() => { const b = [...${DIALOG}.querySelectorAll("button")].find((b) => b.textContent.trim() === "${label}"); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  const nb = await btn("Next screenshot"); await page.click(nb.x, nb.y); await sleep(150);
  const afterNext = await state(page);
  const pb = await btn("Previous screenshot"); await page.click(pb.x, pb.y); await sleep(150);
  const afterPrev = await state(page);
  check("Next button: 3 / 5 Travel; Previous button: back to 2 / 5", afterNext.counter === "3 / 5" && afterNext.src.endsWith("travel.webp") && afterNext.name.includes("Travel") && afterPrev.counter === "2 / 5", `${afterNext.counter} ${afterNext.name} -> ${afterPrev.counter}`);
  check("no image-switching motion", afterNext.cssAnimations === 0 && afterNext.imageTransitions === 0);
  await key(page, "ArrowRight", "ArrowRight", 39); await sleep(100); const r1 = (await state(page)).counter;
  await key(page, "ArrowLeft", "ArrowLeft", 37); await key(page, "ArrowLeft", "ArrowLeft", 37); await sleep(100); const l2 = (await state(page)).counter;
  await key(page, "ArrowLeft", "ArrowLeft", 37); await sleep(100); const wrapBack = (await state(page)).counter;
  await key(page, "ArrowRight", "ArrowRight", 39); await sleep(100); const wrapFwd = (await state(page)).counter;
  check("Right / Left arrows step through the screens", r1 === "3 / 5" && l2 === "1 / 5", `${r1}, ${l2}`);
  check("arrows wrap: 1 -> 5 -> 1", wrapBack === "5 / 5" && wrapFwd === "1 / 5", `${wrapBack}, ${wrapFwd}`);

  // Tab trap and focus rings: eight Tabs forward and four back, focus never leaves.
  const seen = [];
  for (let i = 0; i < 8; i++) { await TAB(page); const t = await state(page); seen.push(t); }
  for (let i = 0; i < 4; i++) { await TAB(page, true); const t = await state(page); seen.push(t); }
  const order = seen.slice(0, 4).map((t) => t.active).join(" | ");
  check("Tab and Shift+Tab stay inside the viewer", seen.every((t) => t.open && t.activeInside), order);
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
  await page.eval(`${LINK(3)}.focus()`);
  await key(page, "Enter", "Enter", 13, 0, "\r"); await until(page, `!!${DIALOG}?.open`, 3000); await sleep(100);
  const ent = await state(page);
  await key(page, "Escape", "Escape", 27); await sleep(250);
  const esc = await state(page);
  const ring = await page.eval(`(() => { const a = document.activeElement; const cs = getComputedStyle(a); return a.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2; })()`);
  check("Enter on screenshot 04 opens it", ent.open && ent.counter === "4 / 5", ent.counter);
  check("Escape closes, focus returns to screenshot 04 with its focus ring", !esc.open && esc.active === "3" && ring, `focus on index ${esc.active}, ring ${ring}`);

  // Space opens; the Close button closes.
  await key(page, " ", "Space", 32, 0, " "); await until(page, `!!${DIALOG}?.open`, 3000); await sleep(100);
  const sp = await state(page);
  const cb = await btn("Close"); await page.click(cb.x, cb.y); await sleep(250);
  const cl = await state(page);
  check("Space opens (and the same key press does not close it)", sp.open && sp.counter === "4 / 5" && sp.active === "Close", sp.counter);
  check("Close button closes, focus returns to screenshot 04", !cl.open && cl.active === "3", `focus on index ${cl.active}`);
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------
// 2. Mobile 390 x 844 (touch)
{
  const page = await openPage({ width: 390, height: 844, touch: true });
  const g = await page.eval(`(() => { const ol = document.querySelector("a[data-viewer-index]").closest("ol"); const o = ol.getBoundingClientRect(); const lis = [...ol.children]; const r = lis.map((l) => { const b = l.querySelector("img").getBoundingClientRect(); return [+(b.left - o.left).toFixed(1), Math.round(b.top - o.top), +b.width.toFixed(1), +b.height.toFixed(1)]; }); return { ol: [Math.round(o.left), Math.round(o.top + scrollY), Math.round(o.width), Math.round(o.height)], r, titles: lis.map((l) => l.querySelector("figcaption span span:last-child")?.textContent), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth }; })()`);
  data.mobileGallery = g;
  const [a, b, c, d, e] = g.r;
  const centred = Math.abs(e[0] + e[2] / 2 - g.ol[2] / 2) < 0.6;
  check("mobile gallery: two across, original order", a[1] === b[1] && c[1] === d[1] && a[0] === c[0] && b[0] === d[0] && b[0] > a[0] && e[1] > c[1] && g.titles.join() === "Home,Find,Travel,Quick Challenge,Results", `rows at ${a[1]}, ${c[1]}, ${e[1]}`);
  check("mobile gallery: screen 05 centred on its own row", centred, `05 centre ${(e[0] + e[2] / 2).toFixed(1)} of row ${g.ol[2]} (half ${g.ol[2] / 2})`);
  check("mobile gallery: 05 the same size as the others (163 x 290), 9:16", g.r.every((x) => Math.abs(x[2] - a[2]) < 0.6 && Math.abs(x[3] - a[3]) < 0.6) && Math.round(a[2]) === 163 && Math.round(a[3]) === 290, `${a[2]}x${a[3]}`);
  check("mobile gallery: no horizontal overflow", !g.overflow);
  await shot(page, "arimap-gallery-mobile-centred.png", { x: 0, y: g.ol[1] - 24, width: 390, height: g.ol[3] + 48 });

  const ct = await linkCentre(page, 4); await sleep(150);
  const y0 = await page.eval("scrollY");
  await page.tap(ct.x, ct.y); await until(page, `!!${DIALOG}?.open`, 5000); await sleep(200);
  let s = await state(page); data.mobileOpen = s;
  check("tap opens screenshot 05 (5 / 5 Results)", s.open && s.modal && s.counter === "5 / 5" && s.name.includes("Results"), s.counter);
  check("mobile: image fits the viewport at 9:16, nearly the full width", s.inViewport && Math.abs(s.ratio - 1.778) < 0.01 && s.box[2] >= 340, `${s.box[2]}x${s.box[3]} at ${s.box[0]},${s.box[1]}`);
  check("mobile: caption and credits line visible below the image", await page.eval(`(() => { const d = ${DIALOG}; const p = d.querySelector("p[id]").getBoundingClientRect(); const sm = d.querySelector("summary").getBoundingClientRect(); return p.bottom <= innerHeight && sm.bottom <= innerHeight && sm.height > 0; })()`));
  check("mobile: no horizontal overflow while open", !s.hOverflow);
  await shot(page, "arimap-viewer-mobile.png");

  // Touch scroll lock: a vertical swipe over the viewer.
  await page.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 195, y: 650 }] });
  for (let yy = 620; yy >= 250; yy -= 30) { await page.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 195, y: yy }] }); await sleep(16); }
  await page.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(500);
  s = await state(page);
  check("mobile: swipe does not scroll the page behind", s.open && s.scrollY === y0, `scrollY ${y0} -> ${s.scrollY}`);

  // Credits fold open on demand.
  await page.eval(`${DIALOG}.querySelector("summary").click()`); await sleep(100);
  const credits = await page.eval(`(() => { const d = ${DIALOG}; const det = d.querySelector("details"); const img = d.querySelector("img").getBoundingClientRect(); return { open: det.open, text: det.textContent.includes("Natural Earth") && det.textContent.includes("ESA WorldCover"), fits: det.getBoundingClientRect().bottom <= innerHeight && img.top >= 0 }; })()`);
  check("mobile: Image credits expand to the map attribution, still within the screen", credits.open && credits.text && credits.fits, JSON.stringify(credits));

  // Backdrop tap (the empty space in the top bar) closes; focus back on 05.
  await page.tap(250, 30); await sleep(300);
  s = await state(page);
  check("mobile: backdrop tap closes, focus returns to screenshot 05", !s.open && s.active === "4" && s.scrollY === y0, `focus on index ${s.active}`);
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
  check("reduced motion: opens and steps with no animation; control transitions off", s.open && s.counter === "2 / 5" && s.cssAnimations === 0 && s.imageTransitions === 0 && s.buttonTransition === "0s", `button transition ${s.buttonTransition}`);
  await page.close();
}

// ---------------------------------------------------------------------------------------------------------------
// 4. Without JavaScript, and 5. SQLOrbit smoke
{
  const page = await launch({ width: 1648, height: 928 }); watch(page, "no-js / sqlorbit");
  await page.send("Emulation.setScriptExecutionDisabled", { value: true });
  await page.goto(`${BASE}/lab-v2/projects/arimap`).catch(() => {});
  const nj = await page.eval(`(() => { const a = document.querySelector('a[data-viewer-index="2"]'); a.scrollIntoView({ block: "center" }); const b = a.getBoundingClientRect(); return { href: a.getAttribute("href"), x: b.x + b.width / 2, y: b.y + b.height / 2, dialog: !!document.querySelector("dialog") }; })()`);
  await page.click(nj.x, nj.y); await sleep(1200);
  const after = await page.eval(`({ path: location.pathname, type: document.contentType })`);
  check("without JavaScript the screenshot opens its full-size file", nj.href === "/projects/arimap/travel.webp" && !nj.dialog && after.path === nj.href && after.type === "image/webp", `${after.path} (${after.type})`);
  await page.send("Emulation.setScriptExecutionDisabled", { value: false });

  await page.goto(`${BASE}/lab-v2/projects/sqlorbit`);
  const sq = await page.eval(`({ h1: document.querySelector("h1")?.textContent, page: document.querySelector("[data-project-page]")?.getAttribute("data-project-page"), viewerLinks: document.querySelectorAll("a[data-viewer-index]").length, dialog: !!document.querySelector("dialog"), sections: [...document.querySelectorAll("section h2")].map((h) => h.textContent), overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })`);
  data.sqlorbit = sq;
  check("SQLOrbit smoke: page renders, no gallery or viewer, no overflow", sq.h1 === "SQLOrbit" && sq.page === "sqlorbit" && sq.viewerLinks === 0 && !sq.dialog && !sq.overflow, sq.sections.join(" · "));
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ‖ ") || "none");
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "arimap-viewer.txt", lines.join("\n") + "\n");
writeFileSync(RES + "arimap-viewer.json", JSON.stringify(data, null, 1) + "\n");
process.exit(fail ? 1 : 0);
