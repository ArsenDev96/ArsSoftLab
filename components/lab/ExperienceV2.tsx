import type { CSSProperties } from "react";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { EXP_BOX, EXP_CLOCK, EXP_GRID, EXP_STEPS } from "./experience-v2";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { partFrame, PowerPart, powerCss } from "./PlatformPower";
import { cycleCss } from "./station-cycle";

/**
 * M1.4H.4 (/lab-v2 only): Experience's activation: the energy travels the
 * painted mountain route. M1.4F's recovered station is always drawn,
 * unmodified; every other layer is its own pixels or light
 * (scripts/m14h4-experience.py), and at the end none of them is left over it.
 *
 *   rest         strips unpowered; the route present but dim, and the light it
 *                throws on the stone and ridge wires around it taken back (an
 *                overlay of the artwork's own pixels); floor ring and
 *                reflections faint. Flags, code panel and plant as approved
 *   arrival      (+0) the strips light along their own paths (the existing power
 *                fronts, PLATFORM_POWER), the floor light following; the paving's
 *                front edge, where the route starts, brightens once (+30)
 *   journey      (+120 to +750) the overlay is removed along the route's own arc
 *                length, a short light at its head; the stone and ridges next to
 *                the head catch it, the lower flag as it passes
 *   destination  (+712 to +930) the route's last stretch brightens once, then the
 *                ridge wires that meet it, then the upper flag
 *   stable       (+980) the approved artwork; nothing keeps moving
 *
 * One registered number, --xs, is the sprites' clock (EXP_CLOCK), so the reveal,
 * the travelling light and the destination can't drift apart, and whatever
 * interrupts it they stop, reverse or resume together. All state is CSS, as
 * M1.4H.1 to H.3: it transitions from the energy's arrival (--arrive-now), so
 * leaving before that cancels natively, quick switching leaves nothing lit, and a
 * selection or deep link is powered at once with no replay. Leaving: the added
 * light is gated off at once, the trail drains back to its start, the strips drain.
 * Reduced motion: a 150 ms cross-fade; nothing travels.
 */

const M14H4 = "/scene/v2/m14h4";
const M14F = "/scene/v2/m14f";
const ID = "experience";
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;

/** At rest the floor keeps this much of the ring and strip reflections, and of the mirrored landscape. */
const FLOOR_STANDBY = 0.2;
const FLOOR_TOP_STANDBY = 0.6;

/** Timing (ms): the clock after the energy's arrival, the strips' floor light's hand-over, and leaving. */
export const EXP_TIMING = {
  clockDelay: EXP_CLOCK[0],
  clockMs: EXP_CLOCK[1] - EXP_CLOCK[0],
  stableDelay: EXP_CLOCK[1],
  settleMs: 160,
  drainDelay: 100,
  drainMs: 420,
} as const;
const T = EXP_TIMING;

/**
 * The floor's strip light follows the strips' fronts, outwards from where the
 * connection arrives (x 1192): the front strip 14-217 ms, the ring's left arc
 * beside it, the right strip 318-408 ms.
 */
const FLOOR_PARTS = [
  { angle: 90, box: { x: 1192, y: 655, w: 250, h: 257 }, on: { delay: 10, dur: 219 }, off: { delay: 150, dur: 190 } },
  { angle: -90, box: { x: 1032, y: 655, w: 160, h: 257 }, on: { delay: 20, dur: 190 }, off: { delay: 150, dur: 190 } },
  { angle: 90, box: { x: 1442, y: 655, w: 230, h: 257 }, on: { delay: 225, dur: 186 }, off: { delay: 0, dur: 160 } },
];

const box = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });
/** Moving layers repaint only their own box (on the blended element itself, so it still adds to the room). */
const clipTo = (r: SceneRect): CSSProperties => ({ clipPath: `inset(${u(r.y)} ${u(SCENE.width - r.x - r.w)} ${u(SCENE.height - r.y - r.h)} ${u(r.x)})` });
const CLIP = clipTo(EXP_BOX);

const prop = (name: string) => `@property ${name}{syntax:"<number>";inherits:true;initial-value:0}`;
const floorSel = (k: number) => `.exp-floor[data-floor-part="${k}"]`;

const EXP_CSS =
  prop("--xr") +
  powerCss(ID) +
  // The clock, on the station's root and on its floor light, and the strips' pulse (M1.4I.1D: station-cycle.ts).
  // Leaving: it stops, then runs back (it passes the destination's part quickly: that light is gated off).
  cycleCss({
    id: ID,
    cls: "exp",
    key: "x",
    numbers: [{ v: "--xs", on: `${T.clockMs}ms linear calc(var(--arrive-now) + ${T.clockDelay}ms)`, off: `${T.drainMs}ms cubic-bezier(0.12,0.4,0.5,1) ${T.drainDelay}ms` }],
    doneMs: T.stableDelay,
    pulse: 0.8,
  }) +
  `.exp-seq{--xr:0}${ON} .exp-seq{--xr:1}` +
  // Light that only exists while the sequence runs forward: nothing before the energy is there, gone at once on leaving.
  `.exp-gate{opacity:0;transition:opacity 0s}${ON} .exp-gate{opacity:1;transition:opacity 0ms linear var(--arrive-now)}` +
  `.exp-light{opacity:calc(min(1, var(--xs) * 1000) * min(1, (1 - var(--xs)) * 1000))}` +
  // The strips' floor light: behind the fronts while they move, then the approved layer itself (a masked layer draws
  // its 1 px edges a little differently). Both add, so fading one into the other changes nothing else.
  `[data-exp-swap="stable"]{opacity:0;transition:opacity 80ms linear}[data-exp-swap="anim"]{opacity:1;transition:opacity 80ms linear}` +
  `${ON} [data-exp-swap="stable"]{opacity:1;transition:opacity ${T.settleMs}ms linear calc(var(--arrive-now) + ${T.stableDelay - T.settleMs}ms)}` +
  `${ON} [data-exp-swap="anim"]{opacity:0;transition:opacity ${T.settleMs}ms linear calc(var(--arrive-now) + ${T.stableDelay - T.settleMs}ms)}` +
  `.exp-floor{opacity:calc(1 - var(--exp-standby, 0))}` +
  FLOOR_PARTS.map(
    (p, k) =>
      `${floorSel(k)}{--pw:0;transition:--pw ${p.off.dur}ms linear ${p.off.delay}ms}` +
      `${ON} ${floorSel(k)}{--pw:1;transition:--pw ${p.on.dur}ms linear calc(var(--arrive-now) + ${p.on.delay}ms)}`,
  ).join("") +
  `.exp-floor-top{opacity:calc(${FLOOR_TOP_STANDBY} + ${1 - FLOOR_TOP_STANDBY} * min(1, max(0, var(--xs) - 0.1) * 1.5))}` +
  // Reduced motion: the powered appearance, cross-faded whole; nothing travels.
  `@media (prefers-reduced-motion: reduce){` +
  `.exp-seq,${ON} .exp-seq{transition:--xr 150ms ease}` +
  `[data-exp="standby"]{mask-image:none!important;-webkit-mask-image:none!important;opacity:calc(1 - var(--xr))}` +
  `.exp-floor-top{opacity:calc(${FLOOR_TOP_STANDBY} + ${1 - FLOOR_TOP_STANDBY} * var(--xr))}` +
  `[data-exp-swap],${ON} [data-exp-swap]{transition:opacity 150ms linear}` +
  `.exp-gate,.exp-pulse{display:none}` +
  `.exp-floor{mask-image:none!important;-webkit-mask-image:none!important;opacity:0!important;transition:opacity 150ms ease!important}` +
  `${ON} .exp-floor{opacity:calc(1 - var(--exp-standby, 0))!important}}`;

function Full({ src, name, add, swap }: { src: string; name: string; add?: boolean; swap?: "stable" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-exp={name}
      data-exp-swap={swap}
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

/** The sprites' frame at the clock --xs: the grid's size, and its position when frame 0 lies at `at`. */
function frame(at: { x: number; y: number }) {
  const b = EXP_BOX;
  const [cols, rows] = EXP_GRID;
  const k = `round(nearest, var(--xs) * ${EXP_STEPS}, 1)`;
  return {
    size: `${u(b.w * cols)} ${u(b.h * rows)}`,
    position: `calc(var(--u) * (${at.x} - ${b.w} * mod(${k}, ${cols}))) calc(var(--u) * (${at.y} - ${b.h} * round(down, ${k} / ${cols}, 1)))`,
  };
}

/** How much of the standby overlay is left: the reveal sprite as a mask on a full-frame layer inside EXP_BOX. */
function revealMask(): CSSProperties {
  const f = frame(EXP_BOX);
  const sprite = `url(${M14H4}/experience-reveal.png)`;
  return {
    maskImage: sprite,
    WebkitMaskImage: sprite,
    maskSize: f.size,
    WebkitMaskSize: f.size,
    maskPosition: f.position,
    WebkitMaskPosition: f.position,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}

/** The power pulse: the strips' own light, through a narrow window riding just behind the part's front (as Creative Studio's). */
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
      className="lab-power exp-pulse pointer-events-none absolute overflow-hidden"
      style={{ ...box(p.box), clipPath: clip, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
    >
      <Frame src={`${M14H4}/experience-strip-light.png`} box={p.box} />
    </div>
  );
}

/** The strips' pieces on the stone (the reflection parts are the floor's: ExperienceFloor). */
const STRIP_PARTS = PLATFORM_POWER[ID].parts.flatMap((p, k) => (p.kind === "strip" ? [k] : []));

/** The station in this cycle's wrapper (station-cycle.ts). */
export const ExperienceV2 = () => (
  <div data-zone={ID} className="exp-cycle contents">
    <Station />
  </div>
);

function Station() {
  const light = frame({ x: 0, y: 0 });
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-station={ID} data-v2-station-source="approved" className="exp-v2 exp-seq pointer-events-none absolute inset-0">
      <style>{EXP_CSS}</style>
      {/* The recovered station itself (M1.4F's file), always. */}
      <Full src={`${M14F}/experience.png`} name="station" />
      {/* The strips' light on the floor (M1.4F's experience-light), behind the fronts, then whole. */}
      <div data-exp-swap="anim" className="absolute inset-0" style={{ mixBlendMode: "plus-lighter" }}>
        <FloorParts src={`${M14F}/experience-light.png`} name="strip-floor" standby={0} full />
      </div>
      <Full src={`${M14F}/experience-light.png`} name="light-stable" add swap="stable" />
      {/* The strips: unpowered ahead of each front (PowerPart, the established fronts), a pulse riding it. */}
      {STRIP_PARTS.map((k) => (
        <PowerPart key={`off-${k}`} id={ID} index={k} side="dim">
          <Frame src={`${M14H4}/experience-strip-off.png`} box={PLATFORM_POWER[ID].parts[k].box} />
        </PowerPart>
      ))}
      {STRIP_PARTS.map((k) => (
        <Pulse key={`pulse-${k}`} index={k} />
      ))}
      {/* Standby: the dim route and the terrain without its light, removed along the route by the journey. */}
      <div data-exp="standby" className="absolute inset-0" style={{ ...revealMask(), ...CLIP }}>
        <Full src={`${M14H4}/experience-standby.png`} name="standby-image" />
      </div>
      {/* The light that travels: the start, the head, the terrain and flags it passes, the destination. */}
      <div data-exp="light" className="exp-gate absolute inset-0" style={{ ...CLIP, mixBlendMode: "plus-lighter" }}>
        <div
          className="exp-light absolute"
          style={{ ...box(EXP_BOX), backgroundImage: `url(${M14H4}/experience-light.png)`, backgroundSize: light.size, backgroundPosition: light.position, backgroundRepeat: "no-repeat" }}
        />
      </div>
    </div>
  );
}

/**
 * Floor light following the strips' fronts (FLOOR_PARTS), over its standby.
 * `full`: each part is the full-frame image with its front as a placed mask,
 * so it draws pixel for pixel like the plain image it gives way to.
 * `lit`: what the fronts add, where it isn't the standby's own image.
 */
function FloorParts({ src, lit = src, name, standby, full }: { src: string; lit?: string; name: string; standby: number; full?: boolean }) {
  return (
    <>
      {standby > 0 ? (
        // plus-lighter on the fading element itself (its opacity would isolate a blended child)
        <div data-exp={`${name}-standby`} className="absolute inset-0" style={{ opacity: standby, mixBlendMode: "plus-lighter" }}>
          <Full src={src} name={name} />
        </div>
      ) : null}
      {FLOOR_PARTS.map((p, k) => {
        const span = p.box.w + POWER_FRONT;
        const front = `calc(var(--u) * ${span} * var(--pw))`;
        const behind = `calc(var(--u) * ${-POWER_FRONT} + var(--u) * ${span} * var(--pw))`;
        const mask = `linear-gradient(${p.angle}deg, #000 ${behind}, transparent ${front})`;
        const placed: CSSProperties = full
          ? {
              ...clipTo(p.box),
              maskSize: `${u(p.box.w)} ${u(p.box.h)}`,
              WebkitMaskSize: `${u(p.box.w)} ${u(p.box.h)}`,
              maskPosition: `${u(p.box.x)} ${u(p.box.y)}`,
              WebkitMaskPosition: `${u(p.box.x)} ${u(p.box.y)}`,
              maskRepeat: "no-repeat",
              WebkitMaskRepeat: "no-repeat",
            }
          : box(p.box);
        return (
          <div
            key={k}
            data-zone={ID}
            data-floor-part={k}
            className={full ? "exp-floor absolute inset-0" : "exp-floor absolute overflow-hidden"}
            style={{ ["--exp-standby" as string]: standby, ...placed, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
          >
            {full ? <Full src={lit} name={`${name}-${k}`} /> : <Frame src={lit} box={p.box} />}
          </div>
        );
      })}
    </>
  );
}

/**
 * Experience's share of the floor light (M1.4G.1), on the floor under every
 * station (SceneV2): the ring, spill and strip reflections follow its strips;
 * what mirrors the lit landscape follows the journey.
 */
/** Its floor light in this cycle's wrapper (station-cycle.ts). */
export const ExperienceFloor = () => (
  <div data-zone={ID} className="exp-cycle contents">
    <Floor />
  </div>
);

function Floor() {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-floor="experience-floor" className="exp-seq pointer-events-none absolute inset-0">
      {/* The fronts' image holds back the bright floor disc left of the platform (the standby's is unchanged). */}
      <FloorParts src={`${M14H4}/experience-floor.png`} lit={`${M14H4}/experience-floor-lit.png`} name="floor" standby={FLOOR_STANDBY} />
      <div className="exp-floor-top absolute inset-0" style={{ ...clipTo({ x: 1032, y: 816, w: 640, h: 96 }), mixBlendMode: "plus-lighter" }}>
        <Full src={`${M14H4}/experience-floor-top.png`} name="floor-top" />
      </div>
    </div>
  );
}
