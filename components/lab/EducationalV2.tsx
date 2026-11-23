import type { CSSProperties } from "react";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { EDU_LIGHT_BOX, EDU_LIGHT_GRID, EDU_LIGHT_STEPS, EDU_LIGHT_TAIL, EDU_RING_LENGTH, EDU_RING_PATH, EDU_WAVE_BOX, EDU_WAVE_STEPS } from "./educational-v2";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { partFrame, PowerPart, powerCss } from "./PlatformPower";
import { cycleCss } from "./station-cycle";

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

const box = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });
/**
 * Every layer that moves is clipped to the station (its own pixels, the floor
 * excluded), so a frame repaints that box, not the whole scene beneath it. On
 * the blended elements themselves: a clip-path on their parent would isolate
 * them, and they would no longer add to the room.
 */
const clipTo = (r: SceneRect): CSSProperties => ({ clipPath: `inset(${u(r.y)} ${u(SCENE.width - r.x - r.w)} ${u(SCENE.height - r.y - r.h)} ${u(r.x)})` });
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
  `.edu-floor{opacity:calc(1 - var(--edu-standby, 0))}` +
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

function Full({ src, name, add, swap, className = "" }: { src: string; name: string; add?: boolean; swap?: "anim" | "stable"; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-edu={name}
      data-edu-swap={swap}
      className={`pointer-events-none absolute inset-0 h-full w-full max-w-none select-none ${className}`}
      style={add ? { mixBlendMode: "plus-lighter" } : undefined}
    />
  );
}

/** A full-frame image placed in a box (the box clips it). */
function Frame({ src, box }: { src: string; box: SceneRect }) {
  // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
  return <img src={src} alt="" draggable={false} data-gate="" className="absolute max-w-none select-none" style={partFrame(box)} />;
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
      className="lab-power edu-pulse pointer-events-none absolute overflow-hidden"
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
      {/* The station, while anything moves: body + globe + ring, summed in an isolated group (colour and alpha, so the
          room shows through the dimmed glass and no seam appears where the parts meet). */}
      <div data-edu-swap="anim" className="absolute inset-0" style={{ isolation: "isolate", ...CLIP }}>
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
            <image href={`${M14H2}/educational-orbit.png`} width={SCENE.width} height={SCENE.height} mask="url(#edu-ring-lit)" />
          </svg>
        </div>
      </div>
      {/* Stable: the recovered station itself (M1.4F.1's files), exactly as before this milestone. */}
      <Full src={`${M14F1}/educational.png`} name="station-stable" swap="stable" />
      <Full src={`${M14F1}/educational-light.png`} name="light-stable" add swap="stable" />
      {/* The station's light, split the same way. */}
      <div data-edu="globe-light" data-edu-wave="" data-edu-swap="anim" className="absolute inset-0" style={{ ...waveMask(`${M14H2}/educational-wave.png`, GLOBE_STANDBY), ...CLIP, mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H2}/educational-globe-light.png`} name="globe-light-image" />
      </div>
      <div data-edu-swap="anim" className="edu-orbit-rest absolute inset-0" style={{ ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H2}/educational-orbit-light.png`} name="orbit-light" />
      </div>
      <div data-edu-swap="anim" className="absolute inset-0">
        <EducationalFloorParts src={`${M14H2}/educational-strip-floor.png`} name="strip-floor" standby={0} />
      </div>
      {/* The strips: unpowered ahead of each front (PowerPart, the established fronts), a pulse riding it. */}
      {PARTS.map((k) => (
        <PowerPart key={`off-${k}`} id={ID} index={k} side="dim">
          <Frame src={`${M14H2}/educational-strip-off.png`} box={PLATFORM_POWER[ID].parts[k].box} />
        </PowerPart>
      ))}
      {PARTS.map((k) => (
        <Pulse key={`pulse-${k}`} index={k} />
      ))}
      {/* The pool at the globe's foot: one pulse of its own light. */}
      <div className="edu-gate absolute inset-0" style={{ ...FOOT_CLIP, mixBlendMode: "plus-lighter" }}>
        <div className="edu-pulse-base absolute inset-0">
          <Full src={`${M14H2}/educational-base.png`} name="base" />
        </div>
      </div>
      {/* The wave's crest: the globe's own light, brighter where the wave is passing. */}
      <div className="edu-gate absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div data-edu="crest" className="edu-crest absolute inset-0" style={waveMask(`${M14H2}/educational-crest.png`)}>
          <Full src={`${M14H2}/educational-flare.png`} name="flare" />
        </div>
      </div>
      {/* The light round the ring, through the ring's visible pixels (the island, church and dome hide it behind). */}
      <div data-edu="light" className="edu-gate absolute inset-0" style={{ ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <RingLight />
      </div>
      <div data-edu="shimmer" className="edu-shimmer absolute inset-0" style={{ ...ringMask(`${M14H2}/educational-ring-core.png`), ...RING_CLIP, mixBlendMode: "plus-lighter" }}>
        <svg {...SVG_FRAME} aria-hidden="true">
          <path className="edu-shimmer-line" d={EDU_RING_PATH} fill="none" stroke="rgb(255 226 170)" strokeWidth={3} strokeLinecap="round" style={{ strokeDasharray: "90px 9999px", strokeDashoffset: "110px" }} />
        </svg>
      </div>
    </div>
  );
}

/** Warm floor light following the strips' fronts (FLOOR_PARTS), over its standby. */
function EducationalFloorParts({ src, name, standby }: { src: string; name: string; standby: number }) {
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
            className="edu-floor absolute overflow-hidden"
            style={{ ...box(p.box), ["--edu-standby" as string]: standby, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
          >
            <Frame src={src} box={p.box} />
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
    <Floor />
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
