# M1.4L handoff: office to home (27 Nov 2026)

**Branch:** `feat/lab-v2`.

**Last completed milestone:** M1.4L.6B, the AZIZ case study (`84ef553`).

**This checkpoint:** the commit that adds this file. It changes documentation only: this handoff and the corrected Wallpapers audit. No application code changed, and `main` is untouched.

## 1. Where things stand

### Completed case studies

All five are under `/lab-v2/projects/<slug>`. They are reached from the lab's "Open project" link in `/lab-v2` only; the production homepage `/` is unchanged and still says "Coming soon".

| # | Project | Route | Commit | Screenshots |
|---|---|---|---|---|
| 1 | SQLOrbit | `/lab-v2/projects/sqlorbit` | `b4eeeb8` | None |
| 2 | AriMap | `/lab-v2/projects/arimap` | `e8d6e98`, viewer `63fb64f` | Yes (accessible viewer) |
| 3 | TableRefresh | `/lab-v2/projects/tablerefresh` | `b2f3296` | Yes |
| 4 | Armat | `/lab-v2/projects/armat` | `c99d7b9` | None (by decision) |
| 5 | AZIZ | `/lab-v2/projects/aziz` | `84ef553` | **Pending:** authentic captures (§5) |

**How the pages are built:**

- They share one data-driven template (`components/project/ProjectDetail.tsx`).
- Adding `detail` to a project in `data/projects.ts` creates its page and its lab link.
- Each project has a record in `docs/m1.4l/`: `*-CONTENT-AUDIT.md` and `*-PROTOTYPE.md`.

### Projects without a page

| Project | Status |
|---|---|
| **Wallpapers** | Audit done, with corrected scope (§2). **Page deferred.** It stays the lab's "Coming soon" example in the navigation tests. |
| **Koreez** | **Paused** (§3). No page; the navigation tests expect its route to return 404. |

## 2. Wallpapers: audit findings and limitations

Full record: [`WALLPAPERS-CONTENT-AUDIT.md`](WALLPAPERS-CONTENT-AUDIT.md).

- **Owner decisions:**
  - a message-led wallpaper collection and a planned mobile app;
  - "Wallpapers that speak to you.";
  - English first;
  - artwork in portrait 9:20, target 1440 × 3200 PNG;
  - themes emotional, motivational, philosophical, funny, bold and personal;
  - the artwork directly reinforces its message;
  - related project AZIZ (provisional);
  - the lab summary unchanged.
- **Found:** the office computer's local folders and the owner's 13 public GitHub repositories had no Wallpapers code, artwork or documentation. **That applies only to those sources.** The project was developed mainly in ChatGPT conversations, which the audit couldn't access. More than 100 concepts were planned there.
- **Unverified:**
  - the number of finished, approved artwork files;
  - any mobile app implementation.
  
  Neither may be presented as existing.
- **Next step:** the owner gathers the approved finals and any app code, with provenance and font licenses. Then a short verification pass, then the page (8B), which needs five portrait images and no template change.

## 3. Koreez: paused

- **The case study is on hold** until:
  1. the owner confirms the contributions;
  2. the owner confirms the Overview;
  3. the employer gives appropriate publication clearance.
- **The content audit is not in this repository.** It is kept privately by the owner, outside Git, because it is professional employment work and its publication hasn't been cleared.
- **Don't implement or publish anything for Koreez** until all three conditions are met.

## 4. Rendering modes: Cinematic and Static Lite

| Mode | URL | State |
|---|---|---|
| **Cinematic** (default) | `/lab-v2` | Complete. The RTX 4060 checks were done at home and closed on 26 Nov 2026 (M1.4K.6–M1.4K.10; `docs/m1.4k/NOTES.md`). |
| **Static Lite** | `/lab-v2?render=lite` | Committed in `16f5ba6`. Lite now draws a flattened, pre-baked scene (`components/lab/LabSceneStatic.tsx`, `public/scene/static-lite/`). It was verified on the office computer with Chrome's software rasterizer. **Not yet verified on the RTX 4060.** |

**Static Lite limitations** (`docs/performance/STATIC-LITE-INTEGRATION.md` §5):

- a production build wasn't checked;
- the bake depends on the machine;
- the plate is 1672 × 941, so large screens see it upscaled.

## 5. Outstanding work

### Home RTX 4060 verification (Static Lite)

This comes from `docs/performance/STATIC-LITE-INTEGRATION.md` §6. Run it on a dev server.

1. `npm run static-lite:check`: expect "current".
2. `node docs/performance/work/lite-integration-smoke.mjs`: expect 20/20.
3. **Cinematic unchanged:** compare the server markup of `/lab-v2` and `/` with a checkout of `63fb64f`, or use `lite-capture.mjs` against a baseline from `63fb64f`.
4. **Static Lite once on this GPU:** `MODES=lite OUT=lite-rtx.json node docs/performance/work/static-perf.mjs 1`. Expect 60 fps.
5. **By eye:** `/lab-v2?render=lite` at rest, hovered and selected, including how sharp the plate looks on that display.
6. **Don't re-bake** on the home computer without first comparing against the manifest.

### AZIZ: authentic screenshots

This comes from `docs/m1.4l/AZIZ-PROTOTYPE.md` §6. Capture five screens from the **current** build (versionCode 9, or the Play-installed 1.0.0):

1. Home;
2. Wrong Answer Only (judge screen);
3. Same Answer (thinking phase);
4. Act It! (during a turn);
5. Results.

**Capture details:**

- English;
- 1080 × 2400;
- raw `adb` screencaps;
- a clean status bar;
- fictional player names.

The logo on Home needs its provenance confirmed first. Adding the captures is data only: `media` and `mediaNotes`, plus `showMedia` on the Game modes section.

### Other open items

- **Production build:** the project pages and Static Lite haven't been checked in a production build.
- **Template-wide:** at 320 px, taglines end on a single word (recorded, not fixed).

## 6. Recommended next milestones

1. **RTX 4060 verification of Static Lite** (§5): the first thing to do at home.
2. **AZIZ screenshots** (data only), when current-build captures are available.
3. **Wallpapers (M1.4L.8B):** once approved artwork and the facts are supplied.
4. **Koreez (M1.4L.7B):** only after the owner's confirmations and employer clearance.
5. **A production-build check** of `/lab-v2`, the project pages and Static Lite.

## 7. Resuming on the home computer

These are PowerShell commands, run in the home checkout `E:\ArsSoftLab`. The application needs Node 22 or later.

```powershell
cd E:\ArsSoftLab
git status --short                       # expect nothing; stash or commit any local work first
git fetch origin
git switch feat/lab-v2
git pull --ff-only origin feat/lab-v2
git log --oneline -3                     # expect the handoff commit, then 84ef553
npm ci
npm run typecheck
npm run static-lite:check                # expect "current"
npx next dev -p 3002
```

**Notes:**

- **Port:** the probes in `docs/*/work/` default to `http://localhost:3002`. On another port, set `$env:BASE = "http://localhost:3000"` before running them.
- **Browser:** the probes start their own headless Chrome (`scripts/visual/cdp.mjs`).
- **Dev server:**
  - It may re-add a block to `AGENTS.md`. That is expected.
  - A new project slug can return 404 until `app/lab-v2/projects/[slug]/page.tsx` is touched, by timestamp only.
- **Not in Git:** captures (`docs/**/*.png`) are ignored and must be regenerated with the probes. The Koreez audit isn't in Git either (§3).
- **Then:** start with §5, the RTX 4060 verification. Don't begin the Wallpapers or Koreez pages without the inputs listed above.
