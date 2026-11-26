# M1.4L.3A: AriMap content and media audit

**Audit and content planning only.**
- No application code, data or artwork was changed in ArsSoftLab.
- The AriMap repositories were only read: no file changed, nothing built or run.
- No screenshots were copied or generated. `.env` files were not opened.
- Internal test-build download links in AriMap's docs are deliberately left out of this record.

**Sources:**

| Source | Detail |
|---|---|
| ArsSoftLab | at `b4eeeb8` |
| `E:\arimap` | AriMap's main checkout, branch `mobile`, last commit 2026-11-07 |
| `E:\arimap-m1` | a worktree, branch `skia/m1-foundation`, last commit 2026-11-20 |
| `E:\arimap-skia` | a worktree, branch `spike/skia-renderer` |
| `E:\arimap-builds` | build artefacts (file names only) |
| `E:\arimap\screenshots` | captures, not tracked by Git |

In what follows, `docs/…` and `README.md` mean `E:\arimap\…` unless marked **m1**. Each fact gives its source as `file:line`. I opened the decisive lines myself; the rest come from two read-only research passes over the docs and were spot-checked.

---

## 1. Verified project facts

| Fact | Status | Source |
|---|---|---|
| "A mobile-first geography learning game in English and Eastern Armenian." | Verified | `README.md:5` |
| Tagline "Discover the world." / «Բացահայտիր աշխարհը» | Verified. The repo itself flags it because only Europe is playable | `README.md:3`; `docs/PLAY_STORE.md:329` |
| **Europe: 12 levels of 5 countries, all playable**, each unlocked by finishing the one before | Verified (implemented) | `README.md:5-20, 120` |
| Asia, Africa, North America and South America are "coming soon" | Planned, not built | `README.md:5, 24` |
| Two apps share one framework-independent core (`src/core`, `src/geo`, `src/data`): a **website** (Next.js) and an **Android app** (Expo / React Native) | Verified | `README.md:45, 75`; `docs/MOBILE.md:3` |
| Android app 1.0.0 (`world.arimap.app`, versionCode 2): **production bundle built and verified, never uploaded** | Verified | `docs/PLAY_STORE.md:4-5`; `docs/PLAY_CONSOLE.md:3, 126, 138` |
| **Not on Google Play** in any track: "Nothing has been entered in Play Console or uploaded." | Verified, not released | `docs/PLAY_CONSOLE.md:3` |
| Blockers to a store release: privacy page approval and publication; "Illustration usage rights remain unresolved"; feature graphic approval; possibly a 14-day closed test with 12 testers (personal account); the developer's sign-off | Verified as open | `docs/PLAY_CONSOLE.md:108-122` |
| Website domain **https://arimap.world**, canonical since 2026-10-18 | Stated in code and docs. Live status was not checked by this audit (no URL visited) | `src/core/site.ts:8`; `docs/QUICK-CHALLENGE-SHARING.md:5` |
| The website served images on 2026-11-06; its `/privacy` returned 404 | Stated in docs | `docs/ASSET_LICENSING.md:24-25`; `docs/PRIVACY.md:35` |
| The privacy policy is "not published" | Verified, open | `docs/PRIVACY.md:4` |
| Android production build: no `INTERNET` permission, no analytics, crash or ads SDKs; progress on the device only (SQLite) | Verified by build inspection | `docs/PRIVACY.md:15-20` |
| Website: Google Analytics 4 only after consent | Stated | `docs/ANALYTICS.md:3` |
| Player backend (Supabase: anonymous identity, server-scored Quick Challenge rounds, daily attempt): **dev project only**; leaderboard "prepared, not applied"; "Nothing is in production" | Verified | `docs/PLAYER-BACKEND.md:3-7` |
| Landmark artwork: forty **AI-generated stylised illustrations**; usage rights "remain unresolved for public release" | Verified, open | `README.md:161`; `docs/ASSET_LICENSING.md:10` |
| Map data, relief, forests, textures and fonts: "Clear on the record", credited in the app's About the map | Verified | `docs/ASSET_LICENSING.md:18, 196-197`; `docs/TERRAIN.md:321-336` |
| Armenian text "awaits a native speaker's review" | Verified, open | `docs/PLAY_STORE.md:117-118` |
| Declared audience 13+; the phrase "a children's geography game" (old artwork prompts) must not be used publicly | Verified | `docs/PLAY_STORE.md:242-244` |
| **Authorship:** no file names an author or role. The docs say "the developer" or "the owner". Commits are by "Ars", "ArsenDev96" and "Arsen". 159 commit messages carry a Claude co-author trailer | Facts only; the role needs the owner | git metadata; research pass |

### Hardware testing (do not overstate)

| What | Where it ran | Result | Source |
|---|---|---|---|
| Production and preview app checklists (gameplay, small countries, offline, 200% text, background/foreground, cold start 0.4–0.6 s) | **Pixel 6 emulator only** | Done on the emulator | `docs/MOBILE_PHONE_CHECKLIST.md:5` |
| Developer test plan (58 checks), personal phone test (27), map fixes (18), Quick Challenge zoom (15) | **Not run on a physical phone.** No box ticked | Open | `docs/DEVELOPER_TEST_PLAN.md:6`; `docs/PERSONAL_PHONE_TEST.md:23`; `docs/MAP_FIXES_PHONE_TEST.md:4-5`; `docs/QUICK_CHALLENGE_ZOOM_PHONE_TEST.md:5` |
| Pinch zoom, TalkBack and Switch Access on the production app | **Not done.** The emulator can't inject two fingers | Open | `docs/MOBILE_PHONE_CHECKLIST.md:18, 21-22` |
| One informal report | A real phone (preview APK): the Quick Challenge map "lagged badly" on zoom; later fixed and measured on the emulator | Observation only, never a formal test | `docs/MOBILE.md:779, 813` |
| Experimental map renderer (Skia) | **Real phone (POCO C85, Android 16)**, as a separate test app (`world.arimap.skiaspike`), 2026-11-12 to 2026-11-20 | All 12 lessons and the Quick Challenge passed scripted runs; TalkBack used by the owner on the phone; Armenian speech "To check by ear"; Switch Access "Not checked" | m1 `docs/MAP_RENDERER.md:669, 742, 1221-1226`; m1 `docs/MOBILE.md:362-417` |
| Skia renderer status | **Experimental:** "SVG is the default and the only renderer outside development and testing"; open items include rare slow frames | Not in the release | m1 `docs/MAP_RENDERER.md:7, 660, 685` |
| Website | Automated: Vitest (rules, saves, translations, map data) and Playwright (full flow on Pixel 7, 320 px phone, desktop, WebKit iPhone emulation). The web Quick Challenge phone checklist ran in Chromium's emulation; "Not yet checked: real devices, Safari" | Automated and emulated only | `README.md:59-62`; `docs/QUICK_CHALLENGE_PHONE_CHECKLIST.md:3, 62` |

## 2. Existing ArsSoftLab data

- **`data/projects.ts`:** `arimap`, name "AriMap", slug `arimap`, station `educational`. Summary: "An interactive geography-learning game built around exploration, lessons, and challenges." There is no `href` and no `detail`, so the lab shows "Coming soon" and `/lab-v2/projects/arimap` is a 404.
- **Station:** Educational, "Interactive learning experiences and tools.", which it shares with **Armat**.
- **The lab sentence is accurate**: exploration is Discover, lessons are the 12 levels, challenges are the Quick Challenge. Nothing in it needs correcting.

## 3. Draft case-study content (for owner approval)

Drafted only from the facts above. **[Owner]** marks what the repo cannot confirm. Nothing here is final copy.

- **Name:** AriMap
- **Category:** Education / Geography game *(draft)*
- **Value proposition, options:**
  1. "A bilingual geography game for learning Europe's countries on an interactive map." *(from `README.md:5` and the store draft)*
  2. "Learn the countries, capitals and landmarks of Europe on an interactive map." *(the store short description, `docs/PLAY_STORE.md:124`)*
- **Role:** **[Owner]**. Not stated anywhere. The SQLOrbit wording ("Creator and full-stack engineer") is a pattern, not a fact for AriMap.
- **Platforms:** Web (Next.js) and Android (Expo / React Native). No iOS app.
- **Status:** "In development". The Android app is built but not yet on Google Play. Whether to mention the website as live is **[Owner]** (§6).

**Overview (supplied by the owner, use verbatim):**

> Geography is often taught through lists of countries, capitals and locations. But memorizing those facts doesn't always mean understanding where places are or how they relate to one another.
>
> I created AriMap to turn geography learning into an interactive experience. Instead of only reading about places, learners explore maps, identify countries, discover their neighbors and test what they remember through short challenges.
>
> The experience combines structured lessons, map-based interactions and progression mechanics. Its Android application also supports offline learning activities, making the core experience available without a constant internet connection.
>
> From an engineering perspective, AriMap brings together interactive geographical rendering, game-state management, mobile performance and accessibility. The project is currently preparing for release, with real-device validation and publication requirements still outstanding.

**Fact check against the repository.** Every statement is supported, and none overstates the status:

| Statement | Supported by |
|---|---|
| "explore maps, identify countries, discover their neighbors … short challenges" | Discover, Find, Travel (and the Android neighbours round) and the Quick Challenge |
| "structured lessons … progression mechanics" | 12 levels, unlocking, stars |
| "Android application also supports offline learning activities" | Release build has no internet permission (`docs/PRIVACY.md:15`); the Quick Challenge is offline practice on Android (`docs/MOBILE.md:686-687`) |
| "rendering, game-state management, mobile performance and accessibility" | §3 contributions, §4 |
| "preparing for release, with real-device validation and publication requirements still outstanding" | §1, "Hardware testing"; `docs/PLAY_CONSOLE.md:108-122` |

- "I created AriMap" settles authorship in your own words. The exact **role** for the facts panel is still yours to choose (§6).
- The overview doesn't mention that AriMap is bilingual. The tagline or the Learning experience section can carry that if you want it on the page.
- Spelling is American ("memorizing", "neighbors"), as on SQLOrbit's page, while AriMap's own docs use British spelling. The rest of the page should follow the American spelling.

**Problem** *(draft)*: Learning where countries are, and how they connect, is often memorisation from static maps or lists, and rarely available in Armenian.
*(The "rarely available in Armenian" claim is **[Owner]**: the repo doesn't say it.)*

**Solution** *(draft)*: AriMap turns each set of five countries into a short sequence on a real map. Explore them, find them, then travel across their borders, in English or Eastern Armenian.
*(Close to the store draft: "explore countries, find them on the map, then travel across their borders", `docs/PLAY_STORE.md:128-129`.)*

**Learning experience and gameplay** (all implemented unless marked):

| Feature | What it does | Source |
|---|---|---|
| **Continents home** | Europe is open; the other four say "Coming soon" | `README.md:24` |
| **Discover** | Tap a country for its name, capital, a landmark and a short fact | `docs/PLAY_STORE.md:136` |
| **Find** | Five questions, one per country. Three levels of help (a clue, the area, the answer), and help marks the answer as assisted | `src/core/game/find.ts:4-5` |
| Find by description | Answer from descriptions instead of the map. **Android only**; the website doesn't have it yet | `docs/MOBILE.md:602, 624` |
| **Travel** | Cross borders from start to destination within the shortest number of crossings (worked out by breadth-first search), with Hint, Undo and Restart | `src/core/game/travel.ts:12` |
| **Results and stars** | 1 star for completing, 2 for at least 4 of 5 found first time without hints, 3 for all 5 plus a journey without help. No timers or speed bonuses; the best rating is never lowered | `README.md:132` |
| **Quick Challenge** | 15 countries in 60 seconds. Shareable result card on both apps | `docs/QUICK_CHALLENGE_CHECKPOINT.md:73`; `docs/QUICK-CHALLENGE-SHARING.md:58-64` |
| Quick Challenge, Android | Practice: offline, unlimited, never ranked | `docs/MOBILE.md:686-687` |
| Quick Challenge, website | Each round runs on the server, one free attempt a day. That backend is dev-only, so **whether it works live is unclear** | `docs/MOBILE.md:681`; `docs/PLAYER-BACKEND.md:7` |
| Neighbours round | **Android only** | `docs/MOBILE.md:746, 775` |
| **Two languages** | English and Eastern Armenian throughout; the Armenian awaits native review | `docs/MOBILE.md:254`; `docs/PLAY_STORE.md:117-118` |

**Engineering contributions** *(draft bullets; each verified in the repo; the role is still the owner's to state)*:
- Designed a framework-independent TypeScript core (lessons, game rules, progress, translations) shared by a Next.js website and a React Native Android app. Nothing about answers, scoring, stars, unlocking or saving is written twice (`README.md:75`; `docs/MOBILE.md:548-549`).
- Modelled each level as a border graph, checked automatically against the map data, with breadth-first search for the Travel budget and an audit that every journey state leaves a real choice (`docs/DATA.md:44-46`; `docs/MOBILE.md:647`).
- Built a reproducible map-data pipeline: Natural Earth to TopoJSON, one shared projection, per-level datasets loaded only when needed, and generated relief and forest layers (`docs/DATA.md:9-36, 92`; `docs/TERRAIN.md`).
- Implemented versioned, defensively validated saved progress with migrations and content revisions, so older saves keep working as levels change (`README.md:113-128, 140-144`).
- Diagnosed and reduced map rendering cost on Android. Lesson-map frames went from a median of 93–100 ms to 17.5 ms, measured on the emulator, and an experimental GPU renderer (Skia) was tested on a real phone (`docs/MOBILE.md:785, 813, 856`; m1 `docs/MAP_RENDERER.md`).
- Privacy by design: the Android release build has no internet permission and collects no data; website analytics run only after consent (`docs/PRIVACY.md:15-20`; `docs/ANALYTICS.md:3`).

**Development and release status** *(the wording to use)*: "In development. The Android app is built and tested on an emulator, and in preparation for Google Play; it is not yet published." Optionally, after the owner confirms: "The website is available at arimap.world."

Do not say:
- that it is released or available on Google Play;
- "tested on devices" for the release app;
- anything about downloads, users, ratings, leaderboards or adoption.

## 4. Technology and accessibility

**Technology** (from `package.json`, `apps/mobile/package.json`, `apps/mobile/app.json`, `docs/PLAY_STORE.md:14`):

| Area | Stack |
|---|---|
| Shared core | TypeScript (no React or DOM dependency) |
| Website | Next.js 16, React 19, d3-geo / d3-zoom, TopoJSON |
| Android | Expo SDK 58, React Native 0.88, Expo Router, expo-sqlite, react-native-svg. Android 7.0+ (`minSdk` 24), `targetSdk` 36 |
| Map data | Natural Earth (public domain), mapshaper. Relief from Mapzen Terrain Tiles, forests from ESA WorldCover (CC BY 4.0) |
| Testing | Vitest, Playwright |
| Backend (website, dev only) | Supabase |

**Stack chips** suggested for the page: TypeScript, React, Next.js, React Native, Expo, D3 (d3-geo), Natural Earth / TopoJSON. *(Choose 5–7; Supabase only if the web backend is presented, which §6 advises against for now.)*

**Accessibility, implemented:**
- **Website:**
  - every screen works at 150% and 200% text, down to a 320 px phone, and in short landscape;
  - level status in words and icons, not colour alone;
  - stars differ in shape and have one accessible description;
  - accessible names on actions;
  - visible keyboard focus;
  - reduced motion respected.
  - All covered by automated Playwright tests (`README.md:24-26, 134`; `e2e/phone-layout.spec.ts`, `e2e/flow.spec.ts`).
- **Android:**
  - no text has scaling turned off; layouts wrap and grow;
  - touch targets at least 48 dp;
  - "Remove animations" respected;
  - the timed neighbours round can be extended to ten minutes (WCAG 2.2.1);
  - Find by description gives a non-map way to answer (`docs/MOBILE.md:291-297, 602, 756`).

**Accessibility, how it was checked:**
- **Website:** automated tests and emulation.
- **Android:** the emulator, including TalkBack by injected gestures. TalkBack on a real phone covered only the experimental test build; Armenian speech is still to be checked by ear, and Switch Access was not checked (m1 `docs/MOBILE.md:362-417`).

**Known gaps** (to state honestly, or leave out of the page):
- On the website, Find and the Quick Challenge map have no non-visual way to answer (`docs/MOBILE.md:624`; `docs/QUICK_CHALLENGE_CHECKPOINT.md:95`).
- No automated accessibility audit tool is used.

## 5. Screenshot inventory

There is **no welcome or introduction screen**. The app opens on its continents home, which `README.md:24` says has no introduction, so the home screen takes that role.

**Primary set: the Android release build, English** (`E:\arimap\screenshots\play-store\v2\phone-en\`):
- captured 2026-11-05 from the 1.0.0 production build (`44a3dd92`) on the Pixel 6 emulator;
- from a fresh install, Level 1 played through without help, and a Quick Challenge as it starts: no seeded progress and no made-up scores (`docs/PLAY_STORE.md:281-292`);
- 1080 × 1920 PNG, portrait.

| # | File | Shows | Latest? | Public portfolio |
|---|---|---|---|---|
| 1 | `E:\arimap\screenshots\play-store\v2\phone-en\1-home.png` | **Home**: Quick Challenge card, world map, Europe card with progress | 1.0.0 build | **Suitable** |
| 2 | `E:\arimap\screenshots\play-store\v2\phone-en\2-discover-landmark.png` | **Discover**: Level 1's map, Luxembourg's Adolphe Bridge illustration and fact | 1.0.0 build | **Conditional:** shows an AI-generated illustration whose rights are unresolved |
| 3 | `E:\arimap\screenshots\play-store\v2\phone-en\3-find.png` | **Find**: "Find Germany", question 1 of 5, the Answer by description switch | 1.0.0 build | **Suitable** |
| 4 | `E:\arimap\screenshots\play-store\v2\phone-en\4-travel.png` | **Travel**: crossing into Belgium, border choices, Hint, Undo, Restart | 1.0.0 build | **Suitable** |
| 5 | `E:\arimap\screenshots\play-store\v2\phone-en\5-quick-challenge.png` | **Quick Challenge / the Europe map**: question 1 of 15, 58 s, score 0 | 1.0.0 build | **Suitable** |
| 6 | `E:\arimap\screenshots\play-store\v2\phone-en\6-results-3-stars.png` | **Results**: journey complete, 3 of 3 stars from real play, the route | 1.0.0 build | **Suitable** |
| 7 | `E:\arimap\screenshots\play-store\v2\phone-en\7-europe-levels.png` | **Progression**: Europe's levels, "Up next" Level 1, later levels locked, ★ 0/36 | 1.0.0 build | **Suitable** |

- **Armenian versions** of all seven are at `E:\arimap\screenshots\play-store\v2\phone-hy\` (same names and size). They are suitable once the Armenian text has had its native review.
- **The first store set** (`…\play-store\phone-en\`, 2026-11-03, eight shots) was superseded by v2: its text was cut by the footer, and three shots show the Eiffel Tower illustration (`docs/PLAY_STORE.md:281-292`). Not recommended.

**Website, desktop** (`E:\arimap\screenshots\desktop\`):
- Playwright captures at 1366 × 800, made 2026-11-03;
- the website's source changed until 2026-11-06 (illustration and content commits), so these are close to current but should be recaptured before use.

| File | Shows | Public portfolio |
|---|---|---|
| `E:\arimap\screenshots\desktop\10-find-correct.png` | Find on the desktop layout: map and "Correct! That's France." | **Suitable** |
| `E:\arimap\screenshots\desktop\13-travel-start.png` | Travel: France to the Netherlands, crossings left, border choices | **Suitable** |
| `E:\arimap\screenshots\desktop\19-results-badge.png` | Results: route, crossings, the "Without help" badge | **Suitable** (1 of 3 stars, a test state) |
| `E:\arimap\screenshots\desktop\03-discover-france.png` | Discover: France, its capital, the Eiffel Tower illustration | **Conditional:** AI illustration |
| `E:\arimap\screenshots\desktop\continents-en-new-1366x800.png` | Website home: Quick Challenge banner, world map, continent cards | **Not advised as is:** shows a **Leaderboard** button for a backend that is not live, and continent-card illustrations |
| `E:\arimap\screenshots\desktop\continents-en-europe-levels-1366x800.png` | Europe's levels with stars and progress | **Not advised:** seeded test progress and AI landmark thumbnails on every card |

**Not suitable:**
- `E:\arimap-builds\poc\…`: hundreds of 720 × 1600 phone captures from the experimental renderer, and comparison sheets. Test evidence, not the released app.
- `screenshots\small-phone\`, `webkit-phone\`, `mobile-phase*`, `phase4*`: test matrices, before-and-after pairs and debug states.
- `screenshots\play-store\*feature-graphic*-DRAFT.png`: a design draft awaiting approval.

**Credits.** Every map screenshot shows AriMap's relief and forests. AriMap credits those inside the app (`docs/TERRAIN.md:325-336`), so the portfolio page should carry a short credit line next to the images: "Map data: Natural Earth. Relief: Terrain Tiles by Mapzen. Forests: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0)."

**If fresh captures are wanted** (for example after the owner settles the illustrations): from the current Android preview build, recapture
- Home;
- Find;
- Travel;
- the Quick Challenge;
- Results;
- one website desktop Find or Travel.

## 6. Owner decisions needed

1. **Role:** your role on AriMap, in your words (for example "Creator, designer and developer"). The repo doesn't state it. Your overview says "I created AriMap"; the facts panel still needs the role wording.
2. **Value proposition:** choose or rewrite an option in §3.
3. **Status wording:** confirm "In development; not yet on Google Play".
4. **Website link:** confirm whether to link https://arimap.world. It is documented as the live domain, but this audit did not visit it, and the site's privacy page was a 404 on 2026-11-06. If linked, consider whether its Quick Challenge works live, since the backend is dev-only.
5. **AI-generated illustrations:**
   - whether screenshots showing them may appear (rights unresolved in AriMap's own records);
   - if not, use only the illustration-free shots (v2 #1, #3–#7; desktop Find, Travel and Results).
6. **Repository link:** none. `ArsenDev96/AriMap` exists, but its visibility is unknown and the brief says not to expose private repositories.
7. **AI-assisted development:** whether the case study mentions it. Many commits carry a Claude co-author trailer, and the landmark art is AI-generated. The repo states both openly.
8. **Armenian screenshots:** use them, or wait for the native review.
9. **Which hardware-testing facts to state:** recommended, "tested on an Android emulator; real-phone testing in progress", not more.
10. **Overview text:** **supplied** (§3, used verbatim).
11. **Problem and solution:** keep separate panels, or drop them, since the overview's first two paragraphs already state the problem and the approach (see below).

## 7. Recommended page structure

**Reuse the SQLOrbit template unchanged**:
- the hero, with eyebrow "Educational · Project";
- the facts panel, numbered sections, editorial grid, amber accents and dark surfaces;
- the footer and back navigation;
- the related project, **Armat**: same station, no page yet, so it links into the lab.

Proposed order:

1. **Hero:** name, value proposition. Facts: Status, Platforms, Category, Role.
2. **01 Overview:** the owner's text.
3. **02 Problem and solution:** the existing two-panel block. Optional: the supplied overview already states the problem (paragraph 1) and the approach (paragraph 2), so the panels would repeat it. Dropping them leaves "Learning experience" right after the overview.
4. **03 Learning experience:**
   - Discover, Find, Travel and Results as a short numbered sequence;
   - **three portrait phone screenshots in one row** under it: Find, Travel, Results (v2 #3, #4, #6);
   - one caption line each, plus the credit line.
   - This is the main visual. The screenshots support the text rather than forming a gallery.
5. **04 Quick Challenge:** two sentences and **one** screenshot (v2 #5) beside the text on desktop.
6. **05 Engineering contributions:** the numbered list.
7. **06 Accessibility:** a short list of what is implemented and how it was checked, including the gaps where the owner wants candour.
8. **07 Technology stack:** chips.
9. **Status note:** "Not yet on Google Play" in the facts panel, with one sentence in the overview. No separate section needed.
10. **Links:** only what the owner approves (possibly arimap.world).
11. **Related project:** Armat.

**Presenting screenshots without a gallery** (restrained, both sizes):
- **At most 4–5 images on the page**, each inside the section it illustrates.
- **Desktop:**
  - phones at a fixed display height, about 440–480 px (1080 × 1920 shown at roughly 250–270 px wide);
  - a 16–20 px radius, the page's hairline border (white at 9%), no device frame or glow;
  - three in a row within the content column.
- **Mobile:**
  - the same images two per row (about 165 px wide each), with the third under them;
  - or one row that scrolls sideways with the images snapping into place. The two-per-row grid is simpler and needs no interaction.
- **The screenshots are bright:**
  - on the dark page, keep them small, with captions in the muted text colour;
  - no amber overlays or colour treatment of the app's own palette.
- One **desktop** website screenshot (Find or Travel) is optional, to show the web platform: full content width, below the phone row or in the Accessibility or Stack section.
- **Alt text** describes what each screen shows, for example "Find: question 1 of 5 asks to find Germany on a map of western Europe."

## 8. Smallest implementation scope for M1.4L.3B

Assuming §6 is answered:

1. **Data:** add AriMap's `detail` in `data/projects.ts`:
   - tagline, overview, category, role, status;
   - problem, solution, contributions, stack;
   - related `["armat"]`.
   - The route and "Open project" in `/lab-v2` follow from it automatically (`projectsWithPages()`); the homepage stays "Coming soon".
2. **Template, three small additions** (SQLOrbit's page is unaffected while it has none of these fields):
   - **`platforms?`**: a fourth facts row.
   - **Optional extra text sections** (`sections?: { title; paragraphs?; items? }[]`), placed after Problem and solution, for "Learning experience", "Quick Challenge" and "Accessibility". Today's template has fixed sections only.
   - **Phone screenshots inside a section:** a `media` variant for portrait images (`orientation: "portrait"`) shown in the row and grid above, attached to a section, plus an optional credit line. Today's `Media` block stacks full-width figures, which suits desktop captures but would make each phone shot about 1450 px tall.
3. **Assets:** copy the approved screenshots (v2 #3, #4, #5, #6, maybe #1) into `public/projects/arimap/`, resized (about 540 px wide WebP, plus a 2× version), with alt text. That is the first time project media enters ArsSoftLab: copy only what the owner approves, and record the source paths.
4. **Checks:**
   - TypeScript;
   - `sqlorbit-nav.mjs` extended to AriMap (route, lab link, Back);
   - one 1648 × 928 and one 390 × 844 capture;
   - SQLOrbit's page unchanged;
   - `/` unchanged (`home-history-smoke.mjs`).

**Not in M1.4L.3B:**
- Armat's page;
- a project index;
- fresh AriMap captures (unless the owner wants them);
- any change to AriMap's repository.
