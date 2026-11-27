# M1.4L.3B: AriMap project page (prototype)

**State:** M1.4L.3B committed (`e8d6e98`). **M1.4L.3C (gallery finalization) implemented and checked, not committed;** see [M1.4L.3C](#m14l3c-gallery-finalization) below.

## Summary

- AriMap has a page at **`/lab-v2/projects/arimap`**, built on SQLOrbit's template. In `/lab-v2`, AriMap's **Open project** now links there; on the homepage `/` it still says "Coming soon".
- **Content:** only the owner's approved decisions, the four overview paragraphs word for word, and facts verified in `ARIMAP-CONTENT-AUDIT.md`. No Problem and solution panels, no links, no Armenian screens, no AI-illustration screens, and no section on AI-assisted development.
- **Screenshots:** five authentic English screens of the Android 1.0.0 release candidate, in one numbered row, with their source and the map credits.
- **SQLOrbit's page and `/` are unchanged:** their markup is identical to baselines saved before this work.
- **Checks:**
  - TypeScript passes;
  - AriMap navigation: **27 of 27**;
  - SQLOrbit regression: **25 of 25**;
  - captures at 1648 × 928, 1366 × 768 and 390 × 844: no horizontal overflow, no console errors.

## M1.4L.3C: gallery finalization

**Two changes, both approved in `ARIMAP-HANDOFF.md`:**
1. On a phone, screen 05 (Results) is **centred** on its own row, at the same size as the others.
2. Every screenshot **opens full size** in an accessible viewer.

Nothing else on the page changed: the hero, the Overview and other sections, the five images and their captions, and the five-across and three-across layouts. SQLOrbit's markup is identical to a baseline saved before this work. The lab, the rendering modes and `/` don't use these files.

### Files

| File | Change |
|---|---|
| `components/project/ScreenshotViewer.tsx` (new) | The viewer, a small client component (no new dependency). It wraps any server-rendered gallery and opens on links marked `data-viewer-index`, so other case studies can reuse it with their own `media` and `mediaNotes` |
| `components/project/ProjectDetail.tsx` | `Media` wraps the portrait row in `ScreenshotViewer`. In `ScreenRow`, each image's frame is now a link to its WebP file, and an odd last screen gets three `max-sm:` classes that centre it |
| `docs/m1.4l/work/arimap-viewer.mjs` (new) | The focused check below; results in `work/results/arimap-viewer.{txt,json}` |

### Mobile alignment

- Below 640 px, the last screen of an odd-numbered row spans both columns, is centred (`mx-auto`), and keeps one column's width (`calc(50% - 0.5rem)`, half the row less half the 1 rem gap).
- Order, captions, the 163 × 290 size and the 9:16 proportions are unchanged.
- Nothing changes from 640 px: the three-across row, the five-across row and its 56 px stagger stay as they were.

### Viewer behaviour

- **Opening:**
  - each screenshot is a real link to its file (`/projects/arimap/find.webp` and so on);
  - with JavaScript, a click, Enter or Space opens the viewer instead. Space opens on release, like a button, so the same key press can't reach the Close button;
  - Ctrl, Cmd, Shift or middle click keep the browser's behaviour (for example, a new tab);
  - without JavaScript, the link opens the image itself;
  - the link's accessible name is the image's alt text followed by "(view full size)". The pointer becomes a zoom cursor; there is no other hover change.
- **Presentation:**
  - a native modal `<dialog>` covers the viewport in lab ink at 98%;
  - the original 720 × 1280 file is centred and fitted to the space at 9:16, never above its own size, with no horizontal scroll: 384 × 683 at 1648 × 928, and 358 × 636 at 390 × 844;
  - it has the gallery's 18 px rounded hairline frame;
  - under the image: the amber number and the screen's name, then its caption;
  - at the top left, a counter (`2 / 5`, the current number in amber).
- **Credits:**
  - from 640 px, both notes (the source line and the map attribution) are always shown under the caption;
  - on a phone, they fold behind an **Image credits** disclosure (a native `<details>`), so the image can take the screen's width. Expanded, the image shrinks to fit;
  - the page's own notes under the gallery are unchanged.
- **Navigation:**
  - Previous and Next buttons (round, with chevrons, named "Previous screenshot" and "Next screenshot"). They flank the image from 640 px, and sit beside the counter in the top bar on a phone;
  - the Left and Right arrow keys do the same;
  - both wrap around (1 → 5, 5 → 1), so a button never becomes disabled while it has focus;
  - the neighbouring originals are fetched ahead, so a step shows its image at once.
- **Closing:**
  - the Close button (an icon and the word "Close"), Escape (the dialog's own cancel), or a click or tap on empty space;
  - a click on the image, caption, credits or controls doesn't close it. Press and release must both land on empty space, so selecting caption text doesn't close it.
- **Accessibility:**
  - the dialog is modal, so the page behind is inert;
  - it is named by the screen's name ("Find") and described by its caption;
  - a polite live region announces "Screenshot 3 of 5: Travel" on each step;
  - focus moves to Close on opening;
  - Tab and Shift+Tab cycle through the viewer's controls only (Previous, Next, Close, and Image credits on a phone);
  - on closing, focus returns to the screenshot that opened it, with its focus ring if the keyboard was used;
  - every control shows the site's amber focus ring;
  - the page doesn't scroll behind the viewer (the body's overflow is locked, with the scrollbar's width compensated), and the scroll position is kept;
  - the URL and history don't change.
- **Motion:**
  - none: no animation when opening, closing or changing image;
  - the controls' hover colour uses the shared `lab-transition`, which is off with reduced motion.

### Verification (dev server :3002, headless Chrome)

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | Pass |
| Viewer and gallery (`work/arimap-viewer.mjs`, `results/arimap-viewer.txt`) | **41 of 41** (breakdown below) |
| SQLOrbit smoke | Renders with its five sections, no viewer links, no dialog, no overflow, no errors. Server markup of `/lab-v2/projects/sqlorbit` and `?render=lite` **identical** to baselines saved before the change |
| AriMap markup | Differs from its baseline only by the gallery wrapper, the five links (each with "(view full size)") and the centring classes on screen 05 |
| Accessibility tree (Chrome, one-off) | Gallery links: alt text + "(view full size)". With the viewer open, only the dialog is exposed: `dialog "Find"` (modal, described by the caption), the three buttons, the heading and the image with its alt text |

**The 41 checks:**
- **Desktop, 1648 × 928:**
  - the gallery is still five across at 198 × 351, offset 0/56/0/56/0 px, in order, with no overflow;
  - the links point to the five WebP files;
  - a click opens a modal dialog with its name, caption, counter and announcement;
  - it shows the original 720 × 1280 file, fitted at 9:16 inside the viewport and not upscaled;
  - focus is on Close; there's no horizontal overflow and no motion;
  - the mouse wheel doesn't scroll the page;
  - Next and Previous work, and so do the arrow keys, wrapping both ways;
  - with 8 Tabs and 4 Shift+Tabs, focus never leaves the viewer, and every stop shows the ring;
  - a click on the image keeps the viewer open;
  - a backdrop click closes it, returns focus, and restores scrolling at the same position;
  - Enter opens; Escape closes, with focus and ring returned;
  - Space opens; Close closes, with focus returned.
- **Mobile, 390 × 844 with touch:**
  - two across, in order, with 05 centred (its centre at 171.0 px of a 342 px row) and the same 163 × 290 size; no overflow;
  - a tap opens 05;
  - the image is 358 × 636, inside the viewport, with the caption and Image credits visible;
  - a swipe doesn't scroll the page;
  - the credits expand to the map attribution and still fit;
  - a backdrop tap closes, and focus returns to 05.
- **Reduced motion:** opens and steps with no animation; the controls' transition is 0 s.
- **Without JavaScript:** the Travel link opens `/projects/arimap/travel.webp` (`image/webp`), and there's no dialog.
- **SQLOrbit smoke**, and **no console errors or exceptions** in any run.

**Captures** (`work/captures/`, ignored by Git):
- `arimap-viewer-desktop.png`: the viewer open on 02 Find at 1648 × 928;
- `arimap-viewer-mobile.png`: 05 Results at 390 × 844;
- `arimap-gallery-mobile-centred.png`: the gallery at 390 px, with 05 centred.

### Remaining limitations

- **Checked in headless Chrome only:**
  - no Safari, Firefox or physical phone;
  - no screen reader in use (the accessibility tree was inspected instead).
  - Native `<dialog>` and `:has()` are supported in current versions of all three engines, but are not verified here.
- **"Full size" is limited by the viewport.** At 1648 × 928 the 720 × 1280 file is shown at 384 × 683. No pinch-zoom or zoom control is built in (the browser's own zoom still works). On high-density phones the source has fewer pixels than the screen, so it is slightly soft. No larger assets were created, by design.
- **No swipe between screens:** buttons and arrow keys only, which keeps every action available without gestures.
- **On a phone the credits start folded**, behind one line. They are visible in full on the page, and from 640 px.
- **Not run (out of scope for this milestone):**
  - `arimap-nav.mjs`, `sqlorbit-nav.mjs`, `home-history-smoke.mjs`;
  - the lab's animation and performance suites;
  - a production build.

## Files changed

| File | Change |
|---|---|
| `data/projects.ts` | New optional fields: `milestone`, `platforms`, `languages`, `sections` (`ProjectSection`), `mediaNotes`, and `title` on `ProjectMedia`. AriMap's `detail` |
| `components/project/ProjectDetail.tsx` | Facts rows for Release, Platforms and Languages. Extra text sections (`TextSection`). Screenshots inside a section, at full width (`wide`). The portrait screen row (`ScreenRow`) and its notes. The eyebrow dot in the station's accent. A longer facts list aligns with the title's top |
| `public/projects/arimap/*.webp` (new) | The five screenshots (below) |
| `docs/m1.4l/work/arimap-nav.mjs`, `arimap-capture.mjs` (new) | Probes; results in `work/results/arimap-*.{txt,json}` |

**Not changed:**
- the route (`app/lab-v2/projects/[slug]`);
- `lib/lab-v2-pages.ts`;
- the lab, `LabState`, `StationPanel`, the header;
- `/`, and the SQLOrbit content.

AriMap's route and its `/lab-v2` link follow from its `detail`, through `projectsWithPages()`.

**Template changes, and why SQLOrbit is unaffected:**
- every new block renders only when its field is set, and SQLOrbit sets none of them;
- the facts rows keep SQLOrbit's spacing and bottom alignment up to three rows;
- the eyebrow dot keeps Engineering's exact cyan classes;
- the stacked `Media` layout for landscape images is unchanged.

## Data model additions

```ts
interface ProjectDetail {
  // …existing fields
  milestone?: string;          // "Release" row in the facts
  platforms?: string[];        // "Platforms" row, joined with " · "
  languages?: string[];        // "Languages" row
  sections?: ProjectSection[]; // extra text sections
  mediaNotes?: string[];       // source and credits under the screenshots
}
interface ProjectSection {
  id: string;
  title: string;
  paragraphs?: string[];
  items?: { term?: string; text: string }[];
  showMedia?: boolean;              // the screenshots appear in this section
  after?: "overview" | "contributions"; // default: after the Overview
}
interface ProjectMedia { /* … */ title?: string } // shown above the caption
```

**Section order:**
1. Overview
2. extra sections placed after the Overview
3. Problem and solution
4. Engineering contributions
5. extra sections placed after the contributions
6. Technology stack
7. Screenshots (only if no section shows them)
8. Links
9. Related

## Page structure (AriMap)

1. **Hero.**
   - Eyebrow "Educational · Project", with the dot in Educational's amber.
   - "AriMap", and the tagline "Learn geography by exploring, remembering and playing."
   - Facts:

     | Row | Value |
     |---|---|
     | Status | In development |
     | Release | Android 1.0.0 release candidate built; real-device release validation pending |
     | Category | Education / Geography game |
     | Role | Creator & Full-stack Engineer |
     | Platforms | Android · Web |
     | Languages | English · Eastern Armenian |

2. **01 Overview:** the four approved paragraphs, verbatim; the first as the lead.
3. **02 Learning experience:**
   - one paragraph: the 12 Europe levels, and the other continents planned;
   - five terms: Discover, Find, Travel, Results, Quick Challenge;
   - then the screenshot row at full content width, with its two notes.
4. **03 Engineering contributions:** six items, the audit's verified bullets in shorter wording, with no measured figures.
5. **04 Accessibility:** one paragraph (what was checked, and that screen-reader testing on a phone is still in progress) and four terms: Text size, Not colour alone, Input, Motion and time.
6. **05 Technology stack:** TypeScript, React, Next.js, React Native, Expo, D3, TopoJSON, SQLite.
7. **06 Related project: Armat.** It has no page, so "View Armat in the lab" opens `/lab-v2?station=educational&project=armat`.
8. Footer: Back to the lab.

"Category: Education / Geography game" is the audit's draft wording; the approved decisions didn't specify a category. It is a one-line change if you prefer another.

## Screenshots: exact sources

All five come from AriMap's proposed store set:
- the 1.0.0 production build `44a3dd92`;
- on the Pixel 6 emulator, from a fresh install, with Level 1 played through without help and a Quick Challenge just started;
- 1080 × 1920 RGB PNG (`E:\arimap\docs\PLAY_STORE.md`, "Proposed replacements (Phase 5C.1A)").

**Processing:** each was resized to exactly two-thirds (720 × 1280, the same 9:16 proportions) and saved as WebP at quality 90. The pixels were not edited in any other way.

| Shown | Source (`E:\arimap\screenshots\play-store\v2\phone-en\`) | Source SHA-256 | Copy in ArsSoftLab | Size |
|---|---|---|---|---|
| 01 Home | `1-home.png` | `1610069523dae992b7d3ae5bf306e3d1dbf933b9a15655788dae43c07b65019a` | `public/projects/arimap/home.webp` | 59 KB |
| 02 Find | `3-find.png` | `34f285f3bea306dcb31dcc82d11d5c521db030405e9512c585581f9fa5725c5e` | `public/projects/arimap/find.webp` | 94 KB |
| 03 Travel | `4-travel.png` | `76e475068a13607ea4c3bdd46be2f3783a26f667317497d2e5779edb18332656` | `public/projects/arimap/travel.webp` | 105 KB |
| 04 Quick Challenge | `5-quick-challenge.png` | `c3f76c06e9128ae9d8568684076dd4d72fc45e0a3d83c3477fb6d3a91043a9ba` | `public/projects/arimap/quick-challenge.webp` | 105 KB |
| 05 Results | `6-results-3-stars.png` | `6c14609f12931a6226c56093eaa40c8cc6a3bb77bbe6437043d94076cc257594` | `public/projects/arimap/results.webp` | 90 KB |

- **Left out on purpose:**
  - `2-discover-landmark.png` (AI-generated illustration, rights unresolved);
  - `7-europe-levels.png` (not among the five approved);
  - all Armenian screens.
- **None of the five shows a landmark illustration.**
- **Next.js image optimization serves them** at the size each layout needs: 256 px wide at 1648 × 928.

**Notes under the row** (small print, 6.1:1 contrast):
- "Screenshots: AriMap's Android 1.0.0 release candidate on an Android emulator, in English."
- "Map data: Natural Earth. Relief: Terrain Tiles by Mapzen. Forests: © ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium (CC BY 4.0)." This is the audit's credit line.

**Alt text** describes each screen's content, for example: "Travel: the player has crossed from France into Belgium; buttons offer the Netherlands, Luxembourg and Germany as next crossings, with Hint, Undo and Restart."

## The screenshot row

- **One ordered list of five figures, all in view at once.** No carousel, autoplay, scrolling, hover effect or animation. The numbers follow the flow: Home, Find, Travel, Quick Challenge, Results.
- **Width:**
  - from 1024 px, five across, 198 × 351 px each at 1648 × 928, and every other screen set 56 px lower for an editorial rhythm;
  - 640–1023 px, three across;
  - below 640 px, two across (163 × 290 at 390 px), the fifth on its own row, centred since M1.4L.3C.
- **Frame:** each screen keeps its own proportions inside an 18 px rounded hairline frame, white at 10%, with a soft shadow. No device frame, glow or colour treatment.
- **Captions:** an amber number and the screen's name (15 px), with one line (13.5 px) under it.
- **Loading:** the images load lazily, as next/image does by default, so a visitor fetches them only on scrolling near.

## Verification (RTX 4060, Chrome 158, dev server)

| Check | Result |
|---|---|
| TypeScript | Pass |
| AriMap navigation (`work/arimap-nav.mjs`, `results/arimap-nav.txt`) | **27 of 27.** See the breakdown below |
| SQLOrbit regression (`work/sqlorbit-nav.mjs`) | **25 of 25** |
| SQLOrbit's page unchanged | Markup of `/lab-v2/projects/sqlorbit` and `?render=lite` **identical** to the baselines saved before this work. Raw differences only in development-only scripts: the hot-reload counter, React's dev debug data, and the per-request ID |
| `/` unchanged | Markup of `/`, `/?station=educational&project=arimap` and `/?station=engineering&project=sqlorbit` **identical** to the baselines. On `/`, AriMap still says Coming soon |
| Layout (`work/arimap-capture.mjs`, `results/arimap-layout.json`) | 1648 × 928 and 1366 × 768: site header, page 4555 px. 390 × 844: compact header, page 6946 px. No element past the right edge; all five images loaded, with alt text; no console errors |

**What the 27 AriMap checks cover:**
- **The lab:** "Open project" links to the page in `/lab-v2`; Armat keeps "Coming soon".
- **The page:**
  - a client-side navigation, with no scene mounted;
  - five images, each loaded, described, and in its own proportions;
  - Armat linking to its lab preview.
- **Navigation:**
  - Back to the lab returns to the station and project;
  - browser Back and Forward work;
  - `render` and `floor` are kept both ways;
  - 404s for Armat, Koreez, unknown slugs and `/projects/arimap`.
- **Keyboard and focus rings, reduced motion,** and `/` unchanged.

**Captures,** not tracked by Git:
- `work/captures/arimap-page-{1648x928,1366x768,390x844}.png`: full page, plus first-screen versions;
- `work/captures/arimap-gallery-{desktop,mobile}.png`: the screenshot row at full size.

## Visual findings

- **The hero's facts list is long:** six rows.
  - With SQLOrbit's alignment, where both columns end on one line, the title sat about 150 px below the list's top, leaving a gap above it.
  - Longer lists now align with the title's top, with slightly tighter rows.
  - SQLOrbit's three-row hero is unchanged.
- **The screenshot row reads as the flow of a level,** not a store carousel. The light app screens stand out on the dark page, so they are kept small, framed and captioned.
- **On a phone, the fifth screen sat alone** in the left column. M1.4L.3C centres it.
- **The screenshots' own text is too small to read in the row** (198 px wide on desktop, 163 px on a phone). Captions and alt text carry the meaning. Since M1.4L.3C, each screen opens full size in the viewer.
- **Contrast:** captions 13.4:1, numerals 9.7:1, notes 6.1:1. All above WCAG AA.

## Remaining publication limitations

These are AriMap's own open items, as recorded in the audit:
- **Not on Google Play.** Nothing has been uploaded, and the page says "release candidate built; real-device release validation pending". No store or website link appears.
- **The Android release build has not been validated on a physical phone.** The page says screen-reader testing on a phone is in progress.
- **The landmark illustrations' usage rights are unresolved.** No screen showing one is used. If they are cleared, the Discover screen (`2-discover-landmark.png`) could be added.
- **The Armenian text awaits a native speaker's review.** No Armenian screens are used.
- **The website (arimap.world) is not linked** until it is verified.
- **The screenshots show the 1.0.0 build.** Later preview builds changed map details, which were measured on an emulator only.

## Re-running

```bash
npx next dev -p 3002
cd docs/m1.4l/work
node arimap-nav.mjs       # results/arimap-nav.txt
node arimap-capture.mjs   # captures/arimap-page-*.png, results/arimap-layout.json
node sqlorbit-nav.mjs     # SQLOrbit regression
```

On the dev server, after `data/projects.ts` changes, the project route may keep its previous list of pages (a 404 for a new project) until its file is touched. A production build doesn't have this problem.
