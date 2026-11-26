# M1.4L.3 handoff: home to office

**Checkpoint:** branch `feat/lab-v2`, commit "feat: add AriMap project case study".

**Done:** M1.4L.3A (the AriMap content and media audit) and M1.4L.3B (the AriMap project page).

**Not started:** M1.4L.3C. Its two changes are below.

## Where things stand

| Milestone | State | Record |
|---|---|---|
| M1.4L.2 | SQLOrbit's page, approved and committed (`b4eeeb8`) | `SQLORBIT-PROTOTYPE.md` |
| **M1.4L.3A** | AriMap audit: verified facts, screenshot inventory, owner decisions | `ARIMAP-CONTENT-AUDIT.md` |
| **M1.4L.3B** | **AriMap page implemented, design approved** (this checkpoint) | `ARIMAP-PROTOTYPE.md` |
| **M1.4L.3C** | **Next: centre the fifth screenshot on mobile, and add an accessible full-size screenshot viewer. Not started** | this file |

## Current implementation

- **Route:** `/lab-v2/projects/arimap`. It comes from AriMap's `detail` in `data/projects.ts`, through `projectsWithPages()`. In `/lab-v2`, AriMap's "Open project" links to it; on `/` it still says "Coming soon".
- **Content:**
  - your four Overview paragraphs, verbatim;
  - the approved tagline, status, release milestone, role, platforms and languages;
  - the sections Learning experience (with the screenshots), Engineering contributions, Accessibility and Technology stack;
  - related project: Armat, which links to its lab preview.
- **Template additions** in `components/project/ProjectDetail.tsx`, each used only when its field is set, so SQLOrbit is unaffected:
  - the Release, Platforms and Languages facts rows;
  - extra text sections (`TextSection`);
  - screenshots inside a section, at full width (`wide`);
  - the portrait screenshot row (`ScreenRow`) and the notes under it (`mediaNotes`);
  - the eyebrow dot in the station's accent;
  - a facts list longer than three rows aligns with the title's top.
- **Screenshots:** `public/projects/arimap/{home,find,travel,quick-challenge,results}.webp`, 720 × 1280.
  - They come from `E:\arimap\screenshots\play-store\v2\phone-en\` (1-home, 3-find, 4-travel, 5-quick-challenge, 6-results-3-stars), the 1.0.0 build on the emulator.
  - They were resized to two-thirds with no other edits; the checksums are in `ARIMAP-PROTOTYPE.md`.
  - None shows an AI illustration, and none is in Armenian.

## Validation results (home, RTX 4060, Chrome 158, dev server)

| Check | Result |
|---|---|
| TypeScript | Pass |
| AriMap navigation (`work/arimap-nav.mjs`) | **27 of 27**. Covers the lab link and Coming soon for Armat; client-side navigation with no scene; five images loaded with alt text and their own proportions; the Armat link; Back to the lab; browser Back and Forward; `render` and `floor` kept; 404s; keyboard; reduced motion; `/` unchanged |
| SQLOrbit regression (`work/sqlorbit-nav.mjs`) | **25 of 25** |
| SQLOrbit's page and `/` | Markup identical to baselines saved before M1.4L.3B |
| Layout captures (`work/arimap-capture.mjs`) | 1648 × 928, 1366 × 768, 390 × 844: no horizontal overflow, no console errors |

## The approved design

**Desktop** (from 1024 px):
- hero with a six-row facts panel, aligned with the title's top;
- numbered sections on the editorial two-column grid;
- in Learning experience, the screenshot row spans the full content width:
  - five screens across, 198 × 351 px at 1648 × 928;
  - every other one set 56 px lower;
  - each in an 18 px rounded hairline frame (white at 10%) with a soft shadow;
  - an amber number with the screen's name, then one caption line;
- under the row, the source note and the map credits in small print.

**Between 640 and 1023 px:** three screens across.

**Mobile** (390 px):
- compact header, one column;
- screenshots two across (163 × 290); **the fifth sits alone in the left column today, and M1.4L.3C centres it**;
- the footer stacks.

**Throughout:** no carousel, autoplay, transitions or animation in the gallery, and images load lazily.

## M1.4L.3C: the two remaining changes

1. **Centre the fifth screenshot on mobile.**
   - In the two-across layout (below 640 px), the odd last screen is centred in its row, at the same width as the others.
   - Only that layout changes. The three-across and five-across layouts, and the stagger, stay as they are.
2. **An accessible full-size screenshot viewer.** Each screenshot can be opened full size and read, which matters most on a phone, where the screens are 163 px wide.

### Gallery requirements for M1.4L.3C

**Agreed** (from the M1.4L.3B brief and the approved design):
- premium, editorial presentation; not a generic store carousel;
- no autoplay, unnecessary transitions or heavy animation;
- responsive and usable at 390 px;
- accessible image descriptions (the existing alt text);
- keep the approved row on desktop and mobile; the viewer adds to it and doesn't replace it.

**Proposed for the viewer** (to confirm before building; these are standard accessibility requirements, not yet agreed):
- **Opening:**
  - each screenshot opens from a real control named for it (for example "View Find screenshot full size"), reachable by keyboard and with the visible focus ring;
  - it works without JavaScript, falling back to a link to the image.
- **Dialog:**
  - a modal dialog with its own title (the screen's name and caption) and the image's alt text;
  - focus moves into it and is trapped there;
  - Escape and a visible Close button close it;
  - closing returns focus to the screenshot that opened it.
- **Navigation:** optional previous and next buttons, and arrow keys, between the five screens; no swipe-only control.
- **Size:**
  - the image shown at up to its full 720 × 1280, fitted to the viewport and never stretched;
  - on a phone, filling the screen's width with the caption visible.
- **Motion:** none, or at most an opacity fade, removed under reduced motion; no zoom animation.
- **Page state:** the page doesn't scroll behind the dialog, and the dialog doesn't change the URL or browser history.
- **Data:** no new images or larger versions are needed, since the 720 × 1280 files are already in `public/projects/arimap/`.

## Restrictions (unchanged)

- **SQLOrbit:**
  - its page, content and layout stay as approved (`b4eeeb8`);
  - any template change must leave its markup identical; check against a baseline, as in M1.4L.3B.
- **The production homepage `/`:**
  - unchanged; "Open project" stays "Coming soon" there for every project;
  - project pages exist only under `/lab-v2/projects/`;
  - no merge into `main`.
- **The laboratory:** no change to the scene, its animations, lifts, lighting, floor tone, the Cinematic and Lite modes, or `LabState`.
- **AriMap's content:**
  - no new facts;
  - no Armenian screens before the language review;
  - no screens with the AI illustrations while their rights are unresolved;
  - no arimap.world or Google Play link until verified;
  - the four Overview paragraphs stay verbatim.
- **No full laboratory animation suites.** Use the focused probes below.

## Resuming at the office

```bash
git fetch origin
git checkout feat/lab-v2
git pull                     # expect the commit "feat: add AriMap project case study"
npm install                  # or npm ci, if dependencies changed
npx next dev -p 3002         # the probes default to http://localhost:3002 (BASE to override)
npm run typecheck
```

Then check that the checkpoint works on the office computer before changing anything:

```bash
cd docs/m1.4l/work
node arimap-nav.mjs          # expect 27 of 27 (results/arimap-nav.txt)
node sqlorbit-nav.mjs        # expect 25 of 25
node arimap-capture.mjs      # captures/arimap-page-*.png (ignored by Git) and results/arimap-layout.json
```

**Notes:**
- **The office GPU** (Radeon HD 5450) is slow. Timing-sensitive lab probes behave differently there, but these page probes don't depend on frame timing. If a step times out, rerun it before treating it as a failure.
- **Dev server quirk:** after editing `data/projects.ts`, the project route can keep its previous list of pages (a 404 for a project just added), or a stale module, until the file is touched (`touch "app/lab-v2/projects/[slug]/page.tsx"`) or the server is restarted. If you stop the server, make sure its node process has really ended before restarting on :3002.
- **Before M1.4L.3C,** save baselines of `/`, `/?station=educational&project=arimap` and `/lab-v2/projects/sqlorbit` (as in M1.4L.3B), so SQLOrbit and `/` can be shown unchanged afterwards.
- **For M1.4L.3C's checks:**
  - extend `arimap-nav.mjs` with the viewer: open and close by keyboard, focus return, Escape, reduced motion;
  - capture at 390 × 844 to show the centred fifth screen;
  - run `sqlorbit-nav.mjs` and `home-history-smoke.mjs` once each.
