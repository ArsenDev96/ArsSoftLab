"use client";

import { Fragment } from "react";
import { LAB_ZONES, type ZoneId } from "@/data/zones";
import { sceneRect, type ScenePoint } from "@/lib/scene";
import { useLabState } from "./LabState";
import { ProjectStation } from "./ProjectStation";
import { hasStationLayer, hotspotBox, hotspotClip, STATION_LAYOUT, type HotspotShape } from "./scene-layout";

/** A hotspot's outline between its two, at its station's own lift number. */
const followClipCss = (id: ZoneId, { rest, raised }: HotspotShape, v: string): string => {
  const b = hotspotBox([...rest, ...raised]);
  const pct = (n: number, size: number) => +((n / size) * 100).toFixed(3);
  const at = (from: number, to: number, o: number, size: number) =>
    from === to ? `${pct(from - o, size)}%` : `calc(${pct(from - o, size)}% + ${pct(to - from, size)}% * var(${v}))`;
  const points = rest.map((p, i) => `${at(p.x, raised[i].x, b.x, b.w)} ${at(p.y, raised[i].y, b.y, b.h)}`);
  return `[data-hotspot="${id}"]{clip-path:polygon(${points.join(", ")})}`;
};

/** A hotspot's two outlines, on the lift's own timing (globals.css, .lab-lift). */
const liftClipCss = (id: ZoneId, { rest, raised, on = "450ms var(--ease-heavy) var(--arrive-now)", off = "420ms var(--ease-lift-out)" }: HotspotShape): string => {
  const b = hotspotBox([...rest, ...raised]);
  const el = `[data-hotspot="${id}"]`;
  return (
    `${el}{clip-path:${hotspotClip(rest, b)}}` +
    `@media (prefers-reduced-motion: no-preference){${el}{transition:clip-path ${off}}` +
    `:is([data-lab-hover="${id}"],[data-lab-selected="${id}"]) ${el}{clip-path:${hotspotClip(raised, b)};transition:clip-path ${on}}}`
  );
};

/**
 * M1.4I.1E: a bridge takes the pointer only while its own station is hovered
 * (the 90 ms grace included). Not when that hover is keyboard focus: a pointer
 * resting there must not take the station over from the keyboard.
 */
const bridgeCss = (id: ZoneId): string =>
  `[data-bridge="${id}"]{pointer-events:none}` +
  `[data-lab-hover="${id}"] #lab-stations:not(:has([data-station="${id}"] :focus-visible)) [data-bridge="${id}"]{pointer-events:auto}`;

/**
 * M1.4I.1E: a label that lifts away from a still pointer. The title or chip
 * under the pointer keeps the strip it rises out of (18 px, x1.01), so its
 * hover and click stay its own. Only while it is hovered: approaching from
 * below there is nothing under the visible chip.
 *
 * M1.4I.2.1: a chip is a pill, and beside its round ends a strip below its box
 * leaves a notch that the rise carries across the pointer. Its strip starts at
 * its middle instead and is round like it, so together they are the pill along
 * its way; 1 px more on the left, where the x1.01 moves it off the pointer.
 */
const LABEL_RISE = 20;
/** Half a chip's height (ProjectStation). */
const CHIP_RADIUS = 13;
const risingLabelCss = (id: ZoneId): string => {
  const label = `[data-lab-hover="${id}"]:not([data-lab-selected="${id}"]) #lab-stations [data-lift="${id}"]`;
  const px = (n: number) => `calc(var(--u) * ${n})`;
  return (
    `@media (prefers-reduced-motion: no-preference){` +
    `${label} button:hover::after{content:"";position:absolute;left:0;right:0;top:100%;height:${px(LABEL_RISE)}}` +
    `${label} .lab-chip:hover::after{left:${px(-1)};top:50%;height:calc(50% + ${px(LABEL_RISE)});border-radius:0 0 ${px(CHIP_RADIUS)} ${px(CHIP_RADIUS)}}}`
  );
};

interface LabStationsProps {
  hideIcons?: readonly ZoneId[];
  hotspots?: Partial<Record<ZoneId, HotspotShape>>;
  /** Space between a station's platform and label that keeps its hover (never starts it). */
  bridges?: Partial<Record<ZoneId, readonly ScenePoint[]>>;
  /** Stations whose label doesn't follow the lift, because their platform has none. */
  stillLabels?: readonly ZoneId[];
}

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
 *
 * M1.4I.1E: `bridges` (/lab-v2) lie under every hotspot and label; see
 * station-bridges-v2.ts.
 */
export function LabStations({ hideIcons = [], hotspots = {}, bridges = {}, stillLabels = [] }: LabStationsProps = {}) {
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
        <style key={id}>{shape.follows ? followClipCss(id as ZoneId, shape, shape.follows.v) : liftClipCss(id as ZoneId, shape)}</style>
      ))}
      {(Object.entries(bridges) as [ZoneId, readonly ScenePoint[]][]).map(([id, shape]) => (
        <Fragment key={`${id}-bridge`}>
          <style>{bridgeCss(id) + (hasStationLayer(id) && !stillLabels.includes(id) ? risingLabelCss(id) : "")}</style>
          <div
            aria-hidden="true"
            data-bridge={id}
            className="absolute"
            style={{ ...sceneRect(hotspotBox(shape)), clipPath: hotspotClip(shape) }}
            onPointerEnter={() => hover("pointer", id, true)}
            onPointerLeave={() => hover("pointer", id, false)}
          />
        </Fragment>
      ))}
      {LAB_ZONES.map((zone) => {
        const shape = STATION_LAYOUT[zone.id].hotspot;
        const own = hotspots[zone.id];
        const hotspot = (
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
        const lift = own?.follows?.cls;
        return lift ? (
          <div key={`${zone.id}-hotspot`} data-zone={zone.id} className={`${lift}-lift-cycle contents`}>
            <div data-zone={zone.id} className={`${lift}-lift contents`}>
              {hotspot}
            </div>
          </div>
        ) : (
          hotspot
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
          lifts={!stillLabels.includes(zone.id)}
        />
      ))}
    </div>
  );
}
