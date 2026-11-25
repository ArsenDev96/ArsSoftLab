// M1.4J.2: how much later than the CSS sequence the spark starts (ms): from rest, and on a quick return.   BASE=... node skew.mjs <label> [css] [reps]
import { ARRIVE, IDS, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const [label, css = "", reps = "8"] = process.argv.slice(2);
const A = ARRIVE.educational;
const L = await open("/lab-v2", { gpu: true });
if (css) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(css)}; document.head.append(e); return 1; })()`);
await L.page.eval(`(() => { const cyc = document.querySelector(".edu-v2").closest(".edu-cycle"), mv = document.querySelector('[data-surge="educational"] [data-surge-mover]');
  window.__skew = async () => { for (let k = 0; k < 60; k++) { await new Promise((r) => requestAnimationFrame(r)); const s = mv.getAnimations().at(-1), t = cyc.getAnimations().find((a) => a.transitionProperty === "--gs-on"); if (s && t && s.startTime !== null && t.startTime !== null && s.playState === "running") return Math.round(s.startTime - t.startTime); } return null; }; return 1; })()`);
const c = await L.page.center('[data-hotspot="educational"]');
const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
const until = async (f) => { for (let i = 0; i < 300 && !(await f()); i++) await sleep(2); };
const rest = async () => { await L.off(); await L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000); await sleep(700); };
const out = { rest: [], back: [] };
for (let k = 0; k < +reps; k++) {
  await rest(); await L.page.mouseMove(c.x, c.y); await until(async () => (await hov()) === "educational"); out.rest.push(await L.page.eval("window.__skew()"));
  for (const [at, gap] of [[40, 20], [300, 60], [700, 120]]) {
    await rest(); await L.page.mouseMove(c.x, c.y); await until(async () => (await hov()) === "educational"); await sleep(A + at - 90);
    await L.off(); await until(async () => (await hov()) === null); await sleep(gap);
    await L.page.mouseMove(c.x, c.y); await until(async () => (await hov()) === "educational"); out.back.push(await L.page.eval("window.__skew()"));
  }
}
const st = (a) => { a = a.map((x) => (x === undefined ? null : x)); const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); return `median ${s[s.length >> 1]} p90 ${s[Math.floor(s.length * 0.9)]} max ${s.at(-1)} | >33: ${s.filter((x) => x > 33).length}, >50: ${s.filter((x) => x > 50).length} of ${s.length}`; };
console.log(label.padEnd(22), "from rest", st(out.rest), "|| quick return", st(out.back));
await L.page.close();
process.exit(0);
