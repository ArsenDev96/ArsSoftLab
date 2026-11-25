// The approved floor tone with each station powered, and the cost of the tone layers (GPU, real frames).
import { ARRIVE, IDS, POWERED, SEQ, logger, open, save, sleep } from "./lib.mjs";
const out = {};
for (const [n, p] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"], ["default2", "/lab-v2"], ["tone2", "/lab-v2?floor=approved"]]) {
  const { page, hover, away, settle, errors, shot } = await open(p, { gpu: true });
  out[n] = {};
  for (const id of IDS) {
    for (const round of [1, 2]) {
      const log = await logger(page); await hover(id); await sleep(ARRIVE[id] + SEQ[id] + 700);
      const fr = await log.since(0); const t = fr.map(([x]) => x); const gaps = t.slice(1).map((x, i) => x - t[i]);
      out[n][id + round] = { frames: fr.length, longest: Math.max(...gaps) };
      out[n][id + "_powered"] = await settle((s) => POWERED[id](s[id]), 5000);
      if (n === "tone" && round === 2) await shot(`tone-powered-${id}.png`);
      await away(); await sleep(1600);
    }
  }
  out[n].errors = errors; await page.close();
}
save("tone.json", out); console.log(JSON.stringify(out));
