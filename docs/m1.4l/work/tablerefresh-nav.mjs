// M1.4L.4B: TableRefresh project page, route and navigation check (default Chrome, 1648 x 928).
//   BASE=http://localhost:3000 node tablerefresh-nav.mjs   -> work/results/tablerefresh-nav.txt
// The lab -> page -> lab round trip (soft navigations: a window marker must survive), browser Back / Forward after an
// in-page selection, SQLOrbit <-> TableRefresh through the related cards (with history), the view parameters
// (render, floor) carried both ways, the WordPress.org link, 404s, keyboard focus, reduced motion, and the homepage
// still saying "Coming soon".
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
const PANEL = `document.querySelector('[data-station-panel="engineering"]')`;
const openLink = (id) => `document.querySelector('[data-open-row="${id}"] a[data-open-project="${id}"]')`;
const relatedLink = (text) => `[...document.querySelectorAll("main a")].find((a) => a.textContent.includes(${JSON.stringify(text)}))`;
const PAGE = "/lab-v2/projects/tablerefresh";
const visit = async (page, url) => { const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); }); await page.send("Page.navigate", { url }); await loaded; await page.eval("document.fonts.ready.then(() => true)"); };

// 1. Deep link in the lab: Open project is a link to the page; SQLOrbit's still links to its own; a project without a
//    page keeps "Coming soon" (Wallpapers since M1.4L.6B, when AZIZ got its page; AZIZ from M1.4L.5B).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=engineering&project=tablerefresh`); await hideOverlay(page);
  const href = await page.eval(`${openLink("tablerefresh")}?.getAttribute("href") ?? null`);
  check("lab-v2 deep link: TableRefresh Open project links to its page", href === PAGE, href);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "SQLOrbit").click()`);
  await until(page, `!!${openLink("sqlorbit")}`);
  check("lab-v2: SQLOrbit's Open project still links to its page", (await page.eval(`${openLink("sqlorbit")}.getAttribute("href")`)) === "/lab-v2/projects/sqlorbit");
  await page.goto(`${BASE}/lab-v2?station=creative&project=wallpapers`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="wallpapers"]')`);
  const ar = await page.eval(`(() => { const r = document.querySelector('[data-open-row="wallpapers"]'); return { link: !!r.querySelector("a"), disabled: r.querySelector("button")?.getAttribute("aria-disabled"), soon: r.textContent.includes("Coming soon") }; })()`);
  check("lab-v2: a project without a page (Wallpapers) keeps the disabled Coming soon action", !ar.link && ar.disabled === "true" && ar.soon, JSON.stringify(ar));
  await page.close();
}

// 2. Round trip by links: lab -> Open project -> Back to the lab, without a reload.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=engineering&project=tablerefresh`); await hideOverlay(page);
  await page.eval("window.__noReload = 1");
  await page.eval(`${openLink("tablerefresh")}.click()`);
  const arrived = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page]")`);
  const onPage = await page.eval(`({ marker: window.__noReload === 1, h1: document.querySelector("h1")?.textContent, scene: !!document.querySelector(".lab-camera, [data-station-panel]"), scroll: getComputedStyle(document.body).overflowY, title: document.title, robots: document.querySelector('meta[name="robots"]')?.content })`);
  check("Open project opens the TableRefresh page with a client-side navigation", arrived && onPage.marker && onPage.h1 === "TableRefresh", JSON.stringify(onPage));
  check("the project page does not keep the lab scene mounted, and scrolls", !onPage.scene && onPage.scroll === "auto");
  check("title and noindex like the other project pages", onPage.title === "TableRefresh — Lab v2 (experimental)" && /noindex/.test(onPage.robots ?? ""), `${onPage.title} | ${onPage.robots}`);
  const sections = await page.eval(`[...document.querySelectorAll("section h2")].map((h) => h.textContent)`);
  check("sections in the approved order", sections.join(" | ") === "Overview | How synchronization works | Screenshots | Engineering contributions | Technology stack | Testing and compatibility | Links | Related project", sections.join(" | "));
  const facts = await page.eval(`[...document.querySelectorAll("header dl > div")].map((d) => d.querySelector("dt").textContent + ": " + d.querySelector("dd").textContent)`);
  check("hero facts: status, version, category, role, platforms", facts.join(" | ") === "Status: Published | Release: Version 1.0.1 on WordPress.org | Category: WordPress Plugin / Developer Tools | Role: Creator & Full-stack Engineer | Platforms: WordPress · TablePress", facts.join(" | "));
  const imgs = await page.eval(`(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 300) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } for (let t = 0; t < 150 && ![...document.querySelectorAll("main img")].every((i) => i.complete && i.naturalWidth > 0); t++) await new Promise((r) => setTimeout(r, 100)); scrollTo(0, 0); return [...document.querySelectorAll("main img")].map((i) => { const b = i.getBoundingClientRect(); return { ok: i.complete && i.naturalWidth > 0, alt: i.alt.length > 80, ratio: +(b.height / b.width).toFixed(3), want: +(i.getAttribute("height") / i.getAttribute("width")).toFixed(3) }; }); })()`);
  check("three screenshots load, each with a description and its own proportions", imgs.length === 3 && imgs.every((i) => i.ok && i.alt && Math.abs(i.ratio - i.want) < 0.01), JSON.stringify(imgs));
  const ext = await page.eval(`(() => { const a = ${relatedLink("TableRefresh on WordPress.org")}; return a && { href: a.getAttribute("href"), target: a.target, rel: a.rel, sr: a.querySelector(".sr-only")?.textContent }; })()`);
  check("WordPress.org link: the listing, in a new tab, announced as such", ext?.href === "https://wordpress.org/plugins/tablerefresh/" && ext.target === "_blank" && ext.rel === "noopener noreferrer" && ext.sr === " (opens in a new tab)", JSON.stringify(ext));
  const noGithub = await page.eval(`![...document.querySelectorAll("a")].some((a) => /github/i.test(a.href))`);
  check("no GitHub link", noGithub);
  const related = await page.eval(`${relatedLink("Open SQLOrbit")}?.getAttribute("href") ?? null`);
  check("Related project: Open SQLOrbit links to its page", related === "/lab-v2/projects/sqlorbit", related);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  check("Back to the lab returns to the station and project", back === "/lab-v2?station=engineering&project=tablerefresh", back);
  await page.eval(`document.querySelector("main a[href^='/lab-v2?']").click()`);
  const home = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="engineering"][data-open]')`);
  const st = await page.eval(`({ url: location.pathname + location.search, marker: window.__noReload === 1, pressed: [...${PANEL}.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent), scroll: getComputedStyle(document.body).overflowY })`);
  check("back in the lab: Engineering open, TableRefresh selected, no reload", home && st.marker && st.pressed.join() === "TableRefresh" && st.url === "/lab-v2?station=engineering&project=tablerefresh", JSON.stringify(st));
  check("the lab is one fixed screen again", st.scroll === "hidden", st.scroll);
  await page.close();
}

// 3. Browser Back / Forward after selecting in the lab (the lab writes station and project with pushState).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2`); await hideOverlay(page);
  await page.eval(`document.getElementById("station-engineering-trigger").click()`);
  await until(page, `!!document.querySelector('[data-station-panel="engineering"][data-open]')`);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "TableRefresh").click()`);
  await until(page, `!!${openLink("tablerefresh")}`);
  const before = await path(page);
  await page.eval(`${openLink("tablerefresh")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  await page.eval("history.back()");
  const ok = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="engineering"][data-open]')`);
  await sleep(800);
  const st = await page.eval(`({ url: location.pathname + location.search, pressed: [...(${PANEL}?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent) })`);
  check("browser Back from the page restores the selected station and project", ok && st.url === before && st.pressed.join() === "TableRefresh", `before ${before}; ${JSON.stringify(st)}`);
  await page.eval("history.forward()");
  const fwd = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page] h1")`);
  check("browser Forward returns to the project page", fwd, await path(page));
  await page.eval("history.back()");
  await until(page, `location.pathname === "/lab-v2"`); await sleep(600);
  await page.eval("history.back()");
  const lab = await until(page, `location.pathname + location.search === "/lab-v2?station=engineering"`);
  check("further Back walks the lab's own history (station only)", lab, await path(page));
  await page.close();
}

// 4. SQLOrbit <-> TableRefresh through the related cards, with browser history.
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}/lab-v2/projects/sqlorbit`); await hideOverlay(page);
  await page.eval("window.__noReload = 1");
  const card = await page.eval(`(() => { const a = ${relatedLink("Open TableRefresh")}; return a && { href: a.getAttribute("href"), summary: a.closest("li").querySelector("p:not(:first-child)")?.textContent }; })()`);
  check("SQLOrbit's related card now says Open TableRefresh and links to the page", card?.href === PAGE, JSON.stringify(card));
  await page.eval(`${relatedLink("Open TableRefresh")}.click()`);
  const a1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "TableRefresh"`);
  check("SQLOrbit -> TableRefresh: client-side navigation", a1 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.eval(`${relatedLink("Open SQLOrbit")}.click()`);
  const a2 = await until(page, `location.pathname === "/lab-v2/projects/sqlorbit" && document.querySelector("h1")?.textContent === "SQLOrbit"`);
  check("TableRefresh -> SQLOrbit: client-side navigation", a2 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.eval("history.back()");
  const b1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "TableRefresh"`);
  await page.eval("history.back()");
  const b2 = await until(page, `location.pathname === "/lab-v2/projects/sqlorbit" && document.querySelector("h1")?.textContent === "SQLOrbit"`);
  await page.eval("history.forward()");
  const f1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "TableRefresh"`);
  check("Back, Back, Forward walk SQLOrbit and TableRefresh correctly, without a reload", b1 && b2 && f1 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.close();
}

// 5. View parameters travel both ways (lab links and the related card).
for (const view of ["render=lite", "render=lite&floor=original", "floor=approved"]) {
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=engineering&project=tablerefresh&${view}`); await hideOverlay(page);
  const href = await page.eval(`${openLink("tablerefresh")}.getAttribute("href")`);
  await page.eval(`${openLink("tablerefresh")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  const lab = await page.eval(`document.querySelector("nav a")?.getAttribute("href") ?? null`);
  const rel = await page.eval(`${relatedLink("Open SQLOrbit")}.getAttribute("href")`);
  check(`${view}: kept to the page, back to the lab and to SQLOrbit`, href === `${PAGE}?${view}` && back === `/lab-v2?station=engineering&project=tablerefresh&${view}` && lab === `/lab-v2?${view}` && rel === `/lab-v2/projects/sqlorbit?${view}`, `${href} | ${back} | ${lab} | ${rel}`);
  await page.close();
}

// 6. Unknown or unapproved slugs are 404s; view parameters are validated.
for (const [p, want] of [[PAGE, 200], ["/lab-v2/projects/sqlorbit", 200], ["/lab-v2/projects/arimap", 200], ["/lab-v2/projects/armat", 200], ["/lab-v2/projects/aziz", 200], ["/lab-v2/projects/wallpapers", 404], ["/lab-v2/projects/nope", 404], ["/projects/tablerefresh", 404]]) {
  const r = await fetch(BASE + p);
  check(`${p} -> ${want}`, r.status === want, String(r.status));
}
{
  const html = await (await fetch(`${BASE}${PAGE}?render=heavy&floor=x&station=creative`)).text();
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/lab-v2"));
  check("unknown view values are dropped from every lab link", hrefs.includes("/lab-v2?station=engineering&amp;project=tablerefresh") && hrefs.every((h) => !/render=|floor=|creative/.test(h)), hrefs.join(" "));
}

// 7. Keyboard: Tab reaches the skip link, Back to the lab, the screenshots, WordPress.org and SQLOrbit, each with a ring.
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  const seen = [];
  for (let i = 0; i < 20; i++) {
    await page.key("Tab", "Tab", 9);
    seen.push(await page.eval(`(() => { const e = document.activeElement; if (e === document.body) return { t: "(body)", ring: true }; const cs = getComputedStyle(e); return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 34), viewer: e.hasAttribute("data-viewer-index"), ring: e.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; })()`));
  }
  const names = seen.map((s) => s.t);
  const want = ["Skip to content", "Back to the lab", "TableRefresh on WordPress.org (op", "Open SQLOrbit"];
  check("Tab order reaches skip link, Back to the lab, WordPress.org and the related project", want.every((w) => names.some((n) => n.startsWith(w))), names.join(" | "));
  check("Tab reaches all three screenshots", seen.filter((s) => s.viewer).length === 3, String(seen.filter((s) => s.viewer).length));
  check("every focused control shows the focus ring", seen.every((s) => s.ring), seen.filter((s) => !s.ring).map((s) => s.t).join(", ") || "all");
  await page.close();
}

// 8. Reduced motion: nothing animates; the colour transitions are off.
{
  const page = await launch({ reducedMotion: true }); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  const r = await page.eval(`({ anims: document.getAnimations().length, tr: getComputedStyle(document.querySelector("main a")).transitionDuration })`);
  check("reduced motion: no animations, no transitions on links", r.anims === 0 && r.tr === "0s", JSON.stringify(r));
  await page.close();
}

// 9. The homepage is unchanged: TableRefresh still says Coming soon and nothing links to a project page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/?station=engineering&project=tablerefresh`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="tablerefresh"]')`);
  const r = await page.eval(`(() => { const row = document.querySelector('[data-open-row="tablerefresh"]'); return { link: !!row.querySelector("a"), disabled: row.querySelector("button")?.getAttribute("aria-disabled"), soon: row.textContent.includes("Coming soon"), pageLinks: document.querySelectorAll('a[href*="/projects/"]').length, nav: [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("href")).join(" ") }; })()`);
  check("/: TableRefresh's Open project is still disabled with Coming soon", !r.link && r.disabled === "true" && r.soon && r.pageLinks === 0, JSON.stringify(r));
  check("/: header navigation unchanged", r.nav === "/ #lab-stations #station-experience #lab-intro", r.nav);
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ; "));
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "tablerefresh-nav.txt", lines.join("\n") + "\n");
process.exit(0);
