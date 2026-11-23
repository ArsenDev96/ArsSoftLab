// Baseline: what /lab-v2 and / load, the idle scene in both floor tones, activation state, isolation.
import { statSync } from "node:fs";
import { join } from "node:path";
import { BASE, IDS, ROOT, open, save, sleep } from "./lib.mjs";

const out = {};
const assets = (reqs) => [...new Set(reqs.filter((u) => u.startsWith(BASE) && /\.(png|webp|jpg|svg|ico|woff2)(\?|$)/.test(u)).map((u) => u.slice(BASE.length).split("?")[0]))].sort();
const size = (p) => { try { return statSync(join(ROOT, "public", p)).size; } catch { return 0; } };

for (const [name, path] of [["home", "/"], ["v2", "/lab-v2"], ["v2_tone", "/lab-v2?floor=approved"]]) {
  const { page, errors, requests, shot } = await open(path);
  const a = assets(requests);
  const scene = a.filter((p) => p.startsWith("/scene/"));
  const bitmaps = await page.eval(`(() => {
    const seen = new Map();
    const add = (src, w, h, kind) => { if (src && !seen.has(src)) seen.set(src, { w, h, kind }); };
    for (const i of document.images) add(new URL(i.currentSrc || i.src).pathname, i.naturalWidth, i.naturalHeight, "img");
    return [...seen].map(([src, v]) => ({ src, ...v }));
  })()`);
  const styleImgs = await page.eval(`(() => { const s = new Set(); for (const e of document.querySelectorAll("*")) { const c = getComputedStyle(e); for (const v of [c.maskImage, c.backgroundImage]) for (const m of v.matchAll(/url\\("?([^")]+)"?\\)/g)) s.add(new URL(m[1], location.href).pathname); } return [...s]; })()`);
  const styleSizes = await page.eval(`Promise.all(${JSON.stringify(styleImgs)}.filter((p) => p.startsWith("/scene/")).map((p) => new Promise((r) => { const i = new Image(); i.onload = () => r({ src: p, w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => r({ src: p, w: 0, h: 0 }); i.src = p; })))`);
  const mb = (l) => +(l.reduce((t, b) => t + b.w * b.h * 4, 0) / 1048576).toFixed(1);
  out[name] = {
    scene_files: scene.length,
    scene_kb: Math.round(scene.reduce((t, p) => t + size(p), 0) / 1024),
    v2_files: scene.filter((p) => p.startsWith("/scene/v2/")).length,
    v2_kb: Math.round(scene.filter((p) => p.startsWith("/scene/v2/")).reduce((t, p) => t + size(p), 0) / 1024),
    img_elements: await page.eval("document.images.length"),
    img_decoded_mb_rgba: mb(bitmaps),
    style_images: styleSizes,
    style_decoded_mb_rgba: mb(styleSizes),
    dom_nodes: await page.eval("document.querySelectorAll('*').length"),
    running_animations_idle: await page.eval("document.getAnimations().filter((a) => a.playState === 'running').map((a) => [a.animationName || a.transitionProperty || a.constructor.name, a.effect?.target?.className?.toString?.().slice(0, 60)])"),
    raf_per_second_idle: await page.eval(`new Promise((r) => { const o = window.requestAnimationFrame; let n = 0; window.requestAnimationFrame = (f) => { n++; return o(f); }; setTimeout(() => { window.requestAnimationFrame = o; r(n); }, 2000); })`),
    layout_shift: await page.eval(`new Promise((r) => { let s = 0; new PerformanceObserver((l) => l.getEntries().forEach((e) => (s += e.value))).observe({ type: "layout-shift", buffered: true }); setTimeout(() => r(+s.toFixed(5)), 300); })`),
    errors,
    files: scene,
  };
  await shot(`idle-${name}.png`);
  if (name === "v2") {
    out.v2.activation = await page.eval(`(() => {
      const css = [...document.querySelectorAll("style")].map((s) => s.textContent).join("\\n");
      return ${JSON.stringify(IDS)}.map((id) => ({
        id,
        arrive: (css.match(new RegExp('\\\\[data-lab-hover="' + id + '"\\\\]:not\\\\(\\\\[data-lab-selected="' + id + '"\\\\]\\\\)[^{]*\\\\{--arrive-now:(\\\\d+)ms')) || [])[1],
        rules_on_hover_or_selected: css.split(':is([data-lab-hover="' + id + '"],[data-lab-selected="' + id + '"])').length - 1,
        zone_elements: document.querySelectorAll('[data-zone="' + id + '"]').length,
        duplicates: { titles: document.querySelectorAll("#station-" + id + "-trigger").length, hotspots: document.querySelectorAll('[data-hotspot="' + id + '"]').length, surges: document.querySelectorAll('[data-surge="' + id + '"]').length, station_layers: document.querySelectorAll('[data-v2-station="' + id + '"], [data-lift="' + id + '"]').length },
      }));
    })()`);
    out.v2.duplicate_ids = await page.eval(`(() => { const m = {}; document.querySelectorAll("[id]").forEach((e) => (m[e.id] = (m[e.id] || 0) + 1)); return Object.entries(m).filter(([, n]) => n > 1); })()`);
    out.v2.floor_disc_correction = { floor: scene.includes("/scene/v2/m14h4/experience-floor.png"), lit: scene.includes("/scene/v2/m14h4/experience-floor-lit.png"), fronts_use: await page.eval(`[...document.querySelectorAll('[data-v2-floor="experience-floor"] .exp-floor img')].map((i) => new URL(i.src).pathname)`) };
    out.v2.floor_light = scene.filter((p) => p.includes("floor-light"));
    out.v2.unused_requests = scene.filter((p) => !p.startsWith("/scene/v2/"));
  }
  await page.close();
}
// Isolation: which /scene/v2 files / asks for; what the tone changes.
out.isolation = { home_v2_requests: out.home.v2_files, tone_extra: out.v2_tone.files.filter((f) => !out.v2.files.includes(f)), tone_missing: out.v2.files.filter((f) => !out.v2_tone.files.includes(f)) };
{
  const { page, shot } = await open("/?floor=approved");
  out.isolation.home_with_floor_param_tone_elements = await page.eval(`document.querySelectorAll('[data-v2-floor="tone"]').length`);
  await shot("idle-home-floor-param.png");
  await page.close();
}
// Navigating between the pages: full loads, Back / Forward, and the client router.
{
  const { page, errors } = await open("/");
  const at = () => page.eval(`({ url: location.pathname + location.search, v2: !!document.querySelector('[data-scene-variant="v2"]'), stations: document.querySelectorAll("[data-station]").length, selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null })`);
  const steps = [["home", await at()]];
  await page.goto(BASE + "/lab-v2"); steps.push(["goto /lab-v2", await at()]);
  await page.eval("history.back()"); await sleep(2500); steps.push(["back", await at()]);
  await page.eval("history.forward()"); await sleep(2500); steps.push(["forward", await at()]);
  await page.eval("window.next?.router?.push ? (window.next.router.push('/'), 1) : 0"); await sleep(3500); steps.push(["client push /", await at()]);
  await page.eval("window.next?.router?.push ? (window.next.router.push('/lab-v2?station=experience'), 1) : 0"); await sleep(3500); steps.push(["client push /lab-v2?station=experience", await at()]);
  await page.eval("history.back()"); await sleep(2500); steps.push(["back", await at()]);
  const links = await page.eval(`[...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))`);
  out.navigation = { steps, home_links: links, errors };
  await page.close();
}
{
  const { page } = await open("/lab-v2");
  out.navigation.v2_links = await page.eval(`[...document.querySelectorAll("a[href]")].map((a) => [a.textContent.trim().slice(0, 30), a.getAttribute("href")])`);
  const codes = {};
  for (const h of [...new Set(out.navigation.v2_links.map((l) => l[1]))].filter((h) => h.startsWith("/"))) codes[h] = await page.eval(`fetch(${JSON.stringify(h)}).then((r) => r.status)`);
  out.navigation.link_status = codes;
  await page.close();
}
for (const k of ["home", "v2", "v2_tone"]) if (k !== "v2") delete out[k].files;
save("baseline.json", out);
const { files, ...v2 } = out.v2;
console.log(JSON.stringify({ ...out, v2: { ...v2, style_images: undefined }, home: { ...out.home, style_images: undefined }, v2_tone: { ...out.v2_tone, style_images: undefined } }, null, 0));
console.log(out.v2.style_images.map((s) => `${s.src} ${s.w}x${s.h}`).join("\n"));
