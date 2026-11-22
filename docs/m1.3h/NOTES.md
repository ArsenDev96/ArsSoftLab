# M1.3H: 2.5D layered Playground (feasibility prototype)

Status: experimental, off by default, awaiting your review (not approved). The approved M1.3E version is unchanged and is still what ships.

**Superseded by M1.3I:** `NEXT_PUBLIC_PLAYGROUND_LAYERED=on` now builds the M1.3I scene, which keeps this background and cut-out and adds the layers in [`../m1.3i/NOTES.md`](../m1.3i/NOTES.md). The evidence below is M1.3H as it was.

## Summary

- **Gap: improved, close but not perfect.** It now shows continuous dark floor texture taken from the real floor around the platform. There's no mirroring or smearing, and no lit rim.
- **Without the shadow:** the floor reads as floor, but at 3× it is a little smoother and greyer than the real floor in front of it.
- **Shadow:** much lighter than before (at most 0.5, against 0.88), so it no longer hides the reconstruction.
- **Full clean background: not achieved.** The room behind the cabinet (wall, window, step, door) cannot be convincingly reconstructed from the one flat illustration. It shows a ghost of the station's outline. The lift never uncovers that area, but a clean background good enough to show on its own needs new illustration work.

## Try it

```bash
node scripts/make-playground-layered.mjs --preview docs/m1.3h   # assets (~10 s) + previews
NEXT_DIST_DIR=.next-layered NEXT_PUBLIC_PLAYGROUND_LAYERED=on npx next build
NEXT_DIST_DIR=.next-layered npx next start -p 3001             # experimental, beside the default on 3000
npm run visual:layered -- --orig http://localhost:3000 --url http://localhost:3001 --out docs/m1.3h
```

The experimental build writes `.next-layered/` (git-ignored). Next.js adds that folder to `tsconfig.json`'s `include` and rewrites `next-env.d.ts` while building. Revert `tsconfig.json` afterwards; the next default build restores `next-env.d.ts`.

## Evidence (this folder; real browser, 1648 × 928, full motion)

| File | What |
|---|---|
| `idle-comparison.png` | Original vs experimental at rest (2×): identical. |
| `playground-lifted.png` | Experimental, fully lifted. |
| `playground-lifted-no-shadow.png` | The same with the contact shadow hidden. **This is the honest view of the floor.** |
| `playground-lifted-original.png`, `playground-lifted-no-shadow-original.png` | The approved M1.3E version, same two views, for comparison. |
| `lift-gap-3x.png` | The gap at 3×: approved and experimental, each with and without shadow. |
| `clean-background.png` | Plate vs clean background (station removed), 2×. |
| `clean-background-full.png` | The whole frame with the station removed. |
| `asset-station.png` | The transparent station cut-out on a checkerboard. |
| `playground-layered.webm` | 6 s, real time: idle, charge, lift, hold, return. |
| `probes.txt` | 10 behaviour checks; all pass. |
| `checks/` | Raw crops, diff heatmaps, and `synthesis-sources.png`: green is the hole, red marks pixels never copied. |

## 1. Asset production

`scripts/make-playground-layered.mjs` uses Node plus headless Chrome for decoding only, with no new dependencies. It runs in about 10 s.

**Tools considered:**

| Tool | Outcome |
|---|---|
| Python + OpenCV inpainting (M1.2.2) | Not installed. Its Telea and FSR methods already failed in M1.2.2. |
| Generative inpainting model (e.g. LaMa) | Would need a ~200 MB model download and a new runtime. Not done without your agreement. |
| Online image-generation services | Would upload your artwork. Not done without your agreement. |
| Patch-based completion, implemented here | **Used.** |

The method is multi-scale PatchMatch image completion (Wexler 2007 / Barnes 2009, the technique behind "content-aware fill"). Every filled pixel is copied from real plate texture: nothing is mirrored, blurred or painted. The constraints:

- **Floor only from floor, wall only from wall.** The floor/back-step line slants with the room.
- **Perspective.** Floor patches come from at most ±40 px in depth. At the depth just behind the contact line, the floor is visible only left of the platform, where it carries a window reflection. The floor just in front of the base therefore has to be used as well.
- **Never copied:** lamps, glows, the connection line, strip reflections, thin streaks and rims, the station's own neon spill (6 px around it), the Experience panel and the block to the left. These pixels are also ignored when matching, so the fill can't continue them into the hole.
- **Reuse penalty.** Each source patch is penalised when reused. Without it, one smooth patch got copied across a whole row as a pale bar.
- **Brightness guide.** A smooth brightness estimate, carried in from the hole's surroundings, steers the choice of patches.
- **Final pass copies, never averages.** Each pixel is taken from its best patch rather than averaging overlapping patches, which keeps the grain sharp.
- **Seam correction.** Fill pixels next to the plate continue the plate's tone. The correction fades out within about 4 px and doesn't touch texture.

**Re-matting.** The station is cut out again over this clean background:

- **Inside the outline:** the plate's own colour.
- **Edge:** the colour is the nearest interior colour, so no background colour is carried along when it lifts. The background under the edge is solved so that at rest the layers add back up to the plate. Where that isn't possible, alpha is fitted, or as a last resort the colour is solved (neon glow).
- **Accuracy at rest:** max 6/255, mean 0.03, at native resolution.

**Measured texture in the uncovered band vs the real floor in front:** brightness 46 vs 43; fine detail 2.7 vs 3.1 (mean |Laplacian|).

## 2. Layer structure

Experimental build, back to front:

1. **Plate**, with the static platform-power overlays (M1.3F, unchanged).
2. **Clean background** `playground-v2-background.png`: the station's area only, static.
3. **Floor reflections and connection lines** stay where they are: the plate, the PlatformPower reflection parts and the charge lines (M1.3G). They are separate from the platform and grounded.
4. **Contact shadow** `playground-v2-shadow.png`: static and graded by depth (0.16 at the contact line to 0.5 deeper under, plus a 1–2 px spill in front). It fades in with the rise: same curve, timing and delay.
5. **The station** `playground-v2.png`: platform, cabinet, controller, details. It moves.
6. **Platform lighting**: the unpowered and powered strips (M1.3F `light-lift.png` / `unpowered-lift.png`) on the lift. Unchanged.
7. **Arcade game** (`ArcadeScreen` via `StationActivation`) on the lift. Unchanged.
8. **Label and chips** (`.lab-station.lab-lift`), which rise with the same transform.

**Dropped in the experimental build:** the M1.3E.3 penumbra and the invented under-light. They obscured the floor, and the under-light has no source in the artwork.

**Switching.** `NEXT_PUBLIC_PLAYGROUND_LAYERED=on` selects the new Playground `STATION_LAYERS` entry (`layered: true`). Anything else gives the approved M1.3E entry. No component is forked: `StationLayers.tsx` only adds a `data-layered` attribute, and `globals.css` adds one rule for the shadow. Engineering and the other stations are untouched.

## 3. Visual fidelity at rest

**Identical.** Original vs experimental, whole frame: max 2/255, 0 px over 2 (`probes.txt`).

Like the approved version, the layers appear only once the energy arrives. Shown at rest they would differ slightly: max 60/255 on 267 px along the outline, because Chrome resamples each layer separately (`checks/idle-layers-shown-diff-x40.png`). That brief difference is all you could see at the moment they switch on, during the arrival flare. It's the same trade-off the approved version makes.

Composition, perspective, lighting, stone, platform edges, cabinet and colour grading are unchanged. The room's identity is untouched.

## 4. Lift-gap quality

At normal size the gap reads as a lifted platform over a darker floor, with the floor's grain visible through the light shadow.

With the shadow off at 3× (`lift-gap-3x.png`, bottom row):

- **Better than the approved version:** no mirror-image texture, no vertical streaks, no stair-stepped end, no smear.
- **Still short of the real floor:** the band is slightly smoother and greyer than the floor in front of it. It reads a little like a flat stone surface rather than the polished, reflective floor.

**Behaviour** (`probes.txt`): the station rises 18 px with 1 % scale; its label, chips and game screen go with it. The floor, reflections and line stay put. The line is fully charged when it lifts, and the station returns to an idle picture identical to before. Keyboard focus and blur work. Reduced motion: no lift and no shadow.

## 5. Remaining reconstruction defects

1. **Clean background behind the cabinet is not acceptable on its own.** The wall, window, back step and door are filled as smeared patches in the station's outline, with a purple smudge near the top (`clean-background.png`). Patch synthesis can't invent architecture it hasn't seen. The lift never shows this area: only about 18 px under the base, plus slivers at bottom-facing edges.
2. **Gap tone and texture.** Brightness and fine detail are close to the floor's (above), but it's a touch greyer and flatter, with faint horizontal banding at 3×.
3. **Reflections don't follow the height.** The strip's floor reflection stays where it was (grounded, as specified). On a real polished floor a reflection would drop as the platform rises.
4. **Outline.** The station is cut along the M1.3E hand-traced outline, which takes in a few px of the cabinet's own glow and of the dark wall around the marquee. That rim moves with the cabinet.
5. **Disc under the platform.** The base sits on a darker floor disc whose hidden part was never painted. The fill continues its visible front band and the floor around it; it is not the real disc.

## 6. Files

**New**

- `scripts/make-playground-layered.mjs`: the generator.
- `scripts/visual/layered-evidence.mjs`: the evidence script (`npm run visual:layered`).
- `public/scene/layers/playground-v2.png` (130 KB), `playground-v2-background.png` (51 KB), `playground-v2-shadow.png` (8 KB).
- `docs/m1.3h/`: this folder.

**Changed**

- `components/lab/scene-layout.ts`: `PLAYGROUND_LAYERED` flag, `layered` field, the experimental entry.
- `components/lab/StationLayers.tsx`: `data-layered` attribute.
- `app/globals.css`: the experimental shadow rule.
- `next.config.ts`: `distDir` from `NEXT_DIST_DIR`.
- `.gitignore`: `.next-*/`.
- `package.json`: `visual:layered`.
- `README.md`, `docs/station-animation-spec.md`: status.

**Not touched:** the reference, `lab-plate.webp`, every M1.3E/F/G asset, the power and charge-line system, and the arcade game.

## 7. Results

- `npm run typecheck`: pass.
- `npm run build` (default): pass.
- Experimental build (`NEXT_PUBLIC_PLAYGROUND_LAYERED=on`): pass.
- Browser checks: 10/10 (`probes.txt`).

## 8. Recommendation: refine

- **Structure: adopt.** The flag, the separate layers, the static floor and the height-graded shadow are sound, and nothing else changed.
- **Gap: closer than M1.3E, not yet convincing at 3×.** It is honest with the shadow off. It now needs your eye.
- **Full clean background: not feasible from this artwork alone.**

To make it fully convincing:

1. **Real floor under each footprint (recommended).** One of:
   - an artist paints it at 2× (just the floor under each platform plus a margin, not the whole room), or
   - with your agreement, a generative inpainting pass, reviewed patch by patch.

   Either drops into `playground-v2-background.png` with no code change.
2. **If that isn't possible:** keep this synthesis but limit it to what the lift uncovers, and accept the current band quality.

Don't reuse this on other stations until you've judged the gap (SA-1 approval gate).
