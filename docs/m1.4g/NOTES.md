# M1.4G: Floor lighting, reflections and grounding (`/lab-v2`, experimental)

**Scope:** the floor around the five stations in `/lab-v2`: rings, reflections, contact shadows, and an optional floor tone.

**Unchanged:**
- the homepage `/`;
- the station artwork (the four recovered stations' own pixels: 1 px over 16 out of 210,521);
- Playground's station, lift, connection and height-responsive shadows (M1.4E.1–M1.4E.3);
- the central A and the foreground;
- connection geometry, endpoints, charge timing and spark;
- labels, chips, keyboard and deep links.

No new decorative elements, lifts or scroll work. **M1.4G is not approved; it awaits owner review.**

## 1. Baseline (1648 × 928, same camera)

Compared: `reference/approved-lab-design.png`, the approved homepage, and `/lab-v2` after M1.4F.1.

**Rings in the approved artwork:** every base stands on a thin metal floor ring, slightly larger than its footprint. Where the strips light them, the rings are amber.
- **Engineering:** a lip just in front of the base, curving round its right end to x 615.
- **Educational:** short arcs at both ends.
- **Playground:** the edge of a flat, slightly lighter disc, about 14 px beyond the base.
- **Creative Studio:** the ring's right half (the books and mug hide the rest).
- **Experience:** an inner lip and a lit amber disc at the base's left end, plus a larger outer ring in front.

`/lab-v2` had none of these.

**Reflections:** the approved floor shows warm, vertically streaked reflections under the strips. `/lab-v2` had only the strips' own approved floor light from M1.4F/M1.4F.1, close to each base.

**Grounding:** each recovered station carries its approved dark bottom edge. M1.4D's generic contact ellipses were sized from the old fit; Educational's lay entirely under its stone.

**Floor:** the v2 floor is brighter, cooler and glossier than the approved one:

| Open floor (stations excluded) | Luminance | Median | Warmth (R − B) |
|---|---|---|---|
| Approved | 67.3 | 55.0 | 15.6 |
| `/lab-v2`, before | 78.0 | 67.1 | 0.1 |

## 2. What was built

**Generator:** `scripts/m14g-floor.py`. It is deterministic, uses NumPy and Pillow only, and writes to `public/scene/v2/m14g/` only.

**Wiring:** `components/lab/SceneV2.tsx`. All the new layers lie on the floor, under every station, so each station hides its own ring and reflection as in the approved artwork.

### Rings (`floor-light.png`, plus-lighter)
- **Geometry:** each ring is an ellipse matching the approved one.
  - **Engineering, Educational, Creative:** fitted by following the line-free plate's ridge (local brightness above a 9 × 9 mean) along the normals of a starting ellipse, then fitting a conic.
  - **Experience's two rings and Playground's disc edge:** only short arcs are visible, so these are least-squares ellipses through points measured on the ridge map at 3–4×. The inner Experience lip and Playground's ring have their centre held on the base's centre. The outer Experience ring is a general (tilted) conic.
  - **Check:** every fit was overlaid on the ridge map at 3×.
- **Extraction:** within ±3 px of the ring, plus the plinth disc inside it up to the base (14 px; 48 px for Experience's wide lit disc), the ring's light is its brightness above the plate floor. That floor is diffused in from just outside the ring, so no plate floor or texture is carried, only the ring.
  - **Visible parts only:** stations, hub and foreground are excluded.
  - **Source:** the lit plate, except within 7 px of any connection, which comes from the line-free plate.
  - **Colour:** kept at its extracted brightness in the lips' own measured amber (R : G : B ≈ 1 : 0.69 : 0.46). The raw difference against the warm plate floor came out cool.
- **Playground's ring is drawn, not extracted:** the v2 Playground isn't the plate's station, so the plate's base and lit strip ends lie inside the band. Its ring is a thin crisp core (0.75 px) with a short glow (2.2 px) on the measured disc edge, in the same amber and at about the extracted rings' strength. It is drawn whole and floor-anchored, so the station hides its back arc at rest. When the station rises, the side gaps reveal it.
- **Strip spill:** the strips' approved light beyond the M1.4F/M1.4F.1 light boxes (lit plate minus line-free plate, within 45 px of a recovered base). Connections, the hub and Playground are excluded, because Playground's strips are off at rest.
- **No light counted twice:** everything already in the stations' own `-light` layers is subtracted.

### Reflections
- **Static stations (`floor-light.png`):**
  - Each station's bright parts (strips, screens, holograms, neon; weighted by luminance) are mirrored about its own bottom edge, column by column: a point h px above the floor appears h px below it.
  - They are then blurred into a soft streak (3-pass box blur; σ about 7.5 px vertically and 2.4 px sideways, so a straight strip never becomes a rectangle) and faded over 46 px.
  - They're broken into vertical streaks, as on the approved polished floor (a fixed-seed column modulation), and by the v2 floor's own grain (its luminance over a local mean), which keeps the texture visible.
  - Only what goes beyond the light the stations already carry is kept, so nothing is doubled.
- **Playground (`playground-reflection.png`, `playground-reflection-lit.png`):**
  - **At rest:** the reflection is of the v2 station with its unpowered strips.
  - **Powered:** the `-lit` layer adds the strips' extra light. It comes up with the strips when the energy arrives and goes with them, on the same timing.
  - **Lift:** the group sits on the lift's own progress `--lp`. It drops by the lift (18 px at full lift) and fades to 0.7, because the station is further from the floor.
  - **Stacking:** it lies under Playground's height-responsive shadows.

### Contact shadows (`contact.png`)
- **Shape:** a restrained shadow along each recovered station's own bottom edge, taken from its alpha:
  - 0.46 alpha at the edge, gone within about 10 px;
  - below the edge only;
  - no strip, no foundation step.
- **Replaces:** M1.4D's four generic ellipses.
- **Playground:** keeps its M1.4E.1 height-responsive contact and ambient shadows, unchanged. No defect was found: through the lift they read as before, and with them disabled the lifted gap simply loses its soft darkening.

### Floor tone (optional: `/lab-v2?floor=approved`)
- **What it does:** one uniform multiply, `rgb(236 222 212)` (about −13% luminance, warmer), limited to the v2 floor by a feathered mask (`floor-mask.png`).
- **What it leaves alone:** architecture, windows, mountains, the left plant and the right-hand furniture.
- **Character:** a single global factor, so there are no local patches and the floor's grain is kept (it scales).
- **Default:** off until reviewed. The flag survives the lab's own URL updates (`?station=…` is added alongside it).

| Open floor | Luminance | Median | Warmth (R − B) |
|---|---|---|---|
| After (default) | 80.2 | 69.4 | 1.0 |
| After, with the tone | 71.7 | 61.6 | 8.4 |
| Approved | 67.3 | 55.0 | 15.6 |

A full match would need a much stronger, browner tint, so this goes about halfway on purpose.

## 3. Evidence

| File | Shows |
|---|---|
| `full-scene-before-after.png` | Approved design, before (M1.4F.1), after (default), after with the tone |
| `floor-engineering.png`, `floor-educational.png`, `floor-playground.png`, `floor-creative.png`, `floor-experience.png` | Each station's floor: approved, before, after, after with the tone, at 1×; before and after at 3× |
| `playground-lift.png` | Playground at rest, three steps of the lift, fully lifted before and after M1.4G, fully lifted with its shadows disabled, and reduced motion (hovered, no lift) |
| `reflections-1x-3x.png` | All five stations' reflections and rings after M1.4G, at 1× and 3× |

The 3× "before" captures are the live page with the M1.4G layers hidden. M1.4D's generic ellipses, which M1.4G replaces, are therefore absent there; they were almost invisible.

**Coherent through the lift.** Captured by seeking the lift:

| Step | Station lift | Reflection drop | Reflection opacity | Strip reflection (`-lit`) |
|---|---|---|---|---|
| At rest | 0 | 0 | 1.0 | 0 |
| 3.27 px | −3.27 | 3.27 | 0.945 | 0.74 |
| 11.45 px | −11.45 | 11.45 | 0.809 | 0.99 |
| 17.2 px | −17.2 | 17.2 | 0.713 | 1 |
| Full | −18 | 18 | 0.70 | 1 |

The ring stays fixed to the floor. Under reduced motion there's no lift and no drop.

## 4. Checks

Scripts: `scripts/visual/m14g-capture.mjs` and `scripts/m14g-sheets.py`. Results are in `work/captures/checks.json` and `work/measurements.json`.

| Check | Result |
|---|---|
| Layers | `floor-light`, `contact`, `playground-reflection(-lit)` load at 1672 × 941. The light layers use `plus-lighter`; the tone uses `multiply` with its mask |
| Station artwork | Unchanged: the four recovered stations' opaque pixels, after vs the M1.4G layers hidden, differ by 1 px over 16 out of 210,521 (max 18, at an edge) |
| Connections | Geometry, endpoints and timing unchanged (no code change). The floor light within 2.5 px of each route is 0 for Creative and Experience and ≤ 7/255 for Engineering and Educational. For Playground it is ≤ 19/255 on 18 px, at the edge of its line, which runs a little off the measured route |
| Playground | Lifts 18 px on hover, keyboard (Tab 15) and deep link (`?station=playground`). The reflection follows (table above). Reduced motion: no lift, no drop |
| Homepage | Unchanged: within the globe orbit's run-to-run noise of M1.4F.1's captures (38 px over 16 against the first, 362 against the second; two captures today differ by 288). 0 requests for `/scene/v2/` or `/m14g/` |
| Console | No errors |
| Validation | `npm run typecheck`: pass. Not run: full visual suite, production build |

## 5. Performance

- **Added assets:** five PNGs, about 207 KB in all:

  | File | Size |
  |---|---|
  | `floor-light.png` | 144 KB |
  | `playground-reflection.png` | 30 KB |
  | `playground-reflection-lit.png` | 13 KB |
  | `contact.png` | 10 KB |
  | `floor-mask.png` | 9 KB (loaded only with the tone) |

- **Compositing:** two more full-frame `plus-lighter` blends (the floor light, and Playground's reflection group) and one normal full-frame layer. With the tone, one more masked `multiply` layer.
- **Frame time during Playground's lift**, two runs each:

  | Run | Median | 95th percentile |
  |---|---|---|
  | With the layers | 16.7 ms | 17 ms |
  | Without the layers | 16.7 ms | 16.9–17 ms |

  There is no measurable cost.
- **First-load stall:** an earlier sample had one 817 ms stall on first load. It didn't repeat and appeared without the layers too (166–216 ms maxima in every run), so it's a dev-server or first-load effect, not the layers.

## 6. Remaining differences and defects

- **The v2 floor itself:** it keeps its own bright blue window reflections and tile pattern. The approved floor's broad hub circles and seams aren't added (no floor reconstruction). The optional tone narrows the brightness and warmth gap but doesn't close it.
- **Subtle at 1×:** Educational's and Playground's rings are faint, as the approved ones are at the base ends. Engineering's ring and the station reflections are modest next to the v2 floor's own lamp reflections.
- **Experience's lit disc** reads paler than the approved amber, because it's added light on a cooler floor. With the tone it is closer.
- **Playground's ring is drawn**, not the approved pixels: the v2 station isn't the plate's. It also has no lit strip segment on the ring when powered; its strip light shows through the reflection only.
- **The tone** is a single factor: it also dims the v2 floor's own warm lamp reflections, proportionally.

## Files

**New**
- `scripts/m14g-floor.py`
- `scripts/m14g-sheets.py`
- `scripts/visual/m14g-capture.mjs`
- `public/scene/v2/m14g/*.png`
- `docs/m1.4g/**`

**Changed**
- `components/lab/SceneV2.tsx`: the floor layers, Playground's reflection, the optional tone; M1.4D's generic ellipses removed.
- `components/lab/LabScene.tsx`, `app/lab-v2/page.tsx`: pass the optional `?floor=approved` flag. The homepage path is unchanged.

Captures used the dev server on port 3003. The earlier 3002 server had stopped.
