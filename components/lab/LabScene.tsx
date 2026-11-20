import Image from "next/image";
import { SCENE } from "@/lib/scene";
import { EnergyFlow } from "./EnergyFlow";
import { GlobeOrbit } from "./GlobeOrbit";
import { FocusVignette, LabCamera } from "./LabCamera";
import { LabStations } from "./LabStations";
import { SceneLayer } from "./SceneLayer";
import { StationLayers } from "./StationLayers";
import { StationLights } from "./StationLights";

/**
 * The 2.5D lab stage.
 *
 * A fixed 1672 x 941 frame (the reference's own pixel space) scaled to cover
 * the viewport. Back to front:
 *
 *   camera (moves as one; identity transform at rest)
 *     1. plate     – the environment render with baked UI removed, plus
 *                    stations cut out as independent layers (M1.2.2:
 *                    Engineering only; see StationLayers)
 *     2. lights    – static masked lights for hover / selection (platform
 *                    strips, connection lines); transparent at rest
 *     3. fx        – masked light animations (energy lines, globe orbit)
 *     4. vignette  – darkens the room around the selected station
 *     5. stations  – hotspots and HTML labels for the five stations
 *
 * Station information is shown in the hero slot (LabHero), outside the stage,
 * so it is never scaled by the camera.
 */
export function LabScene() {
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
        <SceneLayer name="plate" depth={0}>
          <Image
            src="/scene/lab-plate.webp"
            alt="A cinematic stone laboratory at dusk: snow-capped mountains through tall arched windows, five lit stone platforms arranged around a glowing A monogram."
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover select-none"
            draggable={false}
          />
          <StationLayers />
        </SceneLayer>

        <SceneLayer name="lights" depth={0.3}>
          <StationLights />
        </SceneLayer>

        <SceneLayer name="fx" depth={0.4}>
          <EnergyFlow />
          <GlobeOrbit />
        </SceneLayer>

        <FocusVignette />

        <SceneLayer name="stations" depth={0.5} className="z-10">
          <LabStations />
        </SceneLayer>
      </LabCamera>
    </div>
  );
}
