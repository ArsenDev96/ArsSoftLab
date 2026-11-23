// M1.4I.1B probe: Engineering's quick return, frame by frame, against the spark's real start. Dev server on :3002.
//   node docs/m1.4i1/work/eng-return.mjs <label> [grid|mouse|sequences|first ...]   -> eng-<label>.json
// Arrival = the spark's own animation start (EnergySurge, read from the page) + 620 ms.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE = process.env.BASE || "http://localhost:3002";
const [label = "run", ...only] = process.argv.slice(2);
export const ARRIVE = 620;

// One frame's Engineering state. Effective opacities: what can actually be seen.
export const LIB = `(() => {
  const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
  const op = (e) => (getComputedStyle(e).visibility === "hidden" ? 0 : +getComputedStyle(e).opacity);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  window.__q = {
    sample() {
      const root = $(".eng-v2"), c = getComputedStyle(root);
      const eb = Array.from({ length: 11 }, (_, k) => r3(+c.getPropertyValue("--eb" + k)));
      const caps = $(".eng-caps"), co = op(caps);
      const box = $(".eng-shimmer").getBoundingClientRect(), line = $(".eng-shimmer-line").getBoundingClientRect();
      const inBox = line.bottom > box.top + 0.5 && line.top < box.bottom - 0.5;
      const group = $('[data-surge="engineering"]');
      const mover = group.querySelector("[data-surge-mover]").getAnimations().at(-1);
      const pw = $$('.lab-power-dim[data-power="engineering"]').map((e) => +getComputedStyle(e).getPropertyValue("--pw"));
      return {
        t: document.timeline.currentTime,
        hover: $("[data-lab-hover]")?.dataset.labHover ?? null, sel: $("[data-lab-selected]")?.dataset.labSelected ?? null,
        spark: mover ? mover.startTime : null,
        es: r3(+c.getPropertyValue("--es")), ef: r3(+c.getPropertyValue("--ef")), ed: r3(+c.getPropertyValue("--ed")), eb,
        band: r3(op($(".eng-scan-band"))), caps: co ? r3(co * Math.max(...[...caps.querySelectorAll("span")].map(op))) : 0,
        pulse: r3(Math.max(...$$(".eng-pulse").map(op))), shimmer: inBox ? r3(op($(".eng-shimmer"))) : 0,
        off: r3(op($(".eng-screen-off"))), shade: r3(op($(".eng-scan-shade"))),
        stable: getComputedStyle($('[data-eng-swap="stable"]')).visibility === "visible" ? 1 : 0,
        pw: r3(Math.max(...pw)), pwAll: pw.map(r3),
        lift: getComputedStyle($('.lab-lift[data-lift="playground"]')).transform !== "none" ? 1 : 0,
      };
    },
    log: [], on: false,
    start() { this.log = []; this.on = true; const id = (this.id = (this.id ?? 0) + 1); const f = () => { if (!this.on || this.id !== id) return; this.log.push(this.sample()); requestAnimationFrame(f); }; requestAnimationFrame(f); },
    stop() { this.on = false; return this.log; },
    ev(type, id) { $('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse", relatedTarget: null })); },
    enter(id = "engineering") { this.ev("pointerover", id); }, leave(id = "engineering") { this.ev("pointerout", id); },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    hov: () => $("[data-lab-hover]")?.dataset.labHover ?? null,
    async until(cond, ms = 5000) { const t = performance.now(); while (performance.now() - t < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 4)); } return false; },
    rest() { const s = this.sample(); return s.hover === null && s.sel === null && s.es === 0 && s.ef === 0 && s.eb.every((b) => b === 0) && s.pw === 0 && s.off === 0.68 && s.shade === 0 && s.band === 0 && s.caps === 0; },
    // Leave \`at\` ms after the first arrival, come back \`gap\` ms after the hover has dropped, stay, leave.
    async run(at, gap) {
      await this.until(() => this.rest(), 6000);
      this.start();
      this.enter();
      await this.until(() => this.hov() === "engineering");
      const h0 = performance.now();
      await this.wait(Math.max(0, ${ARRIVE} + at - 90));   // the hover drops 90 ms (the grace) after leaving
      this.leave();
      await this.until(() => this.hov() === null);
      await this.wait(gap);
      this.enter();
      await this.until(() => this.hov() === "engineering");
      await this.wait(${ARRIVE} + 1000);
      this.leave();
      await this.until(() => this.hov() === null);
      await this.wait(700);
      return this.stop();
    },
  };
  return 1;
})()`;

/** Split a log into the visits to Engineering (contiguous frames with it hovered and not selected). */
export function visits(log) {
  const out = [];
  let last = null; // when the previous visit ended
  for (const s of log) {
    const on = s.hover === "engineering" && s.sel !== "engineering";
    if (s.sel === "engineering") last = s.t; // powered by its selection until then
    // A return within one frame leaves no frame without the hover: the new spark tells it apart.
    const cur = out.at(-1);
    if (on && cur?.open && s.spark !== null && cur.spark !== undefined && s.spark !== cur.spark) {
      cur.open = false;
      last = cur.frames.at(-1).t;
    }
    if (on && !out.at(-1)?.open) out.push({ open: true, frames: [] });
    if (on && s.spark !== null) out.at(-1).spark = s.spark;
    if (on) out.at(-1).frames.push(s);
    else if (out.length) {
      if (out.at(-1).open && s.sel !== "engineering") last = s.t;
      out.at(-1).open = false;
    }
    if (on && out.at(-1).since === undefined) out.at(-1).since = last;
  }
  for (const v of out) v.arrive = (v.frames.find((f) => f.spark !== null)?.spark ?? v.frames[0].t) + ARRIVE;
  return out;
}

const VIS = 0.02; // effective opacity that counts as visible
const RUN_BACK = 400 + 35; // the leave's longest transition, and two frames
const up = (f) => f.ef > 0.02 || f.off < 0.66 || (f.shade > VIS && f.es > 0.02) || f.eb.some((b) => b > 0.02);
const ms = (a) => (a === undefined || a === null ? null : Math.round(a));

/** One visit: what showed before the arrival, and how the sequence ran after it. */
export function judge(v) {
  const before = v.frames.filter((f) => f.t < v.arrive - 1);
  const after = v.frames.filter((f) => f.t >= v.arrive - 1);
  const dur = (pred) => before.filter(pred).length;
  const r = {
    framesBefore: before.length,
    scan: dur((f) => f.band > VIS), caps: dur((f) => f.caps > VIS), pulse: dur((f) => f.pulse > VIS), shimmer: dur((f) => f.shimmer > VIS),
    // The display or chart above standby: `tail` while the leave's own 400 ms run-back is finishing,
    // `held` after it (a level of the previous cycle kept through the charge).
    tail: dur((f) => up(f) && v.since !== null && f.t - v.since <= RUN_BACK),
    held: dur((f) => up(f) && !(v.since !== null && f.t - v.since <= RUN_BACK)),
    // Anything that comes up before the arrival.
    rose: 0,
    heldAtArrival: null,
  };
  for (let i = 1; i < before.length; i++) {
    const a = before[i - 1], b = before[i];
    if (b.es > a.es + 0.002 || b.ef > a.ef + 0.002 || b.eb.some((x, k) => x > a.eb[k] + 0.002) || b.off < a.off - 0.002) r.rose++;
  }
  const last = before.at(-1);
  if (last) r.heldAtArrival = { es: last.es, ef: last.ef, bars: +last.eb.reduce((x, y) => x + y, 0).toFixed(2), off: last.off, shade: last.shade };
  const first = (pred) => { const f = after.find(pred); return f ? ms(f.t - v.arrive) : null; };
  const lastOf = (pred) => { const f = after.filter(pred).at(-1); return f ? ms(f.t - v.arrive) : null; };
  r.after = {
    scanFrom: after.find((f) => f.band > VIS)?.es ?? null,
    scanFirst: first((f) => f.band > VIS), scanLast: lastOf((f) => f.band > VIS),
    capsFirst: first((f) => f.caps > VIS), capsLast: lastOf((f) => f.caps > VIS),
    stableAt: first((f) => f.stable === 1),
    esDone: first((f) => f.es === 1), barsDone: first((f) => f.eb.every((b) => b === 1)),
    frozenPulse: after.filter((f, i) => i && f.pulse > VIS && f.pulse === after[i - 1].pulse && f.pwAll.every((p, k) => p === after[i - 1].pwAll[k])).length,
    // Scan shown while it isn't moving: a line left over from before.
    frozenScan: after.filter((f, i) => i && f.band > VIS && f.es === after[i - 1].es && f.t - v.arrive < 85).length,
  };
  const end = v.frames.at(-1);
  r.powered = !!(end && end.es === 1 && end.ef === 1 && end.eb.every((b) => b === 1) && end.stable === 1 && end.off === 0 && end.band === 0 && end.caps === 0 && end.pw === 1);
  // Back from a selection that had finished: it never lost power, so nothing is replayed.
  r.kept = before.length > 0 && before.every((f) => f.es === 1 && f.ef === 1 && f.off === 0 && f.eb.every((b) => b === 1)) && r.scan + r.caps + r.pulse === 0 && !v.frames.some((f) => f.band > VIS || f.caps > VIS);
  if (r.kept) r.held = 0;
  r.premature = r.scan + r.caps + r.pulse + r.shimmer + r.held + r.rose > 0;
  return r;
}

/** After the last visit: nothing lights, and everything is at rest at the end. */
export function ending(log) {
  const i = log.findLastIndex((s) => s.hover === "engineering");
  const tail = log.slice(i + 1), end = tail.at(-1);
  let rose = 0;
  for (let k = 1; k < tail.length; k++) if (tail[k].es > tail[k - 1].es + 0.002 || tail[k].ef > tail[k - 1].ef + 0.002 || tail[k].eb.some((x, j) => x > tail[k - 1].eb[j] + 0.002)) rose++;
  const rest = !!end && end.es === 0 && end.ef === 0 && end.eb.every((b) => b === 0) && end.off === 0.68 && end.shade === 0 && end.band === 0 && end.caps === 0 && end.pw === 0;
  return { rose, rest };
}

export async function open(path = "/lab-v2", opts = {}) {
  const page = await launch({ width: 1648, height: 928, gpu: true, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) errors.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
  });
  await page.goto(BASE + path);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924);
  await sleep(1500);
  await page.eval(LIB);
  const call = async (expr) => JSON.parse(await page.eval(`(async () => JSON.stringify((await (${expr})) ?? null))()`));
  return { page, errors, call };
}

const out = {};
const bad = (r) => r.premature || !r.powered;

const S = {
  /** The sequence on an ordinary first visit (the reference for "after the arrival"). */
  async first() {
    const { page, errors, call } = await open();
    out.first = [];
    for (let k = 0; k < 4; k++) {
      const log = await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 6000); q.start(); q.enter(); await q.wait(${ARRIVE} + 1200); q.leave(); await q.until(() => q.hov() === null); await q.wait(900); return q.stop(); })()`);
      out.first.push({ ...judge(visits(log)[0]), ending: ending(log), frames: log.length });
    }
    out.firstErrors = errors;
    await page.close();
  },
  /** Every leaving time against every gap. */
  async grid() {
    const AT = [-500, -250, -60, 0, 40, 100, 160, 250, 350, 450, 560, 700, 1200];
    const GAP = [5, 40, 80, 130, 180, 240, 300, 360, 420, 500];
    const { page, errors, call } = await open();
    out.grid = [];
    for (const at of AT)
      for (const gap of GAP) {
        const log = await call(`window.__q.run(${at}, ${gap})`);
        const v = visits(log);
        const r = { at, gap, visits: v.length, first: judge(v[0]).premature, ...judge(v.at(-1)), ending: ending(log) };
        // What was measured, not only what was asked for.
        r.left = ms(v[0].frames.at(-1).t - v[0].arrive);
        r.back = ms(v.at(-1).frames[0].t - v[0].frames.at(-1).t);
        out.grid.push(r);
      }
    out.gridErrors = errors;
    await page.close();
  },
  /** The real pointer. */
  async mouse() {
    const { page, errors, call } = await open();
    out.mouse = [];
    const c = await page.center('[data-hotspot="engineering"]');
    for (const [at, gap] of [[60, 60], [150, 140], [250, 60], [250, 140], [250, 220], [350, 140], [450, 100], [560, 140], [800, 200], [-200, 40]]) {
      for (let i = 0; i < 80 && !(await page.eval("window.__q.rest()")); i++) await sleep(80);
      await page.eval("(window.__q.start(), 1)");
      await page.mouseMove(c.x, c.y);
      await call(`window.__q.until(() => window.__q.hov() === "engineering")`);
      await sleep(Math.max(0, ARRIVE + at - 90));
      await page.mouseMove(4, 924);
      await call(`window.__q.until(() => window.__q.hov() === null)`);
      await sleep(gap);
      await page.mouseMove(c.x, c.y);
      await sleep(ARRIVE + 1100);
      await page.mouseMove(4, 924);
      await sleep(900);
      const log = await call("window.__q.stop()");
      const v = visits(log);
      out.mouse.push({ at, gap, visits: v.length, ...judge(v.at(-1)), ending: ending(log), left: ms(v[0].frames.at(-1).t - v[0].arrive), back: ms(v.at(-1).frames[0].t - v[0].frames.at(-1).t) });
    }
    out.mouseErrors = errors;
    await page.close();
  },
  /** Through another station, several returns in a row, and before any arrival. */
  async sequences() {
    const { page, errors, call } = await open();
    out.sequences = [];
    const Q = {
      "engineering -> educational -> engineering": (d1, d2) => `q.enter(); await q.wait(${d1}); q.leave(); q.enter("educational"); await q.wait(${d2}); q.leave("educational"); q.enter(); await q.wait(${ARRIVE} + 1100); q.leave();`,
      "four returns in a row": (d1, d2) => `for (let k = 0; k < 4; k++) { q.enter(); await q.wait(${ARRIVE} + ${d1}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${d2}); } q.enter(); await q.wait(${ARRIVE} + 1100); q.leave();`,
      "left during the second charge": (d1, d2) => `q.enter(); await q.wait(${ARRIVE} + ${d1}); q.leave(); await q.until(() => q.hov() === null); await q.wait(60); q.enter(); await q.wait(${d2}); q.leave(); await q.until(() => q.hov() === null); await q.wait(40); q.enter(); await q.wait(${ARRIVE} + 1100); q.leave();`,
      "left before any arrival": (d1, d2) => `q.enter(); await q.wait(${d1}); q.leave(); await q.until(() => q.hov() === null); await q.wait(${d2}); q.enter(); await q.wait(${ARRIVE} + 1100); q.leave();`,
    };
    const ARGS = {
      "engineering -> educational -> engineering": [[800, 60], [800, 160], [900, 30], [950, 120], [1000, 250], [1150, 90], [1600, 120], [400, 100]],
      "four returns in a row": [[150, 30], [250, 90], [350, 150], [60, 40]],
      "left during the second charge": [[180, 60], [250, 200], [300, 420], [700, 150]],
      "left before any arrival": [[100, 20], [300, 60], [500, 20], [525, 5]],
    };
    for (const [name, body] of Object.entries(Q))
      for (const [a, b] of ARGS[name]) {
        const log = await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 6000); q.start(); ${body(a, b)} await q.until(() => q.hov() === null); await q.wait(800); return q.stop(); })()`);
        const v = visits(log).map(judge);
        out.sequences.push({ name, args: [a, b], visits: v.length, premature: v.filter((x) => x.premature).length, last: v.at(-1), detail: v.map((x) => ({ scan: x.scan, caps: x.caps, pulse: x.pulse, shimmer: x.shimmer, held: x.held, tail: x.tail, rose: x.rose })), ending: ending(log) });
      }
    out.sequencesErrors = errors;
    await page.close();
  },
};

export async function main() {
  for (const k of only.length ? only : Object.keys(S)) {
    await S[k]();
    writeFileSync(join(HERE, `eng-${label}.json`), JSON.stringify(out) + "\n");
  }
  if (out.first) for (const r of out.first) console.log("first", JSON.stringify(r));
  for (const k of ["grid", "mouse"])
    if (out[k]) {
      const g = out[k];
      const n = (f) => g.filter(f).length;
      console.log(`\n# ${k}: ${g.length} runs | premature ${n((r) => r.premature)} | scan ${n((r) => r.scan)} caps ${n((r) => r.caps)} pulse ${n((r) => r.pulse)} shimmer ${n((r) => r.shimmer)} held ${n((r) => r.held)} (run-back finishing ${n((r) => r.tail)}) rose ${n((r) => r.rose)} | frozen scan after arrival ${n((r) => r.after.frozenScan)} | frozen pulse ${n((r) => r.after.frozenPulse > 1)} | scan not from the top ${n((r) => r.after.scanFrom > 0.2)} | no scan ${n((r) => r.after.scanFirst === null)} | no caps ${n((r) => r.after.capsFirst === null)} | not powered ${n((r) => !r.powered)} | not at rest ${n((r) => !r.ending.rest)} | rose after leaving ${n((r) => r.ending.rose)} | first visit premature ${n((r) => r.first)} | errors ${JSON.stringify(out[k + "Errors"])}`);
      for (const r of g.filter((r) => bad(r) || !r.ending.rest).slice(0, 60)) console.log(`  at ${r.at} gap ${r.gap} (left ${r.left}, back ${r.back}) scan ${r.scan} caps ${r.caps} pulse ${r.pulse} shim ${r.shimmer} held ${r.held} tail ${r.tail} rose ${r.rose} /${r.framesBefore} atArrival ${JSON.stringify(r.heldAtArrival)} from ${r.after.scanFrom} frozen ${r.after.frozenScan} powered ${r.powered} rest ${r.ending.rest}`);
    }
  if (out.sequences) {
    console.log(`\n# sequences: ${out.sequences.length} runs, premature ${out.sequences.filter((s) => s.premature).length}, not powered ${out.sequences.filter((s) => !s.last.powered).length}, not at rest ${out.sequences.filter((s) => !s.ending.rest).length} errors ${JSON.stringify(out.sequencesErrors)}`);
    for (const s of out.sequences) console.log(`  ${s.name} ${s.args} visits ${s.visits} premature ${s.premature} powered ${s.last.powered} rest ${s.ending.rest} ${s.premature ? JSON.stringify(s.detail) : ""}`);
  }
  process.exit(0);
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1].replace(/\//g, "\\")) await main();
else if (process.argv[1]?.endsWith("eng-return.mjs")) await main();
