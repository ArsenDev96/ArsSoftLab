import type { ZoneId } from "@/data/zones";
import { partBox, partFrame, PowerPart } from "./PlatformPower";
import { PLATFORM_POWER } from "./platform-power";
import { LAB_LAYERED, SCENE_25D } from "./scene-25d";
import { ENVIRONMENT_CORRECTIONS } from "./scene-25d-data";

/**
 * M1.3I (LAB_LAYERED only): the static environment corrections and the
 * stations' floor reflections. Both sit in the plate layer, above the plate
 * and the unpowered platform strips, below the station layers.
 */

/**
 * The plate with every connection line and Playground's strip reflection
 * removed from the floor (opaque where changed, full frame, so it lands on
 * the plate's own pixels). Gated like the plate: never shown before the line
 * layers that cover it have decoded.
 */
export function EnvironmentCorrections() {
  if (!LAB_LAYERED) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- full-frame correction at the plate's geometry
    <img src={ENVIRONMENT_CORRECTIONS} alt="" draggable={false} data-gate="" aria-hidden="true" className="lab-environment pointer-events-none absolute inset-0 h-full w-full max-w-none select-none" />
  );
}

/**
 * A station's platform-light reflection on the floor, as its own layer: the
 * unpowered and powered reflection (solved over the reflection-free floor),
 * uncovered by the same power front as the strip (PowerPart). The wrapper
 * follows the lift (--lp, globals.css): a mirror image of a light above a
 * glossy floor drops as the light rises, and fades a little with distance.
 */
export function StationReflections() {
  if (!LAB_LAYERED) return null;
  return (
    <>
      {(Object.entries(SCENE_25D) as [ZoneId, (typeof SCENE_25D)[ZoneId]][]).map(([id, s]) => {
        if (!s.reflection) return null;
        const p = PLATFORM_POWER[id].parts[s.reflection.part];
        return (
          <div
            key={id}
            aria-hidden="true"
            data-zone={id}
            data-reflection={id}
            className="lab-reflection pointer-events-none absolute inset-0"
            style={{ ["--refl-drop" as string]: (s.lift ?? 0) * (s.reflectionDrop ?? 1), ["--refl-fade" as string]: s.reflectionFade ?? 0 }}
          >
            {(["dim", "powered"] as const).map((side) => (
              <PowerPart key={side} id={id} index={s.reflection!.part} side={side} pad={s.reflection!.pad}>
                {/* eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the plate's geometry */}
                <img src={side === "dim" ? s.reflection!.dim : s.reflection!.lit} alt="" draggable={false} data-gate="" className="absolute max-w-none select-none" style={partFrame(partBox(p.box, s.reflection!.pad))} />
              </PowerPart>
            ))}
          </div>
        );
      })}
    </>
  );
}

