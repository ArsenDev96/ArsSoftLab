// Interaction and accessibility: keyboard, focus, Enter / Escape, chips, direct links, history, reduced motion, hit areas.
import { ARRIVE, BASE, IDS, POWERED, REST, SEQ, launch, logger, open, save, sleep, until } from "./lib.mjs";

const out = {};
const only = process.argv[2];
const want = (n) => !only || only === n;
const FOCUS = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return { tag: e.tagName, text: (e.textContent || e.getAttribute("aria-label") || "").trim().slice(0, 40), id: e.id || null, station: e.closest("[data-station]")?.dataset.station ?? null, w: Math.round(r.width), h: Math.round(r.height), outline: s.outlineStyle !== "none" ? s.outlineWidth + " " + s.outlineColor : null, visible: r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0 }; })()`;
const url = (page) => page.eval("location.pathname + location.search");

// --- Tab order: forward through everything and out, then back.
if (want("tab")) {
  const { page, errors } = await open("/lab-v2");
  const order = [];
  for (let i = 0; i < 60; i++) {
    await page.key("Tab", "Tab", 9);
    await sleep(40);
    const f = await page.eval(FOCUS);
    order.push(f);
    if (f === null && i > 3) break;
    if (i > 3 && order[0] && f && f.text === order[0].text && f.id === order[0].id) break;
  }
  out.tab = { count: order.length, left_the_page_or_wrapped: order.at(-1) === null || (order.length > 2 && order.at(-1)?.text === order[0]?.text), order: order.map((f) => f && `${f.station ? "[" + f.station + "] " : ""}${f.tag} ${f.text} ${f.w}x${f.h}${f.outline ? " outline " + f.outline : " NO OUTLINE"}${f.visible ? "" : " NOT VISIBLE"}`), errors };
  await page.close();
}
// --- per station: Tab to it, Enter, panel focus, chips, Escape; click; click during charging; click another station.
if (want("station")) {
  out.station = {};
  for (const id of IDS) {
    const { page, errors, read, hover, away, settle } = await open("/lab-v2");
    let tab = null;
    for (let i = 0; i < 60 && !tab; i++) {
      await page.key("Tab", "Tab", 9);
      await sleep(25);
      const f = await page.eval(FOCUS);
      if (f?.station === id && f.id === `station-${id}-trigger`) tab = i + 1;
    }
    const focusedPowered = await settle((s) => s.hover === id && POWERED[id](s[id]), 7000);
    await page.key("Enter", "Enter", 13);
    await sleep(1500);
    const sel = { url: await url(page), selected: (await read()).selected, focus: await page.eval(FOCUS), powered: POWERED[id]((await read())[id]), expanded: await page.eval(`document.getElementById("station-${id}-trigger").getAttribute("aria-expanded")`), live: await page.eval(`document.querySelector("p[aria-live]").textContent`) };
    // Tab inside the panel reaches its buttons; no trap.
    const inside = [];
    for (let i = 0; i < 6; i++) { await page.key("Tab", "Tab", 9); await sleep(40); const f = await page.eval(FOCUS); inside.push(f && `${f.tag} ${f.text}`); }
    await page.key("Escape", "Escape", 27);
    await sleep(1500);
    const esc = { url: await url(page), selected: (await read()).selected, focus: await page.eval(FOCUS) };
    await page.eval("document.activeElement?.blur?.()");
    const rest = await settle((s) => REST[id](s[id]), 5000);
    // project chip by keyboard
    const chip = await page.eval(`(() => { const b = document.querySelector('[data-station="${id}"] ul button'); b.focus(); return b.textContent; })()`);
    await page.key("Enter", "Enter", 13);
    await sleep(1300);
    const proj = { chip, url: await url(page), pressed: await page.eval(`document.querySelector('[data-station="${id}"] ul button').getAttribute("aria-pressed")`), detail: await page.eval(`document.querySelector("[data-project-detail]")?.textContent ?? null`), open_project: await page.eval(`(() => { const e = document.querySelector("[data-open-row] a, [data-open-row] button"); return e ? e.tagName + (e.getAttribute("href") ? " " + e.getAttribute("href") : " " + (e.getAttribute("aria-disabled") ?? "")) : null; })()`) };
    await page.key("Escape", "Escape", 27);
    await sleep(1400);
    await page.eval("document.activeElement?.blur?.()");
    await settle((s) => IDS.every((o) => REST[o](s[o])), 5000);
    // mouse: click the platform while charging; click it again (stays); title click returns
    await hover(id);
    await sleep(ARRIVE[id] * 0.4);
    const p = await page.center(`[data-hotspot="${id}"]`);
    await page.click(p.x, p.y);
    await sleep(1500);
    const clicked = { url: await url(page), powered: POWERED[id]((await read())[id]) };
    const p2 = await page.center(`[data-hotspot="${id}"]`);
    await page.click(p2.x, p2.y);
    await sleep(700);
    clicked.again_url = await url(page);
    const other = IDS[(IDS.indexOf(id) + 1) % 5];
    const po = await page.center(`[data-hotspot="${other}"]`);
    await page.click(po.x, po.y);
    await sleep(1600);
    clicked.other = { url: await url(page), first_at_rest: REST[id]((await read())[id]), other_powered: POWERED[other]((await read())[other]) };
    await page.eval("history.back()");
    await sleep(1600);
    clicked.history_back = { url: await url(page), powered: POWERED[id]((await read())[id]) };
    await page.key("Escape", "Escape", 27);
    await away();
    await sleep(600);
    await page.eval("document.activeElement?.blur?.()");
    const endRest = await settle((s) => IDS.every((o) => REST[o](s[o])), 6000);
    // hovering the platform then its own label must not restart it
    await hover(id);
    await settle((s) => POWERED[id](s[id]), 7000);
    const log = await logger(page);
    const t = await page.center(`#station-${id}-trigger`);
    for (let k = 1; k <= 6; k++) { await page.mouseMove(p.x + ((t.x - p.x) * k) / 6, p.y + ((t.y - p.y) * k) / 6); await sleep(16); }
    await sleep(900);
    const fr = await log.since(0);
    const label = { hover_lost_frames: fr.filter(([, s]) => s.hover !== id).length, spark_frames: fr.filter(([, s]) => s.sparks[id] > 0).length, stays_powered: fr.every(([, s]) => POWERED[id](s[id])) };
    out.station[id] = { tab, focus_powers: focusedPowered, selected: sel, tab_inside: inside, escape: esc, rest_after_blur: rest, project: proj, click: clicked, rest_at_end: endRest, platform_to_label: label, errors };
    await page.close();
  }
}
// --- direct links: every station, with a project, invalid ones; reduced motion too.
if (want("links")) {
  out.links = {};
  const proj = { engineering: "sqlorbit", educational: "arimap", playground: "aziz", creative: "wallpapers", experience: "koreez" };
  const cases = [...IDS.map((i) => [`?station=${i}`, i]), ...IDS.map((i) => [`?station=${i}&project=${proj[i]}`, i]), ["?station=nope", null], ["?station=experience&project=sqlorbit", "experience"], ["?floor=approved&station=creative", "creative"], ["?STATION=experience", null]];
  for (const [q, id] of cases) {
    const page = await launch({ width: 1648, height: 928 });
    const errors = [];
    page.on((m) => { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200)); });
    await page.goto(BASE + "/lab-v2" + q);
    await sleep(1400);
    const { READ } = await import("./lib.mjs");
    const s = await page.eval(READ);
    out.links[q] = { url: await url(page), selected: s.selected, powered: id ? POWERED[id](s[id]) : null, others_rest: IDS.filter((o) => o !== id).every((o) => REST[o](s[o])), sparks: Object.values(s.sparks).some((v) => v > 0), project: await page.eval(`document.querySelector("[data-lab-project]")?.dataset.labProject ?? null`), errors };
    await page.close();
  }
}
// --- reduced motion: hover every station.
if (want("reduced")) {
  out.reduced = {};
  for (const id of IDS) {
    const { page, errors, hover, away, settle } = await open("/lab-v2", { reducedMotion: true, gpu: true });
    const log = await logger(page);
    await hover(id);
    await until(log, (s) => s.hover === id, 2000);
    await sleep(900);
    const fr = await log.since(0);
    const t0 = fr.find(([, s]) => s.hover === id)?.[0];
    const key = { engineering: "ef", educational: null, creative: null, experience: null, playground: "lit" }[id];
    const end = fr.at(-1)[1];
    out.reduced[id] = {
      spark_frames: fr.filter(([, s]) => Object.values(s.sparks).some((v) => v > 0)).length,
      one_shot_light_frames: fr.filter(([, s]) => (s.engineering.scan > 0 && s.hover === id && id === "engineering") || s.educational.light > 0 || s.creative.light > 0 || s.experience.light > 0).length,
      max_lift: Math.max(...fr.map(([, s]) => s.playground.lift)),
      powered_pw: end[id].pw ?? null,
      lit_after_ms: fr.find(([, s]) => s.hover === id && (id === "playground" ? s.playground.lit === 1 : s[id].floor === 1 || s[id].pw === 1))?.[0] - t0 || null,
      running_animations: await page.eval("document.getAnimations().filter((a) => a.playState === 'running').length"),
      errors,
    };
    await away();
    out.reduced[id].returns = await settle((s) => IDS.every((o) => REST[o](s[o]) || (o === "engineering" && s.engineering.ef === 0)), 4000);
    await page.close();
  }
}
// --- hit areas: what is on top at each hotspot's points, sizes of the controls, overlaps between labels.
if (want("hit")) {
  const { page } = await open("/lab-v2");
  out.hit = await page.eval(`(() => {
    const r = {};
    for (const h of document.querySelectorAll("[data-hotspot]")) {
      const b = h.getBoundingClientRect();
      let own = 0, n = 0; const others = {};
      for (let y = b.top + 2; y < b.bottom; y += 6) for (let x = b.left + 2; x < b.right; x += 6) {
        const e = document.elementFromPoint(x, y); if (!e) continue;
        const prev = h.style.pointerEvents; n++;
        if (e === h) own++; else { const k = e.dataset.hotspot ? "hotspot " + e.dataset.hotspot : e.closest("[data-station]") ? "label " + e.closest("[data-station]").dataset.station : e.tagName + "." + (e.className + "").slice(0, 30); others[k] = (others[k] || 0) + 1; }
      }
      r[h.dataset.hotspot] = { box: [b.left, b.top, b.width, b.height].map(Math.round), samples: n, own, others, cursor: getComputedStyle(h).cursor };
    }
    const ctl = [...document.querySelectorAll("[data-station] button")].map((b) => { const c = b.getBoundingClientRect(); return { station: b.closest("[data-station]").dataset.station, text: b.textContent, w: Math.round(c.width), h: Math.round(c.height) }; });
    return { hotspots: r, controls: ctl, too_small: ctl.filter((c) => c.h < 24 || c.w < 24) };
  })()`);
  await page.close();
}
save(only ? `a11y-${only}.json` : "a11y.json", out);
console.log(JSON.stringify(out));
