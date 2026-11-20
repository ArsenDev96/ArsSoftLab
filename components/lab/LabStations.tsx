"use client";

import { LAB_ZONES } from "@/data/zones";
import { sceneRect } from "@/lib/scene";
import { useLabState } from "./LabState";
import { ProjectStation } from "./ProjectStation";
import { hotspotBox, hotspotClip, STATION_LAYOUT } from "./scene-layout";

/**
 * Interactive station layer: platform hotspots plus the HTML labels.
 *
 * Hotspots are pointer affordances over the 3D objects, clipped to a polygon
 * around each station so they never overlap one another. Keyboard and
 * screen-reader users reach the same actions through each station's title
 * button. Hover lighting is pure CSS (data-lab-hover), so this component
 * only re-renders when the selection changes.
 */
export function LabStations() {
  const { station, project, hover, selectStation, toggleStation, toggleProject } = useLabState();

  return (
    <div id="lab-stations" className="absolute inset-0">
      {/* Compositing anchor: an always-transparent screen-blend layer. Up to
          M1.2.2 the hotspot glows carried mix-blend-mode, which makes Chrome
          render this layer as a separate blended surface; the chips'
          backdrop blur was approved looking through that path. Without it
          the chip interiors shift by up to 5/255. Nothing is painted. */}
      <div aria-hidden="true" data-compositing-anchor className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen" />
      {LAB_ZONES.map((zone) => {
        const shape = STATION_LAYOUT[zone.id].hotspot;
        return (
          <div
            key={`${zone.id}-hotspot`}
            aria-hidden="true"
            data-hotspot={zone.id}
            data-zone={zone.id}
            className="absolute cursor-pointer"
            style={{ ...sceneRect(hotspotBox(shape)), clipPath: hotspotClip(shape) }}
            onPointerEnter={() => hover("pointer", zone.id, true)}
            onPointerLeave={() => hover("pointer", zone.id, false)}
            // Clicking the selected station's platform keeps it selected; its
            // title button (or Back to Lab / Escape) returns to the lab.
            onClick={() => selectStation(zone.id)}
          />
        );
      })}

      {LAB_ZONES.map((zone) => (
        <ProjectStation
          key={zone.id}
          zone={zone}
          layout={STATION_LAYOUT[zone.id]}
          selected={station === zone.id}
          selectedProject={station === zone.id ? project : null}
          onHover={(source, on) => hover(source, zone.id, on)}
          onToggle={() => toggleStation(zone.id)}
          onSelectProject={toggleProject}
        />
      ))}
    </div>
  );
}
