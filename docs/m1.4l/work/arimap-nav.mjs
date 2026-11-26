// M1.4L.3B: AriMap project page, short route and navigation check (default Chrome, 1648 x 928).
//   node arimap-nav.mjs   -> work/results/arimap-nav.txt
// The lab -> page -> lab round trip (soft navigations: a window marker must survive), browser Back / Forward after an
// in-page selection, the view parameters (render, floor) carried both ways, 404s, keyboard focus, reduced motion,
// and the homepage still saying "Coming soon".
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const lines = [];
let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const until = async (page, expr, ms = 15000) => { for (let t = 0; t < ms; t += 100) { if (await page.eval(expr)) return true; await sleep(100); } return false; };
const hideOverlay = (page) => page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
const path = (page) => page.eval("location.pathname + location.search");
const errors = [];
const watch = (page) => page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(JSON.stringify(m.params).slice(0, 200)); });
const PANEL = `document.querySelector('[data-station-panel="educational"]')`;
const openLink = `document.querySelector('[data-open-row="arimap"] a[data-open-project="arimap"]')`;

// 1. Deep link in the lab: Open project is a link to the page; Armat keeps "Coming soon".
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=arimap`); await hideOverlay(page);
  const href = await page.eval(`${openLink}?.getAttribute("href") ?? null`);
  check("lab-v2 deep link: AriMap Open project links to its page", href === "/lab-v2/projects/arimap", href);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "Armat").click()`);
  await until(page, `!!document.querySelector('[data-open-row="armat"]')`);
  const tr = await page.eval(`(() => { const r = document.querySelector('[data-open-row="armat"]'); return { link: !!r.querySelector("a"), disabled: r.querySelector("button")?.getAttribute("aria-disabled"), soon: r.textContent.includes("Coming soon") }; })()`);
  check("lab-v2: Armat keeps the disabled Coming soon action", !tr.link && tr.disabled === "true" && tr.soon, JSON.stringify(tr));
  await page.close();
}

// 2. Round trip by links: lab -> Open project -> Back to the lab, without a reload.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=arimap`); await hideOverlay(page);
  await page.eval("window.__noReload = 1");
  await page.eval(`${openLink}.click()`);
  const arrived = await until(page, `location.pathname === "/lab-v2/projects/arimap" && !!document.querySelector("[data-project-page]")`);
  const onPage = await page.eval(`({ marker: window.__noReload === 1, h1: document.querySelector("h1")?.textContent, scene: !!document.querySelector(".lab-camera, [data-station-panel]"), scroll: getComputedStyle(document.body).overflowY, title: document.title })`);
  check("Open project opens /lab-v2/projects/arimap with a client-side navigation", arrived && onPage.marker && onPage.h1 === "AriMap", JSON.stringify(onPage));
  check("the project page does not keep the lab scene mounted, and scrolls", !onPage.scene && onPage.scroll === "auto");
  const imgs = await page.eval(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } scrollTo(0, 0); await new Promise((r) => setTimeout(r, 800)); return [...document.querySelectorAll("main img")].map((i) => ({ ok: i.complete && i.naturalWidth > 0, alt: i.alt.length > 40, ratio: Math.abs(i.getBoundingClientRect().height / i.getBoundingClientRect().width - 1280 / 720) < 0.02 })); })()`);
  check("five screenshots load, each with a description and its own proportions", imgs.length === 5 && imgs.every((i) => i.ok && i.alt && i.ratio), JSON.stringify(imgs));
  const related = await page.eval(`[...document.querySelectorAll("main a")].find((a) => a.textContent.includes("View Armat"))?.getAttribute("href") ?? null`);
  check("Related project: Armat links to its lab preview", related === "/lab-v2?station=educational&project=armat", related);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  check("Back to the lab returns to the station and project", back === "/lab-v2?station=educational&project=arimap", back);
  await page.eval(`document.querySelector("main a[href^='/lab-v2?']").click()`);
  const home = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="educational"][data-open]')`);
  const st = await page.eval(`({ url: location.pathname + location.search, marker: window.__noReload === 1, pressed: [...${PANEL}.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent), scroll: getComputedStyle(document.body).overflowY })`);
  check("back in the lab: Educational open, AriMap selected, no reload", home && st.marker && st.pressed.join() === "AriMap" && st.url === "/lab-v2?station=educational&project=arimap", JSON.stringify(st));
  check("the lab is one fixed screen again", st.scroll === "hidden", st.scroll);
  await page.close();
}

// 3. Browser Back / Forward after selecting in the page (the lab writes station and project with pushState).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2`); await hideOverlay(page);
  await page.eval(`document.getElementById("station-educational-trigger").click()`);
  await until(page, `!!document.querySelector('[data-station-panel="educational"][data-open]')`);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "AriMap").click()`);
  await until(page, `!!${openLink}`);
  const before = await path(page);
  await page.eval(`${openLink}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  await page.eval("history.back()");
  const ok = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="educational"][data-open]')`);
  await sleep(800);
  const st = await page.eval(`({ url: location.pathname + location.search, pressed: [...(${PANEL}?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent), len: history.length })`);
  check("browser Back from the page restores the selected station and project", ok && st.url === before && st.pressed.join() === "AriMap", `before ${before}; ${JSON.stringify(st)}`);
  await page.eval("history.forward()");
  const fwd = await until(page, `location.pathname === "/lab-v2/projects/arimap" && !!document.querySelector("[data-project-page] h1")`);
  check("browser Forward returns to the project page", fwd, await path(page));
  await page.eval("history.back()");
  await until(page, `location.pathname === "/lab-v2"`); await sleep(600);
  await page.eval("history.back()");
  const lab = await until(page, `location.pathname + location.search === "/lab-v2?station=educational"`);
  check("further Back walks the lab's own history (station only)", lab, await path(page));
  await page.close();
}

// 4. View parameters travel both ways.
for (const view of ["render=lite", "render=lite&floor=original", "floor=approved"]) {
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=arimap&${view}`); await hideOverlay(page);
  const href = await page.eval(`${openLink}.getAttribute("href")`);
  await page.eval(`${openLink}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  const lab = await page.eval(`document.querySelector("nav a")?.getAttribute("href") ?? null`);
  check(`${view}: kept to the page and back`, href === `/lab-v2/projects/arimap?${view}` && back === `/lab-v2?station=educational&project=arimap&${view}` && lab === `/lab-v2?${view}`, `${href} | ${back} | ${lab}`);
  await page.close();
}

// 5. Unknown or unapproved slugs are 404s; view parameters are validated.
for (const [p, want] of [["/lab-v2/projects/arimap", 200], ["/lab-v2/projects/armat", 404], ["/lab-v2/projects/koreez", 404], ["/lab-v2/projects/nope", 404], ["/projects/arimap", 404]]) {
  const r = await fetch(BASE + p);
  check(`${p} -> ${want}`, r.status === want, String(r.status));
}
{
  const html = await (await fetch(`${BASE}/lab-v2/projects/arimap?render=heavy&floor=x&station=creative`)).text();
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/lab-v2"));
  check("unknown view values are dropped from every lab link", hrefs.includes("/lab-v2?station=educational&amp;project=arimap") && hrefs.every((h) => !/render=|floor=|creative/.test(h)), hrefs.join(" "));
}

// 6. Keyboard: Tab reaches the skip link, the header, Back to the lab and the related project, each with a visible ring.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2/projects/arimap`); await hideOverlay(page);
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.key("Tab", "Tab", 9);
    seen.push(await page.eval(`(() => { const e = document.activeElement; if (e === document.body) return { t: "(body)", ring: true }; const cs = getComputedStyle(e); return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 32), ring: e.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; })()`));
  }
  const names = seen.map((s) => s.t);
  const want = ["Skip to content", "Back to the lab", "View Armat in the lab"];
  check("Tab order reaches skip link, Back to the lab and the related project", want.every((w) => names.includes(w)), names.join(" | "));
  check("every focused control shows the focus ring", seen.every((s) => s.ring), seen.filter((s) => !s.ring).map((s) => s.t).join(", ") || "all");
  await page.close();
}

// 7. Reduced motion: nothing animates; the colour transitions are off.
{
  const page = await launch({ reducedMotion: true }); watch(page);
  await page.goto(`${BASE}/lab-v2/projects/arimap`); await hideOverlay(page);
  const r = await page.eval(`({ anims: document.getAnimations().length, tr: getComputedStyle(document.querySelector("main a")).transitionDuration })`);
  check("reduced motion: no animations, no transitions on links", r.anims === 0 && r.tr === "0s", JSON.stringify(r));
  await page.close();
}

// 8. The homepage is unchanged: AriMap still says Coming soon and nothing links to a project page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/?station=educational&project=arimap`); await hideOverlay(page);
  const r = await page.eval(`(() => { const row = document.querySelector('[data-open-row="arimap"]'); return { link: !!row.querySelector("a"), disabled: row.querySelector("button")?.getAttribute("aria-disabled"), soon: row.textContent.includes("Coming soon"), pageLinks: document.querySelectorAll('a[href*="/projects/"]').length, nav: [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("href")).join(" ") }; })()`);
  check("/: AriMap's Open project is still disabled with Coming soon", !r.link && r.disabled === "true" && r.soon && r.pageLinks === 0, JSON.stringify(r));
  check("/: header navigation unchanged", r.nav === "/ #lab-stations #station-experience #lab-intro", r.nav);
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ; "));
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "arimap-nav.txt", lines.join("\n") + "\n");
process.exit(0);
