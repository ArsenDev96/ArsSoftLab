// M1.4J.2: which part of the lift costs frames on this GPU.   node toggle.mjs
import { ARRIVE, IDS, REST, open, sleep } from "../../../m1.4i/work/lib.mjs";
const A = ARRIVE.educational;
const OFF = ".edu-lift{--dl:0!important;transition:none!important}";
const NOFADE = '[data-v2-floor="educational-floor"] svg{mask-image:none!important;-webkit-mask-image:none!important}';
const NOSTAY = '[data-v2-floor="contact-educational"]{mask-image:none!important;-webkit-mask-image:none!important}';
const NOSIDE = '[data-v2-floor="contact-educational-side"]{display:none!important}';
const NOGROUND = '[data-v2-ground="educational"]{display:none!important}';
const NOEDGE = '[data-strip-share="edge"]{display:none!important}[data-strip-share] svg{mask-image:none!important;-webkit-mask-image:none!important}';
const NOT = ".edu-rise{transform:none!important}";
const NODASH = '[data-v2-line="educational"] path{stroke-dasharray:none!important}';
const NOSTABLE = '[data-edu^="strip-stable"]{display:none!important}';
const V = process.argv[2] ? { [process.argv[2]]: process.argv[3] ?? "" } : {
  "on": "", "off": OFF, "off +nofade": OFF + NOFADE, "off +nostay,noside": OFF + NOSTAY + NOSIDE, "off +noground": OFF + NOGROUND, "off +noedge": OFF + NOEDGE, "off +notransform": OFF + NOT, "off +nodash": OFF + NODASH, "off +nostable": OFF + NOSTABLE,
  "off +all": OFF + NOFADE + NOSTAY + NOSIDE + NOGROUND + NOEDGE + NOT + NODASH + NOSTABLE,
  "on +nofade": NOFADE, "on +noground": NOGROUND, "on +nofade,stay,side,ground,edge": NOFADE + NOSTAY + NOSIDE + NOGROUND + NOEDGE,
};
for (const [n, css] of Object.entries(V)) {
  const L = await open("/lab-v2", { gpu: true });
  if (css) await L.page.eval(`(() => { const e = document.createElement("style"); e.textContent = ${JSON.stringify(css)}; document.head.append(e); return 1; })()`);
  await sleep(700);
  await L.page.eval(`(() => { window.__f = []; (function f() { window.__f.push(performance.now()); requestAnimationFrame(f); })(); return 1; })()`);
  const c = await L.page.center('[data-hotspot="educational"]');
  const out = [];
  for (let k = 0; k < 5; k++) {
    await L.off(); await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 8000); await sleep(600);
    await L.page.mouseMove(c.x, c.y);
    for (let i = 0; i < 200 && (await L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)) !== "educational"; i++) await sleep(2);
    const t0 = await L.page.eval("performance.now()"); await sleep(A + 1000);
    if (k) out.push(await L.page.eval(`window.__f.filter((t) => t >= ${t0 + A} && t < ${t0 + A + 800}).length`));
  }
  console.log(n.padEnd(34), out.join(" "));
  await L.page.close();
}
process.exit(0);
