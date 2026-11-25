// M1.4K section 12: Firefox (WebDriver BiDi, headless): idle, every station's lift frame by frame, quick returns, a switch, a direct link.   node k10-firefox.mjs <out dir>
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ARRIVE, BASE, HEIGHT, HOOK, IDS, POWERED, REST, SEQ, out as save, sleep } from "./core.mjs";
import { READ } from "./lib.mjs";
import { analyse } from "./analyse.mjs";
const D = process.argv[2]; mkdirSync(D, { recursive: true });
const PORT = 9341;
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
const go = async (p) => { await send("browsingContext.navigate", { context: ctx, url: BASE + p, wait: "complete" }); await sleep(5000); await ev(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`); };
const shot = async (f) => writeFileSync(join(D, f + ".png"), Buffer.from((await send("browsingContext.captureScreenshot", { context: ctx })).data, "base64"));
const move = (x, y) => send("input.performActions", { context: ctx, actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerMove", x: Math.round(x), y: Math.round(y) }] }] });
await go("/lab-v2");
await ev(HOOK);
const C = await ev(`Object.fromEntries([...document.querySelectorAll("[data-hotspot]")].map((h) => { const b = h.getBoundingClientRect(); return [h.dataset.hotspot, [b.x + b.width / 2, b.y + b.height / 2]]; }))`);
const settle = async (c, ms = 9000) => { for (let t = 0; t < ms; t += 80) { if (c(await ev(READ))) return true; await sleep(80); } return false; };
const park = async () => { await move(4, 900); const ok = await settle((s) => s.hover === null && s.selected === null && IDS.every((i) => REST[i](s[i]))); await sleep(700); return ok; };
const start = () => ev("(window.__log.length = 0, window.__sparks.length = 0, window.__rec = true, 1)"), stop = () => ev("(window.__rec = false, window.__log)");
const out = { version: ses.capabilities.browserVersion, st: {}, quick: [], sw: [] };
out.idleRest = await park(); await shot("ff-idle");
for (const id of IDS) {
  await park(); await start(); await move(...C[id]); const ok = await settle((s) => POWERED[id](s[id])); await sleep(700); await shot("ff-" + id);
  const f = (await stop()).filter((x) => x.hover === id), arr = f.find((x) => x[id].spark !== null)[id].spark + ARRIVE[id], first = (p) => { const x = f.find(p); return x ? Math.round(x.t - arr) : null; };
  const full = Math.max(...f.map((x) => x[id].y));
  await start(); const rest = await park(); const d = await stop();
  out.st[id] = { powered: ok, full, before: Math.max(0, ...f.filter((x) => x.t < arr - 18).map((x) => x[id].y)), onceBefore: Math.max(0, ...f.filter((x) => x.t < arr - 18).map((x) => x[id].once)), first: first((x) => x[id].y > 0.01), half: first((x) => x[id].y >= full / 2), done: first((x) => x[id].y >= full - 0.02), fell: f.filter((x, i) => i && x[id].y < f[i - 1][id].y - 0.004).length, spread: Math.max(...f.map((x) => x[id].spread)), othersMoved: Math.max(...f.flatMap((x) => IDS.filter((o) => o !== id).map((o) => x[o].y))), rest, end: d.at(-1)[id].y, rose: d.filter((x, i) => i && x[id].y > d[i - 1][id].y + 0.004).length };
  console.log(id, JSON.stringify(out.st[id]));
}
for (const id of IDS) for (const [at, gap] of [[120, 30], [300, 120], [SEQ[id] + 200, 60], [SEQ[id] + 200, 250]]) {
  await park(); await start(); await move(...C[id]); await sleep(ARRIVE[id] + at); await move(4, 900); await sleep(90 + gap); await move(...C[id]); const ok = await settle((s) => POWERED[id](s[id])); await sleep(500);
  const a = analyse(await stop()); out.quick.push({ id, at, gap, ok, bad: a.bad.slice(0, 4), visits: a.visits.length, step: a.note.step }); if (a.bad.length || !ok) console.log("!! quick", JSON.stringify(out.quick.at(-1)).slice(0, 500));
}
for (let k = 0; k < 5; k++) { const a = IDS[k], b = IDS[(k + 1) % 5]; await park(); await start(); await move(...C[a]); await sleep(ARRIVE[a] + 300); await move(...C[b]); const ok = await settle((s) => POWERED[b](s[b]) && REST[a](s[a])); const z = analyse(await stop()); out.sw.push({ a, b, ok, bad: z.bad.slice(0, 4) }); if (!ok || z.bad.length) console.log("!! switch", JSON.stringify(out.sw.at(-1)).slice(0, 500)); }
await park();
for (const id of IDS) { await go(`/lab-v2?station=${id}`); const s = await ev(READ); (out.links ??= {})[id] = { sel: s.selected, powered: POWERED[id](s[id]) }; }
out.errors = logs;
console.log(JSON.stringify({ version: out.version, idleRest: out.idleRest, quick: out.quick.length, quickBad: out.quick.filter((q) => !q.ok || q.bad.length).length, sw: out.sw.map((x) => x.ok), links: out.links, errors: logs }));
await save("k10-firefox", out);
await send("browser.close").catch(() => {}); ws.close(); proc.kill(); process.exit(0);
