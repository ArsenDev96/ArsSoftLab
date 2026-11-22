import { PLAYGROUND_ROUTE } from "./playground-route";

/**
 * M1.4E.3 (/lab-v2 only): Playground's connection as ONE continuous path,
 * from the central A's ring, across its platform, over the rim and across the
 * floor to the station, and on beneath it (M1.4E.2's extension, 62 px past
 * the base's ground contact E; the lifted base covers the floor from 52 px).
 *
 * The accurate M1.3E route points, smoothed as a quadratic B-spline (the curve
 * runs through the midpoints of consecutive route segments, each route point
 * a control point). Along the floor this moves the line by < 0.1 px. At the
 * platform rim, where the route turns by 26 deg, it rounds the corner over
 * ~9 px and moves the line by 0.5 px there. Up to M1.4E.2 that corner was the
 * junction of two separately drawn parts, and the floor extension was a third.
 *
 * Arc lengths are computed here (sampled) so the charge front, which the
 * route's windows express as `u` (px along the route polyline), can drive
 * a dash along this path.
 */

type P = readonly [number, number];

const R = PLAYGROUND_ROUTE;
export const PG_V2_E: P = R[R.length - 1];
const DIR: P = (() => {
  const a = R[R.length - 3];
  const l = Math.hypot(PG_V2_E[0] - a[0], PG_V2_E[1] - a[1]);
  return [(PG_V2_E[0] - a[0]) / l, (PG_V2_E[1] - a[1]) / l];
})();
/** How far the line runs on past E, beneath the station. */
export const PG_V2_EXT = 62;
const X: P = [PG_V2_E[0] + PG_V2_EXT * DIR[0], PG_V2_E[1] + PG_V2_EXT * DIR[1]];
const PTS: P[] = [...R, X];

const mid = (a: P, b: P): P => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const f = (n: number) => +n.toFixed(2);
const pt = (p: P) => `${f(p[0])} ${f(p[1])}`;

/** The path as pieces: [from, control | null (straight), to]. */
const PIECES: [P, P | null, P][] = (() => {
  const out: [P, P | null, P][] = [];
  const n = PTS.length;
  out.push([PTS[0], null, mid(PTS[0], PTS[1])]);
  for (let i = 1; i < n - 1; i++) out.push([mid(PTS[i - 1], PTS[i]), PTS[i], mid(PTS[i], PTS[i + 1])]);
  out.push([mid(PTS[n - 2], PTS[n - 1]), null, PTS[n - 1]]);
  return out;
})();

const toD = (pieces: [P, P | null, P][], lead?: P, tail?: P) =>
  (lead ? `M${pt(lead)}L${pt(pieces[0][0])}` : `M${pt(pieces[0][0])}`) +
  pieces.map(([, c, b]) => (c ? `Q${pt(c)} ${pt(b)}` : `L${pt(b)}`)).join("") +
  (tail ? `L${pt(tail)}` : "");

function sample([a, c, b]: [P, P | null, P], t: number): P {
  if (!c) return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const s = 1 - t;
  return [s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]];
}

/** Arc length along the path to its point nearest `q`, and the total. */
const { arcE, length } = (() => {
  let acc = 0;
  let prev = PIECES[0][0];
  let best = { d: Infinity, arc: 0 };
  for (const piece of PIECES) {
    for (let k = 1; k <= 24; k++) {
      const p = sample(piece, k / 24);
      acc += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      prev = p;
      const d = Math.hypot(p[0] - PG_V2_E[0], p[1] - PG_V2_E[1]);
      if (d < best.d) best = { d, arc: acc };
    }
  }
  return { arcE: best.arc, length: acc };
})();

/** Route polyline length (px), the unit of the charge position `u`. */
const ROUTE_LENGTH = R.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - R[i][0], p[1] - R[i][1]), 0);

/** The charge masks run this far past both ends, so their soft front never dims the line's own ends. */
const PAD = 20;
const START_DIR: P = (() => {
  const l = Math.hypot(R[1][0] - R[0][0], R[1][1] - R[0][1]);
  return [(R[1][0] - R[0][0]) / l, (R[1][1] - R[0][1]) / l];
})();

export const PG_V2_LINE = {
  /** The visible line. */
  d: toD(PIECES),
  /** The same path with PAD before and after, for the charge masks. */
  maskD: toD(PIECES, [R[0][0] - PAD * START_DIR[0], R[0][1] - PAD * START_DIR[1]], [X[0] + PAD * DIR[0], X[1] + PAD * DIR[1]]),
  length,
  arcE,
  /** Dash period: longer than the mask path, so one dash/gap covers it. */
  period: Math.ceil(length + 2 * PAD + 100),
  /** The region every layer of the line (spill included) stays inside. */
  box: { x: 860, y: 480, w: 330, h: 120 },
} as const;

/**
 * The masks' stroke-dashoffset for charge position u (px along the route;
 * the route's own end E is at ROUTE_LENGTH): powered from the start up to the
 * front, unpowered after it. Past E the whole run beneath the station is
 * powered at once (the windows read a full line back as anything from E to
 * `full`, so a front there would leave part of it unpowered on leave). Both
 * masks use the same offset (boost dash "P P", dim dash "0 P P 0").
 */
export function pgV2ChargeOffset(uPos: number) {
  const endA = PAD + PG_V2_LINE.length + PAD;
  const a = uPos >= ROUTE_LENGTH ? endA : Math.min(endA, Math.max(0, PAD + (uPos / ROUTE_LENGTH) * arcE));
  return +(PG_V2_LINE.period - a).toFixed(2);
}
