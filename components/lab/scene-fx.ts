import type { ZoneId } from "@/data/zones";
import type { SceneRect } from "@/lib/scene";
import { CHARGE_ROUTES, type ChargeRouteSpec } from "./charge-routes";
import { EXPERIENCE_PATH } from "./experience-path";
import { PLAYGROUND_ROUTE, PLAYGROUND_ROUTE_BEND } from "./playground-route";
import type { LightTrack, Waypoint } from "./MaskedLight";

/**
 * Geometry of the luminous features animated in M1.2, in reference pixels.
 * Mirrors scripts/make-scene-masks.py, which builds the pixel masks the
 * highlights are drawn through. Keep the two in sync.
 */

type Pt = readonly [number, number];

/** Quadratic Béziers fitted to the amber connection lines, centre → station. */
export const CONNECTIONS: { id: ZoneId; p0: Pt; p1: Pt; p2: Pt }[] = [
  { id: "educational", p0: [838.5, 528], p1: [838.5, 495], p2: [838.5, 462] },
  { id: "engineering", p0: [716, 569.5], p1: [651, 556.3], p2: [586, 540.8] },
  { id: "playground", p0: [967, 567.2], p1: [1027.5, 556.1], p2: [1088, 536.5] },
  { id: "creative", p0: [721, 645.7], p1: [613, 685.9], p2: [505, 695.2] },
  { id: "experience", p0: [964, 648.1], p1: [1088, 687.7], p2: [1212, 696.2] },
];

/** Hand-traced orbit ring around the Educational globe (closed loop). */
export const ORBIT: Pt[] = [
  [673.5, 404], [676, 395], [682.5, 387.5], [697.5, 376], [720, 362.5],
  [740, 355], [770, 348], [800, 342], [830, 338], [860, 336], [900, 333.5],
  [922.5, 327.5], [955, 316], [980, 310], [990, 311.5], [992, 316],
  [990, 330], [977.5, 352.5], [960, 372.5], [930, 392.5], [897.5, 407.5],
  [875, 422], [845, 431], [807.5, 433], [770, 430], [740, 425],
  [717.5, 421.5], [692.5, 420.5], [679, 416],
];

/** Compositing areas (reference px) for each effect. */
export const ENERGY_BOX: SceneRect = { x: 440, y: 400, w: 840, h: 360 };
export const ORBIT_BOX: SceneRect = { x: 640, y: 280, w: 380, h: 180 };

/* (M1.3A's PLATFORM_LIGHTS boxes are gone: since M1.3F.1 the platform
   lights are laid out per strip piece, see components/lab/platform-power.ts.) */

/**
 * M1.3A connection lights: one box per amber line (the curve's bounds plus
 * the glow mask's spread). The boxes don't overlap, so each shows only its
 * own line through the shared connection masks.
 */
export const CONNECTION_LIGHTS: { id: ZoneId; box: SceneRect }[] = CONNECTIONS.map((c) => {
  const pad = 12;
  const xs = [c.p0[0], c.p1[0], c.p2[0]];
  const ys = [c.p0[1], c.p1[1], c.p2[1]];
  const x = Math.floor(Math.min(...xs) - pad);
  const y = Math.floor(Math.min(...ys) - pad);
  return { id: c.id, box: { x, y, w: Math.ceil(Math.max(...xs) + pad) - x, h: Math.ceil(Math.max(...ys) + pad) - y } };
});

const deg = (dx: number, dy: number) => (Math.atan2(dy, dx) * 180) / Math.PI;

/** Closed Catmull-Rom sampling of the orbit loop. */
function orbitSamples(pts: Pt[], perSegment = 4): Pt[] {
  const n = pts.length;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const axis = (k: 0 | 1) =>
        0.5 *
        (2 * p1[k] +
          (-p0[k] + p2[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
          (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
      out.push([axis(0), axis(1)]);
    }
  }
  return out;
}

/**
 * Orbit track: one lap per cycle at constant speed, starting and ending at a
 * point the artwork hides behind the glass dome, so the loop is seamless.
 */
export function orbitTrack(): LightTrack {
  const seam = ORBIT.findIndex(([x, y]) => x === 830 && y === 338);
  const loop = [...ORBIT.slice(seam), ...ORBIT.slice(0, seam)];
  const pts = orbitSamples(loop);
  const n = pts.length;
  pts.push(pts[0]); // close the lap
  const seg = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  let acc = 0;
  let prevRot = 0;
  const waypoints: Waypoint[] = pts.map((p, i) => {
    if (i > 0) acc += seg[i - 1];
    const a = pts[(i - 1 + n) % n];
    const b = pts[(i + 1) % n];
    // Unwrap the angle so interpolation never spins the long way round.
    let rot = deg(b[0] - a[0], b[1] - a[1]);
    while (rot - prevRot > 180) rot -= 360;
    while (rot - prevRot < -180) rot += 360;
    prevRot = rot;
    return { at: (acc / total) * 100, x: p[0], y: p[1], rot };
  });
  return { key: "orbit", waypoints };
}

/* --------------------------------------------------------------------------
   M1.3C cinematic hover activation (prototype: Engineering, Playground,
   Educational). Hover sends a pulse from the central A along the station's
   painted connection; the station reacts only once it has arrived.
-------------------------------------------------------------------------- */

/** Centre of the A monogram on the central platform. */
export const CORE_CENTER: Pt = [839, 570];

/**
 * Time (ms) for the hover pulse to travel from the A to the station. Every
 * activation effect of that station is delayed by exactly this much (see
 * activationCss), so nothing reacts before the energy is there. Stations
 * without an entry keep the M1.3A hover (immediate lights).
 */
export const SURGE_ARRIVE_MS: Partial<Record<ZoneId, number>> = {
  // M1.3G: by each traced route's length (72 / 200 / 197 / 224 / 255 px),
  // so the spark visibly charges the whole line before arriving; Playground
  // keeps its approved 650 ms.
  educational: 460,
  engineering: 620,
  playground: 650,
  creative: 640,
  experience: 660,
};
export const surgeStations = (Object.keys(SURGE_ARRIVE_MS) as ZoneId[]).filter((id) => CONNECTIONS.some((c) => c.id === id));
export const isCinematic = (id: ZoneId): boolean => id in SURGE_ARRIVE_MS;

/** How far before the line start the pulse head begins (fully masked). */
const SURGE_LEAD = 26;

export interface SurgePath {
  id: ZoneId;
  /** Line end at the central A. */
  from: Pt;
  /** Line end at the station: arrival point. */
  to: Pt;
  /** Head position at t = 0 (just short of `from`, inside the empty mask). */
  start: Pt;
  /** Direction of travel, degrees (screen coordinates). */
  angle: number;
  length: number;
}

/**
 * Pulse path for a station. The stored Béziers are not trusted to share an
 * orientation: whichever end is nearer the central A is the start. The
 * curves bow by < 1 px over their length, so the pulse travels the chord.
 */
export function surgePath(id: ZoneId): SurgePath {
  const c = CONNECTIONS.find((k) => k.id === id);
  if (!c) throw new Error(`No connection for ${id}`);
  const near = (p: Pt) => Math.hypot(p[0] - CORE_CENTER[0], p[1] - CORE_CENTER[1]);
  const [from, to] = near(c.p0) <= near(c.p2) ? [c.p0, c.p2] : [c.p2, c.p0];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const length = Math.hypot(dx, dy);
  return {
    id,
    from,
    to,
    start: [from[0] - (dx / length) * SURGE_LEAD, from[1] - (dy / length) * SURGE_LEAD],
    angle: deg(dx, dy),
    length,
  };
}

/**
 * M1.3E.1 / M1.3E.2 charge lines. A station's complete painted connection,
 * traced from the plate (scripts/make-playground-layer.mjs), as a route from
 * the A's outer circle to the station. At rest it is shown unpowered (dimmed
 * overlays made from the plate); on hover the spark follows the route and
 * the line is uncovered behind it, with a powered glow, segment by segment;
 * leaving drains it back toward the A.
 */
export interface ChargeSegment {
  /** Chord of this part of the route (the charge window lies along it). */
  from: Pt;
  to: Pt;
  /** Arc range along the route (reference px). */
  s0: number;
  s1: number;
  /** Unpowered overlay, and the powered glow's masks, for this part only. */
  dim: string;
  core: string;
  glow: string;
}
export interface ChargeLine {
  route: readonly Pt[];
  length: number;
  segments: ChargeSegment[];
  /** Masks of the whole route, for the travelling spark. */
  masks: { core: string; glow: string; wide: string };
  /**
   * Scene box the line's images cover (M1.3G: cropped to the route), or
   * absent for full-frame images (Playground's).
   */
  rect?: SceneRect;
  /** Tilt of the arrival burst (deg), so it lies flat on the surface there. */
  burstTilt: number;
}

/**
 * A charge line from a route and the index where each part after the first
 * starts. `files(key)` names a part's images (key: part index) and the
 * route's (key: "route").
 */
function chargeLine(
  route: readonly Pt[],
  starts: readonly number[],
  files: { dim: (k: number) => string; core: (k: number) => string; glow: (k: number) => string; route: { core: string; glow: string; wide: string } },
  extra: { rect?: SceneRect; burstTilt: number },
): ChargeLine {
  const arc = [0];
  for (let i = 1; i < route.length; i++) arc.push(arc[i - 1] + Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]));
  const last = route.length - 1;
  const bounds = [...starts, last];
  return {
    route,
    length: arc[last],
    segments: starts.map((a, k) => ({ from: route[a], to: route[bounds[k + 1]], s0: arc[a], s1: arc[bounds[k + 1]], dim: files.dim(k), core: files.core(k), glow: files.glow(k) })),
    masks: files.route,
    ...extra,
  };
}

const PG = "/scene/activation/playground";
const LINES = "/scene/activation/lines";
export const CHARGE_LINES: Partial<Record<ZoneId, ChargeLine>> = {
  // M1.3E.1/2: across the central platform (to the rim step), then the floor.
  playground: chargeLine(
    PLAYGROUND_ROUTE,
    [0, PLAYGROUND_ROUTE_BEND],
    {
      dim: (k) => `${PG}-line-dim-${"ab"[k]}.png`,
      core: (k) => `${PG}-route-${"ab"[k]}.png`,
      glow: (k) => `${PG}-route-${"ab"[k]}-glow.png`,
      route: { core: `${PG}-route.png`, glow: `${PG}-route-glow.png`, wide: `${PG}-route-wide.png` },
    },
    { burstTilt: -14 },
  ),
  // M1.3G: the other four (scripts/make-charge-lines.mjs).
  ...Object.fromEntries(
    (Object.entries(CHARGE_ROUTES) as [ZoneId, ChargeRouteSpec][]).map(([id, r]) => [
      id,
      chargeLine(
        r.route,
        r.starts,
        {
          dim: (k) => `${LINES}/${id}-${k}-dim.png`,
          core: (k) => `${LINES}/${id}-${k}.png`,
          glow: (k) => `${LINES}/${id}-${k}-glow.png`,
          route: { core: `${LINES}/${id}-route.png`, glow: `${LINES}/${id}-route-glow.png`, wide: `${LINES}/${id}-route-wide.png` },
        },
        { rect: r.box, burstTilt: r.burstTilt },
      ),
    ]),
  ),
};
/**
 * Half-height of the charge windows around a line (reference px): the
 * unpowered bands are generated within it (Playground's +-11 px, M1.3G's
 * floor lines +-14 px, their bloom).
 */
export const CHARGE_HALF = 16;
/** The window starts this far before the A end, and reaches past the station end by as much. */
export const CHARGE_LEAD = 10;
/** Soft front of the charge (reference px). */
export const CHARGE_EDGE = 7;

/** Compositing box of the A's origin flash. */
export const CORE_FLASH_BOX: SceneRect = { x: 756, y: 512, w: 166, h: 116 };

export interface ActivationSpec {
  /** Clip box for the overlays (reference px). */
  box: SceneRect;
  /** Lit overlay: a brighter copy of the station's own glowing pixels. */
  glow: string;
  /** Sustained opacity of the glow while hovered / selected. */
  glowMax: number;
  /** Fade-in after arrival (ms) and extra delay past arrival (ms). */
  glowIn: number;
  glowDelay: number;
  /**
   * Arrival response: the glow (and the platform strips) briefly rise above
   * their sustained level on arrival, then settle. Peak opacity of the extra
   * copy, and its duration (ms, 150–250).
   */
  flare: { glow: number; platform: number; duration: number };
  /**
   * One-shot light band through a mask after arrival. `up` / `down` move a
   * horizontal band; `right` moves an upright band, tilted by `tilt` degrees
   * to follow the surface's perspective.
   */
  scan?: {
    mask: string;
    rect: SceneRect;
    direction: "up" | "down" | "right";
    tilt?: number;
    delay: number;
    duration: number;
    color: string;
  };
  /** A highlight travelling along a painted path (masked to it), after arrival. */
  travel?: {
    mask: string;
    glowMask: string;
    path: readonly (readonly [number, number])[];
    delay: number;
    duration: number;
  };
  /**
   * M1.3E: a miniature game running on a screen while active (ArcadeScreen),
   * warped onto the display's quad. It switches on at arrival.
   */
  game?: { quad: ScreenQuad };
}

/** A display's visible corners (reference px): TL, TR, BR, BL. */
export type ScreenQuad = readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];

/** Bounding box of a point list, padded. */
function bounds(pts: readonly (readonly [number, number])[], pad: number): SceneRect {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.floor(Math.min(...xs) - pad);
  const y = Math.floor(Math.min(...ys) - pad);
  return { x, y, w: Math.ceil(Math.max(...xs) + pad) - x, h: Math.ceil(Math.max(...ys) + pad) - y };
}

/** Overlays from scripts/make-activation-masks.mjs. */
export const ACTIVATION: Partial<Record<ZoneId, ActivationSpec>> = {
  engineering: {
    box: { x: 257, y: 372, w: 349, h: 187 },
    glow: "/scene/activation/engineering.png",
    glowMax: 0.9,
    glowIn: 600,
    glowDelay: 60,
    flare: { glow: 0.55, platform: 0.6, duration: 220 },
    scan: {
      mask: "/scene/activation/engineering-scan.png",
      rect: { x: 336, y: 378, w: 224, h: 110 },
      direction: "up",
      delay: 90,
      duration: 760,
      color: "rgb(205 252 255 / 0.7)",
    },
  },
  playground: {
    box: { x: 1092, y: 336, w: 222, h: 168 },
    glow: "/scene/activation/playground.png",
    glowMax: 0.9,
    glowIn: 480,
    glowDelay: 40,
    flare: { glow: 0.6, platform: 0.65, duration: 230 },
    // The arcade screen switches on and runs a little game. The quad is the
    // display's visible edge, fitted to the plate's pixels (half-maximum
    // crossings between the lit display and the dark bezel, one line per
    // side): the side edges are not parallel, so the warp is projective.
    game: { quad: [[1155, 396.5], [1221, 398.5], [1209.3, 443], [1140.7, 440]] },
  },
  educational: {
    box: { x: 678, y: 258, w: 330, h: 212 },
    glow: "/scene/activation/educational.png",
    glowMax: 0.8,
    glowIn: 700,
    glowDelay: 120,
    flare: { glow: 0.5, platform: 0.6, duration: 240 },
  },
  creative: {
    box: { x: 166, y: 538, w: 270, h: 162 },
    glow: "/scene/activation/creative.png",
    glowMax: 0.75,
    glowIn: 700,
    glowDelay: 200,
    flare: { glow: 0.4, platform: 0.6, duration: 230 },
    // A warm lamp-light passes across the painting, left to right.
    scan: {
      mask: "/scene/activation/creative-scan.png",
      rect: { x: 172, y: 542, w: 156, h: 138 },
      direction: "right",
      tilt: 10,
      delay: 60,
      duration: 900,
      color: "rgb(255 226 170 / 0.5)",
    },
  },
  experience: {
    box: bounds(EXPERIENCE_PATH, 14),
    glow: "/scene/activation/experience.png",
    glowMax: 0.8,
    glowIn: 600,
    // The path glow fills in behind the travelling highlight.
    glowDelay: 520,
    flare: { glow: 0, platform: 0.6, duration: 230 },
    travel: {
      mask: "/scene/activation/experience-scan.png",
      glowMask: "/scene/activation/experience-scan-glow.png",
      path: EXPERIENCE_PATH,
      delay: 120,
      duration: 1150,
    },
  },
};
