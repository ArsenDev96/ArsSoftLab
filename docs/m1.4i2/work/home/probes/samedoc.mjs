// One document: entered client-side from a 404, then / <-> /lab-v2 by push, Back and Forward. Rendered pixels each time.
import { writeFileSync } from "node:fs";
import { launch, sleep } from "../../../../../scripts/visual/cdp.mjs";
import { shot, viewer } from "./px.mjs";
const BASE = "http://localhost:3002";
const px = await viewer();
const out = [];
for (const first of ["/", "/lab-v2"]) {
  const page = await launch({ width: 1648, height: 928, gpu: true });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description ?? "").slice(0, 200));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 200));
  });
  await page.send("Page.navigate", { url: BASE + "/nope" });
  for (let i = 0; i < 400; i++) {
    if (await page.eval(`document.readyState === "complete" && !!window.next?.router`).catch(() => false)) break;
    await sleep(50);
  }
  await sleep(800);
  errors.length = 0;
  const tok = await page.eval("(window.__tok = Math.random())");
  const second = first === "/" ? "/lab-v2" : "/";
  const steps = [["push", first]];
  for (let k = 0; k < 4; k++) steps.push(["push", second], ["push", first]);
  steps.push(["back", second], ["back", first], ["forward", second], ["forward", first], ["back", second]);
  for (const [how, p] of steps) {
    const t = Date.now();
    await page.eval(how === "push" ? `(window.next.router.push("${p}"), 1)` : `(history.${how}(), 1)`);
    let ms = null;
    while (Date.now() - t < 15000) {
      const s = await page.eval(`({ path: location.pathname, v2: !!document.querySelector('[data-scene-variant="v2"]'), op: [...document.querySelectorAll(".lab-plate-gate")].map((e) => getComputedStyle(e).opacity).join() })`).catch(() => null);
      if (s && s.path === p && s.v2 === (p === "/lab-v2") && s.op === "1,1") { ms = Date.now() - t; break; }
      await sleep(25);
    }
    await page.mouseMove(4, 924);
    await sleep(700);
    await px.put("x", await shot(page, null));
    const lum = await px.lum("x");
    const r = { start: first, how, to: p, shownMs: ms, sameDocument: (await page.eval("window.__tok")) === tok, gates: await page.eval(`document.querySelectorAll(".lab-plate-gate").length`), animations: await page.eval("document.getAnimations().length"), lum, errors: errors.splice(0) };
    out.push(r);
    console.log(JSON.stringify(r));
  }
  await page.close();
}
writeFileSync("out/samedoc.json", JSON.stringify(out, null, 1));
const bad = out.filter((r) => r.shownMs === null || !r.sameDocument || r.lum.mean < 15 || r.errors.length);
console.log(`${out.length} mounts, ${bad.length} bad`);
await px.close();
process.exit(0);
