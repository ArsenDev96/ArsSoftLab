# Static Lite rendering experiment

> **Integrated:** Lite (`?render=lite`) is now this flattened scene, as recorded in `STATIC-LITE-INTEGRATION.md`.
> - `?render=static` no longer exists.
> - The bake moved to `scripts/static-lite/`.
>
> Below is the prototype's record, unchanged; the paths and URLs in it are as they were then.

## Result: **the flattened scene is responsive on the office computer. Recommendation: ADOPT** (conditions in §7)

- **Every interaction now runs at 60 fps.** Hovering, switching, selecting and clicking chips no longer produce a single frame over 50 ms (Lite: 150–300 ms frames on every state change).
- **Stations answer on the frame the hover registers.** In Lite they reach half power after 168–350 ms; switching drops to 8–9 fps, and 7–8 of 10 quick visits never light at all.
- **The compositor does about 1/45 of the work on a hover and 1/33 on a sweep.**
- **The page loads in a sixth of the time or less.** The scene shows in 0.5 s instead of 3.1–6.9 s, from 6 requests instead of 59.
- **It looks like Lite.** At the scene's own scale it is pixel-identical to Lite. At other window sizes it is very slightly softer: the plate is resampled as one image instead of as about 60 layers.
- **It behaves like Lite.** Hit regions, labels, chips, keyboard, deep links, the hero and the project pages all work as before.
- **Cinematic, Lite and `/` are unchanged:** their server markup is byte-identical to the committed version.

**Setup:**
- office computer (Radeon HD 5450; its driver is blocklisted, so default Chrome composites in software);
- Chrome with default flags, headless, 1648 × 928, dev server;
- two rounds per mode, alternating, each on a fresh browser profile.

This is an experiment. `?render=static` is reachable only by URL. **Lite has not been replaced.**

## 1. What was built

`/lab-v2?render=static` swaps Lite's layer stack for two kinds of image; everything else on the page is unchanged.

| | Lite (`?render=lite`) | Static prototype (`?render=static`) |
|---|---|---|
| Scene | About 60 full-frame layers: the environment, floor light, contact shadows, stations, the hub and connections; many blended with `plus-lighter` or masked | **One image** (`plate.webp`, 1672 × 941): Lite's resting scene, captured from Lite itself |
| A station powering on | Its strips, screen, chart, ring and connection cross-fade over 150 ms, through full-frame overlays | **One sprite per station** (`on-<station>.webp`): only the pixels its power changes, cropped to their box (7–15 % of the frame), shown at once |
| Selection | The vignette fades over 850 ms; the other labels dim over 500 ms | The same vignette and dimming, **instantly** |
| Camera, lifts, sparks, animated light | None (Lite) | None |
| Hit regions, bridges, labels, chips, icons, keyboard, hero, URL | Live HTML | **The same components, unchanged:** `LabStateProvider`, `LabStations`, `LabHero`. The rest outlines of the five targets are Lite's |
| Elements under `<main>` | 728 | 185 |

**How the images were made** (`work/static-bake.mjs`, `work/static-bake.py`):
1. Lite is rendered at exactly 1672 × 941, so its stage is drawn at scale 1, with the header, hero, labels and chips hidden.
2. One frame is captured at rest, and one with each station powered (hovered).
3. A second rest frame, captured after all five, is identical to the first (difference 0): Lite is truly static at rest.
4. Each sprite keeps the pixels that differ from rest and is transparent elsewhere. Drawn over the plate, each one gives its captured powered frame back exactly (difference 0).
5. Both kinds of image are lossless WebP.

No artwork was redrawn and no background was added: every pixel comes from Lite's own rendering.

### Files

| File | Change |
|---|---|
| `components/lab/LabSceneStatic.tsx` (new) | The prototype scene: plate, five sprites, the focus vignette, and `LabStations` with Lite's rest targets |
| `app/lab-v2/page.tsx` | `render=static` renders `LabSceneStatic` instead of `LabScene`. The mode selector shows **Lite** as selected |
| `lib/lab-v2-pages.ts` | `labViewQuery` keeps `render=static`, like `lite`, so a project page and its Back to the lab return to the prototype |
| `public/scene/static-lite/` (new) | `plate.webp` (1.66 MB) and five sprites (137–275 KB), 2.6 MB in all |
| `docs/performance/work/static-*.{mjs,py}` (new) | The bake, the comparison and the performance probes. Results are in `work/results/static-*.json`; captures are in `work/captures/static/` (ignored by Git) |

**Unchanged:**
- `LabScene`, `SceneV2` and every station component;
- all artwork, `globals.css` and `LabState`;
- the homepage `/`.

The server markup of `/lab-v2`, `?render=lite`, a Lite project page and `/` is **byte-identical** before and after. `?render=static` itself differs, which confirms the check actually compared the two versions.

## 2. Measurements

Default Chrome, software compositing, 1648 × 928, dev server. Ranges cover both rounds; each hover figure covers 5 stations × (first + repeat) × 2 rounds = 20 hovers per mode. Results are in `work/results/static-perf.json`.

### Hover

| | Lite | **Static** |
|---|---|---|
| Frame rate over 1 s | 13.5–39.7 fps | **60 fps** |
| Median / p95 / longest frame | 17–33 / 50–250 / 117–250 ms | **16.7 / 16.8 / 16.8 ms** |
| Frames over 100 ms (20 hovers) | 80 (14 over 150 ms) | **0** |
| Station half powered after the pointer moves | 168–350 ms (median 197) | **20–34 ms (median 28): the same frame the hover registers** |
| Fully powered | 200–442 ms | **20–34 ms** |
| First paint after the pointer event (Event Timing) | 16–48 ms (the start of the cross-fade) | **≤ 16 ms** |
| First hover against repeated | First is worse: up to 350 ms, 250 ms frames | **No difference** |

"Registered" includes the probe's own latency in sending the pointer move (about 20–30 ms), the same in both modes. In the prototype, the station is powered on the frame its hover registers, in all 20 hovers.

### Switching: sweep over the five stations and back, 300 ms on each (10 visits)

| | Lite | **Static** |
|---|---|---|
| Frame rate / median frame | 8.3–9.4 fps / 117–133 ms | **60 fps / 16.7 ms** |
| Longest frame; frames over 100 / 150 ms | 150–267 ms; 24–25 / 1–5 | **16.8 ms; 0 / 0** |
| Visits in which the station lit (at least half) | **3 of 10, and 2 of 10** | **10 of 10, both rounds** (3–34 ms) |
| End state | Engineering lit, others dark (correct) | the same |

### Selection: click each station's title, then Escape

| | Lite | **Static** |
|---|---|---|
| Frame rate over 1.2 s | 6.9–9.6 fps | **57.8–60 fps** |
| Longest frame; frames over 150 ms (10 selections) | 133–300 ms; 7 | **17–50 ms; 0** (one 33–50 ms frame on the first selection) |
| Click to next paint (Event Timing) | 232–424 ms | **56–120 ms** |
| Escape: longest frame; frames over 150 ms | 133–300 ms; 7 | **16.8 ms; 0** |

### Project chips: each station's first chip, hovered then clicked

| | Lite | **Static** |
|---|---|---|
| Chip shown pressed, after the click | 141–365 ms | **26–52 ms** |
| Click to next paint (Event Timing) | 240–528 ms | **56–80 ms** |
| Frames over 1 s: rate; longest | 7.4–13.2 fps; 133–283 ms (7 over 150 ms) | **59–60 fps; 17–33 ms (0)** |
| Selected the right project | 10 / 10 | 10 / 10 |

The 56–80 ms to the next paint in the prototype is React updating the hero and labels on the main thread (dev build). Nothing in the scene has to be recomposited.

### Compositor workload (one traced run each, both rounds)

| Busy time of the compositing thread (viz) | Lite | **Static** | Ratio |
|---|---|---|---|
| One hover (1 s) | 826–893 ms (software quad drawing 782–851) | **17–19 ms** (10–11) | about 1/45 |
| Sweep (3.8 s) | 3461–3614 ms (3318–3447) | **103–111 ms** (76–80) | about 1/33 |
| One selection (1.6 s) | 1694–1704 ms (1622–1636) | **302–324 ms** (266–284) | about 1/5.5 |

In Lite the compositor is saturated throughout every interaction, so each frame waits for it. In the prototype it is mostly idle. A selection still redraws the full frame once, for the vignette, and that frame is now cheap.

### Initial load (cold browser cache, server warmed for both)

| | Lite | **Static** |
|---|---|---|
| Scene shown (Lite: its gate open; static: the plate loaded) | 3147–6903 ms | **508–528 ms** |
| Largest Contentful Paint | 2164–4824 ms | **500–712 ms** |
| DOMContentLoaded / load | 2121–4790 / 2756–6362 ms | **428–444 / 788–826 ms** |
| Scene requests / bytes | 59 / 4445 KB | **6 / 2578 KB** |
| Decoded scene images | 24 Mpx | **2.4 Mpx** |
| Main-thread work up to load (script; layout and style) | 871–981 ms (317–321; 181–223) | **432–508 ms** (144–189; 88–89) |

The dev server makes absolute load times slow and variable, and Lite's especially so. The request count, bytes and decoded pixels don't depend on the server.

## 3. Acceptance criteria

| Criterion | Result |
|---|---|
| No repeated 150–200 ms frames on station selection | **Met.** 0 frames over 150 ms in 10 selections and 10 Escapes; the longest frame is 50 ms (Lite: 7 and 7, up to 300 ms) |
| No visible freezing during switching | **Met.** 60 fps through the sweep, with the longest frame 16.8 ms; every visit lights its station (Lite: 8–9 fps, 2–3 of 10 visits lit) |
| Immediate project-chip response | **Met.** Pressed after 26–52 ms, next paint after 56–80 ms, with no slow frame (Lite: 141–365 ms and 240–528 ms) |
| No broken navigation or hit regions | **Met** (§4) |
| Substantially more responsive, not merely a few FPS | **Met.** Hover to powered is about 7× faster (median 28 against 197 ms); the compositor does 1/33–1/45 of the work; nothing visibly stalls |

## 4. Navigation and hit regions (`work/static-compare.mjs`, `results/static-compare.json`)

| Check | Lite | Static |
|---|---|---|
| Hit regions: what the pointer reaches on a 6 px grid over the stage (42,625 points), at rest and with Playground's bridge active | — | **42,621 of 42,625 identical.** The 4 that differ are on outline edges: the stage sits 0.01 px differently (layout centring, §5) |
| Each station's hover, by its title | 5/5 | 5/5 |
| Click a station, then a chip, then Escape | `?station=engineering` → `&project=sqlorbit` → home | the same, with `render=static` kept |
| Chips of all five stations | 5/5 pressed, with the right project | 5/5 |
| Keyboard: Tab from the top to Educational's title (it lights), Enter, Tab and Enter on AriMap, Escape | as expected | **identical** |
| Deep link `?station=engineering&project=sqlorbit` | selected, powered | selected, powered (sprite opacity 1) |
| Open project → SQLOrbit's page → Back to the lab | returns to `…&render=lite` | returns to `…&render=static` |
| Console errors | none | none |

## 5. Visual differences

The comparison sheets are `work/captures/static/compare/sheet-{rest,hover-engineering,selected-sqlorbit}.png`: Lite, static, and the difference ×4. Figures are in `results/static-compare-pixels.json`.

1. **At the scene's own scale (1672 × 941): identical.** Rest, powered and selected states differ by 0.
2. **At other window sizes: very slightly softer.**
   - At 1648 × 928 (scale 0.986), 42 % of pixels differ by more than 2/255 and 14 % by more than 8/255, up to 164 at high-contrast edges. The difference spreads evenly over the frame as an edge pattern; nothing is misplaced.
   - **Cause:** the stage sits at a fractional offset (−0.445 px here). Lite resamples about 60 layers and Chrome snaps each to the pixel grid; the prototype resamples one finished image at that offset, which costs some sharpness.
   - **Size of it:** edge energy, a proxy for sharpness, is 7.9 against Lite's 8.45 at 1648 × 928 (about 6 % less), and 8.0 against 8.9 at 390 × 844 (about 10 % less). Zoomed 2×, the two are hard to tell apart; small text such as the arcade marquee is marginally softer.
   - **Found and fixed while measuring:** centring the stage with `translate(-50%)`, as `LabScene` does, put the plate half a pixel off even at scale 1, because 941 / 2 = 470.5. The prototype centres the stage with `left`/`top` instead. Positions match Lite to 0.01 px at 1672 × 941, 1648 × 928 and 390 × 844, and scale 1 became identical.
3. **No fades.** A station switches on and off in one frame instead of Lite's 150 ms cross-fade. The vignette and the dimming of the other labels appear at once instead of over 850 and 500 ms. Title and chip colour changes are instant as well.
4. **Two stations powered at once** (one selected, another hovered): their sprites share 1,421 pixels, all near the hub where connection lines meet (Engineering and Educational 291 px, Educational and Playground 1,130 px). In those pixels the later sprite shows its own powered value, not the combination. This appears only in that combination. Checked in the final visual review (§8): not visible.
5. **Floor tone:** the plate is Lite's default, untoned floor. `?floor=approved` has no effect in the prototype.
6. **Playground's screen** shows Lite's still game frame, baked into its sprite. That is the same as Lite.

## 6. Technical tradeoffs

**What it gains:**
- **The work per state change is bounded by the sprite's box.** A change redraws at most two layers (plate and sprite) in 7–15 % of the frame, instead of dozens of full-frame blended layers. That is the floor that Lite could not get under (`lightweight-mode-prototype.md` §3).
- **Load:**
  - one image to decode instead of 24 Mpx of layers;
  - 6 requests instead of 59;
  - a quarter of the elements under `<main>`;
  - no gate waiting for every image.
- **Simplicity:** no station CSS, `@property` numbers or masks are involved in the scene. The interactive layer is the existing code.

**What it costs:**
1. **The images must be regenerated whenever the scene changes.** Any change to Lite's artwork, a station layer, the floor, positions or the powered look needs a new bake: `node work/static-bake.mjs` then `python work/static-bake.py`, about a minute. The sprite boxes in `LabSceneStatic.tsx` must then be updated from `results/static-bake.json`.
   - Nothing checks that the plate still matches Lite.
   - A product version would need the bake as a script with a check: capture Lite, compare it with the plate, and fail on a difference.
2. **Asset weight:** 2.6 MB of new lossless files in `public/`. That is already less than Lite downloads (4.4 MB), but lossy WebP would cut it by roughly 70 %, at the cost of exact pixels. Not evaluated.
3. **Resolution:** the plate is 1672 × 941, the resolution of nearly all of Lite's own layers. On large or high-density screens it is upscaled like they are. A sharper version would need a second, 2× capture.
4. **Fixed states only:** rest, plus "powered" per station. Any new state (a different look for selected, the floor tone, a second theme) needs its own captures. Motion of any kind can't be added without going back to live layers.
5. **Slightly softer off the native scale** (§5.2).
6. **The mode selector:** with `render=static` it shows Lite as selected. Choosing Cinematic leaves the prototype; there is no way back to it except the URL. The prototype has no place in the selector, by design.

## 7. Recommendation: **ADOPT** (as Lite's implementation, after an owner review)

The prototype meets every acceptance criterion with a wide margin. This is not a few FPS: interaction goes from a compositor saturated at 8–30 fps to an idle one at 60, and stations answer on the next frame. It reproduces Lite's look exactly at native scale and very closely elsewhere, and reuses Lite's interaction code unchanged.

**Before replacing Lite** (none of this was done here, as briefed):
1. **Your visual review** of the three differences that are visible in use:
   - the instant switching (no 150 ms cross-fade);
   - the instant vignette;
   - the slight softness off the native scale.

   Compare `/lab-v2?render=lite` and `/lab-v2?render=static` side by side.
2. **Decide the floor tone.** Lite is untoned. If the approved tone is wanted, bake a second plate and sprites.
3. **Make the bake part of the build:**
   - move `static-bake.{mjs,py}` to `scripts/`;
   - generate the sprite boxes instead of hard-coding them;
   - add a check that fails when Lite and the plate differ.
4. **Measure once on the RTX 4060 and with a production build.** The office figures are the worst case, and the ratios should hold. Check high-density screens for the plate's resolution (tradeoff 3).
5. Then point `render=lite` (the selector's Lite) at the static scene. Optionally keep the live Lite under another name until approval.

## 8. Final visual review

**Verdict: no visible difference prevents replacing Lite with Static Lite.** The remaining choices are the ones in §7.1–7.2 (instant switching, floor tone).

Captures of the unchanged prototype; no code, artwork or images were changed. Default Chrome, headless, dev server. Both modes were captured in each state, including at the scene's own scale (1672 × 941), where a difference can only be real, not resampling.

| File (`docs/performance/work/`, ignored by Git) | State |
|---|---|
| `static-rest-1648.png` | Static, 1648 × 928, at rest |
| `static-selected-hovered-1648.png` | Static, 1648 × 928, Engineering selected and Playground hovered |
| `static-central-a-closeup.png` | The central A and its connections at 2×, Static beside Lite: Engineering selected + Playground hovered, and Educational selected + Playground hovered |
| `static-rest-1366.png`, `lite-rest-1366.png` | Static and Lite, 1366 × 768, at rest |

Recreate them with `node work/static-review.mjs && python work/static-review.py`. The figures are in `work/results/static-review.json`; captures of every state in both modes are in `work/captures/static/review/`.

| Inspected | Finding |
|---|---|
| Station artwork and positions | Same as Lite. At 1672 × 941 the scene (everything except the labels) is identical. Positions match to 0.01 px at 1672 × 941, 1648 × 928 and 390 × 844 (§5.2) |
| Floor and architecture | Same. Differences at 1648 and 1366 are resampling only: an even edge pattern over the whole frame, nothing local |
| Central A | **Engineering selected + Playground hovered: identical** (largest difference 3/255, from the vignette drawn in a different layer). The A, ring, connections and floor light match in both close-ups |
| Lighting overlays (powered stations, vignette, dimmed labels) | Both stations powered and the room darkened around Engineering, as in Lite. Nothing missing or doubled |
| Text and project chips | Same text, chips and states. The label text sits about half a pixel lower in Lite, because its stage keeps a half-pixel transform (§5.2), so glyph edges differ. Both are equally crisp; not visible |
| Sharpness at 1366 × 768 | **Equal.** Edge energy 11.81 (static) against 11.71 (Lite); the arcade marquee and book spines are indistinguishable at 2×. The scene is scaled down here (0.82). At 1648 × 928 (0.986) the prototype remains slightly softer (§5.2): 10.08 against 10.61 with labels |
| Overlapping powered effects | See below |

**The 1,421 shared pixels.**
- **The requested state can't show it:** Engineering's and Playground's sprites share **no** pixels. The shared pixels belong to two other pairs: Educational with Playground (1,130 px) and Engineering with Educational (291 px).
- **The worst pair was checked too: Educational selected, Playground hovered.**
  - At native scale, 384 pixels differ by more than 8/255, in a band of about 100 × 12 px to the right of the A, just above Playground's connection.
  - There the prototype is darker by 9–14/255 on average (at most 30). Playground's sprite, drawn last, doesn't carry Educational's faint floor light (which adds only 5–8/255 on average).
  - **Not visible** at 1× or in the 2× close-up.
- The smaller Engineering–Educational overlap was not captured; by the same mechanism it would be fainter.
- **If it ever mattered:** a third sprite for that pair, or a different drawing order, would remove it. It doesn't justify a change now.

## Method and limits

- **Probes:**
  - `work/static-perf.mjs`: frames from `requestAnimationFrame`; powered state read from each station's unpowered overlays in Lite and from its sprite's opacity in the prototype; Event Timing for the next paint; CDP traces for compositor time; Performance metrics for load;
  - `work/static-compare.mjs` and `.py`: looks, hit regions and behaviour;
  - `work/static-bake.mjs` and `.py`: the images.
- **Headless Chrome, judged by numbers, not by eye.** Same GPU decision as headed Chrome (`animation-lag-diagnosis.md`). Hover is simulated pointer movement.
- **Dev server.** Load times are slow and noisy, especially Lite's; the request, byte and pixel counts are not affected.
- **One machine, two rounds per mode.** The differences are 5–45×, far outside run-to-run noise.
- **Not measured:** the RTX 4060, a production build, and high-density or phone screens (positions at 390 × 844 were checked, performance was not).

## Re-running

```bash
npx next dev -p 3002          # or BASE=http://localhost:<port> for a running server
cd docs/performance/work
node static-bake.mjs && python static-bake.py      # rebuild public/scene/static-lite/ from Lite (only after scene changes)
node static-compare.mjs && python static-compare.py
node static-perf.mjs 2                             # about 6 minutes
```
