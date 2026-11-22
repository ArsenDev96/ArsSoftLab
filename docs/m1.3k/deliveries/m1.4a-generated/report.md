# Delivery check: m1.4a-generated

Source: `E:\ArsSoftLab\docs\m1.4a\candidates\environment.png`

| Result | Check | Finding |
|---|---|---|
| OK | size | 1672 x 941. |
| FAIL | alignment | Around the station the delivery differs from the plate by 36.2 levels on average (tolerance 1.0): repainted or regraded outside the mask. |
| FAIL | outside-mask | 1270094 px outside the remove mask differ from the approved plate (bbox x 0-1671, y 0-940). Outside the mask the delivery must be the plate. |
| INFO | margin | Blend margin: 5476 of 5502 px changed. They are visible at rest and never taken from the delivery. |
| OK | station-removed | Station interior repainted (0.2% still equal to the plate). |
| WARN | station-light | 483 px of neon-purple or strip-orange colour inside the footprint (station light must not be baked in). |
| WARN | sharpness | Fine detail in the uncovered floor 11.66 vs real floor 2.42 (ratio 4.82): much noisier than the real floor (sharpening or added noise). |
| INFO | tone | Uncovered floor luminance 90.1; real floor beside and in front 35.8. Judge visually: the floor under the platform may be slightly darker (worn disc). |
| OK | seam | Mean step across the footprint's edge 4.38 vs 6.97 between neighbouring original pixels. |
| WARN | repetition | 11 of 97 floor windows (20 x 8 px) have a near-copy or mirror elsewhere (NCC > 0.85; worst 0.91; real floor's own worst 0.83). |
| FAIL | object-extent | The station layer has 184 px outside the remove mask: no painted background exists there. |
| INFO | object-alpha | Delivered station: 43313 px, 43213 soft-edge px (1x). |
| WARN | at-rest | Station over this environment vs the plate (what rest shows): mean 20.42, 99th percentile 140.1, max 245 levels; current layers 8.3. This is what appears at the layer switch on arrival. |

Sheets: `review-2x.png`, `gap-3x.png`, `difference-from-plate-x8.png`.

Automatic checks cannot judge perspective, believability or design fidelity: the owner's visual review (SA-1) decides.
