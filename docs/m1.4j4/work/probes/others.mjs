// M1.4J.4: what must not change, on one server: every other station at frozen moments, idle at several sizes, the homepage, hit maps.
//   BASE=http://localhost:<port> node others.mjs <out dir>
import { mkdirSync, writeFileSync } from "node:fs";
import { ARRIVE, BASE, IDS, POWERED, launch, open, sleep } from "../../../m1.4i/work/lib.mjs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const shot = async (page, n) => { for (let k = 0; k < 5; k++) { const r = await Promise.race([page.send("Page.captureScreenshot", { format: "png" }).catch(() => null), sleep(8000)]); if (r?.data) return writeFileSync(`${OUT}/${n}.png`, Buffer.from(r.data, "base64")); } throw new Error("no screenshot " + n); };
for (const [w, h, path] of [[1648, 928, "/lab-v2"], [1920, 1080, "/lab-v2"], [1366, 768, "/lab-v2"], [1024, 640, "/lab-v2"], [1648, 928, "/lab-v2?floor=approved"]]) {
  const p = await open(path, { gpu: true, width: w, height: h });
  await p.finish(); await sleep(400); await shot(p.page, `idle-${w}${path.includes("floor") ? "-tone" : ""}`); await p.page.close();
}
for (const id of IDS.filter((x) => x !== "experience")) {
  const p = await open("/lab-v2", { gpu: true });
  await p.finish();
  const c = await p.page.center(`[data-hotspot="${id}"]`); await p.page.mouseMove(c.x, c.y); await p.frame();
  for (const t of [-200, 60, 150, 250, 350, 500, 700]) { await p.seek(ARRIVE[id] + t); await sleep(220); await shot(p.page, `${id}-${t}`); }
  await p.seek(ARRIVE[id] + 2400); await sleep(400); await shot(p.page, `${id}-powered`);
  await p.page.close();
}
for (const id of ["engineering", "educational", "creative"]) {
  const p = await open("/lab-v2", { gpu: true, reducedMotion: true });
  const c = await p.page.center(`[data-hotspot="${id}"]`); await p.page.mouseMove(c.x, c.y); await sleep(900); await p.finish(); await sleep(300); await shot(p.page, `${id}-reduced`); await p.page.close();
}
const CH = { engineering: "e", educational: "d", playground: "p", creative: "c", experience: "x" };
const MAP = (cam) => `(() => { const C = ${JSON.stringify(CH)}; const rows = []; for (let y = 100; y <= 830; y += 2) { let r = ""; for (let x = 2; x <= 1670; x += 2) { const e = document.elementFromPoint(${cam.x} + (x + 0.01) * ${cam.k}, ${cam.y} + (y + 0.01) * ${cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station, b = e?.dataset?.bridge; r += h ? C[h] : s ? C[s].toUpperCase() : b ? "1" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`;
const out = {};
{
  const L = await open("/lab-v2", { gpu: true });
  out.rest = await L.page.eval(MAP(L.cam));
  for (const id of IDS) { await L.hover(id); await L.settle((s) => POWERED[id](s[id]), 8000); await sleep(1100); out[id] = await L.page.eval(MAP(L.cam)); await L.away(); await sleep(1600); }
  out.focus = await L.page.eval(`[...document.querySelectorAll("button,a[href],[tabindex]")].map((e) => (e.id || e.textContent.trim()).slice(0, 40))`);
  out.errors = L.errors; await L.page.close();
}
{
  const page = await launch({ width: 1648, height: 928, gpu: true });
  const asked = []; await page.send("Network.enable"); page.on((m) => { if (m.method === "Network.requestWillBeSent") asked.push(m.params.request.url); });
  await page.goto(BASE + "/");
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  await page.mouseMove(4, 924); await sleep(1500);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  out.home = await page.eval(MAP(cam));
  out.homeMarkup = await page.eval(`document.querySelector("#lab-stations").outerHTML`);
  out.homeV2Requests = asked.filter((x) => x.includes("/scene/v2/")).length;
  await page.freezeAnimations(0); await page.finishTransitions(); await sleep(300); await shot(page, "home");
  const c = await page.center('[data-hotspot="experience"]'); await page.mouseMove(c.x, c.y); await sleep(2500); out.homeExp = await page.eval(MAP(cam)); await page.finishTransitions(); await shot(page, "home-experience");
  await page.close();
}
writeFileSync(`${OUT}/maps.json`, JSON.stringify(out));
console.log(OUT, "errors", out.errors, "home /scene/v2 requests", out.homeV2Requests);
process.exit(0);
