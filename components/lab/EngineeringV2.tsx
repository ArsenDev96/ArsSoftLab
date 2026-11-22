import type { CSSProperties } from "react";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { ENG_BARS, ENG_CHART_BOX } from "./engineering-v2";
import { EngineeringScreenLayer } from "./EngineeringScreen";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { partFrame, PowerPart, powerCss } from "./PlatformPower";

/**
 * M1.4H.1 (/lab-v2 only): Engineering's activation, on M1.4F.1's recovered
 * station. Every layer is a partition or a copy of the current artwork
 * (scripts/m14h1-engineering.py): powered, they recompose it exactly; at rest
 * the workstation is unpowered.
 *
 *   rest      strips unpowered (the approved plate's own darkened strips), the
 *             laptop's display in standby (dimmed), the chart's hologram
 *             faint, its floor ring and reflection faint
 *   arrival   (+0) the strips light along their own paths from where the
 *             connection meets the plinth (the existing power fronts,
 *             PLATFORM_POWER), a brighter pulse riding each front; the floor
 *             light (ring, spill, reflections) follows the same fronts
 *   screen    (+90) a crisp line scans down the display in its perspective,
 *             revealing the approved screen behind it (EngineeringScreenLayer)
 *   chart     (+180) the bars rise one after another, left to right, each
 *             uncovering its own pixels from the base up with a bright cap on
 *             its edge; the panel's glass comes up behind them
 *   stable    (~+570) the approved artwork, powered; every ~5 s a faint line
 *             runs up the chart's hologram only
 *
 * All state is CSS (ENG_CSS): registered numbers transition from the energy's
 * arrival (--arrive-now, ACTIVATION_CSS), so leaving before the energy
 * arrives cancels natively, quick switching can't leave anything lit, and a
 * deep link or selection is powered at once. Leaving: the scan and the chart's
 * activity stop at once, the bars sink, the display and chart return to
 * standby and the strips drain toward the connection (their established
 * timing). Reduced motion: no scan, no rising bars, no pulse or sweep: a 150 ms
 * cross-fade into the powered appearance.
 */

const M14H1 = "/scene/v2/m14h1";
const M14F1 = "/scene/v2/m14f1";
const ID = "engineering";
const ON = `:is([data-lab-hover="${ID}"],[data-lab-selected="${ID}"])`;

/** Standby: the display's dimming (overlay alpha) and the chart's remaining strength. */
const SCREEN_STANDBY = 0.68;
const CHART_STANDBY = 0.28;
/** At rest the floor keeps this much of Engineering's ring and reflections (unlit metal, the room's light). */
const FLOOR_STANDBY = 0.2;

/** Timing after the energy's arrival (ms). */
export const ENG_TIMING = {
  scanDelay: 90,
  scanMs: 380,
  chartDelay: 180,
  barStagger: 24,
  barMs: 150,
  glassMs: 300,
  shimmerDelay: 900,
  shimmerPeriod: 5200,
} as const;
const T = ENG_TIMING;
const BAR_VARS = ENG_BARS.map((_, k) => `--eb${k}`);
/** Every bar fully risen: the glass no longer needs the bars' rects cut out (--ed), so the mask is uniform. */
const CHART_DONE = T.chartDelay + (ENG_BARS.length - 1) * T.barStagger + T.barMs + 10;

/**
 * Engineering's floor light follows the strips' fronts: its right part (the
 * ring's curve round the plinth) with the plinth's wrap, from the arrival
 * point outward; its left part (the lip, the spill and the strips'
 * reflection) at the front strip's own speed (0.785 px/ms), so the front on
 * the floor stays under the front on the stone. Each front runs right to left
 * across its box; --pw as for the strips.
 */
const FLOOR_PARTS = [
  { box: { x: 520, y: 505, w: 112, h: 165 }, d0: 7, span: 120, on: { delay: 0, dur: 110 }, off: { delay: 196, dur: 119 } },
  { box: { x: 232, y: 505, w: 288, h: 165 }, d0: -POWER_FRONT, span: 300, on: { delay: 107, dur: 368 }, off: { delay: -113, dur: 313 } },
];

const box = (r: SceneRect): CSSProperties => ({ left: u(r.x), top: u(r.y), width: u(r.w), height: u(r.h) });
const C = ENG_CHART_BOX;

const prop = (name: string) => `@property ${name}{syntax:"<number>";inherits:true;initial-value:0}`;
const barOn = (k: number) => `${BAR_VARS[k]} ${T.barMs}ms cubic-bezier(0.25,0.6,0.3,1) calc(var(--arrive-now) + ${T.chartDelay + k * T.barStagger}ms)`;

const ENG_CSS =
  [prop("--es"), prop("--ef"), prop("--ed"), ...BAR_VARS.map(prop)].join("") +
  powerCss(ID) +
  // The sequence's numbers, on the station's root.
  `.eng-v2{--es:0;--ef:0;--ed:0;${BAR_VARS.map((v) => `${v}:0`).join(";")};` +
  `transition:--es 0ms linear 400ms,--ef 240ms var(--ease-glow) 160ms,--ed 0ms linear 120ms,${BAR_VARS.map((v) => `${v} 200ms ease-in 120ms`).join(",")}}` +
  `${ON} .eng-v2{--es:1;--ef:1;--ed:1;${BAR_VARS.map((v) => `${v}:1`).join(";")};` +
  `transition:--es ${T.scanMs}ms cubic-bezier(0.45,0,0.55,1) calc(var(--arrive-now) + ${T.scanDelay}ms),` +
  `--ef ${T.glassMs}ms var(--ease-glow) calc(var(--arrive-now) + ${T.chartDelay}ms),--ed 0ms linear calc(var(--arrive-now) + ${CHART_DONE}ms),${BAR_VARS.map((_, k) => barOn(k)).join(",")}}` +
  // The display: standby until the scan starts, then the shade below the line takes over (same tint, same mask).
  `.eng-screen-off{opacity:${SCREEN_STANDBY};transition:opacity 240ms var(--ease-glow) 160ms}` +
  `${ON} .eng-screen-off{opacity:0;transition:opacity 0ms linear calc(var(--arrive-now) + ${T.scanDelay}ms)}` +
  `.eng-scan-shade{background:rgb(3 6 9);opacity:0;transition:opacity 240ms var(--ease-glow) 160ms}` +
  `${ON} .eng-scan-shade{opacity:${SCREEN_STANDBY};transition:opacity 0ms linear calc(var(--arrive-now) + ${T.scanDelay}ms)}` +
  `.eng-scan-band{opacity:0;transition:opacity 100ms linear}` +
  `${ON} .eng-scan-band{opacity:calc(min(1, var(--es) * 14) * min(1, (1 - var(--es)) * 7));transition:none}` +
  // The bars' caps, only while rising.
  `.eng-caps{opacity:0;transition:opacity 100ms linear}${ON} .eng-caps{opacity:1;transition:none}` +
  // Every bar risen: the masked chart gives way to the same images unmasked (a masked layer resamples sharp
  // edges a little differently), so the stable state draws exactly as the approved artwork. Leaving swaps back
  // at once, for the bars to sink.
  `[data-eng-swap="stable"]{visibility:hidden;transition:visibility 0s}[data-eng-swap="anim"]{visibility:visible;transition:visibility 0s}` +
  `${ON} [data-eng-swap="stable"]{visibility:visible;transition:visibility 0s linear calc(var(--arrive-now) + ${CHART_DONE}ms)}` +
  `${ON} [data-eng-swap="anim"]{visibility:hidden;transition:visibility 0s linear calc(var(--arrive-now) + ${CHART_DONE}ms)}` +
  // The strips' pulse rides each power front (it never runs while draining).
  `.eng-pulse{opacity:0}${ON} .eng-pulse{opacity:calc(min(1, var(--pw) * 12) * min(1, (1 - var(--pw)) * 10) * 0.9)}` +
  // The floor's share: the powered part over the standby part.
  `.eng-floor{opacity:calc(1 - var(--eng-standby, 0))}` +
  FLOOR_PARTS.map(
    (p, k) =>
      `.eng-floor[data-floor-part="${k}"]{--pw:0;transition:--pw ${p.off.dur}ms linear ${p.off.delay}ms}` +
      `${ON} .eng-floor[data-floor-part="${k}"]{--pw:1;transition:--pw ${p.on.dur}ms linear calc(var(--arrive-now) + ${p.on.delay}ms)}`,
  ).join("") +
  // Stable: a faint line up the chart's hologram every few seconds.
  `.eng-shimmer{opacity:0;transition:opacity 160ms linear}` +
  `${ON} .eng-shimmer{opacity:0.5;transition:opacity 300ms var(--ease-glow) calc(var(--arrive-now) + ${T.shimmerDelay}ms)}` +
  `@keyframes eng-shimmer{0%{transform:translateY(0)}24%,100%{transform:translateY(calc(var(--u) * ${-(C.h + 8)}))}}` +
  `${ON} .eng-shimmer-line{animation:eng-shimmer ${T.shimmerPeriod}ms cubic-bezier(0.4,0,0.6,1) calc(var(--arrive-now) + ${T.shimmerDelay}ms) infinite}` +
  // Reduced motion: the powered appearance, cross-faded; nothing travels.
  `@media (prefers-reduced-motion: reduce){` +
  // The chart cross-fades whole (no bar rises): its masks off, its strength on --ef; the display's bars come up
  // with the display (the standby overlay fades).
  `.eng-v2{transition:--ef 150ms ease!important}` +
  `.eng-screen-off{transition:opacity 150ms ease!important}` +
  `${ON} [data-eng-swap]{transition:visibility 0s linear 150ms!important}` +
  `.eng-scan-shade,.eng-scan-band,.eng-caps,.eng-pulse,.eng-shimmer,[data-eng="screen-bars"]{display:none}` +
  `:is([data-eng="chart"],[data-eng="chart-light"]){mask-image:none!important;-webkit-mask-image:none!important;opacity:calc(${CHART_STANDBY} + ${1 - CHART_STANDBY} * var(--ef))}` +
  `.eng-floor{mask-image:none!important;-webkit-mask-image:none!important;opacity:0!important;transition:opacity 150ms ease!important}` +
  `${ON} .eng-floor{opacity:calc(1 - var(--eng-standby, 0))!important}}`;

/** A full-frame image placed in a box (the box clips it). */
function Frame({ src, box, style }: { src: string; box: SceneRect; style?: CSSProperties }) {
  // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
  return <img src={src} alt="" draggable={false} data-gate="" className="absolute max-w-none select-none" style={{ ...partFrame(box), ...style }} />;
}

function Full({ src, name, add, swap }: { src: string; name: string; add?: boolean; swap?: "anim" | "stable" }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry
    <img
      src={src}
      alt=""
      draggable={false}
      data-gate=""
      data-eng={name}
      data-eng-swap={swap}
      className="pointer-events-none absolute inset-0 h-full w-full max-w-none select-none"
      style={add ? { mixBlendMode: "plus-lighter" } : undefined}
    />
  );
}

/**
 * The chart's mask, its layers from the top:
 *   reveals   each bar uncovered from its base up to --eb<k>, hard-edged (add)
 *   standby   the hologram's standby strength everywhere (add)
 *   glass     the panel's glass coming up with --ef, minus the bars' rects
 *             (subtract: it is the source, the rects below it the
 *             destination), so no bar brightens before its own turn
 *   rects     the bars' rects (only there to be subtracted), until every bar
 *             has risen (--ed): then gone, so the stable mask is uniformly
 *             opaque (no anti-aliased seam at a rect's edge): the chart exactly
 * `base: false` for the bars painted on the display: reveals only (their
 * standby is the display's own dimming underneath).
 */
function chartMask(base: boolean): CSSProperties {
  const level = (a: string) => `linear-gradient(rgb(0 0 0 / ${a}), rgb(0 0 0 / ${a}))`;
  const at = (b: SceneRect) => ({ size: `${u(b.w)} ${u(b.h)}`, position: `${u(b.x)} ${u(b.y)}` });
  const full = { size: "100% 100%", position: "0 0" };
  const layers = [
    ...ENG_BARS.map((b, k) => ({
      image: `linear-gradient(to top, #000 calc(var(${BAR_VARS[k]}) * 100%), transparent calc(var(${BAR_VARS[k]}) * 100%))`,
      ...at(b),
      op: "add",
      wk: "source-over",
    })),
    ...(base
      ? [
          { image: level(`${CHART_STANDBY}`), ...full, op: "add", wk: "source-over" },
          { image: level("var(--ef)"), ...full, op: "subtract", wk: "source-out" },
          ...ENG_BARS.map((b) => ({ image: level("calc(1 - var(--ed))"), ...at(b), op: "add", wk: "source-over" })),
        ]
      : []),
  ];
  const j = (k: "image" | "size" | "position" | "op" | "wk") => layers.map((l) => l[k]).join(", ");
  return {
    maskImage: j("image"),
    WebkitMaskImage: j("image"),
    maskSize: j("size"),
    WebkitMaskSize: j("size"),
    maskPosition: j("position"),
    WebkitMaskPosition: j("position"),
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskComposite: j("op"),
    WebkitMaskComposite: j("wk"),
  };
}

/**
 * The chart: solid (normal) or light (added); the masked element blends
 * itself. Full frame like the station image (a sub-box with a counter-offset
 * image snaps to the device grid differently: a fraction of a pixel's
 * resampling at every bar edge), the mask placed in scene px.
 */
function ChartLayer({ src, name, base, add }: { src: string; name: string; base: boolean; add?: boolean }) {
  return (
    <div data-eng={name} data-eng-swap="anim" className="absolute inset-0" style={{ ...chartMask(base), mixBlendMode: add ? "plus-lighter" : undefined }}>
      <Full src={src} name={`${name}-image`} />
    </div>
  );
}

/** The power pulse: the strips' own light, through a narrow window riding just behind the part's front. */
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
      className="lab-power eng-pulse pointer-events-none absolute overflow-hidden"
      style={{ ...box(p.box), clipPath: clip, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
    >
      <Frame src={`${M14H1}/engineering-strip-light.png`} box={p.box} />
    </div>
  );
}

/** The strips' pieces on the stone (the reflection part is the floor's: EngineeringFloor). */
const STRIP_PARTS = PLATFORM_POWER[ID].parts.flatMap((p, k) => (p.kind === "strip" ? [k] : []));

export function EngineeringV2() {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-station={ID} data-v2-station-source="approved" className="eng-v2 pointer-events-none absolute inset-0">
      <style>{ENG_CSS}</style>
      {/* The station: its body (the chart is its own layer) while anything moves; once every bar has risen, the
          recovered station itself (M1.4F.1's file), so the stable state draws exactly as before (two layers
          meeting at a pixel boundary resample a little differently from one). */}
      <Full src={`${M14H1}/engineering-body.png`} name="body" swap="anim" />
      <Full src={`${M14F1}/engineering.png`} name="station-stable" swap="stable" />
      <Full src={`${M14H1}/engineering-body-light.png`} name="body-light" add />
      <EngineeringFloor src={`${M14H1}/engineering-strip-floor.png`} name="strip-floor" standby={0} />
      {/* The strips: unpowered ahead of each front (PowerPart, the established fronts), a pulse riding it. */}
      {STRIP_PARTS.map((k) => (
        <PowerPart key={`off-${k}`} id={ID} index={k} side="dim">
          <Frame src={`${M14H1}/engineering-strip-off.png`} box={PLATFORM_POWER[ID].parts[k].box} />
        </PowerPart>
      ))}
      {STRIP_PARTS.map((k) => (
        <Pulse key={`pulse-${k}`} index={k} />
      ))}
      {/* The display: standby, then the scan's shade, then (above) the bars painted on it. */}
      <div
        data-eng="screen-off"
        className="eng-screen-off absolute inset-0"
        style={{ background: "rgb(3 6 9)", maskImage: `url(${M14H1}/engineering-screen-mask.png)`, WebkitMaskImage: `url(${M14H1}/engineering-screen-mask.png)`, maskSize: "100% 100%", WebkitMaskSize: "100% 100%" }}
      />
      <EngineeringScreenLayer kind="shade" />
      <ChartLayer src={`${M14H1}/engineering-screen-bars.png`} name="screen-bars" base={false} />
      <ChartLayer src={`${M14H1}/engineering-chart.png`} name="chart" base />
      <ChartLayer src={`${M14H1}/engineering-chart-light.png`} name="chart-light" base add />
      {/* Stable: the chart's glow unmasked (its solid part is in the station image below). */}
      <Full src={`${M14H1}/engineering-chart-light.png`} name="chart-light-stable" add swap="stable" />
      {/* Each bar's rising edge: a crisp cap, only while it moves. */}
      <div className="eng-caps absolute inset-0" style={{ mixBlendMode: "plus-lighter" }}>
        {ENG_BARS.map((b, k) => (
          <div key={k} className="absolute" style={box({ x: b.x + 1, y: b.y, w: b.w - 2, h: b.h })}>
            <span
              className="absolute inset-x-0"
              style={{
                bottom: `calc(var(${BAR_VARS[k]}) * 100%)`,
                height: u(1.2),
                background: "rgb(210 250 255 / 0.95)",
                opacity: `calc(min(1, var(${BAR_VARS[k]}) * 10) * min(1, (1 - var(${BAR_VARS[k]})) * 10))`,
              }}
            />
          </div>
        ))}
      </div>
      <EngineeringScreenLayer kind="band" />
      {/* Stable: a faint line up the hologram's own pixels (its mask is the chart layer). */}
      <div
        className="eng-shimmer absolute overflow-hidden"
        style={{
          ...box(C),
          mixBlendMode: "plus-lighter",
          maskImage: `url(${M14H1}/engineering-chart.png)`,
          WebkitMaskImage: `url(${M14H1}/engineering-chart.png)`,
          maskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
          WebkitMaskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
          maskPosition: `${u(-C.x)} ${u(-C.y)}`,
          WebkitMaskPosition: `${u(-C.x)} ${u(-C.y)}`,
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      >
        <span
          className="eng-shimmer-line absolute inset-x-0"
          style={{ top: "100%", height: u(6), background: "linear-gradient(180deg, rgb(150 235 255 / 0.9), rgb(80 200 255 / 0.25) 45%, transparent)" }}
        />
      </div>
    </div>
  );
}

/**
 * Light on the floor that follows Engineering's strips: faint at rest
 * (`standby`), the rest brought in by the strips' fronts (FLOOR_PARTS).
 *   floor        its share of M1.4G.1's floor light (ring, spill, reflections),
 *                on the floor under every station (SceneV2), standby 0.2
 *   strip-floor  the strips' own floor light (M1.4F.1), drawn with the station
 *                as before (above the contact shadow), standby 0
 */
export function EngineeringFloor({ src = `${M14H1}/engineering-floor.png`, name = "floor", standby = FLOOR_STANDBY }: { src?: string; name?: string; standby?: number }) {
  return (
    <div aria-hidden="true" data-zone={ID} data-v2-floor={`engineering-${name}`} className="pointer-events-none absolute inset-0">
      {standby > 0 ? (
        // plus-lighter on the fading element itself (its opacity would isolate a blended child)
        <div data-eng={`${name}-standby`} className="absolute inset-0" style={{ opacity: standby, mixBlendMode: "plus-lighter" }}>
          <Full src={src} name={name} />
        </div>
      ) : null}
      {FLOOR_PARTS.map((p, k) => {
        const front = `calc(var(--u) * ${p.d0} + var(--u) * ${p.span} * var(--pw))`;
        const behind = `calc(var(--u) * ${p.d0 - POWER_FRONT} + var(--u) * ${p.span} * var(--pw))`;
        const mask = `linear-gradient(-90deg, #000 ${behind}, transparent ${front})`;
        return (
          <div
            key={k}
            data-zone={ID}
            data-floor-part={k}
            className="eng-floor absolute overflow-hidden"
            style={{ ...box(p.box), ["--eng-standby" as string]: standby, maskImage: mask, WebkitMaskImage: mask, mixBlendMode: "plus-lighter" }}
          >
            <Frame src={src} box={p.box} />
          </div>
        );
      })}
    </div>
  );
}
