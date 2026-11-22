# M1.3E.2: Complete energy connection and stronger Playground lift

This milestone makes two fixes, on Playground only:

- **Connection.** The whole painted connection now charges, from the A's circle to the station.
- **Lift.** The station rises 18 px (it was 10).

This is a prototype for review. It is **not** visually approved.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `playground-power-lift.webm` | Full scene at 1:1 (1648 × 928), 30 fps, 7.0 s: idle, energy along the full route, the lift, gameplay, then the exit (the station lowers, then the connection powers down). |
| `connection-closeup.png` | The complete route at 3×: at rest (unpowered), charging at 340 ms (the spark past the rim step), and powered with the station lifted. |
| `playground-lifted.png` | The full scene 2 s into the hover, at normal desktop size. |
| `idle.png`, `energy-halfway.png`, `return-to-idle.png` | At rest, at 340 ms (half of the route lit), and after the exit. |
| `checks/station-rest-3x.png`, `checks/station-lifted-3x.png` | The station before and after the lift, at 3×. |
| `checks/charge-*.png` | The charge front at 150, 300, 450 and 600 ms (route crop, 3×). |
| `checks/timeline.json`, `checks/exit.json` | Hover and exit measurements (20 ms and 33 ms steps). |
| `probes.txt` | Behaviour probes, live, on the production build: 17/17 OK. |

**How the frames were made.** Every animation and the game clock are paused and seeked for each frame, so the video plays in real time with exact timing.

**Command:** `npm run visual:playground -- --url http://localhost:3000 --out docs/m1.3e2`

## 1. What was missing in the connection, and how it was fixed

I compared the painted connection with the animated path at 4–9×. The painted connection has two parts:

1. **Across the central platform.** A fainter stroke runs about 66 px across the central platform's top, from the A's outer circle (about 897, 563) to the platform's rim.
2. **Across the floor.** At the rim it steps down about 3 px, then the bright stroke crosses the floor to the platform's corner (about 1089, 538), where it also lights the corner of the stone.

Before this milestone, the animation knew only part 2:
- The shared connection masks and the M1.3E.1 dim overlay began at the rim, so part 1 never dimmed, charged or glowed.
- The light the line paints on the platform's corner stayed lit at rest, unconnected to the animation.
- The spark ran along a straight chord, while the painted floor stroke sags about 2 px below it.

**The fix** is in `scripts/make-playground-layer.mjs`.

**Route**
- **Trace.** The route is traced from the plate's own pixels: in each column, the line's centre is the brightness-weighted centroid in a narrow band, smoothed along the line.
- **Output.** That gives a 26-point polyline, `components/lab/playground-route.ts`, with the rim step marked.

**Masks and overlays built from the route**
- **Spark masks.** New masks for the spark (`playground-route{,-glow,-wide}.png`) follow it, including the bend.
- **Unpowered overlays.** These now cover both parts plus the corner glow: `playground-line-dim-a.png` (platform) and `-b.png` (floor and corner).
  - They dim only light the line adds: pixels both brighter and warmer than the surface beside them.
  - The platform rim's cool metal highlight, which the first attempt smeared, is left alone.
- **Powered glow.** One per part (`playground-route-{a,b}{,-glow}.png`), so the two can't double up at the bend.

**Charging along the route**
- **Spark.** It follows the polyline, turning at the bend.
- **Charge front.** Behind it, the two parts are uncovered in sequence, platform first, then floor. Each part gets the unpowered overlay ahead of the front and the powered glow behind it.
- **Exit.** The charge drains back toward the A, station end first.
- **Selected or reduced motion.** The whole route shows powered. The old floor-only connection light is retired for Playground.

**Measured (`timeline.json`)**

| Point | Time |
| --- | --- |
| Platform part fully lit | 280 ms |
| Half the route | 340 ms |
| Whole route (spark at the station) | 600 ms |

## 2. Stronger lift

- **Target.** I aimed for 18 px, inside the requested 16–20 px range.
- **The first attempt failed at that height.** With the shadow off, the strip it uncovers was a flat, pale haze. A dark shadow was all that hid it, which is what the brief rules out.
- **Rebuilt strip.** The strip is now rebuilt from real floor texture: in each column, the floor below the contact line, past the dark seam and the strip's reflection, is mirrored upward. Highlights such as the connection line and the reflections are never copied; their pixels get that column's typical floor instead.
- **Checked without the shadow.** With the shadow off, the gap now shows dark, textured floor continuous with the floor in front.
- **Shadow.** The contact shadow is graded by depth under the base: lighter near the contact line, darker further under. It fades in with the lift to opacity 0.85.

**Motion**
- **Movement:** 18 px up, plus 1 % scale about the platform's base, so the base stays on its line.
- **Timing:** 500 ms, `cubic-bezier(0.55, 0, 0.2, 1)`: a slow mechanical start and a long settle, with no bounce.
- **What moves:** platform, cabinet, controller, details, the label and chip, and the game screen, all in one layer and one transform.
- **What stays put:** the floor ring, the floor reflections and the connection line. The line ends under the raised corner.
- **Round trip.** At rest the original plate is shown, and the layer recomposes it exactly (max 0.99/255). Back at rest after every probe, the lab matches idle within 1/255.

| ms | What happens |
| --- | --- |
| 0 | The spark leaves the A's circle. |
| 0–600 | The full route charges. |
| ~650 | Arrival: the flare. |
| 660–1100 | The station rises 18 px. |
| 700 → | The game switches on and plays. |
| exit 0–350 | The station lowers and the game fades. |
| exit 400–900 | The connection drains back toward the A. |

## Remaining limitations

1. **The uncovered strip is plausible, not real.** It is mirrored floor texture, not real floor under the platform, and its texture runs mirror-image to the floor in front (visible at 3× if you look for it). A lift above about 22 px would reach the smooth fill above the rebuilt band.
2. **Rest-state line.** At rest the line keeps 28 % of its light, so it reads as an unpowered line rather than disappearing. A short stretch at the rim step stays slightly paler, because the rim highlight there is not dimmed.
3. **Small reveals at the cabinet's slanted left edge.** The cabinet's slanted left neon edge reveals a sliver of rebuilt wall about 6 px wide during the lift. It's dark and shows no seam at 1× or 3×.
4. **Earlier recordings' exits.** The evidence scripts resumed the paused timeline with `play()`, which rewinds animations that have already finished. As a result, the exit part of the M1.3D, M1.3E and M1.3E.1 recordings showed a cancelled sequence, not the real exit. The app was not affected, and the live probes covered the exits. All three scripts are fixed, and this recording shows the real exit.
