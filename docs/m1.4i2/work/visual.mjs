// M1.4I.2: the same frames, before and after. Every animation is paused and set to the same time, so a frame is the
// same moment of the sequence in every run.
//   node visual.mjs <out dir> <rep> [w h] [gpu|cpu] [quick]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { ARRIVE, IDS, open, sleep } from "../../m1.4i/work/lib.mjs";
const [dir, rep = "0", w = "1648", h = "928", mode = "gpu", quick] = process.argv.slice(2);
const D = join(dir, `${w}-${mode}-${rep}`);
mkdirSync(D, { recursive: true });
const opts = { width: +w, height: +h, gpu: mode === "gpu" };
const AFTER = quick ? { engineering: [280], educational: [450], playground: [220], creative: [370], experience: [430] }
  : {
      engineering: [40, 150, 280, 400, 480, 1500],
      educational: [40, 150, 300, 450, 600, 740, 4000],
      playground: [40, 120, 220, 320, 440],
      creative: [40, 130, 250, 370, 500, 640],
      experience: [40, 200, 430, 650, 800, 900],
    };
const LEAVE = quick ? [] : [60, 200, 350];
const go = async (path, o = {}) => {
  const p = await open(path, { ...opts, ...o });
  // A large reply is sometimes lost on Node's WebSocket: ask again.
  const shot = async (n) => {
    for (let k = 0; k < 5; k++) {
      const r = await Promise.race([p.page.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(6000)]);
      if (r?.data) return writeFileSync(join(D, `${n}.png`), Buffer.from(r.data, "base64"));
      console.log("retry", n);
    }
    throw new Error("no screenshot " + n);
  };
  return { ...p, shot };
};
const errors = [];
for (const [n, path] of [["idle", "/lab-v2"], ["idle-tone", "/lab-v2?floor=approved"]]) {
  const p = await go(path);
  await sleep(800);
  await p.finish();
  await sleep(200);
  await p.shot(n);
  errors.push(...p.errors);
  await p.page.close();
}
const ONLY = process.env.ONLY?.split(",") ?? IDS;
for (const id of ONLY) {
  const p = await go("/lab-v2");
  await p.finish();
  const c = await p.page.center(`[data-hotspot="${id}"]`);
  await p.page.mouseMove(c.x, c.y);
  await p.frame();
  for (const t of [...(quick ? [] : [Math.round(ARRIVE[id] * 0.5)]), ...AFTER[id].map((x) => x + ARRIVE[id])]) {
    await p.seek(t);
    await sleep(120);
    await p.shot(`${id}-${String(t - ARRIVE[id]).padStart(4, "0")}`);
  }
  await p.seek(ARRIVE[id] + 2400);
  await sleep(350);
  await p.shot(`${id}-powered`);
  // Really over (a seeked transition past its end is still held): leave from the finished state.
  await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
  await sleep(150);
  // Freeze everything the moment the hover is dropped (the transitions exist once styles are flushed).
  await p.page.eval(`(() => { const el = document.querySelector("[data-lab-hover]"); new MutationObserver((_, o) => { o.disconnect(); document.getAnimations().forEach((a) => a.pause()); queueMicrotask(() => document.getAnimations().forEach((a) => a.pause())); requestAnimationFrame(() => document.getAnimations().forEach((a) => a.pause())); }).observe(el, { attributes: true, attributeFilter: ["data-lab-hover"] }); return 1; })()`);
  await p.away();
  await p.frame();
  for (const t of LEAVE) { await p.seek(t); await sleep(120); await p.shot(`${id}-leave-${t}`); }
  await p.page.eval(`(() => { for (const a of document.getAnimations()) { try { a.finish(); } catch {} } return 1; })()`);
  await sleep(1300);
  await p.shot(`${id}-rest-after`);
  errors.push(...p.errors);
  await p.page.close();
}
if (!quick) for (const id of ONLY) {
  const p = await go(`/lab-v2?station=${id}`);
  await sleep(1500);
  await p.finish();
  await sleep(300);
  await p.shot(`${id}-selected`);
  errors.push(...p.errors);
  await p.page.close();
}
if (!quick && !process.env.ONLY) {
  const p = await go("/lab-v2", { reducedMotion: true });
  for (const id of IDS) {
    const c = await p.page.center(`[data-hotspot="${id}"]`);
    await p.page.mouseMove(c.x, c.y);
    await sleep(500);
    await p.finish();
    await sleep(200);
    await p.shot(`${id}-reduced`);
    await p.away();
    await sleep(500);
  }
  errors.push(...p.errors);
  await p.page.close();
}
console.log(D, "done", [...new Set(errors)].slice(0, 5));
process.exit(0);
