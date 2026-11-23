// Gate after client-side navigation from a 404: both pages, and whether it ever opens; and the Edge sparks, logged per frame.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE, CAP, IDS, launch, logger, open, save, sleep } from "./lib.mjs";
const out = {};
if (process.argv[2] === "gate") for (const to of ["/lab-v2", "/"]) {
  const page = await launch({ width: 1648, height: 928 });
  await page.send("Page.navigate", { url: BASE + "/nope" }); await sleep(5000);
  await page.eval(`(window.next.router.push(${JSON.stringify(to)}), 1)`);
  const s = [];
  for (let i = 0; i < 20; i++) { await sleep(1000); s.push(await page.eval(`[...document.querySelectorAll(".lab-plate-gate")].map((e) => getComputedStyle(e).opacity).join()`)); }
  out[to] = { opacity_each_second: s, hover: null };
  const c = await page.center('[data-hotspot="experience"]').catch(() => null);
  writeFileSync(join(CAP, `client-nav-${to === "/" ? "home" : "v2"}.jpg`), Buffer.from((await page.send("Page.captureScreenshot", { format: "jpeg", quality: 80 })).data, "base64"));
  // The other ways in: full load, reload.
  await page.send("Page.reload"); await sleep(6000);
  out[to].after_reload = await page.eval(`[...document.querySelectorAll(".lab-plate-gate")].map((e) => getComputedStyle(e).opacity).join()`);
  await page.close();
}
if (process.argv[2] === "edge") {
  const { page, hover, away } = await open("/lab-v2", { gpu: true });
  for (const id of IDS) { const log = await logger(page); await hover(id); await sleep(2500); const fr = await log.since(0); out[id] = { frames: fr.length, spark_frames: fr.filter(([, s]) => s.sparks[id] > 0).length, others: fr.filter(([, s]) => IDS.some((o) => o !== id && s.sparks[o] > 0 )).length }; await away(); await sleep(1800); }
  await page.close();
}
save(`p11-${process.argv[2]}.json`, out); console.log(JSON.stringify(out));
