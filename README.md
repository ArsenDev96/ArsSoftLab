# ArsSoftLab: Inside the Mind of a Builder

Personal portfolio of **Arsen Manukyan**, built with Next.js (App Router), TypeScript and Tailwind CSS v4.

Current milestone: **M1.3A, five-station interaction system**: every station can be hovered, focused and selected, shows its information and projects in the hero slot, and returns to the lab.
M1.1 (the static recreation) is the approved baseline. Idle must keep matching it, which `npm run visual` checks.
Earlier milestones: M1.2 / M1.2.1 (ambient animation), M1.2.2 (Engineering as an independent layer).
The design authority is [`reference/approved-lab-design.png`](reference/approved-lab-design.png). Never edit this file.

## Run locally

Requires Node.js 20.9 or later.

```bash
npm install
npm run dev          # http://localhost:3000
```

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # production build (also type-checks)
npm run start        # serve the production build
npm run visual       # visual + interaction checks against a running server (see below)
npm run visual:lift  # M1.2.2 station-lift evidence (frames, edges, timing; --record for a recording)
npm run visual:stations  # M1.3A evidence (GPU timing, DOM-churn probe; --record for a recording)
```

## Visual regression checks

`scripts/visual/` drives a local headless Chrome over the DevTools protocol. It has no npm dependencies and needs Node 22+.
Pixel comparisons run on a canvas inside Chrome.

```bash
npm run build && npm run start                  # terminal 1 (http://localhost:3000)
npm run visual                                  # terminal 2, writes to .visual/
npm run visual -- --url http://localhost:3100 --out docs/m1.3a   # custom server / output
```

What it checks (the run exits non-zero on any failure):

- **Idle at 1648×928.** Animations frozen at rest, compared to `docs/m1.1/homepage-1648x928.png` (max delta 4/255 by default, `--tolerance`). Every light off, every label fully shown.
- **Hover, each station.** Its platform strips and connection light up; other labels stay fully readable; everything fades back out.
- **Selection, each station (pointer).** It becomes the only selected station. The hero shows its title, description and projects. Focus moves to the info heading. The camera moves the scene only (the header is untouched) and never exposes an image edge. No in-scene label sits under the hero info. Its connection is the primary one, the others run quieter.
- **Back to Lab, each station.** The lab passes through "returning" and comes back. Focus returns to the station's title. The screenshot matches idle.
- **Projects, all seven.** Selectable from the in-scene chip (selects the station too) and from the hero, where selecting again clears it. The hero shows the one-sentence description, and Open project says the page is coming soon (no link).
- **Keyboard, each station.** Tab reaches the title with a visible focus ring. Enter selects. Tab and Space select a project. Open project announces that its page is coming soon. Tab reaches Back to Lab. Escape returns, clears the project and restores focus. Enter on the selected station's title returns too.
- **Switching and invariants.** Station to station, platform clicks, chip clicks and toggling. At every step: one station, one open panel, one expanded title, and the project belongs to the station.
- **Camera at other sizes.** 1366×768, 1920×1080, 1280×1024, 2560×1080 and 1024×1366: no exposed edge for any station. At the two 16:9 sizes, no label under the hero.
- **Reduced motion, each station.** No camera move or lift, info reachable, Escape returns. Hover brightens Engineering without lifting it.
- **Touch (390×844, no hover).** Tap selects a station and a project; Back to Lab returns and leaves no hover state behind.
- **No persistent artifacts.** A long session (hover, select mid-transition, projects, keyboard) ends pixel-identical to idle.
- **Engineering lift (M1.2.2).** Layers hidden at rest. Hover, Tab focus and selection lift the cut-out (≤1.015×, about 5 px). Labels follow it to within 0.5 px. The return matches idle. Skipped when the layers are switched off.

Outputs:
- `idle.png`, `<station>-selected.png` (×5), `project-selected.png` and `regression.txt`;
- supporting screenshots in `checks/`, including `idle-comparison.png` (baseline, idle, difference).

`npm run visual:stations -- --url … --out docs/m1.3a [--record]` measures GPU frame timing and DOM churn (`performance.txt`). With `--record` it renders deterministic 30 fps recording frames into `.visual/stations-work/rec`.

`npm run visual:lift -- --url … --out docs/m1.2.2 [--record]` captures the M1.2.2 evidence:
- idle, hover and return screenshots;
- intermediate frames, with transitions paused at fixed times;
- 4× edge crops;
- the layer-swap measurement;
- GPU frame timing.

With `--record` it also renders deterministic 30 fps recording frames into `.visual/station-lift-work/rec`.
Set `CHROME_PATH` if Chrome or Edge isn't found automatically.

## How the scene is built (layered 2.5D)

```
viewport
├─ SiteHeader       real HTML nav, anchored to the viewport
├─ LabHero          "INSIDE MY LAB" copy (the page <h1>)
├─ ExploreCue       bottom-centre cue
└─ LabScene         a 1672 × 941 stage, cover-scaled to the viewport
   ├─ LabCamera         transforms the scene only (identity at rest)
   │  ├─ layer "plate"     environment render with the baked-in UI removed
   │  │  └─ StationLayers  Engineering as its own layers (M1.2.2), shown only while lifted
   │  ├─ layer "lights"    StationLights: platform strips + connection lines, lit on hover/selection
   │  ├─ layer "fx"        masked light: EnergyFlow, GlobeOrbit
   │  ├─ FocusVignette     darkens the room around the selected station
   │  └─ layer "stations"  polygon hotspots and HTML labels for the 5 stations
   └─ (LabHero hosts a StationPanel per station: its info in the hero slot, never scaled)
```

- **Coordinates.** Everything in the scene uses the reference image's own pixel space (1672 × 941).
  `--u` equals one reference pixel. Inside the stage it follows the cover scale (`--su`).
  In the viewport UI it follows a contain scale (`--vu`), so the header and hero never get cropped.
- **Clean plate.** `public/scene/lab-plate.webp` is generated from the reference by
  [`scripts/make-clean-plate.py`](scripts/make-clean-plate.py). The script removes the baked-in
  text, chips and buttons so they aren't shown twice under the HTML versions.
  Scene objects like the central A, the book spines and the mug are kept.
  To regenerate it you need `opencv-python-headless` and `numpy`. They are only needed for this script, not for the site.

  ```bash
  python scripts/make-clean-plate.py
  ```

- **Light masks (M1.2).** `public/scene/masks/*.png` isolate pixels that already glow in the plate:
  the five connection lines and the globe's orbit ring.
  [`scripts/make-scene-masks.py`](scripts/make-scene-masks.py) generates them, with the same dev-only requirements.
  The animated highlights move by `transform` only and are seen through these masks.
  They can brighten existing light but never draw new geometry.
  If you change line or orbit geometry, update both the script and `components/lab/scene-fx.ts`.
  M1.3A adds `platforms.png`: each platform's own amber strips, at half resolution, behind the hover/selection platform light.
  Its bands mirror `PLATFORM_LIGHTS` in `scene-fx.ts`.

  ```bash
  python scripts/make-scene-masks.py
  ```

- **Independent station layer (M1.2.2, Engineering only).**
  [`scripts/make-station-layers.py`](scripts/make-station-layers.py) cuts Engineering out of the plate along a hand-traced silhouette.
  It reconstructs the scenery behind the station and solves the cut-out's colours so the layers recompose the plate exactly.
  It writes four full-frame lossless WebPs to `public/scene/layers/`: backdrop, station, contact shadow and hover light.
  The page draws them clipped to a small box (`STATION_LAYERS` in `components/lab/scene-layout.ts`).
  At rest the layers are hidden, so idle is the untouched plate.
  To turn the experiment off, build with `NEXT_PUBLIC_STATION_LAYERS=off`; that gives exactly the M1.2.1 scene.
  If you change the silhouette, copy the box the script prints into `scene-layout.ts`.
  Findings are in [`docs/m1.2.2/NOTES.md`](docs/m1.2.2/NOTES.md).

  ```bash
  python scripts/make-station-layers.py [--preview docs/m1.2.2]
  ```

- **Interaction state (M1.3A).** `LabStateProvider` holds the selection in one reducer: at most one station, and a project that always belongs to it.
  Hover and keyboard focus never enter React context. They are written to `data-lab-hover` on a wrapper, so pointer movement doesn't re-render consumers.
  The provider generates one tiny CSS rule per station that sets `--zone-hover` / `--zone-selected` on that station's elements (`data-zone`).
  Every visual response (labels, platform and connection lights, energy pulses, orbit, lift) is a CSS rule reading those variables.
  Camera shots for all five stations are in `CAMERA_SHOTS` (`scene-layout.ts`). Every shot is clamped so no edge shows.
  Some shots are limited further so no in-scene label lands under the hero info.

## Where things live

| Path | Purpose |
| --- | --- |
| `data/projects.ts` | Project metadata (name, slug, zone, optional summary and destination). CMS-replaceable. |
| `data/zones.ts` | Station content: title, one-line description, icon, accent, project list. |
| `data/site.ts` | Brand, hero copy, nav items. |
| `components/lab/scene-layout.ts` | Measured geometry per station: label anchor, sizes, hotspot polygon, platform centre, depth; camera shots. |
| `components/lab/LabScene.tsx` | Stage and layer stack. |
| `components/lab/LabState.tsx` | Selection reducer, hover attributes, per-station CSS state, Escape, focus return, announcements. |
| `components/lab/LabCamera.tsx` | 2.5D camera wrapper and focus vignette. |
| `components/lab/EnergyFlow.tsx`, `GlobeOrbit.tsx`, `MaskedLight.tsx` | M1.2 light animations (transform-only, mask-clipped). |
| `components/lab/scene-fx.ts` | Connection and orbit geometry, animation tracks, light boxes. |
| `components/lab/StationPanel.tsx` | Station info in the hero heading slot while selected: projects, project sentence, Open project, Back to Lab. |
| `components/lab/StationLights.tsx` | Masked platform and connection lights for hover and selection. |
| `components/lab/StationLayers.tsx` | M1.2.2 station cut-out, backdrop, contact shadow and light (lift on hover/focus). |
| `lib/camera.ts` | Camera shot maths (clamped so the plate never exposes an edge). |
| `components/lab/LabStations.tsx` | Station hotspots and labels. |
| `components/lab/ProjectStation.tsx` | Reusable station label: icon, title button, project chips. |
| `components/lab/SceneLayer.tsx` | Full-frame layer exposing `--layer-depth` for future parallax. |
| `components/ui/*` | Header, search trigger (Ctrl/⌘+K), monogram, icon set. |
| `lib/scene.ts` | Scene constants and coordinate helpers. |
| `docs/m1.1/` | Validation screenshot, side-by-side comparison, alignment report. |
| `docs/m1.2/` | Animation evidence, regression report, recording, findings. |
| `docs/m1.2.1/` | Refinement evidence (generated by `npm run visual`), recording and notes. |
| `docs/m1.2.2/` | Station-layer evidence: mask and reconstruction previews, lift frames and edges, recording, regression, notes. |
| `docs/m1.3a/` | Five-station interaction evidence (generated by `npm run visual`), performance, recording, notes. |
| `scripts/visual/` | Visual regression and interaction checks (`check.mjs`), station-lift evidence (`station-lift.mjs`), M1.3A evidence (`stations-evidence.mjs`). |
| `app/icon.svg`, `app/favicon.ico`, `app/apple-icon.png` | Favicons from the A monogram (Next.js icon conventions). |

## Accessibility

- All visible text is real HTML. The page has a single `<h1>`, and each station is a `<section>` with an `<h2>`.
- Each station title is a disclosure button (`aria-expanded`, `aria-controls` → its info panel). Activating it selects the station; activating it again returns to the lab.
- When a station is selected, focus moves to its info heading.
- The project names in the hero are toggle buttons (`aria-pressed`). The in-scene chips are toggle buttons as well and select the station too.
- Open project is focusable but `aria-disabled` and described as "Project page coming soon". Activating it says so in a live region; it never links to a page that doesn't exist.
- Escape (anywhere) or Back to Lab returns. Focus goes back to the station's title if it was in the hero info or would otherwise be lost.
- A polite live region announces the selected station (with its description), the selected project (with its sentence) and the return.
- Hotspots are pointer-only polygons around each station that never overlap one another. Keyboard and touch users use the titles; nothing depends on hover.
- Station descriptions are in the hero as plain text, never only on hover.
- There's a skip link, visible focus rings, and `aria-current` on the active nav item.
- Under `prefers-reduced-motion: reduce`, the light animations are removed, the camera does not move, and nothing lifts.
  Selection is a plain cross-fade (vignette, dimming, hero/info swap), and hover still brightens.
