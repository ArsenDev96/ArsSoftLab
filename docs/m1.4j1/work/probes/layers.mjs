import { open, sleep } from "../../../m1.4i/work/lib.mjs";
const V = { now: "", "contact unclipped": '[data-v2-floor="contact"]{clip-path:none!important}', "own hidden": '[data-v2-floor="contact-engineering"]{display:none!important}', "ground hidden": '[data-v2-ground="engineering"]{display:none!important}', "line end hidden": '[data-v2-line-end]{display:none!important}', "no rise transform": ".eng-rise{transform:none!important}", "disc mask off": ".eng-floor svg{mask-image:none!important;-webkit-mask-image:none!important}", "own inset": '[data-v2-floor="contact-engineering"]{clip-path:inset(54.73% 62.92% 39.32% 14.95%)!important}' };
for (const [n, css] of Object.entries(V)) {
  const L = await open("/lab-v2", { gpu: true });
  if (css) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(css)}; document.head.append(e); return 1; })()`);
  await sleep(800);
  let ls = []; const off = L.page.on((m) => { if (m.method === "LayerTree.layerTreeDidChange" && m.params.layers) ls = m.params.layers; });
  await L.page.send("LayerTree.enable"); for (let k = 0; k < 4 && !ls.length; k++) { await L.page.eval(`document.documentElement.style.setProperty("outline", "0 solid rgb(0 0 ${k})")`); await sleep(300); }
  off(); const d = ls.filter((l) => l.drawsContent), big = d.filter((l) => l.width > 1500 && l.height > 800);
  console.log(n.padEnd(20), "draw", d.length, "full", big.length, "Mpx", (d.reduce((t, l) => t + l.width * l.height, 0) / 1e6).toFixed(2), "mid", d.filter((l) => l.width > 300 && l.width <= 1500 && l.height > 40).map((l) => l.width + "x" + l.height).join(" ").slice(0, 160));
  await L.page.close();
}
process.exit(0);
