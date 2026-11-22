# M1.3E.3: Playground power and lift refinement

This milestone makes the energy transfer and the lift more noticeable, on Playground only. It keeps the traced route, the 18 px lift, the station geometry, the game and everything else unchanged.

This is a prototype for review. It is **not** approved.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `playground-power-lift.webm` | The final animation. Full scene at 1:1 (1648 × 928), 30 fps, 7.0 s: idle, then hover with the pulse, burst, lift, push and game, then the exit. |
| `ab-camera-push.webm` | A/B side by side, 4.2 s, 1:1 crop around Playground. It shows the same sequence with the micro camera push (A) and without it (B), including the exit. |
| `playground-lifted.png` | The full scene 2 s into the hover: fully powered and lifted. |
| `checks/station-lifted-3x.png`, `checks/station-rest-3x.png` | The station lifted and at rest, at 3×. |
| `checks/ab-station-3x.png`, `checks/ab.json` | The lifted station at 3× with and without the push, plus a sharpness measure. |
| `connection-closeup.png` | The route at 3×, in four states: at rest, the pulse at 300 ms, the arrival burst at 620 ms, and powered. |
| `idle.png`, `energy-halfway.png`, `return-to-idle.png` | At rest, at half charge, and after the exit. |
| `checks/timeline.json`, `checks/exit.json` | Measurements in 20 ms steps (hover) and 33 ms steps (exit). |
| `probes.txt` | Live behaviour probes on the production build. |

**Command:** `npm run visual:playground -- --url http://localhost:3000 --out docs/m1.3e3`. Add `--no-push` to record without the push.

## 1. Energy arrival

All changes are in `components/lab/EnergySurge.tsx`. The traced route and its masks are unchanged.

- **Leading pulse.** It is compact now: a white-hot point inside a small warm halo. Before, a broad 100 px glow smeared along the line. Every part is still seen through the route's own masks, so it stays on the painted line.
- **Short trail.** About 66 px behind the head, it fades to nothing and then out after arrival.
- **Progressive charging.** The front still uncovers the route behind the pulse. The powered glow behind it now holds at 50 % while the pulse travels and rises to full after arrival (600–940 ms). The pulse therefore reads separately from the line it charges.
- **Arrival burst.** The pulse lands at 600 ms, 50 ms before the station responds.
  - The head swells and is absorbed.
  - A small flattened bloom flashes where the line meets the platform's corner: 84 × 30 px, tilted to the floor, peaking at 620 ms and gone by 760 ms.
  - The station's own arrival flare follows at 650 ms.
- **Stable state.** While hovered or selected the whole route stays fully powered, with nothing flickering. At rest the line is unchanged: unpowered, keeping 28 % of its light. Idle is pixel-identical to M1.3E.2.

**Fixed along the way.** Playground's platform-strip light (`playground-light.png`) had been empty since M1.3E.1. The strip mask is stored at half size, and the generator read it at full size. The strips now brighten on hover, and the arrival flare shows on them, as on the other stations. The fix is in the decoder of `scripts/make-playground-layer.mjs`.

## 2. Physical lift (still 18 px)

**Motion**
- **Curve.** A custom `linear()` curve: a slow start under load (first 30 %), a steady climb, then a long, soft stop (last 45 %). It never passes the target, so there is no bounce.
- **Timing.** 450 ms, from 650 to 1100 ms. It measured 660–1040 ms to within 0.05 px.
- **Exit.** The station lowers in about 300 ms, as before.

**Under the station**

Three static floor layers sit under the station. The generator builds them from the silhouette's bottom contour.
- **Contact shadow** (`playground-shadow.png`, regraded). It is lighter at the contact line (0.3) and deepens smoothly to 0.88 under the base. Before, it was a near-uniform dark band. It fades in with the rise.
- **Soft penumbra** (`playground-shadow-soft.png`, new). It is centred on the contact line, spreads a few px onto the floor in front and at the sides, and stops before the layer box. It grows in 120 ms after the rise starts, as the weight settles.
- **Illuminated gap** (`playground-gap.png`, new). A thin warm light is pooled on the floor at the base's edge, as if the base strips lit the floor beneath.
  - It follows the platform's own outline.
  - It is brightest under the lit strips and faint elsewhere.
  - It carries the floor's texture.
  - It is uncovered from the corner where the energy lands, across the base, from 670 ms to about 1230 ms.

The result: the platform's dark lower edge now stands against a dark gap with a lit lower rim. Before, it merged with the shadow.

**Unchanged:** the extracted station and backdrop, which are byte-identical; the layer box; the rest recomposition (max 0.99/255); and the game's alignment while moving. Reduced motion hides all three under-layers, as it already hid the shadow.

## 3. Micro camera push: A/B

**Implementation**
- **Shot.** `HOVER_PUSH` in `scene-layout.ts` uses the existing `frameTarget` with Playground as its own anchor, at 1.025×. The scene zooms about the station, so the station holds still and the room grows around it.
- **Clamp.** It stays inside the existing edge clamp and Playground's shot bounds: translate (−9.55, +0.96) reference px.
- **Rule.** `LabCamera` applies it as a stylesheet rule only while Playground is hovered or focused, not selected, and the camera isn't returning home.
- **Timing.** It starts at arrival (650 ms) and runs 1.2 s, slow in and slow out. Leaving returns it with the existing camera-out transition, home in 630–700 ms.
- **Selection.** The click camera is an inline transform, so selection always takes over. The probe confirms 1.09× on click.
- **Unaffected.** Navigation and hero copy are outside the camera; the probe found their boxes unchanged. Reduced motion disables it.

**Comparison** (`ab-camera-push.webm`, `checks/ab-station-3x.png`)
- **Sharpness.** At 3×, the lifted station measures 2.13 with the push and 2.19 without (mean |Laplacian|). That 2.6 % difference is what a 1.025× magnification produces by itself. There is no extra softening, and none is visible side by side at 3×.
- **Flatness.** The push is a uniform 2D zoom of the whole plate, so it adds no parallax. Its benefit is a gentle lean toward the station once it is powered. Most of the push happens after the station has settled (it eases until about 1.85 s).

**Decision: kept, provisionally.** It costs no measurable quality, and it does not move the fixed UI. Whether it is *noticeably better*, or makes the room feel like a flat picture in motion, is a perceptual call I can't make from frames. That's what the A/B is for. To remove it, delete the `playground` entry in `HOVER_PUSH` (`components/lab/scene-layout.ts`).

## 4. Timing (production build, measured)

| ms | What happens |
| --- | --- |
| 0–560 | The pulse travels from the A along the full route. The line charges behind it: platform part by 260 ms, half by 300 ms, whole route by 540 ms. |
| 600–760 | Arrival: the head is absorbed and the burst flashes at the platform's corner (peak 620 ms). The line rises to full power (until about 940 ms). |
| 650 | The station responds: arrival flare, lift begins, push begins. |
| 660–1040 | The station rises 18 px. The shadow deepens, and the under-light sweeps across the base until about 1230 ms. |
| 700 → | The game runs. |
| active | Elevated, powered, still. The push completes at about 1.85 s. |
| exit | The camera is home in 630–700 ms (two runs). The station is down at 300 ms. The connection drains toward the A from 500 to 900 ms. |

Interruption is unchanged. Leaving before arrival (the probe leaves at 250 ms) cancels the burst, lift, push and game. Switching stations mid-charge, rapid re-hovers, click, Escape, blur and keyboard focus all behave as before.

## Validation

- `npm run typecheck`: passes.
- `npm run build`: passes.
- `probes.txt`: 18/18 OK, live on the production build. These are the M1.3E.2 probes, now also checking the camera and the under-layers, plus a new probe that the fixed UI is unchanged by the push.
  - The first run's only failure was a probe-timing issue: it sampled the camera at 1.5 s, before the push had finished easing. The wait is now 2.1 s; the final file is from the rerun.
- Idle is pixel-identical to M1.3E.2, and rest after the probes matches idle within 1/255.

## Limitations

1. **The light gap is an invented light source.** No under-light exists in the plate. It is restrained (0.7 opacity, a few px tall) and follows the existing strips, but it is a design addition.
2. **The burst is unmasked.** It is a small soft bloom, so for about 150 ms it also lights a little of the stone corner and the floor ring. The rest of the energy stays inside the route's masks.
3. **The under-floor texture is mirrored**, as in M1.3E.2. The light gap sits on that rebuilt strip.
4. **The push's net value is unverified** (see section 3).
