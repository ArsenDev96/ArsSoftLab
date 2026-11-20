import type { CSSProperties } from "react";
import { SCENE, sceneRect, u, type SceneRect } from "@/lib/scene";

/**
 * Travelling light through pixel masks of light that already exists in the
 * plate (see scripts/make-scene-masks.py).
 *
 * A soft gradient "blob" moves along a track using transform-only keyframes
 * that contain no var()/calc(), so Chrome can run them on the compositor
 * (no per-frame style, layout or paint). Position is split across two
 * wrappers so percentages resolve against the effect box:
 *   x-wrapper: box width, zero height   → translateX(% of box width)
 *   y-wrapper: zero width, box height   → translateY(% of box height)
 *   blob:      rotate(deg) around its own centre
 * The blob sits inside a container masked by the line/ring pixels, so the
 * exact visible shape comes from the artwork; the track only needs to stay
 * within a few px of it.
 *
 * Two passes per effect:
 *   halo – larger, fainter blob through a pre-blurred mask (soft bloom)
 *   core – brighter blob through the crisp mask
 *
 * Masked containers cover only the effect's bounding box to keep the
 * compositing area small.
 */

export interface Waypoint {
  /** Keyframe offset, 0–100. */
  at: number;
  x: number;
  y: number;
  /** Blob orientation in degrees (along the track). */
  rot: number;
}

export interface LightTrack {
  key: string;
  waypoints: Waypoint[];
}

export interface LightPass {
  name: "halo" | "core";
  mask: string;
  /** Blob size in reference px (length along the track × thickness). */
  w: number;
  h: number;
  /** Peak colour, already including intensity (alpha). */
  color: string;
}

const pct = (n: number) => `${+n.toFixed(3)}%`;
const num = (n: number) => +n.toFixed(2);

export function MaskedLight({
  id,
  className,
  box,
  durationS,
  passes,
  tracks,
  zone,
}: {
  id: string;
  className: string;
  /** Station the effect belongs to (data-zone), for per-station CSS state. */
  zone?: string;
  /** Bounding box of every track (reference px). */
  box: SceneRect;
  durationS: number;
  passes: LightPass[];
  tracks: LightTrack[];
}) {
  // Keyframes are generated once per track; positions are % of `box`.
  const keyframes = tracks
    .map((t) => {
      const frames = (fn: (w: Waypoint) => string) => t.waypoints.map((w) => `${pct(w.at)}{transform:${fn(w)}}`).join("");
      return [
        `@keyframes ${id}-${t.key}-x{${frames((w) => `translateX(${pct(((w.x - box.x) / box.w) * 100)})`)}}`,
        `@keyframes ${id}-${t.key}-y{${frames((w) => `translateY(${pct(((w.y - box.y) / box.h) * 100)})`)}}`,
        `@keyframes ${id}-${t.key}-r{${frames((w) => `rotate(${num(w.rot)}deg)`)}}`,
      ].join("");
    })
    .join("");
  const anim = (name: string) => `${name} ${durationS}s linear infinite`;

  const maskStyle: CSSProperties = {
    maskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
    maskPosition: `${u(-box.x)} ${u(-box.y)}`,
    maskRepeat: "no-repeat",
  };

  return (
    <div aria-hidden="true" data-fx={id} data-zone={zone} className={`lab-fx ${className} pointer-events-none absolute`} style={sceneRect(box)}>
      <style>{keyframes}</style>
      {passes.map((p) => (
        <div
          key={p.name}
          data-pass={p.name}
          className="absolute inset-0"
          style={{ ...maskStyle, maskImage: `url(${p.mask})`, WebkitMaskImage: `url(${p.mask})` }}
        >
          {tracks.map((t) => (
            <span
              key={t.key}
              data-connection={t.key}
              className="lab-track absolute top-0 left-0 h-0 w-full"
              style={{ animation: anim(`${id}-${t.key}-x`) }}
            >
              <span className="lab-track absolute top-0 left-0 h-full w-0" style={{ height: u(box.h), animation: anim(`${id}-${t.key}-y`) }}>
                <span
                  className="lab-track lab-blob absolute top-0 left-0"
                  style={{
                    width: u(p.w),
                    height: u(p.h),
                    marginLeft: u(-p.w / 2),
                    marginTop: u(-p.h / 2),
                    background: `radial-gradient(closest-side, ${p.color}, transparent)`,
                    animation: anim(`${id}-${t.key}-r`),
                  }}
                />
              </span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
