import type { CSSProperties, ReactNode } from "react";
import { SCENE, u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { STATION_LAYOUT, type HotspotShape } from "./scene-layout";
import { SceneImage } from "./SceneImage";
import { contactOnly, liftCss, liftReducedCss, type LiftSpec } from "./station-lift";

/**
 * M1.4J.3 (/lab-v2 only): Creative Studio's lift. The stone, the easel and the
 * painting, the brushes, the small frames, the strips and every layer of their
 * activation rise as one (.cre-rise) once the energy has arrived; what lies on
 * the floor or stands in front (books, mug, steam) stays. One number, --cl
 * (station-lift.ts), moves and answers everything:
 *   CreativeGround   the contact shadow eases off, a soft shadow spreads
 *   CreativeFront    the mug's steam, whole, and the books' edges
 *   CreativeV2       the station; OFF_FLOOR lets in what the lift uncovers
 *
 * The recovered station ends where the books hid it and holds a little of them
 * and of the steam (scripts/m14j3-creative.py). On the floor it is drawn as it
 * was; off the floor it is drawn with the stone continued and those parts left
 * where they are. On the floor the two are the same picture.
 *
 * The connection ends at the stone's right side, which is upright there: the
 * lift uncovers nothing of it, so it is left alone.
 */

const ID = "creative";
const M14G = "/scene/v2/m14g";
const M14E = "/scene/v2/m14e";
export const M14J3 = "/scene/v2/m14j3";

export const CRE_LIFT: LiftSpec = {
  rise: 10,
  delay: 90,
  ms: 680,
  /** A soft start under load, then a long, restrained stop; never past the target. */
  ease: "cubic-bezier(0.3, 0.02, 0.15, 1)",
  offMs: 420,
  offEase: "cubic-bezier(0.4, 0, 0.2, 1)",
};
const L = CRE_LIFT;

/** 0 on the floor, 1 as soon as the station has left it (within half a px). */
export const OFF_FLOOR = "clamp(0, (var(--cl) - 0.012) * 25, 1)";

/**
 * .cre-aloft: what is only seen off the floor. Out of the picture altogether
 * until the station is used, and after it has come down (with room to spare),
 * so at rest and for the other stations it costs nothing.
 */
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;
const ALOFT_REDUCED_CSS = `.cre-aloft{visibility:hidden!important}`;
const ALOFT_CSS = `.cre-aloft{visibility:hidden;transition:visibility 0s linear ${L.offMs + 200}ms}${ON} .cre-aloft{visibility:visible;transition:visibility 0s}@media (prefers-reduced-motion: reduce){${ALOFT_REDUCED_CSS}}`;

export const CRE_LIFT_CSS = liftCss({ id: ID, cls: "cre", v: "--cl", spec: L }) + ALOFT_CSS;
/** M1.4K.5A lite mode: reduced motion's lift (it stays on the floor, and what shows only aloft stays hidden). */
export const CRE_LIFT_REDUCED_CSS = liftReducedCss("cre", "--cl") + ALOFT_REDUCED_CSS;

/** The scope that carries --cl (box-less: geometry and stacking stay as they are). */
export function CreativeLift({ children }: { children: ReactNode }) {
  return (
    <div data-zone={ID} className="cre-lift-cycle contents">
      <div data-zone={ID} className="cre-lift contents">
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The floor under it
-------------------------------------------------------------------------- */

/** Creative Studio's share of M1.4G's contact shadows: nothing else of them lies in here. */
export const CRE_CONTACT: SceneRect = { x: 85, y: 728, w: 425, h: 72 };
/** Most of it (LEAVES) goes with the platform's edge as that leaves the floor (STEP_OFF) and is gone at full height. */
const LEAVES = 0.7;
const STEP_OFF = "min(1, var(--cl) * 4)";

/**
 * Where the platform stands. Visible: the lowest stone in each column of the
 * artwork, from the left strip to the right corner. Behind the books it runs on
 * to the platform's left end; its back lies under the platform.
 */
const FOOT: readonly (readonly [number, number])[] = [
  [97, 742], [112, 757], [140, 770], [178, 777.5], [216, 779], [232, 778], [304, 775], [368, 773], [392, 771.5], [408, 769],
  [424, 766], [440, 763], [456, 759.5], [472, 755.5], [488, 749.5], [496, 745], [501, 738], [497, 724], [430, 716], [300, 712], [150, 716], [105, 727],
];
const FOOT_BOX: SceneRect = { x: 76, y: 698, w: 450, h: 100 };
const FOOT_CENTRE = { x: 310, y: 752 };
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
/** Its soft shadow, in steps from inside the outline to outside it, each a little of the whole (as Educational's: no blur filter to redraw). */
const SHADOW = 0.3;
const SHADOW_STEPS = [-8, -5.6, -3.9, -2.4, -1, 0.4, 1.9, 3.4, 5.2, 8];
const STEP_ALPHA = +(1 - (1 - SHADOW) ** (1 / SHADOW_STEPS.length)).toFixed(4);

/**
 * Under the platform. The tight contact shadow (M1.4G's own) gives way as the
 * platform leaves the floor; a soft one of the platform's own footprint takes
 * over, a little wider and lower with height. Both are light enough for the
 * floor's texture to show.
 */
export function CreativeGround() {
  return (
    <CreativeLift>
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-creative"
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(CRE_CONTACT), opacity: `calc(1 - ${LEAVES} * ${STEP_OFF})` }}
      />
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-creative-edge"
        className="cre-rise cre-aloft pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(CRE_CONTACT), opacity: `calc(${LEAVES} * ${STEP_OFF} * (1 - var(--cl)))` }}
      />
      <svg
        aria-hidden="true"
        data-v2-ground={ID}
        className="cre-aloft pointer-events-none absolute overflow-visible"
        style={{
          left: u(FOOT_BOX.x),
          top: u(FOOT_BOX.y),
          width: u(FOOT_BOX.w),
          height: u(FOOT_BOX.h),
          transformOrigin: `${u(FOOT_CENTRE.x - FOOT_BOX.x)} ${u(FOOT_CENTRE.y - FOOT_BOX.y)}`,
          transform: "translateY(calc(var(--u) * 1.5 * var(--cl))) scale(calc(0.985 + 0.03 * var(--cl)), calc(0.96 + 0.12 * var(--cl)))",
          fillOpacity: `calc(${STEP_ALPHA} * var(--cl))`,
        }}
        viewBox={`${FOOT_BOX.x} ${FOOT_BOX.y} ${FOOT_BOX.w} ${FOOT_BOX.h}`}
      >
        {SHADOW_STEPS.map((d) => (
          <path key={d} d={outline(d)} fill="rgb(5 4 3)" />
        ))}
      </svg>
    </CreativeLift>
  );
}

/* --------------------------------------------------------------------------
   In front of it
-------------------------------------------------------------------------- */

/**
 * In the foreground (SceneV2), which never moves.
 *
 * The mug's steam: M1.4E's layer is what the plate has over this station, which
 * keeps a little of the steam itself; off the floor the stone rises without it
 * (CreativeV2's fill) and the steam that stays is the whole of it.
 * That one is clipped to where it is: full-frame, it would cost the page one
 * more composited layer. (M1.4E's is not: a clip resamples it.)
 *
 * The books' pixels in the station stay with the books.
 */
const STEAM: SceneRect = { x: 236, y: 704, w: 106, h: 102 };
const STEAM_CLIP = `inset(${u(STEAM.y)} ${u(SCENE.width - STEAM.x - STEAM.w)} ${u(SCENE.height - STEAM.y - STEAM.h)} ${u(STEAM.x)})`;
export function CreativeFront({ className }: { className: string }) {
  const steam = (opacity: string): CSSProperties => ({ mixBlendMode: "plus-lighter", opacity });
  return (
    <CreativeLift>
      <SceneImage src={`${M14E}/fg-steam.png`} data-v2-recovered="steam" className={className} style={steam(`calc(1 - ${OFF_FLOOR})`)} />
      <SceneImage src={`${M14J3}/creative-steam.png`} data-v2-recovered="steam-lifted" className={`cre-aloft ${className}`} style={{ ...steam(OFF_FLOOR), clipPath: STEAM_CLIP }} />
      <SceneImage src={`${M14J3}/creative-books.png`} data-cre="books" className={`cre-aloft ${className}`} style={{ opacity: OFF_FLOOR }} />
    </CreativeLift>
  );
}

/* --------------------------------------------------------------------------
   The hotspot
-------------------------------------------------------------------------- */

/**
 * Its upper points rise with the artwork; its sides and foot stay, so raised it
 * holds every point it held at rest. The canvas's right corner stays too: above
 * it is Engineering's target.
 */
const STAYS = new Set(["92,700", "332,548", "508,748", "470,780", "100,780"]);
const rest = STATION_LAYOUT[ID].hotspot;
const raise = (p: ScenePoint): ScenePoint => (STAYS.has(`${p.x},${p.y}`) ? p : { x: p.x, y: p.y - L.rise });
export const CREATIVE_HOTSPOT_V2: HotspotShape = {
  rest,
  raised: rest.map(raise),
  follows: { cls: "cre", v: "--cl" },
};
