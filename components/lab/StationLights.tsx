import type { CSSProperties } from "react";
import { LAB_ZONES } from "@/data/zones";
import { SCENE, sceneRect, u, type SceneRect } from "@/lib/scene";
import { hasStationLayer } from "./scene-layout";
import { CONNECTION_LIGHTS, PLATFORM_LIGHTS } from "./scene-fx";

/**
 * M1.3A station lighting, all static and opacity-only (fully transparent at
 * rest, so the idle lab is untouched):
 *
 *   platform lights   – brighten each platform's own amber strips while the
 *                       station is hovered or selected, through one shared
 *                       mask of those strips (scripts/make-scene-masks.py).
 *                       Stations with an independent layer (Engineering)
 *                       use their layer's light instead, which moves with
 *                       the lift.
 *   connection lights – brighten a station's existing amber line to the
 *                       central A, through the same masks as the energy
 *                       pulses. No new geometry: they can only brighten
 *                       pixels that already glow.
 *
 * Opacity comes from the per-station CSS variables (see LabState), so none
 * of this re-renders on hover.
 */

const PLATFORM_MASK = "/scene/masks/platforms.png";
const CONNECTION_PASSES = [
  { name: "halo", mask: "/scene/masks/connections-glow.png", color: "rgb(255 186 105 / 0.55)" },
  { name: "core", mask: "/scene/masks/connections.png", color: "rgb(255 238 205 / 0.8)" },
] as const;

/** A box showing the full-frame mask's pixels at their scene position. */
function masked(box: SceneRect, mask: string): CSSProperties {
  return {
    maskImage: `url(${mask})`,
    WebkitMaskImage: `url(${mask})`,
    maskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
    WebkitMaskSize: `${u(SCENE.width)} ${u(SCENE.height)}`,
    maskPosition: `${u(-box.x)} ${u(-box.y)}`,
    WebkitMaskPosition: `${u(-box.x)} ${u(-box.y)}`,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
  };
}

export function StationLights() {
  return (
    <>
      {LAB_ZONES.filter((z) => !hasStationLayer(z.id)).map(({ id }) => {
        const box = PLATFORM_LIGHTS[id];
        return (
          <div
            key={`platform-${id}`}
            aria-hidden="true"
            data-zone={id}
            data-platform-light={id}
            className="lab-platform-light pointer-events-none absolute"
            style={{ ...sceneRect(box), ...masked(box, PLATFORM_MASK), background: "rgb(255 208 150)" }}
          />
        );
      })}
      {CONNECTION_LIGHTS.map(({ id, box }) => (
        <div
          key={`connection-${id}`}
          aria-hidden="true"
          data-zone={id}
          data-connection-light={id}
          className="lab-connection-light pointer-events-none absolute"
          style={sceneRect(box)}
        >
          {CONNECTION_PASSES.map((p) => (
            <div key={p.name} className="absolute inset-0" style={{ ...masked(box, p.mask), background: p.color }} />
          ))}
        </div>
      ))}
    </>
  );
}
