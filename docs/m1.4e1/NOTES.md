# M1.4E.1: Playground grounding and power connection (`/lab-v2`, experimental)

**Scope:** Playground in `/lab-v2` only. The homepage `/`, the other four stations, the M1.4E station assets and the 18 px lift itself are unchanged. **SA-1 is not approved.**

**No reference screenshot was attached to the request.** The approved homepage (captured at the same phases) and the M1.4E state served as the references.

## What was wrong (M1.4E, `work/before/`)

- **The line was weak.** It was a pale, near-white stroke that read as grey against the v2 floor's bright reflections.
- **The spark was faint.** It is seen through masks traced from the old plate's painted line, so it showed as a faint whitish glint.
- **The lifted station had no grounding.** Only the generic M1.4D placeholder ellipse sat under it, and nothing responded to the lift. So the line's end sat under an empty gap and looked disconnected.
- **The strip-light step was missing.** The v2 Playground's strips are baked lit, so `/lab-v2` had no moment where the strips light.

**The geometry was already right.** The accurate M1.3E route (`components/lab/playground-route.ts`):
- leaves the A's outer ring at (897.5, 563.4);
- crosses the platform top to its rim at (963.5, 570.2);
- runs across the floor to (1089.0, 537.8).

That end point is the v2 base's ground contact: the base's bottom edge at x 1089 is y 537. No route pixel lies on the station's stone (`work/playground.json`: `route_on_stone_px` 0). The route was kept unchanged.

## What changed

### 1. Shadow system (`components/lab/SceneV2.tsx`, `PlaygroundGround`)

**Shape:** both shadows are the base's measured footprint. The ground contour was fitted as an ellipse: centre (1217.5, 522.8), radii 157 × 23.7, mean error 0.32 px. No generic box-shadow.

**Driven by `--lp`:** the lift's existing progress variable, with the lift's own curve and arrival delay. It is held at 0 under reduced motion. Both shadows are on the floor and never move with the station.

| | Contact | Ambient |
|---|---|---|
| At rest | Thin dark rim just under the ground edge (opacity 0.9; almost all hidden by the base) | Off |
| During lift | Eases off (0.9 → 0.3) | Spreads (×0.96 → 1.08 wide, ×0.85 → 1.47 deep, 3 px forward) and darkens (0 → 0.9) |
| Full lift | 0.3 | Densest under the base, fading out past the old contact line |
| On return | Returns | Contracts back on the same variable |

**Measured at full lift:** floor luminance with the shadow divided by without (`work/gap-shadow-ratios.json`):

| Area | Ratio |
|---|---|
| Gap centre | 0.37 |
| Gap left end | 0.56 |
| Just in front of the old contact | 0.69 |
| Further out | 1.00 |

The floor's joints and reflections stay visible (`connection-3x.png`, last column). There are no black strips, rings, blur patches or duplicated edges.

**Removed:** Playground's M1.4D placeholder ellipse. The other stations keep theirs.

### 2. Connection

**Geometry:** the same accurate route, as above. It is floor-anchored (the lights layer). Its on-screen rectangle is identical at rest and at full lift (`line_fixed_while_lifting`: true). When the station rises, the line still ends at the station's original floor position.

**Appearance** (`components/lab/ChargeLine.tsx`, `PG_LINE`; vector, Playground in `/lab-v2` only):

| State | Core | Glow | Floor spill |
|---|---|---|---|
| At rest | Thin sharp warm amber, 1.15 px | Restrained, 3.6 px | none |
| Charged | Hot, 1.5 px | Warm, 4.2 px | A 2.6 px-blurred, 22%-opacity stroke 11 px wide: local light on the floor, no broad bloom |

**Spark** (`components/lab/EnergySurge.tsx`, `variant="v2"`):
- **Unchanged:** the existing spark, comet tail, charge front and landing burst, with their timing.
- **New masks:** Playground's spark is seen through masks drawn from the same route (`public/scene/v2/m14e1/playground-route-{core,glow,wide}.png`, made by `scripts/m14e1-playground.py`), with the station's stone cut out.
- So the spark runs exactly on the v2 line and can never light the stone face.
- The generated connection PNGs are not used.

### 3. Activation timing

**Power-up:** central A → spark travels → line charges behind it → strips light → Playground rises. Measured (`work/captures/checks.json`):

| Time | State |
|---|---|
| 0 | The A flashes as the spark leaves it |
| 293 ms | The spark is half way, at x 985 |
| 598 ms | The spark has reached the contact point (1088.9, 537.8). Lift 0, strips still unpowered, ambient shadow 0: nothing on the platform has started. |
| 650 ms | The energy's arrival: the strips light and the station starts to rise (at 760 ms: lift 3.2 px, strips 74% lit, shadow growing) |
| 1100 ms | Full lift |

**Strips:**
- `public/scene/v2/m14e1/playground-strip-off.png` is the station's own strips as unpowered housing: the strip pixels darkened to a dull warm beige and their light spill on the stone taken back.
- It is derived from the station asset in its own frame, so it rides the lift.
- It fades out only after the energy arrives, the same gate as the lift (`--arrive-now`).
- Coverage: 3 of 2,674 bright strip pixels are left at sub-pixel edges.

**On leave, in reverse:**
1. The station lowers.
2. The strips go dark (after a 160 ms delay; still lit half way down).
3. The charge drains back to the A (the existing drain).
4. The shadow contracts with the lift.

**Behaviour:**

| Check | Result |
|---|---|
| Interruption | Leaving at 300 ms (before arrival): at 800 ms and 2000 ms, lift 0, strips unpowered, no shadow; nothing switches on late |
| Keyboard | 15 Tabs to Playground. Focus powers and lifts it (strips lit, shadow 0.78); Enter selects it (`/lab-v2?station=playground`); Escape clears the selection, and the focused station stays powered, as on the homepage |
| Deep link | `/lab-v2?station=playground`: powered, lifted, grounded on load |
| Reduced motion | No lift, no shadow growth (`--lp` held at 0), strips lit at once |
| Console | No errors |

## Evidence (`docs/m1.4e1/`)

| File | Shows |
|---|---|
| `phases-desktop.png` | At normal desktop size (1×), the same camera for every capture. Rows: M1.4E.1 and the approved homepage. Columns: A at rest, B spark half way, C spark arriving, D fully lifted, E lifted with shadows off, F returning (half way down). |
| `connection-3x.png` | The connection at 3×: M1.4E (before), M1.4E.1 and the approved homepage; at rest, spark in flight, arriving, fully lifted |
| `grounding.png` | Full lift: M1.4E, M1.4E.1, M1.4E.1 with shadows off, approved; with the measured shadow ratios |
| `approved-vs-m14e-vs-m14e1.png` | The whole scene at full lift, side by side |
| `work/` | All captures and `checks.json`; the M1.4E captures (`before/`); the footprint, mask and strip data (`playground.json`); the strip check (`check-strip-off.png`) |

## Assessment

**Grounding:** Playground now reads as elevated above a real floor. At rest only a thin contact rim marks the ground edge. As it rises, a footprint-shaped shadow spreads under it and darkens the gap towards the platform, with the floor texture still visible. Without shadows (E) the same gap is the bare bright floor.

**Connection:** the line is a readable warm amber thread on the floor at rest. The spark is bright and travels on the line, with a charged trail behind it. It lands visibly at the base's original contact point, which stays fixed while the station rises.

**Against the approved homepage:**
- The sequence and timing are identical.
- The approved lift has a harder, darker band directly under the base (its painted under-gap); the v2 shadow is softer and wider.
- The approved line at rest is a painted line on a darker floor; the v2 line is a vector stroke on the brighter v2 floor.

**Remaining differences, outside this scope:**
- the v2 Playground asset itself: baked "ArsSoftLab" marquee, taller cabinet, darker stone (M1.4D);
- the v2 floor's brightness;
- the other four stations' lines and shadows, which are unchanged.

## Validation

- `npm run typecheck`: pass.
- **Targeted browser checks:** `scripts/visual/m14e1-capture.mjs` (phases, timing, interruption, keyboard, deep link, reduced motion, line fixed), plus a homepage probe.
- **The homepage is untouched:** `/` requests nothing from `/scene/v2/`, its spark uses the plate's masks, and it draws no v2 lines.
- **Not run:** full visual suite, production build.
- The `/lab-v2` captures used the `next dev --port 3002` server already running on this machine (not started by this milestone; left running). `tsconfig.json` is unchanged.

## Files

**New**
- `scripts/m14e1-playground.py`
- `scripts/m14e1-sheets.py`
- `scripts/visual/m14e1-capture.mjs`
- `public/scene/v2/m14e1/` (3 spark masks, the strip-off layer)
- `docs/m1.4e1/**`

**Changed (homepage defaults unchanged)**
- `components/lab/SceneV2.tsx`: Playground's ground, strip-off overlay and strip timing; its placeholder ellipse removed.
- `components/lab/ChargeLine.tsx`: Playground's v2 line style.
- `components/lab/EnergySurge.tsx`: optional `variant`; v2 masks for Playground.
- `components/lab/LabScene.tsx`: `/lab-v2` passes `variant="v2"` to `EnergySurge`.
