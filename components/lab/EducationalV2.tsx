import type { CSSProperties } from "react";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { EDU_LIGHT_BOX, EDU_LIGHT_GRID, EDU_LIGHT_STEPS, EDU_LIGHT_TAIL, EDU_RING_LENGTH, EDU_RING_PATH, EDU_WAVE_BOX, EDU_WAVE_STEPS } from "./educational-v2";
import { EducationalLift } from "./EducationalLift";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { partFrame, PowerPart, powerCss } from "./PlatformPower";
import { SceneImage, SceneImageInSvg } from "./SceneImage";
import { cycleCss } from "./station-cycle";
import { frameMask } from "./station-lift";

/**
 * M1.4H.2 (/lab-v2 only): Educational's activation, on M1.4F.1's recovered
 * station. Every layer is a partition or a copy of the current artwork
 * (scripts/m14h2-educational.py); powered, they recompose it.
 *
 *   rest      strips unpowered, the globe's blue and the amber ring dimmed (the
 *             island, church, mountains and stone untouched), the floor ring
 *             and reflections faint
 *   arrival   (+0) the strips light along their own paths (the existing power
 *             fronts, PLATFORM_POWER), the floor light following
 *   pulse     (+70) the cyan pool at the globe's foot pulses once
 *   globe     (+120) a wave climbs the glass bubbles: over each sphere's own
 *             surface, front and back (the sprite frames hold its per-pixel
 *             timing), uncovering the hologram with a brighter crest
 *   orbit     (+200) a narrow light runs once round the painted ring, out of the
 *             pool, up over the front of the island, behind it (hidden there)
 *             and out again at the left; the ring is lit behind it
 *   stable    (+800) the approved artwork itself (M1.4F.1's files); every ~8 s a
 *             very faint light on the ring
 *
 * All state is CSS (EDU_CSS): registered numbers transition from the energy's
 * arrival (--arrive-now, ACTIVATION_CSS), as Engineering's (M1.4H.1): leaving
 * before the energy arrives cancels natively, quick switching leaves nothing
 * lit, a selection or deep link is powered at once with no replay. Leaving: the
 * crest and the light stop, the wave runs back to the foot, the ring and the
 * strips drain. Reduced motion: a 150 ms cross-fade; nothing travels.
 */

const M14H2 = "/scene/v2/m14h2";
const M14F1 = "/scene/v2/m14f1";
const ID = "educational";
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;

/** Standby: what is left of the globe's blue, of the ring, and of the floor's ring and warm reflections. */
const GLOBE_STANDBY = 0.42;
const ORBIT_STANDBY = 0.5;
const FLOOR_STANDBY = 0.2;

/** M1.4J.2: raised, the corner strips' spill on the floor is this much weaker. */
const SPILL_SOFTEN = 0.25;
/** M1.4J.2: the station's light ends here; below it the light layer holds the corner strips' light only (nothing lies in y 428-480). */
const LIGHT_SPLIT = 455;

/** Timing after the energy's arrival (ms). */
export const EDU_TIMING = {
  pulseDelay: 70,
  pulseMs: 170,
  globeDelay: 120,
  globeMs: 380,
  orbitDelay: 200,
  orbitMs: 550,
  stableDelay: 800,
  shimmerDelay: 2600,
  shimmerPeriod: 8000,
} as const;
const T = EDU_TIMING;

/** The travelling light runs a little past the ring's end, so its tail leaves the ring. */
const RUN = EDU_RING_LENGTH + EDU_LIGHT_TAIL;

/**
 * The floor's warm light follows the strips' fronts, from the middle outwards
 * (the main strip 0-167 ms, the corner strips 196-309 ms).
 */
const FLOOR_PARTS = [
  { box: { x: 652, y: 470, w: 186, h: 112 }, angle: -90, on: { delay: 0, dur: 310 }, off: { delay: 0, dur: 260 } },
  { box: { x: 838, y: 470, w: 190, h: 112 }, angle: 90, on: { delay: 0, dur: 310 }, off: { delay: 0, dur: 260 } },
];

/**
 * M1.4J.2: the corner strips' light (educational-strip-floor) is both the bright
 * edge of the strip, just outside the stone's outline, and its spill on the
 * floor. The edge belongs to the station and rises; the spill stays. The same
 * image is drawn through two complementary masks (a soft line about 4.5 px
 * outside the stone's foot, through (x, y) at `angle`), added, so together they
 * are the image itself. One line for each of FLOOR_PARTS. Between the corners
 * the image holds two short streaks beside the connection: floor.
 */
const STRIP_LINES = [
  { x: 699, y: 495, angle: 189.1 },
  { x: 980, y: 494.3, angle: 169.8 },
];
type StripShare = "edge" | "spill" | "streak";
const SHARES: readonly StripShare[] = ["streak", "spill", "edge"];
/** Where each share has anything to draw, for each of FLOOR_PARTS. */
const CORNERS: readonly SceneRect[] = [
  { x: 664, y: 477, w: 62, h: 37 },
  { x: 950, y: 477, w: 62, h: 37 },
];
const STREAKS: readonly SceneRect[] = [
  { x: 726, y: 477, w: 112, h: 37 },
  { x: 838, y: 477, w: 112, h: 37 },
];
const shareBox = (share: StripShare, k: number): SceneRect => (share === "streak" ? STREAKS : CORNERS)[k];
function shareMask(share: StripShare, k: number): CSSProperties {
  if (share === "streak") return footFade(k);
  const l = STRIP_LINES[k];
  const rad = (l.angle * Math.PI) / 180;
  // Along the gradient line, from the frame's middle (its 50 %).
  const s = (l.x - SCENE.width / 2) * Math.sin(rad) - (l.y - SCENE.height / 2) * Math.cos(rad);
  const at = (d: number) => `calc(50% + ${u(+(s + d).toFixed(2))})`;
  const [near, far] = share === "edge" ? ["#000", "transparent"] : ["transparent", "#000"];
  return frameMask(`linear-gradient(${l.angle}deg, ${near} ${at(-2)}, ${far} ${at(2)})`);
}

/**
 * M1.4J.2: the floor's light (M1.4G) was recovered up to the resting stone, so
 * raised it would end in that outline: specks along the two corners, and the
 * streaks beside the connection with square tops. There it gives way to the
 * platform as that leaves the floor. At rest the mask is opaque.
 */
const fade = (x: number, y: number, rx: number, ry: number, solid: number) =>
  `radial-gradient(${u(rx)} ${u(ry)} at ${u(x)} ${u(y)}, rgb(0 0 0 / calc(1 - var(--dl))) ${solid}%, #000)`;
const footFade = (k: number): CSSProperties => frameMask(k === 0 ? fade(700, 491, 22, 6.5, 72) : fade(977, 491, 21, 6.5, 72), fade(838.6, 494, 30, 20, 35));

const box = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });
/**
 * Every layer that moves is clipped to the station (its own pixels, the floor
 * excluded), so a frame repaints that box, not the whole scene beneath it. On
 * the blended elements themselves: a clip-path on their parent would isolate
 * them, and they would no longer add to the room.
 */
const clipTo = (r: SceneRect, of: SceneRect = { x: 0, y: 0, w: SCENE.width, h: SCENE.height }): CSSProperties => ({
  clipPath: `inset(${u(r.y - of.y)} ${u(of.x + of.w - r.x - r.w)} ${u(of.y + of.h - r.y - r.h)} ${u(r.x - of.x)})`,
});
const CLIP = clipTo({ x: 648, y: 248, w: 376, h: 264 });
const RING_CLIP = clipTo({ x: 656, y: 296, w: 352, h: 150 });
const FOOT_CLIP = clipTo({ x: 656, y: 386, w: 352, h: 58 });

const prop = (name: string) => `@property ${name}{syntax:"<number>";inherits:true;initial-value:0}`;
const level = (a: string | number) => `linear-gradient(rgb(0 0 0 / ${a}), rgb(0 0 0 / ${a}))`;

const EDU_CSS =
  prop("--gr") +
  powerCss(ID) +
  // The sequence's numbers, on the station's root and on its floor light, and the strips' pulse (M1.4I.1D:
  // station-cycle.ts).
  cycleCss({
    id: ID,
    cls: "edu",
    key: "g",
    numbers: [
      { v: "--gp", on: `${T.pulseMs}ms linear calc(var(--arrive-now) + ${T.pulseDelay}ms)`, off: "0ms linear 120ms" },
      { v: "--gs", on: `${T.globeMs}ms cubic-bezier(0.35,0.2,0.5,0.95) calc(var(--arrive-now) + ${T.globeDelay}ms)`, off: "280ms ease-in-out 100ms" },
      { v: "--go", on: `${T.orbitMs}ms cubic-bezier(0.35,0.15,0.45,0.95) calc(var(--arrive-now) + ${T.orbitDelay}ms)`, off: "280ms ease-in-out 100ms" },
    ],
    doneMs: T.stableDelay,
    pulse: 0.9,
  }) +
  `.edu-seq{--gr:0}${ON} .edu-seq{--gr:1}` +
  // What only exists while the sequence runs forward: nothing before the energy is there (a quick return can find
  // the numbers still running back), gone at once on leaving.
  `.edu-gate{opacity:0;transition:opacity 0s}${ON} .edu-gate{opacity:1;transition:opacity 0ms linear var(--arrive-now)}` +
  `.edu-pulse-base{opacity:calc(min(1, var(--gp) * 3) * min(1, (1 - var(--gp)) * 1.6) * 0.85)}` +
  `.edu-crest{opacity:calc(min(1, var(--gs) * 1000) * min(1, (1 - var(--gs)) * 1000))}` +
  `.edu-light{opacity:calc(min(1, var(--go) * 1000) * min(1, (1 - var(--go)) * 1000))}` +
  // The stable state is the approved artwork itself; leaving swaps back to the layers at once.
  `[data-edu-swap="stable"]{visibility:hidden;transition:visibility 0s}[data-edu-swap="anim"]{visibility:visible;transition:visibility 0s}` +
  `${ON} [data-edu-swap="stable"]{visibility:visible;transition:visibility 0s linear calc(var(--arrive-now) + ${T.stableDelay}ms)}` +
  `${ON} [data-edu-swap="anim"]{visibility:hidden;transition:visibility 0s linear calc(var(--arrive-now) + ${T.stableDelay}ms)}` +
  // The floor: the strips' share over its standby; the globe's cyan reflection with the globe.
  `.edu-floor{opacity:calc((1 - var(--edu-standby, 0)) * (1 - var(--edu-soften, 0) * var(--dl)))}` +
  FLOOR_PARTS.map(
    (p, k) =>
      `.edu-floor[data-floor-part="${k}"]{--pw:0;transition:--pw ${p.off.dur}ms linear ${p.off.delay}ms}` +
      `${ON} .edu-floor[data-floor-part="${k}"]{--pw:1;transition:--pw ${p.on.dur}ms linear calc(var(--arrive-now) + ${p.on.delay}ms)}`,
  ).join("") +
  `.edu-floor-cyan{opacity:calc(${GLOBE_STANDBY} + ${1 - GLOBE_STANDBY} * var(--gs))}` +
  `.edu-orbit-rest{opacity:calc(${ORBIT_STANDBY} + ${1 - ORBIT_STANDBY} * var(--go))}` +
  // Stable: a very faint light round the ring every few seconds.
  `.edu-shimmer{opacity:0;transition:opacity 200ms linear}` +
  `${ON} .edu-shimmer{opacity:0.3;transition:opacity 400ms linear calc(var(--arrive-now) + ${T.shimmerDelay - 400}ms)}` +
  `@keyframes edu-shimmer{0%{stroke-dashoffset:110px}38%,100%{stroke-dashoffset:${-(EDU_RING_LENGTH + 10)}px}}` +
  `${ON} .edu-shimmer-line{animation:edu-shimmer ${T.shimmerPeriod}ms linear calc(var(--arrive-now) + ${T.shimmerDelay}ms) infinite backwards}` +
  // Reduced motion: the powered appearance, cross-faded whole; nothing travels.
  `@media (prefers-reduced-motion: reduce){` +
  `.edu-seq,${ON} .edu-seq{transition:--gr 150ms ease}` +
  `[data-edu-wave]{mask-image:none!important;-webkit-mask-image:none!important;opacity:calc(${GLOBE_STANDBY} + ${1 - GLOBE_STANDBY} * var(--gr))}` +
  `.edu-orbit-lit{opacity:calc(${1 - ORBIT_STANDBY} * var(--gr))!important}` +
  `.edu-orbit-rest{opacity:calc(${ORBIT_STANDBY} + ${1 - ORBIT_STANDBY} * var(--gr))}` +
  `.edu-floor-cyan{opacity:calc(${GLOBE_STANDBY} + ${1 - GLOBE_STANDBY} * var(--gr))}` +
  `${ON} [data-edu-swap]{transition:visibility 0s linear 150ms}` +
  `.edu-gate,.edu-pulse,.edu-shimmer{display:none}` +
  `.edu-floor{mask-image:none!important;-webkit-mask-image:none!important;opacity:0!important;transition:opacity 150ms ease!important}` +
  `${ON} .edu-floor{opacity:calc(1 - var(--edu-standby, 0))!important}}`;

function Full({ src, name, add, swap, className = "", style }: { src: string; name: string; add?: boolean; swap?: "anim" | "stable"; className?: string; style?: CSSProperties }) {
  return (
    <SceneImage
      src={src}
      data-edu={name}
      data-edu-swap={swap}
      className={`pointer-events-none absolute inset-0 h-full w-full max-w-none select-none ${className}`}
      style={add || style ? { mixBlendMode: add ? "plus-lighter" : undefined, ...style } : undefined}
    />
  );
}

/** A full-frame image placed in a box (the box clips it). */
function Frame({ src, box, style }: { src: string; box: SceneRect; style?: CSSProperties }) {
  return <SceneImage src={src} className="absolute max-w-none select-none" style={{ ...partFrame(box), ...style }} />;
}

/**
 * A mask from a sprite of the globe wave: frame k of EDU_WAVE_STEPS + 1 lies over the
 * globe's box (the other frames lie beside it, where the masked layers are
 * empty), k following --gs. With `floor`, at least that much everywhere.
 */
function waveMask(sprite: string, floor?: number): CSSProperties {
  const b = EDU_WAVE_BOX;
  const images = [`url(${sprite})`];
  const sizes = [`${u(b.w * (EDU_WAVE_STEPS + 1))} ${u(b.h)}`];
  const positions = [`calc(var(--u) * (${b.x} - ${b.w} * round(nearest, var(--gs) * ${EDU_WAVE_STEPS}, 1))) ${u(b.y)}`];
  if (floor !== undefined) {
    images.push(level(floor));
    sizes.push("100% 100%");
    positions.push("0 0");
  }
  const m = { image: images.join(", "), size: sizes.join(", "), position: positions.join(", ") };
  return {
    maskImage: m.image,
    WebkitMaskImage: m.image,
    maskSize: m.size,
    WebkitMaskSize: m.size,
    maskPosition: m.position,
    WebkitMaskPosition: m.position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskComposite: "add",
    WebkitMaskComposite: "source-over",
  };
}

const ringMask = (src: string): CSSProperties => ({ maskImage: `url(${src})`, WebkitMaskImage: `url(${src})`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" });

const SVG_FRAME = { viewBox: `0 0 ${SCENE.width} ${SCENE.height}`, className: "pointer-events-none absolute inset-0 h-full w-full" } as const;

/**
 * The light running round the ring: a sprite whose frames are drawn along the
 * traced ring (its point, body and tail through the ring's visible pixels, so
 * the church, the mountains and the dome hide it behind). Frame k follows --go.
 */
function RingLight() {
  const b = EDU_LIGHT_BOX;
  const [cols, rows] = EDU_LIGHT_GRID;
  const k = `round(nearest, var(--go) * ${EDU_LIGHT_STEPS}, 1)`;
  return (
    <div
      className="edu-light absolute"
      style={{
        ...box(b),
        backgroundImage: `url(${M14H2}/educational-light.png)`,
        backgroundSize: `${u(b.w * cols)} ${u(b.h * rows)}`,
        backgroundPosition: `calc(var(--u) * ${-b.w} * mod(${k}, ${cols})) calc(var(--u) * ${-b.h} * round(down, ${k} / ${cols}, 1))`,
        backgroundRepeat: "no-repeat",
      }}
    />
  );
}

/** The power pulse: the strips' own light, through a narrow window riding just behind the part's front (as Engineering's). */
function Pulse({ index }: { index: number }) {
  const p = PLATFORM_POWER[ID].parts[index];
  const at = (offset: number) => `calc(var(--u) * ${+offset.toFixed(2)} + var(--u) * ${p.span} * var(--pw))`;
  const mask = `linear-gradient(${p.angle}deg, transparent ${at(p.f0 - 34)}, #000 ${at(p.f0 - 12)}, #000 ${at(p.f0 - 3)}, transparent ${at(p.f0 + 1)})`;
  const clip = `polygon(${p.poly.map(([x, y]) => `calc(var(--u) * ${x}) calc(var(--u) * ${y})`).join(", ")})`;
  return (
    <div
      aria-hidden="true"
      data-zone={ID}
      data-power={ID}
      data-part={index}
      className="lab-power edu-pulse edu-rise pointer-events-none absolute overflow-hidden"
      style={{ ...box(p.box), clipPath: clip, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
    >
      <Frame src={`${M14H2}/educational-strip-light.png`} box={p.box} />
    </div>
  );
}

const PARTS = PLATFORM_POWER[ID].parts.map((_, k) => k);

/** The station in this cycle's wrapper (station-cycle.ts). */
export const EducationalV2 = () => (
  <div data-zone={ID} className="edu-cycle contents">
    <Station />
  </div>
);

function Station() {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-station={ID} data-v2-station-source="approved" className="edu-v2 edu-seq pointer-events-none absolute inset-0">
      <style>{EDU_CSS}</style>
      <EducationalLift>
      {/* The station, while anything moves: body + globe + ring, summed in an isolated group (colour and alpha, so the
          room shows through the dimmed glass and no seam appears where the parts meet). */}
      <div data-edu-swap="anim" className="edu-rise absolute inset-0" style={{ isolation: "isolate", ...CLIP }}>
        <Full src={`${M14H2}/educational-body.png`} name="body" />
        <div data-edu="globe" data-edu-wave="" className="absolute inset-0" style={{ ...waveMask(`${M14H2}/educational-wave.png`, GLOBE_STANDBY), ...CLIP, mixBlendMode: "plus-lighter" }}>
          <Full src={`${M14H2}/educational-globe.png`} name="globe-image" />
        </div>
        {/* The ring: standby, the rest uncovered along it behind the light. */}
        <div className="absolute inset-0" style={{ opacity: ORBIT_STANDBY, ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
          <Full src={`${M14H2}/educational-orbit.png`} name="orbit" />
        </div>
        <div className="edu-orbit-lit absolute inset-0" style={{ opacity: 1 - ORBIT_STANDBY, ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
          <svg {...SVG_FRAME} aria-hidden="true">
            <defs>
              <mask id="edu-ring-lit" maskUnits="userSpaceOnUse" x={650} y={290} width={366} height={160}>
                <path
                  d={EDU_RING_PATH}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={30}
                  style={{ strokeDasharray: `calc(var(--go) * ${RUN.toFixed(1)}px) 9999px` }}
                />
              </mask>
            </defs>
            <SceneImageInSvg src={`${M14H2}/educational-orbit.png`} mask="url(#edu-ring-lit)" />
          </svg>
        </div>
      </div>
      {/* Stable: the recovered station itself (M1.4F.1's files), exactly as before this milestone. M1.4J.2: its light
          rises with it, except for the corner strips' spill on the floor. */}
      <Full src={`${M14F1}/educational.png`} name="station-stable" swap="stable" className="edu-rise" />
      <Full src={`${M14F1}/educational-light.png`} name="light-stable" add swap="stable" className="edu-rise" style={clipTo({ x: 648, y: 248, w: 376, h: LIGHT_SPLIT - 248 })} />
      {SHARES.flatMap((share) =>
        FLOOR_PARTS.map((_, k) => (
          <Full
            key={`stable-${share}-${k}`}
            src={`${M14F1}/educational-light.png`}
            name={`stable-${share}-${k}`}
            add
            swap="stable"
            className={share === "edge" ? "edu-rise" : ""}
            style={{ ...clipTo(shareBox(share, k)), ...shareMask(share, k), opacity: share === "spill" ? `calc(1 - ${SPILL_SOFTEN} * var(--dl))` : undefined }}
          />
        )),
      )}
      {/* The station's light, split the same way. */}
      <div data-edu="globe-light" data-edu-wave="" data-edu-swap="anim" className="edu-rise absolute inset-0" style={{ ...waveMask(`${M14H2}/educational-wave.png`, GLOBE_STANDBY), ...CLIP, mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H2}/educational-globe-light.png`} name="globe-light-image" />
      </div>
      <div data-edu-swap="anim" className="edu-orbit-rest edu-rise absolute inset-0" style={{ ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H2}/educational-orbit-light.png`} name="orbit-light" />
      </div>
      {/* The corner strips' light: their spill on the floor stays, their edge rises with them. */}
      <div data-edu-swap="anim" className="absolute inset-0">
        {SHARES.map((share) => (
          <EducationalFloorParts key={share} src={`${M14H2}/educational-strip-floor.png`} name={`strip-${share}`} standby={0} share={share} />
        ))}
      </div>
      {/* The strips: unpowered ahead of each front (PowerPart, the established fronts), a pulse riding it. */}
      {PARTS.map((k) => (
        <PowerPart key={`off-${k}`} id={ID} index={k} side="dim" className="edu-rise">
          <Frame src={`${M14H2}/educational-strip-off.png`} box={PLATFORM_POWER[ID].parts[k].box} />
        </PowerPart>
      ))}
      {PARTS.map((k) => (
        <Pulse key={`pulse-${k}`} index={k} />
      ))}
      {/* The pool at the globe's foot: one pulse of its own light. */}
      <div className="edu-gate edu-rise absolute inset-0" style={{ ...FOOT_CLIP, mixBlendMode: "plus-lighter" }}>
        <div className="edu-pulse-base absolute inset-0">
          <Full src={`${M14H2}/educational-base.png`} name="base" />
        </div>
      </div>
      {/* The wave's crest: the globe's own light, brighter where the wave is passing. */}
      <div className="edu-gate edu-rise absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div data-edu="crest" className="edu-crest absolute inset-0" style={waveMask(`${M14H2}/educational-crest.png`)}>
          <Full src={`${M14H2}/educational-flare.png`} name="flare" />
        </div>
      </div>
      {/* The light round the ring, through the ring's visible pixels (the island, church and dome hide it behind). */}
      <div data-edu="light" className="edu-gate edu-rise absolute inset-0" style={{ ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <RingLight />
      </div>
      <div data-edu="shimmer" className="edu-shimmer edu-rise absolute inset-0" style={{ ...ringMask(`${M14H2}/educational-ring-core.png`), ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <svg {...SVG_FRAME} aria-hidden="true">
          <path className="edu-shimmer-line" d={EDU_RING_PATH} fill="none" stroke="rgb(255 226 170)" strokeWidth={3} strokeLinecap="round" style={{ strokeDasharray: "90px 9999px", strokeDashoffset: "110px" }} />
        </svg>
      </div>
      </EducationalLift>
    </div>
  );
}

/** Warm floor light following the strips' fronts (FLOOR_PARTS), over its standby. */
function EducationalFloorParts({ src, name, standby, share }: { src: string; name: string; standby: number; share?: StripShare }) {
  return (
    <>
      {standby > 0 ? (
        // plus-lighter on the fading element itself (its opacity would isolate a blended child)
        <div data-edu={`${name}-standby`} className="absolute inset-0" style={{ opacity: standby, mixBlendMode: "plus-lighter" }}>
          <Full src={src} name={name} />
        </div>
      ) : null}
      {FLOOR_PARTS.map((p, k) => {
        const span = p.box.w + POWER_FRONT;
        const front = `calc(var(--u) * ${span} * var(--pw))`;
        const behind = `calc(var(--u) * ${-POWER_FRONT} + var(--u) * ${span} * var(--pw))`;
        const mask = `linear-gradient(${p.angle}deg, #000 ${behind}, transparent ${front})`;
        return (
          <div
            key={k}
            data-zone={ID}
            data-floor-part={k}
            data-strip-share={share}
            className={`edu-floor absolute overflow-hidden${share === "edge" ? " edu-rise" : ""}`}
            style={{ ...box(p.box), ...(share && clipTo(shareBox(share, k), p.box)), ["--edu-standby" as string]: standby, ["--edu-soften" as string]: share === "spill" ? SPILL_SOFTEN : 0, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
          >
            <Frame src={src} box={p.box} style={share ? shareMask(share, k) : footFade(k)} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Educational's share of the floor light (ring, reflections; M1.4G.1), on the
 * floor under every station (SceneV2): the warm part follows its strips, the
 * cyan part (the globe's reflection) the globe.
 */
/** Its floor light in this cycle's wrapper (station-cycle.ts). */
export const EducationalFloor = () => (
  <div data-zone={ID} className="edu-cycle contents">
    <EducationalLift>
      <Floor />
    </EducationalLift>
  </div>
);

function Floor() {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-floor="educational-floor" className="edu-seq pointer-events-none absolute inset-0">
      <EducationalFloorParts src={`${M14H2}/educational-floor.png`} name="floor" standby={FLOOR_STANDBY} />
      <div className="edu-floor-cyan absolute inset-0" style={{ ...clipTo({ x: 648, y: 470, w: 382, h: 114 }), mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H2}/educational-floor-cyan.png`} name="floor-cyan" />
      </div>
    </div>
  );
}
