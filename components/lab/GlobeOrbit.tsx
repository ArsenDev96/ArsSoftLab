import { MaskedLight, type LightPass } from "./MaskedLight";
import { ORBIT_BOX, orbitTrack } from "./scene-fx";

/**
 * Experiment B: a slow light travelling around the Educational globe's orbit.
 *
 * The globe, its glass shells and the terrain are never moved or resampled.
 * The light is seen through a pixel mask of the visible ring, so it slips
 * behind the dome, the church and the island exactly where the painted ring
 * does. The lap starts behind the dome, so the loop seam is never visible.
 *
 * At rest the light sits on that hidden span (~150 px of path), so the
 * longest blob (140 px) stays fully hidden.
 */

const CYCLE_S = 20;

/**
 * Peak intensity, reached while Educational is hovered, keyboard-focused or
 * selected. At rest the
 * whole effect runs at a lower opacity (see .lab-orbit in globals.css).
 */
const PASSES: LightPass[] = [
  { name: "halo", mask: "/scene/masks/orbit-glow.png", w: 140, h: 38, color: "rgb(255 214 150 / 0.8)" },
  { name: "core", mask: "/scene/masks/orbit.png", w: 110, h: 18, color: "rgb(255 249 236 / 1)" },
];

const TRACK = orbitTrack();

export function GlobeOrbit() {
  return (
    <MaskedLight
      id="lab-orbit"
      className="lab-orbit"
      zone="educational"
      box={ORBIT_BOX}
      durationS={CYCLE_S}
      passes={PASSES}
      tracks={[TRACK]}
    />
  );
}
