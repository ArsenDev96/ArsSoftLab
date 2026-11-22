"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getProject, projectSummary, type ProjectId } from "@/data/projects";
import { getZone, LAB_ZONES, type ZoneId } from "@/data/zones";
import { LAB_HOME, labSearch, locationFromSearch, sameLocation, type LabLocation } from "@/lib/lab-url";

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
 * URL (M1.3B part 2): the reducer stays the single source of truth and the
 * address bar mirrors it (`?station=…&project=…`, see lib/lab-url.ts).
 *   initial      the server resolves the query and passes it as `initial`,
 *                so a deep link renders in its state from the first byte
 *   state → URL  after a selection change, push one entry, but only if the
 *                address bar disagrees. Hover, focus and "returning" are
 *                not in the URL, so they never touch history.
 *   URL → state  popstate (Back / Forward) dispatches "restore"; the
 *                address bar then already agrees, so nothing is pushed
 *                back and there is no loop to guard against.
 *   invalid      a non-canonical query is rewritten in place
 *                (replaceState), never as a new entry.
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
  | { type: "returned" }
  /** Back / Forward: adopt the selection the URL now shows. */
  | { type: "restore"; station: ZoneId | null; project: ProjectId | null };

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
    case "restore":
      return a.station
        ? labReducer(s, { type: "select", station: a.station, project: a.project })
        : labReducer(s, { type: "back" });
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
  /**
   * Subscribe to the effective hovered station (with the selection), without
   * re-rendering: for imperative effects such as the M1.3C hover pulse.
   * Returns the unsubscribe function.
   */
  onHoverChange: (fn: HoverListener) => () => void;
}

export type HoverListener = (hovered: ZoneId | null, selected: ZoneId | null) => void;

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
 * A station stays hovered this long after the pointer (or focus) leaves it.
 * Crossing from a platform to its own label, or from title to chip, passes
 * through a gap; without the grace the M1.3C activation would restart. Any
 * other station taking over cancels it at once.
 */
const HOVER_GRACE_MS = 90;

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

const initSelection = (loc: LabLocation): Selection =>
  loc.station ? labReducer(LAB, { type: "select", station: loc.station, project: loc.project }) : LAB;

/** Rewrite a non-canonical lab query in place (no new history entry). */
function canonicalizeUrl() {
  const { pathname, search, hash } = window.location;
  const canonical = labSearch(locationFromSearch(search), search);
  if (canonical !== search) window.history.replaceState(window.history.state, "", pathname + canonical + hash);
}

export function LabStateProvider({ children, initial = LAB_HOME }: { children: ReactNode; initial?: LabLocation }) {
  const [sel, dispatch] = useReducer(labReducer, initial, initSelection);
  const [pointer, setPointer] = useState<ZoneId | null>(null);
  const [keyboard, setKeyboard] = useState<ZoneId | null>(null);
  const shown = useRef<ZoneId | null>(sel.station);
  const leaveTimers = useRef<Partial<Record<HoverSource, number>>>({});
  const hoverListeners = useRef(new Set<HoverListener>());

  const actions = useMemo<LabActions>(
    () => ({
      selectStation: (station, project) => dispatch({ type: "select", station, project }),
      toggleStation: (station) => dispatch({ type: "toggle", station }),
      toggleProject: (project) => dispatch({ type: "project", project }),
      backToLab: () => dispatch({ type: "back" }),
      hover: (source, id, on) => {
        const set = source === "pointer" ? setPointer : setKeyboard;
        window.clearTimeout(leaveTimers.current[source]);
        if (on) {
          set(id);
          return;
        }
        // Leaving only clears this station (after the grace), so moving
        // between a station's hotspot and its label, or on to another
        // station, never flickers or restarts its activation.
        leaveTimers.current[source] = window.setTimeout(() => set((cur) => (cur === id ? null : cur)), HOVER_GRACE_MS);
      },
      onHoverChange: (fn) => {
        hoverListeners.current.add(fn);
        return () => hoverListeners.current.delete(fn);
      },
    }),
    [],
  );
  useEffect(() => {
    const timers = leaveTimers.current;
    return () => Object.values(timers).forEach((t) => window.clearTimeout(t));
  }, []);

  // URL → state: tidy the address on load, follow Back / Forward.
  useEffect(() => {
    canonicalizeUrl();
    const onPop = () => {
      canonicalizeUrl();
      dispatch({ type: "restore", ...locationFromSearch(window.location.search) });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // State → URL: one entry per selection the address bar doesn't show yet.
  // Initial and restored selections already match it, so they push nothing.
  useEffect(() => {
    const want = { station: sel.station, project: sel.project };
    const { pathname, search } = window.location;
    if (sameLocation(locationFromSearch(search), want)) return;
    window.history.pushState(null, "", pathname + labSearch(want, search));
  }, [sel.station, sel.project]);

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

  // Hover listeners run in the same frame the hover attribute is committed,
  // so imperative effects start together with the CSS transitions.
  useLayoutEffect(() => {
    hoverListeners.current.forEach((fn) => fn(hovered, sel.station));
  }, [hovered, sel.station]);

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
