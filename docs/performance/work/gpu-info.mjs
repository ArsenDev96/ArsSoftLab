// Animation lag diagnosis: Chrome's GPU status (SystemInfo.getInfo on the browser target), with the review probes' flags
// and with Chrome's defaults.   node gpu-info.mjs   -> gpu-info.json
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findChrome, sleep } from "../../../scripts/visual/cdp.mjs";
const HERE = dirname(fileURLToPath(import.meta.url));
const out = {};
for (const [name, extra] of [["probe flags (--enable-gpu --ignore-gpu-blocklist)", ["--enable-gpu", "--ignore-gpu-blocklist"]], ["Chrome defaults", []], ["Chrome defaults, headed", null]]) {
  const profile = mkdtempSync(join(tmpdir(), "arssoftlab-gpuinfo-"));
  const headed = extra === null;
  const proc = spawn(findChrome(), [...(headed ? [] : ["--headless=new"]), "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=400,300", ...(extra ?? []), "about:blank"], { stdio: "ignore" });
  let port, path;
  for (let i = 0; i < 300 && !port; i++) { try { [port, path] = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n").map((s) => s.trim()); } catch { await sleep(100); } }
  const ws = new WebSocket(`ws://127.0.0.1:${port}${path}`); await new Promise((r) => (ws.onopen = r));
  const info = await new Promise((r) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === 1) r(m.result); }; ws.send(JSON.stringify({ id: 1, method: "SystemInfo.getInfo" })); });
  const g = info.gpu, a = g.auxAttributes ?? {};
  out[name] = { devices: g.devices.map((d) => ({ vendor: d.vendorString || d.vendorId, device: d.deviceString || d.deviceId, driver: d.driverVersion })), featureStatus: g.featureStatus, glRenderer: a.glRenderer, glVersion: a.glVersion, angle: a.displayType ?? a.glImplementationParts, skia: a.skiaBackendType ?? null, softwareRendering: a.softwareRendering ?? null, workarounds: g.driverBugWorkarounds.length };
  console.log("==", name); console.log(JSON.stringify(out[name], null, 1));
  ws.close(); proc.kill(); await sleep(500); try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
writeFileSync(join(HERE, "gpu-info.json"), JSON.stringify(out, null, 1) + "\n"); process.exit(0);
