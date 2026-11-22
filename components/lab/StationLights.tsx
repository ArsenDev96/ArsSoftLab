import type { CSSProperties } from "react";
import { LAB_ZONES } from "@/data/zones";
import { SCENE, sceneRect, u, type SceneRect } from "@/lib/scene";
import { POWER_LIGHT, PowerPart } from "./PlatformPower";
import { PLATFORM_POWER } from "./platform-power";
import { hasStationLayer } from "./scene-layout";
import { CONNECTION_LIGHTS, isCinematic } from "./scene-fx";

/**
 * M1.3A station lighting, all static and opacity-only (fully transparent at
 * rest, so the idle lab is untouched):
 *
 *   platform lights   – brighten each platform's own amber strips while the
 *                       station is hovered or selected. M1.3F.1: through a
 *                       sharp, full-resolution mask of the strips' cores and
 *                       a restrained halo (scripts/make-platform-power.mjs),
 *                       piece by piece, only where the energy has passed
 *                       (PlatformPower). Stations with an independent layer
 *                       use the same light on their lift (StationLayers).
 *   connection lights – brighten a station's existing amber line to the
 *                       central A, through the same masks as the energy
 *                       pulses. No new geometry: they can only brighten
 *                       pixels that already glow.
 *
 * Opacity comes from the per-station CSS variables (see LabState), so none
 * of this re-renders on hover.
 */

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
      {LAB_ZONES.filter((z) => !hasStationLayer(z.id)).flatMap(({ id }) =>
        PLATFORM_POWER[id].parts.map((p, k) => {
          if (p.kind !== "strip") return null;
          const style = { ...masked(p.box, POWER_LIGHT), background: "rgb(255 208 150)" };
          return (
            // M1.3F: lit only where the energy has passed (PlatformPower).
            <PowerPart key={`platform-${id}-${k}`} id={id} index={k} side="powered">
              <div
                aria-hidden="true"
                data-zone={id}
                data-platform-light={id}
                data-cinematic={isCinematic(id) || undefined}
                className="lab-platform-light pointer-events-none absolute inset-0"
                style={style}
              />
              {/* M1.3D arrival response: raised briefly by EnergySurge. */}
              {isCinematic(id) ? (
                <div aria-hidden="true" data-flare={id} data-flare-kind="platform" className="pointer-events-none absolute inset-0 opacity-0" style={style} />
              ) : null}
            </PowerPart>
          );
        }),
      )}
      {CONNECTION_LIGHTS.map(({ id, box }) => (
        <div
          key={`connection-${id}`}
          aria-hidden="true"
          data-zone={id}
          data-connection-light={id}
          data-cinematic={isCinematic(id) || undefined}
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
