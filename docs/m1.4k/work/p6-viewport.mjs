// Viewports: idle, one station powered and one selected, at four sizes; clipping, overlaps, scrolling; against the
// homepage at the same size (what it inherits from it is the same there).
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { ARRIVE, CAP, IDS, SEQ, open, save, sleep } from "./lib.mjs";

const SIZES = process.argv[2] ? JSON.parse(process.argv[2]) : [[1280, 800], [1648, 928], [1920, 1080], [2560, 1080]];
// PNG replies over about 4 MB never arrive through Node's WebSocket; JPEG keeps the wide captures under that.
const jpeg = (page) => async (n) => writeFileSync(join(CAP, n.replace(".png", ".jpg")), Buffer.from((await page.send("Page.captureScreenshot", { format: "jpeg", quality: 92 })).data, "base64"));
const PROBE = `(() => {
  const W = innerWidth, H = innerHeight;
  const rect = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) }; };
  const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const labels = [...document.querySelectorAll("[data-station]")].map((s) => ({ id: s.dataset.station, title: rect(s.querySelector("h2 button")), chips: [...s.querySelectorAll("ul button")].map(rect), icon: s.querySelector(".lab-station-icon") ? rect(s.querySelector(".lab-station-icon")) : null }));
  const parts = labels.flatMap((l) => [["title", l.title], ...l.chips.map((c, k) => ["chip" + k, c])].map(([n, b]) => ({ k: l.id + " " + n, id: l.id, b })));
  const header = document.querySelector("header"); const hb = header ? [...header.querySelectorAll("a,button")].filter((e) => e.getBoundingClientRect().width > 0).map((e) => ({ k: "header " + e.textContent.trim().slice(0, 14), b: rect(e) })) : [];
  const hero = [...document.querySelectorAll("#lab-intro h1 > span")].map((e, k) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { k: "hero line " + k, b: { x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height) } }; });
  const all = [...parts, ...hb, ...hero];
  const overlaps = [];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].id !== all[j].id || !all[i].id) if (!(all[i].k.startsWith("header") && all[j].k.startsWith("header")) && !(all[i].k.startsWith("hero") && all[j].k.startsWith("hero")) && hit(all[i].b, all[j].b)) overlaps.push(all[i].k + " / " + all[j].k);
  const cam = rect(document.querySelector(".lab-camera"));
  return { scroll: [document.documentElement.scrollWidth > W, document.documentElement.scrollHeight > H], clipped: all.filter((p) => !inside(p.b)).map((p) => p.k + " " + JSON.stringify(p.b)), overlaps, camera: cam, scene_px_cut: { left: Math.round(-cam.x / (cam.w / 1672)), top: Math.round(-cam.y / (cam.w / 1672)) }, scale: +(cam.w / 1672).toFixed(4) };
})()`;
const out = {};
for (const [w, h] of SIZES) {
  const k = `${w}x${h}`;
  const { page, errors, hover, away } = await open("/lab-v2", { width: w, height: h });
  const shot = jpeg(page);
  out[k] = { idle: await page.eval(PROBE) };
  await shot(`vp-${k}-idle.png`);
  await hover("experience");
  await sleep(ARRIVE.experience + SEQ.experience + 900);
  out[k].experience_powered_hover = await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  await shot(`vp-${k}-experience.png`);
  await away();
  await hover("playground");
  await sleep(ARRIVE.playground + 2200);
  out[k].playground = await page.eval(`(() => { const l = document.querySelector('.lab-lift[data-lift="playground"]'); const t = getComputedStyle(l).transform; return t === "none" ? 0 : +(-new DOMMatrix(t).f / (l.offsetWidth / 1672)).toFixed(2); })()`);
  await shot(`vp-${k}-playground.png`);
  await away();
  out[k].selected = {};
  for (const id of IDS) {
    const c = await page.center(`#station-${id}-trigger`);
    await page.click(c.x, c.y);
    await sleep(1700);
    const p = await page.eval(PROBE);
    out[k].selected[id] = { clipped: p.clipped, overlaps: p.overlaps.filter((o) => !o.startsWith("hero") && !o.includes("/ hero")), panel: await page.eval(`(() => { const s = document.querySelector('[data-station-panel="${id}"]').getBoundingClientRect(); return [s.left, s.top, s.right, s.bottom].map(Math.round); })()`) };
    if (id === "engineering" || id === "experience") await shot(`vp-${k}-selected-${id}.png`);
    await page.key("Escape", "Escape", 27);
    await page.mouseMove(4, h - 4);
    await sleep(1100);
    await page.eval("document.activeElement?.blur?.()");
  }
  out[k].errors = errors;
  await page.close();
  const home = await open("/", { width: w, height: h });
  out[k].home = await home.page.eval(PROBE);
  await jpeg(home.page)(`vp-${k}-home.png`);
  await home.page.close();
}
save("viewport.json", out);
for (const [k, v] of Object.entries(out)) {
  console.log(k, "scale", v.idle.scale, "cut", JSON.stringify(v.idle.scene_px_cut), "scroll", v.idle.scroll.join(), "lift", v.playground, "hover", v.experience_powered_hover);
  console.log("  v2 clipped", v.idle.clipped.join("; ") || "-", "| overlaps", v.idle.overlaps.join("; ") || "-");
  console.log("  home clipped", v.home.clipped.join("; ") || "-", "| overlaps", v.home.overlaps.join("; ") || "-");
  for (const [id, s] of Object.entries(v.selected)) if (s.clipped.length || s.overlaps.length) console.log("  selected", id, "clipped", s.clipped.join("; ") || "-", "| overlaps", s.overlaps.join("; ") || "-");
  if (v.errors.length) console.log("  errors", v.errors);
}
