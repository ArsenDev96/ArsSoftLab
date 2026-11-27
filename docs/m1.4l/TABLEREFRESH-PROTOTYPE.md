# M1.4L.4B: TableRefresh project page (prototype)

**State:** implemented and checked, **not committed**. The desktop and mobile design and the screenshot viewer are approved. A final polish pass changed two lines of content; see [Final polish](#final-polish).

## Final polish

Two content changes, and nothing else. The layout, screenshots, viewer, contributions and navigation are unchanged.

| | Before | After |
|---|---|---|
| Tagline | "Keep your TablePress tables updated automatically, without losing control of your data." | "Keep TablePress tables updated without losing control of your data." |
| Testing and compatibility, **Version 1.0.1** | "Scheduling improvements for busy sites. Recorded: one full integration run, 273 tests with no failures, on WordPress 6.7, PHP 8.3 and TablePress 3.5. The other 1.0.0 checks are not yet recorded for this version." | "Version 1.0.1 has a recorded run of 273 tests, with 269 passing, 4 skipped and no failures. The broader verification documented for version 1.0.0 has not been independently confirmed for this release." (final, factually corrected wording) |

**Checks:**
- TypeScript (`npm run typecheck`): pass.
- **Tagline wrap** (`work/tablerefresh-tagline.mjs`, `results/tablerefresh-tagline.txt`): **7 of 7**. The rendered lines were read word by word:

  | Viewport | Lines |
  |---|---|
  | 1648 × 928 | "Keep TablePress tables updated without" / "losing control of your data." |
  | 390 × 844 | "Keep TablePress tables updated" / "without losing control of your data." |

  - Two balanced lines at both sizes, with no single-word line. The earlier three-line wrap ending on "data." at 1648 px is gone.
  - No horizontal overflow and no console errors.
  - Captures: `work/captures/tablerefresh-hero-{1648x928,390x844}.png`.
- The new 1.0.1 sentence is in the server markup of `/lab-v2/projects/tablerefresh`.

**Factual correction before commit:** the polish pass first said "273 passing tests". The recorded run (`dev/matrix-results.txt`, 2026-11-20 08:54 UTC) reads "Tests: 273, Assertions: 6238, Skipped: 4", with no failures, so 269 passed and 4 were skipped. The same 4 tests (the persistent-cache test) are skipped in every run in the repository. The page now says exactly that: "273 tests, with 269 passing, 4 skipped and no failures".

## Summary

- **The page:** TableRefresh has a page at **`/lab-v2/projects/tablerefresh`**, built on the SQLOrbit and AriMap template with no redesign.
- **The lab link:** in `/lab-v2`, TableRefresh's **Open project** now links to the page. On the homepage `/` it still says "Coming soon".
- **SQLOrbit's related card** now says **Open TableRefresh** and opens the page.
- **Content:**
  - the owner's approved decisions and the four approved Overview paragraphs, word for word;
  - otherwise only facts verified in `TABLEREFRESH-CONTENT-AUDIT.md`;
  - no install counts, ratings, reviews, testimonials, performance figures or GitHub link.
- **Screenshots:** the three official WordPress.org screenshots (table list, setup, edit-conflict decision).
  - Pixel-identical, lossless copies.
  - Stacked one under another, each opening in the existing `ScreenshotViewer`.
- **Unchanged:**
  - **AriMap** and **`/`**: their markup is byte-identical to baselines saved before this work;
  - **SQLOrbit**: identical except its related card.
- **Checks:**
  - TypeScript passes;
  - navigation, history and related-card checks: **39 of 39**;
  - viewer checks: **44 of 44**;
  - captures at 1648 × 928, 1366 × 768 and 390 × 844: no horizontal overflow, no console errors.

## Files

| File | Change |
|---|---|
| `data/projects.ts` | TableRefresh's `detail`. `ProjectSection.after` also accepts `"stack"` |
| `components/project/ProjectDetail.tsx` | Three small template steps (below) |
| `public/projects/tablerefresh/{tables,setup,conflict}.webp` (new) | The three screenshots |
| `docs/m1.4l/work/tablerefresh-{nav,viewer,capture}.mjs` (new) | Probes, adapted from AriMap's; results in `work/results/tablerefresh-*` |

**Not changed:**
- the route `app/lab-v2/projects/[slug]` (only its timestamp was touched, so the dev server picked up the new page);
- `lib/lab-v2-pages.ts`;
- `ScreenshotViewer.tsx`;
- the lab, `StationPanel`, Cinematic and Static Lite;
- `/` and the homepage's project data;
- the TableRefresh repository.

The route, the `/lab-v2` link and SQLOrbit's card all follow from TableRefresh now having a `detail`, through `projectsWithPages()`.

### Template steps, and why AriMap and SQLOrbit are unaffected

1. **`after: "stack"`:** an extra section can follow the Technology stack. It places "Testing and compatibility" at position 7, as the brief orders.
2. **A section with `showMedia` and no paragraphs or items** holds the screenshots as its own content, in the content column. TableRefresh uses this for its "Screenshots" section, right after "How synchronization works". AriMap's "Learning experience" section has text, so it still shows its row underneath at full width.
3. **The stacked layout (wide or mixed images)** is now `ScreenStack`, wrapped in the existing `ScreenshotViewer`:
   - each image links to its original file, marked `data-viewer-index`, with "(view full size)" for screen readers;
   - each has the numbered title and caption that `ScreenRow` uses (moved into a shared `ScreenCaption`, with identical markup).
   - No other page used the stacked layout: SQLOrbit has no media, and AriMap's screens are portrait.

The viewer itself is unchanged: the same keyboard navigation, captions, focus handling and closing behaviour.

## Page structure

1. **Hero.** Eyebrow "Engineering · Project" in Engineering's cyan; "TableRefresh"; the tagline "Keep TablePress tables updated without losing control of your data."

   | Facts row | Value |
   |---|---|
   | Status | Published |
   | Release | Version 1.0.1 on WordPress.org |
   | Category | WordPress Plugin / Developer Tools |
   | Role | Creator & Full-stack Engineer |
   | Platforms | WordPress · TablePress |

2. **01 Overview:** the four approved paragraphs, verbatim; the first as the lead.
3. **02 How synchronization works:**
   - one paragraph: an independent add-on for TablePress, not made by or affiliated with it, that requires the free TablePress plugin;
   - five terms:
     - **Source:** a CSV file or a **public** Google Sheet; private sheets and sources that need signing in are not supported;
     - **Schedule:** hourly, daily or weekly, Sync now, and WP-CLI;
     - **Update:** one way, all-or-nothing, in one database transaction; the ID, shortcode, name and options are kept;
     - **Edits in TablePress:** sync pauses until an administrator decides;
     - **Failures:** the table is left unchanged; the last 10 attempts are shown; sync pauses after 5 failures in a row.
4. **03 Screenshots:** three, stacked, each with a number, title and caption, then the source note.
5. **04 Engineering contributions:** the audit's seven items (§4).
6. **05 Technology stack:** PHP, WordPress, TablePress, WP-Cron, WP-CLI, MySQL / MariaDB, PHPUnit, Docker.
7. **06 Testing and compatibility:**
   - one paragraph on the tooling, saying that the recorded results differ between the two versions;
   - three terms:
     - **Requirements:** WordPress 6.7+, PHP 7.4+, TablePress 3.0+, MySQL or MariaDB with InnoDB. Tested with WordPress up to 7.1 and TablePress 3.0 and 3.4.1.
     - **Version 1.0.0:** the recorded release checks:
       - 251 integration tests passing on PHP 7.4 and 8.3;
       - targeted runs with TablePress 3.0, WordPress 6.7 and PHP 8.4;
       - mutation testing and an upgrade check;
       - Plugin Check with no errors;
       - the browser workflow from the release package.
     - **Version 1.0.1:** "Version 1.0.1 has a recorded run of 273 tests, with 269 passing, 4 skipped and no failures. The broader verification documented for version 1.0.0 has not been independently confirmed for this release."
8. **07 Links:** "TableRefresh on WordPress.org" → https://wordpress.org/plugins/tablerefresh/. It opens in a new tab and says so.
9. **08 Related project: SQLOrbit.** "Open SQLOrbit" → `/lab-v2/projects/sqlorbit`.
10. **Footer:** Back to the lab.

**Sources of the facts:**
- every claim traces to audit §1;
- the requirement lines are quoted from the plugin's `readme.txt` ("Requirements", "Known limitations") and its header;
- the test figures come from `dev/release-checks/rc6-results/focused-verification.txt` and `dev/matrix-results.txt` (the 2026-11-20 08:54 UTC entry). Both were re-read for this milestone.

**Not used:**
- the Problem and solution panels (not in the approved structure; "How synchronization works" covers them);
- milestone dates;
- the audit's draft tagline.

## Screenshots: exact sources

**Source:** `D:\tableRefresh\release\wordpress-org-assets\`, byte-identical to the live WordPress.org listing (audit §5).

**Processing:**
- converted to **lossless WebP** at their own size, so the content and proportions are unchanged;
- decoding each WebP gives exactly the source PNG's pixels (checked).

| # | Title / caption | Source | Source SHA-256 | Copy | WebP SHA-256 | Size |
|---|---|---|---|---|---|---|
| 01 | **Tables:** "Every synchronized table with its schedule and last result." | `screenshot-1.png` (1280 × 900) | `db5910b0f3ef19e8f81bd4025626e959eaa217b17c7b1515c4437d9e1975f746` | `public/projects/tablerefresh/tables.webp` | `6086ceba446ebdb60c9be787345022a94ee24258250727142f3aed15022dfa45` | 22 KB |
| 02 | **Setup:** "Choose a table, paste a CSV or Google Sheets link, and choose how often to sync." | `screenshot-2.png` (1280 × 900) | `ec272136ecd1b40b47faf9b49ab97c60695670395effc6c65e4d3465cb319145` | `…/setup.webp` | `0137b4bcd34871d25ba3238c8a594885751e886160fd8ad68d998b550b7f7168` | 31 KB |
| 03 | **Edit conflict:** "A table changed in TablePress waits for a decision instead of being overwritten." | `screenshot-4.png` (1280 × 1664) | `ded775c5c0e56aeaa67f345520afbd5ea8c5bd789b317b1e812def6e554942fa` | `…/conflict.webp` | `c67cb49ee51afeca38ddbd99921c5ecf7d0199a2b7f46f7c2b19290f34cb7657` | 61 KB |

- **Alt text** describes each screen in full: table, source, schedule and last result; the setup fields; the conflict notice, its two choices and the paused status with the history.
- **Note under the screenshots** (also in the viewer): "Screenshots: TableRefresh's official WordPress.org screenshots, on WordPress 7.1 with TablePress, using Google's public sample sheet (fictional data)."
- **Shown on the page:**
  - next/image serves each at the width the layout needs (828 px wide for the 764 px column on desktop, 384 px on a phone);
  - the viewer shows the original file.

## Verification (dev server :3000, headless Chrome)

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | Pass |
| Navigation (`work/tablerefresh-nav.mjs`, `results/tablerefresh-nav.txt`) | **39 of 39** |
| Viewer (`work/tablerefresh-viewer.mjs`, `results/tablerefresh-viewer.{txt,json}`) | **44 of 44** |
| Layout (`work/tablerefresh-capture.mjs`, `results/tablerefresh-layout.json`) | **1648 × 928 and 1366 × 768:** site header, page 6971 px, screenshots 764 px wide. **390 × 844:** compact header, page 8093 px, screenshots 342 px wide. No element past the right edge; all images loaded, with alt text; no console errors |
| Markup against baselines saved before the change | **AriMap**, **`/`**, `/?station=engineering&project=tablerefresh`, `/?station=engineering&project=sqlorbit` and `/?station=educational&project=arimap`: **byte-identical**. **SQLOrbit** and SQLOrbit `?render=lite`: identical except the related card ("View TableRefresh in the lab" → "Open TableRefresh", new link) |
| Lint | Not available: the project has no ESLint configuration or lint script |

**What the 39 navigation checks cover:**
- **The lab:**
  - TableRefresh's Open project links to the page, and SQLOrbit's still links to its own;
  - a project without a page (Armat) keeps "Coming soon".
- **The page:**
  - a client-side navigation, with no scene mounted;
  - the title and noindex;
  - the eight sections in the approved order and the five facts rows;
  - three images, loaded, described, at their own proportions;
  - the WordPress.org link, in a new tab and announced; no GitHub link;
  - Open SQLOrbit.
- **History:**
  - Back to the lab returns to Engineering with TableRefresh selected, without a reload;
  - browser Back and Forward between the lab and the page, then further Back through the lab's own history;
  - **SQLOrbit → TableRefresh → SQLOrbit through the related cards**, then Back, Back and Forward, all without a reload.
- **View parameters:** `render` and `floor` are kept to the page, back to the lab and to SQLOrbit, for three combinations. Unknown values are dropped.
- **Status codes:** TableRefresh, SQLOrbit and AriMap return 200. Armat, an unknown slug and `/projects/tablerefresh` return 404.
- **Keyboard:** Tab reaches the skip link, Back to the lab, all three screenshots, WordPress.org and Open SQLOrbit, each with the focus ring.
- **Reduced motion:** no animations or transitions.
- **`/`:** TableRefresh still shows the disabled "Coming soon"; no project-page links; the header navigation is unchanged.
- **No console errors.**

**What the 44 viewer checks cover:**
- **Desktop, 1648 × 928:**
  - three screenshots stacked in order, numbered 01–03 with titles, each 764 px wide in its own proportions (764 × 537, 764 × 537, 764 × 993);
  - links to the three originals;
  - a click opens a modal dialog named "Setup" and described by its caption, with the counter `2 / 3`, the announcement, the original 1280 × 900 at 1000 × 703 (not upscaled), focus on Close and the source note;
  - no motion and no overflow; the wheel doesn't scroll the page;
  - Next shows **03 Edit conflict**, the tall screen, fitted at 541 × 703;
  - Previous and the arrow keys work, wrapping 3 → 1 → 3;
  - the Tab trap holds, with focus rings;
  - a click on the image keeps the viewer open;
  - a backdrop click closes it, returns focus to 02 and restores the scroll position;
  - Enter opens and Escape closes, with the focus ring back on 03;
  - Space opens and Close closes;
  - the URL doesn't change.
- **Mobile, 390 × 844 with touch:**
  - stacked at 342 px, in order, at their proportions, with no overflow;
  - a tap opens 03 at 358 × 465, with the caption and the Image credits line visible;
  - a swipe doesn't scroll the page;
  - the credits expand and still fit;
  - a backdrop tap closes, and focus returns to 03.
- **Reduced motion:** no animation; the controls' transition is 0 s.
- **Without JavaScript:** the first screenshot opens `/projects/tablerefresh/tables.webp` (`image/webp`).
- **Smoke checks:**
  - AriMap's five-screen row still opens the viewer (`2 / 5 Find`);
  - SQLOrbit has no gallery or viewer, and no overflow.
- **No console errors.**

**Captures** (`work/captures/`, ignored by Git):
- `tablerefresh-page-1648x928.png`, `tablerefresh-page-1366x768.png`, `tablerefresh-page-390x844.png`: full page, each with a `-fold` first-screen version;
- `tablerefresh-viewer-desktop.png`: the viewer on 03 Edit conflict at 1648 × 928;
- `tablerefresh-viewer-mobile.png`: 03 at 390 × 844.

**Not run (as instructed):** the lab's animation and GPU performance suites, a production build, and the older AriMap and SQLOrbit probe scripts (their pages are covered by the markup comparison and the smoke checks above).

## Visual findings

- **The hero** has five facts rows, so it uses the long-list alignment (title aligned with the list's top), as on AriMap. With the final tagline, it wraps into two balanced lines at 1648 px and at 390 px, within the template's unchanged 30-character width. The first tagline ended on the single word "data.".
- **The light WordPress admin screenshots** stand out on the dark page. The hairline frame and soft shadow match the AriMap row; there is no device frame or colour treatment.
- **Screenshot text is small on the page:**
  - about 60% of its size on desktop (the 764 px column);
  - about 27% on a phone (342 px).
  - Titles, captions and alt text carry the meaning, and each screenshot opens full size.
- **The tall edit-conflict screen** stands 993 px high on desktop and 444 px on a phone. It is the longest item on the page, but it is the strongest engineering story, and there are only three screenshots.

## Remaining limitations

- **The viewer's "full size" is limited by the viewport.**
  - The tall 1280 × 1664 screen is shown at 541 × 703 on a 1648 × 928 screen, and 358 × 465 on a phone, so its text is small.
  - The browser's zoom works, and a modified click (or no JavaScript) opens the original file.
  - The approved viewer has no zoom or scroll of its own, and this milestone didn't add one.
- **Checked in headless Chrome only:** no Safari, Firefox, physical phone or screen reader.
- **Owner decisions still open in the audit** (§7):
  - whether 1.0.1's other checks were run: the page says the broader 1.0.0 verification "has not been independently confirmed for this release";
  - the GitHub link (none for now);
  - mentioning planned work (none mentioned).
- **SQLOrbit's card** shows TableRefresh's existing one-line lab summary: "…synchronizes TablePress tables with CSV files and Google Sheets." It doesn't say "public" Google Sheets. That line is shared with the lab and `/`, so it was left unchanged; the TableRefresh page itself states the public-only limit.
- **Dev server:** after `data/projects.ts` changes, the route may keep its earlier page list (a 404) until its file is touched. A production build doesn't have this problem.

## Re-running

```bash
npx next dev            # or reuse a running server
cd docs/m1.4l/work
BASE=http://localhost:3000 node tablerefresh-nav.mjs       # results/tablerefresh-nav.txt
BASE=http://localhost:3000 node tablerefresh-viewer.mjs    # results/tablerefresh-viewer.{txt,json}, captures/tablerefresh-viewer-*.png
BASE=http://localhost:3000 node tablerefresh-capture.mjs   # captures/tablerefresh-page-*.png, results/tablerefresh-layout.json
BASE=http://localhost:3000 node tablerefresh-tagline.mjs   # results/tablerefresh-tagline.txt, captures/tablerefresh-hero-*.png
```
