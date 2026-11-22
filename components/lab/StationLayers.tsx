"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { ZoneId } from "@/data/zones";
import { SCENE, sceneRect, u } from "@/lib/scene";
import { partFrame, PowerPart, UNPOWERED_LIFT } from "./PlatformPower";
import { PLATFORM_POWER } from "./platform-power";
import { SCENE_25D, type Station25D } from "./scene-25d";
import { STATION_LAYERS, type StationLayerSpec } from "./scene-layout";
import { StationActivation } from "./StationActivation";

/**
 * M1.2.2: stations rendered as independent layers above the plate.
 *
 * Per station, back to front (no CSS masks):
 *   backdrop – reconstructed scenery behind the station (static)
 *   shadow   – contact-shadow footprint (static), shown while lifted
 *   under    – M1.3E.3 (Playground): a soft penumbra and the light pooled
 *              under the base's edge (static), shown while lifted
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
  const img = (src: string, className = "", style: CSSProperties = frame, extra: Record<string, string> = {}) => (
    // eslint-disable-next-line @next/next/no-img-element -- exact plate geometry, no optimisation
    <img
      src={src}
      alt=""
      draggable={false}
      onLoad={check}
      data-lift={id}
      className={`absolute max-w-none select-none ${className}`}
      style={style}
      {...extra}
    />
  );
  // M1.3F: the strips on the silhouette, as power parts (PlatformPower).
  const strips = PLATFORM_POWER[id].parts.map((p, k) => ({ p, k })).filter(({ p }) => p.kind === "strip");
  // M1.3I: a layered station's foundation and graded shadows.
  const depth = spec.layered && SCENE_25D[id].shadow ? SCENE_25D[id] : null;

  return (
    <div
      ref={group}
      aria-hidden="true"
      data-station-layer={id}
      data-zone={id}
      data-ready={ready || undefined}
      data-layered={spec.layered || undefined}
      className="lab-station-layer pointer-events-none absolute"
      style={sceneRect(spec.box)}
    >
      {/* Static layers clip to the box; the group itself must not clip, or
          the lifted station's top edge would be cut off at the box. */}
      <div className="absolute inset-0 overflow-hidden">{img(spec.backdrop)}</div>
      {/* M1.3J: an inpainted floor candidate over the background (static). */}
      {depth?.floor ? <div className="absolute inset-0 overflow-hidden">{img(depth.floor, "lab-floor-candidate")}</div> : null}
      {depth ? (
        // M1.3I: the floor under a layered station. --lp (globals.css) runs
        // 0 -> 1 with the lift: the contact shadow is strongest at a small
        // lift and eases as the station rises, the ambient shadow takes over;
        // the foundation joint is static (hidden by the station at rest).
        <div className="lab-depth absolute inset-0" data-depth={id}>
          {/* M1.3J.5: the contact highlight fades out as the station rises. */}
          {depth.contactUnlit ? <div className="absolute inset-0 overflow-hidden">{img(depth.contactUnlit, "lab-depth-unlit")}</div> : null}
          {depth.foundation ? <Foundation id={id} spec={spec} foundation={depth.foundation} /> : null}
          <div className="absolute inset-0 overflow-hidden">{img(depth.shadow!.ambient, "lab-depth-shadow lab-depth-ambient")}</div>
          <div className="absolute inset-0 overflow-hidden">{img(depth.shadow!.contact, "lab-depth-shadow lab-depth-contact")}</div>
        </div>
      ) : (
        <div className="absolute inset-0 overflow-hidden">{img(spec.shadow, "lab-lift-shadow")}</div>
      )}
      {spec.under ? (
        <>
          <div className="absolute inset-0 overflow-hidden">{img(spec.under.soft, "lab-lift-penumbra")}</div>
          {/* The light pool is uncovered from the corner where the energy
              arrives, across the base (globals.css). */}
          <div className="lab-gap-sweep absolute inset-0 overflow-hidden" data-lift={id}>
            <div className="lab-gap-sweep-content absolute inset-0" data-lift={id}>
              {img(spec.under.gap, "lab-lift-gap")}
            </div>
          </div>
        </>
      ) : null}
      {/* The lift clips to its own (moving) box. */}
      <div
        className="lab-lift absolute inset-0 overflow-hidden"
        data-lift={id}
        style={{ transformOrigin: `${u(spec.origin.x - spec.box.x)} ${u(spec.origin.y - spec.box.y)}` }}
      >
        {img(spec.station)}
        {/* M1.3F: the platform's strips, unpowered, ride the lift (the plate
            copy under this group is covered by the station while it shows),
            and light along their paths. Loaded through img(), so the group
            never shows before they decode. */}
        {strips.map(({ p, k }) => (
          <PowerPart key={`dim-${k}`} id={id} index={k} side="dim" origin={spec.box}>
            {img(UNPOWERED_LIFT, "", partFrame(p.box))}
          </PowerPart>
        ))}
        {/* The strip light (and its arrival flare) only where powered. */}
        {strips.map(({ p, k }) => (
          <PowerPart key={`on-${k}`} id={id} index={k} side="powered" origin={spec.box}>
            {img(spec.light, "lab-lift-light", partFrame(p.box))}
            {/* M1.3D arrival response: the same light, raised briefly. */}
            {img(spec.light, "opacity-0", partFrame(p.box), { "data-flare": id, "data-flare-kind": "platform" })}
          </PowerPart>
        ))}
        {/* M1.3C screen / diagnostics activation rides the lift. */}
        <StationActivation id={id} origin={spec.box} />
      </div>
    </div>
  );
}

/**
 * M1.3I: the floor joint where the platform stands, a few px inside its
 * contact line: covered by the station at rest, a thin seam in the gap when
 * it lifts. A faint dark joint, faded at its ends; vector, so it stays sharp
 * at any zoom. M1.3J.4: lighter (0.55 -> 0.3) and without the lit lip, which
 * together read as the edge of a step and closed the gap visually.
 */
function Foundation({ id, spec, foundation }: { id: ZoneId; spec: StationLayerSpec; foundation: NonNullable<Station25D["foundation"]> }) {
  const fade = (key: string, color: string, opacity: number) => (
    <linearGradient id={`lab-foundation-${key}-${id}`} gradientUnits="userSpaceOnUse" x1={foundation.x0} x2={foundation.x1} y1="0" y2="0">
      <stop offset="0" stopColor={color} stopOpacity="0" />
      <stop offset="0.08" stopColor={color} stopOpacity={opacity} />
      <stop offset="0.92" stopColor={color} stopOpacity={opacity} />
      <stop offset="1" stopColor={color} stopOpacity="0" />
    </linearGradient>
  );
  return (
    <svg className="lab-foundation absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${spec.box.w} ${spec.box.h}`} aria-hidden="true" data-foundation={id}>
      <defs>
        {fade("joint", "rgb(6 5 6)", 0.3)}
      </defs>
      <path d={foundation.path} fill="none" stroke={`url(#lab-foundation-joint-${id})`} strokeWidth={1.1} strokeLinecap="round" />
    </svg>
  );
}
