// Minimal Chrome DevTools Protocol driver for the visual checks.
// No dependencies: Node 22+ (built-in fetch + WebSocket) and a local Chrome/Edge.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = {
    win32: [
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
      "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ],
    linux: ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  }[process.platform] ?? [];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error("Chrome not found. Set CHROME_PATH to a Chrome or Edge executable.");
  return found;
}

/**
 * Launch headless Chrome and return a small page API.
 * `touch` emulates a touch-only phone (mobile viewport, touch events, no hover).
 * @param {{ width?: number, height?: number, reducedMotion?: boolean, gpu?: boolean, touch?: boolean }} opts
 */
export async function launch({ width = 1648, height = 928, reducedMotion = false, gpu = false, touch = false, profileDir = null, extraArgs = [] } = {}) {
  const profile = profileDir ?? mkdtempSync(join(tmpdir(), "arssoftlab-visual-"));
  if (profileDir) { mkdirSync(profileDir, { recursive: true }); try { rmSync(join(profileDir, "DevToolsActivePort")); } catch {} }
  const args = [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--window-size=${width},${height}`,
    "--no-first-run",
    "--no-default-browser-check",
    ...(gpu ? ["--enable-gpu", "--ignore-gpu-blocklist"] : []),
    ...extraArgs,
    "about:blank",
  ];
  const proc = spawn(findChrome(), args, { stdio: "ignore" });

  // Chrome writes the chosen port to DevToolsActivePort. Allow a slow cold
  // start (over 12 s has been seen on a busy Windows machine).
  let port;
  for (let i = 0; i < 600 && !port; i++) {
    try {
      port = readFileSync(join(profile, "DevToolsActivePort"), "utf8").split("\n")[0].trim();
    } catch {
      await sleep(100);
    }
  }
  if (!port) throw new Error("Chrome did not start (no DevToolsActivePort).");

  let target;
  for (let i = 0; i < 300 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((t) => t.type === "page");
    } catch {}
    if (!target) await sleep(100);
  }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let nextId = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((fn) => fn(msg));
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: touch });
  if (touch) await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 5 });
  // Always pin the preference: Chrome otherwise inherits the OS setting
  // (Windows "Animation effects" off reports reduce), which silently turns
  // every full-motion check into a reduced-motion one.
  await send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: reducedMotion ? "reduce" : "no-preference" }],
  });

  const page = {
    send,
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    async eval(expression) {
      const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      }
      return r.result.value;
    },

    /** Navigate and wait for fonts and decoded images. */
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const off = page.on((m) => {
          if (m.method === "Page.loadEventFired") {
            off();
            resolve();
          }
        });
      });
      await send("Page.navigate", { url });
      await loaded;
      await page.eval("document.fonts.ready.then(() => true)");
      for (let i = 0; i < 80; i++) {
        if (await page.eval("[...document.images].every((i) => i.complete && i.naturalWidth > 0)")) break;
        if (i === 79) throw new Error(`Images did not load at ${url}`);
        await sleep(125);
      }
      await page.eval("Promise.all([...document.images].map((i) => i.decode().catch(() => 0))).then(() => true)");
      await sleep(300);
    },

    async screenshot(path) {
      const r = await send("Page.captureScreenshot", { format: "png" });
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, Buffer.from(r.data, "base64"));
    },

    async key(key, code, keyCode) {
      const text = key === "Enter" ? "\r" : undefined;
      await send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: keyCode, ...(text ? { text } : {}) });
      await send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: keyCode });
    },

    async mouseMove(x, y) {
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
    },

    async click(x, y) {
      await page.mouseMove(x, y);
      await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
      await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
    },

    /** A single-finger tap (touch events; there is no hover on touch). */
    async tap(x, y) {
      await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    },

    /** Centre of the first element matching a selector. */
    async center(selector) {
      const r = await page.eval(
        `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`,
      );
      if (!r) throw new Error(`No element for ${selector}`);
      return r;
    },

    /** Pause every running CSS animation at `ms` (deterministic frames). */
    freezeAnimations(ms) {
      return page.eval(
        `document.getAnimations().filter((a) => !(a instanceof CSSTransition)).map((a) => { a.pause(); a.currentTime = ${ms}; }).length`,
      );
    },

    /** Jump every in-flight CSS transition to its end state. */
    finishTransitions() {
      return page.eval(`document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finish()).length`);
    },

    async close() {
      send("Browser.close").catch(() => {});
      await sleep(300);
      ws.close();
      proc.kill();
      try {
        if (!profileDir) rmSync(profile, { recursive: true, force: true });
      } catch {}
    },
  };
  return page;
}
