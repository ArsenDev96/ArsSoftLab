import type { CSSProperties } from "react";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { CRE_BOX, CRE_GLINT_GRID, CRE_GLINT_STEPS, CRE_GRID, CRE_SUNRISE_STEPS } from "./creative-v2";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { partFrame, PowerPart, powerCss } from "./PlatformPower";
import { cycleCss } from "./station-cycle";

/**
 * M1.4H.3 (/lab-v2 only): Creative Studio's activation: the painting awakens
 * with the light of its own sunrise. M1.4F's recovered station is always drawn,
 * unmodified; every other layer is its own pixels or light
 * (scripts/m14h3-creative.py), and at the end none of them is left over it.
 *
 *   rest      strips unpowered; the painting (and the two small framed ones) a
 *             little subdued, its highlights most (an overlay of its own pixels
 *             through a tone curve); floor ring and reflections faint
 *   arrival   (+0) the strips light along their own paths (the existing power
 *             fronts, PLATFORM_POWER), the floor light following
 *   response  (+100) the warm painted details along its lower edge, and the
 *             ledge it stands on, brighten once
 *   sunrise   (+150) the overlay is removed from the painted sun outwards: fast
 *             along the bright clouds and ridges, slow through the dark (the
 *             sprite frames hold each pixel's time), the painting's own
 *             highlights brighter at its front; the small paintings last
 *   glints    (+350) a short light along the sunlit ridge to the summit, bright
 *             cloud edges, the small paintings' lit peaks
 *   stable    (+780) the approved artwork; nothing keeps moving
 *
 * All state is CSS (CRE_CSS): registered numbers transition from the energy's
 * arrival (--arrive-now, ACTIVATION_CSS), as M1.4H.1 and H.2: leaving before the
 * energy arrives cancels natively, quick switching leaves nothing lit, a
 * selection or deep link is powered at once with no replay. Leaving: the added
 * light stops at once, the sunrise draws back to the sun, the strips drain.
 * Reduced motion: a 150 ms cross-fade; nothing travels.
 */

const M14H3 = "/scene/v2/m14h3";
const M14F = "/scene/v2/m14f";
const M14G1 = "/scene/v2/m14g1";
const ID = "creative";
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;

/** At rest the floor keeps this much of the ring and strip reflections, and of the mirrored objects on top. */
const FLOOR_STANDBY = 0.2;
const FLOOR_TOP_STANDBY = 0.75;

/** Timing after the energy's arrival (ms). */
export const CRE_TIMING = {
  warmDelay: 100,
  warmMs: 280,
  sunriseDelay: 150,
  sunriseMs: 440,
  glintDelay: 350,
  glintMs: 380,
  stableDelay: 780,
  settleMs: 160,
} as const;
const T = CRE_TIMING;

/**
 * The floor's strip light follows the strips' fronts, right to left from where
 * the connection arrives (the front strip 19-209 ms, the left one 327-412 ms).
 */
const FLOOR_PARTS = [
  { box: { x: 365, y: 668, w: 211, h: 150 }, on: { delay: 0, dur: 225 }, off: { delay: 130, dur: 200 } },
  { box: { x: 26, y: 668, w: 339, h: 150 }, on: { delay: 215, dur: 355 }, off: { delay: 0, dur: 180 } },
];

const box = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });
/** Moving layers repaint only their own box (on the blended element itself, so it still adds to the room). */
const clipTo = (r: SceneRect): CSSProperties => ({ clipPath: `inset(${u(r.y)} ${u(SCENE.width - r.x - r.w)} ${u(SCENE.height - r.y - r.h)} ${u(r.x)})` });
const CLIP = clipTo(CRE_BOX);

const prop = (name: string) => `@property ${name}{syntax:"<number>";inherits:true;initial-value:0}`;

const CRE_CSS =
  prop("--cr") +
  powerCss(ID) +
  // The sequence's numbers, on the station's root and on its floor light, and the strips' pulse (M1.4I.1D:
  // station-cycle.ts). Leaving: the added light is gated off at once, its numbers reset a moment later.
  cycleCss({
    id: ID,
    cls: "cre",
    key: "c",
    numbers: [
      { v: "--cw", on: `${T.warmMs}ms linear calc(var(--arrive-now) + ${T.warmDelay}ms)`, off: "0ms linear 300ms" },
      { v: "--cs", on: `${T.sunriseMs}ms cubic-bezier(0.35,0.25,0.65,0.85) calc(var(--arrive-now) + ${T.sunriseDelay}ms)`, off: "320ms ease-in-out 100ms" },
      { v: "--cg", on: `${T.glintMs}ms linear calc(var(--arrive-now) + ${T.glintDelay}ms)`, off: "0ms linear 300ms" },
    ],
    doneMs: T.stableDelay,
    pulse: 0.8,
  }) +
  `.cre-seq{--cr:0}${ON} .cre-seq{--cr:1}` +
  // Light that only exists while the sequence runs forward: nothing before the energy is there, gone at once on leaving.
  `.cre-gate{opacity:0;transition:opacity 0s}${ON} .cre-gate{opacity:1;transition:opacity 0ms linear var(--arrive-now)}` +
  `.cre-warm{opacity:calc(min(1, var(--cw) * 2.6) * min(1, (1 - var(--cw)) * 1.7))}` +
  `.cre-crest{opacity:calc(min(1, var(--cs) * 1000) * min(1, (1 - var(--cs)) * 1000))}` +
  `.cre-glints{opacity:calc(min(1, var(--cg) * 1000) * min(1, (1 - var(--cg)) * 1000))}` +
  // The strips' floor light: behind the fronts while they move, then the approved layer itself (a masked layer draws
  // its 1 px edges a little differently). Both add, so fading one into the other changes nothing else.
  `[data-cre-swap="stable"]{opacity:0;transition:opacity 80ms linear}[data-cre-swap="anim"]{opacity:1;transition:opacity 80ms linear}` +
  `${ON} [data-cre-swap="stable"]{opacity:1;transition:opacity ${T.settleMs}ms linear calc(var(--arrive-now) + ${T.stableDelay - T.settleMs}ms)}` +
  `${ON} [data-cre-swap="anim"]{opacity:0;transition:opacity ${T.settleMs}ms linear calc(var(--arrive-now) + ${T.stableDelay - T.settleMs}ms)}` +
  `.cre-floor{opacity:calc(1 - var(--cre-standby, 0))}` +
  FLOOR_PARTS.map(
    (p, k) =>
      `.cre-floor[data-floor-part="${k}"]{--pw:0;transition:--pw ${p.off.dur}ms linear ${p.off.delay}ms}` +
      `${ON} .cre-floor[data-floor-part="${k}"]{--pw:1;transition:--pw ${p.on.dur}ms linear calc(var(--arrive-now) + ${p.on.delay}ms)}`,
  ).join("") +
  `.cre-floor-top{opacity:calc(${FLOOR_TOP_STANDBY} + ${1 - FLOOR_TOP_STANDBY} * var(--cs))}` +
  // Reduced motion: the powered appearance, cross-faded whole; nothing travels.
  `@media (prefers-reduced-motion: reduce){` +
  `.cre-seq,${ON} .cre-seq{transition:--cr 150ms ease}` +
  `[data-cre="standby"]{mask-image:none!important;-webkit-mask-image:none!important;opacity:calc(1 - var(--cr))}` +
  `.cre-floor-top{opacity:calc(${FLOOR_TOP_STANDBY} + ${1 - FLOOR_TOP_STANDBY} * var(--cr))}` +
  `[data-cre-swap],${ON} [data-cre-swap]{transition:opacity 150ms linear}` +
  `.cre-gate,.cre-pulse{display:none}` +
  `.cre-floor{mask-image:none!important;-webkit-mask-image:none!important;opacity:0!important;transition:opacity 150ms ease!important}` +
  `${ON} .cre-floor{opacity:calc(1 - var(--cre-standby, 0))!important}}`;

function Full({ src, name, add, swap }: { src: string; name: string; add?: boolean; swap?: "stable" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-cre={name}
      data-cre-swap={swap}
      className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      style={add ? { mixBlendMode: "plus-lighter" } : undefined}
    />
  );
}

/** A full-frame image placed in a box (the box clips it). */
function Frame({ src, box }: { src: string; box: SceneRect }) {
  // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
  return <img src={src} alt="" draggable={false} data-gate="" className="absolute max-w-none select-none" style={partFrame(box)} />;
}

/** Frame k (0 to `steps`, following `value`) of a grid sprite: its size, and its position when frame 0 lies at `at`. */
function frame(value: string, steps: number, [cols, rows]: readonly [number, number], at: { x: number; y: number }) {
  const b = CRE_BOX;
  const k = `round(nearest, var(${value}) * ${steps}, 1)`;
  return {
    size: `${u(b.w * cols)} ${u(b.h * rows)}`,
    position: `calc(var(--u) * (${at.x} - ${b.w} * mod(${k}, ${cols}))) calc(var(--u) * (${at.y} - ${b.h} * round(down, ${k} / ${cols}, 1)))`,
  };
}

/** A mask on a full-frame layer whose content lies inside CRE_BOX: the sunrise's frames, following --cs. */
function sunriseMask(sprite: string): CSSProperties {
  const f = frame("--cs", CRE_SUNRISE_STEPS, CRE_GRID, CRE_BOX);
  return {
    maskImage: `url(${sprite})`,
    WebkitMaskImage: `url(${sprite})`,
    maskSize: f.size,
    WebkitMaskSize: f.size,
    maskPosition: f.position,
    WebkitMaskPosition: f.position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
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
      className="lab-power cre-pulse pointer-events-none absolute overflow-hidden"
      style={{ ...box(p.box), clipPath: clip, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
    >
      <Frame src={`${M14H3}/creative-strip-light.png`} box={p.box} />
    </div>
  );
}

/** The strips' pieces on the stone (the reflection part is the floor's: CreativeFloor). */
const STRIP_PARTS = PLATFORM_POWER[ID].parts.flatMap((p, k) => (p.kind === "strip" ? [k] : []));

/** The station in this cycle's wrapper (station-cycle.ts). */
export const CreativeV2 = () => (
  <div data-zone={ID} className="cre-cycle contents">
    <Station />
  </div>
);

function Station() {
  const glint = frame("--cg", CRE_GLINT_STEPS, CRE_GLINT_GRID, { x: 0, y: 0 });
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-station={ID} data-v2-station-source="approved" className="cre-v2 cre-seq pointer-events-none absolute inset-0">
      <style>{CRE_CSS}</style>
      {/* The recovered station itself (M1.4F's file), always. */}
      <Full src={`${M14F}/creative.png`} name="station" />
      {/* The strips' light on the floor (M1.4G.1's creative-light), behind the fronts, then whole. */}
      <div data-cre-swap="anim" className="absolute inset-0" style={{ mixBlendMode: "plus-lighter" }}>
        <FloorParts src={`${M14H3}/creative-strip-floor.png`} name="strip-floor" standby={0} full />
      </div>
      <Full src={`${M14G1}/creative-light.png`} name="light-stable" add swap="stable" />
      {/* The strips: unpowered ahead of each front (PowerPart, the established fronts), a pulse riding it. */}
      {STRIP_PARTS.map((k) => (
        <PowerPart key={`off-${k}`} id={ID} index={k} side="dim">
          <Frame src={`${M14H3}/creative-strip-off.png`} box={PLATFORM_POWER[ID].parts[k].box} />
        </PowerPart>
      ))}
      {STRIP_PARTS.map((k) => (
        <Pulse key={`pulse-${k}`} index={k} />
      ))}
      {/* Standby: the subdued painting, removed by the sunrise. */}
      <div data-cre="standby" className="absolute inset-0" style={{ ...sunriseMask(`${M14H3}/creative-sunrise.png`), ...CLIP }}>
        <Full src={`${M14H3}/creative-standby.png`} name="standby-image" />
      </div>
      {/* The first response: its warm lower details, once. */}
      <div data-cre="warm" className="cre-gate absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div className="cre-warm absolute inset-0">
          <Full src={`${M14H3}/creative-warm.png`} name="warm-image" />
        </div>
      </div>
      {/* The sunrise's front: the painting's own highlights, brighter where it is passing. */}
      <div data-cre="crest" className="cre-gate absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div className="cre-crest absolute inset-0" style={sunriseMask(`${M14H3}/creative-crest.png`)}>
          <Full src={`${M14H3}/creative-highlights.png`} name="highlights" />
        </div>
      </div>
      {/* The ridge's glint, cloud edges, the small paintings' peaks. */}
      <div data-cre="glints" className="cre-gate absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div
          className="cre-glints absolute"
          style={{ ...box(CRE_BOX), backgroundImage: `url(${M14H3}/creative-glints.png)`, backgroundSize: glint.size, backgroundPosition: glint.position, backgroundRepeat: "no-repeat" }}
        />
      </div>
    </div>
  );
}

/**
 * Floor light following the strips' fronts (FLOOR_PARTS), over its standby.
 * `full`: each part is the full-frame image with its front as a placed mask,
 * so it draws pixel for pixel like the plain image it gives way to.
 */
function FloorParts({ src, name, standby, full }: { src: string; name: string; standby: number; full?: boolean }) {
  return (
    <>
      {standby > 0 ? (
        // plus-lighter on the fading element itself (its opacity would isolate a blended child)
        <div data-cre={`${name}-standby`} className="absolute inset-0" style={{ opacity: standby, mixBlendMode: "plus-lighter" }}>
          <Full src={src} name={name} />
        </div>
      ) : null}
      {FLOOR_PARTS.map((p, k) => {
        const span = p.box.w + POWER_FRONT;
        const front = `calc(var(--u) * ${span} * var(--pw))`;
        const behind = `calc(var(--u) * ${-POWER_FRONT} + var(--u) * ${span} * var(--pw))`;
        const mask = `linear-gradient(-90deg, #000 ${behind}, transparent ${front})`;
        if (full) {
          const size = `${u(p.box.w)} ${u(p.box.h)}`;
          const at = `${u(p.box.x)} ${u(p.box.y)}`;
          return (
            <div
              key={k}
              data-zone={ID}
              data-floor-part={k}
              className="cre-floor absolute inset-0"
              style={{
                ["--cre-standby" as string]: standby,
                ...clipTo(p.box),
                maskImage: mask,
                WebkitMaskImage: mask,
                maskSize: size,
                WebkitMaskSize: size,
                maskPosition: at,
                WebkitMaskPosition: at,
                maskRepeat: "no-repeat",
                WebkitMaskRepeat: "no-repeat",
                mixBlendMode: "plus-lighter",
              }}
            >
              <Full src={src} name={`${name}-${k}`} />
            </div>
          );
        }
        return (
          <div
            key={k}
            data-zone={ID}
            data-floor-part={k}
            className="cre-floor absolute overflow-hidden"
            style={{ ...box(p.box), ["--cre-standby" as string]: standby, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
          >
            <Frame src={src} box={p.box} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Creative Studio's share of the floor light (M1.4G.1), on the floor under every
 * station (SceneV2): the ring, spill and strip reflections follow its strips;
 * what mirrors the lit objects on the platform follows the painting.
 */
/** Its floor light in this cycle's wrapper (station-cycle.ts). */
export const CreativeFloor = () => (
  <div data-zone={ID} className="cre-cycle contents">
    <Floor />
  </div>
);

function Floor() {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-floor="creative-floor" className="cre-seq pointer-events-none absolute inset-0">
      <FloorParts src={`${M14H3}/creative-floor.png`} name="floor" standby={FLOOR_STANDBY} />
      <div className="cre-floor-top absolute inset-0" style={{ ...clipTo({ x: 26, y: 800, w: 550, h: 104 }), mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H3}/creative-floor-top.png`} name="floor-top" />
      </div>
    </div>
  );
}
