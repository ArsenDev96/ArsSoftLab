import type { CSSProperties } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, u, type SceneRect } from "@/lib/scene";

/** A station's rise: scene px, and its timing after the energy's arrival (ms). */
export interface LiftSpec {
  rise: number;
  delay: number;
  ms: number;
  ease: string;
  offMs: number;
  offEase: string;
}

/** Escape and Back leave a station with neither hover nor selection for an instant (ms; as station-cycle.ts). */
const RETURN_HOLD = 20;
/** Chromium (as SceneImage's crops). */
const TWO_NUMBERS = "(object-view-box:none)";

/**
 * M1.4J.2 (/lab-v2 only): the state of a station's lift, as Engineering's
 * (EngineeringLift, M1.4J.1, which keeps its own). One number, `v` (0 on the
 * floor, 1 raised), on `.<cls>-lift`, inside `.<cls>-lift-cycle`:
 *   v-on  this cycle's rise: 0 until the energy arrives, 0 at once on leaving
 *   v     follows it up, and runs down from wherever it is on its own, so a
 *         quick return lets it reach the floor and rises on the new arrival
 *   v-h   raised; keeps it through the instant Escape or Back leaves the
 *         station with neither state
 * That needs a running transition to survive the return, which Chromium does.
 * Elsewhere `v` is one plain transition: a quick return keeps its height until
 * the new arrival.
 *
 * `.<cls>-rise` is the station: one translation, no scale, a whole number of
 * device pixels at full height (--dp: SceneImage). Reduced motion: it stays on
 * the floor.
 */
export function liftCss({ id, cls, v, spec }: { id: ZoneId; cls: string; v: string; spec: LiftSpec }): string {
  const on = `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"])`;
  const returning = `[data-lab-returning="${id}"]`;
  const up = `${spec.ms}ms ${spec.ease} calc(var(--arrive-now) + ${spec.delay}ms)`;
  const down = `${spec.offMs}ms ${spec.offEase}`;
  const lift = `.${cls}-lift`;
  const cycle = `.${cls}-lift-cycle`;
  const rise = `--${cls}-rise`;
  const sum = `${v}:max(var(${v}-on),var(${v}-h))`;
  return (
    [`${v}-on`, `${v}-h`, v].map((n) => `@property ${n}{syntax:"<number>";inherits:true;initial-value:0}`).join("") +
    `${lift}{${rise}:${u(spec.rise)};${v}:0;transition:${v} ${down}}` +
    `@supports (width:round(nearest,1px,1px)){${lift}{${rise}:round(nearest,${u(spec.rise)},var(--dp,1px))}}` +
    `${returning} ${lift}{transition:${v} ${down} ${RETURN_HOLD}ms}` +
    `${on} ${lift}{${v}:1;transition:${v} ${up}}` +
    `@supports ${TWO_NUMBERS}{` +
    `${cycle}{${v}-on:0;${v}-h:0;transition:none}` +
    `${returning} ${cycle}{transition:${v}-h 0ms linear ${RETURN_HOLD}ms}` +
    `${on} ${cycle}{${v}-on:1;${v}-h:1;transition:${v}-on ${up},${v}-h 0ms linear calc(var(--arrive-now) + ${spec.delay + spec.ms}ms)}` +
    `${lift},${returning} ${lift}{${sum};transition:${v} ${down}}` +
    // Follows at once; naming the property (not `none`) lets a descent in progress finish.
    `${on} ${lift}{${sum};transition:${v} 0s}}` +
    `.${cls}-rise{transform:translateY(calc(var(${rise}) * -1 * var(${v})))}` +
    `@media (prefers-reduced-motion: reduce){${cycle},${lift}{transition:none!important}${lift}{${v}:0!important}}`
  );
}

/* --------------------------------------------------------------------------
   M1.4G's contact shadows are one image: a lifted station's share is drawn by
   itself, so it can answer the lift, and left out of the rest.
-------------------------------------------------------------------------- */

const pct = (x: number, y: number) => `${+((x / SCENE.width) * 100).toFixed(4)}% ${+((y / SCENE.height) * 100).toFixed(4)}%`;
const corners = ({ x, y, w, h }: SceneRect) => [pct(x, y), pct(x + w, y), pct(x + w, y + h), pct(x, y + h)];

export const contactOnly = (r: SceneRect): CSSProperties => ({ clipPath: `polygon(${corners(r).join(", ")})` });
/** One even-odd outline: the frame, then in and out of each rectangle along the same line. */
export const contactWithout = (...rs: readonly SceneRect[]): CSSProperties => ({
  clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${rs.map((r) => [...corners(r), corners(r)[0], "0 0"].join(", ")).join(", ")})`,
});

/** A mask over a full-frame layer: gradients in scene px, multiplied. */
export function frameMask(...images: readonly string[]): CSSProperties {
  const image = images.join(", ");
  const more: CSSProperties = images.length > 1 ? { maskComposite: "intersect", WebkitMaskComposite: "source-in" } : {};
  return { maskImage: image, WebkitMaskImage: image, ...more };
}
