// Static Lite integration: short browser smoke test of Lite (`?render=lite`, the flattened scene), default Chrome,
// headless, 1648 x 928, against a running dev server.
//   node lite-integration-smoke.mjs   -> results/lite-integration-smoke.txt
// 1 renderer: Lite is the static scene; `render=static` is no mode any more; the layered source is development-only
// 2 stations: each of the five hotspots (a point inside its outline) hovers and powers its station; click selects; Escape
// 3 chips and project pages: every chip; Open project for SQLOrbit and AriMap; Back to the lab keeps Lite
// 4 history and keyboard: Back / Forward through a station and project; Tab, Enter, Escape
// 5 selector: Cinematic <-> Lite without a reload, selection kept, Back
// 6 floor: `?render=lite&floor=approved` keeps its URL; Cinematic then shows the tone
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
const BASE = process.env.BASE || "http://localhost:3002";
const RES = fileURLToPath(new URL("./results/", import.meta.url)); mkdirSync(RES, { recursive: true });
const STATIONS = ["engineering", "educational", "playground", "creative", "experience"];
const lines = []; let pass = 0, fail = 0;
const check = (name, ok, info = "") => { ok ? pass++ : fail++; const l = `${ok ? "PASS" : "FAIL"}  ${name}${info ? `  (${info})` : ""}`; lines.push(l); console.log(l); };
const errors = [];
const until = async (page, expr, ms = 8000) => { for (let t = 0; t < ms; t += 50) { if (await page.eval(expr)) return true; await sleep(50); } return false; };
const AWAY = [4, 924];
const open = async (url) => {
  const page = await launch({ width: 1648, height: 928 });
  page.on((m) => { if (m.method === "Runtime.exceptionThrown" || (m.method === "Runtime.consoleAPICalled" && m.params.type === "error")) errors.push(JSON.stringify(m.params).slice(0, 200)); });
  await page.goto(`${BASE}${url}`);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  return page;
};
const state = (page) => page.eval(`(() => { const st = document.querySelector("[data-lab-render]"); const op = (id) => { const e = document.querySelector('[data-static-power="' + id + '"]'); return e ? +getComputedStyle(e).opacity : null; };
  return { url: location.pathname + location.search, renderer: st?.dataset.liteRenderer ?? (document.querySelector('[data-scene-variant="v2"]') ? (st ? "layered-lite" : "cinematic") : null),
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    project: document.querySelector("[data-lab-project]")?.dataset.labProject ?? null, power: Object.fromEntries(${JSON.stringify(STATIONS)}.map((id) => [id, op(id)])),
    selector: document.querySelector("input[name=lab-render-mode]:checked")?.value ?? null, vignette: document.querySelector(".lab-focus-vignette")?.hasAttribute("data-open") ?? null }; })()`);
const lit = (s) => STATIONS.filter((id) => s.power[id] === 1).join(",") || "none";

// 1. Renderer
{
  const page = await open("/lab-v2?render=lite");
  const r = await page.eval(`(() => { const st = document.querySelector("[data-lab-render]"); const imgs = [...st.querySelectorAll("img")];
    return { lab: st.dataset.labRender, renderer: st.dataset.liteRenderer, layered: !!document.querySelector("[data-scene-variant]"), imgs: imgs.map((i) => i.getAttribute("src").split("/").pop() + ":" + i.naturalWidth).join(" "),
      scene: performance.getEntriesByType("resource").filter((e) => e.name.includes("/scene/")).length, anims: document.getAnimations().filter((a) => a.playState === "running").length }; })()`);
  check("render=lite draws the static scene", r.lab === "lite" && r.renderer === "static" && !r.layered, `renderer ${r.renderer}, layered scene ${r.layered}`);
  check("six baked images loaded, nothing else from /scene/", r.imgs === "plate.webp:1672 on-engineering.webp:546 on-educational.webp:351 on-playground.webp:502 on-creative.webp:675 on-experience.webp:714" && r.scene === 6, `${r.scene} scene requests`);
  check("at rest nothing is animating", r.anims === 0, `${r.anims} running`);
  const s = await state(page);
  check("selector shows Lite", s.selector === "lite");
  await page.close();
  const st = await open("/lab-v2?render=static");
  const s2 = await state(st);
  check("render=static is no longer a mode (Cinematic, as any unknown value)", s2.renderer === "cinematic" && s2.selector === "full", `${s2.renderer}, selector ${s2.selector}`);
  await st.close();
  const ly = await open("/lab-v2?render=lite&lite=layered");
  const s3 = await state(ly);
  check("dev server: render=lite&lite=layered is the bake's layered source (development only)", s3.renderer === "layered-lite" && s3.selector === "lite", s3.renderer);
  await ly.close();
}

// 2. Stations: a point inside each hotspot's outline; hover powers at once; click selects; Escape returns.
{
  const page = await open("/lab-v2?render=lite");
  await page.mouseMove(...AWAY); await sleep(500);
  for (const id of STATIONS) {
    const p = await page.eval(`(() => { const h = document.querySelector('[data-hotspot="${id}"]').getBoundingClientRect();
      for (let y = h.top + 4; y < h.bottom; y += 6) for (let x = h.left + 4; x < h.right; x += 6) { const e = document.elementFromPoint(x, y); if (e?.closest('[data-hotspot="${id}"]')) return { x, y }; } return null; })()`);
    if (!p) { check(`${id}: hotspot reachable`, false); continue; }
    await page.mouseMove(p.x, p.y);
    const powered = await until(page, `+getComputedStyle(document.querySelector('[data-static-power="${id}"]')).opacity === 1`, 1000);
    const s = await state(page);
    await page.click(p.x, p.y); await sleep(250);
    const sel = await state(page);
    await page.mouseMove(...AWAY); await sleep(400);
    const held = await state(page);
    await page.key("Escape", "Escape", 27); await sleep(400);
    // As in Cinematic and the layered Lite: Escape returns keyboard focus to the station's title, which keeps it lit
    // (keyboard hover) until focus moves on.
    const back = await state(page);
    const onTitle = await page.eval(`document.activeElement?.closest('[data-station="${id}"]') !== null && document.activeElement.classList.contains("lab-station-title")`);
    await page.eval(`document.activeElement?.blur(), 1`); await sleep(250);
    const off = await state(page);
    check(`${id}: hotspot hover powers it; click selects; stays powered when the pointer leaves; Escape returns (focus on its title); off once focus leaves`,
      powered && s.hover === id && lit(s) === id && sel.selected === id && sel.url.includes(`station=${id}`) && sel.url.includes("render=lite") && sel.vignette && lit(held) === id && !back.selected && back.url === "/lab-v2?render=lite" && back.hover === id && onTitle && lit(off) === "none",
      `lit ${lit(s)}, url ${sel.url}, after Escape ${back.url} (focus on title ${onTitle}), after blur lit ${lit(off)}`);
  }
  await page.close();
}

// 3. Chips, and Open project for SQLOrbit and AriMap.
{
  const page = await open("/lab-v2?render=lite");
  const got = [];
  for (const id of STATIONS) {
    const c = await page.center(`[data-station="${id}"] .lab-chip`);
    await page.mouseMove(c.x, c.y); await sleep(150); await page.click(c.x, c.y); await sleep(300);
    const s = await state(page);
    got.push(`${id}:${s.project}`);
    if (!(s.selected === id && s.project && s.url.includes("render=lite") && lit(s) === id)) got.push("!");
    await page.key("Escape", "Escape", 27); await sleep(300); await page.mouseMove(...AWAY);
  }
  check("every station's first chip selects its project, in Lite", !got.includes("!"), got.join(" "));
  for (const [station, slug] of [["engineering", "sqlorbit"], ["educational", "arimap"]]) {
    const c = await page.center(`[data-station="${station}"] .lab-chip`);
    await page.click(c.x, c.y); await sleep(300);
    const href = await page.eval(`document.querySelector('a[href^="/lab-v2/projects/${slug}"]')?.getAttribute("href") ?? null`);
    await page.eval(`document.querySelector('a[href^="/lab-v2/projects/${slug}"]').click(), 1`);
    await until(page, `location.pathname === "/lab-v2/projects/${slug}"`);
    const there = await page.eval("location.pathname + location.search");
    await until(page, `!![...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Back to the lab")`);
    await page.eval(`[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Back to the lab").click(), 1`);
    await until(page, `location.pathname === "/lab-v2" && !!document.querySelector('[data-lite-renderer="static"]')`);
    await sleep(300);
    const s = await state(page);
    check(`Open project ${slug} -> its page -> Back to the lab returns to Lite`, href === `/lab-v2/projects/${slug}?render=lite` && there === href && s.url === `/lab-v2?station=${station}&project=${slug}&render=lite` && s.renderer === "static" && lit(s) === station, `${href}; back at ${s.url}`);
    await page.key("Escape", "Escape", 27); await sleep(300);
  }
  await page.close();
}

// 4. History and keyboard.
{
  const page = await open("/lab-v2?render=lite");
  const t = await page.center('[data-station="engineering"] .lab-station-title');
  await page.click(t.x, t.y); await sleep(300);
  const c = await page.center('[data-station="engineering"] .lab-chip'); await page.click(c.x, c.y); await sleep(300);
  await page.mouseMove(...AWAY); await sleep(300);
  const seq = [await state(page)];
  for (const step of ["back", "back", "forward", "forward"]) { await page.eval(`history.${step}(), 1`); await sleep(500); seq.push(await state(page)); }
  const fmt = (s) => `${s.selected ?? "-"}/${s.project ?? "-"}/${lit(s)}`;
  check("Back / Forward: project -> station -> lab -> station -> project, all in Lite", seq.map(fmt).join(" > ") === "engineering/sqlorbit/engineering > engineering/-/engineering > -/-/none > engineering/-/engineering > engineering/sqlorbit/engineering" && seq.every((s) => s.renderer === "static" && s.url.includes("render=lite")), seq.map(fmt).join(" > "));
  await page.goto(`${BASE}/lab-v2?render=lite`); await page.eval(`document.activeElement?.blur(); 1`);
  let n = 0;
  while (n++ < 40 && !(await page.eval(`!!document.activeElement?.closest('[data-station="educational"]') && document.activeElement.classList.contains("lab-station-title")`))) await page.key("Tab", "Tab", 9);
  await sleep(150);
  const f = await state(page);
  const ring = await page.eval(`(() => { const e = document.activeElement, cs = getComputedStyle(e); return e.matches(":focus-visible") && cs.outlineStyle !== "none"; })()`);
  await page.key("Enter", "Enter", 13); await sleep(300); const e1 = await state(page);
  await page.key("Tab", "Tab", 9); await page.key("Enter", "Enter", 13); await sleep(300); const e2 = await state(page);
  await page.key("Escape", "Escape", 27); await sleep(400); const e3 = await state(page);
  const focus = await page.eval(`document.activeElement?.textContent ?? null`);
  check("keyboard: Tab to Educational lights it (focus ring); Enter selects; Tab + Enter on AriMap; Escape returns, focus on its title",
    f.hover === "educational" && lit(f) === "educational" && ring && e1.selected === "educational" && e2.project === "arimap" && !e3.selected && e3.url === "/lab-v2?render=lite" && focus === "Educational",
    `${n} Tabs; ${e1.url} > ${e2.url} > ${e3.url}; focus ${focus}`);
  await page.close();
}

// 5. Selector.
{
  const page = await open("/lab-v2?station=playground");
  await page.eval("(window.__marker = 1)");
  const pick = async (v) => { const c = await page.center(`label:has(input[name=lab-render-mode][value=${v}])`); await page.click(c.x, c.y); };
  await pick("lite");
  await until(page, `!!document.querySelector('[data-lite-renderer="static"]')`, 10000);
  const a = await state(page), kept = await page.eval("window.__marker === 1");
  await pick("full");
  await until(page, `!document.querySelector('[data-lite-renderer]') && !!document.querySelector('[data-scene-variant="v2"]')`, 10000);
  const b = await state(page);
  await page.eval("history.back(), 1");
  await until(page, `!!document.querySelector('[data-lite-renderer="static"]')`, 10000);
  const c = await state(page);
  check("selector: Cinematic -> Lite without a reload, Playground kept and lit", a.renderer === "static" && kept && a.url === "/lab-v2?station=playground&render=lite" && a.selected === "playground" && lit(a) === "playground" && a.selector === "lite", a.url);
  check("selector: Lite -> Cinematic removes render; Back returns to Lite", b.renderer === "cinematic" && b.url === "/lab-v2?station=playground" && b.selector === "full" && c.renderer === "static" && c.url === "/lab-v2?station=playground&render=lite", `${b.url} | back: ${c.url}`);
  await page.close();
}

// 6. floor=approved in Lite.
{
  const page = await open("/lab-v2?render=lite&floor=approved");
  const s = await state(page);
  const tone = await page.eval(`!!document.querySelector('[data-v2-floor="tone"]')`);
  const c = await page.center(`label:has(input[name=lab-render-mode][value=full])`); await page.click(c.x, c.y);
  await until(page, `!!document.querySelector('[data-scene-variant="v2"]')`, 10000);
  const s2 = await state(page), tone2 = await page.eval(`!!document.querySelector('[data-v2-floor="tone"]')`);
  check("floor=approved in Lite: static scene (one, untoned floor), URL kept; Cinematic then shows the tone", s.renderer === "static" && !tone && s.url === "/lab-v2?render=lite&floor=approved" && s2.url === "/lab-v2?floor=approved" && tone2, `${s.url} -> ${s2.url}, tone ${tone2}`);
  await page.close();
}

check("no console errors or exceptions", errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
lines.push("", `${pass} passed, ${fail} failed`);
console.log(`${pass} passed, ${fail} failed`);
writeFileSync(RES + "lite-integration-smoke.txt", lines.join("\n") + "\n");
process.exit(fail ? 1 : 0);
