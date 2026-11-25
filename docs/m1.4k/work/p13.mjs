// Platform -> own label at ordinary speeds (one light logger, mouse events not awaited), /lab-v2 and the homepage; and frame pacing
// with the default and the approved floor (one logger per page).
import { ARRIVE, IDS, SEQ, open, save, sleep } from "./lib.mjs";
const out = { traverse: {}, pacing: {} };
const LOG = `(() => { window.__h = []; (function f() { window.__h.push([performance.now(), document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null]); requestAnimationFrame(f); })(); return 1; })()`;
const mark = (page) => page.eval("window.__h.length");
const since = async (page, n) => JSON.parse(await page.eval(`JSON.stringify(window.__h.slice(${n}))`));
for (const path of ["/lab-v2", "/"]) {
  const r = (out.traverse[path] = {});
  const { page, hover, away } = await open(path, { gpu: true });
  await page.eval(LOG);
  for (const id of IDS) for (const ms of [200, 400, 800]) {
    await hover(id); await sleep(ARRIVE[id] + SEQ[id] + 700);
    const p = await page.center(`[data-hotspot="${id}"]`), t = await page.center(`#station-${id}-trigger`);
    const m = await mark(page), n = Math.round(ms / 16), t0 = Date.now(), done = [];
    for (let k = 1; k <= n; k++) { done.push(page.mouseMove(p.x + ((t.x - p.x) * k) / n, p.y + ((t.y - p.y) * k) / n)); const w = t0 + (ms * k) / n - Date.now(); if (w > 0) await sleep(w); }
    const sent = Date.now() - t0; await Promise.all(done); const handled = Date.now() - t0; await sleep(500);
    const fr = await since(page, m);
    (r[id] ??= {})[ms] = { sent, handled, lost_frames: fr.filter(([, h]) => h !== id).length, others: [...new Set(fr.map(([, h]) => h))].filter((h) => h && h !== id), ends_on: fr.at(-1)[1] };
    await away(); await sleep(1300);
  }
  await page.close();
}
for (const [n, p] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"], ["default again", "/lab-v2"], ["tone again", "/lab-v2?floor=approved"]]) {
  const { page, hover, away } = await open(p, { gpu: true });
  await page.eval(LOG);
  const r = (out.pacing[n] = {});
  for (const round of [1, 2, 3]) for (const id of IDS) {
    const m = await mark(page); await hover(id); await sleep(ARRIVE[id] + SEQ[id] + 400);
    const t = (await since(page, m)).map(([x]) => x), g = t.slice(1).map((x, i) => x - t[i]);
    (r[id] ??= []).push([g.length, Math.round(Math.max(...g))]);
    await away(); await sleep(1200);
  }
  await page.close();
}
save("p13.json", out);
for (const [p, r] of Object.entries(out.traverse)) for (const [id, v] of Object.entries(r)) console.log(p, id, Object.entries(v).map(([ms, x]) => `${ms}ms(${x.handled}): lost ${x.lost_frames} ${x.others.join()} end ${x.ends_on}`).join(" | "));
for (const [n, r] of Object.entries(out.pacing)) console.log(n, JSON.stringify(r));
