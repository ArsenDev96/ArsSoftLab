// M1.4K section 9: four desktop sizes, idle and with every station raised.
import { ARRIVE, HEIGHT, IDS, POWERED, SEQ, lab, out, sleep } from "./core.mjs";
const PROBE = `(() => { const W = innerWidth, H = innerHeight; const R = (e) => { const b = e.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map((v) => +v.toFixed(1)); };
  const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3], inside = (b) => b[0] >= 0 && b[1] >= 0 && b[2] <= W && b[3] <= H;
  const parts = [...document.querySelectorAll("[data-station]")].flatMap((s) => [["title", s.querySelector("h2 button")], ...[...s.querySelectorAll("li button")].map((b) => [b.textContent.trim(), b]), ["icon", s.querySelector(".lab-station-icon")]].filter(([, e]) => e && e.getBoundingClientRect().width).map(([n, e]) => ({ id: s.dataset.station, k: s.dataset.station + " " + n, b: R(e), e, n })));
  const other = [...[...document.querySelectorAll("header a,header button")].filter((e) => e.getBoundingClientRect().width).map((e) => ({ id: "header", k: "header " + e.textContent.trim().slice(0, 12), b: R(e) })), ...[...document.querySelectorAll("#lab-intro h1 > span")].map((e, i) => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { id: "hero", k: "hero " + i, b: [b.left, b.top, b.right, b.bottom].map(Math.round) }; })];
  const all = [...parts, ...other], ov = []; for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (all[i].id !== all[j].id && hit(all[i].b, all[j].b)) ov.push(all[i].k + " / " + all[j].k);
  const reach = parts.filter((p) => p.n !== "icon").filter((p) => { const x = (p.b[0] + p.b[2]) / 2, y = (p.b[1] + p.b[3]) / 2; const e = document.elementFromPoint(x, y); return e?.closest("button") !== p.e; }).map((p) => p.k);
  const cam = document.querySelector(".lab-camera").getBoundingClientRect(), k = cam.width / 1672;
  const lines = [...document.querySelectorAll("svg[data-charge-line],[data-connection] svg,[data-charge]")].length;
  return { scroll: [document.documentElement.scrollWidth > W, document.documentElement.scrollHeight > H], clipped: all.filter((p) => !inside(p.b)).map((p) => p.k), overlaps: ov, unreachable: reach, small: parts.filter((p) => p.n !== "icon" && (p.b[3] - p.b[1] < 24)).map((p) => p.k + " " + (p.b[3] - p.b[1]).toFixed(1)), scale: +k.toFixed(4), aspect: +(cam.width / cam.height).toFixed(4), cut: { left: Math.round(-cam.x / k), top: Math.round(-cam.y / k) } }; })()`;
const res = {};
for (const [w, h] of [[1366, 768], [1648, 928], [1920, 1080], [2560, 1080]]) {
  const L = await lab("/lab-v2", { width: w, height: h });
  const r = (res[`${w}x${h}`] = { idle: await L.page.eval(PROBE), raised: {}, connection: await L.page.eval(`[...document.querySelectorAll(".lab-charge, [data-line]")].length`) });
  for (const id of IDS) {
    await L.rest(); await L.start(); await L.on(id); await sleep(ARRIVE[id] + SEQ[id] + 500);
    const f = await L.stop(); const p = await L.page.eval(PROBE);
    r.raised[id] = { y: +Math.max(...f.map((x) => x[id].y)).toFixed(2), devicePx: +(Math.max(...f.map((x) => x[id].y)) * p.scale).toFixed(2), spread: Math.max(...f.map((x) => x[id].spread)), powered: POWERED[id]((await L.read())[id]) || (id === "playground" ? Math.abs(Math.max(...f.map((x) => x[id].y)) - 18) < 0.1 : false), clipped: p.clipped, overlaps: p.overlaps, unreachable: p.unreachable, scroll: p.scroll, frames: f.filter((x) => x.hover === id).length };
    // the chip, clicked for real while raised
    const q = await L.page.eval(`(() => { const b = document.querySelector('section[data-station="${id}"] li button').getBoundingClientRect(); return [(b.left + b.right) / 2, (b.top + b.bottom) / 2]; })()`);
    await L.page.mouseMove(...q); await sleep(300);
    const q2 = await L.page.eval(`(() => { const b = document.querySelector('section[data-station="${id}"] li button').getBoundingClientRect(); return [(b.left + b.right) / 2, (b.top + b.bottom) / 2]; })()`);
    await L.page.click(...q2); await sleep(600); r.raised[id].chipUrl = await L.page.eval("location.search");
    r.raised[id].panel = await L.page.eval(`(() => { const s = document.querySelector('[data-station-panel="${id}"]')?.getBoundingClientRect(); return s ? [s.left, s.top, s.right, s.bottom].map(Math.round) : null; })()`);
    await L.home();
  }
  r.errors = L.errors; await L.page.close();
  console.log(`${w}x${h}`, JSON.stringify({ ...r.idle }), "\n   ", IDS.map((i) => `${i}: ${r.raised[i].y} px (${r.raised[i].devicePx} dev) ${r.raised[i].powered ? "powered" : "NOT"} clipped ${r.raised[i].clipped.join(";") || "-"} overlaps ${r.raised[i].overlaps.join(";") || "-"} unreachable ${r.raised[i].unreachable.join(";") || "-"} scroll ${r.raised[i].scroll.join()} ${r.raised[i].chipUrl}`).join("\n    "), "\n    errors", JSON.stringify(r.errors));
}
await out("k9-viewport", res); process.exit(0);
