// M1.4I.1B: the quick return in Firefox (WebDriver BiDi, headless). node docs/m1.4i1/work/eng-firefox.mjs <label>
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "../../../scripts/visual/cdp.mjs";
import { ARRIVE, BASE, LIB, ending, judge, visits } from "./eng-return.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = 9333;
const proc = spawn("C:/Program Files/Mozilla Firefox/firefox.exe", ["--headless", "--no-remote", "--profile", mkdtempSync(join(tmpdir(), "arssoftlab-ff-")), `--remote-debugging-port=${PORT}`, "--width", "1648", "--height", "928", "about:blank"], { stdio: "ignore" });
let ws;
for (let i = 0; i < 120 && !ws; i++) {
  await sleep(500);
  try {
    ws = await new Promise((ok, no) => { const w = new WebSocket(`ws://127.0.0.1:${PORT}/session`); w.onopen = () => ok(w); w.onerror = () => no(); });
  } catch {}
}
if (!ws) { console.log("no BiDi connection"); proc.kill(); process.exit(1); }
let id = 0;
const pend = new Map(), logs = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { const { ok, no } = pend.get(m.id); pend.delete(m.id); m.type === "error" ? no(new Error(m.error + " " + m.message)) : ok(m.result); }
  else if (m.method === "log.entryAdded" && m.params.level === "error") logs.push(String(m.params.text).slice(0, 200));
};
const send = (method, params = {}) => new Promise((ok, no) => { const i = ++id; pend.set(i, { ok, no }); ws.send(JSON.stringify({ id: i, method, params })); });
const ses = await send("session.new", { capabilities: {} });
await send("session.subscribe", { events: ["log.entryAdded"] });
const ctx = (await send("browsingContext.getTree")).contexts[0].context;
await send("browsingContext.setViewport", { context: ctx, viewport: { width: 1648, height: 928 }, devicePixelRatio: 1 }).catch(() => {});
const call = async (expr) => {
  const r = await send("script.evaluate", { expression: `(async () => JSON.stringify((await (${expr})) ?? null))()`, target: { context: ctx }, awaitPromise: true });
  if (r.type === "exception") throw new Error(r.exceptionDetails.text);
  return JSON.parse(r.result.value);
};
await send("browsingContext.navigate", { context: ctx, url: BASE + "/lab-v2", wait: "complete" });
await sleep(6000);
await call(LIB);
const out = { version: ses.capabilities.browserVersion, runs: [], clean: null };
const first = await call(`(async () => { const q = window.__q; await q.until(() => q.rest(), 8000); q.start(); q.enter(); await q.wait(${ARRIVE} + 1400); q.leave(); await q.until(() => q.hov() === null); await q.wait(1000); return q.stop(); })()`);
out.first = { ...judge(visits(first)[0]), ending: ending(first), frames: first.length };
for (const at of [60, 160, 250, 350, 450, 560, 800])
  for (const gap of [5, 60, 140, 240, 360]) {
    const log = await call(`window.__q.run(${at}, ${gap})`);
    const v = visits(log);
    out.runs.push({ at, gap, visits: v.length, frames: log.length, ...judge(v.at(-1)), ending: ending(log) });
  }
out.errors = logs;
writeFileSync(join(HERE, `eng-firefox-${process.argv[2] ?? "run"}.json`), JSON.stringify(out) + "\n");
const n = (f) => out.runs.filter(f).length;
console.log("Firefox", out.version, "first", JSON.stringify(out.first));
console.log(`runs ${out.runs.length} premature ${n((r) => r.premature)} scan ${n((r) => r.scan)} caps ${n((r) => r.caps)} pulse ${n((r) => r.pulse)} held ${n((r) => r.held)} tail ${n((r) => r.tail)} rose ${n((r) => r.rose)} frozen ${n((r) => r.after.frozenScan)} fromMid ${n((r) => r.after.scanFrom > 0.2)} notPowered ${n((r) => !r.powered)} notRest ${n((r) => !r.ending.rest)} errors ${JSON.stringify(logs)}`);
for (const r of out.runs.filter((r) => r.premature || !r.powered || !r.ending.rest).slice(0, 12)) console.log("  ", JSON.stringify(r).slice(0, 420));
await send("browser.close").catch(() => {});
proc.kill();
process.exit(0);
