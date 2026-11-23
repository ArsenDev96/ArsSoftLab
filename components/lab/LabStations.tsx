"use client";

import { LAB_ZONES, type ZoneId } from "@/data/zones";
import { sceneRect } from "@/lib/scene";
import { useLabState } from "./LabState";
import { ProjectStation } from "./ProjectStation";
import { hotspotBox, hotspotClip, STATION_LAYOUT, type HotspotShape } from "./scene-layout";

/** A hotspot's two outlines, on the lift's own timing (globals.css, .lab-lift). */
const liftClipCss = (id: ZoneId, { rest, raised }: HotspotShape): string => {
  const b = hotspotBox([...rest, ...raised]);
  const el = `[data-hotspot="${id}"]`;
  return (
    `${el}{clip-path:${hotspotClip(rest, b)}}` +
    `@media (prefers-reduced-motion: no-preference){${el}{transition:clip-path 420ms var(--ease-lift-out)}` +
    `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"]) ${el}{clip-path:${hotspotClip(raised, b)};transition:clip-path 450ms var(--ease-heavy) var(--arrive-now)}}`
  );
};

/**
 * Interactive station layer: platform hotspots plus the HTML labels.
 *
 * Hotspots are pointer affordances over the 3D objects, clipped to a polygon
 * around each station so they never overlap one another. Keyboard and
 * screen-reader users reach the same actions through each station's title
 * button. Hover lighting is pure CSS (data-lab-hover), so this component
 * only re-renders when the selection changes.
 *
 * M1.4I.1C: `hotspots` (/lab-v2) replaces a station's outline with one that
 * follows its lift. It is still one element, so moving within the station
 * never leaves it.
 */
export function LabStations({ hideIcons = [], hotspots = {} }: { hideIcons?: readonly ZoneId[]; hotspots?: Partial<Record<ZoneId, HotspotShape>> } = {}) {
  const { station, project, hover, selectStation, toggleStation, toggleProject } = useLabState();

  return (
    <div id="lab-stations" className="absolute inset-0">
      {/* Compositing anchor: an always-transparent screen-blend layer. Up to
          M1.2.2 the hotspot glows carried mix-blend-mode, which makes Chrome
          render this layer as a separate blended surface; the chips'
          backdrop blur was approved looking through that path. Without it
          the chip interiors shift by up to 5/255. Nothing is painted. */}
      <div aria-hidden="true" data-compositing-anchor className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen" />
      {Object.entries(hotspots).map(([id, shape]) => (
        <style key={id}>{liftClipCss(id as ZoneId, shape)}</style>
      ))}
      {LAB_ZONES.map((zone) => {
        const shape = STATION_LAYOUT[zone.id].hotspot;
        const own = hotspots[zone.id];
        return (
          <div
            key={`${zone.id}-hotspot`}
            aria-hidden="true"
            data-hotspot={zone.id}
            data-zone={zone.id}
            className="absolute cursor-pointer"
            style={own ? sceneRect(hotspotBox([...own.rest, ...own.raised])) : { ...sceneRect(hotspotBox(shape)), clipPath: hotspotClip(shape) }}
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
          showIcon={!hideIcons.includes(zone.id)}
        />
      ))}
    </div>
  );
}
