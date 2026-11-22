# M1.3D: Complete cinematic hover activation

All five stations now share one sequence. Hover or keyboard focus sends a spark from the central A along the station's painted line. On arrival the station gives a brief response, then its own features come alive, then it settles into a softer active glow.

At rest the lab is unchanged: max 2/255 against M1.3B, on about 30 px where the Playground line meets the A ring, with no pixel above 2.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `hover-activation.webm` | 12.8 s recording at 30 fps: each station's hover (2 s) then exit (0.5 s), in the order Educational, Engineering, Playground, Creative Studio, Experience. |
| `idle.png`, `<station>-active.png` | The resting lab, and each station 2 s into its hover. |
| `checks/` | Pulse-midway and exit frames, plus the per-station measured timelines (`*-timeline.json`). |
| `probes.txt` | Interruption, keyboard and reduced-motion probes (11/11 OK). |

How the evidence was made:
- **Frames** are paused and seeked to exact times, so the recording shows the real timing.
- **Command:** `npm run visual:hover -- --url … --out docs/m1.3d`

## Results

| Station | Result | Judgement |
| --- | --- | --- |
| Engineering | **PASS** | Unchanged from M1.3C (5 px lift, contact shadow, cyan screens, bar sweep), plus the arrival flare. Its sustained glow is down slightly (0.95 → 0.9) so the flare reads above it. |
| Educational | **PASS** | Unchanged in kind: glass glow, orbit and T strip, plus the arrival flare. The short line now has a clearly visible spark. |
| Playground | **PASS** | On arrival the neon and marquee flare. A bright band rolls down the screen once (clearly visible), then the screen stays softly alive: faint scanlines, a slow rolling band and five slow pixel sparkles, all mapped to the screen's quad and masked to it. The live sparkles are small at normal size; the boot band is what reads. |
| Creative Studio | **PASS** | The platform strips light, a warm band passes across the painting (tilted to the canvas), then the painting and both prints settle brighter and a little richer. The lit copy is the painting's own pixels with feathered edges: no seam, nothing replaced. |
| Experience | **PASS** | After the platform lights, an amber highlight starts at the front edge and follows the painted path through all four switchbacks to the peak (about 1.15 s). The whole path then settles into a sustained glow. The route is the painted path itself: traced points snapped to the path pixels. The amber mountain wireframe beside it is excluded. |

## What changed

- **Spark visibility** (`EnergySurge.tsx`):
  - **Head and tail.** A brighter head plus a short fading tail (96 px) behind it.
  - **Soft glow.** The head gets a glow through `connections-wide.png`: a wider, soft halo derived from the existing `connections.png`, used for the spark only. There's no second line system; the light stays on and immediately around the painted lines.
  - **Contrast.** The line behind the spark stays nearly dark (10 %) while it travels and charges on arrival, so the spark has contrast against the painted line.
  - **Restraint.** The A flash is restrained (peak 0.42 of a lit copy, 480 ms).
- **Travel time follows line length:** 460 ms (Educational, 66 px), 540 ms (Engineering and Playground, 125–133 px), 620 ms (Creative, 221 px), 650 ms (Experience, 252 px).
- **Arrival response.**
  - Each station's platform light, and its feature glow where it has one, gets a second copy that the controller raises for 220–240 ms on arrival (peak 0.4–0.65). It reuses the same mask or image, so no extra decode.
  - The sustained state fades in underneath and stays softer.
- **New overlays** (`scripts/make-activation-masks.mjs`, still headless Chrome, no Python):
  - `creative.png`, `creative-scan.png`;
  - `experience.png`, `experience-scan(-glow).png`, and `components/lab/experience-path.ts` (the snapped route);
  - `connections-wide.png`;
  - a brighter game-screen term in `playground.png`.
- **Station specs** (`scene-fx.ts` `ACTIVATION`) gained:
  - `flare`;
  - `scan.direction: "right"` with `tilt`;
  - `travel` (a path highlight);
  - `live` (a softly animated screen, paused and transparent at rest).
- **No new dependencies,** no per-frame React work; transforms and opacity only.

## Timing (measured on the production build)

| ms | Educational | Engineering | Playground | Creative | Experience |
| --- | --- | --- | --- | --- | --- |
| Spark at station (≥ 99 % of line) | 400 | 460 | 460 | 540 | 560 |
| Arrival | 460 | 540 | 540 | 620 | 650 |
| Flare | 460–700 | 540–760 | 540–770 | 620–850 | 650–880 |
| Platform light start → full | 460 → 680 | 540 → 640 | 540 → 760 | 620 → 840 | 650 → 860 |
| Lift (400 ms) | — | 540 | — | — | — |
| Sweep / boot / path | — | 630–1390 | 720–1280 | 680–1580 | 770–1920 |
| Feature glow starts | 600 | 620 | 600 | 840 | 1180 |
| Live screen from | — | — | 1190 | — | — |

Nothing reacts before arrival. Exit is immediate and smooth (280–420 ms).

## Interruption and accessibility (`probes.txt`, all OK)

- **Leaving early.** Leaving before arrival leaves nothing active.
- **Fast switching.** Engineering → Educational and Creative → Experience mid-flight: only the latest target activates.
- **Leaving mid-path.** Leaving Experience while the path highlight is in flight fades it out; nothing completes later.
- **Repeated hovers.** Quick repeated hovers create no overlapping pulses or stale state.
- **Selection.** Clicking mid-sequence selects at once and the station stays active. After Escape, focus returns to the title (M1.3A); the station stays lit with no second pulse.
- **Keyboard focus.** Runs the same sequence; blur returns to rest.
- **Reduced motion.**
  - No spark, flare, sweep, path highlight or live animation, and no lift.
  - Lights and glow answer at once with a 150 ms fade.
  - The 90 ms hover-leave grace is kept.
- **Return to rest.** Hover → leave → settle matches idle for all five stations (max 2/255).

## Remaining masking / compositing notes

1. **Idle max 2/255 on about 30 px** where the Playground line meets the A ring. Every new element there is transparent or masked out, so this is a compositing-level difference from the extra spark layer. It isn't visible, and it's below the project's 4/255 tolerance.
2. **Creative's lit copy covers the canvas face quad.** At very high zoom the feathered edge sits within about 1 px of the painted canvas edge.
3. **Experience's corridor** excludes the wireframe by distance (13 px wide). Near the peak, the last few px of the path pass close to wireframe lines; none are included in the mask (see the preview).
4. **Playground's live sparkles** are about 3 × 2 px at 1648 px wide. The intent is to be felt rather than read; larger ones would start to look like UI.
5. **Measurement artifact:** a raw exit frame compared to the frozen idle differs by about 5,600 px, because the ambient energy loop is at a different time. Freezing both gives max ≤ 2.

## For the scroll-interaction milestone

- **Reuse the station state as is.** Hover activation is pure CSS state plus a hover listener. A scroll-driven "focus" can set the same `data-lab-hover` (or a new `data-lab-focus`) and get the whole sequence, including keyboard parity and cancellation, for free.
- **Watch for spark spam.** Scrolling past several stations quickly would fire a spark per station. Throttle to the settled target: the 90 ms grace already does this for pointer moves; a scroll version wants about 150–200 ms.
- **Pause the ambient effects** (energy loop, orbit, live screens) while the lab is scrolled out of view, using an IntersectionObserver that toggles `animation-play-state`.
- **Respect the camera.** Scroll shouldn't move the camera while a hover sequence is mid-flight; let a selection take over, as clicking does now.
