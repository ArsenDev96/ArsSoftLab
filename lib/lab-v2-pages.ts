import { projectsWithPages, type ProjectId } from "@/data/projects";
import { NAV_ITEMS, type NavItem } from "@/data/site";
import { labSearch, type LabLocation } from "./lab-url";

/**
 * M1.4L.2: links between the experimental lab (`/lab-v2`) and its project
 * pages (`/lab-v2/projects/[slug]`). Pure functions, used on the server.
 *
 * The lab's view parameters travel with the visitor: `render=lite` (M1.4K.5B)
 * and an explicit `floor` (M1.4K.10) go to the project page and come back to
 * the lab with it. Only known values are kept; station and project are the
 * lab's own and are set by the link itself.
 */

export const LAB_V2_PATH = "/lab-v2";
export const LAB_V2_PROJECTS_PATH = "/lab-v2/projects";

type Query = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The lab's view parameters from a page's query, as a search string without "?" ("" if none). */
export function labViewQuery(query: Query): string {
  const q = new URLSearchParams();
  if (first(query.render) === "lite") q.set("render", "lite");
  const floor = first(query.floor);
  if (floor === "approved" || floor === "original") q.set("floor", floor);
  return q.toString();
}

/** `/lab-v2` at `loc` (station first, then project), with the view parameters kept. */
export function labV2Href(loc: LabLocation, view: string): string {
  return LAB_V2_PATH + labSearch(loc, view);
}

/**
 * M1.4P: the desktop header's navigation on `/lab-v2` itself. As the site's (NAV_ITEMS), except that Experience is the
 * Experience station's deep link (`/lab-v2?station=experience`, view parameters kept) instead of the in-scene anchor
 * `#station-experience`, which only pointed at the label and opened nothing. A plain click is handled in place by
 * HeaderStationLinks (selects the station through the lab's own state); a new tab, or a click before hydration,
 * follows the deep link. The homepage keeps NAV_ITEMS.
 */
export function labV2Nav(view: string): NavItem[] {
  const experience = labV2ExperienceHref(view);
  return NAV_ITEMS.map((item) => (item.icon === "experience" ? { ...item, href: experience } : item));
}

/** The header's Experience destination in `/lab-v2`: the Experience station's deep link, view parameters kept (M1.4P). */
export function labV2ExperienceHref(view: string): string {
  return labV2Href({ station: "experience", project: null }, view);
}

/** A project page, with the view parameters kept. */
export function projectPageHref(slug: string, view: string): string {
  return `${LAB_V2_PROJECTS_PATH}/${slug}${view ? `?${view}` : ""}`;
}

/** "Open project" destinations in `/lab-v2`: only projects that have a page. */
export function labV2ProjectPages(view: string): Partial<Record<ProjectId, string>> {
  return Object.fromEntries(projectsWithPages().map((p) => [p.id, projectPageHref(p.slug, view)]));
}
