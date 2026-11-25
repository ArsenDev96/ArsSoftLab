import Image from "next/image";
import { SCENE } from "@/lib/scene";
import { ChargeLines } from "./ChargeLine";
import { CREATIVE_HOTSPOT_V2 } from "./CreativeLift";
import { EDUCATIONAL_HOTSPOT_V2 } from "./EducationalLift";
import { ENGINEERING_HOTSPOT_V2 } from "./EngineeringLift";
import { EnergySurge } from "./EnergySurge";
import { EXPERIENCE_HOTSPOT_V2 } from "./ExperienceLift";
import { surgeStations } from "./scene-fx";
import { hasStationLayer } from "./scene-layout";
import { StationActivation } from "./StationActivation";
import { GlobeOrbit } from "./GlobeOrbit";
import { FocusVignette, LabCamera } from "./LabCamera";
import { LabStations } from "./LabStations";
import { PlateGate } from "./PlateGate";
import { PLAYGROUND_HOTSPOT_V2 } from "./playground-sign-v2";
import { PlatformPower } from "./PlatformPower";
import { EnvironmentCorrections, StationReflections } from "./SceneDepth";
import { SCENE_IMAGE_CSS } from "./SceneImage";
import { SceneLayer } from "./SceneLayer";
import { STATION_BRIDGES_V2 } from "./station-bridges-v2";
import { StationLayers } from "./StationLayers";
import { StationLights } from "./StationLights";
import { SceneV2 } from "./SceneV2";

/**
 * The 2.5D lab stage.
 *
 * A fixed 1672 x 941 frame (the reference's own pixel space) scaled to cover
 * the viewport. Back to front:
 *
 *   camera (moves as one; identity transform at rest)
 *     1. plate     – the environment render with baked UI removed, plus
 *                    stations cut out as independent layers (Engineering,
 *                    M1.2.2; Playground, M1.3E.1; see StationLayers)
 *     2. lights    – static masked lights for hover / selection (platform
 *                    strips, connection lines); transparent at rest
 *                    and M1.3C station activation overlays
 *     3. fx        – masked light animations (globe orbit, M1.3C hover
 *                    pulse). M1.3E.1: no ambient energy on the lines at
 *                    rest; energy only travels when a station is hovered.
 *     4. vignette  – darkens the room around the selected station
 *     5. stations  – hotspots and HTML labels for the five stations
 *
 * Station information is shown in the hero slot (LabHero), outside the stage,
 * so it is never scaled by the camera.
 */
export function LabScene({ variant = "plate", floorTone = false }: { variant?: "plate" | "v2"; floorTone?: boolean }) {
  if (variant === "v2") return <LabSceneV2 floorTone={floorTone} />;
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
      style={{
        // One reference pixel at cover scale.
        ["--u" as string]: "var(--su)",
        width: `calc(var(--su) * ${SCENE.width})`,
        height: `calc(var(--su) * ${SCENE.height})`,
      }}
    >
      <LabCamera>
        {/* M1.3F.1 / M1.3G: the plate and the lights appear together, once
            the plate and the unpowered strips and lines have decoded
            (PlateGate), so nothing flashes powered on load. */}
        <SceneLayer name="plate" depth={0} className="lab-plate-gate">
          <Image
            data-gate=""
            src="/scene/lab-plate.webp"
            alt="A cinematic stone laboratory at dusk: snow-capped mountains through tall arched windows, five lit stone platforms arranged around a glowing A monogram."
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover select-none"
            draggable={false}
          />
          {/* M1.3I (experimental): the floor without lines or Playground's
              strip reflection; those are their own layers. */}
          <EnvironmentCorrections />
          {/* M1.3F: platform strips unpowered at rest, lit by the energy. */}
          <PlatformPower />
          <StationLayers />
          {/* M1.3J.2: the strip reflection lies on the floor above a layered
              station's background, so the switch at arrival doesn't hide its
              top rows (renders nothing outside the experimental build). */}
          <StationReflections />
        </SceneLayer>

        <SceneLayer name="lights" depth={0.3} className="lab-plate-gate">
          {/* M1.3E.1: unpowered lines at rest, charged on hover. */}
          <ChargeLines />
          <StationLights />
          {/* M1.3C activation overlays for stations that don't lift (a
              lifted station carries its own, see StationLayers). */}
          {surgeStations
            .filter((id) => !hasStationLayer(id))
            .map((id) => (
              <StationActivation key={id} id={id} />
            ))}
        </SceneLayer>
        {/* After both gated layers, so it sees every gated image. */}
        <PlateGate />

        <SceneLayer name="fx" depth={0.4}>
          <GlobeOrbit />
          <EnergySurge />
        </SceneLayer>

        <FocusVignette />

        <SceneLayer name="stations" depth={0.5} className="z-10">
          <LabStations />
        </SceneLayer>
      </LabCamera>
    </div>
  );
}

/**
 * M1.4D (experimental, /lab-v2 only): the same stage, camera, hotspots,
 * labels, energy timing and Playground lift, over the independent v2 layers
 * (SceneV2) instead of the plate. Left out, because they are rasters or masks
 * of the approved plate and would paint its stations back over the new ones:
 * environment corrections, platform strips (PlatformPower), StationLayers,
 * reflections, StationLights, the activation glows and GlobeOrbit. The
 * connections keep their accurate routes, drawn as vectors.
 */
function LabSceneV2({ floorTone }: { floorTone: boolean }) {
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
      style={{
        ["--u" as string]: "var(--su)",
        width: `calc(var(--su) * ${SCENE.width})`,
        height: `calc(var(--su) * ${SCENE.height})`,
      }}
    >
      <style>{SCENE_IMAGE_CSS}</style>
      <LabCamera>
        <SceneLayer name="plate" depth={0} className="lab-plate-gate">
          <SceneV2 floorTone={floorTone} />
        </SceneLayer>
        <SceneLayer name="lights" depth={0.3} className="lab-plate-gate">
          <ChargeLines variant="v2" />
        </SceneLayer>
        <PlateGate svgImages />
        <SceneLayer name="fx" depth={0.4}>
          <EnergySurge variant="v2" />
        </SceneLayer>
        <FocusVignette />
        <SceneLayer name="stations" depth={0.5} className="z-10">
          {/* M1.4E.3: no floating gamepad over the v2 cabinet's marquee. */}
          {/* M1.4I.1C: Playground's target includes the v2 cabinet's sign. */}
          {/* M1.4I.1E: hover holds between platform and label. Engineering's label stays where it is. */}
          {/* M1.4J: Engineering's, Educational's, Creative Studio's and Experience's targets follow their lifts. */}
          <LabStations hideIcons={["playground"]} hotspots={{ playground: PLAYGROUND_HOTSPOT_V2, engineering: ENGINEERING_HOTSPOT_V2, educational: EDUCATIONAL_HOTSPOT_V2, creative: CREATIVE_HOTSPOT_V2, experience: EXPERIENCE_HOTSPOT_V2 }} bridges={STATION_BRIDGES_V2} stillLabels={["engineering"]} />
        </SceneLayer>
      </LabCamera>
    </div>
  );
}
