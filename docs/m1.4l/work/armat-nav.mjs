// M1.4L.5B: Armat project page, route, content and navigation check (default Chrome, 1648 x 928).
//   BASE=http://localhost:3000 node armat-nav.mjs   -> work/results/armat-nav.txt
// The lab -> page -> lab round trip (soft navigations: a window marker must survive), browser Back / Forward after an
// in-lab selection, AriMap <-> Armat through the related cards (with history), the view parameters (render, floor)
// carried both ways, the approved content (facts, sections, Overview, no screenshots, no unsupported claims, American
// spelling), the armat.site link, 404s, keyboard focus, reduced motion, and the homepage still saying "Coming soon".
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
const openLink = (id) => `document.querySelector('[data-open-row="${id}"] a[data-open-project="${id}"]')`;
const relatedLink = (text) => `[...document.querySelectorAll("main a")].find((a) => a.textContent.includes(${JSON.stringify(text)}))`;
const PAGE = "/lab-v2/projects/armat";
const visit = async (page, url) => { const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); }); await page.send("Page.navigate", { url }); await loaded; await page.eval("document.fonts.ready.then(() => true)"); };

const OVERVIEW_5 = "Armat is publicly accessible and continues to evolve. Content quality, editorial verification and search visibility remain areas for further improvement.";
const SECTIONS = "Overview | Multilingual content architecture | Content discovery and search | Engineering contributions | Technology stack | Editorial status | Links | Related project";
const FACTS = "Status: Public website · Ongoing development | Category: Education / Multilingual Publishing | Role: Creator & Full-stack Engineer | Languages: Eastern Armenian · Western Armenian · English";
const STACK = "Next.js | React | TypeScript | Tailwind CSS | Supabase | Leaflet | Playwright";

// 1. Deep link in the lab: Open project is a link to the page; AriMap's still links to its own; a project without a
//    page keeps "Coming soon" (Wallpapers since M1.4L.6B, when AZIZ got its page).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=armat`); await hideOverlay(page);
  await until(page, `!!${openLink("armat")}`);
  const href = await page.eval(`${openLink("armat")}?.getAttribute("href") ?? null`);
  check("lab-v2 deep link: Armat's Open project links to its page", href === PAGE, href);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "AriMap").click()`);
  await until(page, `!!${openLink("arimap")}`);
  check("lab-v2: AriMap's Open project still links to its page", (await page.eval(`${openLink("arimap")}.getAttribute("href")`)) === "/lab-v2/projects/arimap");
  await page.goto(`${BASE}/lab-v2?station=creative&project=wallpapers`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="wallpapers"]')`);
  const az = await page.eval(`(() => { const r = document.querySelector('[data-open-row="wallpapers"]'); return { link: !!r.querySelector("a"), disabled: r.querySelector("button")?.getAttribute("aria-disabled"), soon: r.textContent.includes("Coming soon") }; })()`);
  check("lab-v2: a project without a page (Wallpapers) keeps the disabled Coming soon action", !az.link && az.disabled === "true" && az.soon, JSON.stringify(az));
  await page.close();
}

// 2. Round trip by links, and the approved content on the page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=armat`); await hideOverlay(page);
  await until(page, `!!${openLink("armat")}`);
  await page.eval("window.__noReload = 1");
  await page.eval(`${openLink("armat")}.click()`);
  const arrived = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page]")`);
  const onPage = await page.eval(`({ marker: window.__noReload === 1, h1: document.querySelector("h1")?.textContent, scene: !!document.querySelector(".lab-camera, [data-station-panel]"), scroll: getComputedStyle(document.body).overflowY, title: document.title, robots: document.querySelector('meta[name="robots"]')?.content })`);
  check("Open project opens the Armat page with a client-side navigation", arrived && onPage.marker && onPage.h1 === "Armat", JSON.stringify(onPage));
  check("the project page does not keep the lab scene mounted, and scrolls", !onPage.scene && onPage.scroll === "auto");
  check("title and noindex like the other project pages", onPage.title === "Armat — Lab v2 (experimental)" && /noindex/.test(onPage.robots ?? ""), `${onPage.title} | ${onPage.robots}`);

  const c = await page.eval(`(() => {
    const main = document.querySelector("main");
    return {
      tagline: document.querySelector("h1").nextElementSibling.textContent,
      eyebrow: document.querySelector("article header p").textContent.replace(/\\s+/g, ""),
      sections: [...document.querySelectorAll("section h2")].map((h) => h.textContent),
      facts: [...document.querySelectorAll("header dl > div")].map((d) => d.querySelector("dt").textContent + ": " + d.querySelector("dd").textContent),
      overview: [...document.querySelectorAll("#project-overview ~ div p, section[aria-labelledby='project-overview'] p:not([aria-hidden])")].map((p) => p.textContent).filter((t, i, s) => s.indexOf(t) === i),
      stack: [...document.querySelectorAll("section[aria-labelledby='project-stack'] li")].map((l) => l.textContent),
      contributions: document.querySelectorAll("section[aria-labelledby='project-contributions'] li").length,
      terms: [...document.querySelectorAll("section li > span.font-\\\\[460\\\\]")].map((s) => s.textContent),
      imgs: main.querySelectorAll("img").length, viewer: main.querySelectorAll("[data-viewer-index]").length,
      text: main.innerText,
    };
  })()`);
  check("hero: tagline is the approved line", c.tagline === "Explore Armenian culture, history and literature in three languages.", c.tagline);
  check("hero eyebrow: Educational station", c.eyebrow === "Educational·Project", c.eyebrow);
  check("hero facts: status, category, role, languages", c.facts.join(" | ") === FACTS, c.facts.join(" | "));
  check("sections in the approved order", c.sections.join(" | ") === SECTIONS, c.sections.join(" | "));
  check("Overview: five paragraphs, the fifth as approved", c.overview.length === 5 && c.overview[4] === OVERVIEW_5, `${c.overview.length}: ${c.overview[4]}`);
  check("Overview paragraphs 1-4 as proposed in the audit", c.overview[0]?.startsWith("Armenian history, literature and culture are spread across many sources") && c.overview[3]?.endsWith("designed to help search engines understand its content."), c.overview.map((p) => p.slice(0, 40)).join(" / "));
  check("eight engineering contributions", c.contributions === 8, String(c.contributions));
  check("technology stack: only technologies verified in the source", c.stack.join(" | ") === STACK, c.stack.join(" | "));
  check("section items: multilingual, discovery and editorial terms", ["Routing", "Typed content", "Shared slugs", "Bibliography", "No silent fallback", "Site search", "Listing filters", "Related reading", "Western Armenian", "Illustrations"].every((t) => c.terms.includes(t)), c.terms.join(", "));
  check("editorial status states the Western Armenian limitation", c.text.includes("It has not yet received comprehensive review by a native Western Armenian editor.") && c.text.includes("not every published article has received professional editorial review"));
  check("no screenshots: no images, no viewer, no Screenshots section", c.imgs === 0 && c.viewer === 0 && !c.sections.includes("Screenshots"), `${c.imgs} img, ${c.viewer} viewer`);
  const claims = c.text.match(/\\b(indexed|indexing|ranking|ranks|traffic|visitors per|impressions|\\d+ (tests|passed)|WCAG|Vercel|native-reviewed)\\b/gi);
  check("no indexing, ranking, traffic, test-count or unverified-hosting claims", !claims, (claims ?? []).join(", ") || "none");
  const british = c.text.match(/\\b\\w*(colour|organis|behaviour|labelled|catalogue|favour|centre|licence)\\w*\\b/gi);
  check("American spelling throughout the page", !british, (british ?? []).join(", ") || "none");

  const ext = await page.eval(`(() => { const a = ${relatedLink("armat.site")}; return a && { href: a.getAttribute("href"), target: a.target, rel: a.rel, sr: a.querySelector(".sr-only")?.textContent }; })()`);
  check("armat.site link: the public website, in a new tab, announced as such", ext?.href === "https://armat.site" && ext.target === "_blank" && ext.rel === "noopener noreferrer" && ext.sr === " (opens in a new tab)", JSON.stringify(ext));
  check("no repository link", await page.eval(`![...document.querySelectorAll("a")].some((a) => /github|armedu/i.test(a.href))`));
  const related = await page.eval(`${relatedLink("Open AriMap")}?.getAttribute("href") ?? null`);
  check("Related project: Open AriMap links to its page", related === "/lab-v2/projects/arimap", related);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  check("Back to the lab returns to the station and project", back === "/lab-v2?station=educational&project=armat", back);
  await page.eval(`document.querySelector("main a[href^='/lab-v2?']").click()`);
  const home = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="educational"][data-open]')`);
  const st = await page.eval(`({ url: location.pathname + location.search, marker: window.__noReload === 1, pressed: [...${PANEL}.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent), scroll: getComputedStyle(document.body).overflowY })`);
  check("back in the lab: Educational open, Armat selected, no reload", home && st.marker && st.pressed.join() === "Armat" && st.url === "/lab-v2?station=educational&project=armat", JSON.stringify(st));
  check("the lab is one fixed screen again", st.scroll === "hidden", st.scroll);
  await page.close();
}

// 3. Browser Back / Forward after selecting in the lab (the lab writes station and project with pushState).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2`); await hideOverlay(page);
  await page.eval(`document.getElementById("station-educational-trigger").click()`);
  await until(page, `!!document.querySelector('[data-station-panel="educational"][data-open]')`);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "Armat").click()`);
  await until(page, `!!${openLink("armat")}`);
  const before = await path(page);
  await page.eval(`${openLink("armat")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  await page.eval("history.back()");
  const ok = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="educational"][data-open]')`);
  await sleep(800);
  const st = await page.eval(`({ url: location.pathname + location.search, pressed: [...(${PANEL}?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent) })`);
  check("browser Back from the page restores the selected station and project", ok && st.url === before && st.pressed.join() === "Armat", `before ${before}; ${JSON.stringify(st)}`);
  await page.eval("history.forward()");
  const fwd = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page] h1")`);
  check("browser Forward returns to the project page", fwd, await path(page));
  await page.eval("history.back()");
  await until(page, `location.pathname === "/lab-v2"`); await sleep(600);
  await page.eval("history.back()");
  const lab = await until(page, `location.pathname + location.search === "/lab-v2?station=educational"`);
  check("further Back walks the lab's own history (station only)", lab, await path(page));
  await page.close();
}

// 4. AriMap <-> Armat through the related cards, with browser history.
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}/lab-v2/projects/arimap`); await hideOverlay(page);
  await page.eval("window.__noReload = 1");
  const card = await page.eval(`(() => { const a = ${relatedLink("Open Armat")}; return a && { href: a.getAttribute("href"), summary: a.closest("li").querySelectorAll("p")[1]?.textContent }; })()`);
  check("AriMap's related card now says Open Armat and links to the page", card?.href === PAGE && card.summary === "A multilingual platform for discovering Armenian history, literature, culture, and places.", JSON.stringify(card));
  check("AriMap no longer offers View Armat in the lab", await page.eval(`!${relatedLink("View Armat")}`));
  await page.eval(`${relatedLink("Open Armat")}.click()`);
  const a1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "Armat"`);
  check("AriMap -> Armat: client-side navigation", a1 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.eval(`${relatedLink("Open AriMap")}.click()`);
  const a2 = await until(page, `location.pathname === "/lab-v2/projects/arimap" && document.querySelector("h1")?.textContent === "AriMap"`);
  check("Armat -> AriMap: client-side navigation", a2 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.eval("history.back()");
  const b1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "Armat"`);
  await page.eval("history.back()");
  const b2 = await until(page, `location.pathname === "/lab-v2/projects/arimap" && document.querySelector("h1")?.textContent === "AriMap"`);
  await page.eval("history.forward()");
  const f1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "Armat"`);
  check("Back, Back, Forward walk AriMap and Armat correctly, without a reload", b1 && b2 && f1 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.close();
}

// 5. View parameters travel both ways (lab links and the related card).
for (const view of ["render=lite", "render=lite&floor=original", "floor=approved"]) {
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=educational&project=armat&${view}`); await hideOverlay(page);
  await until(page, `!!${openLink("armat")}`);
  const href = await page.eval(`${openLink("armat")}.getAttribute("href")`);
  await page.eval(`${openLink("armat")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  const lab = await page.eval(`document.querySelector("nav a")?.getAttribute("href") ?? null`);
  const rel = await page.eval(`${relatedLink("Open AriMap")}.getAttribute("href")`);
  check(`${view}: kept to the page, back to the lab and to AriMap`, href === `${PAGE}?${view}` && back === `/lab-v2?station=educational&project=armat&${view}` && lab === `/lab-v2?${view}` && rel === `/lab-v2/projects/arimap?${view}`, `${href} | ${back} | ${lab} | ${rel}`);
  await page.close();
}

// 6. Unknown or unapproved slugs are 404s; view parameters are validated.
for (const [p, want] of [[PAGE, 200], ["/lab-v2/projects/arimap", 200], ["/lab-v2/projects/sqlorbit", 200], ["/lab-v2/projects/tablerefresh", 200], ["/lab-v2/projects/aziz", 200], ["/lab-v2/projects/wallpapers", 404], ["/lab-v2/projects/koreez", 404], ["/lab-v2/projects/nope", 404], ["/projects/armat", 404]]) {
  const r = await fetch(BASE + p);
  check(`${p} -> ${want}`, r.status === want, String(r.status));
}
{
  const html = await (await fetch(`${BASE}${PAGE}?render=heavy&floor=x&station=creative`)).text();
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/lab-v2"));
  check("unknown view values are dropped from every lab link", hrefs.includes("/lab-v2?station=educational&amp;project=armat") && hrefs.every((h) => !/render=|floor=|creative/.test(h)), hrefs.join(" "));
}

// 7. Keyboard: Tab reaches the skip link, Back to the lab, armat.site and AriMap, each with a visible ring.
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  const seen = [];
  for (let i = 0; i < 16; i++) {
    await page.key("Tab", "Tab", 9);
    seen.push(await page.eval(`(() => { const e = document.activeElement; if (e === document.body) return { t: "(body)", ring: true }; const cs = getComputedStyle(e); return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 34), ring: e.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; })()`));
  }
  const names = seen.map((s) => s.t);
  const want = ["Skip to content", "Back to the lab", "armat.site (opens in a new tab)", "Open AriMap"];
  check("Tab order reaches skip link, Back to the lab, armat.site and the related project", want.every((w) => names.some((n) => n.startsWith(w))), names.join(" | "));
  check("every focused control shows the focus ring", seen.every((s) => s.ring), seen.filter((s) => !s.ring).map((s) => s.t).join(", ") || "all");
  await page.close();
}

// 8. Reduced motion: nothing animates; the color transitions are off.
{
  const page = await launch({ reducedMotion: true }); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  const r = await page.eval(`({ anims: document.getAnimations().length, tr: getComputedStyle(document.querySelector("main a")).transitionDuration })`);
  check("reduced motion: no animations, no transitions on links", r.anims === 0 && r.tr === "0s", JSON.stringify(r));
  await page.close();
}

// 9. The homepage is unchanged: Armat still says Coming soon and nothing links to a project page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/?station=educational&project=armat`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="armat"]')`);
  const r = await page.eval(`(() => { const row = document.querySelector('[data-open-row="armat"]'); return { link: !!row.querySelector("a"), disabled: row.querySelector("button")?.getAttribute("aria-disabled"), soon: row.textContent.includes("Coming soon"), pageLinks: document.querySelectorAll('a[href*="/projects/"]').length, nav: [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("href")).join(" ") }; })()`);
  check("/: Armat's Open project is still disabled with Coming soon", !r.link && r.disabled === "true" && r.soon && r.pageLinks === 0, JSON.stringify(r));
  check("/: header navigation unchanged", r.nav === "/ #lab-stations #station-experience #lab-intro", r.nav);
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ; "));
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "armat-nav.txt", lines.join("\n") + "\n");
process.exit(fail ? 1 : 0);
