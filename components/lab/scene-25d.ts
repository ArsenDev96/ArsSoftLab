import type { ZoneId } from "@/data/zones";
import { PLAYGROUND_25D } from "./scene-25d-data";

/**
 * M1.3I: the 2.5D scene's layer architecture (experimental, behind
 * NEXT_PUBLIC_LAB_LAYERED=on; see docs/m1.3i/scene-layer-plan.md).
 *
 * The approved artwork stays the source of truth. Each station is described
 * as the same stack of independently composited layers, back to front:
 *
 *   A environment   the room without stations, lines or station lighting
 *                   (today: the plate plus static corrections, see below)
 *   B foundation    the floor joint under the platform (static; hidden at rest)
 *   G reflection    the platform light's floor reflection (moves with height)
 *   F shadow        contact + ambient, graded by height (static)
 *   D object        the station: platform and objects (moves)
 *   E lighting      the platform strips (on the object; PLATFORM_POWER)
 *   C connection    the grounded line from the A (CONNECTION_LAYERS)
 *   H interface     label and chips (HTML, ride the lift)
 *
 * Only Playground is a working prototype. The others are defined here with
 * what exists and what artwork is still missing; their approved visuals and
 * animations are untouched.
 */

/** M1.3I experimental 2.5D layers. NEXT_PUBLIC_PLAYGROUND_LAYERED=on (M1.3H) selects them too. */
export const LAB_LAYERED = process.env.NEXT_PUBLIC_LAB_LAYERED === "on" || process.env.NEXT_PUBLIC_PLAYGROUND_LAYERED === "on";

export type LayerState = "prototype" | "approved" | "placeholder";

export interface Station25D {
  /** Where this station is in the migration. */
  state: LayerState;
  /** D: transparent station object (platform + objects), full frame. */
  object: string | null;
  /** A: clean environment under the footprint (hole only), full frame. */
  background: string | null;
  /**
   * M1.3J: an inpainted floor for the band a lift uncovers, composited only
   * inside the supplied mask where the floor is hidden at rest
   * (scripts/inpaint-playground.mjs; transparent when no candidate is
   * integrated). Full frame, drawn over the background.
   */
  floor?: string;
  /**
   * M1.3J.5: the same floor right under the contact line with the plate's
   * contact highlight taken out (scripts/playground-contact-unlit.py), faded in
   * with the lift: the light where the base met the floor goes as it rises,
   * instead of repeating the base's lit bottom edge under the open gap.
   */
  contactUnlit?: string;
  /** B: foundation joint path (box-relative), and its visible x range. */
  foundation: { path: string; x0: number; x1: number } | null;
  /** F: contact (tight) and ambient (wide, light) shadows, alpha only, full frame. */
  shadow: { contact: string; ambient: string } | null;
  /** G: the strip's floor reflection, unpowered and powered, and its power part. */
  reflection: { dim: string; lit: string; part: number; pad: number } | null;
  /**
   * How far the reflection drops per reference px of lift, and how much it
   * fades at full height. A true mirror image would drop by the full lift,
   * but the painted reflection sits at the contact line (not a mirror image
   * of the strip): it is the strip's light on the glossy floor, which moves
   * out and dims as the light rises.
   */
  reflectionDrop?: number;
  reflectionFade?: number;
  /** Lift height (reference px; the lift itself is in globals.css). */
  lift?: number;
  /** Artwork still needed before this station can be layered (see background-requirements.md). */
  missing: string[];
}

export const SCENE_25D: Record<ZoneId, Station25D> = {
  playground: {
    state: "prototype",
    object: "/scene/layers25d/playground/object.png",
    background: PLAYGROUND_25D.background,
    floor: "/scene/layers25d/playground/floor.png",
    contactUnlit: "/scene/layers25d/playground/contact-unlit.png",
    // M1.3J.5: no foundation joint. In the gap it read as the edge of a second
    // stone step under the platform (docs/m1.3j/depth/NOTES.md).
    foundation: null,
    shadow: PLAYGROUND_25D.shadow,
    reflection: PLAYGROUND_25D.reflection,
    lift: 18,
    reflectionDrop: 0.5,
    reflectionFade: 0.35,
    missing: ["Floor under the platform's footprint (painted; the current fill is synthesised)", "Wall, window, step and door behind the cabinet"],
  },
  engineering: {
    state: "approved",
    object: "/scene/layers/engineering.webp",
    background: "/scene/layers/engineering-backdrop.webp",
    foundation: null,
    shadow: null,
    reflection: null,
    missing: ["Clean environment behind and under the station", "Re-matted object over that environment", "Foundation, shadow and reflection layers"],
  },
  educational: {
    state: "placeholder",
    object: null,
    background: null,
    foundation: null,
    shadow: null,
    reflection: null,
    missing: ["Station cut-out (silhouette to be traced)", "Clean environment: rear wall, floor and the central platform's back edge behind the globe"],
  },
  creative: {
    state: "placeholder",
    object: null,
    background: null,
    foundation: null,
    shadow: null,
    reflection: null,
    missing: ["Station cut-out (silhouette to be traced)", "Clean environment: floor, left wall and arch base behind the easel and desk"],
  },
  experience: {
    state: "placeholder",
    object: null,
    background: null,
    foundation: null,
    shadow: null,
    reflection: null,
    missing: ["Station cut-out (silhouette to be traced)", "Clean environment: floor, right wall and window behind the panel"],
  },
};

/** Power parts whose reflection is its own layer here (PlatformPower skips them; StationReflections draws them). */
export const MOVED_REFLECTIONS: ReadonlySet<string> = new Set(
  LAB_LAYERED ? (Object.entries(SCENE_25D) as [ZoneId, Station25D][]).filter(([, s]) => s.reflection).map(([id, s]) => `${id}:${s.reflection!.part}`) : [],
);
