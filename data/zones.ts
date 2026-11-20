import type { ProjectId } from "./projects";

/**
 * Lab station content. Scene geometry lives separately in
 * components/lab/scene-layout.ts so content can later come from a CMS
 * without touching the measured composition.
 */

export type ZoneId = "educational" | "engineering" | "playground" | "creative" | "experience";

export type StationIconName = "cap" | "code" | "gamepad" | "palette" | "briefcase";
export type StationAccent = "amber" | "cyan" | "violet";

export interface LabZone {
  id: ZoneId;
  title: string;
  /** Where the zone sits in the room. */
  placement: "rear-center" | "middle-left" | "middle-right" | "front-left" | "front-right";
  icon: StationIconName;
  accent: StationAccent;
  /** One-line description shown in the hero slot while the station is selected. */
  summary: string;
  projects: ProjectId[];
}

export const LAB_ZONES: LabZone[] = [
  {
    id: "educational",
    title: "Educational",
    placement: "rear-center",
    icon: "cap",
    accent: "amber",
    summary: "Interactive learning experiences and tools.",
    projects: ["arimap", "armat"],
  },
  {
    id: "engineering",
    title: "Engineering",
    placement: "middle-left",
    icon: "code",
    accent: "cyan",
    summary: "Developer tools and production engineering.",
    projects: ["sqlorbit", "tablerefresh"],
  },
  {
    id: "playground",
    title: "Playground",
    placement: "middle-right",
    icon: "gamepad",
    accent: "violet",
    summary: "Games, challenges, and playful experiments.",
    projects: ["aziz"],
  },
  {
    id: "creative",
    title: "Creative Studio",
    placement: "front-left",
    icon: "palette",
    accent: "amber",
    summary: "Visual ideas and creative products.",
    projects: ["wallpapers"],
  },
  {
    id: "experience",
    title: "Experience",
    placement: "front-right",
    icon: "briefcase",
    accent: "amber",
    summary: "Building and maintaining real-world software.",
    projects: ["koreez"],
  },
];

export function getZone(id: ZoneId): LabZone {
  const zone = LAB_ZONES.find((z) => z.id === id);
  if (!zone) throw new Error(`Unknown lab zone: ${id}`);
  return zone;
}
