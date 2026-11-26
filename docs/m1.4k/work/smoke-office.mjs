// M1.4K risk-based smoke test (navigation, keyboard, viewport). One pass, real input.   node smoke-office.mjs
//   -> results/smoke-office.json
import { BASE, IDS, POWERED, REST, sleep } from "./lib.mjs";
import { open } from "./lib.mjs";
import { out } from "./core.mjs";
const res = { viewports: {}, fails: [] };
const fail = (where, what) => { res.fails.push(`${where}: ${what}`); console.log("!!", where, what); };
const LAYOUT = `(() => { const W = innerWidth, H = innerHeight; const els = [...document.querySelectorAll("[data-station] h2 button, [data-station] li button")];
  const r = els.map((e) => { const b = e.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2; return { t: e.textContent.trim(), inside: b.left >= 0 && b.top >= 0 && b.right <= W && b.bottom <= H, reach: document.elementFromPoint(x, y)?.closest("button") === e, h: +b.height.toFixed(1) }; });
  return { scroll: [document.documentElement.scrollWidth > W, document.documentElement.scrollHeight > H], n: r.length, clipped: r.filter((x) => !x.inside).map((x) => x.t), unreachable: r.filter((x) => !x.reach).map((x) => x.t), small: r.filter((x) => x.h < 24).map((x) => x.t + " " + x.h) }; })()`;
const FOCUS = `(() => { const e = document.activeElement; if (!e || e === document.body) return null; const s = getComputedStyle(e); return { id: e.id || null, text: (e.textContent || "").trim().slice(0, 30), outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0 }; })()`;
for (const [w, h] of [[1366, 768], [1920, 1080]]) {
  const V = `${w}x${h}`, L = await open("/lab-v2", { width: w, height: h, gpu: true }), { page } = L, r = (res.viewports[V] = {});
  r.layout = await page.eval(LAYOUT);
  if (r.layout.scroll.some(Boolean) || r.layout.clipped.length || r.layout.unreachable.length) fail(V, "layout " + JSON.stringify(r.layout));
  // Real Tab order from the top of the page: every station's trigger, with a visible focus ring.
  await page.eval("(document.activeElement?.blur?.(), window.scrollTo(0, 0), 1)");
  const seen = [];
  for (let k = 0; k < 40; k++) { await page.key("Tab", "Tab", 9); await sleep(60); const f = await page.eval(FOCUS); if (f) seen.push(f); }
  r.tab = IDS.map((id) => { const f = seen.find((x) => x.id === `station-${id}-trigger`); return { id, reached: !!f, ring: f?.outline ?? false }; });
  for (const t of r.tab) if (!t.reached || !t.ring) fail(V, `tab ${t.id} reached ${t.reached} ring ${t.ring}`);
  // Enter opens the station (powered, in the address); Escape returns to the lab with focus on the same trigger.
  r.keys = {};
  for (const id of IDS) {
    await page.eval(`(document.getElementById("station-${id}-trigger").focus(), 1)`); await sleep(150);
    await page.key("Enter", "Enter", 13); await sleep(1200);
    const s1 = await L.read(), u1 = await page.eval("location.search");
    await page.key("Escape", "Escape", 27); await sleep(900);
    const u2 = await page.eval("location.search"), f2 = await page.eval(FOCUS);
    await page.eval("(document.activeElement?.blur?.(), 1)"); await L.off(); const rest = await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 9000);
    const k = (r.keys[id] = { enter: u1, selected: s1.selected, powered: POWERED[id](s1[id]), escape: u2, focusBack: f2?.id, rest });
    if (u1 !== `?station=${id}` || s1.selected !== id || !k.powered || u2 !== "" || f2?.id !== `station-${id}-trigger` || !rest) fail(V, `keys ${id} ${JSON.stringify(k)}`);
  }
  // A chip, clicked for real, then browser Back.
  const c = await page.center('section[data-station="engineering"] li button');
  await page.click(c.x, c.y); await sleep(1200); const u3 = await page.eval("location.search");
  await page.eval("(history.back(), 1)"); await sleep(1200); const u4 = await page.eval("location.search");
  r.chip = { opened: u3, back: u4 };
  if (u3 !== "?station=engineering&project=sqlorbit" || u4 !== "") fail(V, "chip/back " + JSON.stringify(r.chip));
  r.mail = await page.eval(`[...document.querySelectorAll('a[href^="mailto:"]')].map((a) => [a.textContent.trim(), a.getAttribute("href")])`);
  r.errors = L.errors; if (L.errors.length) fail(V, "errors " + JSON.stringify(L.errors));
  console.log(V, JSON.stringify({ layout: r.layout, tab: r.tab.every((t) => t.reached && t.ring), keys: Object.values(r.keys).every((k) => k.powered && k.rest), chip: r.chip, mail: r.mail.length }));
  await page.close();
}
// Direct link: powered at once, the panel open.
{
  const L = await open("/lab-v2?station=creative", { gpu: true }); const s = await L.read();
  res.direct = { selected: s.selected, powered: POWERED.creative(s.creative), errors: L.errors };
  if (s.selected !== "creative" || !res.direct.powered || L.errors.length) fail("direct", JSON.stringify(res.direct));
  console.log("direct", JSON.stringify(res.direct)); await L.page.close();
}
// The homepage: nothing from the lab's v2 scene is requested; the contact link.
{
  const L = await open("/", { gpu: true }); await sleep(1500);
  const v2 = L.requests.filter((u) => u.includes("/scene/v2/"));
  const mail = await L.page.eval(`[...document.querySelectorAll('a[href^="mailto:"]')].map((a) => [a.textContent.trim(), a.getAttribute("href")])`);
  res.home = { requests: L.requests.length, sceneV2: v2.length, mail, errors: L.errors };
  if (v2.length || !mail.some(([, h]) => h.startsWith("mailto:") && h.includes("Let's%20Talk")) || L.errors.length) fail("home", JSON.stringify(res.home));
  console.log("home", JSON.stringify(res.home)); await L.page.close();
}
console.log("smoke", res.fails.length ? `FAILED ${res.fails.length}` : "PASSED", BASE);
await out("smoke-office", res); process.exit(0);
