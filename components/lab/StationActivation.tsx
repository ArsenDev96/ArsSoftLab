import type { CSSProperties } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, u, type ScenePoint, type SceneRect } from "@/lib/scene";
import { ArcadeScreen } from "./ArcadeScreen";
import { ACTIVATION } from "./scene-fx";

/**
 * M1.3C / M1.3D station activation overlays, all transparent at rest:
 *
 *   glow    a brighter copy of the station's own glowing pixels (screens,
 *           neon, glass, painting, path) plus their bloom; fades in after the
 *           hover pulse arrives and stays (timing: ACTIVATION_CSS).
 *   flare   the same image again, briefly raised on arrival by the
 *           EnergySurge controller (the arrival response), then gone. Same
 *           URL, so no extra decode.
 *   scan    a one-shot light band swept through a mask of the surface.
 *   travel  a highlight that follows a painted path (Experience), masked
 *           to the path's own pixels.
 *   game    a miniature game on a screen (Playground, M1.3E): see
 *           ArcadeScreen.
 *
 * `origin` is the scene position of the containing box: (0, 0) in a
 * full-frame scene layer, or the layer box when the overlays ride a lifted
 * station (Engineering), so they move with it.
 */
export function StationActivation({ id, origin = { x: 0, y: 0 } }: { id: ZoneId; origin?: ScenePoint }) {
  const spec = ACTIVATION[id];
  if (!spec) return null;
  const { box, scan, travel, game } = spec;
  const rel = (r: SceneRect) => ({ left: u(r.x - origin.x), top: u(r.y - origin.y), width: u(r.w), height: u(r.h) });
  const frame = { left: u(-box.x), top: u(-box.y), width: u(SCENE.width), height: u(SCENE.height) };
  /** A box inside `box`, showing the full-frame `mask` at its scene position. */
  const maskedBox = (r: SceneRect, mask: string): CSSProperties => ({
    left: u(r.x - box.x),
    top: u(r.y - box.y),
    width: u(r.w),
    height: u(r.h),
    maskImage: `url(${mask})`,
    WebkitMaskImage: `url(${mask})`,
    maskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
    WebkitMaskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
    maskPosition: `${u(-r.x)} ${u(-r.y)}`,
    WebkitMaskPosition: `${u(-r.x)} ${u(-r.y)}`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  });

  return (
    <div aria-hidden="true" data-zone={id} className="lab-activation pointer-events-none absolute overflow-hidden" style={rel(box)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- full-frame overlay at the plate's geometry */}
      <img src={spec.glow} alt="" draggable={false} className="lab-activation-glow absolute max-w-none select-none" style={frame} />
      {spec.flare.glow > 0 ? (
        // eslint-disable-next-line @next/next/no-img-element -- arrival flare, same image
        <img src={spec.glow} alt="" draggable={false} data-flare={id} className="absolute max-w-none opacity-0 select-none" style={frame} />
      ) : null}

      {scan ? (
        <div className="absolute overflow-hidden" style={maskedBox(scan.rect, scan.mask)}>
          <span
            data-scan-band={id}
            className="lab-scan-band absolute"
            style={
              scan.direction === "right"
                ? {
                    left: 0,
                    top: "-25%",
                    width: "34%",
                    height: "150%",
                    opacity: 0,
                    rotate: `${scan.tilt ?? 0}deg`,
                    background: `linear-gradient(90deg, transparent, ${scan.color} 50%, transparent)`,
                  }
                : {
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "40%",
                    opacity: 0,
                    background: `linear-gradient(180deg, transparent, ${scan.color} 50%, transparent)`,
                  }
            }
          />
        </div>
      ) : null}

      {travel ? (
        <>
          {[
            { name: "halo", mask: travel.glowMask, head: [46, 30, "rgb(255 206 130 / 0.95)"], tail: [70, 20, "rgb(255 186 100 / 0.55)"] },
            { name: "core", mask: travel.mask, head: [26, 12, "rgb(255 252 236 / 1)"], tail: [64, 10, "rgb(255 236 196 / 0.8)"] },
          ].map((p) => (
            <div key={p.name} className="absolute" style={maskedBox(box, p.mask)}>
              <div data-path-mover={id} className="lab-track absolute inset-0">
                {/* Comet: head at the origin, tail behind it; rotated to the path. */}
                <div data-path-comet={id} className="absolute top-0 left-0 h-0 w-0 opacity-0">
                  <span
                    className="absolute"
                    style={{
                      left: u(-(p.tail[0] as number)),
                      top: u(-(p.tail[1] as number) / 2),
                      width: u(p.tail[0] as number),
                      height: u(p.tail[1] as number),
                      background: `linear-gradient(90deg, transparent, ${p.tail[2]})`,
                    }}
                  />
                  <span
                    className="absolute"
                    style={{
                      left: u(-(p.head[0] as number) / 2),
                      top: u(-(p.head[1] as number) / 2),
                      width: u(p.head[0] as number),
                      height: u(p.head[1] as number),
                      background: `radial-gradient(closest-side, ${p.head[2]}, transparent)`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </>
      ) : null}

      {game ? <ArcadeScreen id={id} quad={game.quad} box={box} /> : null}
    </div>
  );
}
