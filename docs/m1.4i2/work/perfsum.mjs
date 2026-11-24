import { readFileSync } from "node:fs";
const W = "D:/ArsSoftLab/docs/m1.4i2/work/";
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const rg = (a) => `${+med(a).toFixed(1)} (${Math.min(...a)}-${Math.max(...a)})`;
for (const f of process.argv.slice(2)) for (const w of [1648, 1920]) {
  const R = JSON.parse(readFileSync(`${W}perf-${f}.json`)).filter((r) => r.w === w);
  if (!R.length) continue;
  console.log(`== ${f} ${w} n=${R.length}`);
  const p = (k, fn) => console.log("  " + k.padEnd(26), rg(R.map(fn)));
  p("files", (r) => r.transfer.files); p("kB", (r) => r.transfer.kb); p("decoded MB", (r) => r.decoded.mb);
  p("fcp", (r) => r.load.fcp); p("shown", (r) => r.load.shown); p("lcp", (r) => r.load.lcp); p("load", (r) => r.load.load); p("longtask sum", (r) => r.load.long.reduce((t, x) => t + x[1], 0));
  p("layers drawing", (r) => r.layers_idle.drawing); p("full frame", (r) => r.layers_idle.full_frame); p("layer Mpx", (r) => r.layers_idle.area_mpx);
  for (const m of ["mem_idle", "mem_round1", "mem_after"]) for (const k of ["cc/tile_memory", "gpu/transfer_cache", "image_gpu", "cc/image_memory", "skia/gpu_resources", "gpu/shared_images"]) p(m + " " + k, (r) => r[m][k] ?? 0);
  for (const m of ["proc_idle", "proc_round1", "proc_after"]) { p(m + " gpu", (r) => r[m]["gpu-process"]); p(m + " renderer", (r) => r[m].renderer); }
  p("idle median", (r) => r.idle.median);
  for (const id of Object.keys(R[0].st)) for (const [n, k] of [["first", [0]], ["later", [1, 2]]]) {
    const v = R.flatMap((r) => k.map((i) => r.st[id][i]));
    console.log("  " + `${id} ${n}`.padEnd(26), "charge fr", rg(v.map((x) => x.charge.frames)), "max", rg(v.map((x) => x.charge.max)), "| seq fr", rg(v.map((x) => x.seq.frames)), "med", rg(v.map((x) => x.seq.median)), "max", rg(v.map((x) => x.seq.max)), "| 1st frame", rg(v.map((x) => x.first_frame)), id === "playground" ? "| lift fr " + rg(v.map((x) => x.lift.frames)) + " max " + rg(v.map((x) => x.lift.max)) : "");
  }
}
