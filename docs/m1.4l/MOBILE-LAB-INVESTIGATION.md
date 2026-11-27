# M1.4N: mobile laboratory usability investigation (27 Nov 2026)

**Branch:** `feat/lab-v2` at `c03d97b`. This is an investigation only: no application code changed.

**Method:** a development server and the repository's headless Chrome harness, with touch emulation and portrait orientation unless stated, in both Cinematic and Static Lite. The probes were temporary and are not in Git. Screenshots are in `docs/m1.4l/work/captures/mobile/`, which Git ignores (`docs/**/*.png`).

**Summary.**
- On portrait screens the lab can show and run any station; what it lacks is a way to pick one.
- The cause is the layout's units: the scene is cover-scaled to the screen's height, while the header and hero are drawn for a frame at least 1037 px wide.
- The recommendation is **Option B**: a mobile station selector that drives the existing state, panels, URLs and project links, with the scene kept as the backdrop. Build it on `/lab-v2` only, without touching any file that Static Lite's staleness check watches.

## 1. Reproduced problems

### 1.1 Portrait viewports

| | 320 × 568 | 390 × 844 | 430 × 932 | 768 × 1024 |
|---|---|---|---|---|
| Scene scale (`--su`, cover) | 0.60 | 0.90 | 0.99 | 1.09 |
| Header and hero scale (`--vu`) | 0.62 (its minimum) | 0.62 | 0.62 | 0.62 |
| Visible slice of the 1672-px frame (x) | 546–1126 | 617–1055 | 618–1054 | 480–1192 |
| Share of each station's hit area on screen, at rest (Eng / Edu / Play / Creative / Exp) | 9 / 100 / 26 / 0 / 0 % | 0 / 100 / 0 / 0 / 0 % | 0 / 100 / 0 / 0 / 0 % | 35 / 100 / 41 / 6 / 0 % |
| Stations whose title can be tapped | Educational only | Educational only | Educational only | Educational only |
| Same share with the station selected by deep link, Cinematic (Eng / Play / Creative / Exp) | 23 / 22 / 0 / 0 % | 9 / 0 / 0 / 0 % | 10 / 0 / 0 / 0 % | 46 / 36 / 15 / 0 % |
| Header parts overlapping (brand, nav, utilities) | 3 pairs | 3 pairs | 3 pairs | nav × utilities |
| Nav links that can be tapped | 1 of 4 | 0 of 4 | 0 of 4 | 3 of 4 |
| Hero heading over the Educational label | **Yes** | No | No | No |
| Station title height | 12 px | 18 px | 20 px | 22 px |
| Chip height | 16 px | 23 px | 25 px | 28 px |
| "Open project" and "Back to Lab" heights | 13 and 14 px | 13 and 14 px | 13 and 14 px | 13 and 14 px |

**Cinematic and Lite are the same,** because both use the same units and labels. The one difference is selection: Lite has no camera move, so selecting a station leaves the framing exactly as at rest.

### 1.2 Edge cases: the trigger is aspect ratio, not width

| Viewport | Aspect | All five stations' titles and chips visible and tappable | Header overlaps | Hero over a station label |
|---|---|---|---|---|
| 844 × 390 (landscape phone) | 2.16 | **Yes** | 1 pair | Engineering |
| 932 × 430 (landscape phone) | 2.17 | **Yes** | 1 pair | Engineering |
| 1024 × 768 | 1.33 | Yes | None | None |
| 1180 × 820 | 1.44 | Yes | None | None |
| 820 × 1180 (portrait tablet) | 0.69 | **Educational only** | 1 pair | None |
| 1024 × 1366 (portrait tablet) | 0.75 | **Educational only** | None | None |
| 1280 × 800, 1366 × 768 | 1.6, 1.78 | Yes | None | None |

### 1.3 What works on phones

- **Touch on Educational,** the station in view:
  - tapping its title selects it, and tapping a chip selects the project;
  - "Open project" and "Back to Lab" respond.
- **Every station's panel fits on screen.** At all four portrait widths, each of the five panels sits at the same place (75, 90) and size (267 px wide) and is fully in view. This includes stations whose scene is off-screen.
- **Back and forward** on touch step through project, station and lab, in both modes.
- No console errors.

### 1.4 Screenshots

All are in `docs/m1.4l/work/captures/mobile/`:

- `{320,390,430,768}-{full,lite}-rest.png`;
- `…-educational-arimap.png`: Educational and AriMap selected by touch;
- `390-{full,lite}-selected-{engineering,experience}.png`;
- `390-full-anchor-experience.png`.

They show:

- **390, Engineering selected:** the room dims around a spotlight that is off-screen. Engineering's panel is up, but only "…efresh" of its chip shows at the left edge, while Educational stays fully in view.
- **390, Educational selected:** the panel's "Back to Lab" line touches Educational's own in-scene label and icon.
- **320 × 568:** the hero heading lies over the Educational label and its chips.

## 2. Root causes

1. **The scene is cover-scaled to the height.** `--su` is the larger of the two fits (`app/globals.css`, scene units). In portrait it follows the height, so the visible slice of the frame is 941 × width ÷ height reference px wide: about 435 at 390 × 844, and about 710 on portrait tablets. The stations span reference x 92–1664, with Educational in the middle, so only Educational fits. The problem is the aspect ratio, which is why 1024 × 1366 fails while 844 × 390 works (§1.2).
2. **The camera can't bring a station into view.** `frameTarget` (`lib/camera.ts`) limits every shot to the plate's zoom margin, about 75 reference px at 1.09×. It was designed to lean towards a station on a 16:9 screen (M1.3A §8, limitation 2), not to travel the 400–600 px a phone would need. Lite has no camera at all.
3. **The header and hero have a minimum size.** `--vu` = max(0.62 px, contain scale). Below about 1037 px wide (1672 × 0.62), the header keeps the width of a 1037-px frame. Its parts are placed independently: the brand from the left, the nav from the centre, the utilities from the right. On narrow screens they slide over each other, and the utilities row (Cinematic/Lite selector, search, Let's Talk) covers the nav. The hero keeps its desktop position and a 25 px heading, so on short screens it lands on the scene, whose scale follows the height instead.
4. **There is no mobile layout at all.** The lab has no media queries, touch handling or swipe handling.
   - M1.3A left it unfinished on purpose: "On phones the scene is the desktop composition cover-scaled… That is a layout task for a later milestone" (`docs/m1.3a/NOTES.md`, §7).
   - The selector record says narrow viewports weren't checked (`docs/performance/render-mode-selector.md`, issue 2).
   - The SQLOrbit record notes the lab "has no narrow-screen header yet" (`SQLORBIT-PROTOTYPE.md`).
5. **Touch targets.** Station titles, chips and the panel's links are sized in reference units, so on phones they fall below 24 px, the WCAG 2.5.8 minimum. "Open project" is 13 px and "Back to Lab" 14 px everywhere below about 1440 px wide; M1.3A §7 recorded the hero buttons' share of this.

## 3. Current touch and navigation behaviour

- **Selection** works through the station title (a disclosure button), its hotspot or a chip. Hover is never required (M1.3A §7). On a phone, only the controls inside the visible slice can be reached, which in practice means Educational's.
- **Panels** live in the hero, which is anchored to the viewport rather than the scene. So a selected station's information, its projects, "Open project" and "Back to Lab" are all usable on a phone, even when the station itself is off-screen.
- **URLs and history** work as on desktop: `?station=…&project=…` with `pushState`, deep links, and returning from project pages with `&render=lite` kept.
- **Scrolling:** the page is one fixed screen (`body { overflow: hidden }`). There is no panning, swiping or scrolling to reach other stations.
- **The header's nav links** are in-page anchors (`#lab-stations`, `#station-experience`, `#lab-intro`), and "Explore the Lab" links to `#lab-stations`. On a phone, `#station-experience` targets an element that is off-screen inside the `overflow: hidden` `<main>`. Following it scrolls `<main>` 290 px sideways and the scene 56 px down; the layout stays shifted until reload (`390-full-anchor-experience.png`). See §10 for the same effect on desktop.
- **Screen readers and keyboards:** the off-screen stations' titles and chips stay in the focus order and the accessibility tree while invisible.

## 4. Options

### Option A: keep the scene and pan it

On narrow screens, move the scene sideways to frame the selected station, with controls to step between stations and perhaps a swipe gesture.

- **Feasible in principle.** The plate has artwork across its full width, so a pan can show each station. Engineering (≈340 reference px wide), Playground (≈320) and Creative (≈420) fit a 435-px slice.
- **Experience doesn't fit.** Its hit area is about 460 reference px wide, so at 390 and 430 px it can't be framed whole without zooming below the cover scale. That would leave bands above and below the plate.
- **It needs a new framing layer.** It would have to compose with the approved camera (850 ms in, 700 ms out) without changing its timing. Both renderers would need it: `LabScene` centres its frame with a translate, and `LabSceneStatic` positions its own by layout.
- **Static Lite re-bake risk.** Doing it inside `LabScene.tsx` or `scene-layout.ts` marks Static Lite's images stale (§7), and a re-bake on this computer isn't allowed. A wrapper around the scene in the page avoids that, but the per-station mobile framing then needs its own data module.
- **Controls are still needed.** A swipe alone isn't discoverable or accessible, and on iOS an edge swipe competes with the browser's back gesture. So Option A needs the same station controls as Option B, plus the pan.
- **The panel still overlaps.** The hero's panel sits over the top of the scene, where Educational's label is, at all phone sizes.
- **Performance is unknown.** Panning the full Cinematic stack (16 images, blend modes, a canvas and the station animations) on a phone GPU hasn't been measured. Lite would be cheap.

### Option B: dedicated mobile station navigation

On portrait screens, keep the lab scene as the backdrop at its current framing: Educational's island under the arch and the central "A" platform, which carry the lab's identity. Add the following:

- **A compact header** with the brand and the Cinematic/Lite selector. The project pages' `CompactHeader` (below 1024 px) is the precedent.
- **The hero heading** at a fixed mobile size at the top.
- **A station dock** at the bottom, in place of "Explore the Lab": five buttons, each with the existing station icon and name. Tapping one calls the existing `selectStation`.
- **The existing station panel,** with its projects, "Open project", "Coming soon" and "Back to Lab", restyled for touch (targets of at least 44 px) and placed above the dock.
- **In station mode,** the in-scene labels, chips and hotspots are hidden and inert, so no off-screen control stays focusable and there's one set of controls.

Everything else stays the same: state, URLs, history, deep links, the project pages' "Back to the lab" (which reopens the station and project) and both renderers. The scene itself doesn't change.

### Comparison

| | Option A: pan the scene | **Option B: station navigation** |
|---|---|---|
| Discoverability | Needs arrows or dots. A swipe alone is hidden | All five stations visible at once, labelled |
| Touch usability | Pan and tap targets in the scene. Chips about 23 px at 390 | Targets of 44 px or more, by design |
| Visual quality | Shows each station, but can't frame Experience whole at 390 and 430 px. The panel still covers the upper scene | One fixed framing (Educational and the "A"). Other stations' artwork isn't shown on phones |
| Performance | Moves the whole scene, unmeasured on phones. Selected stations animate on-screen | No new images or animation, small DOM. Selected stations' animations run off-screen (Cinematic) |
| Accessibility | Off-screen controls need hiding as the view moves | One button list, plus the panel's existing disclosure, focus and announcements |
| Implementation risk | Higher: a new framing system beside the camera, two renderers, near the watched scene files | Low: new components and scoped CSS, driven by existing state, with no scene files touched |
| Maintenance | Two framing systems (camera and pan) to keep in step | One extra presentation layer over shared state |
| Desktop preservation | Achievable but close to the scene code | Gated by media queries: desktop pixels unchanged (§8) |

## 5. Recommendation

**Option B, on `/lab-v2` only, as the first step.** Option A's pan can follow as a separately approved enhancement once B is in place, since B's dock would be its controls. Option B fixes all three reported problems (header, reachability, discoverability) without touching the scene, the camera, the animations or Static Lite's assets.

**When the mobile layout applies.** There are two conditions, measured from the causes in §2:

1. **Compact header:** viewport narrower than about 1040 px, where the header no longer fits its minimum frame. This includes landscape phones.
2. **Station mode** (dock, mobile panel, in-scene labels hidden): aspect ratio below about 5:4, which covers portrait phones and portrait tablets.

Landscape phones and anything 4:3 or wider keep the scene's own labels, which are reachable there (§1.2). The exact threshold between 1.0 and 1.33 is a validation item (§8.6).

**First paint (context only).** Production first paint on the lab is about 1.0–1.2 s, even with fast server responses (`PRODUCTION-VERIFICATION.md` §6, item 2). This milestone doesn't address it. Option B adds no images, decoding or animation, so it shouldn't change it measurably. No rendering change is proposed.

## 6. Expected impact on `/` and `/lab-v2`

- **`/lab-v2`:**
  - On desktop, 4:3 and wider, and at least 1040 px wide, the pixels are unchanged.
  - The server markup gains the mobile elements, hidden by CSS on desktop and so absent from the accessibility tree. So the M1.4L check that `/lab-v2`'s markup is byte-identical to `63fb64f` no longer applies; pixel identity and an unchanged desktop accessibility tree replace it.
  - On phones and portrait tablets, the new layout.
- **`/`:**
  - It shares `SiteHeader`, `LabHero`/`StationPanel`, `LabStations`, `LabState` and `globals.css`, and has the same mobile problems (`PRODUCTION-VERIFICATION.md` §6, item 1).
  - The work should be gated by props on `/lab-v2`, as the `utilities` and `projectPages` props already are. The homepage's markup and pixels would then stay byte-identical at every size.
  - Bringing the mobile layout to `/` is a separate decision after approval (§9).

## 7. Implementation boundaries

**May change:**

- `app/lab-v2/page.tsx`;
- new components under `components/lab/` (for example a mobile station dock and a compact lab header);
- `components/ui/SiteHeader.tsx`, only through a new optional prop whose default output is unchanged;
- `LabHero.tsx` and `StationPanel.tsx`, only additively (a class or data attribute for mobile styling) with identical desktop output;
- `app/globals.css`: new classes and media queries only, with no change to an existing scene class.

**Must not change:**

- **The 37 code files that the Static Lite check watches** (`node scripts/static-lite/check.mjs --list`). These include `LabScene.tsx`, `SceneV2.tsx`, `scene-layout.ts`, `lib/scene.ts`, `data/zones.ts` and the station modules. Anything under `public/scene/` is also off limits.
- `lib/camera.ts` and the camera shots.
- Animation timings.
- `components/project/*` and `data/projects.ts`.
- The homepage `app/page.tsx`.

**Already outside the check's watch list** (so changing them can't make Lite stale): `LabStations`, `LabHero`, `StationPanel`, `LabState`, `LabCamera`, `LabSceneStatic`, `SiteHeader` and the page files.

**Proof:** `npm run static-lite:check` must still report "current" after the change.

## 8. Minimal validation plan

1. **Static checks:** `npm run typecheck`, and `npm run static-lite:check` (current).
2. **Desktop unchanged:**
   - 0 px pixel difference against `c03d97b` at 1648 × 928, 1366 × 768 and 1920 × 945, in Cinematic and Lite, at rest, with Engineering hovered and with Engineering selected;
   - `/`'s server markup byte-identical to `c03d97b`.
3. **Mobile layout** at 320 × 568, 390 × 844, 430 × 932, 768 × 1024, 820 × 1180 and 1024 × 1366 (portrait), and 844 × 390 (landscape):
   - no header overlap, and no horizontal overflow;
   - all five stations selectable by tap, and the panel fully in view;
   - targets at least 44 px (never below 24 px);
   - no console errors;
   - in both Cinematic and Lite.
4. **Touch flows:**
   - each station and each project;
   - "Open project" → project page → "Back to the lab" returns to the same station and project in the mobile layout;
   - Back and Forward; direct deep links;
   - the Cinematic/Lite selector;
   - "Coming soon" for Wallpapers and Koreez.
5. **Accessibility in station mode:**
   - no focusable control off-screen;
   - reading order: header, hero, dock, panel;
   - the existing announcements and focus return still work;
   - reduced motion.
6. **Threshold:** check aspect ratios 1.0–1.33 (for example 1000 × 1000, 1024 × 900, 1180 × 820) and choose the exact switch point by eye.
7. **Real devices, once:** one iPhone (Safari) and one Android phone (Chrome), on a production build, for look and Cinematic performance. Headless emulation doesn't stand in for a phone GPU.

## 9. Decisions requiring visual approval

1. **Direction:** Option B now. Option A's pan as a later enhancement, or not at all.
2. **Dock form:** a single row of five icons with names, a horizontally scrolling row, or a short list. At 320 px each of five slots is 64 px wide, which is tight for "Creative Studio" and "Experience".
3. **Panel placement:** a bottom sheet above the dock (recommended: thumb reach, clear of the hero), or under the hero heading.
4. **Compact header contents:**
   - the brand and the Cinematic/Lite selector;
   - whether search and "Let's Talk" stay, as icons;
   - whether the three anchor nav links are dropped on phones, since the dock replaces them and they misbehave (§3).
5. **The scene during a mobile selection:**
   - leave it as is, which is the lowest risk (Cinematic leans slightly towards the off-screen station, and the room dims around an off-screen spotlight);
   - or keep the scene idle and dim it evenly in station mode.
6. **In-scene labels in station mode:** hide all five, including Educational's (recommended for one consistent set of controls), or keep Educational's as decoration.
7. **Thresholds:** about 1040 px for the compact header and about 5:4 for station mode. Landscape phones would get the compact header only; their hero still touches the Engineering label (§1.2).
8. **The homepage `/`:** whether and when to bring the mobile layout there, given it is the production page.
9. **Not for this milestone (flagged only):** whether phones should default to Lite. That needs real-device performance data and is a rendering-policy change.

## 10. Pre-existing defect found (outside this milestone)

**Desktop: the header's "Experience" link shifts the scene.**

- **Where:** on `/` and on Cinematic `/lab-v2` (1648 × 928). Lite isn't affected.
- **What happens:** following `#station-experience` scrolls the scene's `overflow: hidden` frame 61 px up and leaves it there. A black band appears at the bottom, and the hero heading runs into the Engineering label until reload.
- **What doesn't:** "Projects" and "About" don't do this.
- **Cause:** the browser scrolls the off-frame anchor target into view inside a container that is meant never to scroll.
- **Status:** not fixed here. It affects the approved desktop experience and the production homepage, so it merits its own small, separately approved fix.
