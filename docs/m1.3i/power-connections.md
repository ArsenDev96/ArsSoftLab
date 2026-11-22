# M1.3I power connections

How the five connections from the central A became independent, floor-anchored layers, and what was kept from M1.3G.

## Before (approved, default build)

The lines are **painted into the plate**, lit. At rest an opaque "unpowered" copy of the plate (with the line's light removed) covers each line. Charging slides that copy away behind the spark, uncovering the plate's lit line and adding a glow. The line therefore can't exist without the background image, and the background can't exist without the line.

## Now (experimental, `NEXT_PUBLIC_LAB_LAYERED=on`)

| Layer | Where | What |
|---|---|---|
| Environment | Plate layer, static | `environment-corrections.png`: the floor with **all five lines removed**. |
| 1. Unpowered physical trace | Charge window, ahead of the front | `layers25d/lines/<id>-<part>-trace.png`: the faint, sharp unlit line. |
| 2. Sharp illuminated core | Charge window, behind the front | `<id>-<part>-lit.png` (the painted lit line, from the artwork) plus a **vector core**: an SVG path along the traced route, 1.8 px, `rgb(255 232 196 / 0.5)`. |
| 3. Restrained glow | Behind the front | The M1.3G per-part glow mask, `rgb(255 176 90 / 0.34)`, unchanged. |
| 4. Travelling spark and tail | Fx layer | `EnergySurge`, unchanged. |
| 5. Charge and drain | Charge windows | `ChargeLine` windows and `chargeAnimations`, unchanged. |

All of this is in the lights layer or below it. Nothing is inside a station's lift, so the connections stay on the ground while Playground rises (`connections.webm`; probe "Grounded").

## Geometry

- **Routes.** The routes are the M1.3G and M1.3E.2 traces from the plate, unchanged: brightness-weighted centre lines sampled every 7–8 px, in `charge-routes.ts` and `playground-route.ts`. They follow the painted curves; there are no straight shortcuts.
  - Playground: across the central platform's rim, then the floor.
  - Engineering: along the rim, then the floor.
  - Creative Studio and Experience: curved, three parts each.
  - Educational: straight.
- **SVG paths.** `make-scene-layers.mjs` writes each part's route as a Catmull-Rom curve converted to cubic Béziers (`CONNECTION_LAYERS[id].parts[k].path`). This is the resolution-independent geometry. Today it draws the powered core; it could also drive a vector spark or a vector unpowered trace later.
- **Raster for the painted look.** The trace and lit line stay raster, cut from the artwork, because they carry the painting's perspective, width falloff, colour and its interaction with the floor's grain. A uniform vector stroke can't reproduce that, and would risk reading as a new neon line. The brief allowed raster where it preserves the painted look. Only the thin powered core is vector; at normal size it is indistinguishable from the approved core (`connections-3x.png`). A vector trace was not tried.

## How the layers reproduce the approved scene

- **At rest.** Where a part's approved unpowered overlay has a pixel, the trace is that pixel, in the same window. Elsewhere, where the environment was changed beside the line (its tone matched), the trace is solved so that over the environment it gives the approved pixel. Every environment change is inside a line's charge window (generator check: 0 px outside).
- **Powered.** The lit layer is the plate's own pixels, the same way.
- **Opaque where it matters.** The charge windows draw their content through a rotated frame, which Chrome resamples twice. A transparent layer with sharp structure would show that half-pixel softening against the static floor. So both layers are opaque in the line's core, and wherever they differ from the environment by more than 4/255, exactly as the approved overlays are.

### Measured (1648 × 928, `probes.txt`)

| State | Result |
|---|---|
| Idle, whole frame, outside the 16 window joints and line ends | Mean 0.023/255; 256 px over 12/255 (0.017%); max 43. These are on the plate's own sharp line core at bends and starts where the approved build has no overlay, drawn through the window here (`checks/idle-worst-8x.png`). |
| Idle, including joints and ends | Max 92 on 458 px. At the joints the **approved** build leaks a 1 px hairline of the baked lit line between windows; the experimental build has no baked line to leak (`checks/window-seams-8x.png`). |
| Powered (Playground lifted), lines and central platform, station excluded | Mean 0.15; 436 px over 12; max 52. The vector core is slightly crisper than the plate's own core. |

## Sequence (unchanged, verified)

| Step | Evidence |
|---|---|
| 1. The spark leaves the central A | `EnergySurge`, unchanged |
| 2. The connection charges progressively | Probe: 330 ms after hover, part 1 is 99.5% charged and part 2 19% |
| 3. The spark arrives (650 ms for Playground) | Unchanged `SURGE_ARRIVE_MS` |
| 4. The platform strips light along their paths | Probe: `--pw` = 1, strip light 0.75 (rides the lift) |
| 5. Station effects start (lift, arcade) | Probes: lift −18 px; arcade shown, at opacity 1 |
| 6. The platform drains on exit | `POWER_CSS`, unchanged |
| 7. The connection retracts toward the A | Probe: the station part empties first, then the A part; never refills; back to unpowered |
| Nothing powers before arrival | `--arrive-now` gating, unchanged |
| Interruption and switching | Probe: switching to Engineering mid-lift drops Playground and drains its line; nothing is left on |
| Reduced motion | Probe: powered at once, no spark, no lift |

## Limitations

- **Window resampling.** The trace and lit layers are drawn through the M1.3G charge windows: transform-moved frames with counter-moved content, rotated along each part. That keeps all the charge and drain logic, but makes the layers resample. A reveal driven by masks (a CSS variable per part, with the layers drawn pixel-aligned) would remove this. It would mean changing `chargeAnimations` and `currentChargeU` in `EnergySurge`, which the brief asked not to rewrite unnecessarily.
- **Line joints.** The faint darker seam at window joints is the line-free floor showing through a 1 px gap. It is better than the approved build's bright leak, but still visible at 8×.
- **Underneath the stations.** Under the stations the lines are still whatever the plate has, because the stations aren't removed yet.
