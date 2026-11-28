// Copied from M1.4P (project pages to the lab, Ctrl+click, console); rerun here against the M1.4R.2 production build.
// M1.4P: project page -> Experience, and Ctrl+click on the lab header. node m14p-projects.mjs <base>
import { launch, sleep } from "../../../../scripts/visual/cdp.mjs";
const BASE = process.argv[2] ?? "http://localhost:3100";
const SLUGS = (process.argv[3] ?? "sqlorbit,arimap,tablerefresh,armat,aziz").split(",");
const results = [];
const check = (name, ok, info = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${info && !ok ? `  — ${info}` : ""}`);
};
const SCROLLED = `(() => { const o = []; if (scrollX || scrollY) o.push("window " + scrollX + "," + scrollY); for (const e of document.querySelectorAll("*")) if (e.scrollTop || e.scrollLeft) o.push((e.tagName + "." + e.className).slice(0, 50) + " " + e.scrollTop); return o; })()`;
const STATE = `({ url: location.pathname + location.search + location.hash, sel: document.querySelector("[data-lab-selected]")?.getAttribute("data-lab-selected") ?? null, open: [...document.querySelectorAll("[data-station-panel][data-open]")].map((e) => e.dataset.stationPanel), camera: !!document.querySelector(".lab-camera"), project: document.querySelector("[data-project-page]")?.dataset.projectPage ?? null, active: document.querySelector('.lab-desktop-header [aria-current="page"]')?.textContent.trim() ?? null })`;
const until = async (page, expr, ms = 15000) => {
  for (let t = 0; t < ms; t += 150) {
    if (await page.eval(expr).catch(() => false)) return true;
    await sleep(150);
  }
  return false;
};

function watchConsole(page) {
  const errors = [];
  page.send("Runtime.enable");
  page.on((m) => {
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description?.slice(0, 160) ?? m.params.exceptionDetails.text);
  });
  return errors;
}

for (const mode of ["full", "lite"]) {
  const q = mode === "lite" ? "?render=lite" : "";
  const want = `/lab-v2?station=experience${mode === "lite" ? "&render=lite" : ""}`;
  const page = await launch({ width: 1648, height: 928 });
  const errors = watchConsole(page);
  try {
    for (const slug of SLUGS) {
      const tag = `[${mode}] ${slug}:`;
      // Project pages lazy-load their screenshots below the fold, which never load headless without scrolling: wait for load, not for every image.
      await page.send("Page.enable");
      await page.send("Page.navigate", { url: `${BASE}/lab-v2/projects/${slug}${q}` });
      await until(page, `document.readyState === "complete" && !!document.querySelector("[data-project-page]")`);
      await sleep(600);
      const href = await page.eval(`[...document.querySelectorAll('nav[aria-label="Primary"] a')].find((a) => a.textContent.trim() === "Experience")?.getAttribute("href")`);
      check(`${tag} header Experience href is ${want}`, href === want, href);
      const c = await page.eval(`(() => { const a = [...document.querySelectorAll('nav[aria-label="Primary"] a')].find((a) => a.textContent.trim() === "Experience"); const r = a.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
      await page.click(c.x, c.y);
      const arrived = await until(page, `location.pathname === "/lab-v2" && document.querySelector("[data-lab-selected]")?.getAttribute("data-lab-selected") === "experience"`);
      await sleep(1100);
      let s = await page.eval(STATE);
      check(`${tag} lands on the lab with Experience open`, arrived && s.sel === "experience" && s.open.join() === "experience" && s.url === want, JSON.stringify(s));
      check(`${tag} render mode kept (${mode === "lite" ? "Static Lite, no camera" : "Cinematic, camera"})`, s.camera === (mode === "full"), JSON.stringify(s));
      check(`${tag} Lab is the active header entry`, s.active === "Lab", s.active);
      let sc = await page.eval(SCROLLED);
      check(`${tag} nothing scrolled`, sc.length === 0, sc.join("; "));
      await page.eval("history.back()");
      const back = await until(page, `document.querySelector("[data-project-page]") !== null`);
      s = await page.eval(STATE);
      check(`${tag} Back: the project page again`, back && s.url === `/lab-v2/projects/${slug}${q}`, JSON.stringify(s));
      await page.eval("history.forward()");
      const fwd = await until(page, `location.pathname === "/lab-v2" && document.querySelector("[data-lab-selected]")?.getAttribute("data-lab-selected") === "experience"`);
      await sleep(600);
      s = await page.eval(STATE);
      check(`${tag} Forward: the lab with Experience open`, fwd && s.url === want && s.open.join() === "experience", JSON.stringify(s));
      sc = await page.eval(SCROLLED);
      check(`${tag} Forward: nothing scrolled`, sc.length === 0, sc.join("; "));
    }
    // Ctrl+click on the lab's own header: a new tab with the deep link; this page is left as it was.
    await page.goto(`${BASE}/lab-v2${q}`);
    await sleep(800);
    await page.send("Target.setDiscoverTargets", { discover: true }).catch(() => {});
    const created = [];
    const off = page.on((m) => {
      if (m.method === "Target.targetCreated" && m.params.targetInfo.type === "page") created.push(m.params.targetInfo);
      if (m.method === "Target.targetInfoChanged" && m.params.targetInfo.type === "page") created.push(m.params.targetInfo);
    });
    const before = await page.eval(`({ ...${STATE}, hist: history.length })`);
    const c = await page.center(`.lab-desktop-header nav[aria-label="Primary"] a[href*="experience"]`);
    await page.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: c.x, y: c.y });
    await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1, modifiers: 2 });
    await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1, modifiers: 2 });
    await sleep(2500);
    off();
    const after = await page.eval(`({ ...${STATE}, hist: history.length })`);
    check(`[${mode}] Ctrl+click: this tab unchanged (no selection, same URL, no entry)`, after.sel === null && after.url === before.url && after.hist === before.hist, JSON.stringify({ before, after }));
    const urls = [...new Set(created.map((t) => t.url).filter((u) => u && u !== "about:blank"))];
    check(`[${mode}] Ctrl+click: a new tab opens ${want}`, urls.some((u) => u.endsWith(want)), JSON.stringify(urls));
    check(`[${mode}] console: no errors, warnings or hydration messages`, errors.length === 0, errors.slice(0, 4).join(" | "));
  } finally {
    await page.close();
  }
}
console.log(`\n${results.filter(Boolean).length} of ${results.length} pass`);
process.exit(results.every(Boolean) ? 0 : 1);
