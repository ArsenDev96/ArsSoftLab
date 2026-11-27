# M1.4O: the header's Experience link shifts the lab (27 Nov 2026)

**Branch:** `feat/lab-v2`, on top of `771e759`. Production verification: 28 Nov 2026 (§7).

**Result: fixed, and verified in a production build in Chrome, Firefox and WebKit.**

- Following "Experience" (`#station-experience`) no longer moves the lab or exposes a black band, by any route, at any desktop size tested.
- The fix is CSS only: `overflow: clip` instead of `overflow: hidden` on two boxes.
- Nothing drawn changes, and the Static Lite check still reports current.
- Separate and still outstanding: on desktop, the Experience link doesn't open the Experience station (§9).

## 1. Reproduction

**Steps:**

1. Development server, headless Chrome, 1648 × 928.
2. Open `/` or `/lab-v2` (Cinematic).
3. Click "Experience" in the header.

**What happens:**

| | Before the click | After the click |
|---|---|---|
| URL | `/lab-v2` | `/lab-v2#station-experience`; one history entry added |
| Window scroll | 0, 0 | 0, 0: **the page does not scroll** |
| The scene's frame (LabScene's cover-scaled box, `overflow: hidden`) | `scrollTop` 0 | **`scrollTop` 61**: the scene's contents move up 61 px, and a black band opens at the bottom |
| The Experience label (`#station-experience`) | y 564 | y 503 |
| Focus | — | Stays on the Experience link |
| Browser Back | — | URL back to `/lab-v2`, but the frame **stays scrolled**, because browsers don't restore an inner box's scroll position |

**Every route reproduces it:**

- a click on the header link (a Next.js `<Link>`);
- a plain `<a href="#station-experience">`, without Next.js;
- the keyboard (Enter on the link);
- a direct URL `…#station-experience`;
- `element.scrollIntoView()` on its own.

So it is the browser's own fragment scrolling; no app code scrolls anything. The other header links are unaffected:

- Projects (`#lab-stations`) targets the top of the scene, so nothing needs scrolling.
- About (`#lab-intro`) targets the hero, which is outside the frame.
- Lab is a route link (`/`).

**It's not only 61 px or only Cinematic.** Clicking Experience at other sizes, on the unfixed `771e759`:

| Viewport | `/` and Cinematic `/lab-v2` | Static Lite `/lab-v2` |
|---|---|---|
| 1648 × 928, 1440 × 900, 1366 × 768, 1280 × 800, 1024 × 768 | Frame scrolls 51–61 px | Nothing |
| 1920 × 945 | Frame scrolls 71 px **and `<main>` 68 px** | `<main>` scrolls 68 px |
| 2560 × 1080 | Frame scrolls 95 px **and `<main>` 180 px** | `<main>` scrolls 180 px |
| 844 × 390 (landscape phone: compact header, Experience in the menu) | `<main>` 43 px, frame 31 px | — |

In portrait (station mode) the dock's handler already opens the Experience station instead of following the anchor (`MOBILE-DOCK-PROTOTYPE.md` §4).

## 2. Root cause

Two `overflow: hidden` boxes had content that reached past them. A hidden box clips that content, but it is still a scroll container. Fragment navigation then scrolls such a box to bring its target into view.

1. **The scene's frame (Cinematic and the homepage).**
   - LabScene's frame is exactly the cover-scaled scene.
   - Its energy-track layers (`.lab-track`, from `EnergySurge`, `StationActivation` and `MaskedLight`) reach **51–95 px below it**. The figure scales with the screen; at 1648 × 928 the frame is 928 px tall and its content 989 px.
   - The overhang is never visible, because it's clipped, but it makes the frame scrollable by that much.
   - `#station-experience` is an in-scene label at y ≈ 564. The browser aligns it towards the top of the frame and stops at the frame's limit: 61 px.
   - Static Lite's frame has nothing overhanging (`scrollHeight` = `clientHeight`), so at 16:9 it doesn't move.
2. **The lab's `<main>` (all modes, wider than 16:9).**
   - The scene is cover-scaled, so on screens wider than 16:9 its frame is taller than `<main>` (1081 px against 945 px at 1920 × 945).
   - The part below `<main>`'s bottom edge is scrollable overflow of `<main>`, which is also `overflow: hidden`. The same fragment scroll moves it.
   - This is why Static Lite is affected there too.

## 3. The fix

**Make both boxes clip without being scroll containers.** With `overflow: clip`:

- the clipping is the same as before (to the padding box; `overflow-clip-margin` is 0);
- but the box can't be scrolled, by the user or programmatically;
- fragment navigation still updates the URL and history, and simply has nothing to scroll.

| File | Change |
|---|---|
| `app/page.tsx` | `<main>`: `overflow-hidden` → `overflow-clip` (Tailwind), with a comment. The only homepage change |
| `app/lab-v2/page.tsx` | `<main>`: the same |
| `app/globals.css` | `div:has(> .lab-camera) { overflow: clip; }`: the scene's frame (the camera's parent) in both LabScene variants, with a comment |

**What the frame rule matches.** `.lab-camera` is rendered only by `LabCamera`, and `LabCamera` only by `LabScene`, as the direct child of its frame (once for the full scene and once for the layered Lite scene that Static Lite is baked from). `div:has(> .lab-camera)` therefore matches exactly that frame and nothing else: not Static Lite's frame, the project pages, the header, the hero or the dock.

**Why the frame rule is in CSS.** The frame is in `components/lab/LabScene.tsx`, which the Static Lite staleness check watches; editing it would mark Lite's images stale. `globals.css` isn't watched. The rule changes nothing that is drawn (§5), so the baked images are still correct. Static Lite's own frame (in `LabSceneStatic`) has no camera, so the rule doesn't apply to it, and it doesn't need to: its frame has no overhang, and its `<main>` now clips.

**Not changed:**

- the header and its links (same text, same `href`s, and "Experience" still goes to `#station-experience`);
- navigation code and focus handling;
- the scene, its artwork, the camera and the animations;
- the mobile dock;
- the project pages;
- any dependency.

## 4. Focused test results

These ran on the development server in headless Chrome, at 1648 × 928 unless stated. The same checks ran against the unfixed `771e759` on a second server. **After the fix: 25 of 25 pass. Before: 10 of 25**, and the 15 failures are all this bug.

| Check | `/` | Cinematic `/lab-v2` | Lite `/lab-v2` |
|---|---|---|---|
| Experience click: URL `#station-experience`; nothing scrolls; the Experience label stays at y 564; Back and Forward change the URL, and nothing scrolls | PASS | PASS | PASS |
| Experience by keyboard (Enter): URL updated, nothing scrolls, focus stays on the link | PASS | PASS | PASS |
| After the anchor, the next Tab reaches About. Chrome keeps focus on the clicked link, because the target isn't focusable; this is the same before the fix | PASS | PASS | PASS |
| Projects (`#lab-stations`), About (`#lab-intro`) and Lab (`/`): right URLs, nothing scrolls | PASS | PASS | PASS |
| Direct URL `…#station-experience`: nothing scrolled on load | PASS | PASS | PASS |
| After the anchor, clicking the Experience title selects it. In Cinematic the camera still moves (`matrix(1.03, …, -24.7, 0)`) | PASS | PASS | PASS |

Further checks:

- **Wider than 16:9:** 1920 × 945 and 2560 × 1080 on `/` and Lite `/lab-v2`: nothing scrolls.
- **All desktop sizes:** 1648 × 928, 1920 × 945, 1366 × 768, 1280 × 800, 1440 × 900, 2560 × 1080, 1280 × 1024 and 1024 × 768, on all three routes: nothing scrolls, the window included.
- **Mobile smoke:**
  - 390 × 844: the dock selects Playground; the menu's Experience opens the Experience station; the dock stays in step; nothing scrolls.
  - 844 × 390: the menu's Experience follows the anchor and nothing scrolls (before: `<main>` 43 px and the frame 31 px).
- **Console:** no errors or warnings.
- **Horizontal overflow:** none.
- `npm run typecheck`: pass.
- `npm run static-lite:check`: current (6 images, 196 sources, baked at `63fb64f`).

## 5. Regression boundaries

**Method:**

- I ran an A/B test with two development servers side by side: the unfixed `771e759` (A) and the fixed tree (B).
- It covers 31 cases:
  - `/` and `/lab-v2` (Cinematic and Lite);
  - selected stations and open projects, with and without hover;
  - nine sizes, from 320 × 640 to 2560 × 1080;
  - the mobile dock states (390 × 844, 430 × 932, 320 × 640, 844 × 390, 1024 × 1366);
  - two project pages.
- Each case compares two things:
  - **a layout fingerprint:** every element's box, visibility and key computed styles. `overflow-clip` is read as `overflow-hidden`, because that's the one intended difference.
  - **screenshots:** with reduced motion and with full motion.

**Results:**

| | Result |
|---|---|
| Layout fingerprint | **Identical in all 31 cases** (233–1110 elements each): the homepage, desktop `/lab-v2` in Cinematic and Lite, the mobile dock (closed, a station open, a project open, landscape) and both project pages |
| Reduced-motion screenshots | 27 cases: identical, or differing only in the header text's anti-aliasing (≤ 1/255). The other 2, both Cinematic `/lab-v2`, are covered in the next row |
| Cinematic `/lab-v2` at 1648 × 928 and 1024 × 768 (reduced motion) | One region differs, up to 66/255 (1648) and 13/255 (1024), in the scene's time-driven area. **This is noise:** comparing the unfixed server with itself gives the same differences, same boxes, same sizes. On a rerun, A against B, the 1648 case was identical and the 1024 one had moved |
| Full-motion screenshots | Differences only where animation is time-driven: the arcade and energy-track regions, and the homepage's whole-frame ambient animation. Not comparable between two runs; the reduced-motion row is the one that counts |
| Static Lite | 8 Lite cases: identical, apart from header text ≤ 1/255. `npm run static-lite:check`: current |

**So:**

- the homepage's visual composition is unchanged;
- the desktop lab, in both modes, is unchanged;
- the mobile dock, in every state tested, is unchanged;
- the project pages are unchanged.

## 6. Note on motion

The frame case (1648 × 928, 1366 × 768 and other 16:9-ish sizes) needs motion on. With `prefers-reduced-motion`, the energy-track layers don't overhang the frame, so at those sizes the unfixed build doesn't scroll. Only the wider-than-16:9 `<main>` case shows. The production checks below therefore ran both ways.

## 7. Production verification (28 Nov 2026)

**Setup:**

- `npm run build`: passes (Next.js 16.4.6, Turbopack; TypeScript passes in the build). `next start` on port 3100.
- The unfixed `771e759`, built the same way, ran on a second port as a control.
- Headless Chrome through `scripts/visual/cdp.mjs`.

**Chrome, production, fixed build: 27 of 27 pass.** The same checks fail 13 of 27 on the unfixed build, and every failure is this bug.

| Check | Routes and sizes | Result |
|---|---|---|
| Experience click: URL gets `#station-experience`; nothing scrolls, the window included; the Experience label stays put; the bottom 120 px of the screen are pixel-identical before and after (no black band); Back and Forward change the URL and scroll nothing | `/`, Cinematic `/lab-v2`, Lite `/lab-v2` × 1648 × 928, 1920 × 945, 2560 × 1080 (9 cases) | PASS. Unfixed: 6 fail, with `<main>` scrolled 61–180 px and 185,000–296,000 changed pixels in the bottom strip |
| Direct URL `…#station-experience`: nothing scrolled on load | the same 9 | PASS. Unfixed: 6 fail |
| Keyboard: focus the link, Enter. URL updated, nothing scrolls, focus stays on the link | 3 routes, 1648 × 928 | PASS |
| Projects (`#lab-stations`), About (`#lab-intro`), then the Experience title (selects the station), then Lab (`/`): right URLs, selection works, nothing scrolls | 3 routes, 1648 × 928 | PASS |
| Mobile dock, 390 × 844: Playground opens; the menu's Experience opens Experience; the dock follows; Escape closes it; nothing scrolls | `/lab-v2` | PASS (unfixed too: in station mode the dock handles that anchor) |
| Landscape 844 × 390: the menu's Experience follows the anchor; nothing scrolls | `/lab-v2` | PASS. Unfixed: fails |
| Console: errors, warnings, hydration messages, uncaught exceptions | every page above | None |

Those ran with reduced motion, which makes the screenshots stable. **With motion on** (§6), the frame case:

| | `/` and Cinematic `/lab-v2`, 1648 × 928 | 1366 × 768 | Lite |
|---|---|---|---|
| Unfixed | Frame scrolls 61 px (label 564 → 503) | Frame scrolls 51 px | Nothing |
| Fixed | Nothing scrolls (label stays at 564) | Nothing | Nothing |

No console errors or warnings in either build.

**Rendering, production against production.** These are 18 of the §5 cases, unfixed build against fixed build:

- `/` at 1648, 1920, 2560, 390 × 844 and 844 × 390, including an open project;
- Cinematic `/lab-v2` at 1648, 1920 and 1024 × 768;
- Lite with and without an open project;
- the mobile dock (closed, a project open, a Lite project at 320 × 640 and 430 × 932, landscape);
- both project pages.

| | Result |
|---|---|
| Layout fingerprint | Identical in all 18 |
| Reduced-motion screenshots | **Pixel-identical in all 18** (0 px) |
| Full-motion screenshots | Pixel-identical in 17. `/` at 844 × 390: 521 px in a 16 × 40 px spot of time-driven animation |

So, in production:

- the homepage looks the same;
- desktop Cinematic and Lite composition are unchanged;
- the mobile dock is unchanged;
- the project pages are unchanged.

**Static Lite:** `npm run static-lite:check` reports current (6 images, 196 sources, baked at `63fb64f`).

**A probe note.** A full-screen screenshot of Cinematic at 2560 × 1080 never returns over the test harness's connection. That is a known harness limit (`docs/m1.4i/NOTES.md`), and the unfixed build behaves the same way. The black-band check therefore captures only the bottom 120 px.

## 8. Browser coverage

These are the Playwright builds of Firefox and WebKit already on this machine, driven by an existing Playwright install (1.64.1, from the npm cache). Nothing was installed for this milestone.

| Engine | `overflow: clip` | `:has()` | Computed: `<main>` / frame | Fixed build | Unfixed build (control) |
|---|---|---|---|---|---|
| Chrome (headless) | supported | supported | `clip` / `clip` | All pass (§7) | Fails (§7) |
| Firefox 155.0 (Playwright build) | supported | supported | `clip` / `clip` | 6 of 6 pass, motion on and reduced | Motion on: 5 of 6 fail (frame 61 px at 1648; `<main>` 61 px and frame 71 px at 1920; `<main>` 174 px at 2560 Lite). Reduced: 3 fail |
| WebKit 27.2 (Playwright build, Windows) | supported | supported | `clip` / `clip` | 6 of 6 pass, motion on and reduced | Motion on: 5 of 6 fail (frame 61 px; `<main>` 68 px and frame 71 px; `<main>` 180 px). Reduced: 3 fail |

Each engine ran these cases:

- `/`, Cinematic and Lite at 1648 × 928;
- `/` and Cinematic at 1920 × 945;
- Lite at 2560 × 1080.

Each case clicks Experience, checks the URL, checks that nothing has scrolled and that the label hasn't moved, then goes Back. There were no page errors in any engine. Static Lite's frame has no camera, so the frame rule doesn't apply to it, by design (§3).

## 9. Separate, outstanding: the desktop Experience link doesn't open its station

This fix only stops the scroll. On desktop, "Experience" in the header still points at the in-scene Experience label, `#station-experience`, as it always has. Following it now updates the URL and does nothing visible: **it doesn't open the Experience station's panel.**

On mobile in station mode, the dock's handler already turns that anchor into `selectStation("experience")` (`MOBILE-DOCK-PROTOTYPE.md` §4). Doing the same on desktop is a navigation change, so it wasn't made here. It remains a separate, open item.

## 10. Remaining limitations

- **Engines not tested:**
  - Safari itself (macOS or iOS). The WebKit run is Playwright's Windows build.
  - Branded release Firefox. The Playwright Firefox build was used, although a release Firefox is installed.
  - Real phones, and Chromium-based browsers other than headless Chrome.
- **Older browsers.** `overflow: clip` needs Chrome 90, Firefox 81 or Safari 16 or later. The frame rule also needs `:has()`: Chrome 105, Firefox 121, Safari 15.4. Where either is missing, the rule is ignored and that browser keeps the previous behaviour, so the bug remains there; nothing else changes.
- **Headless only.** No headed desktop browser was used. Measurements were taken in the DOM and from screenshots.
- **The desktop Experience link still doesn't open its station** (§9).
- **Unrelated items, untouched:** the overhanging energy-track layers (harmless now that they're clipped without scrolling), and the lab's first paint of about 1.0–1.2 s.
