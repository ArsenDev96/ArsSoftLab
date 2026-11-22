# M1.4H.1: Engineering station activation (`/lab-v2`, experimental)

**Scope:** Engineering only, in `/lab-v2`. When the spark from the A reaches it, the workstation powers on: the strips light along their own paths, the laptop's display scans on, and the chart's bars rise one after another.

**Unchanged:**
- the homepage `/`;
- Playground: station, 18 px lift, arcade, grounding, connection and sequence;
- Educational, Creative Studio and Experience;
- the central A, the foreground and the room;
- connection routes and spark timing;
- M1.4G's floor (every pixel outside Engineering's share of it is byte-identical);
- M1.4F.1's files, which are read and never written.

No lifts, scroll work or new stations. **M1.4H.1 is not approved; it awaits owner review.**

## 1. What moves or changes

| Phase | After the energy arrives | What happens |
|---|---|---|
| Rest | | Strips unpowered. Display in standby (dimmed to about a third). Chart faint (28%). Engineering's floor ring and reflections at 20% |
| Spark approaching | before 0 | Only the connection and the spark (existing). Nothing on the station changes before arrival |
| A. Energy arrival | 0–340 ms | The strips light along the existing power fronts: the plinth's wrap at 6–77 ms, then the front strip right to left at 159–340 ms. A brighter pulse (the strips' own light) rides each front. Engineering's floor light (ring, spill, reflections, the strips' floor light) comes up under the same fronts (0–475 ms) |
| B. Laptop scan | 90–470 ms | A crisp line (1.4 px core, short wash above, 2 px lead) runs down the display in its perspective. Above it, the approved screen; below it, standby |
| C. Chart | 180–570 ms | The 11 bars rise in turn, left to right, 24 ms apart, 150 ms each. Each uncovers its own pixels from its base up, with a thin bright cap on the rising edge. The panel's glass comes up behind them (180–480 ms) |
| D. Stable | from about 580 ms | The approved Engineering, exactly (see §3). From 900 ms, a faint line runs up the chart's hologram pixels once every 5.2 s |
| Leaving | 0–400 ms | The scan line, the caps and the shimmer stop at once. The bars sink (120–320 ms), the display and chart return to standby (160–400 ms), and the strips drain toward the connection (their established timing) |

The timings are relative to the energy's arrival: 620 ms after hover, Engineering's existing `SURGE_ARRIVE_MS`.

**State:** all of it is CSS. Registered numbers transition from `--arrive-now` (`ACTIVATION_CSS`), the mechanism the strips already use. Leaving before the energy arrives therefore cancels natively, and switching quickly between stations can't leave anything lit. A selection or deep link is powered at once, with no replay. The only script places the display's perspective warp.

## 2. What uses the original artwork

Generator: `scripts/m14h1-engineering.py` (NumPy and Pillow; writes `public/scene/v2/m14h1/` and `components/lab/engineering-v2.ts` only).

| Layer | Source |
|---|---|
| Body, chart | M1.4F.1's station, split per pixel (a pixel goes whole to one layer), so together they are the station exactly |
| Chart glow, plant glow, strips' floor light | M1.4F.1's light layer, split. These are additive, so the split is exact |
| Unpowered strips | The approved plate with the strips darkened (M1.3K's line-free plate), at exactly the pixels where M1.4F.1 took the lit plate. Offline it matches that plate with max difference 0 |
| Strip pulse | The strips' own light (lit minus unpowered), through a narrow window riding the front |
| Bars on the display | A copy of the body's own opaque pixels in the bar rects, drawn above the standby dimming so they can rise with the chart |
| Floor share | M1.4G.1's floor light within x 232–632, y 505–670 (feathered 2 px). The remaining floor light is byte-identical |
| Stable state | M1.4F.1's `engineering.png` itself (see §3) |

**Drawn, not artwork:**
- the standby dimming (a flat dark tint, masked to the display);
- the scan line;
- the bars' caps;
- the shimmer line, masked to the chart's own pixels.

All of these are light or tint only: no text, icons or UI.

## 3. Perspective and geometry: how they were verified

**Display quad** (`work/geometry-6x.png`, the first row of `engineering-screen-closeup.png`):
- **Rims:** the lid's left and right rims are fitted as lines through the brightest column in each row (left RMS 0.31 px over y 396–468; right 1.97 px over y 393–448, perturbed by the bars). The top rim is fitted from the brightest row per column.
- **Display edges:** the display lies a measured bezel inside the rims: left 5.8 px, right 4.7 px, top 6 px (luminance profiles at y 395–465). Its bottom edge is at the hinge, y 473.5.
- **Result:** TL 346.8, 391; TR 473.6, 391; BR 486.7, 473.5; BL 358.9, 473.5. The sides converge, so the warp is a true projective one (`matrix3d`, square to quad).

**Scan line:**
- The line is a horizontal band in the warped box, so on screen it is the line across the display at that depth. It is clipped by the display mask (the quad grown 0.8 px into the bezel).
- **Confinement:** the same paused moment was captured with and without the line, at 2×:

  | Moment | Pixels changed | Outside the display mask |
  |---|---|---|
  | +200 ms | 5,630 | 4 |
  | +320 ms | 5,910 | 5 |
  | +440 ms | 1,282 | 0 |

  The few outside pixels sit on the mask's anti-aliased edge. The line never reaches the bezel, panel, stone, plant or floor.

**Bars:**
- Each bar's rect is the longest run of rows where its columns are cyan (mean blue above 150), with a 1 px margin. Overlaid at 6×.
- Bars 1–7 are painted on the display (x 438–495); bars 8–11 stand in the glass panel (x 497–534).

**Stable state equals the approved artwork:** Engineering was forced to its powered end state with the pointer away and compared with M1.4G.1's capture of the scene. Max difference 2/255, 0 pixels over 8.

Two refinements got there:
- **The masked chart drew sharp edges a little differently.** Masked layers resample sharp edges slightly differently from a plain image (up to 35/255 at bar edges). Once every bar has risen (+580 ms), the layers give way to M1.4F.1's station image itself, through a delayed `visibility` flip (pure CSS). Leaving flips back at once, so the bars can sink.
- **The strips' floor light was being darkened.** It is drawn with the station, above M1.4G's contact shadow, as it was in M1.4F.1.

**Confined to Engineering:** rest vs M1.4G.1, and powered vs rest, change 0 pixels (over 8) outside Engineering's box.

## 4. Timing relative to spark arrival

| Element | ms after arrival |
|---|---|
| Plinth wrap strip | 6–77 (existing front) |
| Front strip | 159–340 (existing front) |
| Strip pulse | rides each front |
| Floor ring and reflections | 0–110 (right), 107–475 (left, at the front strip's speed) |
| Laptop scan | starts 90, ends 470 |
| Chart bars | bar *k* at 180 + 24 *k*, 150 ms each: 180–570 |
| Chart glass | 180–480 |
| Stable | about 580 |
| Shimmer | 900, then every 5.2 s |

**Verified by seeking the page** (`work/captures/checks.json`):
- 220 ms before arrival: everything at 0.
- +45 ms: plinth wrap 0.55, pulse 0.9.
- +260 ms: scan 0.41, front strip 0.56, bars 1–4 rising.
- +380 ms: scan 0.89, bars up to 9 rising.
- +1400 ms: all 1, drawn as the station image.

## 5. Visible at normal desktop size?

Yes. Mean luminance at 1× (1648 × 928), rest vs powered:

| Area | Rest | Powered | Ratio |
|---|---|---|---|
| Display | 17.7 | 40.0 | 2.3× |
| Front strip | 65.7 | 160.2 | 2.4× |
| Chart panel | 62.9 | 89.2 | 1.4× |
| Floor under the strip | 52.6 | 73.5 | 1.4× |

The scan line at 1× is a row of mean luminance 216 against 11 three rows below it.

## 6. Remaining visual defects and choices to review

- **The rest state is new.** Until now `/lab-v2` showed Engineering always lit. At rest the display is now in standby, the chart faint and its floor ring at 20%, so that it has something to power on from. These levels are constants: `SCREEN_STANDBY`, `CHART_STANDBY` and `FLOOR_STANDBY` in `components/lab/EngineeringV2.tsx`.
- **The stone stays warm at rest.** The unpowered strips are the approved darkened plate's, which keeps some warm light on the stone around them. Unchanged artwork.
- **The strip pulse is subtle at 1×.** The front itself is what reads; the pulse adds a brighter head, clearer at 2–3× and in the recording.
- **Bar caps** are thin drawn light lines, about 1 px at 1×, visible only while a bar rises. They can be removed if they read as graphics.
- **During the chart's rise**, the glass layer leaves a faint seam (up to about 18% at a rect's anti-aliased edge) around bars not yet risen. It shows only while moving, and is gone in the stable state.
- **Leaving in the middle of the scan:** the part of the display below the line cross-fades back to standby with the rest, dipping briefly (about 0.54 instead of 0.68 dimming) during the 240 ms fade.
- **The floor fronts** follow the strips' fronts to within about 20 ms. The ring's right curve lights from its outer end over 0–110 ms.
- **The webm** is a real-time screencast; its frame pacing is Chrome's.

## 7. Targeted verification

Scripts: `scripts/visual/m14h1-capture.mjs` (add `--webm` for the recording) and `scripts/m14h1-sheets.py`. Results are in `work/captures/checks.json` and `work/measurements.json`.

| Check | Result |
|---|---|
| Before arrival | Nothing on the station moves (all values 0 at 220 ms before arrival) |
| Leaving before arrival | Hover Engineering, switch to Playground at 300 ms: all values stay 0 |
| Leaving mid-sequence | Switch to Educational at +260 ms: back at rest within 1.5 s (all values 0, standby 0.68) |
| Fast sweep | Three passes across all five stations ending on Engineering: it powers normally, then returns fully to rest |
| Quick return while draining | Powers again and settles; back at rest after leaving |
| Keyboard | Tab 12 reaches Engineering, and it powers (stable). Enter selects (`?station=engineering`). Escape returns (`/lab-v2`, still focused, powered). Blur returns it to rest |
| Click while charging | Selected and powered (`?station=engineering`) |
| Deep link | `/lab-v2?station=engineering`: powered on load, drawn as the station image, no replay |
| Reduced motion | No scan, rising bars, pulse, caps, fronts or shimmer. A 150 ms cross-fade into the powered appearance (half-way at 70 ms), then the station image. Leaving fades back |
| Playground | Pixel-identical to M1.4G.1's captures at rest and lifted, 1× and 3× (max 1). Lift −18 px, strips and ring unchanged |
| Homepage | 0 requests for `/scene/v2/` or `m14h1`; no Engineering v2 layer |
| Console | No errors in any run |
| Validation | `npm run typecheck`: pass. Not run: full visual suite, production build |

## Deliverables

| File | Shows |
|---|---|
| `engineering-phases.png` | Rest, spark approaching, energy arrival, laptop scan, chart activation, stable, returning, back at rest (3×) |
| `engineering-screen-closeup.png` | The measured quad, then the display at 4× from standby through the scan to stable |
| `engineering-chart-closeup.png` | The chart at 4× from faint through the bars' rise to stable |
| `engineering-activation.webm` | Real time, 2×: hover, spark, strips, scan, chart, stable; leave and drain; a second activation |
| `full-scene-powered.png` | The whole scene, Engineering hovered and stable |

## Files

**New**
- `components/lab/EngineeringV2.tsx`: layers and CSS.
- `components/lab/EngineeringScreen.tsx`: the display's perspective layers (client).
- `components/lab/engineering-v2.ts`: generated geometry.
- `scripts/m14h1-engineering.py`
- `scripts/m14h1-sheets.py`
- `scripts/visual/m14h1-capture.mjs`
- `public/scene/v2/m14h1/*.png`
- `docs/m1.4h1/**`

**Changed**
- `components/lab/SceneV2.tsx`: Engineering's branch and its floor share; the floor light now comes from `m14h1/floor-light.png`.
- `components/lab/PlatformPower.tsx`: `powerCss(id)` extracted. `POWER_CSS` is built from it and is the same string as before.

Captures used the dev server on port 3002, which I started for this milestone (nothing was listening on 3002 or 3003).
