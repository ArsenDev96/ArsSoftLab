// Method check (not a benchmark): does fp-inject.mjs's CSS apply, and survive hydration?
import { launch, sleep } from "./cdp2.mjs";
const css = "*,*::before,*::after{filter:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important;text-shadow:none!important}";
const inject = `(() => { const add = () => { const s = document.createElement("style"); s.id = "m14q-diag"; s.textContent = ${JSON.stringify(css)}; document.documentElement.appendChild(s); window.__diagAddedAt = performance.now(); window.__diagHeadExisted = !!document.head; }; if (document.documentElement) add(); else new MutationObserver((m, o) => { if (document.documentElement) { o.disconnect(); add(); } }).observe(document, { childList: true }); })()`;
const probe = `(() => { const st = document.getElementById("m14q-diag"); const chip = document.querySelector(".lab-chip"); return { styleInDom: !!st, parent: st?.parentElement?.tagName ?? null, beforeHead: st ? !!(st.compareDocumentPosition(document.head) & Node.DOCUMENT_POSITION_FOLLOWING) : null, sheetApplied: !!st?.sheet && st.sheet.cssRules.length > 0, addedAt: Math.round(window.__diagAddedAt ?? -1), headExistedWhenAdded: window.__diagHeadExisted ?? null, chipBackdrop: chip ? getComputedStyle(chip).backdropFilter : "no chip", fcp: Math.round(performance.getEntriesByType("paint").find((p) => p.name === "first-contentful-paint")?.startTime ?? -1) }; })()`;
for (const path of ["/lab-v2?render=lite", "/lab-v2", "/lab-v2/projects/sqlorbit"]) {
  const page = await launch();
  const errors = [];
  await page.send("Runtime.enable");
  page.on((m) => { if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(String(m.params.args[0]?.value ?? m.params.args[0]?.description).slice(0, 120)); if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.text); });
  await page.send("Page.enable");
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: inject });
  const loaded = new Promise((ok) => { const off = page.on((m) => { if (m.method === "Page.loadEventFired") { off(); ok(); } }); });
  await page.send("Page.navigate", { url: "http://localhost:3100" + path });
  await loaded; await sleep(1500);
  console.log(path, JSON.stringify(await page.eval(probe)), "console errors:", errors.length ? errors.join(" | ") : "none");
  await page.close();
}
