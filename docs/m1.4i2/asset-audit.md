# M1.4I.2: Asset audit

Every scene file `/lab-v2` loads: 85 files, 179.5 MB decoded with the floor tone (84 and 173.5 MB without). Before: 416.7 MB. Regenerate with `work/loaded.mjs` and `work/audit.py`; crop coordinates are in `crop-map.json`.

Decoded size is width × height × 4 bytes. All sources are full-frame layers drawn over the whole 1672 × 941 scene, unless stated. No animation moves their pixels outside their bounds: what moves is a mask, an opacity, a sprite frame or the wrapper (Playground's reflection drops with its wrapper and is cropped together with it).

### Cropped

| Source (1672 × 941, 6.00 MB) | Visible bounds (x, y, w × h) | Alpha > 0 | Crop (x, y, w × h) | Decoded | File, kB |
|---|---|---|---|---|---|
| `m14h4/floor-light.png` | 498, 397, 504 × 276 | 0.06 % | 496, 395, 508 × 280 | 0.54 MB | 8 → 2 |
| `m14g/contact.png` | 98, 399, 1565 × 398 | 1.23 % | 96, 397, 1569 × 402 | 2.41 MB | 10 → 6 |
| `m14g1/playground-ring.png` | 1043, 502, 350 × 50 | 0.31 % | 1041, 500, 354 × 54 | 0.07 MB | 8 → 2 |
| `m14g1/playground-ring-lit.png` | 1041, 501, 354 × 52 | 0.43 % | 1039, 499, 358 × 56 | 0.08 MB | 9 → 3 |
| `m14g1/playground-occlusion.png` | 1055, 501, 327 × 179 | 2.37 % | 1053, 499, 331 × 183 | 0.23 MB | 11 → 5 |
| `m14g1/playground-reflection.png` | 1073, 565, 291 × 116 | 1.13 % | 1071, 563, 295 × 120 | 0.14 MB | 29 → 19 |
| `m14g1/playground-reflection-lit.png` | 1132, 524, 245 × 75 | 0.40 % | 1130, 522, 249 × 79 | 0.07 MB | 13 → 5 |
| `m14e/fg-table.png` | 0, 733, 448 × 208 | 4.14 % | 0, 731, 450 × 210 | 0.36 MB | 99 → 86 |
| `m14e/fg-plant.png` | 1396, 806, 276 × 135 | 1.59 % | 1394, 804, 278 × 137 | 0.14 MB | 43 → 33 |
| `m14h1/engineering-strip-floor.png` | 336, 550, 148 × 12 | 0.10 % | 334, 548, 152 × 16 | 0.01 MB | 9 → 3 |
| `m14h1/engineering-strip-off.png` | 354, 514, 243 × 38 | 0.17 % | 352, 512, 247 × 42 | 0.04 MB | 11 → 4 |
| `m14h1/engineering-strip-light.png` | 354, 514, 243 × 38 | 0.17 % | 352, 512, 247 × 42 | 0.04 MB | 12 → 5 |
| `m14h1/engineering-screen-bars.png` | 438, 452, 55 × 20 | 0.04 % | 436, 450, 59 × 24 | 0.01 MB | 8 → 1 |
| `m14h1/engineering-chart.png` | 481, 398, 75 × 77 | 0.21 % | 479, 396, 79 × 81 | 0.02 MB | 16 → 8 |
| `m14h1/engineering-floor.png` | 238, 515, 381 × 156 | 1.31 % | 236, 513, 385 × 160 | 0.23 MB | 38 → 28 |
| `m14f1/educational.png` | 667, 272, 328 × 225 | 3.50 % | 665, 270, 332 × 229 | 0.29 MB | 143 → 129 |
| `m14f1/educational-light.png` | 666, 269, 337 × 243 | 0.78 % | 664, 267, 341 × 247 | 0.32 MB | 45 → 35 |
| `m14h2/educational-body.png` | 667, 272, 328 × 225 | 2.76 % | 665, 270, 332 × 229 | 0.29 MB | 114 → 100 |
| `m14h2/educational-globe.png` | 667, 272, 327 × 168 | 1.15 % | 665, 270, 331 × 172 | 0.22 MB | 65 → 54 |
| `m14h2/educational-globe-light.png` | 666, 269, 331 × 159 | 0.67 % | 664, 267, 335 × 163 | 0.21 MB | 40 → 30 |
| `m14h2/educational-orbit.png` | 668, 305, 326 × 132 | 0.14 % | 666, 303, 330 × 136 | 0.17 MB | 15 → 9 |
| `m14h2/educational-orbit-light.png` | 666, 302, 330 × 126 | 0.08 % | 664, 300, 334 × 130 | 0.17 MB | 11 → 5 |
| `m14h2/educational-strip-floor.png` | 673, 481, 330 × 31 | 0.06 % | 671, 479, 334 × 35 | 0.04 MB | 9 → 3 |
| `m14h2/educational-strip-off.png` | 682, 450, 313 × 47 | 0.20 % | 680, 448, 317 × 51 | 0.06 MB | 13 → 6 |
| `m14h2/educational-strip-light.png` | 682, 450, 313 × 47 | 0.20 % | 680, 448, 317 × 51 | 0.06 MB | 15 → 8 |
| `m14h2/educational-base.png` | 666, 393, 322 × 47 | 0.33 % | 664, 391, 326 × 51 | 0.06 MB | 22 → 14 |
| `m14h2/educational-flare.png` | 666, 269, 331 × 160 | 1.17 % | 664, 267, 335 × 164 | 0.21 MB | 59 → 49 |
| `m14h2/educational-floor.png` | 663, 474, 351 × 105 | 0.92 % | 661, 472, 355 × 109 | 0.15 MB | 27 → 18 |
| `m14h2/educational-floor-cyan.png` | 683, 521, 305 × 54 | 0.24 % | 681, 519, 309 × 58 | 0.07 MB | 12 → 5 |
| `m14h3/creative-strip-floor.png` | 181, 735, 339 × 65 | 0.33 % | 179, 733, 343 × 69 | 0.09 MB | 21 → 13 |
| `m14h3/creative-strip-off.png` | 180, 723, 322 × 57 | 0.17 % | 178, 721, 326 × 61 | 0.08 MB | 13 → 6 |
| `m14h3/creative-strip-light.png` | 180, 723, 322 × 57 | 0.14 % | 178, 721, 326 × 61 | 0.08 MB | 13 → 6 |
| `m14h3/creative-standby.png` | 176, 549, 248 × 137 | 1.04 % | 174, 547, 252 × 141 | 0.14 MB | 46 → 36 |
| `m14h3/creative-warm.png` | 195, 630, 137 × 51 | 0.12 % | 193, 628, 141 × 55 | 0.03 MB | 13 → 6 |
| `m14h3/creative-highlights.png` | 180, 549, 243 × 137 | 0.60 % | 178, 547, 247 × 141 | 0.13 MB | 34 → 25 |
| `m14h3/creative-floor.png` | 51, 671, 503 × 143 | 0.45 % | 49, 669, 507 × 147 | 0.28 MB | 21 → 13 |
| `m14h3/creative-floor-top.png` | 197, 811, 306 × 65 | 0.53 % | 195, 809, 310 × 69 | 0.08 MB | 17 → 9 |
| `m14h4/experience-strip-off.png` | 1200, 717, 444 × 67 | 0.23 % | 1198, 715, 448 × 71 | 0.12 MB | 15 → 8 |
| `m14h4/experience-strip-light.png` | 1201, 717, 443 × 67 | 0.18 % | 1199, 715, 447 × 71 | 0.12 MB | 14 → 7 |
| `m14h4/experience-standby.png` | 1388, 567, 178 × 152 | 0.80 % | 1386, 565, 182 × 156 | 0.11 MB | 40 → 31 |
| `m14h4/experience-floor.png` | 1052, 676, 620 × 153 | 0.95 % | 1050, 674, 622 × 157 | 0.37 MB | 33 → 25 |
| `m14h4/experience-floor-lit.png` | 1052, 676, 620 × 153 | 0.92 % | 1050, 674, 622 × 157 | 0.37 MB | 32 → 23 |
| `m14h4/experience-floor-top.png` | 1210, 824, 328 × 80 | 0.70 % | 1208, 822, 332 × 84 | 0.11 MB | 19 → 11 |
| **43 files** | | | | **258.1 → 8.8 MB** | 1265 → 912 |

### Left as they are

| File | Size | Visible bounds | Alpha > 0 | Decoded | If cropped |
|---|---|---|---|---|---|
| `v2/m14h4/experience-light.png` | 1656 × 1536 | 10, 144, 1639 × 1301 | 3.12 % | 9.70 MB | 8.13 MB |
| `v2/m14h4/experience-reveal.png` | 1656 × 1536 | 2, 37, 1650 × 1485 | 23.32 % | 9.70 MB | 9.35 MB |
| `v2/m14h2/educational-light.png` | 2112 × 1050 | 9, 100, 2094 × 936 | 2.71 % | 8.46 MB | 7.48 MB |
| `v2/environment/lab-background.png` | 1672 × 941 | 0, 0, 1672 × 941 | 100.00 % | 6.00 MB | 6.00 MB |
| `v2/m14e/fg-steam.png` | 1672 × 941 | 246, 712, 79 × 82 | 0.30 % | 6.00 MB | 0.02 MB |
| `v2/m14e/hub-light.png` | 1672 × 941 | 706, 517, 269 × 216 | 0.62 % | 6.00 MB | 0.22 MB |
| `v2/m14e/hub.png` | 1672 × 941 | 640, 552, 401 × 104 | 1.93 % | 6.00 MB | 0.16 MB |
| `v2/m14e1/playground-route-core.png` | 1672 × 941 | 896, 538, 195 × 34 | 0.04 % | 6.00 MB | 0.03 MB |
| `v2/m14e1/playground-route-glow.png` | 1672 × 941 | 892, 535, 204 × 42 | 0.17 % | 6.00 MB | 0.03 MB |
| `v2/m14e1/playground-route-wide.png` | 1672 × 941 | 885, 531, 218 × 53 | 0.36 % | 6.00 MB | 0.04 MB |
| `v2/m14e1/playground-strip-off.png` | 1672 × 941 | 675, 660, 761 × 83 | 0.78 % | 6.00 MB | 0.24 MB |
| `v2/m14f/creative.png` | 1672 × 941 | 97, 508, 405 × 272 | 3.83 % | 6.00 MB | 0.42 MB |
| `v2/m14f/experience-light.png` | 1672 × 941 | 1193, 715, 453 × 85 | 0.34 % | 6.00 MB | 0.15 MB |
| `v2/m14f/experience.png` | 1672 × 941 | 1200, 513, 463 × 272 | 4.90 % | 6.00 MB | 0.48 MB |
| `v2/m14f1/engineering.png` | 1672 × 941 | 262, 384, 338 × 168 | 2.50 % | 6.00 MB | 0.22 MB |
| `v2/m14g/floor-mask.png` | 1672 × 941 | 0, 427, 1672 × 514 | 53.09 % | 6.00 MB | 3.28 MB |
| `v2/m14g1/creative-light.png` | 1672 × 941 | 181, 735, 339 × 65 | 0.33 % | 6.00 MB | 0.08 MB |
| `v2/m14h1/engineering-body-light.png` | 1672 × 941 | 304, 458, 50 × 32 | 0.04 % | 6.00 MB | 0.01 MB |
| `v2/m14h1/engineering-body.png` | 1672 × 941 | 262, 384, 338 × 168 | 2.29 % | 6.00 MB | 0.22 MB |
| `v2/m14h1/engineering-chart-light.png` | 1672 × 941 | 480, 396, 78 × 79 | 0.19 % | 6.00 MB | 0.02 MB |
| `v2/m14h1/engineering-chart.png` | 1672 × 941 | 481, 398, 75 × 77 | 0.21 % | 6.00 MB | 0.02 MB |
| `v2/m14h1/engineering-screen-mask.png` | 1672 × 941 | 346, 390, 143 × 85 | 0.70 % | 6.00 MB | 0.05 MB |
| `v2/m14h2/educational-ring-core.png` | 1672 × 941 | 670, 307, 327 × 131 | 0.27 % | 6.00 MB | 0.16 MB |
| `v2/stations/playground.png` | 1672 × 941 | 105, 19, 1515 × 922 | 19.75 % | 6.00 MB | 5.33 MB |
| `v2/m14h3/creative-crest.png` | 1608 × 608 | 10, 23, 1592 × 581 | 17.92 % | 3.73 MB | 3.53 MB |
| `v2/m14h3/creative-glints.png` | 1608 × 608 | 24, 11, 1569 × 514 | 1.24 % | 3.73 MB | 3.08 MB |
| `v2/m14h3/creative-sunrise.png` | 1608 × 608 | 0, 0, 1608 × 608 | 78.89 % | 3.73 MB | 3.73 MB |
| `activation/core.png` | 836 × 471 | 380, 256, 78 × 59 | 0.76 % | 1.50 MB | 0.02 MB |
| `v2/m14h2/educational-crest.png` | 4094 × 94 | 178, 0, 3727 × 94 | 43.56 % | 1.47 MB | 1.34 MB |
| `v2/m14h2/educational-wave.png` | 4094 × 94 | 178, 0, 3916 × 94 | 67.38 % | 1.47 MB | 1.40 MB |
| 12 smaller files (already cropped line masks and traces) | | | | 1.13 MB | |

### Why these were left

| Files | Reason |
|---|---|
| `hub`, `hub-light`, `fg-steam`, `engineering`, `engineering-body`, `-body-light`, `-chart-light`, `creative`, `creative-light`, `experience`, `experience-light` (m14f) | Chrome composites each on its own, straight to the screen. Every crop tried came out up to 21–49 levels different |
| `playground.png`, `playground-strip-off.png` | Drawn at 0.39 scale from a reduced copy that depends on the canvas size (941 is odd); a crop shifts it. `playground.png`'s bounds are nearly the whole frame anyway |
| Masks: `engineering-screen-mask`, `educational-ring-core`, `floor-mask`, `engineering-chart` (as a mask), `playground-route-*` | A cropped mask is placed on another pixel grid: up to 9 levels (chart) and 68 (route) where tried. The other three were not tried |
| Sprites: wave, crest, light, sunrise, glints, reveal | Frame grids: their frame arithmetic relies on the canvas, and they are nearly full |
| `lab-background.png` | Opaque |
| `core.png` | Shared with the homepage, half resolution |
