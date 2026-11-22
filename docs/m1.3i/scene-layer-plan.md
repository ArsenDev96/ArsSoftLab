# M1.3I scene layer plan

How the approved lab is split into independently composited 2.5D layers. The approved artwork (`reference/approved-lab-design.png`) stays the source of truth. Nothing here redesigns the room: every layer is cut from, solved against, or drawn to match that image.

**Status:** the architecture is in place behind a flag. **Playground** is the only working movable prototype. The other four stations have layer definitions and placeholders; their approved visuals and animations are untouched.

## Switching

| Build | How | What it shows |
|---|---|---|
| Default | `npm run build` | The approved implementation, unchanged. It references no M1.3I asset. |
| Experimental | `npm run build:layered` (sets `NEXT_PUBLIC_LAB_LAYERED=on`, builds into `.next-layered/`), then `NEXT_DIST_DIR=.next-layered npx next start -p 3001` | The layered scene. |

M1.3H's `NEXT_PUBLIC_PLAYGROUND_LAYERED=on` selects the same experimental build.

The flag is read at build time, so there is no runtime switch to cause a flash or hydration mismatch.

## Layer stack

Back to front. "Moves" means it rides a station's lift.

| | Layer | Contents | Moves | Implementation |
|---|---|---|---|---|
| A | **Environment** | Architecture, windows, mountains, walls, floor, ambient light. | No | Today: `lab-plate.webp` plus `environment-corrections.png`, which removes all five connection lines and Playground's strip reflection. The stations are still in the plate (see below). |
| B | **Foundation** | A restrained floor joint where the platform stands, a few px inside the contact line. Hidden at rest, visible in the lift gap. | No | SVG path (`Foundation`, `StationLayers.tsx`) |
| G | **Floor reflection** | The platform strips' reflection on the glossy floor, unpowered and powered. | Follows the lift: drops half the lift and fades 35% at full height | `StationReflections` (`SceneDepth.tsx`) |
| F | **Contact shadow** | Contact (tight) and ambient (wide, light) shadows. Graded by depth, no flat or dark rectangles. | No; their opacity follows height | `lab-depth` layers (`StationLayers.tsx`) |
| D | **Station object** | Platform and objects, transparent, re-matted over the clean background. | Yes | `playground-v2.png` in `.lab-lift` |
| E | **Platform lighting** | The strips, unpowered and powered, lit along their paths (M1.3F.1). | Yes | `PowerPart` in the lift (unchanged) |
| C | **Power connection** | Trace, lit line, glow, vector core and spark, with charge and drain. | No (grounded) | `ChargeLines` (`ChargeLine.tsx`) and `EnergySurge` (unchanged). See [`power-connections.md`](power-connections.md). |
| H | **Interface** | Label and project chips (HTML); arcade game (canvas). | Yes (same transform) | Unchanged |

### Notes

- **Shadow and floor layers live in the plate layer.** The environment corrections, foundation, shadows and reflection sit in the plate `SceneLayer`. The station group sits above them in the same layer, and the connections in the lights layer above that, as in the approved build. Playground's line only touches its platform at the corner where it arrives, so drawing it above the station is correct there and stays correct while lifted.
- **One lift progress drives the floor layers.** A single variable, `--lp` (0 at rest, 1 lifted), runs on the lift's own curve and timing (450 ms `--ease-heavy` up, 420 ms back). It drives:
  - the contact shadow's opacity: `min(1, 2.5·lp) · (1 − 0.45·lp)`, strongest early and easing to 0.55 at full height;
  - the ambient shadow: `lp`;
  - the reflection's drop and fade.

  Reduced motion pins `--lp` at 0.
- **Visibility.** As in the approved build, the station group (background, foundation, shadows, object) is shown only from the energy's arrival. Idle is therefore the plate, and the environment corrections and connection layers are solved to reproduce it.

## Coordinate system and rules

1. **Coordinates.** Everything is authored in the reference's 1672 × 941 pixel space (`--u`), so no layer has its own coordinates.
2. **Pixel alignment.** A static raster that must land on the plate's own pixels is a full-frame image at the plate's rect, or a clip box holding one, because Chrome pixel-snaps image rects. The environment corrections, reflection, shadows and backdrop all follow this.
3. **Sharp geometry is vector.** The foundation joint and the powered line core are SVG paths, so they stay sharp at any zoom. Painted texture stays raster at the plate's resolution.
4. **No concealment.** Shadows are graded alpha (contact at most 0.5, ambient at most 0.26), never flat. The evidence always includes a shadows-off view.
5. **Loading.** Every image the first frame depends on carries `data-gate`. The plate and lights layers appear together only once all of them have decoded (`PlateGate`): 29 images in the default build, 42 in the experimental build.

## Asset inventory

✅ available · 🟡 placeholder or partial · ❌ missing (needs new artwork; see [`background-requirements.md`](background-requirements.md))

| Layer | Playground | Engineering | Educational | Creative Studio | Experience |
|---|---|---|---|---|---|
| A: clean environment under and behind the station | 🟡 synthesised (M1.3H; reflection light removed in M1.3I). Behind the cabinet is not convincing; the floor band is acceptable but not painted. | 🟡 M1.2.2 backdrop: narrow, rebuilt for a 5 px lift | ❌ | ❌ | ❌ |
| A: environment without connection lines | ✅ | ✅ | ✅ | ✅ | ✅ |
| B: foundation | ✅ SVG joint | ❌ (needs a cut-out bottom edge; trivial once A exists) | ❌ | ❌ | ❌ |
| C: connection layers | ✅ | ✅ | ✅ | ✅ | ✅ |
| D: transparent object | ✅ `playground-v2.png` (M1.3H re-matte) | ✅ `engineering.webp` (M1.2.2, approved) | ❌ silhouette to trace | ❌ silhouette to trace | ❌ silhouette to trace |
| E: platform lighting | ✅ (M1.3F.1, rides the lift) | ✅ (rides the lift) | ✅ static (M1.3F.1) | ✅ static | ✅ static |
| F: shadows | ✅ contact + ambient | 🟡 M1.2.2 single shadow | ❌ | ❌ | ❌ |
| G: reflection | ✅ moves with the lift | 🟡 static reflection part (M1.3F) | n/a (no painted reflection part) | 🟡 static | 🟡 static |
| H: interface | ✅ | ✅ | ✅ | ✅ | ✅ |

The code manifest is `components/lab/scene-25d.ts` (`SCENE_25D`). Each station records its state (`prototype`, `approved` or `placeholder`), the assets it has, and a `missing` list. Only Playground's entry is wired to a working layered rendering.

## Generators

| Script | Writes |
|---|---|
| `scripts/make-playground-layered.mjs` (M1.3H) | Playground's cut-out, synthesised background and the M1.3H shadow |
| `scripts/make-scene-layers.mjs` (`npm run layers:25d`) | The environment corrections, the connection layers and their SVG routes, Playground's reflection, contact and ambient shadows, foundation path, the corrected background, and `components/lab/scene-25d-data.ts` |
| `scripts/make-background-masks.mjs` | The masks in `masks/` for new environment artwork |

None of these touches `reference/`, `lab-plate.webp` or any approved asset.
