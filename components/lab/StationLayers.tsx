"use client";

import { useEffect, useRef, useState } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, sceneRect, u } from "@/lib/scene";
import { STATION_LAYERS, type StationLayerSpec } from "./scene-layout";

/**
 * M1.2.2: stations rendered as independent layers above the plate.
 *
 * Per station, back to front (no CSS masks):
 *   backdrop – reconstructed scenery behind the station (static)
 *   shadow   – contact-shadow footprint (static), shown while lifted
 *   lift     – the station cut-out plus its baked hover light; this wrapper
 *              is the only thing that moves.
 *
 * Each layer is a box around the station with overflow clipped, holding a
 * full-frame image at the plate's exact geometry. Chrome pixel-snaps every
 * <img> rect, so only an image with the plate's own rect lands on exactly
 * the same pixels (a cropped image would be ~0.3 px off); the clip keeps the
 * composited layers ~60k px instead of the full frame.
 *
 * The group is only shown while the station is lifted (see globals.css): at
 * rest the untouched plate shows the station, so idle is identical to
 * M1.2.1. At identity transform the layers recompose the plate (max 1/255
 * before resampling), so switching them on and off is not visible. The group
 * never shows before every image is decoded, so a partially loaded state can
 * never reveal the hole.
 */
export function StationLayers() {
  return (
    <>
      {(Object.entries(STATION_LAYERS) as [ZoneId, StationLayerSpec][]).map(([id, spec]) => (
        <StationLayer key={id} id={id} spec={spec} />
      ))}
    </>
  );
}

function StationLayer({ id, spec }: { id: ZoneId; spec: StationLayerSpec }) {
  const group = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const check = () => {
    const imgs = [...(group.current?.querySelectorAll("img") ?? [])];
    if (!imgs.length || !imgs.every((img) => img.complete && img.naturalWidth > 0)) return;
    // Decode up front: the group stays hidden until the first hover, and a
    // lazy decode then would cost the first frames of the lift.
    Promise.all(imgs.map((img) => img.decode().catch(() => undefined))).then(() => setReady(true));
  };
  // Images that finished before hydration never fire onLoad.
  useEffect(check, []);

  // Full-frame image placed so its rect equals the plate's, inside the box.
  const frame = { left: u(-spec.box.x), top: u(-spec.box.y), width: u(SCENE.width), height: u(SCENE.height) };
  const img = (src: string, className = "") => (
    // eslint-disable-next-line @next/next/no-img-element -- exact plate geometry, no optimisation
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={check}
      data-lift={id}
      className={`absolute max-w-none select-none ${className}`}
      style={frame}
    />
  );

  return (
    <div
      ref={group}
      aria-hidden="true"
      data-station-layer={id}
      data-ready={ready || undefined}
      className="lab-station-layer pointer-events-none absolute"
      style={sceneRect(spec.box)}
    >
      {/* Static layers clip to the box; the group itself must not clip, or
          the lifted station's top edge would be cut off at the box. */}
      <div className="absolute inset-0 overflow-hidden">{img(spec.backdrop)}</div>
      <div className="absolute inset-0 overflow-hidden">{img(spec.shadow, "lab-lift-shadow")}</div>
      {/* The lift clips to its own (moving) box. */}
      <div
        className="lab-lift absolute inset-0 overflow-hidden"
        data-lift={id}
        style={{ transformOrigin: `${u(spec.origin.x - spec.box.x)} ${u(spec.origin.y - spec.box.y)}` }}
      >
        {img(spec.station)}
        {img(spec.light, "lab-lift-light")}
      </div>
    </div>
  );
}
