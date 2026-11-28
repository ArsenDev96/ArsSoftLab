// M1.4R.2: summary of sc-measure.mjs output, next to the M1.4R.1 audit's Cinematic cells.
//   node sc-summary.mjs <delivery.json> [<audit delivery.json>]
// Median [min–max] and IQR per cell. Scene times are clamped to no earlier than FCP.
import { readFileSync } from "node:fs";
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p; return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i)); };
const nums = (xs) => xs.filter((x) => typeof x === "number");
const st = (xs) => { xs = nums(xs); if (!xs.length) return "—"; const r = Math.round; return `${r(q(xs, 0.5))} [${r(Math.min(...xs))}–${r(Math.max(...xs))}] IQR ${r(q(xs, 0.75) - q(xs, 0.25))}`; };
const med = (xs) => Math.round(q(nums(xs), 0.5));
const row = (name, net, visit, rs) => `| ${name} | ${net.replace("-", " Mbps / ")} ms | ${visit} | ${rs.length} | ${st(rs.map((r) => r.fcp))} | ${st(rs.map((r) => Math.max(r.sceneVisible ?? 0, r.fcp ?? 0)))} | ${st(rs.map((r) => Math.max(r.sceneFull ?? 0, r.fcp ?? 0)))} | ${st(rs.map((r) => Math.max(r.sceneReady, r.fcp)))} | ${med(rs.map((r) => r.sceneRequests))} | ${med(rs.map((r) => r.downloaded200))} / ${med(rs.map((r) => r.revalidated304))} | ${med(rs.map((r) => r.diskHits))} | ${med(rs.map((r) => r.memoryHits))} | ${Math.round(med(rs.map((r) => r.networkBytes)) / 1024)} KB |`;

console.log("| Source | Network | Visit | n | FCP | Scene visible | Scene fully visible | Scene ready | Scene requests | Wire 200 / 304 | Disk hits | Memory hits | Network bytes |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|");
const { results } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const audit = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")).results.filter((r) => r.route === "cinematic") : [];
for (const net of ["50-20", "12-70"]) for (const visit of ["initial", "repeat"]) {
  for (const server of [...new Set(results.map((r) => r.server))]) { const rs = results.filter((r) => r.server === server && r.net === net && r.visit === visit); if (rs.length) console.log(row(`M1.4R.2 ${server}`, net, visit, rs)); }
  const a = audit.filter((r) => r.net === net && r.visit === visit); if (a.length) console.log(row("M1.4R.1 audit (proxy, headers unchanged)", net, visit, a));
  if (visit === "repeat") { const f = audit.filter((r) => r.net === net && r.visit === "repeat-fresh"); if (f.length) console.log(row("M1.4R.1 audit (proxy, all /scene/* rewritten)", net, "repeat-fresh", f)); }
}
const v2 = (rs) => `v2: ${med(rs.map((r) => r.v2Requests))} requests, ${med(rs.map((r) => r.v2DiskHits))} disk, ${med(rs.map((r) => r.v2Revalidated304))} × 304, ${med(rs.map((r) => r.v2Downloaded200))} × 200; Cache-Control seen: ${[...new Set(rs.flatMap((r) => r.v2CacheControl))].join(" / ")}`;
console.log("");
for (const net of ["50-20", "12-70"]) for (const visit of ["initial", "repeat"]) for (const server of [...new Set(results.map((r) => r.server))]) {
  const rs = results.filter((r) => r.server === server && r.net === net && r.visit === visit);
  if (rs.length) console.log(`${server} ${net} ${visit}: ${v2(rs)}; gate fallback (style ≥ 3900 ms) ${rs.filter((r) => r.gateStyle >= 3900).length}/${rs.length}; failed requests ${rs.reduce((s, r) => s + r.failed, 0)}; console errors/warnings ${rs.reduce((s, r) => s + r.errors.length, 0)}`);
}
const errs = [...new Set(results.flatMap((r) => r.errors))];
console.log(errs.length ? `\nMessages:\n  ${errs.join("\n  ")}` : "\nNo console errors, warnings or uncaught exceptions in any trial.");
