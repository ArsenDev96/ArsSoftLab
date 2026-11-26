# M1.4K.9: Playground arcade-screen lighting on quick returns

## Result

**Fixed.** After a quick return, Playground's arcade screen:

- finishes its normal fade-out;
- stays dark while the new spark travels, together with the ring and strip;
- lights again from the arrival, with the approved timing.

**The game is not restarted.** On a quick return the same game session carries on, unseen while dark: the same clock, its time continuing and no second boot.

The change is CSS only, in `components/lab/SceneV2.tsx`, and applies only to `/lab-v2`. `ArcadeScreen.tsx`, `globals.css` and the homepage's screen are untouched.

| Quick returns (0–250 ms after the hover drops) | Before | After |
|---|---|---|
| Screen lit in the last 200 ms before the new spark (`arcade-session`) | **8 of 8** (0.05–1.0) | **0 of 8** |
| Screen lit then (`d1-check`, 12 timings) | **5 of 12** (M1.4K.8 run) | **0 of 12** |
| Ring and strip lit then | 0 (D1 fix) | 0 |
| Same game after the return | 8 of 8 | **8 of 8** |

RTX 4060, Chrome 158 with default settings, 1648 × 928. The fix ran on the dev server (:3002); "before" ran on a production build of `f233593` (:3005), whose screen code is the same. The working tree also holds the uncommitted D1 fix and the M1.4K.8 probe fix. Not committed.

## Cause

The screen has two independent parts (`ArcadeScreen.tsx`, M1.3E).

**1. Its light: a plain CSS opacity transition on `.lab-arcade`.**

```css
.lab-arcade { opacity: 0; transition: opacity 340ms var(--ease-camera-out) }        /* globals.css: off at once */
:is([data-lab-hover="playground"], [data-lab-selected="playground"]) .lab-activation[data-zone="playground"] .lab-arcade {
  opacity: 1; transition: opacity 160ms var(--ease-glow) calc(var(--arrive-now) + 50ms) }  /* ACTIVATION_CSS */
```

This is the shape that caused D1 for the ring:

1. Leaving starts the 340 ms fade.
2. A return during it starts a new transition from the level reached.
3. That transition waits for the new arrival, so **the level is held through the whole flight**.

Since the D1 fix, the ring and strip go dark during that flight, so the screen was the one thing still lit on an unpowered station.

**2. Its game: a game clock (a Web Animation on the canvas) and one rAF loop.**

- Both start on hover.
- While Playground is hovered or selected, the loop never stops, whatever the opacity.
- After leaving, it stops once the fade-out reaches 0. "A quick return during the fade keeps the same loop and game: no restart, no duplicate."

So the light can be reset without touching the game.

## Correction

The ring's D1 pattern, applied to the screen's opacity only, with the screen's own timing.

| Number | Where | What it does |
|---|---|---|
| `--pga-on` | `.pga-cycle`, a new box-less wrapper (`display: contents`) around `ArcadeScreen`, inside Playground's `.lab-activation`, which carries its `--arrive-now` | This cycle's light. **0 until arrival + 50 ms, back to 0 at once on leaving.** Arriving uses the approved timing: 160 ms, `--ease-glow` |
| `--pga` | the screen wrapper `.lab-arcade[data-arcade="playground"]`; `opacity: var(--pga)` | What is shown, `max(--pga-on, --pgah)`. While hovered it follows at once. On leaving it fades with the approved 340 ms, `--ease-camera-out`. A return doesn't restart that fade, so it finishes and the screen relights only from the new arrival |
| `--pgah` | `.pga-cycle` | Fully lit. Keeps the light through Escape or Back's instant with neither hover nor selection, as the ring's `--pglh` does |

**The CSS** (`PG_SCREEN_CSS`, appended to `PG_POWER_CSS`):

```js
const PG_SCREEN = '.lab-activation[data-zone="playground"] .lab-arcade[data-arcade="playground"]';
const PG_SCREEN_ON_MS = 160;
const GAME_DELAY_MS = 50; // ArcadeScreen's; see below
const PG_SCREEN_CSS =
  ["--pga-on", "--pgah", "--pga"].map((v) => `@property ${v}{syntax:"<number>";inherits:true;initial-value:0}`).join("") +
  ".pga-cycle{--pga-on:0;--pgah:0;transition:none}" +
  `[data-lab-returning="playground"] .pga-cycle{transition:--pgah 0ms linear ${PG_RETURN_HOLD}ms}` +
  `${PG_ON} .pga-cycle{--pga-on:1;--pgah:1;transition:--pga-on ${PG_SCREEN_ON_MS}ms var(--ease-glow) calc(var(--arrive-now) + ${GAME_DELAY_MS}ms),--pgah 0ms linear calc(var(--arrive-now) + ${GAME_DELAY_MS + PG_SCREEN_ON_MS}ms)}` +
  `${PG_SCREEN}{--pga:max(var(--pga-on),var(--pgah));opacity:var(--pga);transition:--pga 340ms var(--ease-camera-out)}` +
  `${PG_ON} ${PG_SCREEN}{opacity:var(--pga);transition:--pga 0s}` +
  "@media (prefers-reduced-motion: reduce){.pga-cycle{transition:none!important}}";
```

- **Specificity.**
  - The hovered rule outranks `ACTIVATION_CSS`'s, by one class: (0,5,0) against (0,4,0).
  - The resting rule outranks `globals.css`' `.lab-arcade`.
  - Neither shared rule is edited.
- **Lite and reduced motion keep their 150 ms opacity cross-fade.** Those `!important` rules (`PG_LITE_CSS`, `globals.css`) still apply to the opacity; the numbers just follow at once. `PG_LITE_CSS` gains `.pga-cycle{transition:none!important}`.
- **The 50 ms is repeated, not imported.**
  - `ArcadeScreen.tsx` is a `"use client"` module. Imported into `SceneV2` (a server component), `GAME_DELAY_MS` arrives as a client reference, not the number 50.
  - The first version did import it. It wrote a function stub into the CSS, which made the transition invalid, and the screen lit at once on hover. Every run showed 1.0, so this was caught by `d1-check`.
  - A comment ties the two values together.
- **Unchanged:**
  - `ArcadeScreen.tsx`: game, clock, loop, boot and its stop-when-dark rule;
  - `globals.css` and `EnergySurge.tsx`;
  - the homepage's plate screen (`StationActivation`), whose page contains no `pga`;
  - the ring and strip (D1), the lift, the artwork and every other station.

## Verification

| Check | Probe | Result |
|---|---|---|
| **Quick return before the arrival: screen, ring and strip** | `arcade-session.mjs` (new), 5 gaps × 2, before (:3005) and after | After: in every quick return the screen finishes its fade (from 0.02–1.0 at the return), stays at **0 in the last 200 ms** before the new spark (8 of 8) and never rises before it. It reaches full **+200 ms after the arrival**, as on a normal activation (+200 ms after a full leave, in both builds). Ring: 0 before, full at +233 ms. Before: the screen held 0.05–1.0 through the flight (8 of 8) |
| | `d1-check.mjs m149 1` (12 timings) | **12 of 12**: ring, strip and **screen** dark in the last 200 ms before every new arrival (screen before: 5 of 12 lit); 18.0 px; back at rest |
| **The game persists across leave and return** | `arcade-session.mjs` | Quick returns (0–250 ms after the drop): **same game in 8 of 8**, in both builds. The clock's start time is unchanged; game time carries on (e.g. 1600 → 3466 ms); its state stays "running", with no second "charging" or "booting" |
| | | A full leave (600 ms: the screen had faded out, so its loop stopped) starts a new game, in both builds. That is M1.3E's design (nothing drawn or scheduled at rest), unchanged |
| **Normal Playground activation** | `k1-stations.mjs 2` | **Identical:** 18.0 px; lift 17 / 200 / 450 ms; down 167 / 450 ms; ring and strip 17–250 ms; **screen 67–217 ms** after the arrival (before 67–217). Nothing before the arrival; no other station affected; back at rest |
| Other four stations | `k1-stations.mjs 2` | As in M1.4K.8, within one frame (17 ms); nothing before any arrival |
| **Lite** | `d1-modes.mjs` (screen added), before against after | Screen in 83 / 167 → 81 / 164 ms (half / full); out from 16 ms after the drop, dark at 133 ms, both; a quick return stays lit (no spark in Lite), both. 0 errors |
| | `lite5-check.mjs` | All five stations powered at 400 ms, 0 px lift, 0 sparks |
| **Reduced motion** | `d1-modes.mjs` | Screen in 79 / 163 → 73 / 157 ms (the ring shifts by the same 6 ms: hover-timer jitter); out from 16 ms after the drop, dark at 133 ms, both; a quick return stays lit, both |
| **AZIZ chip** | `lite5-check.mjs` | Cinematic: `?station=playground&project=aziz`, camera moved, lift 17.75 px at the read. Lite: selected, camera still, 0 px. All 10 chips pass; 0 errors |
| **Appearance** | Frozen captures, rest and hovered Playground (`capture-compare.py`, `results/capture-matrix-m149.txt`) | After the fix: identical to this morning's pre-change captures (`home-head`). Rest max 1; hovered Playground max 1, game screen included. The pre-change build captured in this session shows the other state of the documented Playground-edge sub-pixel patch, which switches between capture sessions independently of the build |
| **TypeScript** | `npm run typecheck` | Pass |

## Caveats

1. **The game keeps running unseen during the dark flight** (about 0.5 s). It is the same session, so after the arrival the screen shows the game further along, not a fresh boot. This follows the brief: preserve the session, don't restart it.
2. **A full leave still ends the game.** The loop stops once the screen has faded out after leaving, as designed in M1.3E. "Game state persists" therefore holds for returns during the 340 ms fade (and for staying), not across a full leave. Keeping a game alive across full leaves would need `ArcadeScreen` to keep its clock while nothing is shown, and it is shared with the homepage.
3. **A second leave while the screen is dark** (during the new spark's flight) now ends the game sooner, because the screen is already at 0. Before, the held light kept it alive until a fade finished. The next return then starts a new game, as after any full leave.
4. **`GAME_DELAY_MS` exists twice** (`ArcadeScreen.tsx` and `SceneV2.tsx`). If the switch-on delay changes, change both.
5. **The light keeps time with the hover's `--arrive-now`**, like every station's. On a GPU that starts the spark late (the office), the screen can light that much before the drawn spark, as the ring can (D1′ class). Not re-run at the office.
6. **Scope:** short runs on the RTX 4060, dev server. Not run: the full `k3`, `k5-quick` and `k6-hits` suites, and Firefox or Edge.

## Evidence

All in `docs/m1.4k/work/` unless noted.

| What | Files |
|---|---|
| Screen and session, before and after | `arcade-session.mjs`; `results/arcade-session-before.*`, `arcade-session-after.*` |
| Quick returns | `results/d1-check-m149.*` (before: `d1-check-m148.*`) |
| Stations | `results/k1-m149.txt`, `k1-stations-m149.json` |
| Lite and reduced motion | `d1-modes.mjs` (now also records the screen); `results/d1-modes-m149-before.*`, `d1-modes-m149-after.*` |
| Chips and Lite | `docs/performance/work/results/lite5-check-m149.*` |
| Captures | `docs/performance/work/captures/lite/m149-*/` (PNGs ignored by Git); `results/capture-compare-m149.txt`, `capture-matrix-m149.txt` |
