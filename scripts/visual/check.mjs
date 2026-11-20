#!/usr/bin/env node
// ArsSoftLab visual + interaction checks (M1.3A: five-station interaction).
//
// Usage (against a running build, e.g. `npm run build && npm run start`):
//   npm run visual
//   npm run visual -- --url http://localhost:3000 --out docs/m1.3a
//
// Options:
//   --url <url>         app URL                      (default http://localhost:3000)
//   --out <dir>         output directory             (default .visual)
//   --baseline <png>    approved baseline screenshot (default docs/m1.1/homepage-1648x928.png)
//   --tolerance <n>     max allowed pixel delta (0-255) for "unchanged" comparisons (default 4)
//   --width/--height    viewport                     (default 1648x928)
//
// Writes idle.png, <station>-selected.png and project-selected.png to --out, supporting screenshots to --out/checks, and
// regression.txt. Exits non-zero if any check fails. Requires Node 22+ and
// Chrome/Edge (set CHROME_PATH if it isn't found automatically).

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launch, sleep } from "./cdp.mjs";
import { compareImages, composeSheet, prepare } from "./compare.mjs";
import { HOTSPOT, hasLayer, liftRegionOnScreen, liftState, tabTo } from "./lift.mjs";
import { STATION_IDS, STATIONS, heroOverlaps, hotspotHits, labState, lightState, panel, plateCoverage, trigger } from "./stations.mjs";

const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const URL_ = opt("url", "http://localhost:3000");
const OUT = resolve(opt("out", ".visual"));
const BASELINE = resolve(opt("baseline", "docs/m1.1/homepage-1648x928.png"));
const TOL = Number(opt("tolerance", 4));
const W = Number(opt("width", 1648));
const H = Number(opt("height", 928));
mkdirSync(join(OUT, "checks"), { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};
const out = (f) => join(OUT, f);
const aux = (f) => join(OUT, "checks", f);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const settle = async (page) => {
  await sleep(60);
  await page.finishTransitions();
  await sleep(150);
  await page.finishTransitions();
  await sleep(150);
};
/** Pointer off the scene and (optionally) no focused element: the resting lab. */
const rest = async (page, { blur = false } = {}) => {
  await page.mouseMove(4, H - 4);
  if (blur) await page.eval(`document.activeElement?.blur(), true`);
  await settle(page);
  await sleep(850); // "returning" lasts until the camera has eased home
  await page.freezeAnimations(0);
};
const clickOn = async (page, selector) => {
  const c = await page.center(selector);
  await page.click(c.x, c.y);
};
/** Press Tab until `expr` (evaluated in the page) is true. */
async function tabUntil(page, expr, max = 40) {
  for (let i = 0; i < max; i++) {
    await page.key("Tab", "Tab", 9);
    if (await page.eval(expr)) return true;
  }
  return false;
}
/**
 * The approved one-sentence summaries, read from data/projects.ts (the
 * single source of truth) so the tests never carry their own copy.
 */
const SUMMARIES = Object.fromEntries(
  [...readFileSync(resolve("data/projects.ts"), "utf8").matchAll(/name: "([^"]+)",[^}]*?summary:\s*"([^"]+)"/g)].map((m) => [m[1], m[2]]),
);
const sentence = (_id, name) => SUMMARIES[name];
check(
  "Project data: every project has an approved summary",
  Object.values(STATIONS).every((z) => z.projects.every((p) => SUMMARIES[p])),
  `${Object.keys(SUMMARIES).length} found`,
);

/** Selection invariants that must hold in every state. */
const invariants = (s) => {
  const zoneOf = Object.fromEntries(Object.entries(STATIONS).flatMap(([id, z]) => z.projects.map((p) => [p.toLowerCase(), id])));
  return (
    s.openPanels === (s.selected ? 1 : 0) &&
    s.expanded.length === (s.selected ? 1 : 0) &&
    (!s.selected || s.expanded[0] === `station-${s.selected}-trigger`) &&
    (!s.project || zoneOf[s.project] === s.selected)
  );
};

// 1. Idle lab and Educational orbit hover -------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.freezeAnimations(0);
    await page.screenshot(out("idle.png"));
    const s = await labState(page);
    check("Idle: nothing selected or hovered, hero heading shown", !s.selected && !s.hover && s.openPanels === 0 && s.heading === "visible/1", JSON.stringify([s.selected, s.hover, s.heading]));
    const lights = await lightState(page);
    check(
      "Idle: every station light is off and every label fully shown",
      STATION_IDS.every((id) => !lights[id].platform && !lights[id].connection && lights[id].label === 1 && lights[id].pulse === 1) && lights.orbit === 0.55,
      JSON.stringify(lights),
    );
    const hits = await hotspotHits(page);
    check("Hotspots: each polygon's centre hits its own station", hits.every((h) => h.split(":")[0] === h.split(":")[1]), hits.join(" "));

    await page.goto(URL_);
    await page.freezeAnimations(7000);
    await page.screenshot(aux("globe-rest.png"));
    await page.goto(URL_);
    await page.freezeAnimations(7000);
    const hot = await page.center('[data-hotspot="educational"]');
    await page.mouseMove(hot.x, hot.y);
    await settle(page);
    await page.screenshot(aux("globe-hover.png"));
  } finally {
    await page.close();
  }
}

// 2. Hover: every station lights up, nothing else changes ----------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    const layered = await hasLayer(page);
    for (const id of STATION_IDS) {
      const c = await page.center(`[data-hotspot="${id}"]`);
      await page.mouseMove(c.x, c.y);
      await settle(page);
      const s = await labState(page);
      const l = await lightState(page);
      const own = l[id];
      const platformOk = id === "engineering" && layered ? own.platform === null : own.platform >= 0.5;
      const others = STATION_IDS.filter((o) => o !== id);
      check(
        `Hover ${id}: lights its platform and connection; others stay readable`,
        s.hover === id && !s.selected && platformOk && own.connection >= 0.4 && others.every((o) => l[o].label === 1 && !l[o].connection),
        `platform ${own.platform}, connection ${own.connection}, labels ${others.map((o) => l[o].label).join("/")}`,
      );
    }
    await page.mouseMove(4, H - 4);
    await settle(page);
    const l = await lightState(page);
    check("Hover end: every light fades back out", (await labState(page)).hover === null && STATION_IDS.every((id) => !l[id].platform && !l[id].connection), JSON.stringify(l));
  } finally {
    await page.close();
  }
}

// 3. Engineering lift (M1.2.2 independent station layer) ----------------------
// Skipped when the layers are switched off (NEXT_PUBLIC_STATION_LAYERS=off).
let lift = null;
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    await page.freezeAnimations(0);
    if (await hasLayer(page)) {
      let s = await liftState(page);
      check("Lift: layers hidden at rest (plate shows the station)", s.ready && s.visible === "hidden" && s.transform === "none", `${s.visible} ${s.transform}`);
      const hot = await page.center(HOTSPOT);
      await page.mouseMove(hot.x, hot.y);
      await settle(page);
      await page.screenshot(aux("engineering-hover.png"));
      s = await liftState(page);
      check("Lift: hover lifts the station (5 px, <= 1.015x)", s.visible === "visible" && s.scale > 1 && s.scale <= 1.015 && s.ty < 0, `scale ${s.scale}, ty ${s.ty}px`);
      check("Lift: labels follow the station (<= 0.5 px)", s.labelErr <= 0.5, `${s.labelErr}px`);
      check("Lift: lifted cut-out is not clipped by the static layer box", !s.groupClips);
      check("Lift: contact shadow and light shown", parseFloat(s.shadow) > 0 && +s.light > 0, `shadow ${s.shadow}, light ${s.light}`);
      // The station region, plus its connection line (lit on hover, M1.3A).
      const line = await page.eval(`(() => { const r = document.querySelector('[data-connection-light="engineering"]').getBoundingClientRect(); return [Math.floor(r.left) - 2, Math.floor(r.top) - 2, Math.ceil(r.right) + 2, Math.ceil(r.bottom) + 2]; })()`);
      lift = { exclude: [await liftRegionOnScreen(page), line] };
      await page.mouseMove(4, H - 4);
      await settle(page);
      await page.freezeAnimations(0);
      await page.screenshot(aux("engineering-hover-return.png"));
      s = await liftState(page);
      check("Lift: return removes the transform and hides the layers", s.transform === "none" && s.labelTransform === "none" && s.visible === "hidden", `${s.transform} ${s.labelTransform} ${s.visible}`);

      await page.goto(URL_);
      check("Lift: Tab reaches the Engineering trigger", await tabTo(page, "station-engineering-trigger"));
      await settle(page);
      s = await liftState(page);
      check("Lift: keyboard focus lifts the station", s.visible === "visible" && s.scale > 1, `scale ${s.scale}`);
      check("Lift: stays lifted while focus is on its project chips", (await tabUntil(page, `document.activeElement?.textContent === "TableRefresh"`)) && (await settle(page), (await liftState(page)).scale > 1));
      await tabTo(page, "station-playground-trigger");
      await settle(page);
      s = await liftState(page);
      check("Lift: moving focus to another station returns it", s.transform === "none" && s.visible === "hidden");

      await page.eval(`document.activeElement?.blur(), true`);
      await clickOn(page, trigger("engineering"));
      await page.mouseMove(4, H - 4);
      await settle(page);
      s = await liftState(page);
      check("Lift: Engineering stays lifted while selected", s.visible === "visible" && s.scale > 1 && s.labelErr <= 0.5, `scale ${s.scale}, label ${s.labelErr}px`);
    } else {
      console.log("SKIP  Lift checks (no station layer; NEXT_PUBLIC_STATION_LAYERS=off?)");
    }
  } finally {
    await page.close();
  }
}

// 4. Pointer: select each station, check content + scene, Back to Lab ----------
{
  const page = await launch({ width: W, height: H });
  try {
    for (const id of STATION_IDS) {
      const want = STATIONS[id];
      await page.goto(URL_);
      await page.freezeAnimations(0);
      await clickOn(page, trigger(id));
      await page.mouseMove(4, H - 4);
      await settle(page);
      await page.freezeAnimations(0);
      await page.screenshot(out(`${id}-selected.png`));
      let s = await labState(page);
      const l = await lightState(page);
      const cov = await plateCoverage(page);
      const overlaps = await heroOverlaps(page);
      const others = STATION_IDS.filter((o) => o !== id);
      check(`Select ${id}: becomes the single selected station`, s.selected === id && invariants(s), JSON.stringify([s.selected, s.openPanels, s.expanded]));
      check(
        `Select ${id}: hero shows its title, description and projects`,
        s.title === want.title && s.summary === want.summary && eq(s.projects, want.projects) && s.heading.startsWith("hidden") && s.info === "visible/1",
        `${s.title} | ${s.summary} | ${s.projects.join(", ")}`,
      );
      check(`Select ${id}: focus moves to the station heading`, s.active === `station-${id}-panel-title`, s.active);
      check(`Select ${id}: camera moves the scene, header untouched`, s.camera !== "none" && s.header === "none", s.camera);
      check(`Select ${id}: no image edge exposed`, cov.gap <= 0.5, JSON.stringify(cov));
      check(`Select ${id}: no in-scene label under the hero info`, overlaps.length === 0, overlaps.join("; "));
      check(
        `Select ${id}: its connection is primary, others quieter but present`,
        l[id].connection >= 0.8 && l[id].pulse === 1 && l[id].label === 1 && others.every((o) => l[o].pulse > 0 && l[o].pulse < 1 && l[o].label > 0.5 && l[o].label < 1),
        `own ${l[id].connection}/${l[id].pulse}; others pulse ${others.map((o) => l[o].pulse).join("/")}, labels ${others.map((o) => l[o].label).join("/")}`,
      );

      await clickOn(page, `${panel(id)} [aria-keyshortcuts="Escape"]`);
      s = await labState(page);
      check(`Back to Lab (${id}): enters "returning"`, s.returning === id && !s.selected, `${s.returning}`);
      await rest(page);
      await page.screenshot(aux(`return-${id}.png`));
      s = await labState(page);
      check(
        `Back to Lab (${id}): lab restored, focus back on the station trigger`,
        !s.selected && !s.project && !s.returning && s.camera === "none" && s.heading === "visible/1" && s.active === `station-${id}-trigger`,
        `${s.selected} ${s.camera} ${s.heading} ${s.active}`,
      );
    }
  } finally {
    await page.close();
  }
}

// 5. Projects: every project selectable from the hero and from the scene -------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    for (const id of STATION_IDS) {
      for (const name of STATIONS[id].projects) {
        // From the in-scene chip: selects the station and the project at once.
        await page.eval(`[...document.querySelectorAll("#station-${id} ul button")].find((b) => b.textContent === ${JSON.stringify(name)}).click(), true`);
        await settle(page);
        let s = await labState(page);
        check(
          `Project ${name}: scene chip selects ${id} + project, hero shows its approved summary`,
          s.selected === id && s.project === name.toLowerCase() && eq(s.pressed, [name]) && s.detail === sentence(id, name) && invariants(s),
          `${s.selected}/${s.project} | ${s.detail}`,
        );
        check(
          `Project ${name}: Open project says the page is coming soon (no link)`,
          s.openProject?.disabled === "true" && /coming soon/i.test(s.openProject?.desc ?? "") && !(await page.eval(`!!document.querySelector('[data-open-row] a')`)),
          JSON.stringify(s.openProject),
        );
        // Hero button toggles it off and on again.
        const btn = `[...document.querySelectorAll('${panel(id)} .lab-hero-project')].find((b) => b.textContent === ${JSON.stringify(name)})`;
        await page.eval(`${btn}.click(), true`);
        await settle(page);
        s = await labState(page);
        check(`Project ${name}: selecting it again clears it (station stays)`, s.selected === id && s.project === null && s.detail === null && s.pressed.length === 0);
        await page.eval(`${btn}.click(), true`);
        await settle(page);
        s = await labState(page);
        check(`Project ${name}: hero name selects it`, s.project === name.toLowerCase() && eq(s.pressed, [name]));
      }
    }
    // Evidence: Engineering with SQLOrbit selected.
    await page.goto(URL_);
    await page.freezeAnimations(0);
    await clickOn(page, trigger("engineering"));
    await page.mouseMove(4, H - 4);
    await settle(page);
    await clickOn(page, `${panel("engineering")} .lab-hero-project`);
    await page.mouseMove(4, H - 4);
    await settle(page);
    await page.freezeAnimations(0);
    await page.screenshot(out("project-selected.png"));
    const overlaps = await heroOverlaps(page);
    check("Project selected: no in-scene label under the hero info", overlaps.length === 0, overlaps.join("; "));
  } finally {
    await page.close();
  }
}

// 6. Keyboard: Tab / Enter / Space / Escape for every station -------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    for (const id of STATION_IDS) {
      const [first] = STATIONS[id].projects;
      check(`Keyboard ${id}: Tab reaches the station`, await tabTo(page, `station-${id}-trigger`));
      check(`Keyboard ${id}: focus indicator visible`, await page.eval(`document.activeElement.matches(":focus-visible") && getComputedStyle(document.activeElement).outlineStyle !== "none"`));
      await page.key("Enter", "Enter", 13);
      await settle(page);
      let s = await labState(page);
      check(`Keyboard ${id}: Enter selects it and focuses the station heading`, s.selected === id && s.active === `station-${id}-panel-title`, s.active);
      check(`Keyboard ${id}: Tab reaches the first project`, await tabUntil(page, `document.activeElement?.textContent === ${JSON.stringify(first)}`, 3));
      await page.key(" ", "Space", 32);
      await settle(page);
      s = await labState(page);
      check(`Keyboard ${id}: Space selects ${first}`, s.project === first.toLowerCase() && s.active === first, `${s.project} ${s.active}`);
      check(`Keyboard ${id}: Tab reaches Open project`, await tabUntil(page, `!!document.activeElement?.dataset.openProject`, 4));
      await page.key("Enter", "Enter", 13);
      await sleep(100);
      const notice = await page.eval(`document.querySelector("[data-open-row] [aria-live]")?.textContent ?? ""`);
      check(`Keyboard ${id}: Open project announces it is coming soon`, /coming soon/i.test(notice) && (await labState(page)).project === first.toLowerCase(), notice);
      check(`Keyboard ${id}: Tab reaches Back to Lab`, await tabUntil(page, `document.activeElement?.getAttribute("aria-keyshortcuts") === "Escape"`, 4));
      await page.key("Escape", "Escape", 27);
      await settle(page);
      s = await labState(page);
      check(`Keyboard ${id}: Escape returns, clears the project, restores focus`, !s.selected && !s.project && s.heading === "visible/1" && s.active === `station-${id}-trigger`, `${s.selected} ${s.project} ${s.active}`);
    }
    // Re-selecting the active station from its title returns to the lab.
    await page.eval(`document.querySelector("${trigger("playground")}").focus(), true`);
    await page.key("Enter", "Enter", 13);
    await settle(page);
    await page.eval(`document.querySelector("${trigger("playground")}").focus(), true`);
    await page.key("Enter", "Enter", 13);
    await settle(page);
    const s = await labState(page);
    check("Keyboard: Enter on the selected station's title returns to the lab", !s.selected && s.active === "station-playground-trigger");
  } finally {
    await page.close();
  }
}

// 7. Switching and invariants -------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    const states = [];
    const step = async (label, fn) => {
      await fn();
      await settle(page);
      const s = await labState(page);
      states.push(`${label}: ${s.selected}/${s.project} panels ${s.openPanels} expanded ${s.expanded.join(",")}`);
      return s;
    };
    await step("select educational", () => clickOn(page, trigger("educational")));
    let s = await step("switch to playground", () => clickOn(page, trigger("playground")));
    check("Switch: selecting another station replaces the selection", s.selected === "playground" && s.openPanels === 1 && s.title === "Playground");
    await step("project AZIZ", () => clickOn(page, `${panel("playground")} .lab-hero-project`));
    s = await step("platform click creative", () => clickOn(page, '[data-hotspot="creative"]'));
    check("Switch: platform click selects; the previous project is cleared", s.selected === "creative" && s.project === null);
    s = await step("platform click creative again", () => clickOn(page, '[data-hotspot="creative"]'));
    check("Switch: clicking the selected platform keeps it selected", s.selected === "creative");
    s = await step("scene chip Koreez", () => page.eval(`document.querySelector("#station-experience ul button").click(), true`));
    s = await step("title creative", () => clickOn(page, trigger("creative")));
    s = await step("title creative again", () => clickOn(page, trigger("creative")));
    check("Toggle: clicking the selected station's title returns to the lab", s.selected === null);
    writeFileSync(aux("switching.txt"), states.join("\n") + "\n");
    check("Invariants: one station, one panel, project within its station, at every step", states.length === 8 && !states.some((l) => /panels [2-9]/.test(l)), states.join(" | "));
  } finally {
    await page.close();
  }
}

// 8. Camera edges at other viewport sizes --------------------------------------
for (const [vw, vh, strict] of [[1366, 768, true], [1920, 1080, true], [1280, 1024, false], [2560, 1080, false], [1024, 1366, false]]) {
  const page = await launch({ width: vw, height: vh });
  try {
    await page.goto(URL_);
    const gaps = [], overlaps = [];
    for (const id of STATION_IDS) {
      await page.eval(`document.querySelector("${trigger(id)}").click(), true`);
      await settle(page);
      gaps.push((await plateCoverage(page)).gap);
      overlaps.push(...(await heroOverlaps(page)).map((o) => `${id}: ${o}`));
    }
    check(`Camera ${vw}x${vh}: no image edge exposed for any station`, gaps.every((g) => g <= 0.5), `worst gap ${Math.max(...gaps)} px`);
    if (strict) check(`Camera ${vw}x${vh}: no in-scene label under the hero info`, overlaps.length === 0, overlaps.join("; "));
    else console.log(`INFO  ${vw}x${vh}: hero/label overlaps: ${overlaps.length ? overlaps.join("; ") : "none"}`);
  } finally {
    await page.close();
  }
}

// 9. Reduced motion -----------------------------------------------------------
{
  const page = await launch({ width: W, height: H, reducedMotion: true });
  try {
    await page.goto(URL_);
    await page.screenshot(aux("reduced-motion-idle.png"));
    let s = await labState(page);
    check("Reduced motion: no running animations, effects removed", s.runningAnimations === 0 && !s.fx.includes("block"), `${s.runningAnimations} running, fx=${s.fx}`);
    for (const id of STATION_IDS) {
      await page.eval(`document.querySelector("${trigger(id)}").focus(), true`);
      await page.key("Enter", "Enter", 13);
      await sleep(450);
      s = await labState(page);
      const l = (await hasLayer(page)) ? await liftState(page) : null;
      if (id === "creative") await page.screenshot(aux("reduced-motion-selected.png"));
      check(
        `Reduced motion ${id}: selected with no camera move or lift, info reachable`,
        s.selected === id && s.camera === "none" && s.info === "visible/1" && s.active === `station-${id}-panel-title` && (!l || l.transform === "none"),
        `${s.camera} ${s.info} ${s.active}`,
      );
      await page.key("Escape", "Escape", 27);
      await sleep(450);
      s = await labState(page);
      check(`Reduced motion ${id}: Escape returns`, !s.selected && s.active === `station-${id}-trigger`);
    }
    if (await hasLayer(page)) {
      const hot = await page.center(HOTSPOT);
      await page.mouseMove(hot.x, hot.y);
      await sleep(400);
      const l = await liftState(page);
      check("Reduced motion: hover brightens without lifting", l.transform === "none" && l.labelTransform === "none" && l.shadow.endsWith("/none") && +l.light === 1, `${l.transform} shadow ${l.shadow} light ${l.light}`);
    }
  } finally {
    await page.close();
  }
}

// 10. Touch (no hover) ---------------------------------------------------------
{
  const page = await launch({ width: 390, height: 844, touch: true });
  try {
    await page.goto(URL_);
    const t = await page.center(trigger("educational"));
    await page.tap(t.x, t.y);
    await sleep(700);
    let s = await labState(page);
    check("Touch: tapping a station title selects it (no hover needed)", s.selected === "educational" && s.info === "visible/1", `${s.selected} ${s.info}`);
    const p = await page.center(`${panel("educational")} .lab-hero-project`);
    await page.tap(p.x, p.y);
    await sleep(400);
    s = await labState(page);
    check("Touch: tapping a project selects it", s.project === "arimap");
    const b = await page.center(`${panel("educational")} [aria-keyshortcuts="Escape"]`);
    await page.tap(b.x, b.y);
    await sleep(900);
    s = await labState(page);
    check("Touch: Back to Lab returns and leaves no hover state behind", !s.selected && !s.hover && s.heading === "visible/1", `${s.selected} ${s.hover}`);
  } finally {
    await page.close();
  }
}

// 11. No persistent artifacts after a long session ------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await page.goto(URL_);
    for (const id of STATION_IDS) {
      const c = await page.center(`[data-hotspot="${id}"]`);
      await page.mouseMove(c.x, c.y);
      await sleep(120);
      await page.click(c.x, c.y);
      await sleep(250); // switch mid-transition on purpose
      await page.eval(`document.querySelector(${JSON.stringify(`${panel(id)} .lab-hero-project`)})?.click(), true`);
      await sleep(150);
    }
    await page.key("Escape", "Escape", 27);
    await tabTo(page, "station-engineering-trigger");
    await page.key("Enter", "Enter", 13);
    await sleep(200);
    await page.key("Escape", "Escape", 27);
    await rest(page, { blur: true });
    await page.screenshot(aux("after-session.png"));
  } finally {
    await page.close();
  }
}

// 12. Pixel comparisons --------------------------------------------------------
{
  const page = await launch({ width: W, height: H });
  try {
    await prepare(page);
    const fmt = (r) => `mean ${r.mean.toFixed(4)}, max ${r.max}, >2: ${r.over2}, >12: ${r.over12}`;
    const lines = [];
    const cmp = async (label, a, b, opts) => {
      const r = await compareImages(page, a, b, opts);
      lines.push(`${label.padEnd(44)} ${fmt(r)}`);
      return r;
    };
    const idle = await cmp("idle vs approved baseline (M1.1)", out("idle.png"), BASELINE, { heatmapPath: aux("diff-idle-vs-baseline.png") });
    check(`Idle matches approved baseline (max <= ${TOL})`, idle.max <= TOL, fmt(idle));
    for (const id of STATION_IDS) {
      const r = await cmp(`return from ${id} vs idle`, aux(`return-${id}.png`), out("idle.png"));
      check(`Return from ${id} matches idle (max <= ${TOL})`, r.max <= TOL, fmt(r));
      const sel = await cmp(`${id} selected vs idle (must differ)`, out(`${id}-selected.png`), out("idle.png"));
      check(`Select ${id} visibly changes the scene`, sel.over12 > 10000, fmt(sel));
    }
    const session = await cmp("after long session vs idle", aux("after-session.png"), out("idle.png"));
    check(`No persistent artifacts after a long session (max <= ${TOL})`, session.max <= TOL, fmt(session));
    const rmi = await cmp("reduced-motion idle vs baseline", aux("reduced-motion-idle.png"), BASELINE);
    check(`Reduced-motion idle matches baseline (max <= ${TOL})`, rmi.max <= TOL, fmt(rmi));
    if (lift) {
      const hov = await cmp("eng. hover vs idle (outside station + line)", aux("engineering-hover.png"), out("idle.png"), { exclude: lift.exclude });
      check("Lift: nothing outside the station region and its connection changes on hover", hov.max <= TOL, fmt(hov));
      const hret = await cmp("eng. hover return vs idle", aux("engineering-hover-return.png"), out("idle.png"));
      check(`Lift: hover return matches idle (max <= ${TOL})`, hret.max <= TOL, fmt(hret));
    }
    const globe = await cmp("globe hover vs rest", aux("globe-hover.png"), aux("globe-rest.png"));
    check("Educational hover visibly boosts the orbit", globe.over12 > 200, fmt(globe));

    // Baseline / idle / diff. (A grid of all nine full-size states is slow to
    // build over DevTools; docs/m1.3a/comparison.png was composed offline.)
    await composeSheet(
      page,
      [
        { label: "Approved baseline (M1.1)", path: BASELINE },
        { label: "M1.3A idle", path: out("idle.png") },
        { label: "Difference x40 (black = identical)", path: aux("diff-idle-vs-baseline.png") },
      ],
      aux("idle-comparison.png"),
    );
    writeFileSync(
      out("regression.txt"),
      [
        `Visual regression (${W}x${H}); per-pixel max channel delta, 0-255`,
        ...lines,
        "",
        ...results.map((r) => `${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.detail ? `  (${r.detail})` : ""}`),
        "",
      ].join("\n"),
    );
  } finally {
    await page.close();
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Output: ${OUT}`);
process.exit(failed.length ? 1 : 0);
