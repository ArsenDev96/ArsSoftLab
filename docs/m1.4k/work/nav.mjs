// M1.4I.1A probe: the lab's gate through every kind of route entry. Dev server on :3002.
//   node docs/m1.4i1/work/nav.mjs <label> [scenario...]   -> <label>.json, captures in <label>/
// The scenarios start on a page without the lab: a temporary test route with real next/link
// links (OTHER=/nav-test-tmp, removed after the run) or, without one, any 404 (OTHER=/nope).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, sleep } from "../../../scripts/visual/cdp.mjs";
import { POWERED, READ, REST } from "./lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE || "http://localhost:3002";
const OTHER = process.env.OTHER || "/nope";
const [label = "run", ...only] = process.argv.slice(2);
const CAP = join(HERE, label);
mkdirSync(CAP, { recursive: true });

const INSTRUMENT = `(() => {
  window.__doc = Math.random().toString(36).slice(2);
  const n = (window.__n = { raf: 0, decode: 0, gateTimers: [], listeners: 0, ro: 0 });
  const raf = window.requestAnimationFrame.bind(window);
  window.__raf = raf;
  window.requestAnimationFrame = (f) => { n.raf++; return raf(f); };
  const st = window.setTimeout.bind(window), ct = window.clearTimeout.bind(window);
  window.setTimeout = (f, ms, ...a) => {
    if (ms !== 4000) return st(f, ms, ...a);
    const rec = { state: "pending", at: Math.round(performance.now()) };
    const id = st((...x) => { rec.state = "fired"; f(...x); }, ms, ...a);
    rec.id = id; n.gateTimers.push(rec);
    return id;
  };
  window.clearTimeout = (id) => { const r = n.gateTimers.find((t) => t.id === id && t.state === "pending"); if (r) r.state = "cleared"; return ct(id); };
  const dec = HTMLImageElement.prototype.decode;
  HTMLImageElement.prototype.decode = function () { n.decode++; return dec.call(this); };
  const live = new Map();
  const add = EventTarget.prototype.addEventListener, rem = EventTarget.prototype.removeEventListener;
  const own = (t) => t === window || t === document || t instanceof MediaQueryList;
  EventTarget.prototype.addEventListener = function (type, f, o) {
    if (own(this) && f) { const k = type + (o === true || o?.capture ? "!" : ""); if (!live.has(this)) live.set(this, new Map()); const m = live.get(this); if (!m.has(k)) m.set(k, new Set()); m.get(k).add(f); }
    return add.call(this, type, f, o);
  };
  EventTarget.prototype.removeEventListener = function (type, f, o) {
    if (own(this)) live.get(this)?.get(type + (o === true || o?.capture ? "!" : ""))?.delete(f);
    return rem.call(this, type, f, o);
  };
  window.__listeners = () => { let c = 0; for (const m of live.values()) for (const s of m.values()) c += s.size; return c; };
  const RO = window.ResizeObserver;
  window.ResizeObserver = class extends RO {
    observe(...a) { if (!this.__o) { this.__o = 1; n.ro++; } return super.observe(...a); }
    disconnect() { if (this.__o) { this.__o = 0; n.ro--; } return super.disconnect(); }
  };
})()`;

const RULES = `[...(document.head?.querySelectorAll("style") ?? [])].filter((e) => e.textContent.includes(".lab-plate-gate{opacity:1}")).length`;
const OPACITY = `[...document.querySelectorAll(".lab-plate-gate")].map((e) => getComputedStyle(e).opacity).join()`;

const SHOWN = `(${RULES} > 0 && ${OPACITY} === "1,1")`;

const STATE = `(() => {
  const imgs = [...document.querySelectorAll(".lab-plate-gate img[data-gate]")];
  const s = document.querySelector(".lab-camera script");
  return {
    path: location.pathname + location.search, doc: window.__doc,
    opacity: ${OPACITY},
    gateImages: imgs.length, loaded: imgs.filter((i) => i.complete && i.naturalWidth).length,
    gateRules: ${RULES},
    script: s ? s.type || "(none)" : null,
    timers: window.__n.gateTimers.map((t) => t.state), decodes: window.__n.decode, listeners: window.__listeners(), observers: window.__n.ro,
  };
})()`;

async function session(opts = {}) {
  const page = await launch({ width: 1648, height: 928, gpu: true, ...opts });
  const errors = [];
  page.on((m) => {
    if (m.method === "Runtime.exceptionThrown") errors.push("exception: " + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 200));
    if (m.method === "Runtime.consoleAPICalled" && ["error", "warning", "assert"].includes(m.params.type)) errors.push(m.params.type + ": " + m.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 160));
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: INSTRUMENT });
  const log = [];
  const navMs = [];
  const ready = async () => {
    for (let i = 0; i < 600; i++) {
      if (await page.eval(`document.readyState === "complete" && !!window.next?.router && location.href !== "about:blank"`).catch(() => false)) return;
      await sleep(50);
    }
  };
  /** Wait for both gated layers (max 20 s) and report how the entry went. */
  const entry = async (name, t0) => {
    let shown = null;
    while (Date.now() - t0 < 20000) {
      if (await page.eval(SHOWN).catch(() => false)) {
        shown = Date.now() - t0;
        break;
      }
      await sleep(40);
    }
    for (let i = 0; i < 100; i++) {
      const s = await page.eval(STATE);
      if (s.gateImages && s.loaded === s.gateImages) break;
      await sleep(60);
    }
    const r = { entry: name, ok: shown !== null, ms: shown, routeMs: navMs.at(-1)?.[1] ?? null, ...(await page.eval(STATE)), errors: errors.splice(0) };
    log.push(r);
    return r;
  };
  const goto = async (p) => {
    const t = Date.now();
    await page.send("Page.navigate", { url: BASE + p });
    await sleep(150);
    return t;
  };
  const arrived = (p) =>
    p === "/" || p === "/lab-v2"
      ? `location.pathname === "${p}" && !!document.querySelector(".lab-plate-gate") && !!document.querySelector('[data-scene-variant="v2"]') === ${p === "/lab-v2"}`
      : `location.pathname === "${p}" && !document.querySelector(".lab-plate-gate")`;
  const waitPath = async (p) => {
    const t = Date.now();
    while (Date.now() - t < 40000) {
      if (await page.eval(arrived(p)).catch(() => false)) {
        navMs.push([p, Date.now() - t]);
        return;
      }
      await sleep(30);
    }
    throw new Error("never reached " + p + " " + JSON.stringify(await page.eval(`({ path: location.pathname, ready: document.readyState, gates: document.querySelectorAll(".lab-plate-gate").length, v2: !!document.querySelector('[data-scene-variant="v2"]'), doc: window.__doc, router: !!window.next?.router, text: document.body.innerText.slice(0, 120) })`).catch(String)) + " " + JSON.stringify(log.map((l) => [l.entry, l.ok])));
  };
  const other = async () => {
    await goto(OTHER);
    await ready();
    await sleep(800);
    errors.splice(0); // a 404's own console line is not the lab's
  };
  /** A client-side navigation: a real next/link when the page has one, else the App Router's push. */
  const client = async (p) => {
    const t = Date.now();
    const sel = [`a[data-nav="${p}"]`, ...(p === "/" ? [`header a[href="/"]`] : [])];
    const found = await page.eval(`${JSON.stringify(sel)}.find((s) => document.querySelector(s)) ?? null`);
    if (found) {
      const c = await page.center(found);
      await page.click(c.x, c.y);
    } else await page.eval(`(window.next.router.push(${JSON.stringify(p)}), 1)`);
    await waitPath(p);
    return t;
  };
  const hist = async (d, p) => {
    const t = Date.now();
    await page.eval(`(history.${d}(), 1)`);
    await waitPath(p);
    return t;
  };
  const off = () => page.mouseMove(4, 924);
  const rafPerFrame = () =>
    page.eval(`new Promise((r) => { const a = window.__n.raf; let f = 0; (function g() { if (++f <= 30) return window.__raf(g); r(+((window.__n.raf - a) / 30).toFixed(2)); })(); })`);
  /** Playground on and off again: power, arcade, and its frame loop (rAF calls per frame). */
  const activate = async () => {
    const v2 = await page.eval(`!!document.querySelector('[data-scene-variant="v2"]')`);
    await off();
    await sleep(400);
    const c = await page.center('[data-hotspot="playground"]');
    await page.mouseMove(c.x, c.y);
    const PROBE = `(() => ({
      arcade: document.querySelector(".lab-arcade")?.dataset.state ?? null,
      pw: Math.max(0, ...[...document.querySelectorAll('.lab-power-dim[data-power="playground"]')].map((e) => +getComputedStyle(e).getPropertyValue("--pw"))),
      hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
    }))()`;
    const until = async (cond) => {
      const t = Date.now();
      while (Date.now() - t < 10000) {
        if (await cond()) return Date.now() - t;
        await sleep(60);
      }
      return null;
    };
    const poweredMs = await until(async () => {
      const on = await page.eval(PROBE);
      return on.arcade === "running" && (v2 ? POWERED.playground((await page.eval(READ)).playground) : on.pw === 1);
    });
    const on = await page.eval(PROBE);
    const last = v2 && poweredMs === null ? (await page.eval(READ)).playground : undefined;
    const loops = await rafPerFrame();
    await off();
    const restMs = await until(async () => {
      const rest = await page.eval(PROBE);
      return rest.arcade === "off" && rest.hover === null && (v2 ? REST.playground((await page.eval(READ)).playground) : rest.pw === 0);
    });
    await sleep(700);
    const rest = await page.eval(PROBE);
    const r = { poweredMs, last, arcade: on.arcade, rafPerFrame: loops, restMs, arcadeAfter: rest.arcade, rafAtRest: await rafPerFrame(), errors: errors.splice(0) };
    log.at(-1).activation = r;
    return r;
  };
  const shot = async (file) => {
    await off();
    await page.eval(`(() => { const s = document.createElement("style"); s.id = "__hide"; s.textContent = "nextjs-portal{display:none!important}"; document.head.append(s); return document.fonts.ready.then(() => 1); })()`);
    await sleep(900);
    await page.freezeAnimations(0);
    await page.finishTransitions();
    await sleep(300);
    await page.screenshot(join(CAP, file));
    await page.eval(`(() => { document.getAnimations().forEach((a) => { if (!(a instanceof CSSTransition)) a.play(); }); document.getElementById("__hide").remove(); return 1; })()`);
  };
  const tryActivate = async () => {
    if (log.at(-1).ok) await activate();
  };
  return { page, log, errors, entry, goto, ready, other, client, hist, activate, tryActivate, shot, off };
}

const out = [];
const LABS = ["/", "/lab-v2"];
const slug = (p) => (p === "/" ? "home" : "v2");

const S = {
  async direct() {
    for (const p of LABS) {
      const s = await session();
      await s.entry(`direct ${p}`, await s.goto(p));
      await s.ready();
      await sleep(1500);
      await s.shot(`direct-${slug(p)}.png`);
      await s.activate();
      out.push({ scenario: "direct", log: s.log });
      await s.page.close();
    }
  },
  async client() {
    for (const p of LABS) {
      const s = await session();
      await s.other();
      const r = await s.entry(`${OTHER} -> ${p} (client)`, await s.client(p));
      await sleep(1500);
      await s.shot(`client-${slug(p)}.png`);
      if (r.ok) await s.activate();
      else {
        // Root cause: are the images fine, and is only the gate's script missing?
        r.experiment = await s.page.eval(`(async () => {
          const imgs = [...document.querySelectorAll(".lab-plate-gate img[data-gate]")];
          const dec = await Promise.all(imgs.map((i) => i.decode().then(() => 1, () => 0)));
          const before = ${OPACITY};
          const old = document.querySelector(".lab-camera script"), neu = document.createElement("script");
          neu.textContent = old.textContent; old.parentElement.append(neu);
          await new Promise((r) => setTimeout(r, 2500));
          const after = ${OPACITY};
          neu.remove();
          return { images: imgs.length, decodable: dec.reduce((a, b) => a + b, 0), opacityBefore: before, opacityAfterExecutingTheSameScript: after };
        })()`);
      }
      const t = Date.now();
      await s.page.send("Page.reload");
      for (let i = 0; i < 200 && (await s.page.eval("window.__doc").catch(() => r.doc)) === r.doc; i++) await sleep(50);
      await s.entry(`reload ${p}`, t);
      out.push({ scenario: "client", log: s.log });
      await s.page.close();
    }
  },
  async roundtrip() {
    for (const start of ["direct", "client"]) {
      const s = await session();
      if (start === "direct") {
        await s.entry("direct /", await s.goto("/"));
        await s.ready();
        await sleep(1200);
      } else {
        await s.other();
        await s.entry(`${OTHER} -> /`, await s.client("/"));
      }
      await s.tryActivate();
      for (const p of ["/lab-v2", "/"]) {
        await s.entry(`-> ${p}`, await s.client(p));
        await s.tryActivate();
      }
      out.push({ scenario: `roundtrip from ${start}`, log: s.log });
      await s.page.close();
    }
  },
  async history() {
    const s = await session();
    await s.other();
    await s.entry(`${OTHER} -> /`, await s.client("/"));
    await s.tryActivate();
    await s.hist("back", OTHER);
    await s.entry("Forward to /", await s.hist("forward", "/"));
    await s.tryActivate();
    await s.entry("-> /lab-v2", await s.client("/lab-v2"));
    await s.tryActivate();
    await s.entry("Back to /", await s.hist("back", "/"));
    await s.tryActivate();
    await s.entry("Forward to /lab-v2", await s.hist("forward", "/lab-v2"));
    await s.tryActivate();
    out.push({ scenario: "history", log: s.log });
    await s.page.close();
  },
  async historyDirect() {
    // Entered on the lab by a full load, left to a page without it, and back.
    for (const p of LABS) {
      const s = await session();
      await s.entry(`direct ${p}`, await s.goto(p));
      await s.ready();
      await sleep(1200);
      await s.client(OTHER);
      await sleep(400);
      await s.entry(`Back to ${p}`, await s.hist("back", p));
      await s.tryActivate();
      out.push({ scenario: "left and back", log: s.log });
      await s.page.close();
    }
  },
  async remount() {
    for (const p of LABS) {
      const s = await session();
      await s.other();
      for (let k = 1; k <= 6; k++) {
        const r = await s.entry(`mount ${k}: ${OTHER} -> ${p}`, await s.client(p));
        await s.tryActivate();
        await s.hist("back", OTHER);
        await sleep(500);
        r.afterUnmount = await s.page.eval(`({ listeners: window.__listeners(), observers: window.__n.ro, animations: document.getAnimations().length, timers: window.__n.gateTimers.map((t) => t.state) })`);
      }
      out.push({ scenario: `remount ${p}`, log: s.log });
      await s.page.close();
    }
  },
  async deep() {
    // A station's own address, and a station opened by hand, across Back and Forward.
    const sel = `document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null`;
    for (const p of LABS) {
      const s = await session();
      const note = async () => (s.log.at(-1).selected = await s.page.eval(sel));
      const arrive = async (q) => {
        for (let i = 0; i < 400 && (await s.page.eval("location.pathname + location.search")) !== q; i++) await sleep(30);
        for (let i = 0; i < 400 && !(await s.page.eval(`!!document.querySelector(".lab-plate-gate")`)); i++) await sleep(30);
      };
      await s.other();
      let t = Date.now();
      await s.page.eval(`(window.next.router.push("${p}?station=experience"), 1)`);
      await arrive(p + "?station=experience");
      await s.entry(`${OTHER} -> ${p}?station=experience`, t);
      await note();
      await s.hist("back", OTHER);
      t = await s.hist("forward", p);
      await s.entry("Back, Forward", t);
      await note();
      await s.hist("back", OTHER);
      await s.entry(`${OTHER} -> ${p}`, await s.client(p));
      await note();
      const c = await s.page.center('[data-hotspot="educational"]');
      await s.page.click(c.x, c.y);
      await sleep(1600);
      s.log.at(-1).afterClick = await s.page.eval(sel);
      await s.page.eval("(history.back(), 1)");
      await sleep(2500);
      await s.entry("Back closes the station", Date.now());
      await note();
      out.push({ scenario: "deep links", log: s.log });
      await s.page.close();
    }
  },
  async early() {
    // Leave before the gate opens (every scene image held back), then come back.
    for (const p of LABS) {
      const s = await session();
      await s.other();
      const held = [];
      const unhook = s.page.on((m) => m.method === "Fetch.requestPaused" && held.push(m.params.requestId));
      await s.page.send("Fetch.enable", { patterns: [{ urlPattern: "*/scene/*" }] });
      await s.client(p);
      await sleep(900);
      const during = await s.page.eval(STATE);
      await s.hist("back", OTHER);
      await sleep(400);
      const snap = `({ timers: window.__n.gateTimers.map((t) => t.state), rules: ${RULES} })`;
      const away = await s.page.eval(snap);
      for (const id of held.splice(0)) await s.page.send("Fetch.continueRequest", { requestId: id }).catch(() => {});
      await s.page.send("Fetch.disable");
      unhook();
      await sleep(4500);
      const later = await s.page.eval(snap);
      await s.entry(`${p} again after leaving early`, await s.hist("forward", p));
      await s.tryActivate();
      out.push({ scenario: "left before the gate opened", during: { opacity: during.opacity, loaded: during.loaded, of: during.gateImages, timers: during.timers }, away, later, log: s.log });
      await s.page.close();
    }
  },
  async stalled() {
    // Images that never arrive: the 4 s fallback must open the gate, as on a full load.
    for (const p of LABS)
      for (const how of ["direct", "client"]) {
        const s = await session();
        if (how === "client") await s.other();
        await s.page.send("Fetch.enable", { patterns: [{ urlPattern: "*/scene/*" }] });
        const t = how === "client" ? await s.client(p) : await s.goto(p);
        let shown = null;
        while (Date.now() - t < 20000 && shown === null) {
          if (await s.page.eval(SHOWN).catch(() => false)) shown = Date.now() - t;
          await sleep(50);
        }
        out.push({ scenario: `stalled images`, log: [{ entry: `stalled, ${how} ${p}`, ok: shown !== null, ms: shown, ...(await s.page.eval(STATE)), errors: s.errors.splice(0) }] });
        await s.page.close();
      }
  },
  async reduced() {
    for (const p of LABS)
      for (const how of ["direct", "client"]) {
        const s = await session({ reducedMotion: true });
        if (how === "client") {
          await s.other();
          await s.entry(`reduced: ${OTHER} -> ${p}`, await s.client(p));
        } else {
          await s.entry(`reduced: direct ${p}`, await s.goto(p));
          await s.ready();
          await sleep(1200);
        }
        if (s.log.at(-1).ok) {
          const c = await s.page.center('[data-hotspot="playground"]');
          await s.page.mouseMove(c.x, c.y);
          await sleep(1200);
          s.log.at(-1).reduced = await s.page.eval(`({
            hover: document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null,
            arcade: document.querySelector(".lab-arcade")?.dataset.state,
            lift: getComputedStyle(document.querySelector('.lab-lift[data-lift="playground"]')).transform,
            surgeRunning: document.getAnimations().filter((a) => a.effect?.target?.closest?.("[data-surge]") && a.playState === "running").length,
          })`);
          await s.off();
        }
        out.push({ scenario: "reduced", log: s.log });
        await s.page.close();
      }
  },
};

for (const k of only.length ? only : Object.keys(S)) {
  try {
    await S[k]();
  } catch (e) {
    out.push({ scenario: k, failed: String(e) });
  }
  writeFileSync(join(HERE, `${label}.json`), JSON.stringify(out, null, 1) + "\n");
}
for (const o of out) {
  console.log(`\n# ${o.scenario}`, o.failed ? "FAILED " + o.failed : "", o.during ? JSON.stringify({ during: o.during, away: o.away, later: o.later }) : "");
  for (const r of o.log ?? []) {
    console.log(`${r.ok ? "OK   " : "BLACK"} ${r.entry} | ${r.ms} ms op=${r.opacity} img=${r.loaded}/${r.gateImages} rules=${r.gateRules} script=${r.script} timers=${r.timers} dec=${r.decodes} lis=${r.listeners} ro=${r.observers} doc=${r.doc} err=${JSON.stringify(r.errors)}`);
    for (const k of ["activation", "afterUnmount", "experiment", "reduced", "selected", "afterClick"]) if (r[k]) console.log("      " + k, JSON.stringify(r[k]));
  }
}
process.exit(0);
