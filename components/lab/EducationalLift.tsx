import type { CSSProperties, ReactNode } from "react";
import { u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { CHARGE_ROUTES } from "./charge-routes";
import { CONNECTION_LAYERS } from "./scene-25d-data";
import { STATION_LAYOUT, type HotspotShape } from "./scene-layout";
import { SceneImage } from "./SceneImage";
import { contactOnly, frameMask, liftCss, type LiftSpec } from "./station-lift";

/**
 * M1.4J.2 (/lab-v2 only): Educational's lift. The stone, the island and church,
 * the spheres, the orbit, the strips and every layer of their activation rise
 * as one (.edu-rise) once the energy has arrived; what lies on the floor stays.
 * One number, --dl (station-lift.ts), moves and answers everything:
 *   EducationalGround     the contact shadow eases off, a soft shadow spreads
 *   .edu-floor            (EducationalV2) the corner strips' spill softens
 *   EducationalLine       the connection's end, in the stone's channel
 */

const ID = "educational";
const M14G = "/scene/v2/m14g";

export const EDU_LIFT: LiftSpec = {
  /** 12 px would put the great sphere's glow on the icon and on AriMap's outline. */
  rise: 10,
  delay: 90,
  ms: 680,
  /** A soft start under load, then a long, restrained stop; never past the target. */
  ease: "cubic-bezier(0.3, 0.02, 0.15, 1)",
  offMs: 420,
  offEase: "cubic-bezier(0.4, 0, 0.2, 1)",
};
const L = EDU_LIFT;

export const EDU_LIFT_CSS = liftCss({ id: ID, cls: "edu", v: "--dl", spec: L });

/** The scope that carries --dl (box-less: geometry and stacking stay as they are). */
export function EducationalLift({ children }: { children: ReactNode }) {
  return (
    <div data-zone={ID} className="edu-lift-cycle contents">
      <div data-zone={ID} className="edu-lift contents">
        {children}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   The floor under it
-------------------------------------------------------------------------- */

/** Educational's share of M1.4G's contact shadows: nothing else of them lies in here. */
export const EDU_CONTACT: SceneRect = { x: 655, y: 390, w: 350, h: 125 };
/**
 * The part of it that lies beside the station, not under it (along the stone's
 * left side and under the sphere's edge): it goes with the station. On the
 * floor the whole share is drawn in one piece, so it has no seam; the moment
 * the station leaves the floor (OFF_FLOOR) this part is handed to its own copy,
 * which rises.
 */
const SIDE: SceneRect = { x: 655, y: 390, w: 28.5, h: 98 };
const OFF_FLOOR = "clamp(0, (var(--dl) - 0.012) * 25, 1)";
const SIDE_EDGE = u(SIDE.x + SIDE.w);
const STAYING: CSSProperties = { ...contactOnly(EDU_CONTACT), ...frameMask(`linear-gradient(90deg, rgb(0 0 0 / calc(1 - ${OFF_FLOOR})) ${SIDE_EDGE}, #000 ${SIDE_EDGE})`) };
/** Its rising copy, let out softly at its foot. */
const SIDE_RISES: CSSProperties = { ...contactOnly(SIDE), ...frameMask(`linear-gradient(#000 ${u(SIDE.y + SIDE.h - 20)}, transparent ${u(SIDE.y + SIDE.h)})`) };
/**
 * The part under the platform: most of it (LEAVES) goes with the platform's edge
 * as that leaves the floor (STEP_OFF: over the first quarter) and is gone at full
 * height, so the floor just uncovered is never lighter than the floor beside it.
 */
const UNDER: SceneRect = { x: SIDE.x + SIDE.w, y: 480, w: EDU_CONTACT.x + EDU_CONTACT.w - SIDE.x - SIDE.w, h: 35 };
const LEAVES = 0.7;
const STEP_OFF = "min(1, var(--dl) * 4)";

/**
 * Where the platform stands: the plinth is round, and its ground contour (the
 * lowest stone in each column of the artwork) is this ellipse, to about 0.5 px.
 */
const FOOT = { cx: 839.5, cy: 486.3, rx: 156.5, ry: 10.3 };
const FOOT_BOX: SceneRect = { x: 663, y: 464, w: 353, h: 46 };
/**
 * Its soft shadow: the ellipse, drawn in steps from 8 px inside it to 8 px
 * outside (across; 1.3 times that along), each a little of the whole. A blur
 * filter would be drawn again every frame of the lift, which halves the frame
 * rate on an old GPU.
 */
const SHADOW = 0.3;
const SHADOW_STEPS = [-8, -5.6, -3.9, -2.4, -1, 0.4, 1.9, 3.4, 5.2, 8];
const STEP_ALPHA = +(1 - (1 - SHADOW) ** (1 / SHADOW_STEPS.length)).toFixed(4);

/**
 * Under the platform. The tight contact shadow (M1.4G's own) gives way as the
 * platform leaves the floor; a soft one of the platform's own footprint takes
 * over, a little wider and lower with height. Both are light enough for the
 * floor's texture to show.
 */
export function EducationalGround() {
  return (
    <EducationalLift>
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-educational"
        className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...STAYING, opacity: `calc(1 - ${LEAVES} * ${STEP_OFF})` }}
      />
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-educational-side"
        className="edu-rise pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...SIDE_RISES, opacity: OFF_FLOOR }}
      />
      <SceneImage
        src={`${M14G}/contact.png`}
        data-v2-floor="contact-educational-edge"
        className="edu-rise pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
        style={{ ...contactOnly(UNDER), opacity: `calc(${LEAVES} * ${STEP_OFF} * (1 - var(--dl)))` }}
      />
      <svg
        aria-hidden="true"
        data-v2-ground={ID}
        className="pointer-events-none absolute overflow-visible"
        style={{
          left: u(FOOT_BOX.x),
          top: u(FOOT_BOX.y),
          width: u(FOOT_BOX.w),
          height: u(FOOT_BOX.h),
          transformOrigin: `${u(FOOT.cx - FOOT_BOX.x)} ${u(FOOT.cy - FOOT_BOX.y)}`,
          transform: "translateY(calc(var(--u) * 1.5 * var(--dl))) scale(calc(0.985 + 0.03 * var(--dl)), calc(0.96 + 0.12 * var(--dl)))",
          fillOpacity: `calc(${STEP_ALPHA} * var(--dl))`,
        }}
        viewBox={`${FOOT_BOX.x} ${FOOT_BOX.y} ${FOOT_BOX.w} ${FOOT_BOX.h}`}
      >
        {SHADOW_STEPS.map((d) => (
          <ellipse key={d} cx={FOOT.cx} cy={FOOT.cy} rx={+(FOOT.rx + 1.3 * d).toFixed(2)} ry={+(FOOT.ry + d).toFixed(2)} fill="rgb(5 4 3)" />
        ))}
      </svg>
    </EducationalLift>
  );
}

/* --------------------------------------------------------------------------
   The connection
-------------------------------------------------------------------------- */

const R = CHARGE_ROUTES[ID]!.route;
/** The line's length (reference px): straight up the scene, to 0.1 px. */
const LENGTH = R.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - R[i][0], p[1] - R[i][1]), 0);
const { box: LINE_BOX, parts: LINE_PARTS } = CONNECTION_LAYERS[ID];
const END = R[R.length - 1];

export interface LineLook {
  color: string;
  width: number;
}

/**
 * The line runs over the floor to the stone's foot (y 496), then up the channel
 * in the stone's face to the strip (y 461.5). The floor run stays; the raised
 * stone uncovers its next 10 px, which run on under the platform. The run in
 * the channel belongs to the stone and rises with it. Both are the same
 * straight stroke one above the other, so together they are the line with its
 * upper end 10 px further up: one path, longer by the lift, with no joint that
 * could show a seam. On the floor it is the approved line.
 */
export function EducationalLine({ strokes }: { strokes: readonly LineLook[] }) {
  const d = `${LINE_PARTS[0].path}L${(END[0] - LINE_BOX.x).toFixed(2)} ${(END[1] - LINE_BOX.y - L.rise).toFixed(2)}`;
  return strokes.map((st, k) => (
    <path
      key={k}
      d={d}
      fill="none"
      stroke={st.color}
      strokeWidth={st.width}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ strokeDasharray: `calc((${LENGTH.toFixed(3)} + ${L.rise} * var(--dl, 0)) * 1px) 9999px` }}
    />
  ));
}

/* --------------------------------------------------------------------------
   The hotspot
-------------------------------------------------------------------------- */

/**
 * Its outline rises with the artwork wherever that only adds to it: raised, it
 * holds every point it held at rest (the sides, the notch on the right and the
 * foot stay), so a still pointer keeps the station through the lift.
 */
const rest = STATION_LAYOUT[ID].hotspot;
/** The points that stay: right side, foot, left side. */
const STAYS = new Set(["996,350", "996,492", "680,492", "672,450"]);
/** The notch's point, moved up along the resting outline as far as the raised one lets it. */
const NOTCH = "985,420";
const raise = (p: ScenePoint): ScenePoint => {
  const key = `${p.x},${p.y}`;
  if (STAYS.has(key)) return p;
  if (key === NOTCH) return { x: 986.2, y: 414 };
  return { x: p.x, y: p.y - L.rise };
};
export const EDUCATIONAL_HOTSPOT_V2: HotspotShape = {
  rest,
  raised: rest.map(raise),
  follows: { cls: "edu", v: "--dl" },
};
