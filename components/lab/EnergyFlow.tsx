import { MaskedLight, type LightPass } from "./MaskedLight";
import { ENERGY_BOX, energyTracks } from "./scene-fx";

/**
 * Experiment A: energy pulses travelling from the central A to each station.
 *
 * The pulse is a soft light moved by transform only, seen through a pixel
 * mask of the *existing* amber lines. It can only brighten light that is
 * already there: no new strokes, no duplicated lines, and nothing on the
 * central platform (the mask is empty there).
 */

const CYCLE_S = 8;

const PASSES: LightPass[] = [
  { name: "halo", mask: "/scene/masks/connections-glow.png", w: 150, h: 36, color: "rgb(255 190 110 / 0.5)" },
  { name: "core", mask: "/scene/masks/connections.png", w: 120, h: 16, color: "rgb(255 244 222 / 0.85)" },
];

/** Half the longest blob plus margin: fully off the line at rest. */
const LEAD = Math.max(...PASSES.map((p) => p.w)) / 2 + 16;
const TRACKS = energyTracks(LEAD);

export function EnergyFlow() {
  return (
    <MaskedLight
      id="lab-energy"
      className="lab-energy"
      box={ENERGY_BOX}
      durationS={CYCLE_S}
      passes={PASSES}
      tracks={TRACKS}
    />
  );
}
