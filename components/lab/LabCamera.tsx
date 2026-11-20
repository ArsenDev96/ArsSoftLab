"use client";

import type { CSSProperties, ReactNode } from "react";
import { IDLE_SHOT } from "@/lib/camera";
import { SCENE } from "@/lib/scene";
import { useLabState } from "./LabState";
import { CAMERA_SHOTS } from "./scene-layout";

/**
 * Experiment C: the 2.5D camera. Transforms only the scene (plate, effects
 * and in-scene labels); the header, hero copy and panels live outside it
 * and are never scaled.
 *
 * At rest no transform is applied at all, so idle rendering is identical
 * to M1.1. Timing and easing live in globals.css (.lab-camera).
 */
export function LabCamera({ children }: { children: ReactNode }) {
  const { station } = useLabState();
  const shot = station ? CAMERA_SHOTS[station].shot : IDLE_SHOT;
  const idle = shot === IDLE_SHOT;

  return (
    <div
      data-camera={station ?? "lab"}
      className="lab-camera absolute inset-0"
      style={
        {
          "--cam-x": shot.x,
          "--cam-y": shot.y,
          "--cam-s": shot.scale,
          transform: idle
            ? undefined
            : "translate(calc(var(--u) * var(--cam-x)), calc(var(--u) * var(--cam-y))) scale(var(--cam-s))",
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * Darkens the room around the selected station. Lives inside the camera so
 * it stays locked to the scene; it is fully transparent at rest.
 */
export function FocusVignette() {
  const { station } = useLabState();
  const spot = station ? CAMERA_SHOTS[station].spotlight : null;
  const x = spot ? (spot.x / SCENE.width) * 100 : 50;
  const y = spot ? (spot.y / SCENE.height) * 100 : 50;
  return (
    <div
      aria-hidden="true"
      data-open={spot ? true : undefined}
      className="lab-focus-vignette pointer-events-none absolute inset-0"
      style={{
        background: `radial-gradient(ellipse 26% 34% at ${x}% ${y}%, transparent 0%, transparent 55%, rgb(4 5 7 / 0.38) 78%, rgb(4 5 7 / 0.62) 100%)`,
      }}
    />
  );
}
