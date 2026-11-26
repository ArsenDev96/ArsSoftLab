import type { CSSProperties, ReactNode } from "react";
import type { ZoneId } from "@/data/zones";
import { u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { CHARGE_ROUTES } from "./charge-routes";
import { CONNECTION_LAYERS } from "./scene-25d-data";
import { STATION_LAYOUT, type HotspotShape } from "./scene-layout";
import { SceneImage } from "./SceneImage";
import { contactOnly } from "./station-lift";

/**
 * M1.4J.1 (/lab-v2 only): Engineering's lift. The whole workstation (stone,
 * laptop, plant, hologram, its strips and every layer of their activation)
 * rises as one once the energy has arrived; what lies on the floor stays.
 *
 * One number, --el (0 on the floor, 1 raised), moves and answers everything:
 *   .eng-rise            the station's layers: one translation, no scale, so
 *                        every layer keeps its place to the others. At full
 *                        height it is a whole number of device pixels, so the
 *                        artwork keeps its place on the pixel grid
 *   EngineeringGround    the contact shadow eases off, a soft shadow spreads
 *   .eng-floor           (EngineeringV2) the strips' reflection softens
 *   EngineeringLineEnd   the connection's run beneath the raised platform (--eng-join: off the floor)
 *
 * Leaving during the rise turns back from that height. As the station's own
 * numbers (M1.4I.1B), --el is two: --el-on is this cycle's rise (0 until the
 * energy arrives, 0 at once on leaving) and --el follows it up, and runs down
 * from wherever it is on its own. So a return while it sinks lets it finish and
 * rises again on the new arrival: nothing hangs in the air through a charge.
 * --elh: raised; keeps it through the moment Escape or Back leaves the station
 * with neither state (as --eh does for the rest).
 *
 * That needs a running transition to survive the return, which Chromium does.
 * Firefox ends it (it looks at the parent's end value, as the specification
 * says), which would drop the platform in one frame. Everywhere else --el is
 * therefore one plain transition: a quick return keeps the height it has until
 * the new arrival, as Playground's does.
 *
 * Reduced motion: the station stays on the floor (the existing policy).
 */

const ID = "engineering";
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;
const M14G = "/scene/v2/m14g";

export const ENG_LIFT = {
  /** Scene px. */
  rise: 12,
  /** After the energy's arrival (ms). */
  delay: 60,
  ms: 600,
  /** A soft start under load, then a long, restrained stop; never past the target. */
  ease: "cubic-bezier(0.3, 0.02, 0.15, 1)",
  offMs: 420,
  offEase: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;
const L = ENG_LIFT;
/** As EngineeringV2's: Escape's hand-over. */
const RETURN_HOLD = 20;

const UP = `${L.ms}ms ${L.ease} calc(var(--arrive-now) + ${L.delay}ms)`;
const DOWN = `${L.offMs}ms ${L.offEase}`;
/** Chromium (as SceneImage's crops). */
const TWO_NUMBERS = "(object-view-box:none)";

/** Reduced motion: it stays on the floor. M1.4K.4: also lite mode's (EngineeringV2's ENG_LITE_CSS), without the media query. */
export const ENG_LIFT_REDUCED_CSS = `.eng-lift-cycle,.eng-lift{transition:none!important}.eng-lift{--el:0!important}`;

export const ENG_LIFT_CSS =
  ["--el-on", "--elh", "--el"].map((v) => `@property ${v}{syntax:"<number>";inherits:true;initial-value:0}`).join("") +
  `.eng-lift{--eng-rise:${u(L.rise)};--el:0;--eng-join:clamp(0,(var(--el) - 0.012) * 25,1);transition:--el ${DOWN}}` +
  // Whole device pixels (--dp: SceneImage).
  `@supports (width:round(nearest,1px,1px)){.eng-lift{--eng-rise:round(nearest,${u(L.rise)},var(--dp,1px))}}` +
  `[data-lab-returning="${ID}"] .eng-lift{transition:--el ${DOWN} ${RETURN_HOLD}ms}` +
  `${ON} .eng-lift{--el:1;transition:--el ${UP}}` +
  `@supports ${TWO_NUMBERS}{` +
  `.eng-lift-cycle{--el-on:0;--elh:0;transition:none}` +
  `[data-lab-returning="${ID}"] .eng-lift-cycle{transition:--elh 0ms linear ${RETURN_HOLD}ms}` +
  `${ON} .eng-lift-cycle{--el-on:1;--elh:1;transition:--el-on ${UP},--elh 0ms linear calc(var(--arrive-now) + ${L.delay + L.ms}ms)}` +
  `.eng-lift,[data-lab-returning="${ID}"] .eng-lift{--el:max(var(--el-on),var(--elh));transition:--el ${DOWN}}` +
  // Follows at once; naming the property (not `none`) lets a descent in progress finish.
  `${ON} .eng-lift{--el:max(var(--el-on),var(--elh));transition:--el 0s}}` +
  `.eng-rise{transform:translateY(calc(var(--eng-rise) * -1 * var(--el)))}` +
  `@media (prefers-reduced-motion: reduce){${ENG_LIFT_REDUCED_CSS}}`;

/** The scope that carries --el (box-less: geometry and stacking stay as they are). */
export function EngineeringLift({ children }: { children: ReactNode }) {
  return (
    <div data-zone={ID} className="eng-lift-cycle contents">
      <div data-zone={ID} className="eng-lift contents">
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The floor under it
-------------------------------------------------------------------------- */

/** Engineering's share of M1.4G's contact shadows: nothing else of them lies in here. */
export const ENG_CONTACT: SceneRect = { x: 250, y: 515, w: 370, h: 56 };

/**
 * Where the platform stands: its ground contour (the lowest stone in each
 * column of the artwork), closed under the station.
 */
const FOOT =
  "M262 530L266 538.5L276 542L288 544L300 546L312 548L336 549.5L372 550.5L420 551.5L456 550.5L480 550L492 549L504 547L516 545.5L528 544L540 543L562 541L572 539.5L584 537.5L594 534.5L599 528" +
  "L600 516L560 508L430 504L300 508L264 518Z";
const FOOT_BOX: SceneRect = { x: 232, y: 486, w: 398, h: 96 };
const FOOT_CENTRE = { x: 431, y: 528 };

/**
 * The ring's lit disc (M1.4G) was recovered up to the resting stone's edge
 * (x 599). Raised, that edge would show as a straight step, so the disc's light
 * gives way towards the platform, in its shadow. For the full-frame floor layer;
 * at rest the mask is opaque. The ring itself (x 600-618, from y 536) stays.
 */
export const ENG_DISC_FADE: CSSProperties = (() => {
  const mask = `radial-gradient(${u(15)} ${u(11)} at ${u(598)} ${u(527)}, rgb(0 0 0 / calc(1 - var(--el, 0))) 20%, #000)`;
  return { maskImage: mask, WebkitMaskImage: mask };
})();

/**
 * On the floor, never lifted. The tight contact shadow (M1.4G's own) gives way
 * as the platform leaves it; a soft one of the platform's own footprint takes
 * over, a little wider and lower with height. Both are light enough for the
 * floor's texture to show.
 */
export function EngineeringGround({ line, lite = false }: { line: readonly LineStroke[]; lite?: boolean }) {
  return (
    <EngineeringLift>
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-engineering"
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(ENG_CONTACT), opacity: "calc(1 - 0.7 * var(--el))" }}
      />
      {/* M1.4K.4 lite: no lift, so the soft shadow it spreads (transparent on the floor) is not mounted. */}
      {lite ? null : (
        <svg
          aria-hidden="true"
          data-v2-ground={ID}
          className="pointer-events-none absolute overflow-visible"
          style={{
            left: u(FOOT_BOX.x),
            top: u(FOOT_BOX.y),
            width: u(FOOT_BOX.w),
            height: u(FOOT_BOX.h),
            transformOrigin: `${u(FOOT_CENTRE.x - FOOT_BOX.x)} ${u(FOOT_CENTRE.y - FOOT_BOX.y)}`,
            transform: "translateY(calc(var(--u) * 1.5 * var(--el))) scale(calc(0.985 + 0.03 * var(--el)), calc(0.96 + 0.12 * var(--el)))",
            opacity: "calc(0.3 * var(--el))",
          }}
          viewBox={`${FOOT_BOX.x} ${FOOT_BOX.y} ${FOOT_BOX.w} ${FOOT_BOX.h}`}
        >
          <filter id="eng-foot-soft" filterUnits="userSpaceOnUse" x={FOOT_BOX.x} y={FOOT_BOX.y} width={FOOT_BOX.w} height={FOOT_BOX.h}>
            <feGaussianBlur stdDeviation="6 4.5" />
          </filter>
          <path d={FOOT} fill="rgb(5 4 3)" filter="url(#eng-foot-soft)" />
        </svg>
      )}
      <EngineeringLineEnd strokes={line} />
    </EngineeringLift>
  );
}

/* --------------------------------------------------------------------------
   The connection beneath it
-------------------------------------------------------------------------- */

const R = CHARGE_ROUTES[ID]!.route;
const E = R[R.length - 1];
/** How far the line runs on past its end E; the raised platform covers the floor from about 48 px. */
const EXT = 68;
const X = (() => {
  const a = R[R.length - 3];
  const l = Math.hypot(E[0] - a[0], E[1] - a[1]);
  return [E[0] + (EXT * (E[0] - a[0])) / l, E[1] + (EXT * (E[1] - a[1])) / l] as const;
})();
const { box: LINE_BOX, parts: LINE_PARTS } = CONNECTION_LAYERS[ID];
/** The line's last part, the one that reaches the station. */
const LAST = LINE_PARTS.length - 1;
export const isEngineeringLineEnd = (id: ZoneId, part: number): boolean => id === ID && part === LAST;
/** Where the two drawings of it hand over: open floor, 8-30 px before E (the connection's own box). */
const JOIN = { x1: E[0] + 8 - LINE_BOX.x, x2: E[0] + 30 - LINE_BOX.x, y1: 0, y2: 0 };

/** A stroke that is `far` (opacity) at E's side of the hand-over and `near` before it. */
function JoinGradient({ id, color, far, near }: { id: string; color: string; far: string; near: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" {...JOIN}>
      <stop offset="0" style={{ stopColor: color, stopOpacity: far }} />
      <stop offset="1" style={{ stopColor: color, stopOpacity: near }} />
    </linearGradient>
  );
}

/** The powered line's strokes (ChargeLine's BOOST): colour, strength, width. */
export interface LineStroke {
  color: string;
  alpha: number;
  width: number;
}

/**
 * The powered line's last part, as ChargeLine draws it: while the platform is
 * off the floor (--eng-join), its end gives way to EngineeringLineEnd. At rest
 * the gradient is one colour: the approved line.
 */
export function EngineeringLinePart({ strokes }: { strokes: readonly LineStroke[] }) {
  return (
    <>
      {strokes.map((st, k) => (
        <JoinGradient key={k} id={`eng-line-part-${k}`} color={st.color} far={`calc(${st.alpha} * (1 - var(--eng-join, 0)))`} near={`${st.alpha}`} />
      ))}
      {strokes.map((st, k) => (
        <path key={k} d={LINE_PARTS[LAST].path} fill="none" stroke={`url(#eng-line-part-${k})`} strokeWidth={st.width} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </>
  );
}

/**
 * The connection ends on the stone at rest; raised, the platform uncovers the
 * floor beyond that end. So the line runs on there: the same curve, continued
 * straight along its last stretch to under the platform. It lies on the floor
 * beneath the station, which hides it at rest and covers its far end when
 * raised: no mask, nothing that moves. Drawn as one path with the line's last
 * part and handed over to on open floor (a cross-fade of the same strokes),
 * so nothing meets at E. Its power is the line's own (data-charge-power:
 * EnergySurge).
 */
function EngineeringLineEnd({ strokes }: { strokes: readonly LineStroke[] }) {
  const d = `${LINE_PARTS[LAST].path}L${(X[0] - LINE_BOX.x).toFixed(2)} ${(X[1] - LINE_BOX.y).toFixed(2)}`;
  return (
    <svg
      aria-hidden="true"
      data-v2-line-end={ID}
      className="pointer-events-none absolute overflow-visible"
      style={{ left: u(LINE_BOX.x), top: u(LINE_BOX.y), width: u(LINE_BOX.w), height: u(LINE_BOX.h) }}
      viewBox={`0 0 ${LINE_BOX.w} ${LINE_BOX.h}`}
    >
      {strokes.map((st, k) => (
        <JoinGradient key={k} id={`eng-line-end-${k}`} color={st.color} far={`calc(${st.alpha} * var(--eng-join, 0))`} near="0" />
      ))}
      <g data-charge-power={ID}>
        {strokes.map((st, k) => (
          <path key={k} d={d} fill="none" stroke={`url(#eng-line-end-${k})`} strokeWidth={st.width} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  );
}

/* --------------------------------------------------------------------------
   The hotspot
-------------------------------------------------------------------------- */

/**
 * The laptop, the hologram and the stone's upper edge rise with the station, so
 * the outline's upper points do too. Its lower points stay: a pointer resting
 * at the platform's foot keeps it when the stone has risen from under it.
 */
const UPPER_MAX_Y = 506;
const rest = STATION_LAYOUT[ID].hotspot;
const raise = (p: ScenePoint): ScenePoint => (p.y < UPPER_MAX_Y ? { x: p.x, y: p.y - L.rise } : p);
export const ENGINEERING_HOTSPOT_V2: HotspotShape = {
  rest,
  raised: rest.map(raise),
  on: UP,
  off: DOWN,
};
