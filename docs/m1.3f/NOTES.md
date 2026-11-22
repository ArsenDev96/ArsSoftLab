# M1.3F — Platform lighting system

Status: implemented and awaiting your visual review (not approved).

**Sequence:** idle (strips unpowered) → hover or focus → energy travels from the A → reaches the platform's connection point → strips light outward from that point → station activates. Leaving drains the strips back toward the connection point.

## Evidence (this folder)

| File | What |
|---|---|
| `idle.png` | All five platforms unpowered. The A, room and composition are unchanged. |
| `<station>-powered.png` (×5) | Each platform fully powered while hovered. |
| `geometry.png` | Annotated strip geometry. Per platform: the plate on the left, and on the right the M1.3A strip mask (cyan), what M1.3F dims at rest (magenta, by strength), the traced bands (yellow) and the arrival point (white dot). |
| `platform-power.webm` | Real time, 16.5 s, full lab at 1648×928. Educational, Playground, Creative, Experience and Engineering each power up and down. |
| `probes.txt` | Real-time probes; all pass. |
| `checks/` | `experience-mid-spread.png`: the front partway across. `idle-frozen-no-overlay.png`: the pre-M1.3F idle look. `overlay-difference.png`: where the overlay changes pixels. `reduced-motion-idle.png`. |

To regenerate: `npm run visual:power -- --url http://localhost:3000 --out docs/m1.3f`

## 1. Strip geometry

I couldn't use the annotated screenshot with red rectangles: it wasn't in the repo or the conversation. I traced every strip from 3–4× crops of the plate, guided by the per-station list in the brief. I also found segments by searching for warm, locally bright pixels that the M1.3A mask (`masks/platforms.png`) didn't cover.

The M1.3A mask already had the main strips. It didn't light or dim anything at rest, so every strip stayed painted-lit at idle.

| Station | Strips now in the power system | Not in the M1.3A mask before |
|---|---|---|
| Educational | Front strip (the line meets it mid-strip); left and right floor-ring segments | Tail of the left floor-ring segment |
| Engineering | Front strip; right-edge wrap at the lower tier's corner, where the line arrives; floor reflection | **Right-edge wrap**; floor reflection |
| Playground | Front strip, plus the bloom that covers most of the lower tier's face; right-edge segment; floor reflection along the base | Most of the bloom; floor reflection |
| Creative Studio | Long front strip and its **wrap up around the right edge**; short left strip behind the books; floor reflection | Upper part of the right-edge wrap; floor reflection |
| Experience | Long front strip on the base ring; left outer-ring arc; right strip with its **right-edge tip**; two floor reflections | Right-edge tip; part of the ring arc; floor reflections |

The connection lines are excluded; they have their own system. That includes the corner of Playground that its line lights.

## 2. Implementation

**Unpowered overlay** (`scripts/make-platform-power.mjs` → `public/scene/power/unpowered.png`, 135 KB)

- **Method:** inside hand-traced bands, each pixel is divided by the strip's light: `out = plate × (keep + (1 − keep) × unlit / lit)`, per channel.
  - `lit` is the plate lightly blurred (σ 1.5 px).
  - `unlit` estimates the stone or floor with the strip off, from pixels outside every band and off the lines. The fine estimate uses σ 7 px and hands over to a σ 22 px one where no source is in reach.
  - Dividing, rather than painting in an estimate, keeps the stone texture.
- **What stays at rest:** 14% of each strip's own light, so a faint fixture line remains, and 30% of floor reflections.
- **Feathering:** against the union of each station's bands (3.5 px), so a strip and its reflection have no seam.
- The plate and the reference image are never modified.

**Power front** (`components/lab/PlatformPower.tsx`, all CSS)

- **The front:** `--pw` (registered with `@property`) drives an elliptical mask (aspect 0.34, matching the platform perspective). It grows from the connection's arrival point with a 36 px soft edge and uncovers the plate's own lit strips.
- **M1.3A hover light:** the brighter light and the arrival flare are masked by the same front.
- **Timing:** delayed by the existing `--arrive-now`, so nothing lights before the energy arrives. Durations scale with each platform's reach, eased out:

| Station | Arrival | Spread (CSS) | Measured full | Drain |
|---|---|---|---|---|
| Educational | 460 ms | 292 ms | +266 ms | 248 ms |
| Engineering | 540 ms | 311 ms | +267 ms | 264 ms |
| Playground | 650 ms | 327 ms | +284 ms | 278 ms |
| Creative | 620 ms | 370 ms | +317 ms | 315 ms |
| Experience | 650 ms | 400 ms | +350 ms | 340 ms |

**Behaviour**

- **Power-down:** the front shrinks back to the arrival point immediately on leave. On Playground it finishes before the existing line drain starts (380 ms delay), so the strips drain first and then the line drains to the A.
- **Cancellation:** leaving before arrival cancels the pending transition natively (probe: the strips never light). Switching stations leaves no stale strips (probed).
- **Keyboard focus and selection:** behave like hover (probed). A selected station is powered at once.
- **Reduced motion:** no front and no travelling light. The overlay cross-fades out in 150 ms.

## 3. Coverage

Every strip, wrap and floor reflection I traced now dims at idle and lights from the connection point after the energy arrives. `geometry.png` shows each one, and `overlay-difference.png` shows that nothing outside the five strip boxes changes: at most 1/255 at a few layer-edge pixels.

## 4. Playground while lifted

- **Two copies:** the static overlay sits directly over the plate, under the station layer. While the station is lifted, its cut-out covers that copy, and the lift carries its own copy (`unpowered-lift.png`, the part on the silhouette).
- **Shared timing:** both copies run on the same CSS state, so they stay identical. The swap happens at identity transform, with nothing duplicated at the original height.
- **Decode gate:** the lift copy goes through the layer's decode-ready check, so the layer never shows before it has decoded.
- **What rides the lift:** the strips light on the rising platform, with the hover light masked by the same front.
- **Unchanged:** the 18 px lift (probe: −17.75 px = −18 × 0.986 scale), extraction, backdrop, contact shadow, gap light, arcade, connection, timing and camera.

Engineering uses the same mechanism.

## 5. Limitations

- **Annotated screenshot:** I didn't have it, so the geometry may differ from what you marked. Please compare against `geometry.png`.
- **Connection lines:** the other four stations' lines still look painted-lit at rest. Only Playground's line has an unpowered state (M1.3E). Next to the now-dark strips this is more noticeable. Adding that state for the other lines is outside M1.3F's scope.
- **Hover boost on new segments:** the brighter M1.3A hover light still uses the old mask. The newly covered segments (Engineering's wrap, Creative's upper wrap, Experience's right tip, the reflections) reach the plate's brightness on hover, but don't get the extra boost the main strips get.
- **Residual warmth:** some warmth remains at rest. Playground's lower face keeps the plate's general warm cast, Creative's right corner keeps some lit stone, and the floor reflections are kept at 30%.
- **Fixture colour:** the unpowered fixture line reads as a faint pale, neutral line. That's a judgement call; it can be darker or warmer.
- **Load order:** until `unpowered.png` loads, the strips show as the plate paints them (lit).
- **Front shape:** the front is an ellipse in screen space, not a path along each strip. On Creative, the short left strip behind the books lights last, after the front crosses the platform face.
