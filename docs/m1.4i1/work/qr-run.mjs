// M1.4I.1D probe: node docs/m1.4i1/work/qr-run.mjs <label> <station> [first|mouse|grid|sequences|edge|reduced ...]
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, STATIONS, ending, judge, open, sleep, tally, visits } from "./qr-lib.mjs";

const [label, id, ...only] = process.argv.slice(2);
const A = STATIONS[id].arrive, SEQ = STATIONS[id].seq, via = STATIONS[id].via;
const out = { id };
const ms = (a) => Math.round(a);
const evalRun = (log, extra) => {
  const v = visits(id, log);
  return { ...extra, visits: v.length, ...judge(id, v.at(-1)), others: v.slice(1, -1).map((x) => judge(id, x)).filter((x) => x.premature || x.stale || x.froze).length, left: ms(v[0].frames.at(-1).t - v[0].arrive), back: v.length > 1 ? ms(v.at(-1).frames[0].t - v.at(-2).frames.at(-1).t) : null, ending: ending(id, log) };
};

const T = {
  async first() {
    const { page, call, errors } = await open(id);
    out.first = [];
    for (let k = 0; k < 4; k++) {
      const log = await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 8000); q.start(); q.enter(); await q.wait(${A + SEQ + 300}); q.leave(); await q.until(() => q.hov() === null); await q.wait(900); return q.stop(); })()`);
      out.first.push({ ...judge(id, visits(id, log)[0]), ending: ending(id, log) });
    }
    out.firstErrors = errors;
    await page.close();
  },
  async mouse() {
    const { page, call, errors, rest } = await open(id);
    out.mouse = [];
    const c = await page.center(`[data-hotspot="${id}"]`);
    for (const [at, gap] of [[-300, 40], [60, 60], [150, 100], [250, 60], [330, 200], [420, 100], [520, 140], [640, 60], [760, 200], [1100, 100], [1100, 350]]) {
      await rest();
      await page.eval("(window.__q.start(), 1)");
      await page.mouseMove(c.x, c.y);
      await call(`window.__q.until(() => window.__q.hov() === "${id}")`);
      await sleep(Math.max(0, A + at - 90));
      await page.mouseMove(4, 924);
      await call("window.__q.until(() => window.__q.hov() === null)");
      await sleep(gap);
      await page.mouseMove(c.x, c.y);
      await sleep(A + SEQ + 300);
      await page.mouseMove(4, 924);
      await sleep(1000);
      out.mouse.push(evalRun(await call("window.__q.stop()"), { at, gap }));
    }
    out.mouseErrors = errors;
    await page.close();
  },
  async grid() {
    const { page, call, errors } = await open(id);
    out.grid = [];
    const AT = id === "experience" ? [-300, 40, 110, 200, 320, 450, 580, 720, 800, 880, 960, 1060, 1400] : [-300, 40, 110, 170, 240, 320, 400, 480, 560, 640, 740, 860, 1300];
    for (const at of AT) for (const gap of [0, 20, 50, 100, 200, 350, 450]) out.grid.push(evalRun(await call(`window.__q.run(${at}, ${gap})`), { at, gap }));
    out.gridErrors = errors;
    await page.close();
  },
  async sequences() {
    const { page, call, errors } = await open(id);
    out.sequences = [];
    const end = `q.enter(); await q.wait(${A + SEQ + 300}); q.leave();`;
    const Q = [
      ...[[A + 60, 60], [A + 150, 120], [A + 250, 30], [A + 350, 160], [A + 450, 90], [A + 600, 250], [A + 1100, 120], [300, 80]].map(([a, b]) => [`${id} -> ${via} -> ${id}`, a, b, `q.enter(); await q.wait(${a}); q.leave(); q.enter("${via}"); await q.wait(${b}); q.leave("${via}"); ${end}`]),
      ...[[60, 40], [200, 30], [300, 90], [420, 150], [560, 60]].map(([a, b]) => ["four returns in a row", a, b, `for (let k = 0; k < 4; k++) { q.enter(); await q.wait(${A + a}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${b}); } ${end}`]),
      ...[[180, 60], [300, 200], [420, 350], [900, 150]].map(([a, b]) => ["left during the second charge", a, b, `q.enter(); await q.wait(${A + a}); q.leave(); await q.until(() => q.hov() === null); await q.wait(60); q.enter(); await q.wait(${b}); q.leave(); await q.until(() => q.hov() === null); await q.wait(40); ${end}`]),
      ...[[100, 20], [300, 60], [A - 130, 5]].map(([a, b]) => ["left before any arrival", a, b, `q.enter(); await q.wait(${a}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${b}); ${end}`]),
    ];
    for (const [name, a, b, body] of Q) out.sequences.push(evalRun(await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 8000); q.start(); ${body} await q.until(() => q.hov() === null); await q.wait(950); return q.stop(); })()`), { name, args: [a, b] }));
    out.sequencesErrors = errors;
    await page.close();
  },
  /** Escape while charging and while the sequence runs, a finished selection, Back to Lab, direct link. */
  async edge() {
    const { page, call, errors, rest } = await open(id);
    const c = await page.center(`[data-hotspot="${id}"]`);
    out.escape = [];
    for (const [click, esc] of [[200, 100], [A - 100, 250], [A + 80, 150], [A + 180, 200], [A + 300, 250], [A + 420, 200], [A + SEQ + 300, 400]]) {
      await rest();
      await page.eval("(window.__q.start(), 1)");
      await page.mouseMove(c.x, c.y);
      await sleep(click);
      await page.click(c.x, c.y);
      await page.mouseMove(4, 924);
      await sleep(esc);
      await page.key("Escape", "Escape", 27);
      await sleep(A + SEQ + 400);
      await page.eval("(document.activeElement.blur(), 1)");
      await sleep(1000);
      const log = await call("window.__q.stop()");
      const v = visits(id, log).map((x) => judge(id, x));
      out.escape.push({ click, esc, visits: v.length, ...v.at(-1), ending: ending(id, log) });
    }
    // Keyboard: Tab, Enter, Escape (finished): stays lit, one sequence only.
    await rest();
    const lights = (log) => Object.fromEntries(Object.keys(STATIONS[id].lights).map((k) => [k, log.filter((f) => f.lights[k] > 0.02).length]));
    const min = (log) => Object.fromEntries(STATIONS[id].nums.map((n) => [n, Math.min(...log.map((f) => f.nums[n]))]));
    const rec = async (act, t) => {
      await page.eval("(window.__q.start(), 1)");
      await act();
      await sleep(t);
      const log = await call("window.__q.stop()");
      const e = log.at(-1);
      return { min: min(log), lights: lights(log), pulse: log.filter((f) => f.pulse > 0.02).length, end: [e.hover, e.sel, ...Object.values(e.nums), e.stable] };
    };
    const tab = async () => {
      for (let i = 0; i < 40; i++) {
        await page.key("Tab", "Tab", 9);
        if (await page.eval(`document.activeElement?.id === "station-${id}-trigger"`)) return;
      }
    };
    out.keyboard = { focus: await rec(tab, A + SEQ + 400), enter: await rec(() => page.key("Enter", "Enter", 13), 1500), escape: await rec(() => page.key("Escape", "Escape", 27), A + SEQ + 300) };
    out.keyboard.focusBack = await page.eval(`document.activeElement?.id`);
    await page.eval("(document.activeElement.blur(), 1)");
    await rest();
    // The pointer over it all the while; then the browser's Back.
    await page.mouseMove(c.x, c.y);
    await sleep(A + SEQ + 300);
    await page.click(c.x, c.y);
    await sleep(1200);
    out.escapePointerOver = await rec(() => page.key("Escape", "Escape", 27), A + SEQ + 300);
    await page.mouseMove(4, 924);
    await page.eval("(document.activeElement.blur(), 1)");
    await rest();
    await page.mouseMove(c.x, c.y);
    await sleep(A + SEQ + 300);
    await page.click(c.x, c.y);
    await sleep(1200);
    await page.mouseMove(4, 924);
    await sleep(200);
    out.browserBack = await rec(() => page.eval("(history.back(), 1)"), A + SEQ + 300);
    await page.eval("(document.activeElement.blur(), 1)");
    await rest();
    // Back to Lab with the mouse.
    await page.mouseMove(c.x, c.y);
    await sleep(A + SEQ + 300);
    await page.click(c.x, c.y);
    await sleep(1200);
    const b = await page.center(`[data-station-panel="${id}"] button[aria-keyshortcuts="Escape"]`);
    out.backToLab = await rec(() => page.click(b.x, b.y), 1500);
    await page.mouseMove(4, 924);
    await page.eval("(document.activeElement.blur(), 1)");
    await rest();
    out.backToLab.rest = await page.eval("window.__q.rest()");
    out.edgeErrors = errors;
    await page.close();
    // Direct link: powered at once; after Escape and leaving, a quick return.
    const D = await open(id, `/lab-v2?station=${id}`);
    await D.page.eval("(window.__q.start(), 1)");
    await sleep(700);
    const log = await D.call("window.__q.stop()");
    await D.page.key("Escape", "Escape", 27);
    await sleep(A + SEQ + 300);
    await D.page.eval("(document.activeElement.blur(), 1)");
    await D.rest();
    out.direct = { powered: log.every((f) => Object.values(f.nums).every((v) => v === 1) && f.stable === 1), lights: lights(log), rest: await D.page.eval("window.__q.rest()"), quickReturn: (({ bad, premature, stale, froze, powered }) => ({ bad, premature, stale, froze, powered }))(evalRun(await D.call("window.__q.run(320, 60)"), {})), errors: D.errors };
    await D.page.close();
  },
  async reduced() {
    const { page, call, errors } = await open(id, "/lab-v2", { reducedMotion: true });
    out.reduced = [];
    const cls = STATIONS[id].cls;
    for (const [on, gap] of [[60, 5], [120, 40], [300, 60], [300, 140], [600, 250]]) {
      const log = await call(`(async () => { const q = window.__q; q.start(); q.enter(); await q.wait(${on}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${gap}); q.enter(); await q.wait(800); q.leave(); await q.until(() => q.hov() === null); await q.wait(700); return q.stop(); })()`);
      const drawn = await page.eval(`[".${cls}-gate", ".${cls}-pulse"].filter((s) => getComputedStyle(document.querySelector(s)).display !== "none")`);
      const p = log.filter((f) => f.hover === id).at(-1), e = log.at(-1);
      out.reduced.push({ on, gap, drawn, powered: Object.values(p.nums).every((v) => v === 1) && p.stable === 1, rest: Object.values(e.nums).every((v) => v === 0) && e.stable === 0 });
    }
    out.reducedErrors = errors;
    await page.close();
  },
};

for (const k of only.length ? only : Object.keys(T)) {
  await T[k]();
  writeFileSync(join(HERE, `qr-${id}-${label}.json`), JSON.stringify(out) + "\n");
}
console.log(`== ${id} ${label}`);
if (out.first) for (const r of out.first) console.log("first", JSON.stringify({ times: r.times, stableAt: r.stableAt, bad: r.bad, rest: r.ending.rest }));
for (const k of ["mouse", "grid", "sequences", "escape"])
  if (out[k]) {
    console.log(`# ${k}`, JSON.stringify(tally(id, out[k])), "errors", JSON.stringify(out[k + "Errors"] ?? out.edgeErrors ?? []));
    for (const r of out[k].filter((r) => r.bad || (r.ending && !r.ending.rest) || r.others).slice(0, k === "grid" ? 8 : 14)) console.log("   ", JSON.stringify({ at: r.at, gap: r.gap, name: r.name, args: r.args, click: r.click, esc: r.esc, light: r.light, pulse: r.pulse, held: r.held, atArrival: r.atArrival, frozen: r.frozen, fp: r.frozenPulse, powered: r.powered, kept: r.kept, others: r.others, rest: r.ending.rest }));
  }
for (const k of ["keyboard", "escapePointerOver", "browserBack", "backToLab", "direct"]) if (out[k]) console.log(`# ${k}`, JSON.stringify(out[k]));
if (out.reduced) console.log("# reduced", JSON.stringify(out.reduced));
process.exit(0);
