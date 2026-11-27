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
  /** M1.4L.3B: short name shown with the image (for example the screen it shows). */
  title?: string;
  caption?: string;
}

/**
 * M1.4L.3B: an extra text section of the project page, for content that the
 * fixed sections don't cover. Placed after the Overview, or after the
 * Engineering contributions.
 */
export interface ProjectSection {
  id: string;
  title: string;
  paragraphs?: string[];
  /** A short list; each item may lead with a term. */
  items?: { term?: string; text: string }[];
  /**
   * Show the project's screenshots in this section (instead of a section of their own): under its text at full
   * width, or, for a section with no paragraphs or items (M1.4L.4B), as its content.
   */
  showMedia?: boolean;
  /** Where the section goes; default after the Overview. M1.4L.4B: or after the Technology stack. */
  after?: "overview" | "contributions" | "stack";
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
  /** M1.4L.3B: where the project stands towards release, beside the status. */
  milestone?: string;
  platforms?: string[];
  languages?: string[];
  problem?: string;
  solution?: string;
  contributions?: string[];
  stack?: string[];
  media?: ProjectMedia[];
  /** Lines shown under the screenshots: where they come from, and the credits their content requires. */
  mediaNotes?: string[];
  sections?: ProjectSection[];
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
    // M1.4L.3B: owner-approved decisions and the facts verified in docs/m1.4l/ARIMAP-CONTENT-AUDIT.md.
    // Not on Google Play; no public links yet; no screenshots with the unresolved AI illustrations; English screens only.
    detail: {
      tagline: "Learn geography by exploring, remembering and playing.",
      overview: [
        "Geography is often taught through lists of countries, capitals and locations. But memorizing those facts doesn't always mean understanding where places are or how they relate to one another.",
        "I created AriMap to turn geography learning into an interactive experience. Instead of only reading about places, learners explore maps, identify countries, discover their neighbors and test what they remember through short challenges.",
        "The experience combines structured lessons, map-based interactions and progression mechanics. Its Android application also supports offline learning activities, making the core experience available without a constant internet connection.",
        "From an engineering perspective, AriMap brings together interactive geographical rendering, game-state management, mobile performance and accessibility. The project is currently preparing for release, with real-device validation and publication requirements still outstanding.",
      ],
      category: "Education / Geography game",
      role: "Creator & Full-stack Engineer",
      status: "In development",
      milestone: "Android 1.0.0 release candidate built; real-device release validation pending",
      platforms: ["Android", "Web"],
      languages: ["English", "Eastern Armenian"],
      sections: [
        {
          id: "learning",
          title: "Learning experience",
          paragraphs: [
            "Europe has twelve levels of five countries each, unlocked one after another. Asia, Africa, North America and South America are planned.",
          ],
          items: [
            { term: "Discover", text: "Tap a country to see its name, its capital and a landmark, with a short fact." },
            { term: "Find", text: "Five questions, one per country, with three levels of optional help." },
            { term: "Travel", text: "Cross borders from start to destination within the fewest possible crossings, with Hint, Undo and Restart." },
            { term: "Results", text: "Up to three stars for answers found without hints and a journey completed without help; levels have no timers or speed bonuses." },
            { term: "Quick Challenge", text: "Fifteen countries on the map of Europe in 60 seconds, with a shareable result card." },
          ],
          showMedia: true,
        },
        {
          id: "accessibility",
          title: "Accessibility",
          after: "contributions",
          paragraphs: [
            "Accessibility is part of both apps, checked with automated tests and on an Android emulator. Screen-reader testing on a physical phone is still in progress.",
          ],
          items: [
            { term: "Text size", text: "Layouts adapt to 150% and 200% text, down to 320 px phones and in landscape; on Android no text has scaling turned off." },
            { term: "Not colour alone", text: "Level status is given in words and icons, and stars differ in shape." },
            { term: "Input", text: "Visible keyboard focus on the website. On Android, touch targets of at least 48 dp and an answer-by-description mode as an alternative to tapping the map." },
            { term: "Motion and time", text: "Reduced-motion settings are respected, and the timed neighbours round can be extended to ten minutes." },
          ],
        },
      ],
      contributions: [
        "Designed a framework-independent TypeScript core for lessons, game rules, progress and translations, shared by the website and the Android app.",
        "Modelled each level as a border graph checked against the map data, with breadth-first search for journey budgets.",
        "Built a reproducible map-data pipeline from Natural Earth, with one shared projection and generated relief and forest layers.",
        "Implemented versioned, validated saved progress with migrations, so earlier saves keep working as levels change.",
        "Diagnosed and reduced map-rendering cost on Android, and evaluated an experimental GPU map renderer on a test device.",
        "Kept the Android release build free of network access and data collection.",
      ],
      stack: ["TypeScript", "React", "Next.js", "React Native", "Expo", "D3", "TopoJSON", "SQLite"],
      media: [
        {
          src: "/projects/arimap/home.webp",
          width: 720,
          height: 1280,
          title: "Home",
          caption: "Continents, Europe's progress and the Quick Challenge.",
          alt: "AriMap's home screen on Android: a Quick Challenge card reading “Find 15 countries on the map of Europe”, a world map with each continent in its own colour, and the Europe card showing 0 of 12 levels completed.",
        },
        {
          src: "/projects/arimap/find.webp",
          width: 720,
          height: 1280,
          title: "Find",
          caption: "Five questions, one per country, with optional help.",
          alt: "Find, question 1 of 5: “Find Germany” under a map of western Europe, with a switch to answer by description instead.",
        },
        {
          src: "/projects/arimap/travel.webp",
          width: 720,
          height: 1280,
          title: "Travel",
          caption: "Cross borders within the fewest crossings.",
          alt: "Travel: the player has crossed from France into Belgium; buttons offer the Netherlands, Luxembourg and Germany as next crossings, with Hint, Undo and Restart.",
        },
        {
          src: "/projects/arimap/quick-challenge.webp",
          width: 720,
          height: 1280,
          title: "Quick Challenge",
          caption: "Fifteen countries on the map of Europe in 60 seconds.",
          alt: "Quick Challenge, question 1 of 15: find Switzerland on a map of Europe, with 58 seconds left and a score of 0.",
        },
        {
          src: "/projects/arimap/results.webp",
          width: 720,
          height: 1280,
          title: "Results",
          caption: "Stars for answers without hints and a journey without help.",
          alt: "Results: “Journey complete!” with 3 of 3 stars, and the route from France through Belgium to the Netherlands on the map.",
        },
      ],
      mediaNotes: [
        "Screenshots: AriMap's Android 1.0.0 release candidate on an Android emulator, in English.",
        "Map data: Natural Earth. Relief: Terrain Tiles by Mapzen. Forests: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0).",
      ],
      related: ["armat"],
    },
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
    // M1.4L.4B: owner-approved decisions and the facts verified in docs/m1.4l/TABLEREFRESH-CONTENT-AUDIT.md.
    // Published on WordPress.org (1.0.1); no GitHub link yet; no install, rating or review figures.
    detail: {
      tagline: "Keep TablePress tables updated without losing control of your data.",
      overview: [
        "Keeping website tables updated sounds simple until the source data changes, a scheduled task fails, or someone edits the table directly in WordPress.",
        "I created TableRefresh to automate CSV and Google Sheets synchronization for existing TablePress tables, while giving site administrators control over when and how their data is replaced.",
        "The most challenging part wasn't importing rows. It was making synchronization reliable: validating external data, preventing conflicting updates, recovering from interrupted operations, and preserving manual edits until an administrator decides what should happen.",
        "TableRefresh is publicly available through the WordPress plugin directory. Its development focuses on predictable behavior, compatibility and making synchronization failures understandable rather than silently overwriting data.",
      ],
      category: "WordPress Plugin / Developer Tools",
      role: "Creator & Full-stack Engineer",
      status: "Published",
      milestone: "Version 1.0.1 on WordPress.org",
      platforms: ["WordPress", "TablePress"],
      sections: [
        {
          id: "synchronization",
          title: "How synchronization works",
          paragraphs: [
            "TableRefresh is an independent add-on for TablePress, not made by or affiliated with it, and requires the free TablePress plugin. It fills an existing table from one source and keeps it up to date.",
          ],
          items: [
            {
              term: "Source",
              text: "A CSV file at any web address, or a public Google Sheet, whose sharing link works as it is, including the chosen tab. Private sheets and sources that require signing in are not supported.",
            },
            {
              term: "Schedule",
              text: "Hourly, daily or weekly through WordPress's scheduled tasks, or at once with Sync now. WP-CLI commands run a sync or recover an interrupted one.",
            },
            {
              term: "Update",
              text: "One way, from the source to the table. The complete file is downloaded and checked first; then the rows and columns are replaced in a single database transaction, or not at all. The table's ID, shortcode, name and options stay the same.",
            },
            {
              term: "Edits in TablePress",
              text: "A table changed in TablePress after the last sync is not overwritten: automatic sync pauses until an administrator keeps the changes or replaces them with the source data. A table open in the editor is not synchronized.",
            },
            {
              term: "Failures",
              text: "A failed sync leaves the table unchanged. Each table shows its last result and its ten most recent attempts in plain language; after five failures in a row, automatic sync pauses until a manual sync succeeds.",
            },
          ],
        },
        { id: "screenshots", title: "Screenshots", showMedia: true },
        {
          id: "testing",
          title: "Testing and compatibility",
          after: "stack",
          paragraphs: [
            "The project's tooling includes integration tests that run against real WordPress and TablePress installations in Docker, mutation testing, compatibility runs, WordPress.org's Plugin Check and a browser workflow. The recorded results differ between the two published versions.",
          ],
          items: [
            {
              term: "Requirements",
              text: "WordPress 6.7 or newer, PHP 7.4 or newer and TablePress 3.0 or newer, on MySQL or MariaDB with InnoDB tables (the WordPress default). Tested with WordPress up to 7.1 and with TablePress 3.0 and 3.4.1.",
            },
            {
              term: "Version 1.0.0",
              text: "Recorded release checks: 251 integration tests passing on PHP 7.4 and 8.3; targeted runs with TablePress 3.0, WordPress 6.7 and PHP 8.4; mutation testing; an upgrade check; WordPress.org's Plugin Check with no errors; and the browser workflow from the release package.",
            },
            {
              term: "Version 1.0.1",
              text: "Version 1.0.1 has a recorded run of 273 tests, with 269 passing, 4 skipped and no failures. The broader verification documented for version 1.0.0 has not been independently confirmed for this release.",
            },
          ],
        },
      ],
      contributions: [
        "Designed an all-or-nothing update path: the complete source is downloaded and validated, written in a single database transaction, verified, and rolled back on failure, with a journal to finish or undo an interrupted update.",
        "Built conflict detection between synchronized data and edits made in TablePress, with a keep-or-replace decision and a guard against older editor sessions saving over newer data.",
        "Implemented per-table locking and a WP-Cron scheduler for hourly, daily and weekly syncs. In 1.0.1 it gained a time budget per web request, longest-waiting-first ordering, and repair of overlapping cron runs.",
        "Hardened source handling: blocked requests to internal networks, restricted ports, refused proxies, size and time limits, HTML filtering, and formulas and shortcodes shown as text.",
        "Made Google Sheets sharing links work directly, and added WP-CLI commands for scripted sync and recovery.",
        "Took the plugin through the WordPress.org review: a vendor namespace, notices limited to the Plugins screen, and a complete uninstall.",
        "Built the test and release tooling: integration tests against real WordPress and TablePress, mutation testing, compatibility matrices, Plugin Check, browser workflow checks and reproducible release builds.",
      ],
      stack: ["PHP", "WordPress", "TablePress", "WP-Cron", "WP-CLI", "MySQL / MariaDB", "PHPUnit", "Docker"],
      media: [
        {
          src: "/projects/tablerefresh/tables.webp",
          width: 1280,
          height: 900,
          title: "Tables",
          caption: "Every synchronized table with its schedule and last result.",
          alt: "The TableRefresh screen in the WordPress admin, in its own menu below TablePress: one table, “Class roster” (table ID 1), synchronized from Google Sheets every hour, next sync in about 60 minutes, last sync “Updated” 1 second ago, with Sync now and Settings and history buttons.",
        },
        {
          src: "/projects/tablerefresh/setup.webp",
          width: 1280,
          height: 900,
          title: "Setup",
          caption: "Choose a table, paste a CSV or Google Sheets link, and choose how often to sync.",
          alt: "Set up table sync: the table “Class roster (ID 1)”, a Google Sheets sharing link as the data source with the note that private Google Sheets are not supported, How often set to Every hour (or once a day, or once a week), Sync automatically checked, the confirmation to replace the table's current content checked, and a Save and sync now button.",
        },
        {
          src: "/projects/tablerefresh/conflict.webp",
          width: 1280,
          height: 1664,
          title: "Edit conflict",
          caption: "A table changed in TablePress waits for a decision instead of being overwritten.",
          alt: "Settings and history of “Class roster”: a notice reads “This table was changed in TablePress” and offers Keep the changes, or Replace with source data after confirming that the edits will be lost. Below, the status “Paused: needs your decision” and the recent syncs, the latest “Not updated” because the table was changed in TablePress, earlier ones “No changes” and “Updated”.",
        },
      ],
      mediaNotes: [
        "Screenshots: TableRefresh's official WordPress.org screenshots, on WordPress 7.1 with TablePress, using Google's public sample sheet (fictional data).",
      ],
      links: [{ label: "TableRefresh on WordPress.org", href: "https://wordpress.org/plugins/tablerefresh/" }],
      related: ["sqlorbit"],
    },
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
