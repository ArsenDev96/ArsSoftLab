// M1.4I.1D: lightweight Firefox confirmation (WebDriver BiDi, headless). node docs/m1.4i1/work/qr-firefox.mjs
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASE, LIB, STATIONS, ending, judge, sleep, tally, visits } from "./qr-lib.mjs";
const PORT = 9333;
const proc = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", mkdtempSync(join(tmpdir(), "arssoftlab-ff-")), `--remote-debugging-port=${PORT}`, "--width", "1648", "--height", "928", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 120 && !ws; i++) { await sleep(500); try { ws = await new Promise((ok, no) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/session`); w.onopen = () => ok(w); w.onerror = () => no(); }); } catch {} }
if (!ws) { console.log("no BiDi connection"); proc.kill(); process.exit(1); }
let n = 0;
const pend = new Map(), logs = [];
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.type === "error" ? no(new Error(m.error + " " + m.message)) : ok(m.result); } else if (m.method === "log.entryAdded" && m.params.level === "error") logs.push(String(m.params.text).slice(0, 200)); };
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++n; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
const ses = await send("session.new", { capabilities: {} });
await send("session.subscribe", { events: ["log.entryAdded"] });
const ctx = (await send("browsingContext.getTree")).contexts[0].context;
await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1648, height: 928 }, devicePixelRatio: 1 }).catch(() => {});
const call = async (expr) => { const r = await send("script.evaluate", { expression: `(async () => JSON.stringify((await (${expr})) ?? null))()`, target: { context: ctx }, awaitPromise: true }); if (r.type === "exception") throw new Error(r.exceptionDetails.text); return JSON.parse(r.result.value); };
console.log("Firefox", ses.capabilities.browserVersion);
for (const id of Object.keys(STATIONS)) {
  await send("browsingContext.navigate", { context: ctx, url: BASE + "/lab-v2", wait: "complete" });
  await sleep(5000);
  await call(LIB(id));
  const runs = [];
  for (const at of [60, 160, 300, 450, 650, 1200]) for (const gap of [20, 100, 250]) { const log = await call(`window.__q.run(${at}, ${gap})`); runs.push({ ...judge(id, visits(id, log).at(-1)), ending: ending(id, log) }); }
  // Escape's hand-over: the selection goes, styles are flushed, the focus lands in the same task.
  const esc = await call(`(async () => { const q = window.__q, d = [...document.querySelectorAll("div.contents")].find((e) => e.querySelector(".lab-camera")); await q.until(() => q.rest(), 8000); d.setAttribute("data-lab-selected", "${id}"); await q.wait(1700); q.start(); await q.wait(100); d.removeAttribute("data-lab-selected"); d.setAttribute("data-lab-returning", "${id}"); getComputedStyle(document.querySelector(".${STATIONS[id].cls}-v2")).getPropertyValue("${STATIONS[id].nums[0]}"); document.body.offsetWidth; d.setAttribute("data-lab-hover", "${id}"); await q.wait(2000); const log = q.stop(); d.removeAttribute("data-lab-hover"); d.removeAttribute("data-lab-returning"); await q.wait(1200); return { min: Math.min(...log.flatMap((f) => Object.values(f.nums))), lights: log.filter((f) => Object.values(f.lights).some((v) => v > 0.02)).length, rest: q.rest() }; })()`);
  console.log(id, JSON.stringify(tally(id, runs)), "escape", JSON.stringify(esc));
}
console.log("errors", JSON.stringify(logs));
await send("browser.close").catch(() => {});
proc.kill();
process.exit(0);
