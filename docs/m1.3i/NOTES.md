# M1.3I: 2.5D scene architecture (experimental)

**Status:** experimental, off by default, awaiting your review (not approved). The default build is the approved implementation, unchanged: compared with M1.3H's capture of the approved build at rest, max 4/255 on 39 px, the globe's ambient orbit.

## Summary

| | Architecture | Artwork |
|---|---|---|
| **Done** | Layer stack A–H with a manifest for all five stations. Independent, grounded connections for **all five** lines. Playground's foundation, height-graded shadows and moving reflection, on one lift-progress variable. Flag, separate build, gating, probes. | Line-free environment, from the artwork (subtraction, no invention). Playground's reflection separated. Exact masks for Playground and Engineering. |
| **Not done** | Layered rendering for the other four stations (placeholders only, by design). | **A clean environment behind and under the stations.** It needs new illustration. Playground still uses M1.3H's synthesised background: the floor band is acceptable, but behind the cabinet is not convincing. Silhouettes for Educational, Creative Studio and Experience. |

## Try it

```bash
npm run layers:25d                 # regenerate the M1.3I layers (~15 s)
npm run build:layered              # experimental build into .next-layered/ (tsconfig.json restored)
NEXT_DIST_DIR=.next-layered npx next start -p 3001
npm run visual:scene25d -- --orig http://localhost:3000 --url http://localhost:3001 --out docs/m1.3i
```

Windows "Animation effects" is off on this machine, so a normal browser runs reduced motion: no spark and no lift. The recording and the evidence use full motion.

## Evidence (this folder; real Chrome, 1648 × 928)

| File | What |
|---|---|
| `scene-layer-plan.md` | Layer architecture and asset inventory |
| `background-requirements.md` | Exactly what new artwork is needed, with masks |
| `power-connections.md` | The independent connections: geometry, fidelity, sequence |
| `idle-comparison.png` | Reference, approved build, experimental build: Playground at rest (2×) |
| `playground-lifted.png` / `-approved.png` | Lifted, experimental / approved |
| `playground-lifted-no-shadow.png` / `-approved.png` | Lifted with every shadow layer hidden: **the honest view of the floor** |
| `lift-gap-3x.png` | The gap at 3×: approved and experimental, each with and without shadows |
| `connections-3x.png` | Playground's line at 3×: unpowered, charging, powered, approved vs experimental |
| `environment-3x.png` | The environment layer with lines and reflection removed, beside the approved rest |
| `connections.webm` | 6.3 s, real time: idle, charge from the A, lift (the line stays on the floor), hold, return and drain |
| `masks/` | Paint masks and `preview.png` |
| `probes.txt` | 19 behaviour and fidelity checks, all OK |
| `checks/` | Raw crops, diff heatmaps, `window-seams-8x.png`, `idle-worst-8x.png`, `environment-full.png` |

## 1. Layer architecture implemented

Back to front (details in `scene-layer-plan.md`):

- **A. Environment:** the plate plus `environment-corrections.png`.
- **B. Foundation:** an SVG joint.
- **G. Reflection:** moves with the lift.
- **F. Contact and ambient shadows:** opacity graded by height.
- **D. Station object:** moves.
- **E. Platform lighting:** on the object.
- **C. Connections:** grounded, in the lights layer.
- **H. Interface:** label, chips and arcade, which move.

**One lift variable.** `--lp` (registered CSS property, 0 → 1) runs on the lift's own curve and timing, so the shadows and reflection can never drift from the station. Reduced motion pins it at 0.

**Manifest.** `components/lab/scene-25d.ts` defines every station's layers. Only Playground's entry is a working prototype; Engineering keeps its approved M1.2.2 layers, and the other three are placeholders with their missing assets listed.

## 2. Assets currently available

- **All five connections:** trace and lit layers per part, plus SVG routes (`public/scene/layers25d/lines/`).
- **Environment corrections:** the line-free floor and Playground's reflection-free floor.
- **Playground:**
  - M1.3H cut-out;
  - M1.3H background, corrected (the reflection's light taken out of its edge pixels);
  - contact and ambient shadows;
  - reflection, unpowered and powered;
  - foundation path.
- **Engineering:** M1.2.2 cut-out and backdrop (approved, 5 px lift).
- **Platform lighting for all five:** M1.3F.1.

The `layers25d/` folder is 532 KB.

## 3. Missing assets requiring new illustration

The full list, masks and formats are in `background-requirements.md`.

1. **The floor under each station's footprint** (first priority; it fixes the lift gap). Playground's is synthesised, the others don't exist.
2. **The architecture behind each station** (wall, windows, steps, doors, furniture).
3. **Silhouettes** for Educational, Creative Studio and Experience. Their masks are approximate hotspot polygons until traced.

## 4. Power connection separation status

**Done for all five lines** (`power-connections.md`):

- The environment has no line.
- Each line is a trace, the lit painted line, the M1.3G glow, a 1.8 px vector core along the traced route, and the unchanged spark.
- The charge and drain logic, timing, arrival synchronisation, platform-strip activation, interruption and reduced-motion handling are **reused unchanged**. Only what the charge windows draw changed.
- The connections never move with a lift.

## 5. Playground integration results

All verified in `probes.txt`:

| | |
|---|---|
| **Lift** | The whole station, label, chips and running arcade rise 18 px with 1% scale. |
| **Grounded** | The environment, clean background, foundation joint and line layers don't move. |
| **Connection** | Charges progressively (part 1 at 99.5% and part 2 at 19%, 330 ms after hover). Fully powered when lifted. Drains from the station end back to the A. |
| **Platform strips** | Powered on the moving platform (`--pw` 1, light 0.75). |
| **Shadows** | Contact eases to 0.55 at full height; the ambient shadow takes over (1.0). |
| **Reflection** | Drops 9 px (half the lift) and fades to 0.65. It is treated as the strip's light on a glossy floor, not a mirror image. The painted reflection sits at the contact line, so a full mirror drop of 18 px separated it from the base too much. |
| **Return** | The station's area matches idle exactly (max 0). |
| **Switching** | Moving to Engineering mid-lift leaves nothing on. |
| **Keyboard and reduced motion** | Focus and blur work. Reduced motion: no lift, no shadow, no reflection movement. |
| **Loading** | No loading flash; the gated layers appear only after all 42 images decode. |

## 6. Visual fidelity differences

- **At rest, against the approved build:**
  - Outside the 16 line-window joints and ends: mean 0.023/255; 256 px (0.017%) over 12; max 43. These pixels are on the plate's own sharp line core at bends and starts, drawn through the charge window (`checks/idle-worst-8x.png`: indistinguishable at 8×).
  - At the joints the approved build leaks a 1 px hairline of the baked lit line between windows; the experimental build doesn't (`checks/window-seams-8x.png`).
- **Powered, against the approved build** (station excluded): mean 0.15; 436 px over 12. The vector core is a touch crisper.
- **Lifted:** different by design (shadows, reflection, gap). See below.
- **Reference vs either build:** the reference shows the platform strips lit; both builds show them unpowered at rest (approved M1.3F behaviour).

## 7. Remaining gap defects (shadows off, 3×)

1. **Gap floor.** M1.3H's synthesised band: real floor texture, no mirroring or smear, but slightly flatter and greyer than the real floor, with faint horizontal banding. Not painted artwork. This is the main defect and needs new illustration.
2. **Foundation joint.** A smooth, faint joint runs across the gap, 6 px inside the contact line. It reads as a stone joint or plinth step; whether it helps is your call. It hides the band's flatness a little, without darkening.
3. **Cut-out edge.** M1.3H's hand-traced outline is slightly stepped at the far right of the base, and keeps a few px of the cabinet's glow.
4. **Reflection residue.** Where the reflection was, two 1–2 px dark dashes remain at its old bottom edge, visible at 6×.
5. **Under the lines.** The floor under each line's 3 px core is estimated (`environment-3x.png`, right column). It is never seen in use, because the trace always covers it.
6. **Behind the cabinet.** M1.3H's synthesised background is not convincing. A lift never shows it.

## 8. Results

- `npm run typecheck`: pass.
- `npm run build` (default): pass. It references no M1.3I asset.
- `npm run build:layered` (experimental production build): pass. `tsconfig.json` and `next-env.d.ts` are unchanged afterwards.
- Real-browser checks: 19/19 OK (`probes.txt`), and `connections.webm`.

## 9. Recommendation for the next step

**Adopt the architecture, then get the artwork.**

1. **Commission (or approve generative inpainting of) the floor bands** under Playground and Engineering, using `masks/*-floor.png`, at 2× if possible. Swap them in with a small re-matting step. This is the one thing that makes the lift gap convincing.
2. **Decide on the foundation joint and the reflection drop** (both are one-line settings: `JOINT_INSET`, `reflectionDrop` and `reflectionFade`).
3. **Then trace the silhouettes** of the other three stations and extend the masks. Lift no other station until SA-1 is approved for Playground.
4. **Optional engineering:** a mask-driven charge reveal, so the line layers draw pixel-aligned. That removes the last idle differences, but changes the charge controller.

Do not merge the experimental build into the default until you have approved the lifted appearance (SA-1).

## Files

**New**

- `scripts/make-scene-layers.mjs`
- `scripts/make-background-masks.mjs`
- `scripts/build-layered.mjs`
- `scripts/visual/scene25d-evidence.mjs`
- `components/lab/scene-25d.ts` (manifest, flag)
- `components/lab/scene-25d-data.ts` (generated)
- `components/lab/SceneDepth.tsx` (environment corrections, reflections)
- `public/scene/layers25d/**`
- `docs/m1.3i/**`

**Changed (every change is inert unless the flag is on)**

- `components/lab/ChargeLine.tsx`: layered window content.
- `components/lab/LabScene.tsx`: two components.
- `components/lab/PlatformPower.tsx`: a `pad` option, and skips a reflection drawn as its own layer.
- `components/lab/StationLayers.tsx`: foundation and depth shadows for a layered station.
- `components/lab/scene-layout.ts`: flag alias; corrected Playground background.
- `app/globals.css`: `--lp` and its consumers (replaces the M1.3H shadow rule).
- `package.json`: `build:layered`, `layers:25d`, `visual:scene25d`.
- `README.md` and `docs/station-animation-spec.md`: status.

**Not touched:** `reference/`, `lab-plate.webp`, every approved asset, `EnergySurge` and the charge and drain logic, the arcade game, the other stations.
