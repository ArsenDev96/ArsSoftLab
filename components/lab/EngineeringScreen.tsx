"use client";

import { useEffect, useRef } from "react";
import { SCENE, u } from "@/lib/scene";
import { ENG_SCREEN_QUAD } from "./engineering-v2";

/**
 * M1.4H.1 (/lab-v2 only): what moves across Engineering's laptop display, drawn
 * in the display's own perspective. A QW x QH box is warped onto the measured
 * display quad by a projective matrix3d (the lid is seen in perspective: its
 * sides converge), so a horizontal band in the box is the line across the
 * display at that depth. Each layer is a full-frame wrapper masked to the
 * display (engineering-screen-mask.png), so nothing reaches the bezel, the
 * chart's panel, the stone or the floor.
 *
 *   shade   the display's standby dimming below the scan line (the rest of the
 *           display is already revealed): normal
 *   band    the scan line itself: a crisp light core, a short trailing wash
 *           and a 2 px lead, added (plus-lighter on the masked wrapper, so it
 *           adds to the display rather than covering it)
 *
 * The line's position is --es (0 at the top, 1 past the bottom), a registered
 * number driven by CSS from the energy's arrival (EngineeringV2): no script
 * runs the animation, so leaving, quick returns and selection are CSS's. The
 * script only places the warp (and again on resize); until then both layers
 * are transparent at rest.
 */

/** The warped box, CSS px (about the display's own size in scene px). */
export const QW = 128;
export const QH = 83;

type Pt = readonly [number, number];

/** QW x QH box -> quad, as a CSS matrix3d (Heckbert's square-to-quad). */
function squareToQuad([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]: readonly Pt[]) {
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  const m = [(x1 - x0 + g * x1) / QW, (y1 - y0 + g * y1) / QW, 0, g / QW, (x3 - x0 + h * x3) / QH, (y3 - y0 + h * y3) / QH, 0, h / QH, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toPrecision(7)).join(", ")})`;
}

/** M1.4I.2: everything the display's mask shows lies in here (the mask is the edge; this only bounds the layer). */
export const ENG_DISPLAY_CLIP = { x: 340, y: 384, w: 156, h: 98 } as const;
const D = ENG_DISPLAY_CLIP;
const CLIP_PATH = `inset(${u(D.y)} ${u(SCENE.width - D.x - D.w)} ${u(SCENE.height - D.y - D.h)} ${u(D.x)})`;

const MASK = "url(/scene/v2/m14h1/engineering-screen-mask.png)";

export function EngineeringScreenLayer({ kind }: { kind: "shade" | "band" }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const box = boxRef.current;
    if (!wrap || !box) return;
    const place = () => {
      const unit = wrap.offsetWidth / SCENE.width;
      if (unit > 0) box.style.transform = squareToQuad(ENG_SCREEN_QUAD.map(([x, y]) => [x * unit, y * unit] as const));
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      data-eng-screen={kind}
      className="pointer-events-none absolute inset-0"
      style={{
        clipPath: CLIP_PATH,
        maskImage: MASK,
        WebkitMaskImage: MASK,
        maskSize: "100% 100%",
        WebkitMaskSize: "100% 100%",
        mixBlendMode: kind === "band" ? "plus-lighter" : undefined,
      }}
    >
      <div ref={boxRef} className="absolute top-0 left-0" style={{ width: `${QW}px`, height: `${QH}px`, transformOrigin: "0 0" }}>
        {kind === "shade" ? (
          // Below the line, the display is still in standby (bleeds past the quad: the mask is the edge).
          <span className="eng-scan-shade absolute" style={{ left: -4, right: -4, top: "calc(var(--es) * 100%)", bottom: -4 }} />
        ) : (
          <span className="eng-scan-band absolute" style={{ left: -4, right: -4, top: "calc(var(--es) * 100%)", height: 0 }}>
            {/* the revealed side's wash, above the line */}
            <span className="absolute inset-x-0" style={{ bottom: 0, height: 9, background: "linear-gradient(180deg, transparent, rgb(70 200 255 / 0.22))" }} />
            {/* the line: crisp, 1.4 px */}
            <span className="absolute inset-x-0" style={{ top: -0.7, height: 1.4, background: "rgb(200 248 255 / 0.92)" }} />
            {/* its lead into the standby side */}
            <span className="absolute inset-x-0" style={{ top: 0.7, height: 2, background: "linear-gradient(180deg, rgb(120 225 255 / 0.4), transparent)" }} />
          </span>
        )}
      </div>
    </div>
  );
}
