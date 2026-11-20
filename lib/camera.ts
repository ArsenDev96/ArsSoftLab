import { SCENE, type ScenePoint } from "./scene";

/**
 * 2.5D camera for the lab stage.
 *
 * A shot is `translate(x, y) scale(scale)` applied to the scene around its
 * centre, in reference pixels. Translation is clamped so the scaled plate
 * always covers the frame: the camera can never reveal an edge.
 */
export interface CameraShot {
  x: number;
  y: number;
  scale: number;
}

export const IDLE_SHOT: CameraShot = { x: 0, y: 0, scale: 1 };

/** Place `target` as close to `anchor` (default: frame centre) as the plate allows. */
export function frameTarget(target: ScenePoint, scale: number, anchor?: ScenePoint): CameraShot {
  const cx = SCENE.width / 2;
  const cy = SCENE.height / 2;
  const ax = anchor?.x ?? cx;
  const ay = anchor?.y ?? cy;
  const maxX = ((scale - 1) * SCENE.width) / 2;
  const maxY = ((scale - 1) * SCENE.height) / 2;
  const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));
  return {
    x: clamp(ax - cx - scale * (target.x - cx), maxX),
    y: clamp(ay - cy - scale * (target.y - cy), maxY),
    scale,
  };
}

/** Where a scene point lands on screen (reference px) under a shot. */
export function project(p: ScenePoint, shot: CameraShot): ScenePoint {
  const cx = SCENE.width / 2;
  const cy = SCENE.height / 2;
  return { x: cx + shot.x + shot.scale * (p.x - cx), y: cy + shot.y + shot.scale * (p.y - cy) };
}
