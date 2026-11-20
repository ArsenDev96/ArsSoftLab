"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getProject, projectSummary, type ProjectId } from "@/data/projects";
import { getZone, LAB_ZONES, type ZoneId } from "@/data/zones";

/**
 * Lab interaction state (M1.3A), shared by the scene, the camera and the
 * hero slot.
 *
 *   lab        nothing selected; hover / keyboard focus only light a station
 *   station    one station selected (camera shot, hero shows its info),
 *              optionally with one of *its* projects selected
 *   returning  Back to Lab / Escape / re-selecting the station: selection is
 *              cleared and the camera eases home; lasts until it has settled
 *
 * Selection lives in one reducer, so incompatible states can't be expressed:
 * there is at most one station, and the project always belongs to it.
 *
 * Re-render budget: all continuous motion is CSS. Selection changes re-render
 * the components that read this context (only on clicks and keys). Hover and
 * keyboard focus are not part of the context at all: they are written to
 * `data-lab-hover` on the wrapper and every visual response is CSS (see
 * zoneStateCss), so pointer movement over the scene re-renders nothing but
 * this provider's own wrapper.
 */

export type HoverSource = "pointer" | "keyboard";

interface Selection {
  station: ZoneId | null;
  project: ProjectId | null;
  /** Station the lab is returning from, until the camera has settled. */
  returning: ZoneId | null;
}

type Action =
  | { type: "select"; station: ZoneId; project?: ProjectId | null }
  | { type: "toggle"; station: ZoneId }
  | { type: "project"; project: ProjectId }
  | { type: "back" }
  | { type: "returned" };

const LAB: Selection = { station: null, project: null, returning: null };

export function labReducer(s: Selection, a: Action): Selection {
  switch (a.type) {
    case "select": {
      const project = a.project && getProject(a.project).zone === a.station ? a.project : null;
      if (s.station === a.station && s.project === project) return s;
      return { station: a.station, project, returning: null };
    }
    case "toggle":
      return s.station === a.station ? labReducer(s, { type: "back" }) : { station: a.station, project: null, returning: null };
    case "project": {
      const zone = getProject(a.project).zone;
      if (s.station !== zone) return { station: zone, project: a.project, returning: null };
      return { ...s, project: s.project === a.project ? null : a.project };
    }
    case "back":
      return s.station ? { ...LAB, returning: s.station } : s;
    case "returned":
      return s.returning ? { ...s, returning: null } : s;
  }
}

interface LabActions {
  /** Select a station (switching from another one if needed). */
  selectStation: (id: ZoneId, project?: ProjectId | null) => void;
  /** Station title: selects it, or returns to the lab if it is already selected. */
  toggleStation: (id: ZoneId) => void;
  /** Select a project (and its station), or clear it if already selected. */
  toggleProject: (id: ProjectId) => void;
  backToLab: () => void;
  /** Light (`on`) or release a station for pointer hover or keyboard focus. */
  hover: (source: HoverSource, id: ZoneId, on: boolean) => void;
}

interface LabStateValue extends Selection, LabActions {}

const LabStateContext = createContext<LabStateValue | null>(null);

export function useLabState(): LabStateValue {
  const ctx = useContext(LabStateContext);
  if (!ctx) throw new Error("useLabState must be used inside <LabStateProvider>");
  return ctx;
}

export const stationTriggerId = (id: ZoneId) => `station-${id}-trigger`;
export const stationPanelId = (id: ZoneId) => `station-${id}-panel`;

/** Camera ease-out (globals.css .lab-camera) plus a little slack. */
const RETURN_MS = 760;

/**
 * Per-station state as CSS custom properties, generated from the zone list so
 * a new station needs no CSS edits. Elements opt in with data-zone="<id>"
 * (energy tracks already carry data-connection="<id>"):
 *   --zone-hover     1 while the station is hovered or keyboard-focused
 *   --zone-selected  1 while it is the selected station
 * Defaults (0) and the derived --zone-other live in globals.css.
 */
const ZONE_STATE_CSS = LAB_ZONES.map(({ id }) => {
  const own = `:is([data-zone="${id}"],[data-connection="${id}"])`;
  return `[data-lab-hover="${id}"] ${own}{--zone-hover:1}[data-lab-selected="${id}"] ${own}{--zone-selected:1}`;
}).join("");

export function LabStateProvider({ children }: { children: ReactNode }) {
  const [sel, dispatch] = useReducer(labReducer, LAB);
  const [pointer, setPointer] = useState<ZoneId | null>(null);
  const [keyboard, setKeyboard] = useState<ZoneId | null>(null);
  const shown = useRef<ZoneId | null>(null);

  const actions = useMemo<LabActions>(
    () => ({
      selectStation: (station, project) => dispatch({ type: "select", station, project }),
      toggleStation: (station) => dispatch({ type: "toggle", station }),
      toggleProject: (project) => dispatch({ type: "project", project }),
      backToLab: () => dispatch({ type: "back" }),
      hover: (source, id, on) => {
        const set = source === "pointer" ? setPointer : setKeyboard;
        // Leaving only clears this station, so moving between a station's
        // hotspot and its label (or to another station) never flickers.
        set((cur) => (on ? id : cur === id ? null : cur));
      },
    }),
    [],
  );

  // Escape returns to the lab from anywhere while a station is selected.
  useEffect(() => {
    if (!sel.station) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) {
        e.preventDefault();
        dispatch({ type: "back" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel.station]);

  // Focus: the station panel focuses its own heading when it opens (see
  // StationPanel). On return, focus goes back to the station's trigger if it
  // was inside the hero panels or would otherwise be lost to <body>.
  useEffect(() => {
    const was = shown.current;
    shown.current = sel.station;
    if (sel.station || !was) return;
    const active = document.activeElement;
    if (!active || active === document.body || active.closest("[data-station-panel]")) {
      document.getElementById(stationTriggerId(was))?.focus({ preventScroll: true });
    }
  }, [sel.station]);

  // "returning" ends once the camera has eased home.
  useEffect(() => {
    if (!sel.returning) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => dispatch({ type: "returned" }), reduced ? 200 : RETURN_MS);
    return () => window.clearTimeout(t);
  }, [sel.returning]);

  const announcement = sel.station
    ? sel.project
      ? `${getProject(sel.project).name} selected. ${projectSummary(sel.project)}`
      : `${getZone(sel.station).title} selected. ${getZone(sel.station).summary} Press Escape or Back to Lab to return.`
    : sel.returning
      ? "Back in the lab."
      : "";

  const value = useMemo(() => ({ ...sel, ...actions }), [sel, actions]);
  const hovered = pointer ?? keyboard;

  return (
    <LabStateContext.Provider value={value}>
      <style>{ZONE_STATE_CSS}</style>
      {/* The lab's interaction state as data attributes: all visual
          responses to hover and selection are CSS keyed off these. */}
      <div
        data-lab-hover={hovered ?? undefined}
        data-lab-selected={sel.station ?? undefined}
        data-lab-project={sel.project ?? undefined}
        data-lab-returning={sel.returning ?? undefined}
        className="contents"
      >
        {children}
      </div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </LabStateContext.Provider>
  );
}
