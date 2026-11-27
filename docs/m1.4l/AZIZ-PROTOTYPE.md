# M1.4L.6B — AZIZ project case study (prototype)

**Route:** `/lab-v2/projects/aziz`. The page is built on the existing `ProjectDetail` template, entirely from data, and has no screenshots yet.

- **Branch:** `feat/lab-v2`, starting from `c99d7b9`.
- **Status:** not committed or pushed.
- **Facts:** from [AZIZ-CONTENT-AUDIT.md](AZIZ-CONTENT-AUDIT.md): the `ArsenDev96/aziz` source at `aa691b0` ("Android build 9") and the public Google Play listing, both checked on 27 Nov 2026.

## Summary

- **Data only.** AZIZ's page is one `detail` entry in `data/projects.ts`. No component, route, style or homepage file changed.
- **Looks complete without screenshots.**
  - It has the hero with six facts and seven numbered sections.
  - Because there is no media, the template leaves out the screenshot section and viewer.
- **Links within `/lab-v2` only:**
  - the lab's Open project link for AZIZ goes to the page;
  - `/` still shows "Coming soon";
  - the markup of `/` and its station variants, and of SQLOrbit, AriMap (default and Lite), TableRefresh and Armat, is **byte-identical** to before.
- **Navigation tests:** the AriMap, TableRefresh and Armat scripts now use **Wallpapers** as the project without a page, and expect `/lab-v2/projects/aziz` to return 200.
- **Verification:**

  | Check | Result |
  |---|---|
  | TypeScript | passes |
  | AZIZ navigation and content | 53/53 |
  | AriMap navigation | 30/30 |
  | TableRefresh navigation | 41/41 |
  | Armat navigation | 52/52 |
  | Layout at 1648, 390 and 320 px | 23/23 |

  There is no horizontal overflow and there are no console errors anywhere. One layout observation, a single-word tagline line at 320 px, is template-wide (§5).

## 1. Approved content decisions

| Field | Value on the page |
|---|---|
| Eyebrow | Playground · Project (violet station dot) |
| Title | AZIZ |
| Tagline | "Three party games. One phone. A lot of unexpected answers." |
| Status | Available on Google Play |
| Release | Version 1.0.0 on Google Play |
| Category | Mobile Game / Party Game |
| Role | Creator & Mobile Engineer |
| Platforms | Android |
| Languages | Armenian · English |
| Overview | The five approved paragraphs, verbatim, including "bilingual game decks" and "a fully offline mobile experience" |
| Link | "AZIZ on Google Play": https://play.google.com/store/apps/details?id=am.aziz.party (new tab, announced) |
| Related | AriMap ("Open AriMap") |

**Excluded, as decided:**

- the GitHub link;
- download, rating, review, playtest and adoption figures;
- screenshots, including the September captures;
- the AZIZ logo as a standalone asset;
- claims about the Play track, versionCode or country availability;
- broad data-collection statements. The page says only that gameplay needs no account or internet connection.

**Spelling:** American English throughout, checked by the navigation script.

**Sections, in page order:**

1. Overview
2. Game modes
3. Engineering contributions
4. Technology stack
5. Testing and release
6. Links
7. Related project

The hero and facts come before them.

## 2. Files

| File | Change |
|---|---|
| `data/projects.ts` | `projects.aziz.detail` added (about 85 lines). The lab summary is unchanged. |
| `docs/m1.4l/work/aziz-nav.mjs` | New: route, content and navigation check |
| `docs/m1.4l/work/aziz-layout.mjs` | New: layout at 1648×928, 390×844 and 320×640, plus full-page captures |
| `docs/m1.4l/work/arimap-nav.mjs`, `tablerefresh-nav.mjs`, `armat-nav.mjs` | "Coming soon" example AZIZ → **Wallpapers** (`?station=creative&project=wallpapers`). `/lab-v2/projects/aziz` 404 → **200**. `/lab-v2/projects/wallpapers` 404 added where it was missing. Comments updated. |
| `docs/m1.4l/work/results/aziz-nav.txt`, `aziz-layout.txt`, `aziz-layout.json` | New results |
| `docs/m1.4l/work/results/arimap-nav.txt`, `tablerefresh-nav.txt`, `armat-nav.txt` | Re-run results |
| `docs/m1.4l/work/captures/aziz-page-*.png` | Captures for review. Git ignores them (`docs/**/*.png`). |
| `docs/m1.4l/AZIZ-CONTENT-AUDIT.md` | From M1.4L.6A, unchanged here and still not committed |

**What changed automatically through the data:**

- `projectsWithPages()` serves the route.
- `labV2ProjectPages` turns on the lab's Open project link.
- `ACCENT_DOT.violet` colors the eyebrow.

`ProjectDetail.tsx`, `ScreenshotViewer.tsx` and `app/` are unchanged. The dev server needed the usual timestamp touch of `app/lab-v2/projects/[slug]/page.tsx` before serving the new slug; the file's content is unchanged.

## 3. Verified gameplay and engineering facts behind the page

| Page text | Evidence in `aziz` at `aa691b0` |
|---|---|
| Shared roster of 2 to 8 players; 200 entries per game in Armenian and English | `WRONG_ANSWER_RULES` 2–8; `aziz.players.v1`; `grep -c "id:"`: 200 in each of the six deck files |
| Wrong Answer Only: five questions each; a 3, 3.5 or 4 second clock; Pass or Fail; one sudden-death round half a second shorter | `questionsPerPlayer: 5`, `TIMER_OPTIONS = [3, 3.5, 4]`, `passPoints: 1`, `failPoints: 0`, `suddenDeathTimerOffsetSeconds: 0.5`, `minSuddenDeathTimerSeconds: 2`; `docs/RULES.md` ("exactly one round") |
| Same Answer: 4–8 players in 2–4 teams; five seconds of silent thinking; only the largest matching group counts, scoring one less than its size | `SAME_ANSWER_RULES` (`minPlayers 4`, `maxTeams 4`, `thinkSeconds: 5`); `docs/RULES.md` (`max(matched − 1, 0)`, "Only the largest group … counts") |
| Act It!: one guesser, actors silent, 45-second turns, a point per correct card, up to two skips | `ACT_IT_RULES` (`turnSeconds: 45`, `correctPoints: 1`, `maxSkipsPerTurn: 2`); `docs/RULES.md` |
| Separate, framework-independent engines with the rule values kept apart | `src/modes/*/engine.ts` (no React, storage or Expo imports; required by `AGENTS.md`); `rules.ts` per mode |
| Paired decks; translated interface; player names inflected in Armenian | `src/content/*/{en,hy}.ts` paired by id; `src/locales`; `src/locales/armenian.ts` (`withArmenianArticle`) and its test |
| Fully offline; no account or backend; settings, players and teams saved on the device | README ("Offline, no account, no backend"); `STORAGE_KEYS` (`settings`, `players`, `teams`, all `.v1`) |
| Double-tap guard; whole-millisecond timers; screen kept awake | `src/lib/tap-guard.ts`, `src/lib/time.ts`, `useKeepAwake` (6 uses) |
| Large buttons, haptics, a bundled font device fonts can't override, confirmation before leaving | The play screens; `expo-haptics`; `theme.ts` (Noto Sans Armenian, bundled via `expo-font`); `quit-confirm.ts` and `ConfirmDialog` |
| Unit tests: engines, timers, team setup, all six decks; type checking and linting | `tests/*.test.ts` (12 files); `package.json` (`node --import tsx --test`, `tsc --noEmit`, `expo lint`) |
| Content tests: 200 entries, an English twin per Armenian entry, non-empty, unique, short enough to read | `content.test.ts`, `same-answer-content.test.ts`, `act-it-content.test.ts` (`DECK_SIZE`, twin checks, empty and duplicate checks, `MAX_TEXT_LENGTH` 60 / 24) |
| Stack: Expo, React Native, TypeScript, Expo Router, React Native Reanimated, AsyncStorage, EAS Build | `package.json` and `package-lock.json`; `eas.json` |
| Version 1.0.0, publicly available on Google Play | The public listing viewed signed out: Install shown, "1.0.0", no early-access label (audit §4) |

**Not claimed:**

- test results (no run is recorded in the repository, and none was run);
- playtest outcomes (`docs/PLAYTEST.md` is a plan);
- the Play track, versionCode or countries;
- data-collection details;
- online play;
- iOS.

**On the contributions:** the seven follow the brief's priority order (engines, timing and scoring, bilingual content, offline, interaction reliability, mobile UI, automated validation). The audit's release-preparation item moved into the "Testing and release" section.

## 4. Navigation results

`BASE=http://localhost:3000` (Next.js 16 dev server), default headless Chrome at 1648×928. Results are in `work/results/`.

### 4.1 `aziz-nav.mjs`: 53 passed, 0 failed

1. **Lab:**
   - the deep link `?station=playground&project=aziz` gives Open project linking to `/lab-v2/projects/aziz`;
   - AriMap still links to its own page;
   - Wallpapers keeps the disabled "Coming soon".
2. **Round trip:**
   - client-side navigation (a window marker survives);
   - title "AZIZ — Lab v2 (experimental)", `noindex`;
   - no lab scene mounted, and the page scrolls;
   - Back to the lab returns to `?station=playground&project=aziz` with AZIZ selected, without a reload.
3. **Content:**
   - the tagline; the eyebrow with its violet dot; the six facts in order; the section order;
   - the five Overview paragraphs, character for character;
   - seven contributions; the stack list; all six section terms;
   - the three mode descriptions (wrong on purpose, Pass or Fail, sudden death, the 3/3.5/4 s clock; the largest matching group scoring one less than its size; acting without speaking, 45 seconds, two skips);
   - the exact Release sentence;
   - 0 images and no viewer.
4. **Exclusions:**
   - none of: downloads, installs, ratings, reviews, stars, users, playtests, production track, versionCode, countries, online multiplayer, data-collection wording, iOS, GitHub;
   - no repository link;
   - no British spellings.
5. **Google Play link:** the verified URL, in a new tab, announced.
6. **Browser history from the lab:** Back restores Playground and AZIZ; Forward returns to the page; further Back walks the lab's own history to `?station=playground`.
7. **AZIZ → AriMap:**
   - the card shows AriMap's summary;
   - the navigation is client-side;
   - **AriMap's page is unchanged:** it still relates to Armat and has no AZIZ link;
   - Back, Forward and Back work without a reload.
8. **View parameters:** `render=lite`, `render=lite&floor=original` and `floor=approved` are kept into the page, back to the lab, in the navigation and on the AriMap card.
9. **Status codes and view values:**
   - AZIZ, AriMap, Armat, SQLOrbit and TableRefresh return 200;
   - Wallpapers, Koreez, an unknown slug and `/projects/aziz` return 404;
   - unknown view values are dropped.
10. **Keyboard:** Tab reaches the skip link, Back to the lab, "AZIZ on Google Play (opens in a new tab)" and Open AriMap, each with a visible ring.
11. **Reduced motion:** no animations, and link transitions are 0 s.
12. **`/`:** `?station=playground&project=aziz` still shows AZIZ's disabled "Coming soon"; there are no project-page links; the header navigation is unchanged.
13. **Console:** no errors or exceptions.

### 4.2 Affected scripts

| Script | Result | What changed |
|---|---|---|
| `arimap-nav.mjs` | **30 passed, 0 failed** (was 29) | "Coming soon" uses Wallpapers; AZIZ returns 200; Wallpapers 404 added |
| `tablerefresh-nav.mjs` | **41 passed, 0 failed** (was 40) | Same |
| `armat-nav.mjs` | **52 passed, 0 failed** | "Coming soon" uses Wallpapers; AZIZ 404 → 200 (it already checked Wallpapers) |

All history, deep-link, view-parameter, keyboard and homepage checks in these scripts are unchanged and pass.

### 4.3 Markup baselines (unchanged pages)

The server markup was compared before and after the change, from `<body` to the first `<script>`. The "before" set was captured twice and was stable.

All nine URLs are **byte-identical**:

- `/`
- `/?station=playground&project=aziz`
- `/?station=educational&project=armat`
- `/?station=engineering&project=tablerefresh`
- `/lab-v2/projects/arimap`
- `/lab-v2/projects/armat`
- `/lab-v2/projects/tablerefresh`
- `/lab-v2/projects/sqlorbit`
- `/lab-v2/projects/arimap?render=lite`

## 5. Responsive layout findings

`aziz-layout.mjs`: **23 passed, 0 failed.**

| Size | Overflow | Header | Facts | Tagline | Smallest page text | Console |
|---|---|---|---|---|---|---|
| 1648×928 | none (1648/1648) | site | 6, each on one line, inside the panel | 2 lines: "Three party games. One phone. A lot of / unexpected answers." | 11.5 px | clean |
| 390×844 | none | compact | 6, one line each | 2 lines: "Three party games. One phone. A lot / of unexpected answers." | 11.5 px | clean |
| 320×640 | none | compact | 6, one line each | 3 lines; "answers." alone on the last line (observation) | 11.5 px | clean |

- **Sections:** all seven in order at every size. The page scrolls, with no lab scene and no images.
- **Shared site header:** it is reported separately, as for Armat. Its "Software Engineer" label is 11.33 px at desktop and 10 px on phones, the same on every project page.
- **The 320 px tagline is template-wide.** The template caps taglines at 30ch. At 320 px, SQLOrbit ("… / applications.") and Armat ("… / languages.") also end on a single word; AriMap and TableRefresh don't. All five wrap with no single-word line at 390 px.
  - The first layout run checked the rule at 320 px as well and failed there.
  - The rule is now checked at 1648 and 390, as for Armat, and the 320 px result is recorded as a `NOTE` in `aziz-layout.txt`.
  - A template-wide fix, such as `text-wrap: pretty` on the tagline, would change every project page, so it is left for a separate decision.

**Visual review:**

- **Captures** in `docs/m1.4l/work/captures/`:
  - `aziz-page-1648x928.png` (full page, 1648×4207);
  - `aziz-page-390x844.png` (390×6033);
  - `aziz-page-320x640.png` (320×6771);
  - and `-fold.png` first-screen versions.
- **Consistency:** the page matches the other four case studies.
- **Without screenshots:** Game modes reads as a short text section with three terms. The page moves from Testing and release to Links and Related, and looks complete.
- **On phones:** the facts panel sits under the tagline, and section items stack with the term above the text.

## 6. Missing authentic screenshots and capture requirements

**No screenshots are used.** The September captures (versionCode 1) are outdated: they show the old typeface and Home layout. The AZIZ logo isn't used as a standalone asset either, because its provenance isn't recorded. No new images were captured, generated or copied.

**For a later data-only addition, capture these five screens** from the **current build**: versionCode 9 (`aa691b0`), or the verified Play-installed 1.0.0. Record the versionCode with `adb shell dumpsys package am.aziz.party`.

1. **Home:** the three mode cards, Settings.
2. **Wrong Answer Only, judge screen:** question, "Did … say a wrong answer?", FAIL and PASS.
3. **Same Answer, thinking phase:** team chip, prompt, countdown.
4. **Act It! during a turn:** card, the 45 s clock, team score, skips left, SKIP and CORRECT.
5. **Results:** winner and team standings.

**Capture details** (from audit §8.5):

- English;
- 1080×2400 portrait;
- raw `adb exec-out screencap -p`, with no frame or headline;
- a clean status bar;
- fictional player names;
- no development overlay.

The Home screen includes the logo, which needs the owner's provenance confirmation first.

**Adding them later:**

- add `media` (five portrait items with alt text) and `mediaNotes` (build and versionCode, fictional names);
- add `showMedia: true` to the `modes` section;
- then the template's `ScreenRow` and `ScreenshotViewer` show them five across under Game modes, as on AriMap;
- convert losslessly to WebP in `public/projects/aziz/`, with SHA-256 recorded.

## 7. Remaining publication limitations

- **Google Play:** public availability is inferred from the signed-out public listing. The track, the live versionCode, country availability and any staged rollout are confirmable only in Play Console and are not stated on the page.
- **Testing:** the repository records no test or playtest results, so the page describes what the tests cover, not their outcomes. They weren't run for this milestone (read-only audit; no install).
- **Screenshots** wait for current-build captures (§6), and the logo's provenance is still unrecorded.
- **Browsers:** checked in headless Chrome only, against the dev server; no production build, Safari or Firefox.
- **320 px tagline widow:** template-wide (§5).
- **The `aziz` repository** (out of scope): the README is out of date, the `LICENSE` is the Expo template, and `PLAYTEST.md` has old timer values. No GitHub link is shown.

## 8. Re-running

```
# from docs/m1.4l/work, with the dev server on :3000
BASE=http://localhost:3000 node aziz-nav.mjs
BASE=http://localhost:3000 node aziz-layout.mjs
BASE=http://localhost:3000 node arimap-nav.mjs
BASE=http://localhost:3000 node tablerefresh-nav.mjs
BASE=http://localhost:3000 node armat-nav.mjs
npx tsc --noEmit -p .   # from the repository root
```

If a newly added slug returns 404 on the dev server, touch `app/lab-v2/projects/[slug]/page.tsx` once.
