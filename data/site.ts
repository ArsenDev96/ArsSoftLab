/**
 * Site-level content. Kept separate from components so copy can move to a
 * CMS later without touching presentation.
 */

export const SITE = {
  brand: "ArsSoftLab",
  owner: "Arsen Manukyan",
  role: "Software Engineer",
  title: "Arsen Manukyan — Inside My Lab | ArsSoftLab",
  description:
    "Explore the lab of software engineer Arsen Manukyan: products, tools and ideas across education, engineering, play, creative work and experience.",
  /** Placeholder until the contact flow is designed (later milestone). */
  contactHref: "#contact",
} as const;

export const HERO = {
  eyebrow: "Inside my lab",
  /** Lines are kept explicit to match the approved line breaks. */
  lines: ["Explore my world", "of products, tools", "and"],
  highlight: "ideas.",
} as const;

export type NavIconName = "home" | "projects" | "experience" | "user";

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
}

/**
 * Only the Lab exists in M1.1, so the other entries jump to their in-lab
 * anchors. They become real routes once those pages are approved.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "Lab", href: "/", icon: "home" },
  { label: "Projects", href: "#lab-stations", icon: "projects" },
  { label: "Experience", href: "#station-experience", icon: "experience" },
  { label: "About", href: "#lab-intro", icon: "user" },
];
