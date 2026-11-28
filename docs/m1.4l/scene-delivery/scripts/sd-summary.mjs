// M1.4R.1: summary of sd-measure.mjs output. node sd-summary.mjs <delivery.json>
// Median [min–max] and IQR per cell. "Scene visible" is clamped to no earlier than FCP (Lite's plate can finish
// decoding before the first frame; it cannot be seen before it).
import { readFileSync } from "node:fs";
const { results } = JSON.parse(readFileSync(process.argv[2], "utf8"));
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * p; return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i - Math.floor(i)); };
const st = (xs) => { xs = xs.filter((x) => typeof x === "number"); if (!xs.length) return "—"; const r = Math.round; return `${r(q(xs, 0.5))} [${r(Math.min(...xs))}–${r(Math.max(...xs))}] IQR ${r(q(xs, 0.75) - q(xs, 0.25))}`; };
const med = (xs) => Math.round(q(xs.filter((x) => typeof x === "number"), 0.5));
const cells = [...new Set(results.map((r) => `${r.route}|${r.net}|${r.visit}`))];
console.log("| Route | Network | Visit | n | FCP | Scene visible | Scene fully visible | Scene ready (assets + gate) | Image delivery end | Scene requests | Network transfers: 200 / 304 | Disk-cache hits | Memory hits | Network bytes |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const c of cells) {
  const [route, net, visit] = c.split("|");
  const rs = results.filter((r) => r.route === route && r.net === net && r.visit === visit);
  const vis = rs.map((r) => Math.max(r.sceneVisible ?? 0, r.fcp ?? 0));
  const full = rs.map((r) => Math.max(r.sceneFull ?? 0, r.fcp ?? 0));
  console.log(`| ${route} | ${net.replace("-", " Mbps / ")} ms | ${visit} | ${rs.length} | ${st(rs.map((r) => r.fcp))} | ${st(vis)} | ${st(full)} | ${st(rs.map((r) => Math.max(r.sceneReady, r.fcp)))} | ${st(rs.map((r) => r.imageDeliveryEnd))} | ${med(rs.map((r) => r.sceneRequests))} | ${med(rs.map((r) => r.downloaded200))} / ${med(rs.map((r) => r.revalidated304))} | ${med(rs.map((r) => r.diskHits))} | ${med(rs.map((r) => r.memoryHits))} | ${Math.round(med(rs.map((r) => r.networkBytes)) / 1024)} KB |`);
}
const nullGate = results.filter((r) => r.route === "cinematic" && (r.gateFirst == null || r.gateFull == null)).length;
console.log(`\nCinematic trials without a gate reading: ${nullGate}. Gate opened by fallback (gateStyle >= 3900 ms): ${results.filter((r) => r.gateStyle >= 3900).length}.`);
for (const c of cells.filter((x) => x.startsWith("cinematic"))) { const [route, net, visit] = c.split("|"); const rs = results.filter((r) => r.route === route && r.net === net && r.visit === visit); console.log(`gate style inserted, ${net} ${visit}: ${st(rs.map((r) => r.gateStyle))}`); }
