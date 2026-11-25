import type { CSSProperties } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { CHARGE_EDGE, CHARGE_HALF, CHARGE_LEAD, CHARGE_LINES, type ChargeSegment } from "./scene-fx";
import { EngineeringLift, EngineeringLinePart, isEngineeringLineEnd, type LineStroke } from "./EngineeringLift";
import { LAB_LAYERED } from "./scene-25d";
import { CONNECTION_LAYERS } from "./scene-25d-data";
import { PG_V2_LINE, pgV2ChargeOffset } from "./playground-line-v2";
import { V2_OBJECTS } from "./scene-v2-data";

/**
 * M1.3E.1 / M1.3E.2: a station's connection, unpowered at rest and charged
 * along its complete route on hover.
 *
 * The route (traced from the plate) has parts that bend (across the central
 * platform, then down over its rim and across the floor). Each part gets a
 * frame along its chord holding two windows, both moved along it:
 *
 *   dim    the unpowered overlay, ahead of the charge front
 *   boost  a powered glow (the route's masks, this part only), behind it
 *
 * Moving a window along its frame while moving its content back by the same
 * amount keeps the overlay fixed in the scene and moves only the window's
 * edge: the front. One position along the route, `u` (reference px from the
 * route's start), sets every window, so the parts charge in sequence. The
 * hover controller (EnergySurge) animates it behind the spark and drains it
 * back toward the A on leave. Transforms only; at rest everything sits at
 * s = 0 (all unpowered, no glow).
 */

const pct = (n: number) => `${+n.toFixed(4)}%`;
const deg = (a: readonly [number, number], b: readonly [number, number]) => (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;

/** Below this the whole route is unpowered; above U_FULL it is all powered. */
export const U_REST = -20;
export const uFull = (id: ZoneId) => (CHARGE_LINES[id]?.length ?? 0) + 20;

function segGeometry(seg: ChargeSegment) {
  const length = Math.hypot(seg.to[0] - seg.from[0], seg.to[1] - seg.from[1]);
  /** Window offset at which the whole part is powered. */
  const span = length + 2 * CHARGE_LEAD;
  /** Window length (also covers the part while the offset runs below 0). */
  const windowLength = span + 40;
  return { length, span, windowLength, angle: deg(seg.from, seg.to) };
}

/** Window offset of a part for route position u (front just behind u). */
export function segmentOffset(seg: ChargeSegment, uPos: number, isLast: boolean, full: number) {
  const g = segGeometry(seg);
  if (isLast && uPos >= full) return g.span;
  return Math.min(g.span, Math.max(0, uPos - seg.s0 + CHARGE_LEAD - CHARGE_EDGE / 2));
}

/** Window / content transforms of one part at offset s. */
export function chargeTransforms(seg: ChargeSegment, kind: "dim" | "boost", s: number) {
  const g = segGeometry(seg);
  // The window's left edge, in the frame (reference px along the chord).
  const left = kind === "dim" ? -CHARGE_LEAD : -CHARGE_LEAD + CHARGE_EDGE - g.windowLength;
  return {
    window: `translateX(${pct((s / g.windowLength) * 100)})`,
    content: `translate(${pct((-(left + s) / SCENE.width) * 100)}, ${pct((CHARGE_HALF / SCENE.height) * 100)}) rotate(${+(-g.angle).toFixed(3)}deg) translate(${pct((-seg.from[0] / SCENE.width) * 100)}, ${pct((-seg.from[1] / SCENE.height) * 100)})`,
  };
}

/** Current route position of a station's charge, read back from its dim windows. */
export function currentChargeU(id: ZoneId): number {
  const line = CHARGE_LINES[id];
  if (!line) return U_REST;
  let best = U_REST;
  line.segments.forEach((seg, k) => {
    const win = document.querySelector<HTMLElement>(`[data-charge-window="${id}"][data-charge-seg="${k}"][data-charge-kind="dim"]`);
    if (!win || !win.offsetWidth) return;
    const t = getComputedStyle(win).transform;
    const m = t && t !== "none" ? new DOMMatrixReadOnly(t) : null;
    const g = segGeometry(seg);
    const s = m ? (m.m41 / win.offsetWidth) * g.windowLength : 0;
    if (s >= g.span - 0.01) best = Math.max(best, k === line.segments.length - 1 ? uFull(id) : seg.s1);
    else if (s > 0.01) best = Math.max(best, seg.s0 + s - CHARGE_LEAD + CHARGE_EDGE / 2);
  });
  return best;
}

/**
 * Keyframes for every charge window of a station as `uAt(p)` runs over
 * p = 0..1 (sampled: the parts switch on in sequence, which keyframe offsets
 * alone can't express). Use with linear keyframes; easing goes on the timing.
 */
export function chargeAnimations(id: ZoneId, uAt: (p: number) => number, samples = 40) {
  const line = CHARGE_LINES[id];
  const out: { el: Element; frames: Keyframe[] }[] = [];
  if (!line) return out;
  const full = uFull(id);
  for (const win of document.querySelectorAll<HTMLElement>(`[data-charge-window="${id}"]`)) {
    const k = Number(win.dataset.chargeSeg);
    const kind = win.dataset.chargeKind as "dim" | "boost";
    const seg = line.segments[k];
    const content = win.querySelector<HTMLElement>("[data-charge-content]");
    if (!seg || !content) continue;
    const at = (p: number) => chargeTransforms(seg, kind, segmentOffset(seg, uAt(p), k === line.segments.length - 1, full));
    const ps = Array.from({ length: samples + 1 }, (_, i) => i / samples);
    out.push({ el: win, frames: ps.map((p) => ({ transform: at(p).window, offset: p })) });
    out.push({ el: content, frames: ps.map((p) => ({ transform: at(p).content, offset: p })) });
  }
  // M1.4E.3 (/lab-v2): the continuous Playground line's charge masks, from the same u.
  if (id === "playground") {
    const ps = Array.from({ length: samples + 1 }, (_, i) => i / samples);
    for (const el of document.querySelectorAll(`[data-charge-path="${id}"]`)) {
      out.push({ el, frames: ps.map((p) => ({ strokeDashoffset: `${pgV2ChargeOffset(uAt(p))}px`, offset: p })) });
    }
  }
  return out;
}

const fullFrame = (mask: string): CSSProperties => ({
  maskImage: `url(${mask})`,
  WebkitMaskImage: `url(${mask})`,
  maskSize: "100% 100%",
  WebkitMaskSize: "100% 100%",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
});

/** Powered glow colours (the M1.3D trail's charged look). */
const BOOST = { glow: "rgb(255 176 90 / 0.34)", core: "rgb(255 232 196 / 0.5)" };
/** M1.3I: width of the powered core drawn as a vector stroke (reference px). */
const CORE_STROKE = 1.8;

/** M1.4J.1 (/lab-v2): the same two strokes, for Engineering's line end. */
export const BOOST_STROKES: readonly LineStroke[] = [
  { color: "rgb(255 176 90)", alpha: 0.34, width: 7 },
  { color: "rgb(255 232 196)", alpha: 0.5, width: CORE_STROKE },
];

const boxStyle = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });

/**
 * M1.3I (LAB_LAYERED): the connection as its own floor-anchored layers. The
 * environment under it has no line (ENVIRONMENT_CORRECTIONS, in the plate
 * layer); ahead of the front the window shows the faint unpowered trace,
 * behind it the painted lit line, the restrained glow and a sharp vector
 * core along the route. Both rasters are solved over the corrected
 * environment, so at rest and fully powered the scene is the approved one.
 */
function LayeredContent({ id, k, kind, seg, rect }: { id: ZoneId; k: number; kind: "dim" | "boost"; seg: ChargeSegment; rect?: SceneRect }) {
  const { box, frame = box, parts } = CONNECTION_LAYERS[id];
  const part = parts[k];
  if (kind === "dim")
    return (
      <div className="absolute" style={boxStyle(frame)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- floor-anchored layer at the line's box */}
        <img src={part.trace} alt="" draggable={false} data-gate="" className="absolute inset-0 h-full w-full max-w-none select-none" />
      </div>
    );
  return (
    <>
      <div className="absolute" style={boxStyle(frame)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- floor-anchored layer at the line's box */}
        <img src={part.lit} alt="" draggable={false} data-gate="" className="absolute inset-0 h-full w-full max-w-none select-none" />
      </div>
      <div className="absolute" style={rect ? boxStyle(rect) : { inset: 0 }}>
        <div className="absolute inset-0" style={{ ...fullFrame(seg.glow), background: BOOST.glow }} />
      </div>
      <svg className="absolute overflow-visible" style={boxStyle(box)} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true" data-charge-core={id}>
        <path d={part.path} fill="none" stroke={BOOST.core} strokeWidth={CORE_STROKE} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </>
  );
}

/** M1.4D (/lab-v2): the line's look at rest, drawn as strokes (no plate pixels). */
const V2_DIM = { glow: "rgb(255 168 78 / 0.22)", core: "rgb(255 205 150 / 0.55)" };

/**
 * M1.4D (/lab-v2 only): the same accurate M1.3I routes (CONNECTION_LAYERS)
 * and the same charge windows, but the content is vector strokes, because
 * the v2 environment has no line painted on its floor and the M1.3I rasters
 * carry the approved plate's floor.
 */
/**
 * M1.4E.1 (/lab-v2, Playground only): a power line that belongs to the floor.
 * At rest a thin, sharp warm-amber core in a restrained glow; charged, a hot
 * core, a warm glow and a little light spilled on the floor around it (a
 * softly blurred, low-opacity stroke, a few px wide: local, no broad bloom).
 */
export const PG_LINE = {
  dim: { spill: null, glow: { c: "rgb(255 150 62 / 0.3)", w: 3.6 }, core: { c: "rgb(255 186 104 / 0.85)", w: 1.15 } },
  boost: { spill: { c: "rgb(255 150 60 / 0.22)", w: 11, blur: 2.6 }, glow: { c: "rgb(255 170 78 / 0.55)", w: 4.2 }, core: { c: "rgb(255 238 204 / 1)", w: 1.5 } },
} as const;

function VectorContent({ id, k, kind }: { id: ZoneId; k: number; kind: "dim" | "boost" }) {
  const { box, parts } = CONNECTION_LAYERS[id];
  const d = (parts[k] ?? parts[0]).path;
  // M1.4E.3: Playground is drawn as one continuous path (PlaygroundLineV2);
  // its windows stay, empty, as the charge position's drivers.
  if (id === "playground") return null;
  const c = kind === "dim" ? V2_DIM : BOOST;
  // M1.4J.1: its end hands over to the run beneath the raised platform.
  if (kind === "boost" && isEngineeringLineEnd(id, k))
    return (
      <svg className="absolute overflow-visible" style={boxStyle(box)} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true" data-v2-line={id}>
        <EngineeringLinePart strokes={BOOST_STROKES} />
      </svg>
    );
  return (
    <svg className="absolute overflow-visible" style={boxStyle(box)} viewBox={`0 0 ${box.w} ${box.h}`} aria-hidden="true" data-v2-line={id}>
      <path d={d} fill="none" stroke={c.glow} strokeWidth={kind === "dim" ? 4.5 : 7} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={c.core} strokeWidth={kind === "dim" ? 1.4 : CORE_STROKE} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * M1.4E.3 (/lab-v2): Playground's connection as one continuous path
 * (playground-line-v2.ts), from the A's ring to beneath the station: no part
 * boundaries, so no seam or corner where parts used to meet.
 *
 *   charge   two masks along the path, one dash each: powered (boost) from the
 *            start to the front, unpowered (dim) after it. Their dash offset
 *            is animated from the same charge position u as the route's
 *            windows (chargeAnimations), so the spark, charge and drain
 *            timings are unchanged. The masks are softly blurred, giving a
 *            soft front like the windows' edge
 *   station  the line runs on beneath the station; the station's own
 *            silhouette (its image's alpha), moved exactly as the lift moves
 *            it (--lp, the lift's own progress), hides what is under it. The
 *            line itself never moves
 */
const PG_STATION = V2_OBJECTS.find((o) => o.id === "playground")!;
const PG_LIFT_STYLE = {
  transform: "translateY(calc(-18px * var(--lp))) scale(calc(1 + 0.01 * var(--lp)))",
  transformOrigin: `${PG_STATION.base.cx}px ${PG_STATION.base.bottom}px`,
  transformBox: "view-box",
} as const;
/** Softness of the charge front (the windows' edge is 7 px). */
const PG_FRONT_BLUR = 2.2;

function PlaygroundLineV2() {
  const b = PG_V2_LINE.box;
  const P = PG_V2_LINE.period;
  const region = { x: b.x - 20, y: b.y - 20, width: b.w + 40, height: b.h + 40 };
  const strokes = (kind: "dim" | "boost") => {
    const s = PG_LINE[kind];
    const path = (c: string, w: number, filter?: string) => (
      <path d={PG_V2_LINE.d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" filter={filter} />
    );
    return (
      <>
        {s.spill ? path(s.spill.c, s.spill.w, "url(#pgv-spill)") : null}
        {path(s.glow.c, s.glow.w)}
        {path(s.core.c, s.core.w)}
      </>
    );
  };
  const chargeMask = (kind: "dim" | "boost") => (
    <mask id={`pgv-${kind}`} maskUnits="userSpaceOnUse" {...region}>
      <path
        d={PG_V2_LINE.maskD}
        fill="none"
        stroke="white"
        strokeWidth={44}
        strokeLinecap="butt"
        strokeDasharray={kind === "boost" ? `${P} ${P}` : `0 ${P} ${P} 0`}
        strokeDashoffset={P}
        filter="url(#pgv-front)"
        data-charge-path="playground"
        data-charge-kind={kind}
      />
    </mask>
  );
  return (
    <div aria-hidden="true" data-zone="playground" data-depth="playground" className="lab-depth pointer-events-none absolute inset-0" data-v2-line="playground">
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${SCENE.width} ${SCENE.height}`}>
        <defs>
          <filter id="pgv-spill" filterUnits="userSpaceOnUse" {...region}>
            <feGaussianBlur stdDeviation={PG_LINE.boost.spill.blur} />
          </filter>
          <filter id="pgv-front" filterUnits="userSpaceOnUse" {...region}>
            <feGaussianBlur stdDeviation={PG_FRONT_BLUR} />
          </filter>
          <filter id="pgv-black" colorInterpolationFilters="sRGB">
            <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" />
          </filter>
          <mask id="pgv-station" maskUnits="userSpaceOnUse" {...region}>
            <rect {...region} fill="white" />
            <image
              href={PG_STATION.src}
              x={PG_STATION.tx}
              y={PG_STATION.ty}
              width={SCENE.width * PG_STATION.scale}
              height={SCENE.height * PG_STATION.scale}
              preserveAspectRatio="none"
              filter="url(#pgv-black)"
              style={PG_LIFT_STYLE}
            />
          </mask>
          {chargeMask("dim")}
          {chargeMask("boost")}
        </defs>
        <g mask="url(#pgv-station)">
          <g mask="url(#pgv-dim)" data-v2-line-kind="dim">
            {strokes("dim")}
          </g>
          <g mask="url(#pgv-boost)" data-v2-line-kind="boost" data-charge-power="playground">
            {strokes("boost")}
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Selected, or reduced motion while hovered: the continuous line fully powered (ACTIVATION_CSS). */
export const pgV2PoweredCss = (scope: string) =>
  `${scope} [data-charge-path="playground"]{stroke-dashoffset:${pgV2ChargeOffset(Infinity)}px!important}`;

export function ChargeLines({ variant = "plate" }: { variant?: "plate" | "v2" }) {
  return (
    <>
      {variant === "v2" ? <PlaygroundLineV2 /> : null}
      {(Object.keys(CHARGE_LINES) as ZoneId[]).map((id) => {
        const line = CHARGE_LINES[id]!;
        const parts = line.segments.map((seg, k) => {
          const g = segGeometry(seg);
          return (
            <div
              key={`${id}-${k}`}
              aria-hidden="true"
              data-zone={id}
              className="lab-charge-dim pointer-events-none absolute h-0 w-0"
              style={{ left: u(seg.from[0]), top: u(seg.from[1]), transformOrigin: "0 0", transform: `rotate(${+g.angle.toFixed(3)}deg)` }}
            >
              {(["dim", "boost"] as const).map((kind) => {
                const rest = chargeTransforms(seg, kind, 0);
                const edge =
                  kind === "dim"
                    ? `linear-gradient(90deg, transparent 0, #000 ${u(CHARGE_EDGE)})`
                    : `linear-gradient(90deg, #000 calc(100% - ${u(CHARGE_EDGE)}), transparent)`;
                return (
                  <div
                    key={kind}
                    data-charge-window={id}
                    data-charge-seg={k}
                    data-charge-kind={kind}
                    className={`${kind === "dim" ? "lab-charge-unpowered" : "lab-charge-powered"} absolute overflow-hidden`}
                    style={{
                      left: u(kind === "dim" ? -CHARGE_LEAD : -CHARGE_LEAD + CHARGE_EDGE - g.windowLength),
                      top: u(-CHARGE_HALF),
                      width: u(g.windowLength),
                      height: u(2 * CHARGE_HALF),
                      transform: rest.window,
                      maskImage: edge,
                      WebkitMaskImage: edge,
                    }}
                  >
                    <div data-charge-content className="absolute top-0 left-0" style={{ width: u(SCENE.width), height: u(SCENE.height), transformOrigin: "0 0", transform: rest.content }}>
                      {variant === "v2" ? (
                        <VectorContent id={id} k={k} kind={kind} />
                      ) : LAB_LAYERED ? (
                        <LayeredContent id={id} k={k} kind={kind} seg={seg} rect={line.rect} />
                      ) : (
                        // Full-frame images, or (M1.3G) images cropped to the line's box, placed there.
                        <div className="absolute" style={line.rect ? boxStyle(line.rect) : { inset: 0 }}>
                          {kind === "dim" ? (
                            // eslint-disable-next-line @next/next/no-img-element -- overlay at the plate's geometry
                            <img src={seg.dim} alt="" draggable={false} data-gate="" className="absolute inset-0 h-full w-full max-w-none select-none" />
                          ) : (
                            <>
                              <div className="absolute inset-0" style={{ ...fullFrame(seg.glow), background: BOOST.glow }} />
                              <div className="absolute inset-0" style={{ ...fullFrame(seg.core), background: BOOST.core }} />
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        });
        return variant === "v2" && id === "engineering" ? <EngineeringLift key={id}>{parts}</EngineeringLift> : parts;
      })}
    </>
  );
}
