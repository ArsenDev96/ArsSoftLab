// node summarize.mjs <results.json> [metrics]
import { readFileSync } from "node:fs";
const [file, metricsArg] = process.argv.slice(2);
const { results } = JSON.parse(readFileSync(file, "utf8"));
const METRICS = (metricsArg ?? "responseEnd,dcl,hydrLink,load,fcp,lcp").split(",");
const stats = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return "—";
  const med = v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
  return `${Math.round(med)} [${v[0]}–${v.at(-1)}] ±${Math.round(sd)}`;
};
const conds = [...new Set(results.map((r) => r.cond))];
const routes = [...new Set(results.map((r) => r.route))];
for (const c of conds) {
  console.log(`\n## ${c}   (median [min–max] ±sd, ms from navigation start)`);
  console.log(["route", ...(c === "cold" ? ["launchMs"] : []), ...METRICS, "fcp-load gap", "lcpEl"].join(" | "));
  for (const r of routes) {
    const rows = results.filter((x) => x.cond === c && x.route === r);
    if (!rows.length) continue;
    const els = [...new Set(rows.map((x) => x.lcpEl))].join(", ");
    console.log([r, ...(c === "cold" ? [stats(rows.map((x) => x.launchMs))] : []), ...METRICS.map((m) => stats(rows.map((x) => x[m]))), stats(rows.map((x) => x.fcp - Math.max(x.load, x.hydrLink ?? 0))), els].join(" | "));
  }
}
const lt = results.filter((r) => r.longtasks.length);
console.log(`\nruns with any long task: ${lt.length} of ${results.length}; pre-FCP long-task ms (max): ${Math.max(...results.map((r) => r.preFcpLongMs))}`);
const img = (r) => r.res.img ?? { n: 0, bytes: 0, lastEnd: null };
for (const route of routes) {
  const x = results.find((r) => r.route === route && r.cond === "cold");
  console.log(`${route}: html ${x.htmlBytes} B transfer, dom ${x.domNodes} nodes, img ${img(x).n} req / ${Math.round(img(x).bytes / 1024)} KB, js ${x.res.js?.n} / ${Math.round((x.res.js?.bytes ?? 0) / 1024)} KB, css ${x.res.css?.n} / ${Math.round((x.res.css?.bytes ?? 0) / 1024)} KB, font ${x.res.font?.n ?? 0}`);
}
