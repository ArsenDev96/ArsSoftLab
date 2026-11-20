import type { ZoneId } from "@/data/zones";
import { frameTarget, type CameraShot } from "@/lib/camera";
import type { ScenePoint, SceneRect } from "@/lib/scene";

/**
 * Measured scene geometry, in reference pixels (1672 x 941), taken from
 * reference/approved-lab-design.png. Labels nearer the camera are drawn
 * slightly larger in the reference, so sizes vary per station on purpose.
 */

export interface StationLayout {
  /** Top-left of the title text (cap top, left edge). */
  label: ScenePoint;
  /** Title font size. */
  titleSize: number;
  /** Icon centre relative to the label anchor. */
  iconOffset: ScenePoint;
  /** Chip row: offset from the label anchor, font size, padding and gap. */
  chips: { x: number; y: number; size: number; padX: number; gap: number };
  /**
   * Pointer hotspot: polygon around the station's platform and objects.
   * Polygons (not rectangles) so no station's hit area overlaps another's.
   */
  hotspot: readonly ScenePoint[];
  /** Platform centre: origin for future camera moves and connection pulses. */
  platformCenter: ScenePoint;
  /** 0 = far wall, 1 = nearest the camera. Drives parallax from M1.2. */
  depth: number;
}

/** Polygon from a flat x, y list. */
function poly(...xy: number[]): ScenePoint[] {
  return Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[2 * i], y: xy[2 * i + 1] }));
}

/** Bounding box of a hotspot polygon (the element the polygon is clipped from). */
export function hotspotBox(shape: readonly ScenePoint[]): SceneRect {
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** CSS clip-path for a hotspot polygon, relative to its bounding box. */
export function hotspotClip(shape: readonly ScenePoint[]): string {
  const b = hotspotBox(shape);
  const pct = (v: number, o: number, s: number) => `${+(((v - o) / s) * 100).toFixed(3)}%`;
  return `polygon(${shape.map((p) => `${pct(p.x, b.x, b.w)} ${pct(p.y, b.y, b.h)}`).join(", ")})`;
}

export const STATION_LAYOUT: Record<ZoneId, StationLayout> = {
  educational: {
    label: { x: 826, y: 228 },
    titleSize: 20.1,
    iconOffset: { x: -43, y: 14 },
    chips: { x: 0, y: 26, size: 13.5, padX: 14.5, gap: 7 },
    hotspot: poly(676, 400, 690, 352, 730, 316, 790, 292, 860, 288, 930, 300, 996, 308, 996, 350, 985, 420, 996, 440, 996, 492, 680, 492, 672, 450),
    platformCenter: { x: 838, y: 462 },
    depth: 0.35,
  },
  engineering: {
    label: { x: 425, y: 326 },
    titleSize: 20.5,
    iconOffset: { x: -42, y: 15 },
    chips: { x: 0, y: 27, size: 12.8, padX: 13, gap: 7 },
    hotspot: poly(262, 505, 290, 480, 338, 472, 340, 388, 470, 384, 540, 410, 548, 462, 592, 490, 600, 530, 566, 553, 340, 553, 336, 545, 262, 540),
    platformCenter: { x: 430, y: 515 },
    depth: 0.55,
  },
  playground: {
    label: { x: 1288, y: 329 },
    titleSize: 20.9,
    iconOffset: { x: -43, y: 16 },
    chips: { x: -1, y: 27, size: 13.5, padX: 15.5, gap: 8 },
    hotspot: poly(1060, 505, 1095, 478, 1112, 400, 1130, 352, 1262, 352, 1270, 452, 1330, 458, 1372, 490, 1376, 540, 1340, 556, 1100, 556, 1060, 540),
    platformCenter: { x: 1215, y: 512 },
    depth: 0.55,
  },
  creative: {
    label: { x: 406, y: 579 },
    titleSize: 22.1,
    iconOffset: { x: -40, y: 18 },
    chips: { x: 1, y: 28, size: 13.5, padX: 13.5, gap: 8 },
    hotspot: poly(92, 700, 140, 660, 160, 560, 176, 548, 332, 548, 336, 650, 440, 662, 506, 690, 508, 748, 470, 780, 100, 780),
    platformCenter: { x: 300, y: 715 },
    depth: 0.85,
  },
  experience: {
    label: { x: 1270, y: 572 },
    titleSize: 21.5,
    iconOffset: { x: -35, y: 14 },
    chips: { x: 7, y: 28, size: 13.5, padX: 14, gap: 8 },
    hotspot: poly(1206, 690, 1260, 650, 1388, 640, 1388, 515, 1532, 515, 1534, 598, 1610, 620, 1664, 668, 1664, 782, 1206, 782),
    platformCenter: { x: 1430, y: 715 },
    depth: 0.85,
  },
};

export const CENTRAL_PLATFORM = {
  center: { x: 838, y: 590 } satisfies ScenePoint,
  hotspot: { x: 645, y: 528, w: 390, h: 128 } satisfies SceneRect,
};

/* --------------------------------------------------------------------------
   Independent station layers (M1.2.2 prototype, Engineering only).

   The station is cut out of the plate into its own layer
   (scripts/make-station-layers.py), so it can lift on hover/focus while the
   reconstructed scenery behind it and a contact shadow stay on the floor.

   Reversible: build with NEXT_PUBLIC_STATION_LAYERS=off to get the exact
   M1.2.1 scene (no layers, original platform glow on hover).
-------------------------------------------------------------------------- */

export const STATION_LAYERS_ENABLED = process.env.NEXT_PUBLIC_STATION_LAYERS !== "off";

export interface StationLayerSpec {
  /** Shared clip box of the four images, in scene px (printed by the script). */
  box: SceneRect;
  /** The moving cut-out (RGBA, soft silhouette alpha). */
  station: string;
  /** Reconstructed scenery behind the station (static). */
  backdrop: string;
  /** Contact-shadow footprint (alpha only, static, shown while lifted). */
  shadow: string;
  /** Hover light, pre-clipped to the silhouette (moves with the station). */
  light: string;
  /** Transform origin: centre of the platform's base, where it meets the floor. */
  origin: ScenePoint;
}

export const STATION_LAYERS: Partial<Record<ZoneId, StationLayerSpec>> = STATION_LAYERS_ENABLED
  ? {
      engineering: {
        box: { x: 257, y: 380, w: 349, h: 179 },
        station: "/scene/layers/engineering.webp",
        backdrop: "/scene/layers/engineering-backdrop.webp",
        shadow: "/scene/layers/engineering-shadow.webp",
        light: "/scene/layers/engineering-light.webp",
        origin: { x: 430, y: 548 },
      },
    }
  : {};

export const hasStationLayer = (id: ZoneId): boolean => id in STATION_LAYERS;

/* --------------------------------------------------------------------------
   Camera shots: one per station (M1.3A).
-------------------------------------------------------------------------- */

export interface StationCameraShot {
  shot: CameraShot;
  /** Centre of the focus vignette, in scene px. */
  spotlight: ScenePoint;
}

/**
 * Restrained zoom (M1.2.1 settled on 1.09x for Engineering: the plate is only
 * 1672 px wide, so 1.09x keeps upsampling at ~1.07x on a 1648 px viewport;
 * 1.15x was visibly soft). frameTarget clamps the translation so the plate
 * always covers the frame (at 1.09x: at most ~75 px sideways, ~42 px
 * vertically), so each shot leans toward its station rather than centring it.
 *
 * `bounds` further limit a shot's translation (scene px) where the full lean
 * would be awkward. The hero slot (top left, outside the camera) shows the
 * selected station's info; any zoom moves Engineering's label up and left
 * toward it, so no shot may lift the scene (y >= 0), and shots that pan left
 * stop where the Engineering icon still clears the hero's lower rows.
 * Experience sits against the right edge: at 1.09x its platform would leave
 * the frame unless the shot panned the full 75 px left (into the hero), so it
 * zooms less instead. scripts/visual/check.mjs verifies that no label
 * overlaps the hero info under any shot.
 */
export const CAMERA_ZOOM = 1.09;

interface ShotSpec {
  /** Middle of the station's label + platform block. */
  target: ScenePoint;
  spotlight: ScenePoint;
  zoom?: number;
  bounds?: { x?: [number, number]; y?: [number, number] };
}

const SHOT_SPECS: Record<ZoneId, ShotSpec> = {
  // Rear centre: no sideways move; the clamp lets it drop ~42 px.
  educational: { target: { x: 838, y: 380 }, spotlight: { x: 836, y: 392 } },
  // Label (y 326) down to the platform base (y 555). Unchanged from M1.2.1.
  engineering: { target: { x: 437, y: 440 }, spotlight: { x: 432, y: 452 } },
  playground: { target: { x: 1218, y: 432 }, spotlight: { x: 1220, y: 455 }, bounds: { x: [-15, 75] } },
  creative: { target: { x: 300, y: 660 }, spotlight: { x: 300, y: 670 }, bounds: { y: [10, 42] } },
  experience: { target: { x: 1420, y: 660 }, spotlight: { x: 1420, y: 670 }, zoom: 1.03, bounds: { y: [0, 42] } },
};

function shotFor({ target, zoom = CAMERA_ZOOM, bounds }: ShotSpec): CameraShot {
  const shot = frameTarget(target, zoom);
  const clamp = (v: number, r?: [number, number]) => (r ? Math.max(r[0], Math.min(r[1], v)) : v);
  // Bounds only ever reduce the lean, so the plate still covers the frame.
  return { x: clamp(shot.x, bounds?.x), y: clamp(shot.y, bounds?.y), scale: zoom };
}

export const CAMERA_SHOTS: Record<ZoneId, StationCameraShot> = Object.fromEntries(
  (Object.entries(SHOT_SPECS) as [ZoneId, ShotSpec][]).map(([id, spec]) => [id, { shot: shotFor(spec), spotlight: spec.spotlight }]),
) as Record<ZoneId, StationCameraShot>;
