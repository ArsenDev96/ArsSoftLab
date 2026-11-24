import type { ZoneId } from "@/data/zones";
import type { ScenePoint } from "@/lib/scene";
import { poly } from "./scene-layout";

/**
 * M1.4I.1E (/lab-v2 only): the space between each station's platform or
 * artwork and its own label (and between the label's icon, title and chips).
 * A lit station keeps its hover while the pointer crosses it, so moving between
 * them never restarts the activation (LabStations, [data-bridge]).
 *
 * A bridge only holds: it takes the pointer while its own station is hovered
 * and is not there otherwise, so the empty lab stays empty and at most one
 * exists at a time. It is not a control (no click, focus or name). Every
 * hotspot and label lies above every bridge, so a neighbouring station always
 * wins; the outlines also stay clear of the other stations' hotspots, the
 * central A and the connections.
 *
 * Outlines: what the straight moves between a hotspot and its label cross
 * (docs/m1.4i1e/work/coverage.py); their inner edges run under the station's
 * own hotspot and label. Playground's also has the 18 px its label rises
 * through, so the label can leave a still pointer without the hover going.
 */
export const STATION_BRIDGES_V2: Record<ZoneId, readonly ScenePoint[]> = {
  educational: poly(759, 223, 933, 223, 976, 253, 977, 280, 996, 310, 990, 345, 700, 360, 691, 350, 757, 246),
  engineering: poly(358, 323, 535, 321, 613, 352, 613, 380, 601, 507, 560, 510, 340, 495, 278, 488, 357, 336),
  playground: poly(1256, 298, 1290, 304, 1397, 304, 1397, 347, 1376, 492, 1340, 500, 1262, 470, 1256, 340),
  // Its top edge stays 3 px or more below Engineering's hotspot (y 553).
  creative: poly(333, 556, 430, 562, 558, 573, 558, 598, 509, 688, 480, 705, 436, 680, 330, 665),
  // Its top edge stays about 6 px below Playground's hotspot (y 556).
  experience: poly(1214, 562, 1342, 562, 1379, 546, 1390, 522, 1400, 660, 1260, 675, 1207, 690, 1213, 604),
};
