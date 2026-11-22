# M1.4D: layer-first scene integration (experimental, `/lab-v2`)

**Status:** an isolated experimental route, `/lab-v2`, assembles the new independent v2 assets. The approved homepage `/` is unchanged. **SA-1 is not approved.**

## 1. The assets (`public/scene/v2/`)

**All 12 are present:**
- environment;
- five stations;
- central A;
- five connections.

Nothing is missing and nothing was substituted.

**Format:** every file passes `PIL.verify()`. All are 1672 × 941 8-bit PNG with no ICC profile.

| Asset | Alpha | Solid object (alpha > 128) | Faint specks (alpha < 16, whole canvas) |
|---|---|---|---|
| `environment/lab-background.png` | RGB, opaque | | |
| `stations/engineering.png` | real alpha, clean matte | x 377–1279, y 200–763 | 24,515 px |
| `stations/educational.png` | real alpha | x 416–1251, y 170–766 | 51,236 px |
| `stations/playground.png` | real alpha | x 621–1438, y 188–772 | 11,138 px |
| `stations/creative-studio.png` | real alpha | x 81–682, y 485–878 | 9,745 px |
| `stations/experience.png` | real alpha | x 927–1645, y 456–872 | 13,644 px |
| `hub/central-a.png` | real alpha | x 415–1255, y 272–701 | 18,782 px |
| `connections/*.png` | no opaque pixels (max alpha 253–254) | see section 5 | 120k–188k soft-glow px each |

**The canvas sizes match, but the objects are not placed.**
- Each was generated on its own: centred or arbitrarily placed, and 1.5× to 2.7× larger than in the approved design.
- The specks are invisible in the scene: they are below alpha 16 and scaled down with their objects.

**The environment is the approved room without the stations or connections.** Same arches, windows, racks, lamps, globe and plants. **But:**
- the foreground props are gone: the book stack, the A mug and its table at bottom-left, and the plant at bottom-right;
- its floor carries no station reflections.

## 2. Assembly (`/lab-v2`)

**Fitting** (`scripts/v2-fit.py`, which writes `components/lab/scene-v2-data.ts` and `fit.json`):
- Each object gets **one uniform scale and a translation**. No warping and no repainting.
- Fitted so its base, the widest row in its lower half, has the approved base's width, with its bottom centre on the approved one.
- Approved bases come from the M1.3I remove masks. The central A was measured on the plate: x 640–1042, bottom 655.

| Object | Scale | Translation (scene px) |
|---|---|---|
| Educational | 0.379 | 517, 195 |
| Engineering | 0.374 | 122, 266 |
| Playground | 0.388 | 818, 247 |
| Central A | 0.478 | 442, 320 |
| Creative Studio | 0.677 | 40, 179 |
| Experience | 0.622 | 635, 233 |

**Rendering** (`components/lab/SceneV2.tsx`, through `LabScene variant="v2"` and `app/lab-v2/page.tsx`):
- **Back to front:** environment; one soft contact ellipse per base (`.lab-v2-shadow`); then the objects. Every layer uses the same 1672 × 941 frame.
- **Not indexed:** `robots: noindex, nofollow`. Nothing links to the route.

**Kept, unchanged:**
- camera, vignette and hotspots;
- HTML navigation, headings, station names and chips (nothing baked in);
- hero panels and `LabState`;
- deep links (`/lab-v2?station=…`) and keyboard focus;
- the energy timing (`EnergySurge`);
- Playground's existing hover lift: the same CSS on the same `.lab-lift[data-lift="playground"]` wrapper, 18 px and ×1.01, after the energy arrives;
- reduced motion;
- the arcade game: the same `ArcadeScreen`, aimed at the new cabinet's measured screen and riding the lift.

**Left out of `/lab-v2`.** These are rasters or masks of the approved plate and would paint its stations back over the new ones:
- environment corrections;
- platform strips (`PlatformPower`);
- `StationLayers` and reflections;
- `StationLights`;
- the activation glows;
- `GlobeOrbit`.

So on hover the v2 stations get no glow, strip or scan effects. Only the energy pulse along the line, the lift and the arcade run.

## 3. Checks

**Sheets:**
- `assembled-no-connections.png` (A);
- `approved-vs-v2.png` (B);
- `assembled-with-connections.png` (C);
- `playground-rest-vs-lifted.png` (D);
- `playground-lifted-no-shadow.png` (E);
- supporting: `work/edges-3x.png`, `work/captures/`, `work/offline-*.png`.

All browser captures share one viewport (1648 × 928) and the same camera rect, asserted equal for `/`, `/lab-v2` and the M1.3J build.

| Check | Finding |
|---|---|
| Positions and scale | Bases land on the approved footprints (`work/offline-outlines-on-approved.png`). Above the base, objects are bigger or taller than approved: the cabinet top is about 25 px higher, the Educational sphere a little larger, the easel taller. |
| **Central A** | **A different design.** The approved hub is a flat ring with a flat glowing A; the new one is a two-tier plinth with a tall 3D letter that stands in front of Educational's base. It dominates the centre. |
| Perspective | The front platforms are drawn at a flatter angle than approved: base depth/width 0.09–0.11 against about 0.18–0.19 for Creative Studio and Experience. Their tops read less, and they don't sit on the floor's perspective as the approved ones do. |
| Lighting | Consistent among the new objects (warm key light, orange base strips). The neon-purple Playground and blue Educational sphere match the room. |
| **Stone material** | **Different from approved.** All new bases are dark, warm, speckled stone; the approved bases are lighter grey blocks. Consistent among themselves. |
| Alpha fringes and halos | None visible at 1× or 3× (`work/edges-3x.png`) |
| **Floating** | **Yes, mildly.** The glossy floor shows no reflection of any station and no contact darkening, so the objects read as placed on top. The contact ellipses are weak and mostly hidden under the bases. With them off, nothing grounds the objects except their own rim glow. |
| Shadows | Simple placeholder contact ellipses, the only shadow layer. They aren't used to hide anything; every view is also captured without them. |
| **Baked glyphs** | **Engineering's asset has its own `</>` hologram**, next to the HTML `</>` icon (doubled). **The new cabinet has an "ArsSoftLab" marquee and a gamepad on its side.** Because the cabinet is taller, the HTML Playground icon now overlaps the marquee. |
| Connection endpoints | The retained accurate routes end at the approved bases, which the fitted bases match. |
| **Floor beneath Playground** | **Fully visible when lifted.** The environment has a complete floor under every station. |
| Arcade | Runs on hover (`data-state=running`, opacity 1), clipped to the new screen, and rides the lift |
| Behaviour | All equal to `/`: hover lift 17.75 desktop px and back to 0 on leave; keyboard 15 Tabs to Playground, Enter selects, URL `/lab-v2?station=playground`, Escape clears; deep link `/lab-v2?station=engineering` selected on load; reduced motion has no lift; no console errors |

## 4. Playground's lift

The gap is **genuinely open**:
- under the raised base is the environment's own floor, sharp at 3×, with its joints and reflections continuing;
- there are no black bands and no blur;
- it is the same with shadows off.

**This is better than M1.3J's gap,** which shows a soft, dark, synthesised band (`playground-lifted-no-shadow.png`, bottom row).

**But** the lifted station casts nothing onto that floor: no shadow worth the name and no reflection. It reads as hovering rather than rising off its seat.

## 5. Connections

**The generated PNGs are not connection geometry.** They are long decorative S-curves:
- they cross the floor and pass through the hub and other platforms;
- they end in floor rings away from the stations;
- Educational's is a vertical beam about 560 px tall through the hub.

Against the accurate routes (`fit.json`), the share of route points within 6 px of a generated core:

| Connection | Within 6 px |
|---|---|
| Engineering | 0% |
| Playground | 0% |
| Creative Studio | 27% |
| Experience | 99% |
| Educational | 100% |

**The two high figures are coincidences.** A long stroke happens to pass over a short route.

**The existing implementation is retained:**
- the M1.3I routes (`CONNECTION_LAYERS`) and the same charge windows and animation;
- drawn as vector strokes in `/lab-v2` only (`ChargeLines variant="v2"`), because the v2 floor has no line and the M1.3I rasters carry the approved plate's floor.

**At rest the v2 lines are fainter than the approved painted lines.** Their stroke colour is a single tunable constant (`V2_DIM`).

## Report

**1. Assets that fit correctly.**
- The environment, as a room.
- After placement, the bases of all five stations and the central A.
- Clean mattes on all six objects: no halos or fringes.
- Educational, Engineering and Experience read closest to the approved stations.

**2. Assets that need repositioning or regeneration.**

| Asset | What's needed |
|---|---|
| All six objects | Repositioning and scaling (done here by transform; the files themselves are unplaced) |
| Central A | Regeneration to the approved flat ring and A |
| Engineering | The baked `</>` glyph removed |
| Playground | The baked "ArsSoftLab" marquee and side gamepad removed, or the cabinet kept to approved height |
| Creative Studio, Experience | Regeneration at the approved camera angle |
| All bases | The approved grey stone, if material fidelity matters |
| Environment | The foreground books, mug, table and plant back; station reflections and contact darkening on the floor |
| Five connections | Not usable as geometry |

**3. Does the composition resemble the approved design?** Broadly, yes: same room, same five stations in the same places, same labels. It is clearly not the same picture:
- the central A dominates;
- the foreground props are gone;
- the stone is darker;
- the front platforms are flatter;
- the stations look pasted on the floor.

**4. Is the Playground gap genuinely open?** **Yes**, at 1× and 3×, with or without shadows. It is the first version whose gap shows real, sharp floor.

**5. Better or worse than the existing implementation?**
- **The lift is better:** a real open gap.
- **The scene as a whole is worse**, and not a like-for-like replacement:
  - it departs from the approved design (central A, props, stone, perspective, baked glyphs);
  - its stations lack grounding;
  - it loses every hover light effect that depends on the plate.

  These need new artwork and new effects built from the v2 layers.

## Validation

- `npm run typecheck`: pass (tsc exit 0, with `tsconfig.json` restored after `next dev` rewrote it).
- **Targeted browser checks:** `scripts/visual/m14d-capture.mjs` and the keyboard probe above.
- **No production build.** The route ran under `next dev` (`NEXT_DIST_DIR=.next-v2`, port 3002, since stopped).
- **Not run:** the full visual suite.
- **The homepage is unchanged.** `LabScene` and `ChargeLines` default to the existing path. A capture of `/` from the new code differs from the M1.4A capture of the default build only in ambient animation phases (orbit light, steam): mean 0.7 levels.

## Files

**New**
- `app/lab-v2/page.tsx`
- `components/lab/SceneV2.tsx`
- `components/lab/scene-v2-data.ts` (generated)
- `scripts/v2-fit.py`
- `scripts/m14d-sheets.py`
- `scripts/visual/m14d-capture.mjs`
- `docs/m1.4d/**`

**Changed (default behaviour unchanged)**
- `components/lab/LabScene.tsx`: optional `variant` prop, plus `LabSceneV2`.
- `components/lab/ChargeLine.tsx`: optional `variant` prop, plus vector content.

**Untouched**
- the v2 assets;
- `reference/`;
- the approved plate and every existing `public/` file.
