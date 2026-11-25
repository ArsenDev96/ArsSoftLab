// A still pointer on Playground's chip, from rest through the lift, then a click without moving. The whole pill, rounded ends included.
// (Scene px.) Second part: a click on the visible raised chip, reached by moving, over the same columns.
import { writeFileSync } from "node:fs";
import { IDS, POWERED, REST, open, sleep } from "../../../../m1.4i/work/lib.mjs";
import { raise } from "../../../../m1.4i1e/work/points.mjs";
const L = await open("/lab-v2", { gpu: true });
const { page, cam } = L;
const S = ([x, y]) => [cam.x + x * cam.k, cam.y + y * cam.k];
const to = (p) => page.mouseMove(...S(p));
const under = (p) => page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.hotspot ? "hotspot" : e?.dataset.bridge ? "bridge" : e?.closest("li button") ? "chip" : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
const rest = () => L.settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i])), 8000);
const press = async (p) => {
  const [x, y] = S(p);
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
};
const back = async () => {
  if (await page.eval("location.search !== ''")) { await page.key("Escape", "Escape", 27); await sleep(400); if (await page.eval("location.search !== ''")) { await page.key("Escape", "Escape", 27); await sleep(400); } }
  await page.eval("(document.activeElement.blur(), 1)");
  await L.off();
  if (!(await rest())) { await page.eval("(history.replaceState(null, '', '/lab-v2'), location.reload(), 1)"); await sleep(3500); await L.off(); await rest(); }
};
const out = { still: [], moved: [] };
for (const x of [1288.5, 1290, 1292, 1294, 1296, 1299, 1303, 1316, 1330, 1336, 1339, 1341, 1343, 1345])
  for (const y of [358, 361, 365, 369, 373, 377, 380]) {
    await back();
    const p = [x, y];
    const at0 = await under(p);
    if (at0 !== "chip") continue;
    await to(p);
    await sleep(1800);
    const at1 = await under(p), powered = POWERED.playground((await L.read()).playground);
    await press(p);
    await sleep(700);
    out.still.push({ p, after: at1, powered, url: await page.eval("location.search") });
  }
for (const x of [1290, 1292, 1296, 1303, 1316, 1330, 1339, 1343, 1345])
  for (const y of [360, 369, 378]) {
    await back();
    const at0 = await under([x, y]);
    if (at0 !== "chip") continue;
    await to([1200, 400]);
    await L.settle((s) => POWERED.playground(s.playground), 8000);
    await sleep(150);
    const q = raise([x, y]);
    for (let k = 1; k <= 20; k++) { await to([1200 + ((q[0] - 1200) * k) / 20, 400 + ((q[1] - 400) * k) / 20]); await sleep(16); }
    const u = await under(q);
    await press(q);
    await sleep(700);
    out.moved.push({ p: q.map((v) => +v.toFixed(1)), under: u, url: await page.eval("location.search") });
  }
writeFileSync("out/chip-edge.json", JSON.stringify(out, null, 0));
const AZ = "?station=playground&project=aziz";
console.log("still:", out.still.length, "opened AZIZ", out.still.filter((r) => r.url === AZ).length, "other", JSON.stringify(out.still.filter((r) => r.url !== AZ)));
console.log("moved onto the raised chip:", out.moved.length, "opened AZIZ", out.moved.filter((r) => r.url === AZ).length, "other", JSON.stringify(out.moved.filter((r) => r.url !== AZ)));
console.log("errors", JSON.stringify(L.errors));
await page.close();
process.exit(0);
