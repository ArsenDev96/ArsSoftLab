"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { getProject, projectSummary, type ProjectId } from "@/data/projects";
import { getZone, type ZoneId } from "@/data/zones";
import { u } from "@/lib/scene";
import { HeroRule } from "./HeroRule";
import { stationPanelId, useLabState } from "./LabState";

/**
 * Station information shown in the hero heading slot while the station is
 * selected. Same typography and amber rule as the hero, no card: it replaces
 * the heading rather than floating over the scene. Every station has one;
 * only the selected station's panel is visible (the others are inert).
 */
export function StationPanel({ zoneId }: { zoneId: ZoneId }) {
  const { station, project, toggleProject, backToLab } = useLabState();
  const zone = getZone(zoneId);
  const open = station === zoneId;
  const selected = open ? project : null;
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Opening moves focus to the heading, so keyboard and screen-reader users
  // land on the new information (switching stations moves it again). A
  // panel that is already open on load (a deep link) leaves focus alone:
  // only a change from closed to open moves it.
  const wasOpen = useRef(open);
  useEffect(() => {
    if (open && !wasOpen.current) headingRef.current?.focus({ preventScroll: true });
    wasOpen.current = open;
  }, [open]);

  const id = stationPanelId(zoneId);
  const detailId = `${id}-project`;

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      data-station-panel={zoneId}
      data-open={open || undefined}
      inert={!open}
      className="lab-station-info absolute top-0 left-0"
      style={{ width: u(430) }}
    >
      <h2
        ref={headingRef}
        id={`${id}-title`}
        tabIndex={-1}
        className="font-[390] text-lab-heading outline-none"
        style={{ fontSize: u(40.5), lineHeight: u(43.5), letterSpacing: u(-0.1) }}
      >
        {zone.title}
      </h2>

      <p className="text-lab-muted" style={{ fontSize: u(18), lineHeight: u(26), marginTop: u(8) }}>
        {zone.summary}
      </p>

      <h3 className="sr-only">{zone.projects.length > 1 ? "Projects" : "Project"}</h3>
      {/* Project names, then (once one is chosen) its Open project action on
          the same row; its sentence goes underneath. Keeping the action up
          here keeps the hero's lower rows narrow, clear of in-scene labels
          under every camera shot. */}
      <div className="flex flex-wrap items-center" style={{ marginTop: u(8), columnGap: u(16), rowGap: u(6) }}>
        <ul className="flex items-center" style={{ fontSize: u(16.5) }}>
          {zone.projects.map((pid, i) => (
            <Fragment key={pid}>
              {i > 0 ? (
                <li aria-hidden="true" className="text-amber" style={{ paddingInline: u(6) }}>
                  ·
                </li>
              ) : null}
              <li>
                <button
                  type="button"
                  aria-pressed={selected === pid}
                  aria-controls={detailId}
                  onClick={() => toggleProject(pid)}
                  className="lab-hero-project lab-transition pointer-events-auto cursor-pointer rounded-md font-[440] whitespace-nowrap text-lab-text hover:text-amber-glow"
                  style={{ paddingBlock: u(4), paddingInline: u(4), marginInline: u(-4) }}
                >
                  {getProject(pid).name}
                </button>
              </li>
            </Fragment>
          ))}
        </ul>
        {selected ? <OpenProject key={selected} id={selected} /> : null}
      </div>

      <div id={detailId}>
        {selected ? (
          <p
            key={selected}
            data-project-detail={selected}
            className="lab-project-detail text-lab-muted"
            style={{ marginTop: u(6), maxWidth: u(380), fontSize: u(15), lineHeight: u(20) }}
          >
            {projectSummary(selected)}
          </p>
        ) : null}
      </div>

      <HeroRule marginTop={14} />

      <button
        type="button"
        onClick={backToLab}
        aria-keyshortcuts="Escape"
        className="lab-transition pointer-events-auto flex cursor-pointer items-center rounded-md text-lab-muted hover:text-amber-glow"
        style={{ marginTop: u(12), gap: u(10), fontSize: u(15) }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ width: u(18), height: u(18) }}
        >
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
        Back to Lab
        <kbd
          className="rounded font-sans text-lab-subtle"
          style={{ fontSize: u(11.5), padding: `${u(1)} ${u(6)}`, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.14)" }}
        >
          Esc
        </kbd>
      </button>
    </section>
  );
}

/**
 * Open project for the selected project. With no destination yet it says so
 * plainly instead of linking anywhere: it stays focusable (aria-disabled,
 * not disabled) so the "coming soon" state can be discovered, and
 * activating it repeats that in words.
 */
function OpenProject({ id }: { id: ProjectId }) {
  const project = getProject(id);
  const [notice, setNotice] = useState("");
  const soonId = `project-${id}-soon`;

  const label = (
    <>
      Open project<span className="sr-only"> {project.name}</span>
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: u(15), height: u(15) }}
      >
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </>
  );
  const style = { gap: u(6), fontSize: u(14) };

  return (
    <div data-open-row={id} className="lab-project-detail flex items-center" style={{ gap: u(8) }}>
      <span aria-hidden="true" className="block bg-white/20" style={{ width: 1, height: u(14), marginRight: u(4) }} />
      {project.href ? (
        <a href={project.href} className="lab-transition pointer-events-auto flex items-center rounded-md whitespace-nowrap text-amber-glow hover:text-lab-text" style={style}>
          {label}
        </a>
      ) : (
        <>
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={soonId}
            data-open-project={id}
            onClick={() => setNotice(`The ${project.name} project page is coming soon.`)}
            className="pointer-events-auto flex cursor-not-allowed items-center rounded-md whitespace-nowrap text-lab-subtle"
            style={style}
          >
            {label}
          </button>
          <span
            id={soonId}
            className="rounded-full whitespace-nowrap text-lab-muted"
            style={{ fontSize: u(11.5), padding: `${u(1)} ${u(7)}`, boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.16)" }}
          >
            <span className="sr-only">Project page </span>Coming soon
          </span>
        </>
      )}
      <span aria-live="polite" className="sr-only">
        {notice}
      </span>
    </div>
  );
}
