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
  /**
   * M1.4L.2: owner-approved content for the project's detail page. Only
   * projects that have it get a page (`/lab-v2/projects/[slug]` for now);
   * every field but the tagline is optional and the page leaves out what is
   * missing. Never filled with placeholder or invented content.
   */
  detail?: ProjectDetail;
}

/** A link on the project page, named for its destination. Only links that exist. */
export interface ProjectLink {
  label: string;
  href: string;
}

/** A screenshot or other image on the project page. Only real assets. */
export interface ProjectMedia {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
}

export interface ProjectDetail {
  /** Short value proposition under the project name. */
  tagline: string;
  /**
   * The page's Overview, as paragraphs written by the owner. Without it the
   * Overview shows the project's one-sentence lab summary.
   */
  overview?: string[];
  category?: string;
  role?: string;
  status?: string;
  problem?: string;
  solution?: string;
  contributions?: string[];
  stack?: string[];
  media?: ProjectMedia[];
  links?: ProjectLink[];
  /** Other projects offered at the end of the page. */
  related?: ProjectId[];
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
    // M1.4L.2: owner-approved facts. In development: no release, links, media or metrics yet.
    detail: {
      tagline: "Framework-independent SQL query diagnostics for Node.js applications.",
      overview: [
        "Database performance problems are often difficult to investigate because query execution is spread across different drivers, ORMs and application layers. A slow endpoint might be caused by one expensive query, repeated executions or an N+1 pattern that is difficult to recognize from individual logs.",
        "I designed SQLOrbit to make these patterns easier to investigate through a local dashboard, without requiring developers to adopt a specific application framework.",
        "The project focuses on three engineering challenges: integrating with different database libraries, keeping diagnostic overhead bounded, and protecting sensitive information while collecting useful query data.",
        "SQLOrbit is currently in development, with security hardening and independent review still in progress.",
      ],
      category: "Developer tools / Database diagnostics",
      role: "Creator and full-stack engineer",
      status: "In development",
      problem:
        "Slow, repeated and N+1 database queries can be difficult to diagnose across different frameworks and database libraries.",
      solution:
        "SQLOrbit provides local diagnostics to help developers investigate query performance and repeated query patterns.",
      contributions: [
        "Designed a framework-independent integration architecture.",
        "Developed adapters for database drivers and popular Node.js ORMs.",
        "Implemented slow-query, repeated-query and N+1 diagnostics.",
        "Worked on bounded event collection and local dashboard visualization.",
        "Developed privacy and security hardening for query diagnostics.",
      ],
      stack: ["Node.js", "TypeScript", "SQL"],
      related: ["tablerefresh"],
    },
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

/** Projects that have a detail page (approved detail content), in data order. */
export function projectsWithPages(): Project[] {
  return Object.values(PROJECTS).filter((p) => p.detail);
}

/** The project whose detail page lives at `slug`, if it has one. */
export function projectBySlug(slug: string): Project | undefined {
  return projectsWithPages().find((p) => p.slug === slug);
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
