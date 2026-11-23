// M1.4I.1D: what the strip pulse adds during a new charge: the same stopped frame with and without the pulse elements.
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch } from "../../../scripts/visual/cdp.mjs";
import { compareImages, prepare } from "../../../scripts/visual/compare.mjs";
import { open as openLab, sleep } from "../../m1.4i/work/lib.mjs";
import { LIB, STATIONS } from "./qr-lib.mjs";
const cmp = await launch();
await prepare(cmp);
for (const [id, at, gap] of [["creative", 120, 60], ["educational", 100, 40], ["experience", 130, 60]]) {
  const L = await openLab("/lab-v2", { gpu: true });
  await L.page.eval(LIB(id));
  await L.hover(id);
  await sleep(STATIONS[id].arrive + at - 90);
  await L.off();
  await L.page.eval("window.__q.until(() => window.__q.hov() === null)");
  await sleep(gap);
  await L.hover(id);
  await L.page.eval(`window.__q.until(() => window.__q.hov() === "${id}").then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => 1)`);
  await L.seek(STATIONS[id].arrive - 200);
  await sleep(200);
  const f = [0, 1].map((i) => join(tmpdir(), `qr-pulse-${i}.png`));
  const take = async (i) => writeFileSync(f[i], Buffer.from((await L.page.send("Page.captureScreenshot", { format: "png" })).data, "base64"));
  const s = JSON.parse(await L.page.eval("JSON.stringify((({ pulse, pw }) => ({ pulse, pw }))(window.__q.sample()))"));
  await take(0);
  await L.page.eval(`(document.querySelectorAll(".${STATIONS[id].cls}-pulse").forEach((e) => (e.style.display = "none")), 1)`);
  await sleep(200);
  await take(1);
  const r = await compareImages(cmp, f[0], f[1]);
  console.log(id, "pulse opacity", s.pulse, "strips", s.pw.join(), "| adds up to", r.max, "of 255; px over 12:", r.over12);
  await L.page.close();
}
await cmp.close();
process.exit(0);
