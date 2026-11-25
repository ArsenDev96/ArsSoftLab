// M1.4I.1E: real mouse moves between a station's artwork, platform, label and chips. Dev server on :3002.
//   node docs/m1.4i1e/work/transitions.mjs <label> [station,station] [group,group]
// A restart = a spark leaving the A again (EnergySurge animates [data-core-flash] once per activation) while the pointer
// moves inside one station. A drop = the station losing its hover on the way.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ARRIVE, IDS, POWERED, REST, open, sleep } from "./lib.mjs";
import { P, raise } from "./points.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const [label = "run", only, groups] = process.argv.slice(2);
const ids = only && only !== "all" ? only.split(",") : IDS;
const want = (g) => !groups || groups.split(",").includes(g);
const SPEEDS = [150, 400, 1000, 2200];

export async function lab(opts = {}) {
  const L = await open("/lab-v2", { gpu: true, ...opts });
  const S = ([x, y]) => [L.cam.x + x * L.cam.k, L.cam.y + y * L.cam.k];
  const to = (p) => L.page.mouseMove(...S(p));
  await L.page.eval(`(() => {
    window.__h = []; window.__sparks = 0;
    const d = document.querySelector(".lab-camera").closest("main").querySelector("div.contents");
    const now = () => { const v = (d.dataset.labHover ?? "-") + (d.dataset.labSelected ? "/" + d.dataset.labSelected : ""); if (window.__h.at(-1)?.[1] !== v) window.__h.push([performance.now(), v]); };
    new MutationObserver(now).observe(d, { attributes: true }); now();
    const a = Element.prototype.animate;
    Element.prototype.animate = function (...x) { if (this.dataset?.coreFlash !== undefined) window.__sparks++; return a.apply(this, x); };
    return 1;
  })()`);
  const glide = async (pts, ms) => {
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      const t0 = performance.now();
      for (;;) {
        const f = Math.min(1, (performance.now() - t0) / ms);
        await to([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        if (f === 1) break;
        await sleep(6);
      }
    }
  };
  const mark = () => L.page.eval("(window.__h = window.__h.slice(-1), window.__sparks = 0, 1)");
  const since = () => L.page.eval("({ h: window.__h.map((x) => x[1]), t: window.__h.map((x) => Math.round(x[0])), sparks: window.__sparks })");
  const park = async () => {
    await L.off();
    await L.settle((s) => s.hover === null && IDS.every((i) => REST[i](s[i])), 7000);
    await sleep(120);
  };
  return { ...L, S, to, glide, mark, since, park };
}

const out = {};
for (const id of ids) {
  const p = P[id];
  const L = await lab();
  const up = id === "playground" ? raise : (x) => x;
  const rows = [];
  const run = async (group, name, pts, ms, state) => {
    await L.park();
    await L.mark();
    await L.to(pts[0]);
    if (state === "charging") await sleep(120);
    else if (state === "lifting") await sleep(ARRIVE[id] + 40);
    else {
      await L.settle((s) => POWERED[id](s[id]), 8000);
      await sleep(150);
    }
    await L.glide(pts, ms);
    await sleep(350);
    const r = await L.since();
    // First change: the park's "-" to the station. Everything after it counts.
    const first = r.h.indexOf(id);
    const drops = first < 0 ? 0 : r.h.slice(first + 1).filter((v) => v !== id).length;
    rows.push({ group, name, ms, state, drops, restarts: Math.max(0, r.sparks - 1), other: [...new Set(r.h.filter((v) => v !== id && v !== "-"))], ends: r.h.at(-1) });
  };
  const states = id === "playground" ? ["charging", "lifting", "powered"] : ["charging", "powered"];
  for (const state of states) {
    // Where the label is at that moment: raised with the lift, or where it stands.
    const at = state === "powered" ? up : (x) => x;
    const T = at(p.title), C = p.chips.map(at), I = p.icon;
    const all = state === "powered";
    // The main paths at every speed (two while charging / lifting); the others at two, powered.
    for (const ms of all ? SPEEDS : [400, 1500]) {
      if (want("label")) {
        await run("art-label", "artwork -> title", [p.art, T], ms, state);
        await run("label-art", "title -> artwork", [T, p.art], ms, state);
      }
      if (want("chip")) {
        await run("platform-chip", "platform -> chip 1", [p.platform, C[0]], ms, state);
        await run("chip-platform", "chip 1 -> platform", [C[0], p.platform], ms, state);
      }
      if (want("inside")) await run("in-label", "icon, title, chips", [...(I ? [I] : []), T, ...C, T], ms, state);
    }
    if (all)
      for (const ms of [400, 1500]) {
        if (want("label")) {
          await run("art-label", "artwork edge -> title", [p.art2, T], ms, state);
          await run("label-art", "title -> artwork edge", [T, p.art2], ms, state);
        }
        if (want("chip"))
          for (const [i, c] of C.entries()) {
            if (i) await run("platform-chip", `platform -> chip ${i + 1}`, [p.platform, c], ms, state);
            if (i) await run("chip-platform", `chip ${i + 1} -> platform`, [c, p.platform], ms, state);
            await run("platform-chip", `platform corner -> chip ${i + 1}`, [p.corner, c], ms, state);
            await run("chip-platform", `chip ${i + 1} -> platform corner`, [c, p.corner], ms, state);
            await run("platform-chip", `far corner -> chip ${i + 1}`, [p.corner2, c], ms, state);
            await run("chip-platform", `chip ${i + 1} -> far corner`, [c, p.corner2], ms, state);
          }
      }
    if (want("repeat")) for (const ms of all ? [150, 450, 900] : [450]) await run("repeated", "artwork <-> title x3, platform <-> chip x3", [p.art, T, p.art, T, p.art, T, p.platform, C[0], p.platform, C[0], p.platform, C[0]], ms, state);
  }
  if (want("still")) {
    // The pointer does not move at all: whatever the label does under it must not restart the station.
    const still = { "lower edge of chip": p.edge, "chip centre": p.chips[0], title: p.title, "title lower edge": [p.title[0], p.title[1] + (id === "educational" ? 8 : 9)] };
    for (const [name, at] of Object.entries(still)) {
      await L.park();
      await L.mark();
      await L.to(at);
      await sleep(5000);
      const r = await L.since();
      const first = r.h.indexOf(id);
      const under = await L.page.eval(`(() => { const e = document.elementFromPoint(${L.S(at).join(",")}); return e?.dataset.hotspot ? "hotspot" : e?.dataset.bridge ? "bridge" : e?.closest("li button") ? "chip" : e?.closest("h2 button") ? "title" : e?.closest("[data-station]") ? "label" : "nothing"; })()`);
      rows.push({ group: "still", name, ms: 5000, state: "from rest", drops: first < 0 ? 0 : r.h.slice(first + 1).filter((v) => v !== id).length, restarts: Math.max(0, r.sparks - 1), other: [], ends: r.h.at(-1), under });
    }
  }
  if (want("leave")) {
    // Out into the empty lab: how long until the station lets go, and everything back at rest.
    const chip = up(p.chips[0]);
    const from = { artwork: p.art, title: up(p.title), chip, platform: p.platform, "between chip and platform": [(chip[0] + p.platform[0]) / 2, (chip[1] + p.platform[1]) / 2] };
    for (const [name, at] of Object.entries(from)) {
      await L.park();
      await L.to(p.art);
      await L.settle((s) => POWERED[id](s[id]), 8000);
      await L.glide([p.art, at], 120);
      await sleep(300);
      await L.mark();
      const t0 = await L.page.eval("performance.now()");
      await L.to(p.empty);
      await sleep(400);
      const r = await L.since();
      const rest = await L.settle((s) => IDS.every((i) => REST[i](s[i])), 6000);
      rows.push({ group: "leave", name, ms: 0, state: "powered", before: r.h[0], afterMs: r.h.at(-1) === "-" && r.h.length > 1 ? Math.round(r.t.at(-1) - t0) : null, ends: r.h.at(-1), rest, sparks: r.sparks });
    }
    // To a neighbouring station, from the label and from the platform.
    const [nid, np] = p.next;
    for (const [name, at] of Object.entries({ label: up(p.title), platform: p.platform }))
      for (const ms of [200, 900]) {
        await L.park();
        await L.to(p.art);
        await L.settle((s) => POWERED[id](s[id]), 8000);
        await L.glide([p.art, at], 120);
        await sleep(250);
        await L.mark();
        await L.glide([at, np], ms);
        const ok = await L.settle((s) => s.hover === nid && POWERED[nid](s[nid]) && REST[id](s[id]), 7000);
        const r = await L.since();
        rows.push({ group: "switch", name: `${name} -> ${nid}`, ms, state: "powered", h: r.h, sparks: r.sparks, ok });
      }
  }
  out[id] = { rows, errors: L.errors };
  await L.page.close();
  const g = {};
  for (const r of rows)
    if ("drops" in r) {
      const k = (g[r.group] ??= { runs: 0, bad: 0, drops: 0, restarts: 0 });
      k.runs++;
      if (r.drops || r.restarts) k.bad++;
      k.drops += r.drops;
      k.restarts += r.restarts;
    }
  console.log(id, JSON.stringify(g), L.errors.length ? L.errors : "");
  for (const r of rows.filter((r) => r.group === "leave" || r.group === "switch" || r.group === "still")) console.log("   ", JSON.stringify(r));
  writeFileSync(join(HERE, `transitions-${label}.json`), JSON.stringify(out, null, 1) + "\n");
}
process.exit(0);
