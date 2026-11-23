// Lightweight Firefox smoke test over WebDriver BiDi (headless): the scene, one activation per station, a direct link.
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ARRIVE, BASE, CAP, IDS, POWERED, READ, REST, SEQ, save, sleep } from "./lib.mjs";

const profile = mkdtempSync(join(tmpdir(), "arssoftlab-ff-"));
const PORT = 9333;
const proc = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", profile, `--remote-debugging-port=${PORT}`, "--width", "1648", "--height", "928", "about:blank"], { stdio: ["ignore", "pipe", "pipe"] });
let err = "";
proc.stderr.on("data", (d) => (err += d));
let ws;
for (let i = 0; i < 120 && !ws; i++) {
  await sleep(500);
  try {
    ws = await new Promise((ok, no) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/session`); w.onopen = () => ok(w); w.onerror = () => no(); });
  } catch {}
}
if (!ws) { console.log("no BiDi connection", err.slice(-400)); proc.kill(); process.exit(1); }
let id = 0;
const pend = new Map();
const logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.type === "error" ? no(new Error(m.error + " " + m.message)) : ok(m.result); }
  else if (m.method === "log.entryAdded" && m.params.level === "error") logs.push(String(m.params.text).slice(0, 300));
};
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
const ses = await send("session.new", { capabilities: {} });
const version = ses.capabilities.browserVersion;
await send("session.subscribe", { events: ["log.entryAdded"] });
const ctx = (await send("browsingContext.getTree")).contexts[0].context;
await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1648, height: 928 }, devicePixelRatio: 1 }).catch(() => {});
const ev = async (expression) => {
  const r = await send("script.evaluate", { expression: `JSON.stringify(${expression})`, target: { context: ctx }, awaitPromise: true });
  if (r.type === "exception") throw new Error(r.exceptionDetails.text);
  return r.result.value === undefined ? undefined : JSON.parse(r.result.value);
};
const shot = async (n) => writeFileSync(join(CAP, n), Buffer.from((await send("browsingContext.captureScreenshot", { context: ctx })).data, "base64"));
const move = (x, y) => send("input.performActions", { context: ctx, actions: [{ type: "pointer", id: "m", parameters: { pointerType: "mouse" }, actions: [{ type: "pointerMove", x: Math.round(x), y: Math.round(y) }] }] });
const goto = async (p) => { await send("browsingContext.navigate", { context: ctx, url: BASE + p, wait: "complete" }); await sleep(3500); };
const out = { version, stations: {} };
await goto("/lab-v2");
out.size = await ev("[innerWidth, innerHeight, devicePixelRatio]");
out.supports = await ev(`({ round_mod: CSS.supports("width", "calc(1px * round(nearest, 2.4, 1) + 1px * mod(7, 3))"), plus_lighter: CSS.supports("mix-blend-mode", "plus-lighter"), property: "registerProperty" in CSS, is: CSS.supports("selector(:is(a,b))"), mask: CSS.supports("mask-composite", "add") })`);
out.rest = await ev(`(() => { const s = ${READ}; return s; })()`);
out.all_at_rest = IDS.every((o) => REST[o](out.rest[o]));
await shot("firefox-idle.png");
for (const s of IDS) {
  const c = await ev(`(() => { const b = document.querySelector('[data-hotspot="${s}"]').getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2]; })()`);
  await move(...c);
  await sleep(ARRIVE[s] * 0.5);
  const mid = await ev(READ);
  await sleep(ARRIVE[s] + SEQ[s] + 2600);
  const on = await ev(READ);
  await shot(`firefox-${s}.png`);
  await move(4, 900);
  await sleep(2200);
  const off = await ev(READ);
  out.stations[s] = { spark_mid: mid.sparks[s] > 0, hover: on.hover, powered: POWERED[s](on[s]), state: on[s], rest_after: IDS.every((o) => REST[o](off[o])) };
}
await goto("/lab-v2?station=experience");
const dl = await ev(READ);
out.direct_link = { selected: dl.selected, powered: POWERED.experience(dl.experience) };
await shot("firefox-deeplink.png");
out.errors = logs;
save("firefox.json", out);
console.log(JSON.stringify(out));
await send("browser.close").catch(() => {});
ws.close();
proc.kill();
process.exit(0);
