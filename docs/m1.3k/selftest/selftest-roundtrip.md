# Delivery check: selftest-roundtrip

Source: `E:\ArsSoftLab\docs\m1.3k\selftest\inputs\current-synthesised-environment.png`

| Result | Check | Finding |
|---|---|---|
| OK | size | 1672 x 941. |
| OK | alignment | Aligned (best offset 0, 0); mean difference around the station 0.00 levels. |
| OK | outside-mask | Approved pixels outside the remove mask are unchanged. |
| INFO | margin | Blend margin: 0 of 5502 px changed. They are visible at rest and never taken from the delivery. |
| OK | station-removed | Station interior repainted (2.6% still equal to the plate). |
| OK | station-light | 0 px of neon-purple or strip-orange colour inside the footprint (station light must not be baked in). |
| INFO | sharpness | Fine detail in the uncovered floor 3.37 vs real floor 2.42 (ratio 1.40): within the range of the real floor; blur is judged visually. |
| INFO | tone | Uncovered floor luminance 45.3; real floor beside and in front 35.8. Judge visually: the floor under the platform may be slightly darker (worn disc). |
| OK | seam | Mean step across the footprint's edge 7.62 vs 6.97 between neighbouring original pixels. |
| WARN | repetition | 9 of 97 floor windows (20 x 8 px) have a near-copy or mirror elsewhere (NCC > 0.85; worst 0.98; real floor's own worst 0.83). |
| OK | at-rest | Station over this environment vs the plate (what rest shows): mean 1.08, 99th percentile 8.3, max 223 levels; current layers 8.3. This is what appears at the layer switch on arrival (the current cut-out; staging re-solves its soft-edge colour, so the switch stays as it is today). |

Sheets: `review-2x.png`, `gap-3x.png`, `difference-from-plate-x8.png`.

Automatic checks cannot judge perspective, believability or design fidelity: the owner's visual review (SA-1) decides.
