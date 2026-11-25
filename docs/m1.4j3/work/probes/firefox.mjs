// M1.4J.3: Firefox (WebDriver BiDi, headless): idle and each powered station.  node firefox.mjs <out dir>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BASE, IDS, POWERED, READ, REST, sleep } from "../../../m1.4i/work/lib.mjs";
import { P, raise } from "../../../m1.4i1e/work/points.mjs";
const D = process.argv[2]; mkdirSync(D, { recursive: true });
const HERE = dirname(fileURLToPath(import.meta.url)), PORT = 9335;
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

const HK = "(() => { window.__log = []; window.__rec = false; const k = document.querySelector(\".lab-camera\").getBoundingClientRect().width / 1672; (function f() { if (window.__rec) { const R = [...document.querySelectorAll(\".cre-rise\")].map((e) => { const t = getComputedStyle(e).transform; return t === \"none\" ? 0 : -new DOMMatrix(t).f; }); const m = document.querySelector(\"[data-surge=creative] [data-surge-mover]\").getAnimations().at(-1); window.__log.push([document.timeline.currentTime, document.querySelector(\"[data-lab-hover]\")?.dataset.labHover ?? null, m ? m.startTime : null, +(Math.max(...R) / k).toFixed(3), +(Math.max(...R) - Math.min(...R)).toFixed(4), +getComputedStyle(document.querySelector(\".cre-crest\")).opacity]); } requestAnimationFrame(f); })(); return 1; })()";
await ev(HK);
const rec = async (fn) => { await ev("(window.__log.length = 0, window.__rec = true, 1)"); await fn(); return ev("(window.__rec = false, window.__log)"); };
out.runs = [];
for (let k = 0; k < 3; k++) { await park(); await ev("(window.__s = 0, 1)"); const f = await rec(async () => { await to(P.creative.art); await sleep(2300); }); const on = f.filter((x) => x[1] === "creative"), arr = on.find((x) => x[2] !== null)[2] + 640, first = (c) => { const x = on.find(c); return x ? Math.round(x[0] - arr) : null; }; const d = await rec(async () => { await park(); }); out.runs.push({ full: Math.max(...on.map((x) => x[3])), beforeArrival: Math.max(...on.filter((x) => x[0] < arr - 1).map((x) => x[3])), firstMove: first((x) => x[3] > 0.01), half: first((x) => x[3] >= 5), fullAt: first((x) => x[3] >= 9.99), fell: on.filter((x, i) => i && x[3] < on[i - 1][3] - 0.001).length, spread: Math.max(...on.map((x) => x[4])), sparks: await ev("window.__s"), end: d.at(-1)[3], rose: d.filter((x, i) => i && x[3] > d[i - 1][3] + 0.001).length }); }
if (true) { await park(); await to(P.creative.art); await settle((s) => POWERED.creative(s.creative)); await sleep(700); await shot("creative"); }
out.quick = [];
for (const [at, gap] of [[100, 150], [250, 150], [250, 300], [500, 200], [900, 250]]) { await park(); const f = await rec(async () => { await to(P.creative.art); await sleep(640 + at); await acts([{ type: "pointerMove", x: 4, y: 900 }]); await sleep(90 + gap); await to(P.creative.art); await sleep(2200); }); const i1 = f.findIndex((x) => x[1] === "creative"), i2 = f.findIndex((x, i) => i > i1 && x[1] !== "creative"), i3 = f.findIndex((x, i) => i > i2 && i2 > 0 && x[1] === "creative"); if (i3 < 0) { out.quick.push({ at, gap, held: true }); continue; } const arr = f.slice(i3).findLast((x) => x[2] !== null)[2] + 640, ch = f.slice(i3).filter((x) => x[0] < arr - 1); out.quick.push({ at, gap, around: f.slice(Math.max(0, i2 - 2), i3 + 8).map((x) => [Math.round(x[0] - f[i2][0]), x[1] ? "E" : "-", x[3]].join(":")).join(" "), maxStep: Math.max(...f.slice(1).map((x, i) => Math.abs(x[3] - f[i][3]))), retY: f[i3][3], roseInCharge: ch.filter((x, i) => i && x[3] > ch[i - 1][3] + 0.001).length, atArrival: ch.at(-1)?.[3], scan: ch.filter((x) => x[5] > 0.02).length, end: f.at(-1)[3], spread: Math.max(...f.map((x) => x[4])) }); }
out.errors = logs;
writeFileSync(join(D, "firefox.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out));
await send("browser.close").catch(() => {});
ws.close(); proc.kill(); process.exit(0);
