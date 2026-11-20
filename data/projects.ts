import { getZone, type ZoneId } from "./zones";

/**
 * Project metadata. Presentation lives in components/lab; this file is the
 * single source of truth that a CMS or detail pages can replace later.
 */

export type ProjectId =
  | "arimap"
  | "armat"
  | "sqlorbit"
  | "tablerefresh"
  | "aziz"
  | "wallpapers"
  | "koreez";

export interface Project {
  id: ProjectId;
  /** Display name exactly as shown in the lab. */
  name: string;
  /** URL segment reserved for the future /projects/[slug] detail page. */
  slug: string;
  zone: ZoneId;
  /**
   * One-sentence description written by the owner. Until it is supplied,
   * projectSummary() derives a neutral sentence from the station data.
   */
  summary?: string;
  /**
   * Destination of the "Open project" action. Leave unset until the page
   * exists: the lab then says the page is coming soon instead of linking.
   */
  href?: string;
}

export const PROJECTS: Record<ProjectId, Project> = {
  arimap: {
    id: "arimap",
    name: "AriMap",
    slug: "arimap",
    zone: "educational",
    summary: "An interactive geography-learning game built around exploration, lessons, and challenges.",
  },
  armat: {
    id: "armat",
    name: "Armat",
    slug: "armat",
    zone: "educational",
    summary: "A multilingual platform for discovering Armenian history, literature, culture, and places.",
  },
  sqlorbit: {
    id: "sqlorbit",
    name: "SQLOrbit",
    slug: "sqlorbit",
    zone: "engineering",
    summary: "A Node.js developer tool for identifying slow, repeated, and N+1 SQL queries.",
  },
  tablerefresh: {
    id: "tablerefresh",
    name: "TableRefresh",
    slug: "tablerefresh",
    zone: "engineering",
    summary: "A WordPress plugin that synchronizes TablePress tables with CSV files and Google Sheets.",
  },
  aziz: {
    id: "aziz",
    name: "AZIZ",
    slug: "aziz",
    zone: "playground",
    summary: "A party-game app designed around creative questions, unexpected answers, and group play.",
  },
  wallpapers: {
    id: "wallpapers",
    name: "Wallpapers",
    slug: "wallpapers",
    zone: "creative",
    summary: "A collection of message-driven wallpapers combining typography, visual storytelling, and design.",
  },
  koreez: {
    id: "koreez",
    name: "Koreez",
    slug: "koreez",
    zone: "experience",
    summary: "An educational platform involving web applications, backend services, and production systems.",
  },
};

export function getProject(id: ProjectId): Project {
  return PROJECTS[id];
}

/**
 * The project's one-sentence description. Without an owner-written summary
 * it states only what the data already says (the station it belongs to and
 * that station's description), so nothing about the project is invented.
 */
export function projectSummary(id: ProjectId): string {
  const project = getProject(id);
  if (project.summary) return project.summary;
  const zone = getZone(project.zone);
  const article = /^[aeiou]/i.test(zone.title) ? "an" : "a";
  const what = zone.summary.charAt(0).toLowerCase() + zone.summary.slice(1);
  return `${project.name} is ${article} ${zone.title} project: ${what}`;
}
