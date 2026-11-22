# M1.3E: Playground real motion prototype

Hovering (or keyboard-focusing) Playground now sends the energy as before. When it arrives, the arcade's own screen switches on into a small original game: a ship weaves between purple crystal formations over amber-lit mountains, collecting stars, with the score ticking up. Leaving fades the screen back into the plate's original artwork. The other four stations, scrolling, navigation and project pages are untouched.

This is a prototype for review. The visual design is **not** classified as approved.

## Evidence (this folder)

| File | What it shows |
| --- | --- |
| `playground-activation.webm` | Full viewport at 1:1 (1648 × 928), 30 fps, 8.4 s. Idle (0.6 s), then the hover: energy, arrival, switch-on and about 6 s of play. Then the exit (0.8 s). |
| `playground-screen-zoom.webm` | The same timeline, cropped to the cabinet at 3×, for detail. |
| `idle.png`, `playground-active.png` | The lab at rest, and 3 s into the hover. Full viewport. |
| `checks/boot-*.png` | The switch-on at 500–760 ms (cabinet crop, 3×). |
| `checks/motion-*.png` | Gameplay at 1.5–4 s (cabinet crop, 3×). |
| `checks/timeline.json` | Wrapper opacity, state and canvas coverage every 20 ms. |
| `checks/reduced-motion.png` | The static frame shown with reduced motion. |
| `probes.txt` | Behaviour probes, run live: 17/17 OK. |

**How it was recorded.** Every animation, including the game's clock, is paused and seeked to each 1/30 s, then the frames are encoded in Chrome. Playback is therefore real time with the app's exact timing, independent of this slow machine. Live playback was checked separately in the probes: the canvas changes continuously and the loop runs at about 61 frames/s in headless Chrome.

**Command:** `npm run visual:arcade -- --url http://localhost:3000 --out docs/m1.3e`

## 1. Implementation approach

A 2D canvas, the simplest option that gives real moving objects. There are no assets or dependencies, and no video.

- **`arcade-game.ts`** draws the game as a pure function of game time, at a logical 120 × 80 units.
  - **Layers:** sky and sun, twinkling stars, two parallax mountain ridges, a cyan ground grid running toward the viewer, crystal gates, collectible stars with a collect ring, the ship with flame and trail, and a HUD (three lives and a 5-digit score).
  - **Finish:** a glass vignette and edge fall-off.
  - **Loop:** the obstacle pattern repeats every 8 gates (about 10.7 s), so the game loops naturally.
  - **Palette:** violet sky, purple crystals, cyan ship and grid, amber sun, stars and score.
- **`ArcadeScreen.tsx`** warps, clips and drives the canvas.

## 2. Perspective alignment

- **Measuring the display.** The display edge was measured on the plate itself. Along each side, I found where brightness crosses half-way between the lit display and the dark bezel, then fitted a line per side by least squares. The four corners are where those lines meet:

  | Corner | Reference px |
  | --- | --- |
  | Top-left | (1155, 396.5) |
  | Top-right | (1221, 398.5) |
  | Bottom-right | (1209.3, 443) |
  | Bottom-left | (1140.7, 440) |

  M1.3D's rough quad had the top-left about 10 px too far left.
- **Projective warp.** The side edges are not parallel (the left leans about 15 px over the height, the right about 10), so an affine map cannot fit. The canvas is warped with a projective `matrix3d` (square-to-quad homography). It is recomputed from the wrapper's layout size, and on resize.
- **Clip and bleed.** The clip is a `clip-path` polygon grown 1.4 px past the measured edge, so it also covers the plate's half-lit edge pixels. The canvas maps 0.8 px further still, so its own edge never shows. The game darkens over its last few units into the bezel, as the original display does.
- **Glow overlay.** Playground's activation glow (`playground.png`) used to include a brightened copy of the old screen. That copy showed as a light rim around the game, so the screen and its edge are now excluded from the glow. Neon and marquee are unchanged. Only `playground.png` was regenerated; all other overlays are byte-identical.
- **Sharpness.** The canvas backing store is sized to about 1.3× the screen's device pixels, re-checked during camera zoom, so the warp never minifies hard.

## 3. How the animation starts and stops

**Timing.** All times are from the hover (measured in `checks/timeline.json`).

| Time | What happens |
| --- | --- |
| 0–540 ms | The energy travels to Playground. Nothing is drawn yet (state `charging`). |
| 540 ms | Arrival. The existing flare plays, and the screen switches on: the game is revealed from the top, led by a soft light edge, over 200 ms. |
| 660 ms | The screen is fully covered by the game, about 120 ms after arrival. |
| 680 ms | The wrapper is fully opaque. |
| 740 ms | The switch-on is complete; the game runs on, and Playground's purple lighting stays softly on. |

**How it stays in step.** The game's time comes from a Web Animation started on hover, the same clock the energy and CSS transitions use, so arrival and switch-on cannot drift apart.

**One loop, only while active.** A single `requestAnimationFrame` loop draws the game. It:
- starts on hover;
- ends once the fade-out has finished;
- pauses while the page is hidden.

At rest there is no loop, no clock, and an empty, transparent canvas.

**Exit.** The screen fades back into the original artwork over 340 ms after the existing 90 ms hover-leave grace. Then the loop stops and the canvas is cleared. The game keeps moving during the fade, so there's no freeze-frame jump.

**Interruptions**

- **Quick return during the fade.** The same game continues with one clock and no restart, and the screen comes back up with the lights at arrival.
- **Leaving before arrival.** The screen never switches on.
- **Click while charging.** The station is selected at once. The screen still switches on at arrival, together with the station's lights, which also keep their arrival delay.
- **Selection.** The game keeps running while Playground is selected.
- **Escape.** Focus returns to the title, and the game keeps running.

**Accessibility**

- **Keyboard focus** runs the identical sequence.
- **Reduced motion:**
  - one static lit game frame, shown at once with a 150 ms fade;
  - no loop, no clock, no wipe.
- **The canvas is inert:** `aria-hidden`, no pointer events, no keyboard handling.
- **No flashing:** the switch-on edge is a single soft light line, and the collect ring is small.

## 4. Files

| File | Change |
| --- | --- |
| `components/lab/arcade-game.ts` | New: the game renderer. |
| `components/lab/ArcadeScreen.tsx` | New: warp, clip, clock, loop and lifecycle. |
| `components/lab/scene-fx.ts` | Playground `game.quad` (fitted). Removed Playground's M1.3D boot band and soft live layer (`live`). |
| `components/lab/StationActivation.tsx` | Renders `ArcadeScreen`; `LiveScreen` removed. |
| `components/lab/EnergySurge.tsx` | Generated CSS shows `.lab-arcade` from arrival. |
| `app/globals.css` | `.lab-arcade` rest and fade-out, reduced motion. The M1.3D live-screen CSS is removed. |
| `scripts/make-activation-masks.mjs`, `public/scene/activation/playground.png` | Screen excluded from the glow. `playground-scan.png` deleted (unused). |
| `scripts/visual/arcade-evidence.mjs`, `package.json` (`visual:arcade`), `README.md` | Evidence script and docs. |

## 5. Typecheck and build

- `npm run typecheck`: passes, no errors.
- `npm run build`: passes; `/` is dynamic (ƒ), as before.
- Full `npm run visual` suite: not run, as asked.

Probes, on the production build:
- **At rest:** the lab is unchanged. Idle is pixel-identical to `docs/m1.3d/idle.png` (max 0/255).
- **After all the probes:** the lab is back at rest, matching idle within 2/255.

## 6. Known visual limitations

- **Size.** At 1648 px wide the screen is about 65 × 44 px. The ship is about 11 × 7 px and the score digits about 4 px tall. At normal size the change of scene and the motion read at once; the score and the ship's details read only on a closer look.
- **Style.** The game is drawn with smooth, anti-aliased shapes. The plate's original screen art is chunky pixel art, so the two styles differ slightly.
- **No light spill.** The game does not light the cabinet or the room. The purple neon and marquee glow continue as in M1.3D, but nothing takes on the game's colours.
- **Glass.** The glass is a static vignette and faint glare: no curvature, scanlines or reflections of the room.
- **Edge.** At high zoom, the clip edge follows the measured lines within about 1 px. It is hidden by the game's dark edge and the bezel, but it is a straight polygon, whereas the painted bezel corners are slightly rounded.
- **During a camera zoom on selection,** the canvas re-sizes at most twice a second, so the screen can look slightly soft for a moment.

## 7. Recommendations

1. **Native-resolution pixel art.** Draw the game, or a sprite sheet for it, at the screen's own pixel size (about 66 × 44) and scale it up crisply. That matches the original art's style and reads more clearly at this tiny size.
2. **Light spill.** Add a soft spill on the bezel, controls and the floor in front of the cabinet, tinted by the game's average colour. It can be read from a 1 × 1 downsample of the canvas a few times a second. This would make it feel most like part of the room.
3. **Detail when selected.** When Playground is selected and the camera zooms in, show more: a faint scanline texture and slight barrel curvature, which would be invisible at normal size.
