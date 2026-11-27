// M1.4L.6B: AZIZ project page, route, content and navigation check (default Chrome, 1648 x 928).
//   BASE=http://localhost:3000 node aziz-nav.mjs   -> work/results/aziz-nav.txt
// The lab -> page -> lab round trip (soft navigations: a window marker must survive), browser Back / Forward after an
// in-lab selection, AZIZ -> AriMap through the related card (with history), the view parameters (render, floor) carried
// both ways, the approved content (facts, sections, Overview, game modes, no screenshots, no metrics or unconfirmed Play
// claims, American spelling), the Google Play link, 404s, keyboard focus, reduced motion, and the homepage still saying
// "Coming soon".
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
const PANEL = `document.querySelector('[data-station-panel="playground"]')`;
const openLink = (id) => `document.querySelector('[data-open-row="${id}"] a[data-open-project="${id}"]')`;
const relatedLink = (text) => `[...document.querySelectorAll("main a")].find((a) => a.textContent.includes(${JSON.stringify(text)}))`;
const PAGE = "/lab-v2/projects/aziz";
const PLAY = "https://play.google.com/store/apps/details?id=am.aziz.party";
const visit = async (page, url) => { const loaded = new Promise((r) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); r(); } }); }); await page.send("Page.navigate", { url }); await loaded; await page.eval("document.fonts.ready.then(() => true)"); };

const OVERVIEW = [
  "The best party games don't need complicated setups. They need simple rules, quick decisions and moments that get everyone involved.",
  "I created AZIZ as a collection of three party games that friends can play together using a single phone. Players take turns giving deliberately wrong answers, trying to think alike, or acting out words for their teammates.",
  "Each game has its own rules, timing and scoring system. The experience is designed for face-to-face play, with large controls, short rounds and content available in Armenian and English.",
  "From an engineering perspective, AZIZ combines independent TypeScript game engines, bilingual game decks, timed interactions and a fully offline mobile experience.",
  "AZIZ is available on Google Play for Android, with no account or internet connection required.",
];
const SECTIONS = "Overview | Game modes | Engineering contributions | Technology stack | Testing and release | Links | Related project";
const FACTS = "Status: Available on Google Play | Release: Version 1.0.0 on Google Play | Category: Mobile Game / Party Game | Role: Creator & Mobile Engineer | Platforms: Android | Languages: Armenian · English";
const STACK = "Expo | React Native | TypeScript | Expo Router | React Native Reanimated | AsyncStorage | EAS Build";
const TERMS = ["Wrong Answer Only", "Same Answer", "Act It!", "Game rules", "Content", "Release"];

// 1. Deep link in the lab: AZIZ's Open project is a link to the page; the other pages keep theirs; Wallpapers keeps "Coming soon".
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=playground&project=aziz`); await hideOverlay(page);
  await until(page, `!!${openLink("aziz")}`);
  const href = await page.eval(`${openLink("aziz")}?.getAttribute("href") ?? null`);
  check("lab-v2 deep link: AZIZ's Open project links to its page", href === PAGE, href);
  await page.goto(`${BASE}/lab-v2?station=educational&project=arimap`); await hideOverlay(page);
  await until(page, `!!${openLink("arimap")}`);
  check("lab-v2: AriMap's Open project still links to its page", (await page.eval(`${openLink("arimap")}.getAttribute("href")`)) === "/lab-v2/projects/arimap");
  await page.goto(`${BASE}/lab-v2?station=creative&project=wallpapers`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="wallpapers"]')`);
  const wp = await page.eval(`(() => { const r = document.querySelector('[data-open-row="wallpapers"]'); return { link: !!r.querySelector("a"), disabled: r.querySelector("button")?.getAttribute("aria-disabled"), soon: r.textContent.includes("Coming soon") }; })()`);
  check("lab-v2: a project without a page (Wallpapers) keeps the disabled Coming soon action", !wp.link && wp.disabled === "true" && wp.soon, JSON.stringify(wp));
  await page.close();
}

// 2. Round trip by links, and the approved content on the page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=playground&project=aziz`); await hideOverlay(page);
  await until(page, `!!${openLink("aziz")}`);
  await page.eval("window.__noReload = 1");
  await page.eval(`${openLink("aziz")}.click()`);
  const arrived = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page]")`);
  const onPage = await page.eval(`({ marker: window.__noReload === 1, h1: document.querySelector("h1")?.textContent, scene: !!document.querySelector(".lab-camera, [data-station-panel]"), scroll: getComputedStyle(document.body).overflowY, title: document.title, robots: document.querySelector('meta[name="robots"]')?.content })`);
  check("Open project opens the AZIZ page with a client-side navigation", arrived && onPage.marker && onPage.h1 === "AZIZ", JSON.stringify(onPage));
  check("the project page does not keep the lab scene mounted, and scrolls", !onPage.scene && onPage.scroll === "auto");
  check("title and noindex like the other project pages", onPage.title === "AZIZ — Lab v2 (experimental)" && /noindex/.test(onPage.robots ?? ""), `${onPage.title} | ${onPage.robots}`);

  const c = await page.eval(`(() => {
    const main = document.querySelector("main");
    const sec = (id) => document.querySelector("section[aria-labelledby='project-" + id + "']");
    return {
      tagline: document.querySelector("h1").nextElementSibling.textContent,
      eyebrow: document.querySelector("article header p").textContent.replace(/\\s+/g, ""),
      dot: document.querySelector("article header p span").className,
      sections: [...document.querySelectorAll("section h2")].map((h) => h.textContent),
      facts: [...document.querySelectorAll("header dl > div")].map((d) => d.querySelector("dt").textContent + ": " + d.querySelector("dd").textContent),
      overview: [...sec("overview").querySelectorAll("p:not([aria-hidden])")].map((p) => p.textContent),
      stack: [...sec("stack").querySelectorAll("li")].map((l) => l.textContent),
      contributions: sec("contributions").querySelectorAll("li").length,
      terms: [...document.querySelectorAll("section li > span.font-\\\\[460\\\\]")].map((s) => s.textContent),
      modes: sec("modes").innerText,
      imgs: main.querySelectorAll("img, picture, video, svg image").length, viewer: main.querySelectorAll("[data-viewer-index]").length,
      text: main.innerText,
    };
  })()`);
  check("hero: tagline is the approved line", c.tagline === "Three party games. One phone. A lot of unexpected answers.", c.tagline);
  check("hero eyebrow: Playground station with its violet dot", c.eyebrow === "Playground·Project" && /violet/.test(c.dot), `${c.eyebrow} | ${c.dot.slice(0, 40)}`);
  check("hero facts: status, release, category, role, platforms, languages", c.facts.join(" | ") === FACTS, c.facts.join(" | "));
  check("sections in the approved order", c.sections.join(" | ") === SECTIONS, c.sections.join(" | "));
  check("Overview: the five approved paragraphs, exactly", c.overview.length === 5 && c.overview.every((p, i) => p === OVERVIEW[i]), c.overview.map((p, i) => (p === OVERVIEW[i] ? "ok" : "DIFF")).join(","));
  check("seven engineering contributions", c.contributions === 7, String(c.contributions));
  check("technology stack: only technologies verified in the source", c.stack.join(" | ") === STACK, c.stack.join(" | "));
  check("section items: three game modes, then game rules, content and release", TERMS.every((t) => c.terms.includes(t)), c.terms.join(", "));
  check("game modes: wrong answers, group judging and sudden death", /wrong on purpose/.test(c.modes) && /Pass or Fail/.test(c.modes) && /sudden-death/.test(c.modes) && /3, 3\.5 or 4 second/.test(c.modes), "");
  check("game modes: matching answers scored by the largest group", /largest group that matched/.test(c.modes) && /one point less than its size/.test(c.modes));
  check("game modes: charades with 45-second turns and two skips", /without speaking/.test(c.modes) && /45 seconds/.test(c.modes) && /up to two cards can be skipped/.test(c.modes));
  check("release: publicly available, no account or internet connection required", c.text.includes("Version 1.0.0 is publicly available on Google Play for Android. Gameplay requires neither an account nor an internet connection."));
  check("no screenshots or illustrations: no images, no viewer, no Screenshots section", c.imgs === 0 && c.viewer === 0 && !c.sections.includes("Screenshots"), `${c.imgs} img, ${c.viewer} viewer`);
  const claims = c.text.match(/\b(downloads?|installs?|ratings?|rated|reviews?|stars?|users|players worldwide|playtest\w*|production track|versionCode|countries|worldwide|online multiplayer|multiplayer online|collects? no data|no data collected|data safety|iOS|iPhone|GitHub)\b/gi);
  check("no metrics, playtest, unconfirmed Play details, data-collection or online-play claims", !claims, (claims ?? []).join(", ") || "none");
  const british = c.text.match(/\b\w*(colour|organis|behaviour|labelled|catalogue|favour|centre|licence|judgement|programme)\w*\b/gi);
  check("American spelling throughout the page", !british, (british ?? []).join(", ") || "none");

  const ext = await page.eval(`(() => { const a = ${relatedLink("AZIZ on Google Play")}; return a && { href: a.getAttribute("href"), target: a.target, rel: a.rel, sr: a.querySelector(".sr-only")?.textContent }; })()`);
  check("Google Play link: the verified listing, in a new tab, announced as such", ext?.href === PLAY && ext.target === "_blank" && ext.rel === "noopener noreferrer" && ext.sr === " (opens in a new tab)", JSON.stringify(ext));
  check("no repository link", await page.eval(`![...document.querySelectorAll("a")].some((a) => /github/i.test(a.href))`));
  const related = await page.eval(`${relatedLink("Open AriMap")}?.getAttribute("href") ?? null`);
  check("Related project: Open AriMap links to its page", related === "/lab-v2/projects/arimap", related);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  check("Back to the lab returns to the station and project", back === "/lab-v2?station=playground&project=aziz", back);
  await page.eval(`document.querySelector("main a[href^='/lab-v2?']").click()`);
  const home = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="playground"][data-open]')`);
  const st = await page.eval(`({ url: location.pathname + location.search, marker: window.__noReload === 1, pressed: [...${PANEL}.querySelectorAll('button[aria-pressed="true"]')].map((b) => b.textContent), scroll: getComputedStyle(document.body).overflowY })`);
  check("back in the lab: Playground open, AZIZ selected, no reload", home && st.marker && st.pressed.join() === "AZIZ" && st.url === "/lab-v2?station=playground&project=aziz", JSON.stringify(st));
  check("the lab is one fixed screen again", st.scroll === "hidden", st.scroll);
  await page.close();
}

// 3. Browser Back / Forward after selecting in the lab (the lab writes station and project with pushState).
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2`); await hideOverlay(page);
  await page.eval(`document.getElementById("station-playground-trigger").click()`);
  await until(page, `!!document.querySelector('[data-station-panel="playground"][data-open]')`);
  await page.eval(`[...${PANEL}.querySelectorAll("button[aria-pressed]")].find((b) => b.textContent === "AZIZ").click()`);
  await until(page, `!!${openLink("aziz")}`);
  const before = await path(page);
  await page.eval(`${openLink("aziz")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  await page.eval("history.back()");
  const ok = await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-station-panel="playground"][data-open]')`);
  await sleep(800);
  const st = await page.eval(`({ url: location.pathname + location.search, pressed: [...(${PANEL}?.querySelectorAll('button[aria-pressed="true"]') ?? [])].map((b) => b.textContent) })`);
  check("browser Back from the page restores the selected station and project", ok && st.url === before && st.pressed.join() === "AZIZ", `before ${before}; ${JSON.stringify(st)}`);
  await page.eval("history.forward()");
  const fwd = await until(page, `location.pathname === "${PAGE}" && !!document.querySelector("[data-project-page] h1")`);
  check("browser Forward returns to the project page", fwd, await path(page));
  await page.eval("history.back()");
  await until(page, `location.pathname === "/lab-v2"`); await sleep(600);
  await page.eval("history.back()");
  const lab = await until(page, `location.pathname + location.search === "/lab-v2?station=playground"`);
  check("further Back walks the lab's own history (station only)", lab, await path(page));
  await page.close();
}

// 4. AZIZ -> AriMap through the related card, with browser history; AriMap's page is unchanged (it relates to Armat).
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  await page.eval("window.__noReload = 1");
  const card = await page.eval(`(() => { const a = ${relatedLink("Open AriMap")}; return a && { href: a.getAttribute("href"), summary: a.closest("li").querySelectorAll("p")[1]?.textContent }; })()`);
  check("AZIZ's related card: Open AriMap with AriMap's lab summary", card?.href === "/lab-v2/projects/arimap" && /geography-learning game/.test(card.summary ?? ""), JSON.stringify(card));
  await page.eval(`${relatedLink("Open AriMap")}.click()`);
  const a1 = await until(page, `location.pathname === "/lab-v2/projects/arimap" && document.querySelector("h1")?.textContent === "AriMap"`);
  check("AZIZ -> AriMap: client-side navigation", a1 && (await page.eval("window.__noReload === 1")), await path(page));
  const am = await page.eval(`({ armat: !!${relatedLink("Open Armat")}, aziz: [...document.querySelectorAll("a")].some((a) => /aziz/i.test(a.getAttribute("href") ?? "")) })`);
  check("AriMap's page is unchanged: still relates to Armat, no link to AZIZ", am.armat && !am.aziz, JSON.stringify(am));
  await page.eval("history.back()");
  const b1 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "AZIZ"`);
  await page.eval("history.forward()");
  const f1 = await until(page, `location.pathname === "/lab-v2/projects/arimap" && document.querySelector("h1")?.textContent === "AriMap"`);
  await page.eval("history.back()");
  const b2 = await until(page, `location.pathname === "${PAGE}" && document.querySelector("h1")?.textContent === "AZIZ"`);
  check("Back, Forward, Back walk AZIZ and AriMap correctly, without a reload", b1 && f1 && b2 && (await page.eval("window.__noReload === 1")), await path(page));
  await page.close();
}

// 5. View parameters travel both ways (lab links and the related card).
for (const view of ["render=lite", "render=lite&floor=original", "floor=approved"]) {
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/lab-v2?station=playground&project=aziz&${view}`); await hideOverlay(page);
  await until(page, `!!${openLink("aziz")}`);
  const href = await page.eval(`${openLink("aziz")}.getAttribute("href")`);
  await page.eval(`${openLink("aziz")}.click()`);
  await until(page, `!!document.querySelector("[data-project-page]")`);
  const back = await page.eval(`document.querySelector("main a[href^='/lab-v2?']").getAttribute("href")`);
  const lab = await page.eval(`document.querySelector("nav a")?.getAttribute("href") ?? null`);
  const rel = await page.eval(`${relatedLink("Open AriMap")}.getAttribute("href")`);
  check(`${view}: kept to the page, back to the lab and to AriMap`, href === `${PAGE}?${view}` && back === `/lab-v2?station=playground&project=aziz&${view}` && lab === `/lab-v2?${view}` && rel === `/lab-v2/projects/arimap?${view}`, `${href} | ${back} | ${lab} | ${rel}`);
  await page.close();
}

// 6. Unknown or unapproved slugs are 404s; view parameters are validated.
for (const [p, want] of [[PAGE, 200], ["/lab-v2/projects/arimap", 200], ["/lab-v2/projects/armat", 200], ["/lab-v2/projects/sqlorbit", 200], ["/lab-v2/projects/tablerefresh", 200], ["/lab-v2/projects/wallpapers", 404], ["/lab-v2/projects/koreez", 404], ["/lab-v2/projects/nope", 404], ["/projects/aziz", 404]]) {
  const r = await fetch(BASE + p);
  check(`${p} -> ${want}`, r.status === want, String(r.status));
}
{
  const html = await (await fetch(`${BASE}${PAGE}?render=heavy&floor=x&station=creative`)).text();
  const hrefs = [...html.matchAll(/<a [^>]*href="([^"]*)"/g)].map((m) => m[1]).filter((h) => h.startsWith("/lab-v2"));
  check("unknown view values are dropped from every lab link", hrefs.includes("/lab-v2?station=playground&amp;project=aziz") && hrefs.every((h) => !/render=|floor=|creative/.test(h)), hrefs.join(" "));
}

// 7. Keyboard: Tab reaches the skip link, Back to the lab, Google Play and AriMap, each with a visible ring.
{
  const page = await launch(); watch(page);
  await visit(page, `${BASE}${PAGE}`); await hideOverlay(page);
  const seen = [];
  for (let i = 0; i < 16; i++) {
    await page.key("Tab", "Tab", 9);
    seen.push(await page.eval(`(() => { const e = document.activeElement; if (e === document.body) return { t: "(body)", ring: true }; const cs = getComputedStyle(e); return { t: (e.textContent || e.getAttribute("aria-label") || "").trim().replace(/\\s+/g, " ").slice(0, 44), ring: e.matches(":focus-visible") && cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 }; })()`));
  }
  const names = seen.map((s) => s.t);
  const want = ["Skip to content", "Back to the lab", "AZIZ on Google Play (opens in a new tab)", "Open AriMap"];
  check("Tab order reaches skip link, Back to the lab, Google Play and the related project", want.every((w) => names.some((n) => n.startsWith(w))), names.join(" | "));
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

// 9. The homepage is unchanged: AZIZ still says Coming soon and nothing links to a project page.
{
  const page = await launch(); watch(page);
  await page.goto(`${BASE}/?station=playground&project=aziz`); await hideOverlay(page);
  await until(page, `!!document.querySelector('[data-open-row="aziz"]')`);
  const r = await page.eval(`(() => { const row = document.querySelector('[data-open-row="aziz"]'); return { link: !!row.querySelector("a"), disabled: row.querySelector("button")?.getAttribute("aria-disabled"), soon: row.textContent.includes("Coming soon"), pageLinks: document.querySelectorAll('a[href*="/projects/"]').length, nav: [...document.querySelectorAll("nav a")].map((a) => a.getAttribute("href")).join(" ") }; })()`);
  check("/: AZIZ's Open project is still disabled with Coming soon", !r.link && r.disabled === "true" && r.soon && r.pageLinks === 0, JSON.stringify(r));
  check("/: header navigation unchanged", r.nav === "/ #lab-stations #station-experience #lab-intro", r.nav);
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 3).join(" ; "));
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "aziz-nav.txt", lines.join("\n") + "\n");
process.exit(fail ? 1 : 0);
