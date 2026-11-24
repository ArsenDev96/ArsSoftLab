import type { CSSProperties } from "react";
import { SCENE } from "@/lib/scene";
import { SCENE_CROPS } from "./scene-crops";

/** Chromium. PlateGate tests the same, to wait for the file that is drawn. */
const CROPS_HERE = "(object-view-box:none)";

/**
 * M1.4I.2 (/lab-v2 only): a full-frame scene layer drawn from its lossless
 * crop (scene-crops.ts, scripts/m14i2-crop.py). `src` names the full-frame
 * source, and everything else still works in the 1672 x 941 scene: the element
 * keeps the full-frame box its <img> had (same class, same style).
 *
 * It is an SVG whose viewBox is the scene, so a crop is placed by its scene
 * rectangle and nothing else. A cropped <img> in a box of its own would be
 * snapped to the device's pixels by itself, and resample differently from the
 * full frame (and from its neighbours).
 *
 * Browsers round an <img>'s box to device pixels and scale the image into
 * that, but don't round an SVG's. SCENE_IMAGE_CSS gives the SVG the rounded
 * size, so its pixels are the <img>'s (docs/m1.4i2/visual-equivalence.md).
 *
 * Only where that is verified, in Chromium (CROPS_HERE). Firefox snaps every
 * image on the page by itself, also inside an SVG, so a crop can land up to
 * 0.7 px off: elsewhere the element draws the full-frame source as its
 * background, as the <img> did.
 *
 * A source without a crop is drawn as the plain <img>.
 */
export function SceneImage({ src, className = "", style, ...data }: { src: string; className?: string; style?: CSSProperties } & Record<`data-${string}`, string | undefined>) {
  if (!SCENE_CROPS[src]) {
    // eslint-disable-next-line @next/next/no-img-element -- full-frame layer at the scene's geometry, no optimisation
    return <img src={src} alt="" draggable={false} data-gate="" className={className} style={style} {...data} />;
  }
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${SCENE.width} ${SCENE.height}`} preserveAspectRatio="none" className={`lab-scene-image ${className}`} style={{ ...style, ["--full" as string]: `url(${src})` }} {...data}>
      <SceneImageInSvg src={src} gate />
    </svg>
  );
}

/** The same, inside an SVG that already works in scene px. `gate`: the scene is shown once it has decoded (PlateGate). */
export function SceneImageInSvg({ src, mask, gate }: { src: string; mask?: string; gate?: boolean }) {
  const { src: href, x, y, w, h } = SCENE_CROPS[src] ?? { src, x: 0, y: 0, w: SCENE.width, h: SCENE.height };
  return <image href={href} x={x} y={y} width={w} height={h} preserveAspectRatio="none" mask={mask} data-gate={gate ? "" : undefined} data-full={gate ? src : undefined} />;
}

/**
 * Device pixels per CSS px (Windows scaling, browser zoom) the size is rounded
 * for: --dp is one device pixel. At any other ratio the size is left as it is,
 * at most half a device pixel off at the scene's far edge.
 */
const RATIOS = [0.5, 2 / 3, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
/** The frame's size as the browser lays it out (in 1/64 device px), rounded to device pixels. */
const snapped = (n: number) => `round(nearest, round(down, var(--u) * ${n}, var(--dp) / 64), var(--dp))`;
const RATIO_QUERIES = RATIOS.map((r) => `(min-resolution:${+(r - 0.008).toFixed(4)}dppx) and (max-resolution:${+(r + 0.008).toFixed(4)}dppx)`);

export const SCENE_IMAGE_CSS =
  RATIOS.map((r, k) => `@media ${RATIO_QUERIES[k]}{:root{--dp:${+(1 / r).toFixed(6)}px}}`).join("") +
  `.lab-scene-image{background:var(--full) 0 0/100% 100% no-repeat}.lab-scene-image image{display:none}` +
  `@supports ${CROPS_HERE}{.lab-scene-image{background:none}.lab-scene-image image{display:inline}}` +
  `@supports ${CROPS_HERE} and (width:round(nearest,1px,1px)){@media ${RATIO_QUERIES.join(",")}` +
  `{.lab-scene-image{width:${snapped(SCENE.width)}!important;height:${snapped(SCENE.height)}!important}}}`;
