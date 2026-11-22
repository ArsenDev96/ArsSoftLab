# M1.3G — Complete five-station power connections

Status: implemented and awaiting your review (not approved).

All five connections now share Playground's system. At rest the connection is unpowered and nothing moves. On hover, a spark leaves the central A and the line charges behind it along the painted route, fully powered as the spark arrives. The platform strips then light outward (M1.3F.1) and the station's own animation starts. On leave the platform drains first, then the line retracts to the A.

## Evidence (this folder; real-browser screenshots at 1648×928)

| File | What |
|---|---|
| `idle.png` | Full laboratory at rest. |
| `closeup-<station>.png` (×5) | Each connection at rest (top) and fully powered (bottom), 2×. |
| `<station>-powered.png` (×5) | Full laboratory with that station powered. |
| `connections.webm` | Real time, 18 s. Educational, Engineering, Creative, Experience and Playground charge and drain in turn. |
| `checks/experience-mid-charge.png` | Experience's line part-charged behind the spark; the platform is still unpowered. |
| `probes.txt` | Real-time probes; all pass. |

To regenerate: `npm run visual:connections -- --url http://localhost:3000 --out docs/m1.3g`

## 1. Connection segments added or corrected

Each route is traced from the plate (`scripts/make-charge-lines.mjs`):

1. Start from a guide curve.
2. Find the line's brightness-weighted centre across it, every pixel along it.
3. Smooth and sample.

| Station | Route (A → station) | What changed |
|---|---|---|
| Educational | Straight up from just below the A's outer circle, over the floor and up the platform face to the front strip; 72 px, 1 part. | Starts below the circle so the circle stays lit. Now reaches the strip junction. |
| Engineering | Along the central platform's rim from the A's outer circle, over the rim step, then across the floor to the platform's right corner; 200 px, 2 parts. | **Added the rim stroke.** It's faint, the mirror of Playground's approved central-platform segment. The old mask started at the rim. |
| Creative Studio | From the central platform's base, curving across the floor; 226 px, 3 parts. | **Follows the real curve.** It bows about 8 px off a straight chord, so it's split into 3 near-straight parts. The start moved to where the painted line begins. |
| Experience | Same, on the other side; 258 px, 3 parts. | Same as Creative. The start is extended about 3 px to the painted start. |
| Playground | Unchanged (M1.3E.2 route and assets). | — |

**Hidden starts:** Creative's and Experience's lines emerge from under the central platform's base. There's no painted stroke on its side wall, so their routes start at the base. The spark's lead-in, inside the A area where the masks are empty, makes the energy appear at the base.

## 2. Idle reconstruction

Each line's light is subtracted from the plate, using the same model as M1.3F.1's platform strips:

- **Unlit estimate:** the surface without the line is estimated from pixels well clear of every line and every platform strip.
- **Near the line** (within about 3–6 px): each pixel's own excess light is removed, leaving 18% of the line's core. The result is a faint, sharp, neutral line, like the unlit platform fixtures.
- **Further out:** a smooth light field is subtracted, so the floor's texture contrast stays.
- **Edge taper:** the effect fades gradually toward the band edge (±14 px), with no rectangular seam and no dark trench.
- **Pixels:** every changed pixel is written opaque with its final colour, so nothing is resampled or blurred.
- **Platform junctions:** where a platform's strips meet a line, the platform overlay handles the strip and the line overlay only draws the line's core. The M1.3F.1 exclusion that had left lit stubs there is removed.
- **Assets:** cropped to each route (39 files, 128 KB in total), so no extra full-frame images are added.
- **Unchanged:** the reference artwork, `lab-plate.webp` and the central A.

## 3. Synchronization

- **One data structure:** `CHARGE_LINES` in `scene-fx.ts` now holds all five lines, built by one `chargeLine()` from a route and its part starts. `ChargeLine.tsx` (unpowered and powered windows per part) and `EnergySurge.tsx` (spark, tail, charge front, arrival burst, drain) drive every line the same way. No component is station-specific. The burst's tilt is per line.
- **Arrival times follow route length:**

| Station | Arrival |
|---|---|
| Educational | 460 ms |
| Engineering | 620 ms (was 540; the route is now longer) |
| Playground | 650 ms (unchanged) |
| Creative | 640 ms |
| Experience | 660 ms |

- **What keys off arrival:** everything waits for that station's arrival time: the platform strips, the lift, glows and the arcade.
- **Measured (`probes.txt`):**
  - Each line starts charging at 115–176 ms and is about half-charged midway.
  - It's fully powered 45–60 ms before arrival, when the spark lands.
  - The platform's first strip lights 4–34 ms after arrival.
  - On leave, the platform drains within about 250–330 ms and the line by about 850–950 ms.

## 4. Do all five fully charge?

Yes. Every line reaches full power on hover, keyboard focus and selection.

Also confirmed:

- **Rest:** all five are unpowered at rest.
- **One station at a time:** only the active station is ever powered, including during rapid switching.
- **Interruptions:** leaving before arrival drains the line and never powers the platform. Repeated quick hovers end clean.
- **Click and Escape:** clicking while charging selects and powers the station. Escape and leaving return everything to rest.
- **Direct URL:** `?station=experience` powers only Experience's line.
- **Reduced motion:** no spark and no lift; the line cross-fades.
- **First frame:** the plate and lights layers appear only once the plate and every unpowered strip and line have decoded. Test: with the overlay delayed 1.5 s, the scene appeared at 1624 ms with the overlay ready. Normally that's when the plate itself has loaded.

## 5. Remaining visual artifacts

- **Two unpowered styles:** Playground's line (M1.3E.2, approved, left untouched) keeps a warmer, slightly brighter trace at rest than the four new lines. Regenerating it with the new method would make all five identical.
- **Olive tint:** at 4× zoom, the floor right beside Creative's and Experience's starts has a faint olive cast where a strong orange bloom was removed (the estimated floor there is olive-brown). It isn't visible at normal size.
- **Educational junction:** a ~3 px faint fixture tip remains where the line's core meets the strip.
- **Engineering's rim stroke:** it sits on the rim's own bright highlight, so at rest it changes very little. It's there mainly so the spark travels the full route from the A.
- **Unused old assets:** M1.3C's `masks/connections*.png` and the straight-chord spark passes are no longer used by any station. The code paths remain but are unused.

## 6. Results

- `npm run typecheck`: pass.
- `npm run build`: pass (Next.js 16.4.6).
- Connection probes: all pass (19).

## 7. Recommendation for the next hover-animation milestone

**M1.3H — station activation pass:** give each station's own response the same care the power path now has.

- Arrival bursts tuned per surface.
- Educational: the globe's orbit and dome waking from the junction.
- Creative: a canvas reveal that follows its painted light.
- Experience: the path highlight starting exactly where its connection arrives.
- Optionally regenerate Playground's unpowered line with the M1.3G method so all five rest states match.
