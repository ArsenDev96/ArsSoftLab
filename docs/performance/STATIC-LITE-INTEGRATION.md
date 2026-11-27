# Static Lite integration

## Result: **Lite is now the flattened laboratory. Cinematic and `/` are unchanged.** Not committed.

- **`/lab-v2?render=lite` draws the approved Static Lite scene:** one plate and five station sprites, with live HTML for every interaction.
- **Cinematic remains the default.** The Cinematic / Lite selector works as before, and there is no third public option.
- **Every interaction check passes (20/20):**
  - all five hotspots, labels and chips;
  - keyboard, Back and Forward, Escape;
  - deep links, and the SQLOrbit and AriMap pages and back;
  - the selector, and `floor`.
- **Responsiveness matches the approved prototype:** 60 fps on hover, switching, selection and chips; stations powered 20–56 ms after the pointer moves.
- **Cinematic and `/` are unchanged:**
  - the server markup of 12 Cinematic, project and homepage URLs is byte-identical to the committed version (`63fb64f`);
  - Cinematic's pixels are identical at rest and with Engineering's full sequence.
- **The six approved images are unchanged.** The preserved bake reproduces them byte for byte. A Node-only check reports when they go stale.

Office computer (Radeon HD 5450; default Chrome composites in software), headless, 1648 × 928, dev server. TypeScript passes.

## 1. Implementation changes

| File | Change |
|---|---|
| `app/lab-v2/page.tsx` | `render=lite` renders `LabSceneStatic` instead of `LabScene`'s layered Lite. `?render=lite&lite=layered` keeps the layered scene, **on a development server only**, as the bake's source (§2). The selector and `floor` logic are otherwise unchanged |
| `components/lab/LabSceneStatic.tsx` (new) | Lite's renderer: the plate, five sprites (on at once while their station is hovered, focused or selected), the focus vignette, and `LabStations` with each station's rest outline. Marked `data-lab-render="lite"` and `data-lite-renderer="static"`. The sprite boxes come from the manifest |
| `components/lab/static-lite-manifest.json` (new) | The images' checksums, sizes and boxes, the source commit, and fingerprints of 196 sources (§4) |
| `public/scene/static-lite/` (new) | The six approved images, unchanged since approval |
| `scripts/static-lite/` (new) | `bake.mjs` (capture), `bake.py` (build), `check.mjs` (stale check), `README.md`. The bake moved here from the experiment's `docs/performance/work/static-bake.*` |
| `package.json` | `npm run static-lite:check` |

**Unchanged:**
- `LabScene`, `SceneV2`, every station component, `LabState`, `LabStations`, `LabHero` and `RenderModeSelector`;
- `globals.css`, all artwork, `lib/lab-v2-pages.ts` (its experimental `static` support was removed again), and the homepage.

The application diff against `63fb64f` is `page.tsx` (+8, −2) and `package.json` (+1), plus the new files.

**The layered Lite code stays,** and it is not dead code: it is what the images are baked from. Cinematic never mounts it, and production can't reach it.

## 2. Rendering-mode behaviour

| URL | Production | Development server |
|---|---|---|
| `/lab-v2`, `?render=full`, any other `render` value | **Cinematic** (default) | Cinematic |
| `?render=lite` | **Lite: Static Lite** | Static Lite |
| `?render=static` (the experiment's URL) | Cinematic: no longer a mode | Cinematic |
| `?render=lite&lite=layered` | Static Lite (`lite` ignored) | the layered Lite scene, for `bake.mjs` only |

- **Selector:** two options, Cinematic and Lite, as before. Lite writes `render=lite` and Cinematic removes it. Switching keeps the selection and every other parameter, without a reload.
- **`floor` in Lite.** Static Lite has one floor: the untoned one Lite always used by default.
  - `?floor=approved` and `?floor=original` have **no effect in Lite**, and the page says so in a code comment rather than silently.
  - **The parameter stays in the URL**, so it keeps its meaning. Switching to Cinematic shows the approved tone (checked), and project pages carry it there and back, as before.
  - Lite doesn't rewrite or drop it.
- **Lite's interaction model** (unchanged from the approved prototype):
  - a station lights on the frame its hover, focus or selection registers, with no fade;
  - the vignette and the dimming of other labels are instant;
  - no camera move, lift, spark or animated light;
  - nothing animates at rest (0 running animations).

## 3. Focused verification

| # | Check | Result |
|---|---|---|
| — | TypeScript (`npm run typecheck`) | **PASS** |
| 1 | Lite uses the static renderer (`work/lite-integration-smoke.mjs`) | **PASS.** `render=lite` mounts `data-lite-renderer="static"` and no layered scene. Exactly 6 scene requests (the six images), 0 running animations. The selector shows Lite. `render=static` gives Cinematic. In development, `&lite=layered` gives the layered source |
| 2 | All five stations | **PASS, 5/5.** A point inside each hotspot's outline hovers and powers its station (only that one). A click selects it (vignette on, URL `?station=…&render=lite`). It stays lit when the pointer leaves. Escape returns home with focus on its title, and it goes dark when focus moves on. All of this is the same as in Cinematic and the layered Lite (checked) |
| 3 | Chips and project navigation | **PASS.** Each station's first chip selects SQLOrbit, AriMap, AZIZ, Wallpapers and Koreez in turn. Open project → `/lab-v2/projects/{sqlorbit,arimap}?render=lite` → Back to the lab → `?station=…&project=…&render=lite`, in Static Lite with the station lit |
| 4 | History and keyboard | **PASS.** Back and Forward step project → station → lab → station → project, each in Lite with the right station lit. 11 Tabs from the top reach Educational's title: it lights, with the focus ring. Enter selects it, Tab + Enter selects AriMap, and Escape returns with focus on the title |
| 5 | Selector | **PASS.** From `?station=playground`, choosing Lite gives `&render=lite` in the same document (no reload), with Playground still selected and lit. Choosing Cinematic removes `render`; Back returns to Lite |
| — | `floor=approved` in Lite | **PASS.** Static scene, no tone layer, URL kept. Choosing Cinematic gives `?floor=approved` with the tone |
| 6 | Cinematic unchanged | **PASS.** Server markup byte-identical to `63fb64f` for `/lab-v2`, `?render=full`, `?floor=approved`, `?floor=original`, `?station=engineering&project=sqlorbit` and `?station=playground`. Pixels identical (0 px) at rest and with Engineering hovered after its full sequence. Control: `?render=lite` differs, as intended |
| 7 | `/` unchanged | **PASS.** Markup byte-identical for `/` and `/?station=educational&project=arimap`. Pixels differ only in an 85 × 30 px box around the globe, where the homepage's orbit animation runs continuously: two captures of the same version differ in the same box |
| — | Project pages | Markup byte-identical for `/lab-v2/projects/sqlorbit` and `/arimap`, with and without `render=lite` (and `&floor=approved`) |
| 8 | Responsiveness against the prototype (one round of `work/static-perf.mjs`, `MODES=lite`) | **Matches** (table below) |
| — | Console | No errors in any run |
| — | Assets | `npm run static-lite:check`: current. A test bake into a temporary folder reproduces all six images **byte for byte** |

| Default Chrome, 1648 × 928 | Approved prototype (`static-perf.json`, 2 rounds) | **Integrated Lite** (`lite-integration-perf.json`, 1 round) |
|---|---|---|
| Hover: frame rate; longest frame | 60 fps; 16.8 ms | **60 fps; 16.8 ms** |
| Hover to station powered | 20–34 ms | **20–56 ms** (the hover registering; powered the same frame) |
| Sweep (10 visits, 300 ms each): rate; visits lit | 60 fps; 10/10 | **60 fps; 10/10** |
| Selection: longest frame; frames over 150 ms | 17–50 ms; 0 | **17–33 ms; 0** |
| Chips: pressed; click to next paint | 26–52 ms; 56–80 ms | **29–66 ms; 48–104 ms** |
| Compositor busy: hover / sweep / selection | 17–19 / 103–111 / 302–324 ms | **16 / 111 / 269 ms** |
| Load: scene shown; LCP; requests; KB | 508–528 ms; 500–712; 6; 2578 | **472 ms; 660; 6; 2578** |

The few slower figures (56 ms to power, 104 ms for one chip's next paint) are single samples within the prototype's dev-server noise; no frame was slow. For reference, the old layered Lite took 168–350 ms to power a station, swept at 8–9 fps, and needed 240–528 ms to the next paint after a chip click (`static-lite-experiment.md` §2).

## 4. Asset manifest

`components/lab/static-lite-manifest.json`. Baked on 2026-11-27 at 1672 × 941 from the layered Lite scene (untoned floor) at commit **`63fb64fa0c230b82c25a1b5f7d2d6374a029c826`**. Approved in `static-lite-experiment.md` §7–8.

| Image (`public/scene/static-lite/`) | SHA-256 | Bytes | Box (scene px) |
|---|---|---|---|
| `plate.webp` | `4d254bd48d83b7802dfa7046db5b6529abf09f00a4786acaf71cded88d4ee2a5` | 1,657,900 | the full frame, 1672 × 941 |
| `on-engineering.webp` | `dc3cb9435c757f4769133fd025208fd6f9b7e0134fae91d1211fbe5302bf153c` | 171,384 | 238, 390, 546 × 281 |
| `on-educational.webp` | `98296db40cea081b18edb131bf104dfbe43a2ed7d7db51afe380dfc3f8dcdf22` | 146,122 | 663, 269, 351 × 311 |
| `on-playground.webp` | `fa5c40c3cdef92aa3b9ae37aa490961d8514ff27c6801dee3f724f9ea127124c` | 136,814 | 887, 371, 502 × 229 |
| `on-creative.webp` | `1e837ea71dfe5275fbebc4b54d677cb392e316b4448de0b8c293f83005452cbb` | 250,888 | 51, 549, 675 × 325 |
| `on-experience.webp` | `2c5030f2173bfa81e5394e2d3bfcde5ebc2b313f060684a19d41431c91d57287` | 275,200 | 958, 567, 714 × 330 |

All six are lossless WebP, 2.6 MB together.

**Stale check (`npm run static-lite:check`).**
- Node and the file system only: no browser, and not run by `next build`.
- It verifies the six checksums and compares the fingerprints of **196 sources**:
  - **artwork:** the 159 files under `public/scene/v2/`;
  - **code (37 files):** `SceneV2`, `ChargeLine` and `EnergySurge` and everything they import from the repo, plus `LabScene.tsx`. Excluded, because they draw nothing in the resting scene: `LabState`, `data/projects`, `lib/lab-url` and `lib/camera`.
- Text is hashed with LF line endings, so Windows and Unix checkouts agree.
- Exit 1 lists each changed, new or removed source, or a changed image.
- `--list` shows the watched sources.

**Regenerating** is manual and development-only: `scripts/static-lite/README.md`. In short: `bake.mjs` against `next dev`, then `bake.py`, then `check.mjs --write`, then a visual review. `bake.py --out <dir>` tests a bake without touching the approved images. Nothing regenerates during a build, and the production build gains no browser or Python dependency.

## 5. Known limitations

1. **Accepted visual differences from the layered Lite** (`static-lite-experiment.md` §5, §8):
   - very slightly softer off the native scale (about 6 % less edge energy at 1648 × 928; none at 1366 × 768);
   - instant activation, vignette and label dimming;
   - when two stations are powered at once, 1,421 px near the central A show only one station's light (not visible).
2. **One floor in Lite.** `floor` has no effect there (§2). Offering the approved tone in Lite would need a second, approved set of images.
3. **The stale check is a tool, not a gate.** It doesn't run by itself; run it before committing scene changes, or add it to CI. It doesn't watch `app/globals.css`, which is shared site-wide: a change to a scene class there needs a manual re-bake.
4. **The bake depends on the rendering machine.** The approved images were captured here, with Chrome's software rasteriser, and re-capture byte for byte here. A bake on a GPU machine (the RTX 4060) may differ by small rounding, so re-bake on the office computer, or compare with the approved images first.
5. **Resolution.** The plate is 1672 × 941, the resolution of nearly all of the layered scene's layers. Large and high-density screens see it upscaled.
6. **The old Lite probes** in `docs/performance/work/` (`lite-perf.mjs`, `lite5-check.mjs`, `lite-capture.mjs`, `lite-interact.mjs`, …) measure the layered scene's internals through `?render=lite`. They now need `?render=lite&lite=layered` on a development server. The experiment's probes (`static-compare`, `static-review`) use the retired `?render=static`; `static-perf.mjs` now takes `MODES` and `OUT`.
7. **Not verified with a production build.**
   - `lite=layered` is disabled in production by `process.env.NODE_ENV`, by construction; this wasn't checked on a production server.
   - Switching modes still waits for the server render (`render-mode-selector.md`, issue 1), as before.

## 6. Remaining verification on the RTX 4060

1. `npm run static-lite:check`. This should report "current", which also confirms that the fingerprints match across machines and line endings.
2. `node docs/performance/work/lite-integration-smoke.mjs` (on a dev server): expect 20/20.
3. **Cinematic unchanged:** run `node docs/performance/work/lite-capture.mjs` against a baseline captured there from `63fb64f`, or compare the server markup of `/lab-v2` and `/` with a checkout of `63fb64f`, as in §3.
4. **Lite once with that GPU:** `MODES=lite OUT=lite-rtx.json node docs/performance/work/static-perf.mjs 1`. Expect 60 fps throughout and a fast load, like here.
5. **By eye,** on that computer's display: `/lab-v2?render=lite` at rest, hovered and selected, including the plate's sharpness at its native resolution and scaling.
6. **Don't re-bake there** without comparing against the manifest (limitation 4).
