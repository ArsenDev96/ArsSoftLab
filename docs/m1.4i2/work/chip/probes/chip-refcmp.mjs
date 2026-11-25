import { readFileSync, existsSync } from "node:fs";
import { viewer } from "../../home/probes/px.mjs";
const J = (f) => JSON.parse(readFileSync(f));
const A = J("out/chiprefs-before.json"), B = J("out/chiprefs-after.json"), N = J("out/chiprefs-before2.json");
const d = (a, b) => { const k = {}; let n = 0, box = [1e9, 1e9, -1, -1]; a.forEach((r, j) => [...r].forEach((c, i) => { if (c !== b[j][i]) { n++; const q = c + ">" + b[j][i]; k[q] = (k[q] ?? 0) + 1; box = [Math.min(box[0], i), Math.min(box[1], j), Math.max(box[2], i), Math.max(box[3], j)]; } })); return n ? `${n} ${JSON.stringify(k)} box(px) ${box.map((v, i) => v + (i % 2 ? 290 : 1240)).join()}` : "0"; };
for (const p of ["v2", "home"]) {
  for (const k of Object.keys(A[p])) if (Array.isArray(A[p][k])) console.log(p, k, "after vs before:", d(A[p][k], B[p][k]), "| before vs before:", d(A[p][k], N[p][k]));
  console.log(p, "focusable", A[p].focusable, B[p].focusable, "markup same:", A[p].stationMarkup === B[p].stationMarkup, "noise", A[p].stationMarkup === N[p].stationMarkup, "css rule length", A[p].stationMarkup.length, B[p].stationMarkup.length);
  const strip = (s) => s.replace(/<style>.*?<\/style>/gs, "");
  console.log(p, "markup without <style> same:", strip(A[p].stationMarkup) === strip(B[p].stationMarkup));
}
const px = await viewer();
for (const p of ["v2", "home"]) for (const n of ["chip", "title"]) { for (const l of ["before", "before2", "after"]) await px.put(l, readFileSync(`cap/chip/${l}-${p}-${n}.png`).toString("base64")); console.log("pixels", p, n, "after vs before", JSON.stringify(await px.diff("before", "after")), "noise", JSON.stringify(await px.diff("before", "before2"))); }
await px.close(); process.exit(0);
