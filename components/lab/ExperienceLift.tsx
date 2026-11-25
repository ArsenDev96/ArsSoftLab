import type { ReactNode } from "react";
import { u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { STATION_LAYOUT, type HotspotShape } from "./scene-layout";
import { SceneImage } from "./SceneImage";
import { contactOnly, liftCss, type LiftSpec } from "./station-lift";

/**
 * M1.4J.4 (/lab-v2 only): Experience's lift. The stone, the terrain, the
 * mountain route, the ridges, the flags, the code panel, the plant on the
 * stone, the strips and every layer of their activation rise as one (.exp-rise)
 * once the energy has arrived; what lies on the floor stays. One number, --xl
 * (station-lift.ts), moves and answers everything:
 *   ExperienceGround   the contact shadow eases off, a soft shadow spreads
 *   ExperienceV2       the station; the strips' light on the floor softens
 *
 * The code panel is part of it: both its posts stand in the terrain, the ridges
 * and the upper flag stand before it, and it is one opaque piece with them in
 * the recovered station (the floor behind the glass is in it, too).
 *
 * The connection ends at the stone's left side, which is upright there: the
 * lift uncovers nothing of it, so it is left alone. Nothing in the foreground
 * overlaps the station, so it rises as it is.
 */

const ID = "experience";
const M14G = "/scene/v2/m14g";
export const M14J4 = "/scene/v2/m14j4";

export const EXP_LIFT: LiftSpec = {
  rise: 10,
  delay: 90,
  ms: 700,
  /** A soft start under load, then a long, restrained stop; never past the target. */
  ease: "cubic-bezier(0.3, 0.02, 0.15, 1)",
  offMs: 420,
  offEase: "cubic-bezier(0.4, 0, 0.2, 1)",
};
const L = EXP_LIFT;

/** .exp-aloft: what is only seen off the floor (as Creative Studio's). */
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;
const ALOFT_CSS = `.exp-aloft{visibility:hidden;transition:visibility 0s linear ${L.offMs + 200}ms}${ON} .exp-aloft{visibility:visible;transition:visibility 0s}@media (prefers-reduced-motion: reduce){.exp-aloft{visibility:hidden!important}}`;

export const EXP_LIFT_CSS = liftCss({ id: ID, cls: "exp", v: "--xl", spec: L }) + ALOFT_CSS;

/** The scope that carries --xl (box-less: geometry and stacking stay as they are). */
export function ExperienceLift({ children }: { children: ReactNode }) {
  return (
    <div data-zone={ID} className="exp-lift-cycle contents">
      <div data-zone={ID} className="exp-lift contents">
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The floor under it
-------------------------------------------------------------------------- */

/** Experience's share of M1.4G's contact shadows: nothing else of them lies in here. */
export const EXP_CONTACT: SceneRect = { x: 1190, y: 722, w: 482, h: 80 };
/** Most of it (LEAVES) goes with the platform's edge as that leaves the floor (STEP_OFF) and is gone at full height. */
const LEAVES = 0.7;
const STEP_OFF = "min(1, var(--xl) * 4)";

/**
 * Where the platform stands: the lowest pixel of its base in each column of the
 * artwork, from the rim's left end to the right corner; its back lies under it.
 */
const FOOT: readonly (readonly [number, number])[] = [
  [1201.5, 733], [1205, 740], [1212, 746.5], [1224, 752.5], [1236, 756.5], [1248, 759.5], [1272, 764], [1296, 769], [1320, 773.5], [1344, 777], [1368, 780], [1392, 782.5],
  [1416, 784], [1440, 785], [1500, 785], [1536, 784], [1560, 782.5], [1584, 780], [1608, 776.5], [1632, 770.5], [1644, 766], [1653, 758], [1660, 748], [1655, 728], [1590, 716], [1280, 714], [1215, 722],
];
const FOOT_BOX: SceneRect = { x: 1180, y: 698, w: 492, h: 112 };
const FOOT_CENTRE = { x: 1432, y: 752 };
/** FOOT, moved outwards by `d` px (1.3 times that across: the floor is seen at a low angle). */
function outline(d: number): string {
  const n = FOOT.length;
  const pts = FOOT.map(([x, y], i) => {
    const [ax, ay] = FOOT[(i + n - 1) % n];
    const [bx, by] = FOOT[(i + 1) % n];
    const l = Math.hypot(bx - ax, by - ay);
    return `${(x - (1.3 * d * (by - ay)) / l).toFixed(1)} ${(y + (d * (bx - ax)) / l).toFixed(1)}`;
  });
  return `M${pts.join("L")}Z`;
}
/** Its soft shadow, in steps from inside the outline to outside it, each a little of the whole (no blur filter to redraw). */
const SHADOW = 0.3;
const SHADOW_STEPS = [-8, -5.6, -3.9, -2.4, -1, 0.4, 1.9, 3.4, 5.2, 8];
const STEP_ALPHA = +(1 - (1 - SHADOW) ** (1 / SHADOW_STEPS.length)).toFixed(4);

/**
 * Under the platform. The tight contact shadow (M1.4G's own) gives way as the
 * platform leaves the floor; a soft one of the platform's own footprint takes
 * over, a little wider and lower with height. Both are light enough for the
 * floor's texture to show.
 */
export function ExperienceGround() {
  return (
    <ExperienceLift>
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-experience"
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(EXP_CONTACT), opacity: `calc(1 - ${LEAVES} * ${STEP_OFF})` }}
      />
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-experience-edge"
        className="exp-rise exp-aloft pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(EXP_CONTACT), opacity: `calc(${LEAVES} * ${STEP_OFF} * (1 - var(--xl)))` }}
      />
      <svg
        aria-hidden="true"
        data-v2-ground={ID}
        className="exp-aloft pointer-events-none absolute overflow-visible"
        style={{
          left: u(FOOT_BOX.x),
          top: u(FOOT_BOX.y),
          width: u(FOOT_BOX.w),
          height: u(FOOT_BOX.h),
          transformOrigin: `${u(FOOT_CENTRE.x - FOOT_BOX.x)} ${u(FOOT_CENTRE.y - FOOT_BOX.y)}`,
          transform: "translateY(calc(var(--u) * 1.5 * var(--xl))) scale(calc(0.985 + 0.03 * var(--xl)), calc(0.96 + 0.12 * var(--xl)))",
          fillOpacity: `calc(${STEP_ALPHA} * var(--xl))`,
        }}
        viewBox={`${FOOT_BOX.x} ${FOOT_BOX.y} ${FOOT_BOX.w} ${FOOT_BOX.h}`}
      >
        {SHADOW_STEPS.map((d) => (
          <path key={d} d={outline(d)} fill="rgb(5 4 3)" />
        ))}
      </svg>
    </ExperienceLift>
  );
}

/* --------------------------------------------------------------------------
   The hotspot
-------------------------------------------------------------------------- */

/**
 * Its upper points rise with the artwork; its left corner and its foot stay, so
 * raised it holds every point it held at rest. It meets no other target: its
 * panel is 12 px right of Playground's, its label and chip lie above it.
 */
const rest = STATION_LAYOUT[ID].hotspot;
const STAYS = new Set(["1206,690", "1664,782", "1206,782"]);
const raise = (p: ScenePoint): ScenePoint => (STAYS.has(`${p.x},${p.y}`) ? p : { x: p.x, y: p.y - L.rise });
export const EXPERIENCE_HOTSPOT_V2: HotspotShape = {
  rest,
  raised: rest.map(raise),
  follows: { cls: "exp", v: "--xl" },
};
