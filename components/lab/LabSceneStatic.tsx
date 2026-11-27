import type { ZoneId } from "@/data/zones";
import { SCENE, u, type SceneRect } from "@/lib/scene";
import { CREATIVE_HOTSPOT_V2 } from "./CreativeLift";
import { EDUCATIONAL_HOTSPOT_V2 } from "./EducationalLift";
import { ENGINEERING_HOTSPOT_V2 } from "./EngineeringLift";
import { EXPERIENCE_HOTSPOT_V2 } from "./ExperienceLift";
import { FocusVignette } from "./LabCamera";
import { LabStations } from "./LabStations";
import { PLAYGROUND_HOTSPOT_V2 } from "./playground-sign-v2";
import type { HotspotShape } from "./scene-layout";
import { SceneLayer } from "./SceneLayer";
import { STATION_BRIDGES_V2 } from "./station-bridges-v2";
import MANIFEST from "./static-lite-manifest.json";

/**
 * Lite mode (`/lab-v2?render=lite`): the laboratory flattened (docs/performance/STATIC-LITE-INTEGRATION.md).
 *
 * The resting scene (environment, floor, five stations, hub, connections and foreground, about 60 layers in the
 * layered scene) is one image, and each station's powered state is one small sprite: only the pixels its power
 * changes, cropped to their box (7-15 % of the frame). Both are baked from the layered Lite scene
 * (scripts/static-lite/); the plate plus a sprite gives that scene's powered frame exactly. Their checksums, boxes and
 * sources are in static-lite-manifest.json, and `node scripts/static-lite/check.mjs` reports when they are stale.
 *
 * Everything interactive stays live HTML on top, unchanged: the stations' hit regions (their rest outlines: nothing
 * lifts), bridges, labels, project chips, keyboard handling, the hero and the URL. A sprite shows while its station is
 * hovered, focused or selected, at once (no cross-fade). The focus vignette still marks a selection, without its fade.
 * No camera move, lift, spark or animated light. One floor: the untoned one (`floor` has no effect here).
 */
const STATIC = "/scene/static-lite";
const STATIONS: readonly ZoneId[] = ["engineering", "educational", "playground", "creative", "experience"];

/** Each sprite's box in scene px, as baked. */
const POWER = Object.fromEntries(
  STATIONS.map((id) => [id, (MANIFEST.assets as Record<string, { box?: SceneRect }>)[`on-${id}.webp`].box as SceneRect]),
) as Record<ZoneId, SceneRect>;

/** The rest outline only, as nothing lifts. */
const rest = ({ rest }: HotspotShape): HotspotShape => ({ rest, raised: rest });
const HOTSPOTS: Record<ZoneId, HotspotShape> = {
  engineering: rest(ENGINEERING_HOTSPOT_V2),
  educational: rest(EDUCATIONAL_HOTSPOT_V2),
  playground: rest(PLAYGROUND_HOTSPOT_V2),
  creative: rest(CREATIVE_HOTSPOT_V2),
  experience: rest(EXPERIENCE_HOTSPOT_V2),
};

const STATIC_CSS =
  // On while hovered, focused or selected (LabState's per-station numbers), with no transition.
  ".lab-static-power{opacity:max(var(--zone-hover),var(--zone-selected))}" +
  // Immediate feedback: no fades in the stage (vignette, labels, titles, icons, chips).
  '[data-lite-renderer="static"] :is(.lab-focus-vignette,.lab-station,.lab-station-title,.lab-station-icon,.lab-chip){transition:none!important}';

export function LabSceneStatic() {
  return (
    <div
      data-lab-render="lite"
      data-lite-renderer="static"
      className="absolute overflow-hidden"
      style={{
        ["--u" as string]: "var(--su)",
        // Centred by layout, not by LabScene's translate(-50%): with an odd height (941) that is a half pixel the layout
        // snaps and the transform doesn't, which would draw the whole plate half a pixel off (and so softened).
        left: `calc(50% - var(--su) * ${SCENE.width / 2})`,
        top: `calc(50% - var(--su) * ${SCENE.height / 2})`,
        width: `calc(var(--su) * ${SCENE.width})`,
        height: `calc(var(--su) * ${SCENE.height})`,
      }}
    >
      <style>{STATIC_CSS}</style>
      {/* eslint-disable-next-line @next/next/no-img-element -- the flattened scene at its own geometry */}
      <img
        src={`${STATIC}/plate.webp`}
        alt="A cinematic stone laboratory at dusk: snow-capped mountains through tall arched windows, five stone platforms arranged around a glowing A monogram."
        width={SCENE.width}
        height={SCENE.height}
        fetchPriority="high"
        draggable={false}
        className="absolute inset-0 h-full w-full max-w-none select-none"
      />
      {STATIONS.map((id) => {
        const b = POWER[id];
        return (
          // eslint-disable-next-line @next/next/no-img-element -- a station's powered pixels, placed in scene px
          <img
            key={id}
            src={`${STATIC}/on-${id}.webp`}
            alt=""
            aria-hidden="true"
            width={b.w}
            height={b.h}
            draggable={false}
            data-zone={id}
            data-static-power={id}
            className="lab-static-power pointer-events-none absolute max-w-none select-none"
            style={{ left: u(b.x), top: u(b.y), width: u(b.w), height: u(b.h) }}
          />
        );
      })}
      <FocusVignette />
      <SceneLayer name="stations" depth={0.5} className="z-10">
        <LabStations hideIcons={["playground"]} hotspots={HOTSPOTS} bridges={STATION_BRIDGES_V2} stillLabels={STATIONS} />
      </SceneLayer>
    </div>
  );
}
