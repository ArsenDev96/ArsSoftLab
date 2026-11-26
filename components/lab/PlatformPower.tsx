import type { CSSProperties, ReactNode } from "react";
import { LAB_ZONES, type ZoneId } from "@/data/zones";
import { SCENE, u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { PLATFORM_POWER, POWER_FRONT } from "./platform-power";
import { MOVED_REFLECTIONS } from "./scene-25d";

/**
 * M1.3F / M1.3F.1 platform power: every station's amber platform strips are
 * part of the hover power sequence.
 *
 *   idle ──▶ energy travels from the A ──▶ reaches the platform (--arrive-now)
 *        ──▶ the strips light along their own paths ──▶ station active
 *
 * At rest an "unpowered" overlay (scripts/make-platform-power.mjs) shows each
 * platform's strips switched off: a crisp unlit fixture line where the
 * painted core is, the strip's light removed from the stone around it (its
 * texture kept), its floor reflection dimmed. Every changed pixel is opaque
 * at full resolution, so nothing is blurred.
 *
 * Each station's strips are pieces (a strip, a wrap, a side segment) that
 * the energy runs along in turn, starting where the connection reaches the
 * platform. Every polygon of a piece (a part) is clipped to itself and
 * uncovered by a narrow front moving along the piece: a linear-gradient mask
 * whose stop follows --pw (0 → 1). The hover light (StationLights, or a
 * lifted station's own light) is shown through the complementary mask, so
 * it lights exactly where the front has passed. Leaving runs the fronts
 * back, the farthest first: the strips drain toward the connection.
 *
 * Sustained state is CSS only (POWER_CSS): each part's --pw transitions with
 * the station's --arrive-now delay plus its place along the path, so leaving
 * before the energy arrives cancels natively and fast switching can't leave
 * strips lit. Reduced motion: no fronts, a short cross-fade.
 *
 * Lifted stations (Engineering, Playground): this static overlay sits under
 * the station layer, which covers it while lifted; the lift carries its own
 * copy (StationLayers), so the strips stay on the rising platform and are
 * never drawn twice.
 */

export const UNPOWERED = "/scene/power/unpowered.png";
export const UNPOWERED_LIFT = "/scene/power/unpowered-lift.png";
/** Hover light: the sharp core plus a restrained halo (white, alpha). */
export const POWER_LIGHT = "/scene/power/light.png";

const part = (id: ZoneId, k: number) => `.lab-power[data-power="${id}"][data-part="${k}"]`;

/** One station's part of POWER_CSS (M1.4H.1: /lab-v2 powers Engineering's recovered strips with it). */
/** Reduced motion: the unpowered overlay fades out while the station is lit. */
const powerReducedCss = (id: ZoneId) => `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"]) .lab-power-dim[data-power="${id}"]{opacity:0}`;

/**
 * M1.4K.4 / M1.4K.5A lite mode: reduced motion's strips for one station, whatever the preference (powerCss's rule and
 * globals.css's, for its parts): the unpowered overlay cross-fades away, unmasked, so no front spreads.
 */
export const powerLiteCss = (id: ZoneId): string =>
  powerReducedCss(id) + `.lab-power[data-power="${id}"]{mask-image:none!important;-webkit-mask-image:none!important;transition:opacity 150ms ease!important}`;

export function powerCss(id: ZoneId): string {
  const on = `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"])`;
  return (
    PLATFORM_POWER[id].parts
      .map(
        (p, k) =>
          `${part(id, k)}{transition:--pw ${p.off.dur}ms linear ${p.off.delay}ms}` +
          `${on} ${part(id, k)}{--pw:1;transition:--pw ${p.on.dur}ms linear calc(var(--arrive-now) + ${p.on.delay}ms)}`,
      )
      .join("") + `@media (prefers-reduced-motion: reduce){${powerReducedCss(id)}}`
  );
}

export const POWER_CSS = LAB_ZONES.map(({ id }) => powerCss(id)).join("");

/** Box `r` placed inside a container whose box starts at scene point `origin`. */
const rel = (r: SceneRect, origin: ScenePoint): CSSProperties => ({ left: u(r.x - origin.x), top: u(r.y - origin.y), width: u(r.w), height: u(r.h) });

/** Placement of a full-frame image (the plate's exact rect) inside a part's box. */
export const partFrame = (box: SceneRect): CSSProperties => ({ left: u(-box.x), top: u(-box.y), width: u(SCENE.width), height: u(SCENE.height) });

/**
 * M1.3I: a part's box widened by `pad` px up and down (an independent
 * reflection layer covers more than the strip's own polygon).
 */
export const partBox = (box: SceneRect, pad = 0): SceneRect => (pad ? { x: box.x, y: box.y - pad, w: box.w, h: box.h + 2 * pad } : box);

/**
 * One part of a station's strips: clipped to its polygon, and masked to the
 * unpowered side ("dim") or the powered side ("powered") of its front.
 * M1.3I: with `pad`, its box is widened up and down and not clipped (the
 * front is the same: its angle is near vertical, so the box's height hardly
 * moves it).
 */
export function PowerPart({
  id,
  index,
  side,
  origin = { x: 0, y: 0 },
  pad = 0,
  className = "",
  children,
}: {
  id: ZoneId;
  index: number;
  side: "dim" | "powered";
  origin?: ScenePoint;
  pad?: number;
  className?: string;
  children: ReactNode;
}) {
  const p = PLATFORM_POWER[id].parts[index];
  const box = partBox(p.box, pad);
  const at = (offset: number) => `calc(var(--u) * ${+offset.toFixed(2)} + var(--u) * ${p.span} * var(--pw))`;
  const front = at(p.f0);
  const behind = at(p.f0 - POWER_FRONT);
  const mask = `linear-gradient(${p.angle}deg, ${side === "powered" ? `#000 ${behind}, transparent ${front}` : `transparent ${behind}, #000 ${front}`})`;
  const clip = `polygon(${p.poly.map(([x, y]) => `calc(var(--u) * ${x}) calc(var(--u) * ${y})`).join(", ")})`;
  return (
    <div
      aria-hidden="true"
      data-zone={id}
      data-power={id}
      data-part={index}
      className={`lab-power ${side === "dim" ? "lab-power-dim" : "lab-power-on"} pointer-events-none absolute overflow-hidden${className && ` ${className}`}`}
      style={{ ...rel(box, origin), clipPath: pad ? undefined : clip, maskImage: mask, WebkitMaskImage: mask }}
    >
      {children}
    </div>
  );
}

/** Every platform's unpowered strips, at the plate's position (directly over the plate). */
export function PlatformPower() {
  return (
    <>
      <style>{POWER_CSS}</style>
      {LAB_ZONES.flatMap(({ id }) =>
        PLATFORM_POWER[id].parts.map((p, k) =>
          // M1.3I (experimental): a reflection drawn as its own moving layer (StationReflections).
          MOVED_REFLECTIONS.has(`${id}:${k}`) ? null : (
            <PowerPart key={`${id}-${k}`} id={id} index={k} side="dim">
              {/* eslint-disable-next-line @next/next/no-img-element -- full-frame overlay at the plate's geometry */}
              <img src={UNPOWERED} alt="" draggable={false} data-gate="" className="absolute max-w-none select-none" style={partFrame(p.box)} />
            </PowerPart>
          ),
        ),
      )}
    </>
  );
}
