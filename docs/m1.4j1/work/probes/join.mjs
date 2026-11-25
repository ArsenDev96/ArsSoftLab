// Vertical centre of the line's light, drawn by the line itself (join 0) and by its run beneath the station (join 1), same frozen state.
import { open, sleep } from "../../../m1.4i/work/lib.mjs";
const p = await open("/lab-v2", { gpu: true, width: +(process.argv[2] ?? 1648), height: +(process.argv[3] ?? 928) });
const c = await p.page.center('[data-hotspot="engineering"]');
await p.page.mouseMove(c.x, c.y); await sleep(3000);
const S = +(process.argv[4] ?? 8), r = { x: 570, y: 520, w: 70, h: 50 };
const cap = async (css) => { await p.page.eval(`(() => { let e = document.getElementById("jj"); if (!e) { e = document.createElement("style"); e.id = "jj"; document.head.append(e); } e.textContent = ${JSON.stringify(css)}; return 1; })()`); await sleep(500); return (await p.page.send("Page.captureScreenshot", { format: "png", clip: { x: p.cam.x + r.x * p.cam.k, y: p.cam.y + r.y * p.cam.k, width: r.w * p.cam.k, height: r.h * p.cam.k, scale: S } })).data; };
const none = await cap(`.eng-lift{--eng-join:0!important}[data-v2-line="engineering"]{visibility:hidden}`);
const main = await cap(`.eng-lift{--eng-join:0!important}`);
const ext = await cap(`.eng-lift{--eng-join:1!important}[data-v2-line="engineering"]{visibility:hidden}[data-v2-line-end] stop:last-child{stop-opacity:0.4!important}`);
const out = await p.page.eval(`(async () => { const L = async (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); const im = await createImageBitmap(new Blob([u])); const c = new OffscreenCanvas(im.width, im.height), g = c.getContext("2d"); g.drawImage(im, 0, 0); return g.getImageData(0, 0, im.width, im.height); };
 const N = await L("${none}"), M = await L("${main}"), E = await L("${ext}"); const cen = (A, x) => { let s = 0, t = 0; for (let y = 0; y < A.height; y++) { const i = (y * A.width + x) * 4; const d = Math.max(0, A.data[i] - N.data[i]); s += d; t += d * y; } return s > 50 ? t / s / ${S} / ${p.cam.k} + ${r.y} : null; };
 const rows = []; for (const X of [582, 586, 590, 594, 598, 602, 606, 612, 618]) { const x = Math.round((X - ${r.x}) * ${p.cam.k} * ${S}); rows.push([X, cen(M, x)?.toFixed(2), cen(E, x)?.toFixed(2)]); } return rows; })()`);
console.log(JSON.stringify(out));
await p.page.close(); process.exit(0);
