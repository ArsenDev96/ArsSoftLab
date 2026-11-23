import type { ScenePoint } from "@/lib/scene";
import { STATION_LAYOUT, type HotspotShape } from "./scene-layout";

/**
 * M1.4I.1C (/lab-v2 only): Playground's hotspot with the cabinet's head, which
 * carries the "ArsSoftLab" sign. The shared hotspot's top edge (y 352) is the
 * approved plate's cabinet; the v2 cabinet is taller (its sign is y 331-350).
 *
 * The head follows the artwork's silhouette within 5 px, measured from the
 * station image (docs/m1.4i1/work/sign-geometry.mjs), plus a sliver beside it
 * as far as the station's label, so moving across doesn't drop the hover. The
 * rest of the outline is the shared hotspot's own.
 *
 * The cabinet rises with the lift, so the head's points do too (LabStations):
 * the raised sign stays part of the same target, and while the station is down
 * the wall above the sign isn't one.
 */
const HEAD: ScenePoint[] = [
  { x: 1149, y: 325.5 },
  { x: 1233, y: 324.5 },
  { x: 1237, y: 318.5 },
  { x: 1257, y: 318.5 },
  { x: 1272, y: 327 },
  { x: 1278, y: 334 },
  { x: 1288, y: 334 },
];

/** Where the lift (18 px, x1.01 about the base: globals.css, SceneV2) takes a point. */
const raise = ({ x, y }: ScenePoint): ScenePoint => ({ x: 1218 + (x - 1218) * 1.01, y: 547 + (y - 547) * 1.01 - 18 });

const base = STATION_LAYOUT.playground.hotspot;
/** The shared outline's top edge runs from (1130, 352) to (1262, 352): the head goes in between. */
const top = base.findIndex((p) => p.x === 1130 && p.y === 352) + 1;
const withHead = (head: ScenePoint[]): ScenePoint[] => [...base.slice(0, top), { x: 1143, y: 352 }, ...head, { x: 1288, y: 352 }, ...base.slice(top)];

export const PLAYGROUND_HOTSPOT_V2: HotspotShape = { rest: withHead(HEAD), raised: withHead(HEAD.map(raise)) };
