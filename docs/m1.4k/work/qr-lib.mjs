// M1.4I.1D: shared by the quick-return probes of Creative Studio, Educational and Experience. Dev server on :3002.
// Arrival = the spark's own animation start (EnergySurge, read from the page) + the station's travel time.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";

export const HERE = dirname(fileURLToPath(import.meta.url));
export const BASE = process.env.BASE || "http://localhost:3002";
export { sleep };
export const VIS = 0.02; // effective opacity that counts as visible

// nums: the sequence's numbers. lights: what only exists while the sequence runs forward: [selector, number, its delay after the arrival].
export const STATIONS = {
  creative: { arrive: 640, runBack: 420, seq: 900, via: "engineering", cls: "cre", nums: ["--cw", "--cs", "--cg"], lights: { warm: [".cre-warm", "--cw", 100], crest: [".cre-crest", "--cs", 150], glint: [".cre-glints", "--cg", 350] } },
  educational: { arrive: 460, runBack: 380, seq: 900, via: "playground", cls: "edu", nums: ["--gp", "--gs", "--go"], lights: { pool: [".edu-pulse-base", "--gp", 70], crest: [".edu-crest", "--gs", 120], orbit: [".edu-light", "--go", 200] } },
  experience: { arrive: 660, runBack: 520, seq: 1080, via: "educational", cls: "exp", nums: ["--xs"], lights: { trail: [".exp-light", "--xs", 30] } },
};

export const LIB = (id) => {
  const s = STATIONS[id];
  return `(() => {
  const $ = (q) => document.querySelector(q), $$ = (q) => [...document.querySelectorAll(q)];
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const op = (e) => { const c = getComputedStyle(e); return c.visibility === "hidden" || c.display === "none" ? 0 : +c.opacity; };
  const eff = (e, top) => { let o = 1; for (; e && e !== top; e = e.parentElement) o *= op(e); return r3(o); };
  const ID = ${JSON.stringify(id)}, NUMS = ${JSON.stringify(s.nums)}, LIGHTS = ${JSON.stringify(s.lights)};
  window.__q = {
    sample() {
      const root = $(".${s.cls}-v2"), c = getComputedStyle(root);
      const nums = {}, lights = {};
      for (const n of NUMS) nums[n] = r3(+c.getPropertyValue(n));
      for (const k in LIGHTS) lights[k] = eff($(LIGHTS[k][0]), root);
      const mover = $('[data-surge="' + ID + '"]').querySelector("[data-surge-mover]").getAnimations().at(-1);
      const pw = $$('.lab-power-dim[data-power="' + ID + '"]').map((e) => r3(+getComputedStyle(e).getPropertyValue("--pw")));
      const floor = $$(".${s.cls}-floor").map((e) => r3(+getComputedStyle(e).getPropertyValue("--pw")));
      const st = $('[data-${s.cls}-swap="stable"]'), sc = getComputedStyle(st);
      let shimmer = 0;
      const line = $(".edu-shimmer-line");
      if (ID === "educational" && line) { const off = parseFloat(getComputedStyle(line).strokeDashoffset); if (off < 90 && off > -2000) shimmer = r3(op($(".edu-shimmer"))); }
      return {
        t: document.timeline.currentTime,
        hover: $("[data-lab-hover]")?.dataset.labHover ?? null, sel: $("[data-lab-selected]")?.dataset.labSelected ?? null,
        spark: mover ? mover.startTime : null, nums, lights, pulse: r3(Math.max(0, ...$$(".${s.cls}-pulse").map(op))), shimmer,
        stable: sc.visibility === "hidden" ? 0 : r3(+sc.opacity), pw, floor,
      };
    },
    log: [], on: false, n: 0,
    start() { this.log = []; this.on = true; const n = ++this.n; const f = () => { if (!this.on || this.n !== n) return; this.log.push(this.sample()); requestAnimationFrame(f); }; requestAnimationFrame(f); },
    stop() { this.on = false; return this.log; },
    ev(type, id) { $('[data-hotspot="' + id + '"]').dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: "mouse", relatedTarget: null })); },
    enter(id = ID) { this.ev("pointerover", id); }, leave(id = ID) { this.ev("pointerout", id); },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
    hov: () => $("[data-lab-hover]")?.dataset.labHover ?? null,
    async until(cond, ms = 6000) { const t = performance.now(); while (performance.now() - t < ms) { if (cond()) return true; await new Promise((r) => setTimeout(r, 4)); } return false; },
    isRest(s) { return s.hover === null && s.sel === null && Object.values(s.nums).every((v) => v === 0) && s.pw.every((v) => v === 0) && s.floor.every((v) => v === 0) && s.pulse === 0 && Object.values(s.lights).every((v) => v === 0) && s.stable === 0; },
    rest() { return this.isRest(this.sample()); },
    // Leave \`at\` ms after the first arrival, come back \`gap\` ms after the hover dropped (0: in the same instant), stay, leave.
    async run(at, gap) {
      await this.until(() => this.rest(), 8000);
      this.start();
      this.enter();
      await this.until(() => this.hov() === ID);
      await this.wait(Math.max(0, ${s.arrive} + at - 90));
      if (gap === 0) {
        const back = new Promise((r) => { const mo = new MutationObserver(() => { if (this.hov() !== null) return; mo.disconnect(); this.enter(); r(1); }); mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-lab-hover"] }); });
        this.leave();
        await back;
      } else {
        this.leave();
        await this.until(() => this.hov() === null);
        await this.wait(gap);
        this.enter();
      }
      await this.until(() => this.hov() === ID);
      await this.wait(${s.arrive + s.seq + 250});
      this.leave();
      await this.until(() => this.hov() === null);
      await this.wait(850);
      return this.stop();
    },
  };
  return 1;
})()`;
};

/** Split a log into visits (hovered, not selected); a new spark also starts a new one (a return within one frame). */
export function visits(id, log) {
  const out = [];
  let last = null; // when the station was last powered by anything before this visit
  for (const s of log) {
    const on = s.hover === id && s.sel !== id;
    if (s.sel === id) last = s.t;
    const cur = out.at(-1);
    if (on && cur?.open && s.spark !== null && cur.spark !== undefined && s.spark !== cur.spark) {
      cur.open = false;
      last = cur.frames.at(-1).t;
    }
    if (on && !out.at(-1)?.open) out.push({ open: true, frames: [], since: last });
    if (on && s.spark !== null) out.at(-1).spark = s.spark;
    if (on) out.at(-1).frames.push(s);
    else if (out.length) {
      if (out.at(-1).open && s.sel !== id) last = s.t;
      out.at(-1).open = false;
    }
  }
  for (const v of out) v.arrive = (v.frames.find((f) => f.spark !== null)?.spark ?? v.frames[0].t) + STATIONS[id].arrive;
  return out;
}

const ms = (a) => (a === undefined || a === null ? null : Math.round(a));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** One visit: what showed before the arrival, and how the sequence ran after it. */
export function judge(id, v) {
  const S = STATIONS[id];
  const before = v.frames.filter((f) => f.t < v.arrive - 1), after = v.frames.filter((f) => f.t >= v.arrive - 1);
  const dur = (p) => before.filter(p).length;
  const up = (f) => Object.values(f.nums).some((x) => x > VIS);
  const inRunBack = (f) => v.since !== null && f.t - v.since <= S.runBack + 35;
  const r = { framesBefore: before.length, light: {}, pulse: dur((f) => f.pulse > VIS), shimmer: dur((f) => f.shimmer > VIS), tail: dur((f) => up(f) && inRunBack(f)), held: dur((f) => up(f) && !inRunBack(f)), rose: 0 };
  for (const k in S.lights) r.light[k] = dur((f) => f.lights[k] > VIS);
  for (let i = 1; i < before.length; i++) if (Object.keys(before[i].nums).some((n) => before[i].nums[n] > before[i - 1].nums[n] + 0.002)) r.rose++;
  r.atArrival = after.length ? (before.at(-1)?.nums ?? null) : null; // left before its arrival: nothing to judge there
  const part = (x) => x > VIS && x < 0.98;
  r.resumes = r.atArrival ? Object.keys(r.atArrival).filter((n) => part(r.atArrival[n])) : [];
  r.full = r.atArrival ? Object.keys(r.atArrival).filter((n) => r.atArrival[n] >= 0.98) : [];
  r.frozen = {};
  r.times = {};
  for (const k in S.lights) {
    const [, n, d] = S.lights[k];
    r.frozen[k] = after.filter((f, i) => i && f.lights[k] > VIS && f.nums[n] === after[i - 1].nums[n] && f.t - v.arrive < d - 8).length;
    const on = after.filter((f) => f.lights[k] > VIS);
    r.times[k] = on.length ? [ms(on[0].t - v.arrive), ms(on.at(-1).t - v.arrive)] : null;
  }
  r.frozenPulse = after.filter((f, i) => i && f.pulse > VIS && f.pulse === after[i - 1].pulse && same(f.pw, after[i - 1].pw)).length;
  r.stableAt = ms(after.find((f) => f.stable === 1)?.t - v.arrive);
  const end = v.frames.at(-1);
  r.powered = !!end && Object.values(end.nums).every((x) => x === 1) && end.pw.every((x) => x === 1) && end.stable === 1 && end.pulse === 0 && Object.values(end.lights).every((x) => x === 0);
  // Back from a selection that had finished: it never lost power, so nothing may be replayed.
  r.kept = before.length > 0 && before.every((f) => Object.values(f.nums).every((x) => x === 1)) && !v.frames.some((f) => Object.values(f.lights).some((x) => x > VIS));
  const lit = Object.values(r.light).reduce((a, b) => a + b, 0);
  r.premature = lit + r.pulse + r.shimmer + r.rose > 0;
  r.stale = !r.kept && (r.held > 0 || r.resumes.length > 0 || r.full.length > 0);
  r.froze = Object.values(r.frozen).some((x) => x > 1) || r.frozenPulse > 1;
  r.bad = r.premature || r.stale || r.froze || !r.powered;
  return r;
}

export function ending(id, log) {
  const tail = log.slice(log.findLastIndex((s) => s.hover === id) + 1), end = tail.at(-1);
  let rose = 0;
  for (let k = 1; k < tail.length; k++) if (Object.keys(tail[k].nums).some((n) => tail[k].nums[n] > tail[k - 1].nums[n] + 0.002)) rose++;
  const rest = !!end && end.hover === null && Object.values(end.nums).every((v) => v === 0) && end.pw.every((v) => v === 0) && end.floor.every((v) => v === 0) && end.pulse === 0 && end.stable === 0;
  return { rose, rest };
}

export async function open(id, path = "/lab-v2", opts = {}) {
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
  await page.eval(LIB(id));
  const call = async (expr) => JSON.parse(await page.eval(`(async () => JSON.stringify((await (${expr})) ?? null))()`));
  const rest = async () => {
    for (let i = 0; i < 120 && !(await page.eval("window.__q.rest()")); i++) await sleep(60);
  };
  return { page, errors, call, rest };
}

/** One line for a set of runs. */
export function tally(id, runs) {
  const n = (f) => runs.filter(f).length;
  const L = Object.keys(STATIONS[id].lights);
  return {
    runs: runs.length, bad: n((r) => r.bad), premature: n((r) => r.premature), lightBefore: Object.fromEntries(L.map((k) => [k, n((r) => r.light[k])])), pulseBefore: n((r) => r.pulse), shimmerBefore: n((r) => r.shimmer), rose: n((r) => r.rose),
    heldThroughCharge: n((r) => r.held), resumesPartWay: n((r) => r.resumes.length), litAtArrivalNoReplay: n((r) => r.full.length), frozenAfterArrival: Object.fromEntries(L.map((k) => [k, n((r) => r.frozen[k] > 1)])), frozenPulseAfter: n((r) => r.frozenPulse > 1),
    notPowered: n((r) => !r.powered), runBackFinishing: n((r) => r.tail), notAtRest: n((r) => r.ending && !r.ending.rest), roseAfterLeaving: n((r) => r.ending?.rose),
  };
}
