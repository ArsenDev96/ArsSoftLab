// Scene images held back for a while, direct and client-side; the rendered pixels are compared with an ordinary direct load.
import { mkdirSync, writeFileSync } from "node:fs";
import { launch, sleep } from "../../../../../scripts/visual/cdp.mjs";
import { shot, viewer } from "./px.mjs";
const BASE = "http://localhost:3002", OTHER = "/nope";
mkdirSync("cap", { recursive: true });
const HIDE = `(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`;
const OP = `[...document.querySelectorAll(".lab-plate-gate")].map((e) => getComputedStyle(e).opacity).join()`;
const px = await viewer();
const settleShot = async (page, name) => {
  await page.mouseMove(4, 924);
  await page.eval(HIDE);
  await page.eval("document.fonts.ready.then(() => 1)");
  await sleep(900);
  await page.freezeAnimations(0);
  await page.finishTransitions();
  await sleep(300);
  return shot(page, name);
};
const out = [];
for (const p of ["/", "/lab-v2"]) {
  const slug = p === "/" ? "home" : "v2";
  const ref = await launch({ width: 1648, height: 928, gpu: true });
  await ref.goto(BASE + p);
  await sleep(1200);
  await px.put(`ref-${slug}`, await settleShot(ref, `ref-${slug}`));
  await ref.close();
  console.log("ref", p, JSON.stringify(await px.lum(`ref-${slug}`)));
  for (const how of ["direct", "client"])
    for (const delay of [1500, 6000]) {
      const page = await launch({ width: 1648, height: 928, gpu: true });
      const errors = [];
      page.on((m) => {
        if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description ?? "").slice(0, 160));
        if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
      });
      if (how === "client") {
        await page.send("Page.navigate", { url: BASE + OTHER });
        for (let i = 0; i < 400; i++) {
          if (await page.eval(`document.readyState === "complete" && !!window.next?.router && location.pathname === "${OTHER}"`).catch(() => false)) break;
          await sleep(50);
        }
        await sleep(800);
        errors.length = 0;
      }
      let held = 0;
      page.on((m) => {
        if (m.method === "Fetch.requestPaused") {
          held++;
          setTimeout(() => page.send("Fetch.continueRequest", { requestId: m.params.requestId }).catch(() => {}), delay);
        }
      });
      await page.send("Fetch.enable", { patterns: [{ urlPattern: "*/scene/*" }] });
      const t = Date.now();
      const doc = how === "client" ? await page.eval("(window.__tok = Math.random())") : null;
      if (how === "client") await page.eval(`(window.next.router.push("${p}"), 1)`);
      else await page.send("Page.navigate", { url: BASE + p });
      let shown = null, atOpen = null;
      while (Date.now() - t < 20000) {
        const s = await page.eval(`({ rules: [...(document.head?.querySelectorAll("style") ?? [])].filter((e) => e.textContent.includes(".lab-plate-gate{opacity:1}")).length, op: ${OP}, path: location.pathname, n: performance.getEntriesByType("resource").filter((e) => e.name.includes("/scene/") && e.responseEnd > 0).length })`).catch(() => null);
        if (s?.path === p && s.op === "1,1" && s.rules > 0) { shown = Date.now() - t; atOpen = s.n; break; }
        await sleep(30);
      }
      await sleep(delay + 2500);
      const same = how === "client" ? (await page.eval("window.__tok")) === doc : null;
      await px.put("x", await settleShot(page, `slow-${slug}-${how}-${delay}`));
      const r = { page: p, how, delayMs: delay, held, shownMs: shown, sceneFilesLoadedAtOpen: atOpen, sameDocument: same, lum: await px.lum("x"), diffToRef: await px.diff(`ref-${slug}`, "x"), errors };
      out.push(r);
      console.log(JSON.stringify(r));
      writeFileSync("out/slow2.json", JSON.stringify(out, null, 1));
      await page.close();
    }
}
await px.close();
process.exit(0);
