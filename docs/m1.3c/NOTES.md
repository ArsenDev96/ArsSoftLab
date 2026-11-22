# M1.3C: Cinematic hover activation (prototype)

Hovering or keyboard-focusing **Engineering**, **Playground** or **Educational** now runs one sequence. A spark leaves the central A and runs along that station's painted amber line. The station reacts only once the spark arrives. Creative Studio and Experience keep their M1.3A hover unchanged.

At rest the lab is pixel-identical to M1.3B (max 0/255, same Chrome).

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `hover-activation.webm` | 7 s recording at 30 fps: each station's hover (0–1.6 s) and exit (0–0.7 s). |
| `<station>-pulse-mid.png` | The spark halfway along the line. |
| `<station>-active.png` | The station fully activated. |
| `idle.png` | The resting lab. |
| `checks/<station>-exit.png` | 700 ms after leaving. |
| `<station>-timeline.json` | Measured timing (below), sampled every 20 ms. |
| `probes.txt` | Interruption, keyboard and reduced-motion probes. |

How the evidence was made:
- **Frames.** Every animation and transition is paused and seeked to exact times, so the recording shows the real timing regardless of machine speed.
- **Encoding.** Chrome encodes the WebM (MediaRecorder); there was no ffmpeg on the machine.
- **Command:** `npm run visual:hover -- --url http://localhost:3000 --out docs/m1.3c`

## Results

| Station | Result | Judgement |
| --- | --- | --- |
| Engineering | **PASS** | The spark is clearly visible. On arrival the platform lights, the station lifts 5 px, and the code and chart glow cyan with a bottom-to-top sweep through the bars. The lift edges are clean at 3× and the screen glow rides the lift in register. Clearly stronger than the old label glow. |
| Educational | **PASS** | The spark climbs the short vertical line into the T strip. The strip lights, the glass shells fill with cyan bloom and the orbit brightens. Nothing moves, and all of the glow comes from the glass itself. |
| Playground | **PARTIAL** | The sequence and lighting are convincing: lit marquee, stronger neon and floor spill, livelier screen, brighter strip. But the screen-activity sweep is too subtle to read at normal size. The cabinet has no physical presence change; that would need extraction (see below). |

## Timing (measured, production build)

| | Engineering | Playground | Educational |
| --- | --- | --- | --- |
| Spark leaves the A | 0 ms | 0 ms | 0 ms |
| Spark reaches the station (≥ 99 % of the line) | 500 ms | 500 ms | 420 ms |
| Arrival, after which effects may start | 580 ms | 580 ms | 480 ms |
| Platform light starts → full | 580 → 680 ms | 580 → 800 ms | 480 → 700 ms |
| Physical lift (400 ms) | 580 ms | — | — |
| Screens / neon / glass glow starts | 660 ms | 640 ms | 620 ms |
| Screen sweep | 670–1430 ms | 840–1460 ms | — |
| A flash | 0–520 ms, peak 0.5 of a lit copy of the A at 115 ms | same | same |

Nothing reacts before arrival. Exit is immediate: about 280 ms for the line and 420 ms for the lights and lift, with no overshoot.

## Implementation

- **The pulse** (`EnergySurge.tsx`): a bright head plus a "charged" trail, seen through the *existing* connection masks, so it can only light painted line pixels.
  - **Path.** Comes from the stored Béziers, with the start chosen as whichever end is nearer the A, so the stored order isn't trusted. All three run A → station, as verified on the frames.
  - **Travel.** The trail stays dim behind the spark, then charges fully on arrival. The head is absorbed at the platform.
  - **Separation.** The ambient 8 s pulses are untouched and run separately.
- **Sequencing without callbacks.**
  - **Sustained state is CSS.** Every activation effect uses `transition-delay: var(--arrive-now)`, generated per station: the arrival time while hovered and not selected, otherwise 0. Leaving early cancels pending transitions natively, so nothing can complete late.
  - **One-shot motion uses Web Animations,** started by a small controller when the hovered station changes: flash, spark, trail and sweeps. Releasing fades the trail and cancels sweeps that haven't started.
  - **No re-renders.** The controller subscribes to hover through `LabState.onHoverChange`, so nothing re-renders per frame.
- **Station overlays** (`StationActivation.tsx`, `scripts/make-activation-masks.mjs`).
  - **Lit images.** A brighter copy of the station's own glowing pixels plus their bloom: screens and chart, neon, marquee and game screen, glass shells, and the A.
  - **How they're made.** Selected by colour inside hand-traced regions, at half resolution, and transparent at rest.
  - **Engineering** keeps its overlays inside the lifted layer, so they move with it.
  - **Generator.** Runs in headless Chrome (no Python on this machine); `--preview` writes review sheets.
- **State machine** per station: idle → charging (until arrival) → active; leaving goes to releasing → idle.
  - A 90 ms hover-leave grace means crossing from a platform to its own label, or from title to chip, doesn't restart the sequence. Any other station takes over at once.
  - A selected station is already powered: hovering it sends nothing.
  - After Escape, focus returns to the station's title. The station stays lit and charged, with no second pulse.

## Interruption and accessibility (`probes.txt`, all OK)

- **Early exit.** Leaving before arrival (250 ms) leaves nothing active.
- **Fast switching.** Engineering → Educational mid-flight: only Educational activates.
- **Repeated hovers.** Four quick hovers of the same station leave no stale state.
- **Selection.** Clicking mid-sequence selects at once and the station stays active.
- **Keyboard focus.** Runs the same sequence (dark at 80 ms, active later); blur returns it to rest.
- **Reduced motion.** No pulse, no sweep, no lift; lights and glow answer immediately with a 150 ms fade.
  - Focus rings are unchanged.
  - Nothing flashes: the A peaks once at half strength and the sweeps run once.

## Performance

- **Composited only.** Transforms and opacity, all compositor-friendly. No React state per frame, no full-frame filters, no blend modes.
- **New layers:** per prototype station, two masked pulse layers (840 × 360 reference px, as for the ambient energy), one clipped overlay image, and at most one masked sweep.
- **Decoded image memory:** six half-resolution overlays, about 1.6 MB each (9.4 MB total). The files are 11–47 KB.
- **Not benchmarked** on a weak GPU in this milestone (lightweight validation). `npm run visual:stations` can measure it.

## Known limitations

1. **Playground screen activity is subtle.** A stronger sweep starts to look like a flash. A better effect would be a pre-rendered short "attract mode" overlay of the game screen, not a light band.
2. **No physical move for the arcade.** Masked light delivers the activation, but lifting the cabinet needs it cut out with a reconstructed backdrop and contact shadow, as Engineering was in M1.2.2. Deferred.
3. **Straight path.** The spark travels the chord of each line; the Béziers bow under 1 px, so it stays on the painted pixels.
4. **Hover feedback is 90 ms later on leave** for every station (the grace period); entry is unchanged.
5. **Visual regression suite not run** (lightweight validation for this milestone). Idle was checked directly: pixel-identical to M1.3B.

## Extending to Creative Studio and Experience

- **Pulse:** add each to `SURGE_ARRIVE_MS`. Their lines exist in the masks, and their paths and orientation come from the same data.
- **Platform lights:** already masked; they pick up the delay automatically.
- **Overlays:** add a region and colour test to `make-activation-masks.mjs` and an `ACTIVATION` entry:
  - Creative Studio: the easel canvas and pen-pot highlights.
  - Experience: the dashboard screens.
- **Their lines are longer** (about 220 and 250 px), so give them a longer travel (about 650 ms) rather than a faster spark.
- **Physical lift** for either needs the M1.2.2 extraction first. Experience touches the frame edge, so check that the camera clamp still holds.
