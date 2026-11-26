# M1.4L.3B: AriMap project page (prototype)

**State:** implemented and checked on the RTX 4060 (Chrome 158, dev server on :3002). **Not committed.**

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
  - below 640 px, two across (163 × 290 at 390 px), the fifth on its own row.
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
- **On a phone, the fifth screen sits alone** in the left column. That's acceptable; centring it, or showing three in the last row, is a possible refinement.
- **The screenshots' own text is too small to read in the row** (198 px wide on desktop, 163 px on a phone). Captions and alt text carry the meaning. Opening a screen full size would need a link or a viewer, which wasn't in scope.
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
