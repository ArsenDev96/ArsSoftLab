# Delivery check: selftest-shift

Source: `E:\ArsSoftLab\docs\m1.3k\selftest\inputs\shifted-1px.png`

| Result | Check | Finding |
|---|---|---|
| OK | size | 1672 x 941. |
| FAIL | alignment | Misaligned: matches the plate best shifted by dx 1, dy 0 px. |
| FAIL | outside-mask | 472594 px outside the remove mask differ from the approved plate (bbox x 0-1671, y 0-940). Outside the mask the delivery must be the plate. |
| INFO | margin | Blend margin: 922 of 5502 px changed. They are visible at rest and never taken from the delivery. |
| OK | station-removed | Station interior repainted (2.5% still equal to the plate). |
| OK | station-light | 0 px of neon-purple or strip-orange colour inside the footprint (station light must not be baked in). |
| INFO | sharpness | Fine detail in the uncovered floor 3.54 vs real floor 2.42 (ratio 1.46): within the range of the real floor; blur is judged visually. |
| INFO | tone | Uncovered floor luminance 45.3; real floor beside and in front 35.8. Judge visually: the floor under the platform may be slightly darker (worn disc). |
| OK | seam | Mean step across the footprint's edge 4.43 vs 6.97 between neighbouring original pixels. |
| WARN | repetition | 9 of 97 floor windows (20 x 8 px) have a near-copy or mirror elsewhere (NCC > 0.85; worst 0.98). |
| WARN | at-rest | Station over this environment vs the plate (what rest shows): mean 1.21, 99th percentile 10.6, max 223 levels; current layers 8.3. This is what appears at the layer switch on arrival (the current cut-out; staging re-solves its soft-edge colour, so the switch stays as it is today). |

Sheets: `review-2x.png`, `gap-3x.png`, `difference-from-plate-x8.png`.

Automatic checks cannot judge perspective, believability or design fidelity: the owner's visual review (SA-1) decides.
