// The remaining small checks: node p9-small.mjs [idle,nav,hit,label,traverse,escape,reraster]
import { copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CAP, IDS, POWERED, ROOT, logger, open, save, sleep } from "./lib.mjs";
const out = {};
const want = (n) => !process.argv[2] || process.argv[2].split(",").includes(n);

if (want("idle")) for (const [n, p] of [["default", "/lab-v2"], ["tone", "/lab-v2?floor=approved"], ["home", "/"]]) {
  const { page, shot, errors } = await open(p);
  await sleep(600);
  await shot(`idle-${n}.png`);
  if (n !== "home") copyFileSync(join(CAP, `idle-${n}.png`), join(ROOT, `docs/m1.4i/full-scene-idle-${n}.png`));
  out["idle_" + n] = errors;
  await page.close();
}
if (want("nav")) {
  out.anchors = {};
  for (const p of ["/lab-v2", "/"]) {
    const { page } = await open(p);
    out.anchors[p] = await page.eval(`[...document.querySelectorAll("a")].map((a) => [a.textContent.trim().slice(0, 18), a.getAttribute("href"), a.getAttribute("href")?.startsWith("#") ? !!document.getElementById(a.getAttribute("href").slice(1)) : null])`);
    await page.close();
  }
  // Client-side navigation from a page where the gate script never ran.
  const { page, errors } = await open("/icon.svg").catch(() => ({}));
  if (page) await page.close();
}
if (want("gate")) {
  const { launch, BASE } = await import("./lib.mjs");
  const page = await launch({ width: 1648, height: 928 });
  const errors = [];
  page.on((m) => { if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.text); if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 260)); });
  await page.send("Page.navigate", { url: BASE + "/nope" });
  await sleep(7000);
  const n = errors.length;
  const pushed = await page.eval(`(window.next?.router?.push ? (window.next.router.push("/lab-v2"), true) : false)`);
  const samples = [];
  for (let i = 0; i < 14; i++) { await sleep(500); samples.push(await page.eval(`[location.pathname, [...document.querySelectorAll(".lab-plate-gate")].map((e) => { const c = getComputedStyle(e); return [c.visibility, c.opacity, c.display].join(" "); }).join("|"), document.documentElement.className].join(" ; ")`)); }
  out.client_nav_from_404 = { pushed, samples: [...new Set(samples)], errors: errors.slice(n) };
  writeFileSync(join(CAP, "client-nav-404.jpg"), Buffer.from((await page.send("Page.captureScreenshot", { format: "jpeg", quality: 80 })).data, "base64"));
  await page.close();
}
if (want("hit")) {
  const { page, cam } = await open("/lab-v2");
  out.playground_marquee = await page.eval(`(() => { const r = []; for (let y = 300; y <= 372; y += 4) { const e = document.elementFromPoint(${cam.x} + 1190 * ${cam.k}, ${cam.y} + y * ${cam.k}); r.push([y, e?.dataset?.hotspot ?? e?.closest?.("[data-station]")?.dataset.station ?? "scene"]); } return r; })()`);
  out.paths = {};
  for (const id of IDS) out.paths[id] = await page.eval(`(() => { const a = document.querySelector('[data-hotspot="${id}"]').getBoundingClientRect(), b = document.getElementById("station-${id}-trigger").getBoundingClientRect(); const p = [a.x + a.width / 2, a.y + a.height / 2], q = [b.x + b.width / 2, b.y + b.height / 2]; const r = []; for (let k = 0; k <= 60; k++) { const e = document.elementFromPoint(p[0] + (q[0] - p[0]) * k / 60, p[1] + (q[1] - p[1]) * k / 60); const n = e?.dataset?.hotspot ? "hotspot " + e.dataset.hotspot : e?.closest?.("[data-station]") ? "label " + e.closest("[data-station]").dataset.station : "scene"; if (r.at(-1)?.[0] !== n) r.push([n, 1]); else r.at(-1)[1]++; } return { px: Math.round(Math.hypot(q[0] - p[0], q[1] - p[1])), parts: r }; })()`);
  await page.close();
}
if (want("label")) {
  out.label_rise = {};
  const { page, hover, away, settle } = await open("/lab-v2");
  const rd = (id) => page.eval(`(() => { const b = document.querySelector('[data-station="${id}"] h2 button').getBoundingClientRect(); return [b.x, b.y, b.width, b.height].map((v) => +v.toFixed(2)); })()`);
  for (const id of IDS) {
    const a = await rd(id);
    await hover(id); await settle((s) => POWERED[id](s[id]), 8000); await sleep(700);
    const b = await rd(id);
    out.label_rise[id] = { dy: +(b[1] - a[1]).toFixed(2), dx: +(b[0] - a[0]).toFixed(2), dw: +(b[2] - a[2]).toFixed(2) };
    await away(); await sleep(1500);
  }
  await page.close();
}
if (want("traverse")) {
  // Platform centre to its own label at several speeds (real mouse events), once powered: does it stay powered?
  out.traverse = {};
  for (const id of IDS) {
    out.traverse[id] = {};
    const { page, hover, away, settle } = await open("/lab-v2", { gpu: true });
    for (const ms of [150, 400, 900, 1600]) {
      await hover(id); await settle((s) => POWERED[id](s[id]), 8000); await sleep(300);
      const p = await page.center(`[data-hotspot="${id}"]`), t = await page.center(`#station-${id}-trigger`);
      const log = await logger(page), n = Math.max(4, Math.round(ms / 16)), t0 = Date.now();
      for (let k = 1; k <= n; k++) { await page.mouseMove(p.x + ((t.x - p.x) * k) / n, p.y + ((t.y - p.y) * k) / n); const wait = t0 + (ms * k) / n - Date.now(); if (wait > 0) await sleep(wait); }
      const took = Date.now() - t0; await sleep(700);
      const fr = await log.since(0);
      out.traverse[id][ms] = { took, lost: fr.filter(([, s]) => s.hover !== id).length, other: [...new Set(fr.map(([, s]) => s.hover))].filter((h) => h && h !== id), sparks: fr.filter(([, s]) => s.sparks[id] > 0).length, stays: fr.every(([, s]) => POWERED[id](s[id])) };
      await away(); await sleep(1500);
    }
    await page.close();
  }
}
if (want("escape")) {
  const { page, read } = await open("/lab-v2");
  out.escape_in_panel = {};
  const focus = () => page.eval("document.activeElement?.id || document.activeElement?.tagName");
  for (const id of IDS) {
    await page.eval(`document.getElementById("station-${id}-trigger").focus()`);
    await page.key("Enter", "Enter", 13); await sleep(1400);
    await page.key("Tab", "Tab", 9); await sleep(80);
    await page.key("Escape", "Escape", 27); await sleep(1400);
    out.escape_in_panel[id] = { selected: (await read()).selected, focus: await focus() };
  }
  await page.eval(`document.getElementById("station-creative-trigger").focus()`);
  await page.key("Enter", "Enter", 13); await sleep(1400);
  const b = await page.eval(`(() => { const e = [...document.querySelectorAll("button")].find((x) => x.textContent.includes("Back to Lab") && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; })()`);
  await page.click(...b); await sleep(1400);
  out.back_button = { selected: (await read()).selected, focus: await focus() };
  await page.close();
}
if (want("reraster")) {
  const { page, hover, shot } = await open("/lab-v2", { gpu: true });
  await shot("reraster-idle.png");
  await hover("playground"); await sleep(200);
  await page.eval("document.getAnimations().forEach((a) => a.pause())"); await sleep(500);
  await shot("reraster-pending.png");
  await page.close();
}
save(`small${process.argv[2] ? "-" + process.argv[2].replace(/,/g, "-") : ""}.json`, out);
console.log(JSON.stringify(out));
