// Minimal page in Firefox: does a running descent survive the switch to the "on" rule?  Variants of that rule.
import { spawn } from "node:child_process"; import { mkdtempSync } from "node:fs"; import { tmpdir } from "node:os"; import { join } from "node:path";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); const PORT = 9335;
const proc = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", mkdtempSync(join(tmpdir(), "arssoftlab-ff-")), `--remote-debugging-port=${PORT}`, "about:blank"], { stdio: "ignore" });
let ws; for (let i = 0; i < 120 && !ws; i++) { await sleep(500); try { ws = await new Promise((ok, no) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/session`); w.onopen = () => ok(w); w.onerror = () => no(); }); } catch {} }
let n = 0; const pend = new Map(); ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.type === "error" ? no(new Error(m.error + " " + m.message)) : ok(m.result); } };
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++n; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
await send("session.new", { capabilities: {} }); const ctx = (await send("browsingContext.getTree")).contexts[0].context;
const ev = async (x) => JSON.parse((await send("script.evaluate", { expression: `(async () => JSON.stringify(await (${x})))()`, target: { context: ctx }, awaitPromise: true })).result.value);
const V = {
  "0s (as now)": ".on .f{transition:--x 0s}",
  "1ms": ".on .f{transition:--x 1ms}",
  "same 420ms": ".on .f{transition:--x 420ms linear}",
  "no on rule": "",
  "0s + delay 1ms": ".on .f{transition:--x 0s 1ms}",
  "0.001ms": ".on .f{transition:--x .001ms}",
};
for (const [name, rule] of Object.entries(V)) {
  const r = await ev(`(async () => {
    document.head.innerHTML = "<style>@property --c{syntax:'<number>';inherits:true;initial-value:0}@property --x{syntax:'<number>';inherits:true;initial-value:0}.c{--c:0;transition:none}.on .c{--c:1;transition:--c 300ms linear 600ms}.f{--x:max(var(--c),0);transition:--x 420ms linear}${rule}</style>";
    document.body.innerHTML = "<div id=r><div class=c><div class=f><b id=t>x</b></div></div></div>";
    const R = document.getElementById("r"), t = document.getElementById("t"), x = () => +(+getComputedStyle(t).getPropertyValue("--x")).toFixed(2), w = (ms) => new Promise((r) => setTimeout(r, ms));
    x(); R.className = "on"; await w(300); const early = x(); await w(800); const up = x(); R.className = ""; await w(150); const down = x(); R.className = "on"; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); const back = x(); await w(150); const later = x(); await w(230); const before = x(); await w(700); return { early, up, down, back, later, before, end: x() }; })()`);
  console.log(name.padEnd(16), JSON.stringify(r));
}
await send("browser.close").catch(() => {}); ws.close(); proc.kill(); process.exit(0);
