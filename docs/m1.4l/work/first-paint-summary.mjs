// M1.4Q: median, min, max and spread of first-paint.mjs results.
//   node docs/m1.4l/work/first-paint-summary.mjs results/first-paint-cold.json [more.json ...]
import { readFileSync } from "node:fs";

const files = process.argv.slice(2);
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p; const lo = Math.floor(i); return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo); };
const stat = (xs) => {
  xs = xs.filter((x) => typeof x === "number");
  if (!xs.length) return "—";
  const r = (x) => Math.round(x);
  return `${r(q(xs, 0.5))} [${r(Math.min(...xs))}–${r(Math.max(...xs))}] IQR ${r(q(xs, 0.75) - q(xs, 0.25))}`;
};
const METRICS = {
  launch: (m) => m.launch?.toPageReady,
  requestStart: (m) => m.nav.requestStart,
  ttfb: (m) => m.nav.ttfb,
  responseEnd: (m) => m.nav.responseEnd,
  domInteractive: (m) => m.nav.domInteractive,
  firstRaf: (m) => m.firstRaf,
  fcp: (m) => m.fcp,
  "fcp-ttfb": (m) => (m.fcp != null && m.nav.ttfb != null ? m.fcp - m.nav.ttfb : null),
  lcp: (m) => m.lcp,
  sceneVisible: (m) => m.sceneFirstVisible ?? m.litePlateDrawnAt,
  sceneFull: (m) => m.sceneFullyVisible,
  load: (m) => m.nav.load,
};
for (const f of files) {
  const r = JSON.parse(readFileSync(f, "utf8"));
  console.log(`\n# ${f}: ${r.plan}, n=${r.n}, ${r.chrome}, ${JSON.stringify(r.gpu)}`);
  for (const [route, conds] of Object.entries(r.runs)) {
    for (const [cond, runs] of Object.entries(conds)) {
      console.log(`\n${route} / ${cond} (${runs.length} runs)`);
      for (const [k, fn] of Object.entries(METRICS)) {
        const s = stat(runs.map(fn));
        if (s !== "—") console.log(`  ${k.padEnd(15)} ${s}`);
      }
      const els = [...new Set(runs.map((m) => m.lcpEl))].join(", ");
      console.log(`  lcpElement      ${els}`);
    }
  }
}
