import type { ZoneId } from "@/data/zones";
import type { SceneRect } from "@/lib/scene";
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

/**
 * M1.3A platform lights: element boxes around each station's light strips.
 * Each must contain that station's PLATFORM_BANDS (scripts/make-scene-masks.py)
 * plus their ~15 px bloom, and no other station's bands.
 */
export const PLATFORM_LIGHTS: Record<ZoneId, SceneRect> = {
  educational: { x: 660, y: 432, w: 356, h: 86 },
  engineering: { x: 336, y: 510, w: 154, h: 50 },
  playground: { x: 1116, y: 503, w: 280, h: 58 },
  creative: { x: 156, y: 708, w: 380, h: 92 },
  experience: { x: 1134, y: 684, w: 534, h: 122 },
};

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

function quadAt(p0: Pt, p1: Pt, p2: Pt, t: number): Pt {
  const m = 1 - t;
  return [m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0], m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1]];
}

/**
 * Energy tracks. All pulses leave the core together and cross their line
 * during the first `window`% of the cycle, then rest beyond the station end
 * (where the mask is empty) until the next cycle, so the loop never visibly
 * jumps. `lead` keeps the blob fully off the line at both ends.
 */
export function energyTracks(lead: number, window = 62): LightTrack[] {
  return CONNECTIONS.map((c) => {
    const samples = 8;
    const pts: Pt[] = Array.from({ length: samples + 1 }, (_, i) => quadAt(c.p0, c.p1, c.p2, i / samples));
    const start = pts[0];
    const end = pts[samples];
    const d0 = [pts[1][0] - start[0], pts[1][1] - start[1]];
    const d1 = [end[0] - pts[samples - 1][0], end[1] - pts[samples - 1][1]];
    const n0 = Math.hypot(d0[0], d0[1]);
    const n1 = Math.hypot(d1[0], d1[1]);
    const before: Pt = [start[0] - (d0[0] / n0) * lead, start[1] - (d0[1] / n0) * lead];
    const after: Pt = [end[0] + (d1[0] / n1) * lead, end[1] + (d1[1] / n1) * lead];
    const all = [before, ...pts, after];
    // Constant speed along the track inside the travel window.
    const seg = all.slice(1).map((p, i) => Math.hypot(p[0] - all[i][0], p[1] - all[i][1]));
    const total = seg.reduce((a, b) => a + b, 0);
    let acc = 0;
    const waypoints: Waypoint[] = all.map((p, i) => {
      if (i > 0) acc += seg[i - 1];
      const next = all[Math.min(i + 1, all.length - 1)];
      const prev = all[Math.max(i - 1, 0)];
      return { at: (acc / total) * window, x: p[0], y: p[1], rot: deg(next[0] - prev[0], next[1] - prev[1]) };
    });
    // Rest off-line until the cycle restarts.
    waypoints.push({ ...waypoints[waypoints.length - 1], at: 100 });
    return { key: c.id, waypoints };
  });
}

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
