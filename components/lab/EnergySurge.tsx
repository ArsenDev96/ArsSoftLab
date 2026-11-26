"use client";

import { useEffect, useRef } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, sceneRect, u, type SceneRect } from "@/lib/scene";
import { useLabState } from "./LabState";
import { GAME_DELAY_MS } from "./ArcadeScreen";
import { chargeAnimations, chargeTransforms, currentChargeU, pgV2PoweredCss, segmentOffset, U_REST, uFull } from "./ChargeLine";
import { ACTIVATION, CHARGE_LINES, CORE_FLASH_BOX, ENERGY_BOX, SURGE_ARRIVE_MS, surgePath, surgeStations, type SurgePath } from "./scene-fx";

/**
 * M1.3C / M1.3D: the hover pulse. Hovering (or keyboard-focusing) a station
 * sends energy from the central A along that station's painted connection;
 * the station only reacts once it has arrived.
 *
 * Per station, per hover:
 *
 *   idle ──hover──▶ charging ──arrive (SURGE_ARRIVE_MS)──▶ flare ──▶ active
 *     ▲                │ leave / other station                         │ leave
 *     └──── releasing ◀┴───────────────────────────────────────────────┘
 *
 * Two halves, never coupled by callbacks:
 *   - Sustained state is CSS. Every activation effect (platform light, lift,
 *     glow, orbit, live screen) transitions with `transition-delay:
 *     var(--arrive-now)`, the arrival time only while the station is hovered
 *     and not selected (generated below). Leaving before arrival cancels the
 *     pending transition natively: nothing can complete late.
 *   - One-shot motion runs on the Web Animations API, started here when the
 *     hovered station changes: the A's flash, the spark and its tail, the
 *     line charging, the arrival flare, sweeps and the path highlight.
 *     Releasing fades what is visible and cancels whatever hasn't started,
 *     so an old hover can never fire later.
 *
 * The spark moves by transform only (compositor), seen through masks of the
 * painted lines: it can only light the line and its immediate glow. Nothing
 * here re-renders React; the controller writes to the DOM directly.
 */

interface Pass {
  name: string;
  mask: string;
  head: { w: number; h: number; color: string };
  /** Short fading tail right behind the spark (travel only). */
  tail?: { len: number; h: number; color: string };
  /** The whole line behind the spark: nearly dark in flight, lit on arrival. */
  trail?: { h: number; color: string };
}

const PASSES: Pass[] = [
  // A soft glow around the spark only, through a wider halo of the same lines.
  { name: "wide", mask: "/scene/activation/connections-wide.png", head: { w: 66, h: 42, color: "rgb(255 196 120 / 0.6)" } },
  {
    name: "halo",
    mask: "/scene/masks/connections-glow.png",
    head: { w: 104, h: 52, color: "rgb(255 214 140 / 1)" },
    tail: { len: 96, h: 30, color: "rgb(255 192 112 / 0.6)" },
    trail: { h: 30, color: "rgb(255 176 90 / 0.3)" },
  },
  {
    name: "core",
    mask: "/scene/masks/connections.png",
    head: { w: 46, h: 18, color: "rgb(255 253 244 / 1)" },
    tail: { len: 96, h: 14, color: "rgb(255 242 216 / 0.85)" },
    trail: { h: 14, color: "rgb(255 230 192 / 0.4)" },
  },
];

/**
 * M1.3E.3 charge lines: a compact, hot pulse (a white-hot point inside a
 * small warm halo) with a short fading trail, all through the route's own
 * masks so it stays on the painted line. Mask names map to the route's
 * masks (core / glow / wide).
 */
const ROUTE_PASSES: Pass[] = [
  { name: "wide", mask: "wide", head: { w: 46, h: 30, color: "rgb(255 190 110 / 0.5)" } },
  {
    name: "halo",
    mask: "glow",
    head: { w: 54, h: 30, color: "rgb(255 214 150 / 0.95)" },
    tail: { len: 66, h: 24, color: "rgb(255 184 100 / 0.5)" },
  },
  {
    name: "core",
    mask: "core",
    head: { w: 24, h: 12, color: "rgb(255 255 250 / 1)" },
    tail: { len: 66, h: 10, color: "rgb(255 238 210 / 0.9)" },
  },
  // The hot point: stacked on the core so the head's centre saturates.
  { name: "spark", mask: "core", head: { w: 13, h: 9, color: "rgb(255 255 255 / 1)" } },
];
/**
 * Charge lines: the spark reaches the station this long before the arrival
 * time (SURGE_ARRIVE_MS, when the station responds), and bursts there
 * (BURST_MS) while the line powers up to full (POWER_MS).
 */
const ARRIVE_AFTER_TRAVEL_MS = 50;
const BURST_MS = 180;
/** Powered glow while the front travels, then it rises to full. */
const POWER_TRAVEL = 0.5;
const POWER_MS = 340;
/** Arrival burst: a small flattened bloom (floor perspective) at the route's end. */
const BURST = { w: 84, h: 30 };

const HEAD_FADE_MS = 160;
const TAIL_FADE_MS = 260;
/** The line behind the spark stays nearly dark in flight, then charges. */
const TRAIL_TRAVEL = 0.1;
const TRAIL_CHARGE_MS = 380;
/**
 * M1.3E.1 / M1.3E.2 charge lines (CHARGE_LINES): the spark follows the
 * station's traced route (bends included) and the route is uncovered and
 * glows behind it (ChargeLine), instead of the straight trail. On leave the
 * station lowers first, then the charge drains back toward the A.
 */
const CHARGE_DRAIN_DELAY_MS = 380;
const CHARGE_DRAIN_MS = 520;
/** The charge front sits this far behind the spark's centre (reference px). */
const CHARGE_BEHIND = 4;
/** Lead-in before a route's start (inside the A's circle, where its masks are empty). */
const ROUTE_LEAD = 26;

/** Spark paths for charge lines: the route with a lead-in point. */
const ROUTE_PATHS = Object.fromEntries(
  (Object.keys(CHARGE_LINES) as ZoneId[]).map((id) => {
    const r = CHARGE_LINES[id]!.route;
    const [a, b] = r;
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const start: readonly [number, number] = [a[0] - ((b[0] - a[0]) / l) * ROUTE_LEAD, a[1] - ((b[1] - a[1]) / l) * ROUTE_LEAD];
    return [id, { path: [start, ...r], lead: ROUTE_LEAD }];
  }),
) as Partial<Record<ZoneId, { path: readonly (readonly [number, number])[]; lead: number }>>;
const RELEASE_MS = 280;
const FLASH_MS = 480;
const FLASH_PEAK = 0.42;
const EASE_SURGE = "cubic-bezier(0.42, 0, 0.18, 1)";
/** Charge lines: steadier, so the line visibly fills across the whole 0–arrival. */
const EASE_CHARGE = "cubic-bezier(0.32, 0, 0.62, 1)";

const PATHS = Object.fromEntries(surgeStations.map((id) => [id, surgePath(id)])) as Record<ZoneId, SurgePath>;

const pct = (n: number) => `${+n.toFixed(3)}%`;
/** translate() that puts the mover's origin at scene point p (box-relative %). */
const at = (p: readonly [number, number], box: SceneRect) =>
  `translate(${pct(((p[0] - box.x) / box.w) * 100)}, ${pct(((p[1] - box.y) / box.h) * 100)})`;

/** `box` shows `mask` at its scene position: a full-frame mask, or one cropped to scene box `rect` (M1.3G lines). */
function masked(box: SceneRect, mask: string, rect: SceneRect = { x: 0, y: 0, w: SCENE.width, h: SCENE.height }) {
  return {
    maskImage: `url(${mask})`,
    WebkitMaskImage: `url(${mask})`,
    maskSize: `${u(rect.w)} ${u(rect.h)}`,
    WebkitMaskSize: `${u(rect.w)} ${u(rect.h)}`,
    maskPosition: `${u(rect.x - box.x)} ${u(rect.y - box.y)}`,
    WebkitMaskPosition: `${u(rect.x - box.x)} ${u(rect.y - box.y)}`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  } as const;
}

/** Keyframes for a highlight following a polyline at constant speed. */
function pathKeyframes(path: readonly (readonly [number, number])[], box: SceneRect) {
  const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let acc = 0;
  let prev = 0;
  const move: Keyframe[] = [];
  const turn: Keyframe[] = [];
  path.forEach((p, i) => {
    if (i > 0) acc += seg[i - 1];
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    // Unwrapped heading, so interpolation never spins the long way round.
    let rot = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    while (rot - prev > 180) rot -= 360;
    while (rot - prev < -180) rot += 360;
    prev = rot;
    const offset = acc / total;
    move.push({ transform: at(p, box), offset });
    turn.push({ transform: `rotate(${rot.toFixed(1)}deg)`, offset });
  });
  return { move, turn };
}

/** The connection's charge windows at full charge, in `scope`. */
const poweredLine = (id: ZoneId, scope: string) =>
  (CHARGE_LINES[id]?.segments ?? [])
    .map((seg, k) => {
      const t = chargeTransforms(seg, "boost", segmentOffset(seg, Infinity, true, 0));
      const w = `${scope} [data-charge-window="${id}"][data-charge-seg="${k}"][data-charge-kind="boost"]`;
      return `${w}{transform:${t.window}!important}${w}>[data-charge-content]{transform:${t.content}!important}`;
    })
    .join("");

/**
 * The connection fully powered while its station is hovered: reduced motion's (ACTIVATION_CSS), and M1.4K.4's
 * lite mode (LabSceneV2), without the media query. "" for a station without a charge line.
 */
export const hoverPoweredLineCss = (id: ZoneId) =>
  CHARGE_LINES[id] ? `[data-lab-hover="${id}"] .lab-charge-dim[data-zone="${id}"] .lab-charge-unpowered{opacity:0}${poweredLine(id, `[data-lab-hover="${id}"]`)}` : "";

/**
 * Sequencing for each station: `--arrive-now` is its arrival time while it
 * is hovered but not selected, 0 otherwise (so leaving, selection and
 * reduced motion are immediate), plus its glow's timing and game screen.
 */
export const ACTIVATION_CSS = surgeStations
  .map((id) => {
    const t = SURGE_ARRIVE_MS[id];
    const a = ACTIVATION[id];
    const on = `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"])`;
    const scope = `${on} .lab-activation[data-zone="${id}"]`;
    let css = `[data-lab-hover="${id}"]:not([data-lab-selected="${id}"]) :is([data-zone="${id}"],[data-lift="${id}"],[data-station-layer="${id}"]){--arrive-now:${t}ms}`;
    if (a) {
      css += `${scope} .lab-activation-glow{opacity:${a.glowMax};transition:opacity ${a.glowIn}ms var(--ease-glow) calc(var(--arrive-now) + ${a.glowDelay}ms)}`;
      // M1.3E: the game screen is shown from just after arrival (its content
      // switches on with a wipe, see ArcadeScreen).
      if (a.game) css += `${scope} .lab-arcade{opacity:1;transition:opacity 160ms var(--ease-glow) calc(var(--arrive-now) + ${GAME_DELAY_MS}ms)}`;
    }
    // M1.3E.1/2: the connection is fully powered while selected (no pulse
    // runs then), and with reduced motion at once on hover / focus. The old
    // floor-only connection light is replaced by the route's own glow.
    const line = CHARGE_LINES[id];
    if (line) {
      css += `[data-lab-selected="${id}"] .lab-charge-dim[data-zone="${id}"] .lab-charge-unpowered{opacity:0}`;
      css += poweredLine(id, `[data-lab-selected="${id}"]`);
      css += `@media (prefers-reduced-motion: reduce){${hoverPoweredLineCss(id)}}`;
      css += `.lab-connection-light[data-zone="${id}"]{display:none}`;
      // M1.4E.3 (/lab-v2): Playground's continuous line, in the same two states.
      if (id === "playground")
        css += pgV2PoweredCss(`[data-lab-selected="${id}"]`) + `@media (prefers-reduced-motion: reduce){${pgV2PoweredCss(`[data-lab-hover="${id}"]`)}}`;
    }
    return css;
  })
  .join("");

/**
 * M1.4E.1 (/lab-v2 only): Playground's spark is seen through masks drawn from
 * its accurate route itself (scripts/m14e1-playground.py), with the v2
 * station's stone cut out, instead of the plate's painted line. Same route,
 * passes, timing and sequence.
 */
const V2_ROUTE_MASKS: Partial<Record<ZoneId, { core: string; glow: string; wide: string }>> = {
  playground: {
    core: "/scene/v2/m14e1/playground-route-core.png",
    glow: "/scene/v2/m14e1/playground-route-glow.png",
    wide: "/scene/v2/m14e1/playground-route-wide.png",
  },
};

const NO_SKIP: readonly ZoneId[] = [];
/** M1.4K.4: a skipped station answers at once (no arrival to wait for) and its connection is powered while hovered, as with reduced motion. */
const skipCss = (id: ZoneId) =>
  `:is([data-zone="${id}"],[data-lift="${id}"],[data-station-layer="${id}"]){--arrive-now:0ms!important}` +
  hoverPoweredLineCss(id) +
  (id === "playground" ? pgV2PoweredCss(`[data-lab-hover="${id}"]`) : "");

/**
 * M1.4K.4 `skip` (/lab-v2?render=lite): stations that send no pulse (nothing is fired for them, and their spark's
 * layers are not mounted); they answer at once, as with reduced motion.
 */
export function EnergySurge({ variant = "plate", skip = NO_SKIP }: { variant?: "plate" | "v2"; skip?: readonly ZoneId[] }) {
  const root = useRef<HTMLDivElement>(null);
  const { onHoverChange } = useLabState();
  const skipKey = skip.join();

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const runs = new Map<ZoneId, Animation[]>();
    let current: ZoneId | null = null;
    const q = (sel: string, scope: ParentNode = el) => [...scope.querySelectorAll<HTMLElement>(sel)];

    const cancel = (id: ZoneId) => {
      runs.get(id)?.forEach((a) => a.cancel());
      runs.set(id, []);
    };

    /**
     * Send the pulse. `charged`: the station is already powered (it was
     * selected a moment ago), so the line is shown at its end state at once:
     * no flash, no travel, no flare, no sweep.
     */
    const fire = (id: ZoneId, charged = false) => {
      // Read before cancelling: a quick return continues from here.
      const chargeFrom = CHARGE_LINES[id] ? currentChargeU(id) : U_REST;
      cancel(id);
      const arrive = SURGE_ARRIVE_MS[id] ?? 0;
      const spec = ACTIVATION[id];
      const list: Animation[] = [];
      const add = (a: Animation) => list.push(a);
      const path = PATHS[id];
      const group = `[data-surge="${id}"]`;

      // Origin: the A gathers light for a moment as the spark leaves it.
      const flash = el.querySelector<HTMLElement>("[data-core-flash]");
      if (flash && !charged) {
        add(flash.animate([{ opacity: 0 }, { opacity: FLASH_PEAK, offset: 0.2 }, { opacity: 0 }], { duration: FLASH_MS, easing: "ease-out" }));
      }
      const line = CHARGE_LINES[id];
      // Charge lines: the spark lands a little before the station responds.
      const travel = line ? arrive - ARRIVE_AFTER_TRAVEL_MS : arrive;
      if (line) {
        // Along the traced route, from a lead-in inside the A's circle (the
        // route masks are empty there), turning with it.
        const { move, turn } = pathKeyframes(ROUTE_PATHS[id]!.path, ENERGY_BOX);
        const timing = { duration: travel, easing: EASE_CHARGE, fill: "forwards" as const };
        for (const mover of q(`${group} [data-surge-mover]`)) add(mover.animate(move, timing));
        for (const t of q(`${group} [data-surge-turn]`)) add(t.animate(turn, timing));
      } else {
        for (const mover of q(`${group} [data-surge-mover]`)) {
          add(mover.animate([{ transform: at(path.start, ENERGY_BOX) }, { transform: at(path.to, ENERGY_BOX) }], { duration: arrive, easing: EASE_SURGE, fill: "forwards" }));
        }
      }
      // The spark is absorbed by the station on arrival; its tail fades
      // behind it while the whole line charges.
      const until = (ms: number, after: number) => ms / (ms + after);
      for (const head of q(`${group} [data-surge-head]`)) {
        if (line) {
          // Charge lines: the pulse swells and is absorbed where the line
          // meets the platform.
          const end = until(travel, BURST_MS);
          add(
            head.animate(
              [
                { opacity: 0, transform: "scale(1)" },
                { opacity: 1, transform: "scale(1)", offset: 0.05 },
                { opacity: 1, transform: "scale(1)", offset: end },
                { opacity: 1, transform: "scale(1.5)", offset: end + (1 - end) * 0.35 },
                { opacity: 0, transform: "scale(1.8)" },
              ],
              { duration: travel + BURST_MS, fill: "forwards" },
            ),
          );
        } else add(head.animate([{ opacity: 0 }, { opacity: 1, offset: 0.05 }, { opacity: 1, offset: until(arrive, HEAD_FADE_MS) }, { opacity: 0 }], { duration: arrive + HEAD_FADE_MS, fill: "forwards" }));
      }
      for (const tail of q(`${group} [data-surge-tail]`)) {
        add(tail.animate([{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: until(travel, TAIL_FADE_MS) }, { opacity: 0 }], { duration: travel + TAIL_FADE_MS, easing: "ease-out", fill: "forwards" }));
      }
      for (const trail of q(`${group} [data-surge-trail]`)) {
        add(trail.animate([{ opacity: TRAIL_TRAVEL }, { opacity: TRAIL_TRAVEL, offset: until(arrive, TRAIL_CHARGE_MS) }, { opacity: 1 }], { duration: arrive + TRAIL_CHARGE_MS, easing: "ease-out", fill: "forwards" }));
      }
      // The charge front follows just behind the spark along the whole route,
      // part after part (same progress and easing as the spark); a quick
      // return keeps what is still powered.
      if (line) {
        const { lead } = ROUTE_PATHS[id]!;
        const full = uFull(id);
        const uAt = (p: number) => (p >= 1 ? full : Math.max(chargeFrom, -lead + (line.length + lead) * p - CHARGE_BEHIND));
        for (const { el: node, frames } of chargeAnimations(id, uAt)) add(node.animate(frames, { duration: travel, easing: EASE_CHARGE, fill: "forwards" }));
        // M1.3E.3: the line behind the pulse charges part-way, then rises to
        // full once the pulse has landed, and holds there (a quick return
        // starts from where it was). Releasing cancels this with the windows.
        const from = chargeFrom > U_REST ? 0.85 : POWER_TRAVEL;
        for (const w of q(`[data-charge-window="${id}"][data-charge-kind="boost"], [data-charge-power="${id}"]`, document)) {
          add(w.animate([{ opacity: from }, { opacity: from, offset: until(travel, POWER_MS) }, { opacity: 1 }], { duration: travel + POWER_MS, easing: "ease-out", fill: "forwards" }));
        }
        // The landing: a brief bloom where the line meets the platform.
        for (const b of q(`${group} [data-surge-burst]`)) {
          add(
            b.animate(
              [
                { opacity: 0, transform: `rotate(${line.burstTilt}deg) scale(0.45)` },
                { opacity: 1, transform: `rotate(${line.burstTilt}deg) scale(1)`, offset: 0.3 },
                { opacity: 0, transform: `rotate(${line.burstTilt}deg) scale(1.3)` },
              ],
              { duration: BURST_MS, delay: travel, easing: "ease-out", fill: "backwards" },
            ),
          );
        }
      }
      if (charged) {
        list.forEach((a) => a.finish());
        runs.set(id, list);
        return;
      }

      // Arrival response: a brief rise above the sustained level.
      if (spec) {
        const flare = (target: HTMLElement, peak: number) =>
          add(target.animate([{ opacity: 0 }, { opacity: peak, offset: 0.3 }, { opacity: 0 }], { duration: spec.flare.duration, delay: arrive, easing: "ease-out", fill: "backwards" }));
        for (const f of q(`[data-flare="${id}"]`, document)) flare(f, f.dataset.flareKind === "platform" ? spec.flare.platform : spec.flare.glow);

        const scan = spec.scan;
        if (scan) {
          const [prop, a, b] =
            scan.direction === "up" ? ["translateY", "260%", "-100%"] : scan.direction === "down" ? ["translateY", "-100%", "260%"] : ["translateX", "-110%", "300%"];
          for (const band of q(`[data-scan-band="${id}"]`, document)) {
            add(
              band.animate(
                [
                  { transform: `${prop}(${a})`, opacity: 0 },
                  { opacity: 1, offset: 0.2 },
                  { opacity: 1, offset: 0.75 },
                  { transform: `${prop}(${b})`, opacity: 0 },
                ],
                { duration: scan.duration, delay: arrive + scan.delay, easing: "cubic-bezier(0.3, 0, 0.3, 1)", fill: "backwards" },
              ),
            );
          }
        }

        const travel = spec.travel;
        if (travel) {
          const { move, turn } = pathKeyframes(travel.path, spec.box);
          const timing = { duration: travel.duration, delay: arrive + travel.delay, easing: "cubic-bezier(0.3, 0, 0.35, 1)", fill: "both" as const };
          for (const mover of q(`[data-path-mover="${id}"]`, document)) add(mover.animate(move, timing));
          for (const comet of q(`[data-path-comet="${id}"]`, document)) {
            add(comet.animate(turn, timing));
            add(comet.animate([{ opacity: 0 }, { opacity: 1, offset: 0.08 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { ...timing, easing: "linear" }));
          }
        }
      }
      runs.set(id, list);
    };

    const release = (id: ZoneId) => {
      const list = runs.get(id) ?? [];
      // Anything still waiting for the spark never starts.
      for (const a of list) {
        const delay = Number(a.effect?.getTiming().delay ?? 0);
        if (delay > 0 && Number(a.currentTime ?? 0) < delay) a.cancel();
      }
      // Fade out what is visible: the line and a path highlight in flight.
      const fade = (target: HTMLElement) =>
        list.push(target.animate([{ opacity: getComputedStyle(target).opacity }, { opacity: 0 }], { duration: RELEASE_MS, easing: "ease-out", fill: "forwards" }));
      const group = el.querySelector<HTMLElement>(`[data-surge="${id}"]`);
      if (group) fade(group);
      // Once the station has lowered, drain the charge back toward the A
      // from wherever the front is (the station end first).
      if (CHARGE_LINES[id]) {
        const from = currentChargeU(id);
        for (const w of document.querySelectorAll(`[data-charge-window="${id}"], [data-charge-path="${id}"], [data-charge-power="${id}"]`)) {
          for (const anim of [...w.getAnimations(), ...(w.firstElementChild?.getAnimations() ?? [])]) anim.cancel();
        }
        const lit = Math.min(1, Math.max(0, (from - U_REST) / (uFull(id) - U_REST)));
        const timing = { duration: 120 + CHARGE_DRAIN_MS * lit, delay: CHARGE_DRAIN_DELAY_MS, easing: "cubic-bezier(0.4, 0, 0.6, 1)", fill: "both" as const };
        const drain = chargeAnimations(id, (p) => from + (U_REST - from) * p).map(({ el: node, frames }) => node.animate(frames, timing));
        list.push(...drain);
        // Drained: drop the animations so the overlays are drawn exactly as at
        // idle again (a held animation keeps them on their own layers). A new
        // hover cancels them first, and a cancelled animation never finishes,
        // so this can't touch a newer sequence.
        if (drain.length) drain[drain.length - 1].onfinish = () => drain.forEach((d) => d.cancel());
      }
      for (const comet of q(`[data-path-comet="${id}"]`, document)) fade(comet);
      runs.set(id, list);
    };

    let lastSelected: ZoneId | null = null;
    const skipped = new Set(skipKey ? (skipKey.split(",") as ZoneId[]) : []);
    const unsubscribe = onHoverChange((hovered, selected) => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      // A selected station is already powered: hovering it sends nothing.
      const target = hovered && hovered !== selected && !reduced && PATHS[hovered] && !skipped.has(hovered) ? hovered : null;
      // Deselected but still hovered / focused (e.g. Escape returns focus to
      // its title): it never lost power, so no second pulse.
      const charged = target !== null && target === lastSelected;
      lastSelected = selected;
      if (target === current) return;
      if (current) release(current);
      current = target;
      if (target) fire(target, charged);
    });
    return () => {
      unsubscribe();
      for (const id of runs.keys()) cancel(id);
    };
  }, [onHoverChange, skipKey]);

  return (
    <div ref={root} aria-hidden="true" className="lab-surge pointer-events-none absolute inset-0">
      <style>{ACTIVATION_CSS + skip.map(skipCss).join("")}</style>
      <div className="absolute overflow-hidden" style={sceneRect(CORE_FLASH_BOX)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- full-frame overlay at the plate's geometry */}
        <img
          src="/scene/activation/core.png"
          alt=""
          draggable={false}
          data-core-flash
          className="absolute max-w-none opacity-0 select-none"
          style={{ left: u(-CORE_FLASH_BOX.x), top: u(-CORE_FLASH_BOX.y), width: u(SCENE.width), height: u(SCENE.height) }}
        />
      </div>
      {surgeStations.map((id) => {
        if (skip.includes(id)) return null;
        const path = PATHS[id];
        const trailLen = path.length + 60;
        const line = CHARGE_LINES[id];
        const end = line?.route[line.route.length - 1];
        return (
          <div key={id} data-surge={id} className="absolute" style={sceneRect(ENERGY_BOX)}>
            {end ? (
              <span
                data-surge-burst
                className="absolute opacity-0"
                style={{
                  left: u(end[0] - ENERGY_BOX.x - BURST.w / 2),
                  top: u(end[1] - ENERGY_BOX.y - BURST.h / 2),
                  width: u(BURST.w),
                  height: u(BURST.h),
                  background: "radial-gradient(closest-side, rgb(255 252 240 / 1), rgb(255 206 130 / 0.62) 30%, rgb(255 170 80 / 0.2) 64%, transparent)",
                }}
              />
            ) : null}
            {(line ? ROUTE_PASSES : PASSES).map((p) => (
              <div key={p.name} data-pass={p.name} className="absolute inset-0" style={masked(ENERGY_BOX, line ? ((variant === "v2" && V2_ROUTE_MASKS[id]) || line.masks)[p.mask as "core" | "glow" | "wide"] : p.mask, variant === "v2" && V2_ROUTE_MASKS[id] ? undefined : line?.rect)}>
                <div data-surge-mover className="lab-track absolute inset-0" style={{ transform: at(path.start, ENERGY_BOX) }}>
                  {/* The comet, pointing along the line; its origin is the head. */}
                  <div data-surge-turn className="absolute top-0 left-0 h-0 w-0" style={{ transform: `rotate(${+path.angle.toFixed(2)}deg)` }}>
                    {p.trail && !CHARGE_LINES[id] ? (
                      <span
                        data-surge-trail
                        className="absolute"
                        style={{
                          left: u(-trailLen),
                          top: u(-p.trail.h / 2),
                          width: u(trailLen),
                          height: u(p.trail.h),
                          opacity: TRAIL_TRAVEL,
                          background: `linear-gradient(90deg, transparent 0, ${p.trail.color} ${u(40)})`,
                        }}
                      />
                    ) : null}
                    {p.tail ? (
                      <span
                        data-surge-tail
                        className="absolute opacity-0"
                        style={{
                          left: u(-p.tail.len),
                          top: u(-p.tail.h / 2),
                          width: u(p.tail.len),
                          height: u(p.tail.h),
                          background: `linear-gradient(90deg, transparent, ${p.tail.color})`,
                        }}
                      />
                    ) : null}
                    <span
                      data-surge-head
                      className="absolute opacity-0"
                      style={{
                        left: u(-p.head.w / 2),
                        top: u(-p.head.h / 2),
                        width: u(p.head.w),
                        height: u(p.head.h),
                        background: `radial-gradient(closest-side, ${p.head.color}, transparent)`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
