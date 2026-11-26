# M1.4L.2: SQLOrbit project page (prototype)

**State:** implemented, checked on the RTX 4060 (Chrome 158, dev server on :3002), **visually approved on desktop and mobile**, and committed (`feat: add SQLOrbit project case study`).

## Summary

- SQLOrbit has a page at **`/lab-v2/projects/sqlorbit`**. In `/lab-v2`, its **Open project** now links there with a client-side navigation. The page's **Back to the lab** returns to Engineering with SQLOrbit selected.
- **The homepage `/` is unchanged.** Its markup matches a baseline captured before any edit, and so does its server data apart from the dev server's per-run IDs. On `/`, SQLOrbit still says "Coming soon".
- **The other six projects are unchanged.** They keep "Coming soon" in both labs and have no page: their URLs are 404s.
- The page is one reusable template driven by an optional `detail` field in `data/projects.ts`. Every block renders only when its content exists. Only owner-approved facts are used; there are no screenshots, links, dates or metrics.
- **One fix in the lab's state was needed** for browser Back from the page (see "Navigation").
- **Checks:**
  - TypeScript and a production build pass;
  - the navigation test passes 25 of 25;
  - captures at 1648 × 928, 1366 × 768 and 390 × 844 show no horizontal overflow and no console errors.

## Files changed

| File | Change |
|---|---|
| `data/projects.ts` | New optional `detail` field and its types (`ProjectDetail`, `ProjectLink`, `ProjectMedia`). SQLOrbit's approved content. `projectsWithPages()` and `projectBySlug()` |
| `lib/lab-v2-pages.ts` (new) | Links between `/lab-v2` and its project pages, keeping the view parameters (`render`, `floor`) |
| `app/lab-v2/projects/[slug]/page.tsx` (new) | The route: `generateStaticParams` from the projects with pages, `dynamicParams = false`, `notFound()` as a guard. Metadata, not indexed |
| `components/project/ProjectDetail.tsx` (new) | The page template |
| `app/lab-v2/page.tsx` | Passes the "Open project" destinations to the hero |
| `components/lab/LabHero.tsx` | Optional `projectPages` prop, passed on only when set. The homepage does not set it |
| `components/lab/StationPanel.tsx` | `OpenProject` renders a Next.js `Link` when it has a page. Otherwise it behaves exactly as before |
| `components/ui/SiteHeader.tsx` | Optional `nav` prop. The default is the site's own entries |
| `components/lab/LabState.tsx` | On mount, the address bar's station and project win over a stale cached render (see "Navigation") |
| `app/globals.css` | `body:has([data-project-page]) { overflow-y: auto }`: the page scrolls, while the lab stays one fixed screen |
| `docs/m1.4l/work/sqlorbit-capture.mjs`, `sqlorbit-nav.mjs` (new) | Probes; results in `work/results/` |

No artwork, scene, animation or station code was touched.

## Data model

```ts
interface Project {
  // existing: id, name, slug, zone, summary?, href?
  detail?: ProjectDetail;      // M1.4L.2: a page exists only when this is set
}
interface ProjectDetail {
  tagline: string;             // value proposition under the name (required)
  overview?: string[];         // the owner's Overview paragraphs
  category?: string;
  role?: string;
  status?: string;
  problem?: string;
  solution?: string;
  contributions?: string[];
  stack?: string[];
  media?: { src; alt; width; height; caption? }[];  // real assets only
  links?: { label; href }[];                        // existing links only
  related?: ProjectId[];
}
```

- **Overview:** the owner's paragraphs (`overview`), supplied after the first pass and used word for word. Without them, the page falls back to the project's one-sentence lab summary. SQLOrbit's lab sentence is unchanged.
- **`href` is untouched:** it would apply to both labs. The `/lab-v2` link comes from `detail`, through `labV2ProjectPages()`.
- **Adding a page** for another project means adding its `detail`. The route, the lab-v2 link and the 404 rule follow from it.

## Page structure

From top to bottom:

1. **Header.**
   - From 1024 px wide: the site header, with its entries pointing into `/lab-v2` and "Projects" marked current.
   - Below 1024 px: a compact header with the brand and a "Lab" link. The site header is laid out for the scene's frame and does not fit narrow screens.
2. **Back to the lab.**
3. **Title block:**
   - the eyebrow "Engineering · Project", with a small cyan dot for the station's accent;
   - the name (`h1`), 48–92 px, weight 390;
   - the tagline;
   - the hero's amber rule.
   - Beside it on desktop, below it on narrow screens: a facts list (`dl`) with Status (amber dot, "In development"), Category and Role.
4. **Numbered sections** (`h2`), heading on the left and content on the right on desktop, stacked on narrow screens:
   - 01 **Overview:** the owner's four paragraphs, the first as a lead (18–20 px, the heading colour) and the rest as body text (17 px), in a 680 px column. The owner dropped an opening sentence that repeated the tagline.
   - 02 **Problem and solution:** two panels (`h3`); the solution's has a faint amber tint.
   - 03 **Engineering contributions:** an ordered list of the five items, with amber numerals and hairline separators.
   - 04 **Technology stack:** pills for Node.js, TypeScript and SQL.
   - Screenshots and Links: **not rendered**, because there is no content. The template supports both: images with alt text, and external links that say they open a new tab.
   - 05 **Related project: TableRefresh.** Its lab sentence and "View TableRefresh in the lab", which opens the lab with TableRefresh selected. TableRefresh has no page; once it has one, the card links there automatically.
5. **Footer:** Back to the lab, and "Engineering station · ArsSoftLab". On one row from 640 px; stacked below that (16 px apart).

**Final cleanup (after the visual review):**
- the last contribution has no bottom padding of its own, so every section ends with the same gap (72 px desktop, 48 px mobile);
- the footer stacks on narrow screens.

**Visual language:**
- the lab's ink background, with one restrained warm light from the upper left and a faint cyan trace at the right;
- no scene image;
- hairline borders, with no glass or blur;
- the hero's eyebrow, light weights and amber rule.
- **No animation.** The links use the shared colour transition, which is off under reduced motion.

## Navigation behaviour

| From | Action | Result |
|---|---|---|
| `/lab-v2?station=engineering&project=sqlorbit` | Open project | `/lab-v2/projects/sqlorbit`, a client-side navigation with no reload. The scene is unmounted |
| Project page | Back to the lab (top or footer) | `/lab-v2?station=engineering&project=sqlorbit`: Engineering's shot, SQLOrbit selected, no reload |
| Project page | Header "Lab" | `/lab-v2` |
| Lab, SQLOrbit selected in the page, then Open project | Browser Back | The same station and project. Further Back walks the lab's own history |
| After Back | Browser Forward | The project page |
| `/lab-v2?…&render=lite` and/or `&floor=…` | Open project, then back | Both parameters kept both ways. Unknown values are dropped |
| `/lab-v2/projects/tablerefresh`, `koreez`, any other slug; `/projects/sqlorbit` | (direct) | 404 |
| `/?station=engineering&project=sqlorbit` | Open project | Disabled, "Coming soon", as before |

**The lab state fix (`LabState.tsx`).**
- **Symptom.** A visitor selects SQLOrbit inside the lab, opens the page, then presses browser Back. They landed on the bare lab, and Forward was lost.
- **Cause.** The lab writes the station and project to the address bar with `history.pushState`. Next's router therefore remembers that entry with the render of the URL the lab was loaded at. On Back it remounts the lab from that render, with nothing selected, and the lab then pushed that "nothing" over the address.
- **Fix.** On mount, the address bar wins: the state adopts it, and nothing is pushed until it has.
  - When the render and the address agree, which is every load, deep link and link, the new code does nothing.
  - So the homepage's behaviour and output are unchanged. Its JavaScript contains the fix, but the fix never takes effect there, because `/` has no route to come back from.

**On browser Back, the camera eases to Engineering's shot** (about 850 ms, the normal station-selection move). The "Back to the lab" link lands directly on the shot. Lite and reduced motion have no camera move.

## Verification (RTX 4060, Chrome 158)

| Check | Result |
|---|---|
| TypeScript (`npm run typecheck`) | Pass |
| Production build (`next build` into a separate folder) | Pass. The route builds as dynamic (it reads the view parameters), with its slugs from `generateStaticParams`. The build's automatic edit to `tsconfig.json` was reverted |
| Route and navigation (`work/sqlorbit-nav.mjs`) | **25 of 25** (`work/results/sqlorbit-nav.txt`): the rows of the table above, keyboard, reduced motion, homepage, 0 console errors |
| Homepage Back / Forward (`work/home-history-smoke.mjs`), because `LabState.tsx` is shared | **12 of 12** (`work/results/home-history-smoke.txt`): one entry per selection; Back and Forward restore station and project without adding entries; a deep link loads without pushing; Escape, then Back, restores it; no project-page links on `/`; 0 console errors |
| Desktop visual, 1648 × 928 and 1366 × 768 (`work/sqlorbit-capture.mjs`) | Site header; no element past the right edge; `h1` 92 px; page 2660 px tall (390 px wide: 3531 px) |
| Narrow screen, 390 × 844 (touch emulation) | Compact header; document width 390 = viewport; no element past the edge; `h1` 48 px; one column |
| `/` unchanged | **Markup identical** to the baseline saved before any edit, for `/`, `/?station=engineering&project=sqlorbit` and `…&project=tablerefresh`. **Raw HTML identical** apart from the dev server's chunk name and request ID (two consecutive requests already differ in the ID). `/lab-v2` with TableRefresh selected: markup identical. With SQLOrbit: only "Open project" differs, now a link |

The captures are in `work/captures/sqlorbit-page-*.png`: the full page and the first screen at each size. They are ignored by Git and regenerated by `node sqlorbit-capture.mjs`. Layout measurements are in `work/results/sqlorbit-layout.json`.

## Visual and accessibility findings

- **Hierarchy:**
  - one `h1` (the project);
  - five `h2` sections;
  - `h3` for Problem, Solution and the related project;
  - the facts as a `dl`, the contributions as an `ol`.
- **Contrast** on the ink (and on the warm light's brightest part, sampled at about `#18130e`):

  | Text | Contrast |
  |---|---|
  | Headings | 15.8:1 (14.6) |
  | Body | 13.4:1 (12.3) |
  | Small labels (`#8f8e8f`) | 6.1:1 (5.7) |
  | Amber numerals | 9.7:1 |
  | Amber links | 12.8:1 |

  All above WCAG AA.
- **Keyboard:**
  - Tab reaches the skip link, the header, Back to the lab, the related project and the footer link;
  - every focused control shows the amber 2 px ring;
  - "Skip to content" jumps to the content.
  - On the related card, the whole card is the click area, but focus and the accessible name stay on the descriptive link ("View TableRefresh in the lab").
- **Reduced motion:** 0 animations, and link transitions at 0 s.
- **Text sizes:**
  - body 16–17 px, minimum 11.5 px (uppercase labels);
  - the site header's role line at 1366 × 768 is 9.4 px, unchanged from the lab (its scale follows the scene's frame);
  - the compact header's role line is 10 px.
- **Desktop:**
  - the title block and facts read at a glance;
  - the sections sit on one consistent two-column grid, with generous spacing;
  - the page is complete without screenshots or links: no gaps, and no "coming soon" blocks.
  - The Overview speaks in the first person ("I designed SQLOrbit…"); the contribution bullets have no subject ("Designed a…"). Both read naturally; the page does not mix voices within a section.
- **Narrow screen:**
  - one column, with the facts under the title;
  - the problem and solution panels stack;
  - the contribution numerals stay aligned;
  - the footer wraps cleanly.

## Missing content (left out, not invented)

- Screenshots or other media, with alt text.
- Links: repository, package, documentation, website. None exist publicly yet.
- Dates and period.
- Supported databases, drivers and ORMs by name (the contribution mentions "database drivers and popular Node.js ORMs" only).
- Release plans and what is next.
- Any usage, performance or security claims. These are intentionally absent: SQLOrbit is in development, and the Overview states that security hardening and independent review are still in progress.

## Follow-up decisions for the owner

1. **Approve the page's look and wording** from the captures. In particular:
   - the tagline as the value proposition;
   - "Engineering contributions" as the section title.
2. **Browser Back's camera move** (above): keep it, or land directly on the shot. Landing directly means restoring the selection before the first paint, a small change in `LabState`.
3. **The related project:** TableRefresh links into the lab until it has a page. Is that acceptable, or should the section wait for TableRefresh's page?
4. **The narrow-screen header:** the compact header is new to this page. The lab itself has no narrow-screen header yet, so this sets a precedent.
5. **Next project pages:** add each project's `detail` as content arrives (the audit's §4 checklist). TableRefresh is the natural next one.
6. **The public location** (`/projects/[slug]`) and the homepage link, when the lab replaces the homepage.

## Re-running

```bash
npx next dev -p 3002
cd docs/m1.4l/work
node sqlorbit-nav.mjs       # results/sqlorbit-nav.txt
node sqlorbit-capture.mjs   # captures/sqlorbit-page-*.png, results/sqlorbit-layout.json
node home-history-smoke.mjs # results/home-history-smoke.txt
```
