// M1.4I.1B: the awkward returns. node docs/m1.4i1/work/eng-edge.mjs <label>
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "../../../scripts/visual/cdp.mjs";
import { ARRIVE, ending, judge, open, visits } from "./eng-return.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const label = process.argv[2] ?? "run";
const out = {};
const brief = (log) => {
  const v = visits(log).map(judge);
  return { visits: v.length, premature: v.filter((x) => x.premature).length, detail: v.map((x) => ({ scan: x.scan, caps: x.caps, pulse: x.pulse, held: x.held, kept: x.kept, rose: x.rose, from: x.after.scanFrom, frozen: x.after.frozenScan })), powered: v.at(-1)?.powered, ending: ending(log) };
};

{
  const { page, errors, call } = await open();
  // Back in the very instant the hover drops (a microtask), and on the next animation frame.
  out.instant = [];
  for (const how of ["microtask", "frame", "two frames"])
    for (const at of [60, 110, 160, 220, 300, 380, 460, 540, 700]) {
      const log = await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 6000); q.start(); q.enter(); await q.until(() => q.hov() === "engineering"); await q.wait(${ARRIVE} + ${at} - 90);
        const back = new Promise((r) => { const mo = new MutationObserver(() => { if (q.hov() !== null) return; mo.disconnect(); const go = () => { q.enter(); r(1); }; ${how === "microtask" ? "go()" : how === "frame" ? "requestAnimationFrame(go)" : "requestAnimationFrame(() => requestAnimationFrame(go))"}; }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); });
        q.leave(); await back; await q.wait(${ARRIVE} + 1100); q.leave(); await q.until(() => q.hov() === null); await q.wait(800); return q.stop(); })()`);
      out.instant.push({ how, at, ...brief(log) });
    }

  // A click mid-scan, then Escape with the pointer away: focus returns to the title, a new charge.
  out.clickEscape = [];
  const c = await page.center('[data-hotspot="engineering"]');
  for (const [click, esc] of [[700, 60], [760, 120], [820, 200], [900, 260], [300, 250], [300, 520], [1400, 400]]) {
    for (let i = 0; i < 100 && !(await page.eval("window.__q.rest()")); i++) await sleep(60);
    await page.eval("(window.__q.start(), 1)");
    await page.mouseMove(c.x, c.y);
    await sleep(click);
    await page.click(c.x, c.y);
    await page.mouseMove(4, 924);
    await sleep(esc);
    await page.key("Escape", "Escape", 27);
    await sleep(ARRIVE + 1300);
    await page.eval("(document.activeElement.blur(), 1)");
    await sleep(900);
    const log = await call("window.__q.stop()");
    out.clickEscape.push({ click, esc, ...brief(log) });
  }

  // Back to Lab with the mouse: nothing is hovered afterwards, so it powers down.
  out.backToLab = [];
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 100 && !(await page.eval("window.__q.rest()")); i++) await sleep(60);
    await page.mouseMove(c.x, c.y);
    await sleep(1800);
    await page.click(c.x, c.y);
    await sleep(1200);
    const b = await page.center('[data-station-panel="engineering"] button[aria-keyshortcuts="Escape"]');
    await page.eval("(window.__q.start(), 1)");
    await page.click(b.x, b.y);
    await sleep(1500);
    const log = await call("window.__q.stop()");
    const end = log.at(-1);
    out.backToLab.push({ frames: log.length, hover: end.hover, sel: end.sel, scan: log.filter((f) => f.band > 0.02).length, caps: log.filter((f) => f.caps > 0.02).length, rest: ending(log).rest || (await page.eval("window.__q.rest()")) });
    await page.eval("(document.activeElement.blur(), 1)");
    await page.mouseMove(4, 924);
  }
  out.errors = errors;
  await page.close();
}
{
  // A direct link, Escape, away, and a quick return.
  const { page, errors, call } = await open("/lab-v2?station=engineering");
  await page.eval("(window.__q.start(), 1)");
  await sleep(600);
  const linked = await call("window.__q.stop()");
  await page.key("Escape", "Escape", 27);
  await sleep(1500);
  await page.eval("(document.activeElement.blur(), 1)");
  await sleep(1200);
  const rest = await page.eval("window.__q.rest()");
  const log = await call("window.__q.run(250, 100)");
  out.directLink = { powered: linked.every((f) => f.es === 1 && f.ef === 1 && f.stable === 1), scan: linked.filter((f) => f.band > 0.02 || f.caps > 0.02).length, restAfterEscape: rest, quickReturn: brief(log), errors };
  await page.close();
}
{
  // Reduced motion: no scan, caps or pulse is drawn at all; quick returns end powered, then at rest.
  const { page, errors, call } = await open("/lab-v2", { reducedMotion: true });
  out.reduced = [];
  for (const [on, gap] of [[60, 5], [120, 40], [300, 60], [300, 140], [600, 250]]) {
    const log = await call(`(async () => { const q = window.__q; q.start(); q.enter(); await q.wait(${on}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${gap}); q.enter(); await q.wait(700); q.leave(); await q.until(() => q.hov() === null); await q.wait(500); return q.stop(); })()`);
    const drawn = await page.eval(`[".eng-scan-band", ".eng-scan-shade", ".eng-caps", ".eng-pulse", ".eng-shimmer"].filter((s) => getComputedStyle(document.querySelector(s)).display !== "none")`);
    const on2 = log.filter((f) => f.hover === "engineering").at(-1), end = log.at(-1);
    out.reduced.push({ on, gap, drawn, powered: on2.es === 1 && on2.ef === 1 && on2.off === 0 && on2.stable === 1, rest: end.es === 0 && end.ef === 0 && end.off === 0.68 && end.stable === 0 });
  }
  out.reducedErrors = errors;
  await page.close();
}
writeFileSync(join(HERE, `eng-edge-${label}.json`), JSON.stringify(out) + "\n");
for (const [k, v] of Object.entries(out)) {
  if (!Array.isArray(v)) console.log(k, JSON.stringify(v));
  else {
    console.log(`# ${k}: ${v.length}, premature ${v.filter((x) => x.premature).length}`);
    for (const x of v) console.log("  ", JSON.stringify(x));
  }
}
process.exit(0);
