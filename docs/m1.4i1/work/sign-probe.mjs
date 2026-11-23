// M1.4I.1C probe: Playground's sign, hover / click / paths / hit map. Dev server on :3002.
//   node docs/m1.4i1/work/sign-probe.mjs <label> [map|timing|click|paths|reenter|game|keyboard|neighbours|reduced|home ...]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { IDS, POWERED, REST, logger, open, sleep } from "../../m1.4i/work/lib.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [label = "run", ...only] = process.argv.slice(2);
const out = {};

// The sign's panel (scene px, sign-geometry.mjs), at rest; and where the lift takes a point.
const PANEL = [[1159.5, 331], [1232.5, 333], [1231, 349], [1154.4, 350]];
const lifted = ([x, y]) => [1218 + (x - 1218) * 1.01, 547 + (y - 547) * 1.01 - 18];
const SIGN = [1193, 340], SIGN_UP = lifted(SIGN), BODY = [1205, 440], PLATFORM = [1215, 530], SCREEN = [1200, 397], WALL = [1090, 330];
const inside = (p, [x, y]) => { let r = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) if (p[i][1] > y !== p[j][1] > y && x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]) r = !r; return r; };

async function lab(path = "/lab-v2", opts = {}) {
  const L = await open(path, { gpu: true, ...opts });
  const k = L.cam.k;
  const S = ([x, y]) => [L.cam.x + x * k, L.cam.y + y * k];
  const to = (p) => L.page.mouseMove(...S(p));
  /** A straight move at a steady speed (one event per ~8 ms). */
  const glide = async (a, b, ms) => {
    const t0 = performance.now();
    for (;;) {
      const f = Math.min(1, (performance.now() - t0) / ms);
      await to([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
      if (f === 1) break;
      await sleep(6);
    }
  };
  // Every change of the hovered / selected station, with its time.
  await L.page.eval(`(() => { window.__h = []; const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents"); const now = () => { const v = (d.dataset.labHover ?? "-") + "/" + (d.dataset.labSelected ?? "-"); if (window.__h.at(-1)?.[1] !== v) window.__h.push([Math.round(performance.now()), v]); }; new MutationObserver(now).observe(d, { attributes: true }); now(); return 1; })()`);
  const mark = () => L.page.eval("(window.__h = window.__h.slice(-1), 1)");
  const changes = () => L.page.eval("window.__h.map((x) => x[1])");
  const hov = () => L.page.eval(`document.querySelector("[data-lab-hover]")?.dataset.labHover ?? null`);
  const park = async () => { await L.off(); await L.settle((s) => REST.playground(s.playground) && s.hover === null); await sleep(300); };
  return { ...L, S, to, glide, mark, changes, hov, park, at: (p) => L.page.eval(`(() => { const e = document.elementFromPoint(${S(p).join(",")}); return e?.dataset.hotspot ?? (e?.closest("[data-station]") ? "label:" + e.closest("[data-station]").dataset.station : null); })()`) };
}

/** Station under every pixel of a box, as rows of characters. */
const mapOf = (L, x0, y0, x1, y1, step) =>
  L.page.eval(`(() => { const rows = []; for (let y = ${y0}; y <= ${y1}; y += ${step}) { let r = ""; for (let x = ${x0}; x <= ${x1}; x += ${step}) { const e = document.elementFromPoint(${L.cam.x} + (x + 0.01) * ${L.cam.k}, ${L.cam.y} + (y + 0.01) * ${L.cam.k}); const h = e?.dataset?.hotspot, s = e?.closest?.("[data-station]")?.dataset.station; r += h ? h === "engineering" ? "e" : h === "educational" ? "d" : h === "playground" ? "p" : h === "creative" ? "c" : "x" : s ? "L" : e?.closest?.("header,a,button") ? "N" : "."; } rows.push(r); } return rows; })()`);
/** Scene-px distance from the artwork's silhouette, over the same box (0 = on the artwork). */
const artMask = (L, x0, y0, x1, y1) =>
  L.page.eval(`(async () => { const i = document.querySelector('[data-v2-object="playground"]'); const m = new DOMMatrix(getComputedStyle(i).transform), k = i.offsetWidth / 1672; const c = document.createElement("canvas"); c.width = i.naturalWidth; c.height = i.naturalHeight; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, r = 1672 / c.width; const rows = []; for (let y = ${y0}; y <= ${y1}; y++) { let s = ""; for (let x = ${x0}; x <= ${x1}; x++) { const px = Math.round((x - m.e / k) / m.a / r), py = Math.round((y - m.f / k) / m.a / r); s += px >= 0 && py >= 0 && px < c.width && py < c.height && d[(py * c.width + px) * 4 + 3] > 100 ? "#" : "."; } rows.push(s); } return rows; })()`);

const T = {
  async map() {
    const L = await lab();
    const B = [1120, 290, 1310, 366];
    const art = await artMask(L, B[0], B[1], B[2], 400);
    const measure = (rows, up) => {
      const hit = (x, y) => rows[y - B[1]]?.[x - B[0]] === "p";
      // Artwork at the same place (lifted: look up where this point comes from).
      const isArt = (x, y) => { const [X, Y] = up ? [1218 + (x - 1218) / 1.01, 547 + (y + 18 - 547) / 1.01] : [x, y]; return art[Math.round(Y) - B[1]]?.[Math.round(X) - B[0]] === "#"; };
      const poly = up ? PANEL.map(lifted) : PANEL;
      let sign = 0, signHit = 0, above = 0, off = 0, worst = 0, sliver = 0, labels = 0;
      for (let y = B[1]; y <= B[3]; y++)
        for (let x = B[0]; x <= B[2]; x++) {
          if (inside(poly, [x, y])) { sign++; if (hit(x, y)) signHit++; }
          if (rows[y - B[1]][x - B[0]] === "L") labels++;
          if (hit(x, y) && y < 352) {
            above++;
            if (!isArt(x, y)) {
              off++;
              if (x > 1262) sliver++;
              let d = 99;
              for (let r = 1; r < 24 && d === 99; r++) for (let dy = -r; dy <= r && d === 99; dy++) for (let dx = -r; dx <= r; dx++) if (Math.hypot(dx, dy) <= r && isArt(x + dx, y + dy)) { d = r; break; }
              if (x <= 1262) worst = Math.max(worst, d);
            }
          }
        }
      return { signPx: sign, signHit, signCovered: +(signHit / sign).toFixed(4), hotspotPxAbove352: above, ofWhichOffArtwork: off, ofWhichToTheRightTowardsTheLabel: sliver, farthestOffArtworkElsewherePx: worst, labelPx: labels };
    };
    const rest = await mapOf(L, ...B, 1);
    out.map = { rest: measure(rest, false) };
    await L.to(BODY);
    await L.settle((s) => POWERED.playground(s.playground));
    const up = await mapOf(L, ...B, 1);
    out.map.lifted = measure(up, true);
    writeFileSync(join(HERE, `sign-map-${label}.json`), JSON.stringify({ box: B, art, rest, up }) + "\n");
    // The whole scene, every 4 px, at rest: which station owns what.
    await L.park();
    const whole = await mapOf(L, 2, 2, 1670, 938, 4);
    out.map.whole = Object.fromEntries([..."edpcxLN."].map((c) => [c, whole.join("").split(c).length - 1]));
    writeFileSync(join(HERE, `sign-whole-${label}.json`), JSON.stringify(whole) + "\n");
    out.map.errors = L.errors;
    await L.page.close();
  },
  /** The sequence, entered at the body and at the sign: ms after the hover. */
  async timing() {
    const L = await lab();
    out.timing = {};
    for (const [name, p] of [["body", BODY], ["sign", SIGN], ["body again", BODY], ["sign again", SIGN]]) {
      await L.park();
      const log = await logger(L.page);
      const m = await log.mark();
      await L.to(p);
      await sleep(2300);
      const fr = (await log.since(m)).filter(([, s]) => s.hover === "playground");
      const t0 = fr[0]?.[0];
      const first = (c) => { const f = fr.find(([, s]) => c(s)); return f ? f[0] - t0 : null; };
      out.timing[name] = fr.length ? { spark: first((s) => s.sparks.playground > 0.02), stripStarts: first((s) => s.playground.stripOff < 0.98), liftStarts: first((s) => s.playground.lift > 0.05), liftDone: first((s) => s.playground.lift >= 17.99), lift: fr.at(-1)[1].playground.lift, arcade: fr.at(-1)[1].playground.arcade, others: fr.filter(([, s]) => IDS.some((o) => o !== "playground" && s.sparks[o] > 0.02)).length } : "no hover";
      await L.page.eval("(window.__log = [], 1)");
    }
    await L.park();
    out.timing.rest = REST.playground((await L.read()).playground);
    await L.page.close();
  },
  async click() {
    out.click = {};
    for (const [name, p] of [["sign", SIGN], ["body", BODY]]) {
      const L = await lab();
      await L.to(p);
      await sleep(1800);
      const s = L.S(p);
      await L.page.click(...s);
      await sleep(1600);
      const r = { hit: await L.at(p), changes: await L.changes(), url: await L.page.eval("location.pathname + location.search"), panel: await L.page.eval(`document.querySelector("[data-station-panel][data-open]")?.dataset.stationPanel ?? null`), focus: await L.page.eval("document.activeElement?.id || null") };
      // Again on the sign where the camera now shows it: it stays selected.
      const q = await L.page.eval(`(() => { const i = document.querySelector('[data-v2-object="playground"]').getBoundingClientRect(), k = i.width / (1672 * 0.38848); return [i.left + (${p[0]} - 818.06) * k, i.top + (${p[1]} - 247.48) * k]; })()`);
      r.hitZoomed = await L.page.eval(`document.elementFromPoint(${q.join(",")})?.dataset.hotspot ?? null`);
      await L.page.click(...q);
      await sleep(700);
      r.afterSecondClick = await L.page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null`);
      await L.off();
      await L.page.key("Escape", "Escape", 27);
      await sleep(1500);
      r.afterEscape = await L.page.eval(`[document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, document.activeElement?.id ?? null, location.pathname + location.search]`);
      r.errors = L.errors;
      out.click[name] = r;
      await L.page.close();
    }
    // A click on the sign while the spark is still travelling.
    const L = await lab();
    await L.to(SIGN);
    await sleep(300);
    await L.page.click(...L.S(SIGN));
    await sleep(1800);
    out.click.duringCharge = { changes: await L.changes(), powered: POWERED.playground((await L.read()).playground) };
    await L.page.close();
  },
  /** Straight moves; every hover change is a restart. One entry expected: "-/-" then "playground/-". */
  async paths() {
    const L = await lab();
    out.paths = [];
    const TITLE = [1330, 336], TITLE_UP = [1330, 316], CHIP = [1316, 369], CHIP_UP = [1316, 349];
    const P = [];
    for (const ms of [120, 250, 400, 800, 1500]) {
      P.push(["charging: body -> sign -> platform", ms, [BODY, SIGN, PLATFORM], 60]);
      P.push(["charging: sign -> body -> sign", ms, [SIGN, BODY, SIGN], 60]);
      P.push(["lifted: body -> raised sign -> body", ms, [BODY, SIGN_UP, BODY], 2000]);
      P.push(["lifted: raised sign -> resting sign -> platform", ms, [SIGN_UP, SIGN, PLATFORM], 2000, SIGN]);
      P.push(["lifted: raised sign -> title", ms, [SIGN_UP, TITLE_UP], 2000, SIGN]);
      P.push(["lifted: sign -> chip", ms, [SIGN, CHIP_UP], 2000]);
      P.push(["charging: sign -> title", ms, [SIGN, TITLE], 60]);
      P.push(["charging: sign -> chip", ms, [SIGN, CHIP], 60]);
      P.push(["lifted: title -> raised sign", ms, [TITLE_UP, SIGN_UP], 2000, BODY]);
    }
    for (const [name, ms, pts, wait, start] of P) {
      await L.park();
      await L.to(start ?? pts[0]);
      await sleep(wait);
      const entered = await L.hov();
      if (start) { await L.glide(start, pts[0], 250); await sleep(120); }
      await L.mark();
      let end = null;
      for (let i = 1; i < pts.length; i++) await L.glide(pts[i - 1], pts[i], ms);
      await sleep(300);
      end = await L.hov();
      const ch = await L.changes();
      out.paths.push({ name, ms, entered, changes: ch, drops: ch.filter((c) => c === "-/-").length - (ch[0] === "-/-" ? 1 : 0), end });
    }
    // Control: the label alone (the sign never involved). It rises with the station, away from a pointer that stays.
    out.labelAlone = [];
    for (const [name, p] of [["title's lower half, resting position", [1330, 337]], ["title's upper part", [1330, 326]], ["chip's lower half, resting position", [1316, 369]], ["chip's upper part", [1316, 358]]]) {
      await L.park();
      await L.mark();
      await L.to(p);
      await sleep(2600);
      const ch = await L.changes();
      out.labelAlone.push({ name, changes: ch, drops: ch.filter((c) => c === "-/-").length - 1 });
    }
    // Resting on the raised sign's upper edge: nothing oscillates.
    await L.park();
    await L.to(BODY);
    await sleep(2000);
    await L.glide(BODY, lifted([1193, 333]), 500);
    await L.mark();
    await sleep(2500);
    out.restOnRaisedSign = { changes: await L.changes(), lift: (await L.read()).playground.lift };
    // Straight onto the wall just above the resting sign, where the raised one will be: not a target while it is down.
    await L.park();
    await L.mark();
    await L.to([1193, 310]);
    await sleep(1500);
    out.wallAboveRestingSign = { changes: await L.changes() };
    out.pathErrors = L.errors;
    await L.page.close();
  },
  /** Leaving from the sign, and coming back quickly. */
  async reenter() {
    const L = await lab();
    out.reenter = [];
    for (const gap of [40, 120, 180, 260, 400, 700]) {
      await L.park();
      await L.to(SIGN);
      await sleep(1700);
      await L.mark();
      await L.to(WALL);
      await sleep(gap);
      await L.to(SIGN);
      await sleep(2200);
      const s = (await L.read()).playground;
      out.reenter.push({ gap, changes: await L.changes(), powered: POWERED.playground(s), lift: s.lift });
    }
    await L.mark();
    await L.to(WALL);
    const rest = await L.settle((s) => REST.playground(s.playground) && s.hover === null);
    out.leave = { changes: await L.changes(), rest };
    await L.page.close();
  },
  /** The cabinet's game: running and drawing, with the pointer on the sign, the screen and the body. */
  async game() {
    const L = await lab();
    const hash = `(() => { const c = document.querySelector(".lab-arcade canvas"), d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 37) h = (h * 31 + d[i]) | 0; return h; })()`;
    await L.to(SIGN);
    await sleep(2400);
    out.game = { fromSign: await L.page.eval(`document.querySelector(".lab-arcade").dataset.state`), frames: [], pointerEvents: await L.page.eval(`[getComputedStyle(document.querySelector(".lab-arcade")).pointerEvents, getComputedStyle(document.querySelector(".lab-arcade canvas")).pointerEvents]`) };
    for (const p of [SIGN, SCREEN, SIGN_UP, BODY]) {
      await L.glide(SIGN, p, 200);
      const a = await L.page.eval(hash);
      await sleep(250);
      out.game.frames.push((await L.page.eval(hash)) !== a);
    }
    out.game.state = await L.page.eval(`document.querySelector(".lab-arcade").dataset.state`);
    out.game.changes = await L.changes();
    await L.page.close();
  },
  async keyboard() {
    const L = await lab();
    const order = [];
    for (let i = 0; i < 40; i++) {
      await L.page.key("Tab", "Tab", 9);
      await sleep(40);
      const f = await L.page.eval(`(() => { const e = document.activeElement; return !e || e === document.body ? null : (e.id || e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 30); })()`);
      if (f === null || (i && f === order[0])) break;
      order.push(f);
    }
    out.keyboard = { order, count: order.length, tabbable: await L.page.eval(`document.querySelectorAll('a[href],button,[tabindex]:not([tabindex="-1"])').length`), hotspots: await L.page.eval(`[...document.querySelectorAll("[data-hotspot]")].map((e) => [e.dataset.hotspot, e.getAttribute("aria-hidden"), e.tabIndex, e.getAttribute("role")].join())`) };
    await L.page.eval("(document.activeElement.blur(), 1)");
    await L.park();
    await L.page.eval(`(document.getElementById("station-playground-trigger").previousElementSibling, 1)`);
    for (let i = 0; i < 40; i++) { await L.page.key("Tab", "Tab", 9); if (await L.page.eval(`document.activeElement?.id === "station-playground-trigger"`)) break; }
    await sleep(2000);
    const focused = POWERED.playground((await L.read()).playground);
    await L.page.key("Enter", "Enter", 13);
    await sleep(1400);
    const selected = await L.page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null`);
    await L.page.key("Escape", "Escape", 27);
    await sleep(1400);
    Object.assign(out.keyboard, { focused, selected, escape: await L.page.eval(`[document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null, document.activeElement?.id]`), errors: L.errors });
    await L.page.close();
  },
  async neighbours() {
    const L = await lab();
    out.neighbours = {};
    for (const id of IDS) {
      await L.hover(id);
      const powered = await L.settle((s) => POWERED[id](s[id]) && s.hover === id);
      await L.away();
      out.neighbours[id] = { powered, rest: await L.settle((s) => REST[id](s[id])) };
    }
    // Title and chip of Playground are still their own targets.
    for (const [n, p] of [["title", [1330, 336]], ["chip", [1316, 369]]]) { await L.park(); out.neighbours[n] = await L.at(p); }
    await L.park();
    await L.page.click(...L.S([1316, 369]));
    await sleep(1500);
    out.neighbours.chipClick = await L.page.eval("location.pathname + location.search");
    out.neighbours.errors = L.errors;
    await L.page.close();
  },
  async reduced() {
    const L = await lab("/lab-v2", { reducedMotion: true });
    await L.to(SIGN);
    await sleep(900);
    const s = (await L.read()).playground;
    out.reduced = { hover: await L.hov(), lift: s.lift, stripOff: s.stripOff, arcade: await L.page.eval(`document.querySelector(".lab-arcade").dataset.state`), aboveSign: await L.at([1193, 310]), sign: await L.at(SIGN) };
    await L.page.click(...L.S(SIGN));
    await sleep(600);
    out.reduced.selected = await L.page.eval(`document.querySelector("[data-lab-selected]")?.dataset.labSelected ?? null`);
    await L.page.close();
  },
  /** The homepage's hotspots, every 4 px, and its markup. */
  async home() {
    const L = await lab("/").catch(async () => null);
    const whole = await mapOf(L, 2, 2, 1670, 938, 4);
    out.home = { map: whole.join("").split("p").length - 1, style: await L.page.eval(`document.querySelector('[data-hotspot="playground"]').getAttribute("style")`) };
    writeFileSync(join(HERE, `sign-home-${label}.json`), JSON.stringify(whole) + "\n");
    await L.page.close();
  },
};

for (const k of only.length ? only : Object.keys(T)) {
  try {
    await T[k]();
  } catch (e) {
    out[k] = { failed: String(e.stack ?? e).slice(0, 400) };
  }
  writeFileSync(join(HERE, `sign-${label}.json`), JSON.stringify(out, null, 1) + "\n");
}
for (const [k, v] of Object.entries(out)) {
  if (Array.isArray(v)) { console.log(`# ${k}`); for (const x of v) console.log("  ", JSON.stringify(x)); }
  else console.log(`# ${k}`, JSON.stringify(v));
}
process.exit(0);
