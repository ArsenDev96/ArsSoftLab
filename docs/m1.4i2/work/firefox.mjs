// M1.4I.2: Firefox (WebDriver BiDi, headless): idle and each powered station.  node firefox.mjs <out dir>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, IDS, POWERED, READ, REST, sleep } from "../../m1.4i/work/lib.mjs";
import { P, raise } from "../../m1.4i1e/work/points.mjs";
const D = process.argv[2]; mkdirSync(D, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url)), PORT = 9334;
const proc = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", mkdtempSync(join(tmpdir(), "arssoftlab-ff-")), `--remote-debugging-port=${PORT}`, "--width", "1648", "--height", "928", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 120 && !ws; i++) { await sleep(500); try { ws = await new Promise((ok, no) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/session`); w.onopen = () => ok(w); w.onerror = () => no(); }); } catch {} }
if (!ws) { console.log("no BiDi connection"); proc.kill(); process.exit(1); }
let n = 0; const pend = new Map(), logs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.type === "error" ? no(new Error(m.error + " " + m.message)) : ok(m.result); } else if (m.method === "log.entryAdded" && m.params.level === "error") logs.push(String(m.params.text).slice(0, 200)); };
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++n; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
const ses = await send("session.new", { capabilities: {} });
await send("session.subscribe", { events: ["log.entryAdded"] });
const ctx = (await send("browsingContext.getTree")).contexts[0].context;
await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1648, height: 928 }, devicePixelRatio: 1 }).catch(() => {});
const ev = async (x) => { const r = await send("script.evaluate", { expression: `JSON.stringify(${x})`, target: { context: ctx }, awaitPromise: true }); if (r.type === "exception") throw new Error(r.exceptionDetails.text); return r.result.value === undefined ? undefined : JSON.parse(r.result.value); };
await send("browsingContext.navigate", { context: ctx, url: BASE + "/lab-v2", wait: "complete" });
await sleep(6000);
const cam = await ev(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
await ev(`(() => { window.__h = []; window.__s = 0; const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents"); const now = () => { const v = d.dataset.labHover ?? "-"; if (window.__h.at(-1) !== v) window.__h.push(v); }; new MutationObserver(now).observe(d, { attributes: true }); now(); const a = Element.prototype.animate; Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__s++; return a.apply(this, x); }; return 1; })()`);
const S = ([x, y]) => ({ x: Math.round(cam.x + x * cam.k), y: Math.round(cam.y + y * cam.k) });
const acts = (actions) => send("input.performActions", { context: ctx, actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions }] });
const to = (p) => acts([{ type: "pointerMove", ...S(p) }]);
const glide = (a, b, ms) => { const k = Math.max(6, Math.round(ms / 25)); return acts(Array.from({ length: k }, (_, i) => ({ type: "pointerMove", duration: 25, ...S([a[0] + ((b[0] - a[0]) * (i + 1)) / k, a[1] + ((b[1] - a[1]) * (i + 1)) / k]) }))); };
const settle = async (c, ms = 8000) => { for (let t = 0; t < ms; t += 80) { if (c(await ev(READ))) return true; await sleep(80); } return false; };
const park = async () => { await acts([{ type: "pointerMove", x: 4, y: 900 }]); await settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i]))); await sleep(150); };
const out = { version: ses.capabilities.browserVersion };
const shot = async (n) => writeFileSync(join(D, n + ".png"), Buffer.from((await send("browsingContext.captureScreenshot", { context: ctx })).data, "base64"));
await ev(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
await park(); await sleep(1200); await shot("idle");
out.crops = await ev(`document.querySelectorAll(".lab-scene-image").length`);
for (const id of IDS) {
  const r = (out[id] = {});
  await ev("(window.__s = 0, 1)");
  await to(P[id].art);
  r.powered = await settle((s) => POWERED[id](s[id]));
  await sleep(1600);
  await ev(`(document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.pause(); a.currentTime = 0; } }), 1)`);
  await sleep(300);
  if (id !== "playground") await shot(id);
  r.sparks = await ev("window.__s");
  await park();
  const s = await ev(READ); r.rest = IDS.every((i) => REST[i](s[i]));
}
out.errors = logs;
writeFileSync(join(D, "firefox.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out));
await send("browser.close").catch(() => {});
ws.close(); proc.kill(); process.exit(0);
