// Copied from M1.4P (focused navigation checks); rerun here against the M1.4R.2 production build. SHOTS=<dir> keeps a reference screenshot.
// M1.4P focused navigation checks. node m14p-nav.mjs <base-url>
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";

const BASE = process.argv[2] ?? "http://localhost:3210";
const results = [];
const check = (name, ok, info = "") => {
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info ? `  — ${info}` : ""}`);
};

// Every element (and the window) with a non-zero scroll offset: the black-band defect's own signature.
const SCROLLED = `(() => {
  const out = [];
  if (scrollX || scrollY) out.push("window " + scrollX + "," + scrollY);
  for (const e of document.querySelectorAll("*")) if (e.scrollTop || e.scrollLeft) out.push((e.tagName + "." + e.className).slice(0, 60) + " " + e.scrollLeft + "," + e.scrollTop);
  return out;
})()`;
const STATE = `(() => {
  const w = document.querySelector("[data-lab-selected], [data-lab-hover], .contents[class]") ;
  const sel = document.querySelector("[data-lab-selected]")?.getAttribute("data-lab-selected") ?? null;
  const open = [...document.querySelectorAll("[data-station-panel][data-open]")].map((e) => e.dataset.stationPanel);
  return { url: location.pathname + location.search + location.hash, sel, open, hist: history.length, focus: document.activeElement?.id || document.activeElement?.tagName };
})()`;
const HEADER_EXP = `.lab-desktop-header nav[aria-label="Primary"] a[href*="experience"]`;

async function settle(page, ms = 1100) {
  await sleep(ms);
}

async function desktop(mode) {
  const q = mode === "lite" ? "?render=lite" : "";
  const page = await launch({ width: 1648, height: 928 });
  const errors = [];
  await page.send("Runtime.enable");
  page.on((m) => {
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text);
  });
  const tag = `[${mode}]`;
  try {
    await page.goto(`${BASE}/lab-v2${q}`);
    await settle(page);
    const href = await page.eval(`document.querySelector(${JSON.stringify(HEADER_EXP)})?.getAttribute("href")`);
    const want = mode === "lite" ? "/lab-v2?station=experience&render=lite" : "/lab-v2?station=experience";
    check(`${tag} header Experience href is the station deep link`, href === want, href);
    const s0 = await page.eval(STATE);
    check(`${tag} lab at rest on load`, s0.sel === null && s0.open.length === 0, JSON.stringify(s0));

    // 1. Click.
    const c = await page.center(HEADER_EXP);
    await page.click(c.x, c.y);
    await settle(page);
    let s = await page.eval(STATE);
    check(`${tag} click: Experience selected and its panel open`, s.sel === "experience" && s.open.join() === "experience", JSON.stringify(s));
    check(`${tag} click: URL ?station=experience, no fragment`, s.url === want, s.url);
    check(`${tag} click: one history entry`, s.hist === s0.hist + 1, `${s0.hist} -> ${s.hist}`);
    check(`${tag} click: focus on the panel heading`, s.focus === "station-experience-panel-title", s.focus);
    let sc = await page.eval(SCROLLED);
    check(`${tag} click: nothing scrolled`, sc.length === 0, sc.join("; "));
    if (mode === "full") {
      const cam = await page.eval(`getComputedStyle(document.querySelector(".lab-camera")).transform`);
      check(`${tag} click: camera moved to the Experience shot`, cam !== "none" && cam !== "matrix(1, 0, 0, 1, 0, 0)", cam);
    }
    if (process.env.SHOTS) await page.screenshot(`${process.env.SHOTS}/${mode}-experience-open.png`); // optional reference screenshot

    // 2. Clicking it again keeps it open, no new entry.
    await page.click(c.x, c.y);
    await settle(page, 500);
    const s2 = await page.eval(STATE);
    check(`${tag} second click: stays open, no new history entry`, s2.sel === "experience" && s2.hist === s.hist && s2.url === want, JSON.stringify(s2));

    // 3. Back / Forward.
    await page.eval("history.back()");
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Back: lab, panel closed, URL /lab-v2${q}`, s.sel === null && s.open.length === 0 && s.url === `/lab-v2${q}`, JSON.stringify(s));
    sc = await page.eval(SCROLLED);
    check(`${tag} Back: nothing scrolled`, sc.length === 0, sc.join("; "));
    await page.eval("history.forward()");
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Forward: Experience open again`, s.sel === "experience" && s.open.join() === "experience" && s.url === want, JSON.stringify(s));

    // 4. Back to Lab.
    const back = await page.eval(`(() => { const b = [...document.querySelectorAll("[data-station-panel='experience'] button")].find((x) => x.textContent.includes("Back to Lab")); const r = b.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
    await page.click(back.x, back.y);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Back to Lab: closed, URL /lab-v2${q}`, s.sel === null && s.open.length === 0 && s.url === `/lab-v2${q}`, JSON.stringify(s));
    check(`${tag} Back to Lab: focus returned to the Experience title`, s.focus === "station-experience-trigger", s.focus);
    sc = await page.eval(SCROLLED);
    check(`${tag} Back to Lab: nothing scrolled`, sc.length === 0, sc.join("; "));

    // 5. Another station, then Experience from the header, then Back.
    const eng = await page.center("#station-engineering-trigger");
    await page.click(eng.x, eng.y);
    await settle(page);
    s = await page.eval(STATE);
    const engUrl = mode === "lite" ? "/lab-v2?station=engineering&render=lite" : "/lab-v2?station=engineering";
    check(`${tag} Engineering title: Engineering open`, s.sel === "engineering" && s.url === engUrl, JSON.stringify(s));
    await page.click(c.x, c.y);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} header Experience from Engineering: switches to Experience`, s.sel === "experience" && s.open.join() === "experience" && s.url === want, JSON.stringify(s));
    await page.eval("history.back()");
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Back: Engineering again`, s.sel === "engineering" && s.url === engUrl, JSON.stringify(s));
    // and from Experience to another station
    await page.click(c.x, c.y);
    await settle(page);
    const edu = await page.center("#station-educational-trigger");
    await page.click(edu.x, edu.y);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Educational title from Experience: Educational open`, s.sel === "educational" && s.open.join() === "educational", JSON.stringify(s));
    await page.key("Escape", "Escape", 27);
    await settle(page);

    // 6. Keyboard: focus the link, Enter.
    await page.eval(`document.querySelector(${JSON.stringify(HEADER_EXP)}).focus()`);
    const h0 = (await page.eval(STATE)).hist;
    await page.key("Enter", "Enter", 13);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} keyboard Enter: Experience open, URL updated, focus on heading`, s.sel === "experience" && s.url === want && s.hist === h0 + 1 && s.focus === "station-experience-panel-title", JSON.stringify(s));
    sc = await page.eval(SCROLLED);
    check(`${tag} keyboard Enter: nothing scrolled`, sc.length === 0, sc.join("; "));
    await page.key("Escape", "Escape", 27);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} Escape: closed, URL /lab-v2${q}`, s.sel === null && s.url === `/lab-v2${q}`, JSON.stringify(s));

    // 7. Direct deep link.
    await page.goto(`${BASE}${want}`);
    await settle(page);
    s = await page.eval(STATE);
    check(`${tag} deep link ${want}: open on load`, s.sel === "experience" && s.open.join() === "experience" && s.url === want, JSON.stringify(s));
    sc = await page.eval(SCROLLED);
    check(`${tag} deep link: nothing scrolled`, sc.length === 0, sc.join("; "));
    const h1 = (await page.eval(STATE)).hist;
    const c2 = await page.center(HEADER_EXP);
    await page.click(c2.x, c2.y);
    await settle(page, 500);
    s = await page.eval(STATE);
    check(`${tag} deep link then header Experience: unchanged, no entry`, s.sel === "experience" && s.hist === h1, JSON.stringify(s));

    // 8. The old anchor, typed directly, still scrolls nothing (scroll fix intact).
    await page.goto(`${BASE}/lab-v2${q}#station-experience`);
    await settle(page);
    sc = await page.eval(SCROLLED);
    check(`${tag} direct #station-experience: nothing scrolled`, sc.length === 0, sc.join("; "));

    // 9. Other header links unchanged.
    const others = await page.eval(`[...document.querySelectorAll('.lab-desktop-header nav[aria-label="Primary"] a')].map((a) => a.textContent.trim() + "=" + a.getAttribute("href")).join(" ")`);
    check(`${tag} other header links unchanged`, others.includes("Lab=/ ") && others.includes("Projects=#lab-stations") && others.includes("About=#lab-intro"), others);

    check(`${tag} console: no errors or warnings`, errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await page.close();
  }
}

async function homepage() {
  const page = await launch({ width: 1648, height: 928 });
  try {
    await page.goto(`${BASE}/`);
    await settle(page);
    const info = await page.eval(`({ href: document.querySelector('nav[aria-label="Primary"] a[href*="experience"]')?.getAttribute("href"), attr: !!document.querySelector("[data-lab-header-stations]"), desk: !!document.querySelector(".lab-desktop-header") })`);
    check("[/] header Experience href still #station-experience", info.href === "#station-experience", info.href);
    check("[/] no /lab-v2 header wrapper or station-link marker", !info.attr && !info.desk, JSON.stringify(info));
    const s0 = await page.eval(STATE);
    const c = await page.center('nav[aria-label="Primary"] a[href="#station-experience"]');
    await page.click(c.x, c.y);
    await settle(page);
    const s = await page.eval(STATE);
    check("[/] Experience click: anchor followed as before (URL /#station-experience, nothing selected)", s.url === "/#station-experience" && s.sel === null && s.hist === s0.hist + 1, JSON.stringify(s));
    const sc = await page.eval(SCROLLED);
    check("[/] Experience click: nothing scrolled", sc.length === 0, sc.join("; "));
  } finally {
    await page.close();
  }
}

async function mobile() {
  const page = await launch({ width: 390, height: 844, touch: true });
  try {
    await page.goto(`${BASE}/lab-v2`);
    await settle(page);
    const menu = await page.center(".lab-compact-menu-button");
    await page.click(menu.x, menu.y);
    await settle(page, 300);
    const exp = await page.center('.lab-compact-menu a[href="#station-experience"]');
    await page.click(exp.x, exp.y);
    await settle(page);
    let s = await page.eval(STATE);
    const dock = await page.eval(`document.querySelector('[data-dock-station="experience"]').dataset.selected ?? null`);
    check("[390x844] compact menu Experience: opens Experience (dock handler)", s.sel === "experience" && s.url === "/lab-v2?station=experience" && dock === "true", JSON.stringify({ ...s, dock }));
    let sc = await page.eval(SCROLLED);
    check("[390x844] nothing scrolled", sc.length === 0, sc.join("; "));
    const b = await page.center('[data-dock-station="experience"]');
    await page.click(b.x, b.y);
    await settle(page);
    s = await page.eval(STATE);
    check("[390x844] dock Experience again: toggles closed", s.sel === null && s.url === "/lab-v2", JSON.stringify(s));
    await page.click(b.x, b.y);
    await settle(page);
    s = await page.eval(STATE);
    check("[390x844] dock Experience: opens", s.sel === "experience", JSON.stringify(s));
    await page.key("Escape", "Escape", 27);
    await settle(page);
    s = await page.eval(STATE);
    check("[390x844] Escape closes", s.sel === null, JSON.stringify(s));
  } finally {
    await page.close();
  }
  const land = await launch({ width: 844, height: 390 });
  try {
    await land.goto(`${BASE}/lab-v2`);
    await settle(land);
    const menu = await land.center(".lab-compact-menu-button");
    await land.click(menu.x, menu.y);
    await settle(land, 300);
    const exp = await land.center('.lab-compact-menu a[href="#station-experience"]');
    await land.click(exp.x, exp.y);
    await settle(land);
    const s = await land.eval(STATE);
    const sc = await land.eval(SCROLLED);
    check("[844x390] compact menu Experience: anchor as before, nothing scrolled", s.url === "/lab-v2#station-experience" && s.sel === null && sc.length === 0, JSON.stringify(s) + " " + sc.join("; "));
  } finally {
    await land.close();
  }
}

await desktop("full");
await desktop("lite");
await homepage();
await mobile();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} of ${results.length} pass`);
process.exit(failed ? 1 : 0);
