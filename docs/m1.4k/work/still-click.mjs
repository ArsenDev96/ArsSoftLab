// M1.4I.1E: the pointer rests on a Playground control before the lift and clicks after it, without moving.
import { POWERED, open, sleep } from "./lib.mjs";
for (const [name, p] of Object.entries({ "chip top": [1316, 359], "chip centre": [1316, 369], "chip lower edge": [1316, 379], "title, right of the chip": [1375, 338], "title over the raised chip": [1330, 341] })) {
  const L = await open("/lab-v2", { gpu: true });
  const q = [L.cam.x + p[0] * L.cam.k, L.cam.y + p[1] * L.cam.k];
  await L.page.mouseMove(...q);
  await L.settle((s) => POWERED.playground(s.playground), 8000);
  await sleep(500);
  await L.page.click(...q);
  await sleep(1300);
  console.log(name, await L.page.eval("location.search"), L.errors);
  // Below the raised chip, coming from the platform: no chip there.
  if (name === "chip top") {
    await L.page.key("Escape", "Escape", 27); await sleep(1200);
    await L.page.eval("document.activeElement.blur()");
    await L.off(); await sleep(1500);
    const S = (x, y) => [L.cam.x + x * L.cam.k, L.cam.y + y * L.cam.k];
    await L.page.mouseMove(...S(1215, 530)); await L.settle((s) => POWERED.playground(s.playground), 8000); await sleep(400);
    await L.page.mouseMove(...S(1316, 374)); await sleep(200);
    console.log("  below the raised chip, from the platform:", await L.page.eval(`(() => { const e = document.elementFromPoint(${S(1316, 374).join(",")}); return e.dataset.bridge ? "bridge" : e.tagName; })()`));
  }
  await L.page.close();
}
process.exit(0);
