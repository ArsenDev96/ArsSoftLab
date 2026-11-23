// M1.4I integration review: shared helpers (review only; nothing here is used by the app).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";

export { sleep, launch };
export const WORK = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(WORK, "../../..");
export const CAP = join(WORK, "captures");
export const BASE = process.env.BASE || "http://localhost:3002";
export const IDS = ["engineering", "educational", "playground", "creative", "experience"];
export const ARRIVE = { educational: 460, engineering: 620, playground: 650, creative: 640, experience: 660 };
/** Longest station sequence after the arrival (ms). */
export const SEQ = { engineering: 600, educational: 820, playground: 900, creative: 800, experience: 1000 };
mkdirSync(CAP, { recursive: true });

export const save = (name, data) => writeFileSync(join(WORK, name), JSON.stringify(data, null, 1) + "\n");

// Every number the five activations run on, read in one go. Values are at rest when the page is idle.
export const READ = `(() => {
  const num = (el) => { const c = getComputedStyle(el); return (v) => +(+c.getPropertyValue(v)).toFixed(3); };
  const op = (sel) => { const e = document.querySelector(sel); return e ? +(+getComputedStyle(e).opacity).toFixed(3) : null; };
  const max = (sel) => { let m = 0; for (const e of document.querySelectorAll(sel)) m = Math.max(m, +getComputedStyle(e).getPropertyValue("--pw") || 0); return +m.toFixed(3); };
  const shown = (sel, gate) => { const e = document.querySelector(sel); if (!e) return 0; let o = +getComputedStyle(e).opacity; const g = gate && e.closest(gate); if (g) o *= +getComputedStyle(g).opacity; return +o.toFixed(3); };
  const e = num(document.querySelector(".eng-v2")), d = num(document.querySelector(".edu-v2")), c = num(document.querySelector(".cre-v2")), x = num(document.querySelector(".exp-v2"));
  const lift = document.querySelector('.lab-lift[data-lift="playground"]');
  const t = getComputedStyle(lift).transform;
  const sparks = {};
  for (const g of document.querySelectorAll("[data-surge]")) {
    const head = g.querySelector('[data-pass="core"] [data-surge-head]');
    sparks[g.dataset.surge] = +(+getComputedStyle(g).opacity * +getComputedStyle(head).opacity).toFixed(3);
  }
  return {
    hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    selected: document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null,
    sparks,
    engineering: { pw: max('.lab-power-dim[data-power="engineering"]'), floor: max(".eng-floor"), es: e("--es"), ef: e("--ef"), ed: e("--ed"), bars: +Array.from({ length: 11 }, (_, k) => e("--eb" + k)).reduce((a, b) => a + b, 0).toFixed(2), scan: op(".eng-scan-band"), screenOff: op(".eng-screen-off"), caps: op(".eng-caps") },
    educational: { pw: max('.lab-power-dim[data-power="educational"]'), floor: max(".edu-floor"), gp: d("--gp"), gs: d("--gs"), go: d("--go"), light: +(shown(".edu-pulse-base", ".edu-gate") + shown(".edu-crest", ".edu-gate") + shown(".edu-light", ".edu-gate")).toFixed(3) },
    creative: { pw: max('.lab-power-dim[data-power="creative"]'), floor: max(".cre-floor"), cw: c("--cw"), cs: c("--cs"), cg: c("--cg"), light: +(shown(".cre-warm", ".cre-gate") + shown(".cre-crest", ".cre-gate") + shown(".cre-glints", ".cre-gate")).toFixed(3) },
    experience: { pw: max('.lab-power-dim[data-power="experience"]'), floor: max(".exp-floor"), xs: x("--xs"), light: shown(".exp-light", ".exp-gate") },
    playground: { lift: t === "none" ? 0 : +(-new DOMMatrix(t).f / (lift.offsetWidth / 1672)).toFixed(2), stripOff: op(".lab-v2-strip-off"), lit: op('[data-v2-ring="playground"] .lab-v2-power-lit'), arcade: op(".lab-arcade") },
  };
})()`;

export const REST = {
  engineering: (s) => s.pw === 0 && s.floor === 0 && s.ef === 0 && s.bars === 0 && s.scan === 0 && s.es === 0,
  educational: (s) => s.pw === 0 && s.floor === 0 && s.gp === 0 && s.gs === 0 && s.go === 0 && s.light === 0,
  creative: (s) => s.pw === 0 && s.floor === 0 && s.cs === 0 && s.cg === 0 && s.cw === 0 && s.light === 0,
  experience: (s) => s.pw === 0 && s.floor === 0 && s.xs === 0 && s.light === 0,
  playground: (s) => s.lift === 0 && s.stripOff === 1 && s.lit === 0 && s.arcade === 0,
};
export const POWERED = {
  engineering: (s) => s.pw === 1 && s.floor === 1 && s.ef === 1 && s.bars === 11 && s.scan === 0 && s.es === 1,
  educational: (s) => s.pw === 1 && s.floor === 1 && s.gs === 1 && s.go === 1 && s.light === 0,
  creative: (s) => s.pw === 1 && s.floor === 1 && s.cs === 1 && s.light === 0,
  experience: (s) => s.pw === 1 && s.floor === 1 && s.xs === 1 && s.light === 0,
  playground: (s) => s.lift === 18 && s.stripOff === 0 && s.lit === 1 && s.arcade === 1,
};

export async function open(path = "/lab-v2", opts = {}) {
  const page = await launch({ width: 1648, height: 928, ...opts });
  const errors = [];
  const requests = [];
  await page.send("Network.enable");
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails?.exception?.description ?? m.params.exceptionDetails?.text);
    if (m.method === "Runtime.consoleAPICalled" && (m.params.type === "error" || m.params.type === "warning")) errors.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 400));
    if (m.method === "Network.requestWillBeSent") requests.push(m.params.request.url);
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) errors.push(`HTTP ${m.params.response.status} ${m.params.response.url}`);
  });
  await page.goto(BASE + path);
  await page.eval(`(() => { const s = document.createElement("style"); s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return 1; })()`);
  const H = opts.height ?? 928;
  await page.mouseMove(4, H - 4);
  await sleep(1200);
  const cam = await page.eval(`(() => { const b = document.querySelector(".lab-camera").getBoundingClientRect(); return { x: b.left, y: b.top, k: b.width / 1672 }; })()`);
  const frame = () => page.eval(`new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`);
  const seek = (t) => page.eval(`(() => { document.getAnimations().forEach((a) => { a.pause(); a.currentTime = ${t}; }); return 1; })()`).then(frame);
  const finish = () => page.eval(`(() => { document.getAnimations().forEach((a) => { try { a.finish(); } catch { a.pause(); a.currentTime = 0; } }); return 1; })()`).then(frame);
  const shot = async (file, r = null, scale = 1) => {
    const p = r
      ? { format: "png", clip: { x: Math.max(0, cam.x + r.x * cam.k), y: Math.max(0, cam.y + r.y * cam.k), width: r.w * cam.k, height: r.h * cam.k, scale } }
      : { format: "png" };
    const f = join(CAP, file);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, Buffer.from((await page.send("Page.captureScreenshot", p)).data, "base64"));
  };
  const hover = async (id) => {
    const c = await page.center(`[data-hotspot="${id}"]`);
    await page.mouseMove(c.x, c.y);
  };
  const off = () => page.mouseMove(4, H - 4);
  const away = async () => {
    await off();
    for (let i = 0; i < 100 && (await page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`)); i++) await sleep(10);
  };
  const read = () => page.eval(READ);
  const settle = async (cond, ms = 6000) => {
    for (let t = 0; t < ms; t += 60) {
      if (cond(await read())) return true;
      await sleep(60);
    }
    return false;
  };
  return { page, errors, requests, cam, frame, seek, finish, shot, hover, off, away, read, settle };
}

/** Start logging every frame: [ms since start, state]. Returns helpers. */
export async function logger(page) {
  await page.eval(`(() => { window.__log = []; const read = () => ${READ}; const t0 = performance.now(); (function f() { window.__log.push([Math.round(performance.now() - t0), read()]); requestAnimationFrame(f); })(); return 1; })()`);
  return {
    mark: () => page.eval("window.__log.length"),
    since: async (n) => JSON.parse(await page.eval(`JSON.stringify(window.__log.slice(${n}))`)),
    last: () => page.eval("window.__log[window.__log.length - 1]"),
  };
}

/** Wait until the last logged frame satisfies `cond`. */
export async function until(log, cond, ms = 5000) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const s = await log.last();
    if (s && cond(s[1], s[0])) return s;
    await sleep(6);
  }
  return null;
}
