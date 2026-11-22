import type { ProjectId } from "@/data/projects";
import { LAB_ZONES, type ZoneId } from "@/data/zones";

/**
 * Lab selection <-> URL query (M1.3B part 2).
 *
 *   /                                     the lab
 *   /?station=engineering                 a station
 *   /?station=engineering&project=sqlorbit  a project within its station
 *
 * Pure functions, shared by the server page (initial state) and the client
 * provider (history sync). Which projects a station has comes from
 * data/zones.ts, so nothing here knows any particular station or project.
 *
 * Normalization keeps the longest valid prefix of station -> project:
 *   - station missing or unknown          -> the lab (any project is ignored)
 *   - project unknown or of another station -> the station alone
 * Values are matched case-insensitively and trimmed; repeated parameters
 * use the first value. Other query parameters are left untouched.
 */

export const STATION_PARAM = "station";
export const PROJECT_PARAM = "project";

export interface LabLocation {
  station: ZoneId | null;
  project: ProjectId | null;
}

export const LAB_HOME: LabLocation = { station: null, project: null };

type ParamValue = string | string[] | null | undefined;

const normalize = (v: ParamValue): string | null => {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim().toLowerCase() || null;
};

/** The valid selection a pair of raw query values points at. */
export function resolveLabLocation(station: ParamValue, project: ParamValue): LabLocation {
  const s = normalize(station);
  const zone = LAB_ZONES.find((z) => z.id === s);
  if (!zone) return LAB_HOME;
  const p = normalize(project);
  return { station: zone.id, project: zone.projects.find((id) => id === p) ?? null };
}

export function locationFromSearch(search: string): LabLocation {
  const q = new URLSearchParams(search);
  return resolveLabLocation(q.get(STATION_PARAM), q.get(PROJECT_PARAM));
}

export const sameLocation = (a: LabLocation, b: LabLocation) => a.station === b.station && a.project === b.project;

/**
 * `search` with the lab's parameters set to `loc` (station first, then
 * project) and every other parameter kept. "" for the bare lab.
 */
export function labSearch(loc: LabLocation, search = ""): string {
  const q = new URLSearchParams(search);
  q.delete(STATION_PARAM);
  q.delete(PROJECT_PARAM);
  const rest = q.toString();
  const own = new URLSearchParams();
  if (loc.station) {
    own.set(STATION_PARAM, loc.station);
    if (loc.project) own.set(PROJECT_PARAM, loc.project);
  }
  const all = [own.toString(), rest].filter(Boolean).join("&");
  return all ? `?${all}` : "";
}
