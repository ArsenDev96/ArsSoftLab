// Confirms the quick-return finding at real speed and captures it: Engineering's scan and Creative Studio's glint.
import { ARRIVE, READ, open, save, sleep, logger, until } from "./lib.mjs";
const out = {};
for (const [id, cond, box] of [["engineering", (s) => s.engineering.es > 0.35 && s.engineering.es < 0.8, { x: 330, y: 378, w: 230, h: 120 }], ["creative", (s) => s.creative.cg > 0.3 && s.creative.cg < 0.7, { x: 160, y: 538, w: 280, h: 160 }]]) {
  for (const gap of [140, 220]) {
    const { page, hover, off, shot } = await open("/lab-v2", { gpu: true });
    const log = await logger(page);
    await hover(id);
    const at = await until(log, (s) => s.hover === id && cond(s), 4000);
    await off();
    const drop = await until(log, (s) => s.hover === null, 800);
    await sleep(gap);
    const m = await log.mark();
    await hover(id);
    await until(log, (s) => s.hover === id, 800);
    await sleep(ARRIVE[id] * (id === "engineering" ? 0.45 : 1) + (id === "creative" ? 60 : 0));
    await shot(`quickreturn-${id}-${gap}.png`, box, 3);
    await sleep(1500);
    const fr = (await log.since(m)).filter(([, s]) => s.hover === id);
    const t0 = fr[0][0];
    const shown = fr.filter(([, s]) => (id === "engineering" ? s.engineering.scan > 0.05 : s.creative.light > 0.05));
    const before = shown.filter(([t]) => t - t0 < ARRIVE[id] - 25);
    out[`${id}, back ${gap} ms after hover dropped`] = { left_at: id === "engineering" ? at?.[1].engineering.es : at?.[1].creative.cg, light_shown_before_arrival_frames: before.length, from_ms: before[0]?.[0] - t0, to_ms: before.at(-1)?.[0] - t0, last_light_ms: shown.at(-1)?.[0] - t0, held_value_at_return: id === "engineering" ? fr[0][1].engineering.es : fr[0][1].creative.cg, static_frames_after_arrival: fr.filter(([t, s], i) => i && t - t0 > ARRIVE[id] && (id === "creative") && s.creative.light > 0.05 && s.creative.cg === fr[i - 1][1].creative.cg && s.creative.cs === fr[i - 1][1].creative.cs).length };
    await page.close();
  }
}
save("slip.json", out);
console.log(JSON.stringify(out, null, 1));
