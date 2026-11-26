import { projectsWithPages, type ProjectId } from "@/data/projects";
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

/** A project page, with the view parameters kept. */
export function projectPageHref(slug: string, view: string): string {
  return `${LAB_V2_PROJECTS_PATH}/${slug}${view ? `?${view}` : ""}`;
}

/** "Open project" destinations in `/lab-v2`: only projects that have a page. */
export function labV2ProjectPages(view: string): Partial<Record<ProjectId, string>> {
  return Object.fromEntries(projectsWithPages().map((p) => [p.id, projectPageHref(p.slug, view)]));
}
