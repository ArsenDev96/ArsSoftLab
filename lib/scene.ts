/**
 * Scene coordinate system.
 *
 * Every in-scene position is authored in the pixel space of the approved
 * reference image (1672 x 941). Components convert to percentages so the
 * layout scales with the scene, and future camera transitions / per-object
 * animation can work in one stable coordinate space.
 */

export const SCENE = { width: 1672, height: 941 } as const;

export interface ScenePoint {
  /** Reference-pixel x (0 – 1672). */
  x: number;
  /** Reference-pixel y (0 – 941). */
  y: number;
}

export interface SceneRect extends ScenePoint {
  w: number;
  h: number;
}

/** A length of `n` reference pixels in the current `--u` scale context. */
export const u = (n: number): string => `calc(var(--u) * ${n})`;

/**
 * Outfit places the cap top ~0.17em below the line box top at line-height 1.
 * Used to align HTML text to cap-top coordinates measured on the reference.
 */
export const CAP_INSET = 0.17;

export const pctX =(x: number): string => `${(x / SCENE.width) * 100}%`;
export const pctY = (y: number): string => `${(y / SCENE.height) * 100}%`;

/** Absolute-position style for a point in the scene. */
export function scenePoint({ x, y }: ScenePoint): { left: string; top: string } {
  return { left: pctX(x), top: pctY(y) };
}

/** Absolute-position style for a rectangle in the scene. */
export function sceneRect({ x, y, w, h }: SceneRect): {
  left: string;
  top: string;
  width: string;
  height: string;
} {
  return { left: pctX(x), top: pctY(y), width: pctX(w), height: pctY(h) };
}
