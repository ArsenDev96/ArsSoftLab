# M1.4L.6A — AZIZ content and media audit

This is research and content planning only. The page is not implemented. No application code changed, the AZIZ repository is untouched, no screenshots were copied into ArsSoftLab, and nothing was committed.

- **ArsSoftLab:** `feat/lab-v2` at `c99d7b9`.
- **AZIZ source:** `ArsenDev96/aziz`, `main` at `aa691b0` ("Android build 9", 10 Oct 2026).
- **Google Play:** `am.aziz.party`, the public listing as seen on 27 Nov 2026.
- **Audited:** 27 November 2026.
- **Updated:** the same day, with the owner's content decisions, a check of the proposed Overview, a capture checklist, and the M1.4L.6B plan (§0, §7, §8.5, §10).

## 0. Owner content decisions (final preparation)

| Field | Decision | Evidence and notes |
|---|---|---|
| Role | Creator & Mobile Engineer | All commits are by the owner; there is no backend (§1) |
| Category | Mobile Game / Party Game | Play category "Casual"; the store copy calls it party games **[Play]** |
| Status | Publicly available on Google Play | A public listing with Install, version 1.0.0 (§4). The track and live versionCode are still confirmable only in Play Console. |
| Google Play URL | https://play.google.com/store/apps/details?id=am.aziz.party | Returns 200 when signed out **[Play]** |
| Platforms | Android | §1 |
| Languages | Armenian · English | `src/locales`, the decks **[Source]**. The Armenian is Eastern orthography. The fact reads "Armenian", as the owner chose; AriMap's page says "Eastern Armenian". |
| Modes | Wrong Answer Only, Same Answer, Act It! | All implemented (§3) |
| GitHub link | None yet | The repository is public, but not linked (§9) |
| Statistics | No download, rating or playtesting figures | §4, §9 |
| Related project | AriMap | §7 |
| Screenshots | Five fresh captures from the current build preferred. Outdated captures only if clearly identified. | §8.5 |
| Tagline (approved working) | "Three party games. One phone. Endless wrong answers, matching minds and funny performances." | Checked in §7.1 |
| Overview | Five paragraphs supplied by the owner. **Proposed, pending approval.** | Checked in §7.2 |

## How claims are marked

| Mark | Meaning |
|---|---|
| **[Source]** | Verified in the `aziz` source at `aa691b0` |
| **[Play]** | Seen on the public Google Play listing, viewed signed out, on 27 Nov 2026 |
| **[Record]** | Stated in the repository's documents and not re-checked in code |
| **[Unverified]** | No supporting evidence: kept out of public copy |

**The README is partly out of date.**

- It still says "Phase 4 — first playable prototype … deliberately unpolished" and "Version 1.0.0, versionCode 1".
- `app.json` is at versionCode 9, and the app is listed on Google Play.
- `docs/PLAYTEST.md` still uses the retired 2.5 / 3 / 3.5 s timer values.

The code and the Play listing take precedence.

## Summary

- **AZIZ** is an offline, pass-the-phone party game for Android, built with Expo SDK 57 and React Native 0.86. It has **three implemented modes**: Wrong Answer Only, Same Answer and Act It!.
- **Content:** each mode has **200 items in Armenian and in English**, paired by id. There is no account, backend, analytics or ads.
- **Google Play:** a **public listing** for **version 1.0.0**, "Updated on Oct 10, 2026" (the same day as "Android build 9"). Data safety says "No data collected" and "No data shared". The listing shows no early-access or testing label to a signed-out visitor.
  - That points to a production release.
  - **Which track is live, and which versionCode, can only be confirmed in Play Console** (§4).
- **Strongest story:** a social game for people in the same room, with bilingual decks designed as content, and rules kept in pure, unit-tested game engines.
- **Screenshots:**
  - real, unframed captures exist: 12 portrait screens, six in each language;
  - they were taken at **versionCode 1** on 21 Sep 2026, before the app's typeface, Home and turn-screen changes;
  - **fresh captures from the current build are recommended** (§8).
- **The page fits the existing template unchanged.** The phone screenshots would use AriMap's five-across row.

---

## 1. Verified project facts and sources

| Fact | Value | Source |
|---|---|---|
| Repository | `github.com/ArsenDev96/aziz`, public (the anonymous GitHub API returns 200). Single branch `main`, 33 commits, 2026-09-16 to 2026-10-10. All commits are by the owner (`Ars`). | git, GitHub API |
| Local checkout | None on this computer. Read-only clone in the session scratchpad; no install, nothing executed. | — |
| Name history | Renamed "ARA!" to "AZIZ" on 2026-09-16 (`5af0bc6`). | git |
| Package | `am.aziz.party`, version 1.0.0, Android versionCode 9 | `app.json` |
| Platform | Android. `app.json` has an iOS section, but there is no iOS build, store listing or documentation. | `app.json`, `eas.json`, Play listing |
| Languages | Armenian (default, Eastern Armenian orthography) and English, switchable at any time | `src/locales`, Play listing |
| Players | 2–8. The team modes need 4–8 players in 2–4 teams of at least 2. | `docs/RULES.md`, rules files |
| Network and data | Offline; no account, backend, analytics, ads or crash reporting. On-device storage only: settings, player roster and teams. | `play-console-answers.md` **[Record]**; `src/lib/storage.ts` **[Source]**; Data safety **[Play]** |
| Permissions | `INTERNET`, `VIBRATE`. `SYSTEM_ALERT_WINDOW` and storage permissions are blocked. | `app.json` **[Source]**; merged manifest per `play-console-answers.md` **[Record]** |
| Play listing | Title "AZIZ", category Casual, "Rated for 3+", version 1.0.0, updated Oct 10, 2026, Armenian description | **[Play]** |
| Repository `LICENSE` | The Expo template's MIT licence ("650 Industries, Inc."), not one written for AZIZ | `LICENSE` |
| Fonts | Noto Sans Armenian (400/700/800/900), SIL Open Font License, bundled at build time | `assets/fonts/OFL.txt`, `app.json` |
| Playtest | `docs/PLAYTEST.md` is a **plan only**. No playtest results are recorded. | `docs/PLAYTEST.md` |

**Not used anywhere in public copy:** the listing's download count, and ratings or reviews (none are visible).

---

## 2. Current application architecture

**[Source]**

- **Expo SDK 57, React Native 0.86.3, React 19.2, TypeScript ~6.0.** Navigation is Expo Router with typed routes. Animation uses React Native Reanimated 4.5. Device features use `expo-haptics` and `expo-keep-awake`. Storage is AsyncStorage.
- **Screens** (`app/`):
  - Home, first-run language choice, Settings (language and vibration), Players;
  - for each mode: setup (team modes), intro and rules, one `play` route that holds every in-game state, and results.
  
  The README explains the single play route: a route per turn would push about 15 screens onto the stack in one game.
- **Pure game engines** (`src/modes/<mode>/engine.ts`): no React, storage or Expo imports; state in, state out. Rule numbers are kept separately in `rules.ts` and documented in `docs/RULES.md`. `AGENTS.md` makes gameplay numbers the product owner's decision.
- **Content** (`src/content/<mode>/{en,hy}.ts`): typed decks paired by id across languages.
- **Locales** (`src/locales`): every visible string is in `hy.ts` and `en.ts`. `armenian.ts` adds the Armenian definite article to player names (for example «Անին գուշակում է»), with Latin-script names handled separately, and is unit-tested.
- **Theme** (`src/theme/theme.ts`): all colors and sizes. The bundled font applies to every text style, so a phone's system font can't change text metrics and clip wrapped text.
- **Shared utilities:**
  - `tap-guard.ts` collapses bursts of taps on the big party buttons into one action;
  - `time.ts` keeps all timer arithmetic in whole milliseconds so half-second clocks never drift;
  - `teams.ts` validates team setup for both team modes;
  - `quit-confirm.ts` and `ConfirmDialog` confirm before leaving a game;
  - `scroll-to-new.ts` scrolls to a newly added player.
- **Persistence:** versioned keys `aziz.settings.v1`, `aziz.players.v1` and `aziz.teams.v1`. Player names are remembered ("save players", 2026-10-05).
- **Build** (`eas.json`): a `preview` internal APK and a `production` store app bundle. The native `android/` folder is generated by `expo prebuild` and not committed.
- **Accessibility** found in code:
  - `accessibilityRole` (25 uses), `accessibilityLabel` (22) and `accessibilityState` (7);
  - live regions on the countdown, the turn timer and Same Answer's "SAY IT";
  - `hitSlop` on small controls.
  
  **Not found:** reduced-motion handling (Reanimated is used on most screens) and any font-scaling limits. No accessibility testing is recorded. Describe these measures only, without claims.

---

## 3. Game modes

All three are **implemented and in the published listing**. There are no experimental modes in the code.

| Mode | How it plays (from `docs/RULES.md` and the rules files) |
|---|---|
| **Wrong Answer Only** | 2–8 players, five questions each, in a turn order shuffled once and then strictly round-robin. A simple question appears with a **3, 3.5 or 4 second** clock (default 3, chosen before the game). The player must answer **wrong**, and the group taps PASS (+1) or FAIL (0). From the second turn the turn screen shows running scores, leader first. A tie at the top triggers **one** sudden-death round, half a second shorter (never under 2 s); there is never a second round. |
| **Same Answer** | 4–8 players in 2–4 teams, five turns per team. A prompt (for example "Name a dessert."), 5 seconds of silent thinking, then 3-2-1-SAY IT. The group taps how many teammates matched. Points are `max(matched − 1, 0)`, counting only the largest matching group. A tie at the top means joint winners. |
| **Act It!** (Ցույց տուր) | 4–8 players in 2–4 teams. One teammate guesses while the rest of the team acts without speaking. 45-second turns after 3-2-1-GO; CORRECT +1, at most 2 SKIPs per turn. The schedule (round → team → guesser) is built once, so everyone can tell whose turn is next. Cards come from one shuffled deck with no repeats for the whole game. |

**Deliberately left out** (`docs/RULES.md`; not planned features, so not mentioned on the page): skip and undo in Wrong Answer Only, custom team names, speech recognition, sensors or camera.

**Future work named in the repository:**

- "No sound yet (Phase 10)";
- "No analytics (Phase 14)";
- "Phase 6 candidates" after a playtest.

None of these is a feature. Don't present them as one.

---

## 4. Distribution and release status

| Question | Evidence | Finding |
|---|---|---|
| Is there a public listing? | `play.google.com/store/apps/details?id=am.aziz.party` returns 200 when signed out, with an Install button, "AZIZ", the Armenian description and Data safety | **Yes** **[Play]** |
| Which track? | The listing is visible to a signed-out visitor, with no "Early access" or "Unreleased" label. Closed and internal testing builds are not shown publicly. `play.google.com/apps/testing/am.aziz.party` requires sign-in. | **Production (public release) is the most likely reading.** Play Console is the only authoritative source: **owner to confirm.** |
| Version | Listing data: "1.0.0". `app.json`: 1.0.0 / versionCode 9. | 1.0.0. **The versionCode on Play is unverified** (likely 9, given the matching dates). |
| Updated | "Updated on Oct 10, 2026" | Same day as commit `aa691b0` "Android build 9" |
| Build history | Commits "Android build 3, 5, 6, 7, 8, 9" (23 Sep to 10 Oct). `release/aab/aziz-1.0.0-vc2.aab` is committed (versionCode 2). | Iterative builds; earlier tracks are not recorded |
| Testing evidence | `play-console-answers.md` covers the Data safety, content rating and target audience answers. **No tester counts, track history or test reports.** | Don't describe testing programs |
| Metrics | The listing shows a download count | **Not used** (owner decision §9) |

**Status wording (owner decision):** "Publicly available on Google Play", with release "Version 1.0.0 on Google Play". The signed-out public listing supports this wording directly. It is visible without signing in, offers Install, and carries no early-access label. The wording doesn't depend on naming a track.

**Still uncertain (Play Console only), and kept off the page:**

1. which track serves the listing (production is the likely reading);
2. which versionCode is live (probably 9, given the matching dates);
3. country availability, since the listing was viewed from one location only;
4. any staged-rollout percentage.

None of these changes the approved wording.

---

## 5. Content and localization

**[Source]** Entry counts are from the deck files. The checks are in the content tests.

| Deck | Entries per language | Categories (English) | Content tests check |
|---|---|---|---|
| Wrong Answer Only questions (`wa-001…`) | 200 hy + 200 en | general 158, food 24, funny 18 | Exactly 200; unique ids in `wa-NNN` order; every id paired across languages; no empty or repeated text; **at most 60 characters, so a question can be read within the fastest clock**; known categories; Armenian punctuation (question mark and full stop); no Armenian or Cyrillic letters in English |
| Same Answer prompts | 200 + 200 | everyday 39, food 38, objects 29, entertainment 25, places 21, animals 19, social 15, technology 9, travel 5 | Count, ids, pairing and text checks (`same-answer-content.test.ts`) |
| Act It! cards (`ai-001…ai-200`) | 200 + 200 | action 61, people 40, animal 36, sport 34, object 29 | Count, ids in order, pairing; at most 24 characters per card |

- **Armenian is the primary language:** it's the default, and the Play listing's main description is Armenian.
- **The interface** is fully translated through the locale files. `AGENTS.md` forbids hardcoded strings in screens.
- **Grammar-aware names:** player names get the Armenian definite article in sentences (`withArmenianArticle`, with tests).
- **Content suitability:** `play-console-answers.md` recommends a 13+ target audience. One generic alcohol reference and cards such as "Kissing" and "Tamada" are the reason. **[Record]**

---

## 6. Technical contributions (verified, proposed wording)

1. Built an offline, pass-the-phone party game for Android with Expo and React Native: three game modes, no account, backend or data collection.
2. Kept each mode's rules in a pure TypeScript engine, separate from the UI and from its tunable rule values, so turn order, scoring, sudden death and team schedules are covered by unit tests.
3. Designed bilingual decks of 200 questions, prompts and cards per mode, paired by id across Armenian and English. Content tests check pairing, uniqueness, punctuation and script, and that every question fits the shortest timer.
4. Built Armenian-first localization: every string translated, grammar-aware player names, and a bundled Armenian font so device fonts can't clip text.
5. Designed the interaction for a noisy table: large PASS/FAIL and CORRECT/SKIP buttons, a guard against double taps, haptic feedback, the screen kept awake during play, and a confirmation before leaving a game.
6. Kept timing exact with whole-millisecond clock arithmetic for 3, 3.5 and 4 second timers and the shorter sudden-death round.
7. Saved settings, the player roster and teams on the device, shared across the team modes.
8. Prepared the Google Play release: EAS production app bundles, a restricted permission set, Data safety answers, and bilingual store listing and privacy policy.

**Testing, as it may be stated:** "Game engines and content are covered by unit tests (Node's test runner); type checking and linting are part of the project's checks."

- 12 test files hold 207 `it`/`test` calls by static count. Some are generated in loops.
- **No recorded test run exists in the repository,** and none was run for this audit. Don't quote test counts.

**Technology stack (all verified in `package.json`):** Expo, React Native, TypeScript, Expo Router, React Native Reanimated, AsyncStorage, EAS Build. Node's test runner and ESLint are optional additions.

---

## 7. Page content: tagline, Overview check, sections

Spelling is American English. Facts are from §0–§6.

### 7.1 Tagline (approved working)

> "Three party games. One phone. Endless wrong answers, matching minds and funny performances."

| Phrase | Evidence | Verdict |
|---|---|---|
| "Three party games. One phone." | Three modes; pass-the-phone play (§3) | Supported |
| "wrong answers, matching minds and funny performances" | Wrong Answer Only, Same Answer, Act It! | Supported: one phrase per mode, in order |
| "**Endless**" | Each deck has 200 items per language. Wrong Answer Only uses at most 40 per game, with no repeats in a session. Act It! wraps after all 200 cards. | **Flag (minor): marketing hyperbole.** The content is finite. It reads as tone rather than a factual claim, so it's kept as approved; the owner may prefer "Quick wrong answers…" or "Plenty of wrong answers…". |

**Layout note for 6B:** at 87 characters the tagline is longer than the other projects' (67–71). The template caps the tagline at 30ch, so expect three lines at 1648 px and about four at 390 px. The wrap check in §10 must confirm no single-word line.

### 7.2 Proposed Overview (supplied by the owner, pending approval) and its check

The text is recorded verbatim. Nothing was changed.

1. "The best party games don't need complicated setups. They need simple rules, quick decisions and moments that get everyone involved."
2. "I created AZIZ as a collection of three party games that friends can play together using a single phone. Players take turns giving deliberately wrong answers, trying to think alike, or acting out words for their teammates."
3. "Each game has its own rules, timing and scoring system. The experience is designed for face-to-face play, with large controls, short rounds and content available in Armenian and English."
4. "From an engineering perspective, AZIZ combines independent TypeScript game engines, bilingual question decks, timed interactions and an offline-first mobile experience."
5. "AZIZ is available on Google Play for Android, with no account or internet connection required."

| ¶ | Statement | Evidence | Verdict |
|---|---|---|---|
| 1 | Party games need simple rules, quick decisions, everyone involved | Framing, not a factual claim about AZIZ | **Supported** as framing. The team modes do have a short setup (names and teams, remembered between games), which "don't need complicated setups" doesn't contradict. |
| 2 | Three games, friends, a single phone | Three modes; one-device play (§1, §3); all commits by the owner | **Supported** |
| 2 | "Players take turns giving deliberately wrong answers, trying to think alike, or acting out words for their teammates" | Wrong Answer Only is individual turns. In Same Answer, *teams* take turns and teammates answer together. In Act It!, actors mime cards such as "Doctor" for their team's guesser. | **Supported.** "Take turns" is loose for Same Answer (team turns), but acceptable. |
| 3 | "Each game has its own rules, timing and scoring system" | A separate `rules.ts` and `engine.ts` per mode. Timing: 3/3.5/4 s, then 5 s thinking, then 45 s turns. Scoring: +1 per pass; matched − 1; +1 per correct card. | **Supported** |
| 3 | "designed for face-to-face play, with large controls, short rounds" | Pass-the-phone rules; full-width PASS/FAIL and CORRECT/SKIP buttons; `tap-guard.ts` ("Big party buttons get hit twice by excited players"); clocks of 3–45 s | **Supported** |
| 3 | "content available in Armenian and English" | 200 + 200 items per mode; every interface string in both languages | **Supported** |
| 4 | "independent TypeScript game engines" | `src/modes/*/engine.ts`: pure, with no React, storage or Expo imports, one per mode | **Supported** ("independent" = framework-independent, per mode) |
| 4 | "bilingual **question** decks" | Wrong Answer Only has questions; Same Answer has prompts; Act It! has word cards | **Flag (minor):** only one of the three decks is questions. "bilingual game decks" or "bilingual question, prompt and card decks" would be exact. |
| 4 | "timed interactions" | Countdown, turn timer, millisecond arithmetic (§2) | **Supported** |
| 4 | "an **offline-first** mobile experience" | The app makes no network calls at all. No backend, sync or API (`play-console-answers.md`, README "Offline, no account, no backend"). | **Flag (wording):** "offline-first" usually means an app that works offline and syncs when online. AZIZ never connects. "a fully offline mobile experience" would be exact. |
| 5 | "available on Google Play for Android" | Public listing, version 1.0.0, Install shown when signed out (§4) | **Supported**, with §4's caveats (track, country availability) unconfirmed |
| 5 | "no account or internet connection required" | No account or login in the code. The listing says "Fully offline" and "No account or sign-up". | **Supported.** Installing from Play itself needs a connection, which is implicit. |

**Not claimed anywhere (good):** downloads, ratings, playtesting, release dates, iOS.

### 7.3 Hero fields for the page

| Field | Value |
|---|---|
| Eyebrow | Playground · Project (from the station) |
| Tagline | §7.1 |
| Status | Publicly available on Google Play |
| Release (`milestone`) | Version 1.0.0 on Google Play |
| Category | Mobile Game / Party Game |
| Role | Creator & Mobile Engineer |
| Platforms | Android |
| Languages | Armenian · English |

That is six facts, the same count as AriMap. The template aligns longer fact lists to the top.

### 7.4 Sections (existing template only)

| # | Section | Content |
|---|---|---|
| 01 | Overview | §7.2, once approved |
| 02 | **Game modes** (`sections`, `after: "overview"`, `showMedia`) | The paragraph and items below, with the five phone screenshots in a row under them, as AriMap's "Learning experience" does |
| 03 | Engineering contributions | Seven items, below |
| 04 | Technology stack | Expo · React Native · TypeScript · Expo Router · React Native Reanimated · AsyncStorage · EAS Build |
| 05 | **Testing and release** (`sections`, `after: "stack"`) | Items below |
| 06 | Links | "AZIZ on Google Play" (opens in a new tab). No GitHub link. |
| 07 | Related project | AriMap ("Open AriMap") |

**Game modes, as proposed copy.**

Paragraph: "Three games share one roster of 2 to 8 players, saved on the phone. Each has its own rules, timer and scoring, and every question, prompt and card exists in Armenian and English, 200 per game."

| Term | Text |
|---|---|
| Wrong Answer Only | "A simple question and 3 to 4 seconds to answer it wrong. The group decides PASS or FAIL; a tie at the top goes to one sudden-death round on a shorter clock." |
| Same Answer | "Teams of 2 or more think silently for five seconds, then say their answer at the same moment. The more teammates match, the more points the team scores." |
| Act It! | "One teammate guesses while the others act out the card without speaking. Each turn lasts 45 seconds, with up to two skips." |

**Engineering contributions, as proposed copy** (from §6; checked in code):

1. "Built an offline, pass-the-phone party game for Android with Expo and React Native: three game modes with no account, backend or data collection."
2. "Kept each mode's rules in a framework-independent TypeScript engine, separate from the interface and from its rule values, so turn order, scoring, sudden death and team schedules are covered by unit tests."
3. "Designed 200-item decks for each mode, paired by ID across Armenian and English, with content tests for pairing, duplicates, punctuation, script and length, so every question fits the shortest timer."
4. "Built Armenian-first localization: every string translated, grammar-aware player names and a bundled font that covers both Armenian and Latin text."
5. "Designed the interaction for a lively table: large answer buttons, a guard against accidental double taps, haptic feedback, the screen kept awake during play and confirmation before leaving a game."
6. "Kept timers exact with whole-millisecond arithmetic for 3, 3.5 and 4 second clocks and the shorter sudden-death round."
7. "Prepared the Google Play release: EAS production builds, a restricted permission set, Data safety answers, and an Armenian and English store listing and privacy policy."

**Testing and release, as proposed copy:**

| Term | Text |
|---|---|
| Tests | "The game engines, content decks, timers and team setup are covered by unit tests run with Node's test runner, alongside type checking and linting." |
| Release | "Version 1.0.0 is available on Google Play for Android. The app works fully offline, needs no account and collects no data." |
| Languages | "Armenian is the default; English can be selected at any time in Settings." |

- **No counts:** there are no test totals, no playtest results and no download figures.
- **"collects no data"** matches the Data safety section ("No data collected") **[Play]** and the code (on-device storage only).
- **Settings** contains the language switch. `app/settings.tsx` has language and vibration **[Source]**.

---

## 8. Screenshot inventory

All candidates are in the AZIZ repository. **Nothing was copied into ArsSoftLab.**

### 8.1 Raw captures (unframed): the candidates

`release/playstore/screenshots/{en,hy}/`

| # | File (`…/en/` and `…/hy/`) | Size | Shows | Suitable? |
|---|---|---|---|---|
| 01 | `playstore-{en,hy}-01-home.png` | 1080×2400 | **Home:** AZIZ logo, language chips, "Pick a game", the three mode cards, Settings | Yes, but the Home layout changed on 3 Oct (`ab04f56`) |
| 02 | `playstore-{en,hy}-02-wrong-answer.png` | 1080×2400 | **Wrong Answer Only:** "What do bees make?", "Did Narek say a wrong answer?", FAIL and PASS | Yes. The strongest gameplay image. |
| 03 | `playstore-{en,hy}-03-same-answer.png` | 1080×2400 | **Same Answer:** Team 1, "Name a dessert.", "Think of one answer. Don't say it yet!", countdown 4 | Yes |
| 04 | `playstore-{en,hy}-04-act-it-ready.png` | 1080×2400 | **Act It!** pre-turn: Round 1 of 3, Team 1, "Aram guesses / Ani and Gor act", READY | Optional |
| 05 | `playstore-{en,hy}-05-act-it-play.png` | 1080×2400 | **Act It!** live: "Doctor", a 43-second clock, Team 1: 3, Skips left: 2, SKIP and CORRECT | Yes |
| 06 | `playstore-{en,hy}-06-results.png` | 1080×2400 | **Results:** Winner Team 1, three teams with medals and points, Play again | Yes |

**Common facts:**

- **Committed:** in `2e5053f` on 2026-09-21, when `app.json` was 1.0.0 / **versionCode 1**.
- **Players:** fictional names (Narek, Aram, Ani, Gor, Mari, Lilit).
- **Device chrome:** a clean Android status bar ("12:00").
- **Not the latest implementation:**
  - **typeface:** the 25 Sep commit `c6ae8ae` switched every text style to the bundled Noto Sans Armenian, while the captures show the system font;
  - **Home** changed on 3 Oct (`ab04f56`);
  - **the Wrong Answer turn screen** gained running scores on 4 Oct (`94d9bba`). It is not among these screens, but it's a newer feature worth showing;
  - **team-setup layouts** were reworked on 1 Oct (`e260961`). They aren't among these screens.

### 8.2 Framed store images: not recommended for the page

`release/playstore/final/{en,hy}/` holds the same six screens at 1080×1920, inside a phone frame with a marketing headline (for example "Answer wrong on purpose"), committed in `2e5053f`. They are promotional assets. In the portfolio they would show a frame inside the screenshot viewer and headline text the page already covers. **Use the raw captures instead.**

### 8.3 Other assets

| File | Size | Note |
|---|---|---|
| `release/playstore/final/feature-graphic.png` / `feature-graphic2.png` | 1024×500 | Logo-only store graphic; not needed |
| `release/playstore/final/app-icon-512.png` | 512×512 | App icon; not needed |
| `release/aab/aziz-1.0.0-vc2.aab` | 69.8 MB | Build artefact, not media |

### 8.4 Rights and provenance

- **App screens:** the owner's own app, with fictional names and text-only gameplay. No third-party imagery is visible apart from the logo and the system emoji medals on Results.
- **The AZIZ logo** (a 3D yellow word mark on Home): **provenance not recorded** in the repository (`assets/branding`, added in `0f9fc9b` "show me"). It's on the public Play listing as the app's brand. **Owner to confirm** it may appear in the portfolio.
- **Fonts:** in the current build, Noto Sans Armenian (OFL), which permits this use. The old captures use the device's system font.

### 8.5 Recommendation and capture checklist (current build)

**Recommended: five fresh captures from the current build, in English, without frames.** The 21 Sep captures (versionCode 1) may be used only as a clearly labeled fallback (below).

#### Source and build

| Item | Required |
|---|---|
| Source | `ArsenDev96/aziz`, `main` at **`aa691b0`** ("Android build 9", 10 Oct 2026): version 1.0.0, versionCode 9 |
| Build, preferred | The **Google Play release** installed on an Android phone. It is the build visitors get. |
| Build, alternative | An internal APK built from `aa691b0` (`eas build --platform android --profile preview`) on a phone or emulator. Don't use Expo Go or a development build: they add a development overlay and may differ in fonts. |
| Record the build | `adb shell dumpsys package am.aziz.party` and note the `versionCode` / `versionName` line (expect `versionCode=9`, `versionName=1.0.0`). Write it in the prototype report. |
| Screen | 1080×2400 portrait, the same as the existing captures (a Pixel 6/7-class phone or a matching emulator profile) |
| Status bar | Clean and fixed if possible: Android demo mode (`adb shell settings put global sysui_demo_allowed 1`, then the `com.android.systemui.demo` broadcasts for clock 12:00, battery, network and notifications). Otherwise accept the real bar, with no notifications showing. |
| App state | Language **English** (Settings). Players: the fictional names already used in the store set (Aram, Ani, Gor, Mari, Narek, Lilit). |
| Capture | `adb exec-out screencap -p > aziz-0N-<screen>.png`: raw PNG, no frame, no headline, no editing |
| Hand-off | The five PNGs, the versionCode line and the device or emulator name. In 6B they become lossless WebP in `public/projects/aziz/`, with SHA-256 and pixel identity recorded. |

#### The five screens

| # | File | Screen and moment | Shows | Notes |
|---|---|---|---|---|
| 1 | `aziz-01-home.png` | **Home**, after launch, English | Logo, "Pick a game", the three mode cards, Settings | The current Home layout (`ab04f56`, 3 Oct). The logo needs owner OK (§8.4). |
| 2 | `aziz-02-wrong-answer.png` | **Wrong Answer Only, judge screen** on a turn after the first: question, "Did … say a wrong answer?", FAIL and PASS | The core mode | Alternative: the turn screen from turn 2 on, with running scores (`94d9bba`, 4 Oct, not in the old set). The judge screen reads best at small size. |
| 3 | `aziz-03-same-answer.png` | **Same Answer, thinking phase** | Team chip, the prompt, "Think of one answer. Don't say it yet!", countdown | A 3-team game of 2-person teams |
| 4 | `aziz-04-act-it.png` | **Act It!, live turn** | Word card, the 45 s clock mid-turn, team score, "Skips left", SKIP and CORRECT | Choose a short, clear card |
| 5 | `aziz-05-results.png` | **Results** after a team game | Winner, three teams with points and names, Play again, Home | The medals are system emoji; fine |

**Before hand-off, check each image:**

- English text only;
- the bundled font visible (the current build);
- no debug or development overlay;
- no real personal names;
- no notifications;
- portrait, 1080×2400.

#### Fallback (only if fresh captures can't be made)

Use the matching five raw English captures from `release/playstore/screenshots/en/`:

1. `playstore-en-01-home`
2. `playstore-en-02-wrong-answer`
3. `playstore-en-03-same-answer`
4. `playstore-en-05-act-it-play`
5. `playstore-en-06-results`

Identify them clearly in `mediaNotes`:

> "Screenshots: an early build of AZIZ 1.0.0 (build 1, September 2026) on Android, in English. The current version uses a different typeface and an updated home screen."

Never mix old and new captures in one row.

**Third option:** ship 6B **without screenshots**. The template supports it, as on Armat. Add the screenshots later with a data-only change.

---

## 9. Remaining owner decisions

**Settled by the owner:** role, category, status wording, Play URL, platforms, languages, modes, no GitHub link, no statistics, related project, preference for fresh screenshots, working tagline (§0).

**Still open:**

1. **Overview approval** (§7.2). Two wording points:
   - "bilingual **question** decks": Act It! has cards and Same Answer has prompts;
   - "**offline-first**": the app is fully offline.
   
   Keep, or change to the exact wording suggested there.
2. **Tagline "Endless"** (§7.1): keep as tone, or soften. Minor.
3. **Screenshots:** provide the five fresh captures (§8.5), use the labeled fallback, or ship without screenshots.
4. **Logo:** confirm the AZIZ word mark may appear in the Home screenshot (provenance not recorded in the repository).
5. **Proposed section copy** (§7.4): Game modes, the seven contributions, Testing and release.
6. **"Collects no data":** confirm this sentence. It matches Play's Data safety and the code. The app still declares `INTERNET` (from the framework) without using it.
7. **Play Console** (optional, not shown on the page): the live track, versionCode and country availability, for the record (§4).
8. **Coming soon example for the tests:** Wallpapers (recommended) or Koreez (§10.3).

---

## 10. M1.4L.6B implementation plan (smallest change)

**Data, screenshot assets and test updates only. No component, route or style changes.**

### 10.1 `data/projects.ts`

Add `projects.aziz.detail`. Keep the existing lab summary ("A party-game app designed around creative questions, unexpected answers, and group play.") unchanged.

```ts
detail: {
  tagline: "Three party games. One phone. Endless wrong answers, matching minds and funny performances.",
  overview: [/* §7.2, five paragraphs, as approved */],
  category: "Mobile Game / Party Game",
  role: "Creator & Mobile Engineer",
  status: "Publicly available on Google Play",
  milestone: "Version 1.0.0 on Google Play",
  platforms: ["Android"],
  languages: ["Armenian", "English"],
  sections: [
    { id: "modes", title: "Game modes", paragraphs: [/* §7.4 */], items: [/* three modes */], showMedia: true },
    { id: "release", title: "Testing and release", after: "stack", items: [/* §7.4 */] },
  ],
  contributions: [/* §7.4, seven */],
  stack: ["Expo", "React Native", "TypeScript", "Expo Router", "React Native Reanimated", "AsyncStorage", "EAS Build"],
  media: [/* five portrait screens, if provided (§8.5) */],
  mediaNotes: [/* source, build and versionCode, fictional player names */],
  links: [{ label: "AZIZ on Google Play", href: "https://play.google.com/store/apps/details?id=am.aziz.party" }],
  related: ["arimap"],
}
```

- **Without screenshots,** leave out `media`, `mediaNotes` and `showMedia`; Game modes then renders as text only.
- **With screenshots,** all five are portrait, so the template uses `ScreenRow` inside `ScreenshotViewer` (five across on wide screens, as on AriMap).

### 10.2 What changes automatically

- `/lab-v2/projects/aziz` exists (`projectsWithPages()`).
- The lab's Playground row shows "Open project" (`labV2ProjectPages`).
- The page's eyebrow and dot use Playground's violet accent, which `ACCENT_DOT` already defines.
- **Unchanged:**
  - **AriMap's page:** its related project is Armat, and the AZIZ → AriMap link is one-way.
  - **SQLOrbit, TableRefresh and Armat:** they don't reference AZIZ.
  - **`/`:** it never links to project pages.

### 10.3 Required navigation-test changes

Three existing scripts use **AZIZ** as the project that still shows "Coming soon". After 6B, AZIZ has a page, so each must switch to a project that still has none.

**Recommended: Wallpapers** (`?station=creative&project=wallpapers`, `data-open-row="wallpapers"`). Koreez (`?station=experience&project=koreez`) is the alternative.

| Script | Lines today | Change |
|---|---|---|
| `docs/m1.4l/work/arimap-nav.mjs` | §1 comment (line 23); lab deep link and check (lines 33–36); status list (line 105: `["/lab-v2/projects/aziz", 404]`) | Use Wallpapers for "Coming soon"; `/lab-v2/projects/aziz` → **200**; add `["/lab-v2/projects/wallpapers", 404]` |
| `docs/m1.4l/work/tablerefresh-nav.mjs` | §1 comment (line 27); lines 36–39; status list (line 141) | Same |
| `docs/m1.4l/work/armat-nav.mjs` | §1 comment (line 31); lines 41–44; status list (line 174, which already has `wallpapers` 404) | Use Wallpapers for "Coming soon"; `/lab-v2/projects/aziz` → **200** |

- `detail-capture.mjs` and `detail-room.mjs` capture lab panels for AZIZ and are unaffected.
- The homepage checks in all three scripts stay as they are.

### 10.4 Verification (focused, as for Armat)

1. TypeScript.
2. A new **`aziz-nav.mjs`:**
   - the lab deep link `?station=playground&project=aziz`, with Open project linking to the page;
   - the round trip without a reload; Back to the lab with AZIZ selected;
   - browser Back and Forward;
   - content: facts, section order, Overview, no GitHub link, no statistics;
   - the Play link opens in a new tab and is announced;
   - AZIZ → AriMap is client-side, with history;
   - view parameters (`render`, `floor`);
   - 404s for Wallpapers, Koreez, an unknown slug and `/projects/aziz`;
   - keyboard focus with a visible ring;
   - reduced motion;
   - `/` still showing "Coming soon";
   - no console errors.
3. **Screenshots (if present):** five images load with alt text and their own proportions; the viewer opens, steps through and closes (an AriMap-style viewer check).
4. **Layout** at 1648, 1366, 1024, 768, 390 and 320 px: no overflow, six facts inside the panel, the tagline with no single-word line (§7.1), the row layout, page text at least 11 px, full-page captures at 1648 and 390.
5. **The updated** `arimap-nav.mjs`, `tablerefresh-nav.mjs` and `armat-nav.mjs`.
6. **Markup baselines before and after:**
   - **byte-identical:** `/`, `/?station=playground&project=aziz`, the other station variants, and the four existing project pages, AriMap included.
7. No GPU or animation suites, and no full regression.

### 10.5 Report and limits

- `docs/m1.4l/AZIZ-PROTOTYPE.md`, with the screenshot provenance (build, versionCode, device, SHA-256). No commit until approved.
- **Out of scope:**
  - changes to the `aziz` repository: README drift, the template `LICENSE`, `PLAYTEST.md` timer values;
  - framed store images;
  - new artwork;
  - download, rating or playtest figures;
  - a GitHub link.

---

## Appendix — evidence and re-running

All files are in the temporary session scratchpad:
`C:\Users\user\AppData\Local\Temp\claude\2856d551c7c34243\dc73d0a6-3f9f-44d7-a853-b4e29934bb06\scratchpad\aziz\`

| Path | Contents |
|---|---|
| `src/` | Read-only clone of `ArsenDev96/aziz` at `aa691b0` |
| `play/play-en.html`, `play-hy.html` | The public Play listing (signed out) |
| `play/testing.html` | The testing-program page, which redirected to Google sign-in |

To reproduce:

```
git clone https://github.com/ArsenDev96/aziz.git
git -C aziz checkout aa691b0
```

Then read the files cited above; no install is needed. Content counts come from `grep -c "id:"` on each deck file. Image sizes and commit dates come from the PNG headers and `git log -- <file>`.
