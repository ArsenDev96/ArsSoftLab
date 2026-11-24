"use client";

import { useEffect, useRef, useState, type TransitionEvent } from "react";
import { getProject, type ProjectId } from "@/data/projects";
import type { LabZone } from "@/data/zones";
import { CAP_INSET, scenePoint, u } from "@/lib/scene";
import { stationPanelId, stationTriggerId, type HoverSource } from "./LabState";
import { STATION_LAYERS, type StationLayout } from "./scene-layout";
import { StationIcon } from "./StationIcon";

export interface ProjectStationProps {
  zone: LabZone;
  layout: StationLayout;
  /** This is the selected station (camera shot + hero info open). */
  selected: boolean;
  /** Selected project, when it belongs to this station. */
  selectedProject: ProjectId | null;
  onToggle: () => void;
  onSelectProject: (id: ProjectId) => void;
  onHover: (source: HoverSource, on: boolean) => void;
  /** M1.4E.3: false leaves the floating icon out (/lab-v2 Playground, whose cabinet carries its own). */
  showIcon?: boolean;
  /** M1.4I.1E: false keeps the label still where its platform doesn't lift (/lab-v2 Engineering). */
  lifts?: boolean;
}

/**
 * One lab station label: icon, title and project chips, anchored to the
 * station's measured position in the reference frame.
 *
 * The title is the station's toggle (selects it, or returns to the lab when
 * it is already selected); the chips select a project directly. Hover and
 * selection styling comes from CSS via data-zone (see zoneStateCss).
 */
export function ProjectStation({
  zone,
  layout,
  selected,
  selectedProject,
  onToggle,
  onSelectProject,
  onHover,
  showIcon = true,
  lifts = true,
}: ProjectStationProps) {
  const titleId = `station-${zone.id}-title`;
  const listId = `station-${zone.id}-projects`;
  const { chips } = layout;
  // Labels of a layered station ride the same transform as its cut-out,
  // with the origin re-expressed relative to the label anchor.
  const layer = lifts ? STATION_LAYERS[zone.id] : undefined;

  // Chrome workaround (layered stations only). A chip (backdrop-filter) that
  // repaints while its lifted label is transformed, e.g. its hover colour or
  // its selected state, keeps that stale raster after the label settles
  // back: the text stays ~2 px off until something re-creates the chip. So
  // once the lift has fully returned, the chip list is re-mounted (one
  // render, no visual change) and keyboard focus is put back if a chip had
  // it.
  const [chipsGen, setChipsGen] = useState(0);
  const chipsRef = useRef<HTMLUListElement>(null);
  const refocus = useRef(-1);
  useEffect(() => {
    if (refocus.current < 0) return;
    chipsRef.current?.querySelectorAll("button")[refocus.current]?.focus({ preventScroll: true });
    refocus.current = -1;
  }, [chipsGen]);
  const onLiftEnd = (e: TransitionEvent<HTMLElement>) => {
    if (!layer || e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (getComputedStyle(e.currentTarget).transform !== "none") return;
    refocus.current = [...(chipsRef.current?.querySelectorAll("button") ?? [])].indexOf(document.activeElement as HTMLButtonElement);
    setChipsGen((g) => g + 1);
  };

  return (
    <section
      id={`station-${zone.id}`}
      aria-labelledby={titleId}
      data-station={zone.id}
      data-zone={zone.id}
      data-depth={layout.depth}
      data-selected={selected || undefined}
      data-lift={layer ? zone.id : undefined}
      className={`lab-station absolute${layer ? " lab-lift" : ""}`}
      style={{
        ...scenePoint(layout.label),
        ...(layer && {
          transformOrigin: `${u(layer.origin.x - layout.label.x)} ${u(layer.origin.y - layout.label.y)}`,
        }),
      }}
      onPointerEnter={() => onHover("pointer", true)}
      onPointerLeave={() => onHover("pointer", false)}
      // Keyboard focus anywhere in the label lights the station (not after
      // mouse clicks, which don't match :focus-visible).
      onFocus={(e) => e.target.matches(":focus-visible") && onHover("keyboard", true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onHover("keyboard", false);
      }}
      onTransitionEnd={onLiftEnd}
    >
      {showIcon ? (
        <span
          aria-hidden="true"
          className="lab-station-icon absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ left: u(layout.iconOffset.x), top: u(layout.iconOffset.y) }}
        >
          <StationIcon name={zone.icon} accent={zone.accent} />
        </span>
      ) : null}

      <h2 id={titleId} className="m-0 leading-none" style={{ fontSize: u(layout.titleSize) }}>
        <button
          id={stationTriggerId(zone.id)}
          type="button"
          aria-expanded={selected}
          aria-controls={stationPanelId(zone.id)}
          onClick={onToggle}
          className={[
            "lab-station-title lab-copy-shadow lab-transition block cursor-pointer rounded-md font-[460] whitespace-nowrap",
            selected ? "text-amber-glow" : "text-lab-text",
          ].join(" ")}
          style={{ marginTop: u(-CAP_INSET * layout.titleSize), lineHeight: 1 }}
        >
          {zone.title}
        </button>
      </h2>

      <ul
        key={chipsGen}
        ref={chipsRef}
        id={listId}
        aria-label={`${zone.title} projects`}
        className="absolute flex"
        style={{ left: u(chips.x), top: u(chips.y), gap: u(chips.gap) }}
      >
        {zone.projects.map((id) => {
          const project = getProject(id);
          const pressed = selectedProject === id;
          return (
            <li key={id}>
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => onSelectProject(id)}
                className={[
                  "lab-chip lab-transition flex cursor-pointer items-center rounded-full font-[380] whitespace-nowrap",
                  pressed ? "text-amber-glow" : "text-lab-text hover:text-amber-glow",
                ].join(" ")}
                style={{
                  height: u(26),
                  paddingInline: u(chips.padX),
                  fontSize: u(chips.size),
                  lineHeight: 1,
                }}
              >
                {project.name}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
