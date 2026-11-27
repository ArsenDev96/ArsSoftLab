# M1.4L.5B — Armat project case study (prototype)

**Route:** `/lab-v2/projects/armat`. The page is built on the existing `ProjectDetail` template, entirely from data, and has no screenshots.

- **Branch:** `feat/lab-v2`, starting from `b2f3296`.
- **Status:** not committed or pushed.
- **Facts:** from [ARMAT-CONTENT-AUDIT.md](ARMAT-CONTENT-AUDIT.md): the `ArsenDev96/armedu` source at `fdcd43c` and the live site, both checked on 27 Nov 2026.

## Summary

- **Data only.** Armat's page is one `detail` entry in `data/projects.ts`. No component, route, style or homepage file changed.
- **Looks complete without screenshots.**
  - It has the hero with four facts and eight numbered sections.
  - Because the page has no media, the template leaves out the screenshot section and viewer, as designed.
- **Links within `/lab-v2` only:**
  - the lab's Open project link goes to the page;
  - AriMap's related card now reads "Open Armat" and goes to the page;
  - `/` still says "Coming soon" and is byte-identical to before.
- **Navigation tests:** the AriMap and TableRefresh scripts now use **AZIZ** as the project without a page.
- **Verification:**

  | Check | Result |
  |---|---|
  | TypeScript | passes |
  | Armat navigation and content | 52/52 |
  | AriMap navigation | 29/29 |
  | TableRefresh navigation | 40/40 |
  | Layout at six sizes | 44/44 |

  Markup baselines match what was expected.
- **Screenshots:** six image-free candidates from the live site are documented for approval (§6). They are not on the page and not copied into ArsSoftLab.

## 1. Files

| File | Change |
|---|---|
| `data/projects.ts` | `projects.armat.detail` added, about 100 lines; the existing summary is unchanged |
| `docs/m1.4l/work/armat-nav.mjs` | New: route, content and navigation check |
| `docs/m1.4l/work/armat-layout.mjs` | New: layout check at six sizes, plus full-page captures |
| `docs/m1.4l/work/arimap-nav.mjs` | Updated for Armat's page and for AZIZ as the "Coming soon" example; keyboard check from 14 to 20 Tab presses (§4.3) |
| `docs/m1.4l/work/tablerefresh-nav.mjs` | Updated for AZIZ as the "Coming soon" example; Armat now returns 200 |
| `docs/m1.4l/work/results/armat-nav.txt`, `armat-layout.txt`, `armat-layout.json` | New results |
| `docs/m1.4l/work/results/arimap-nav.txt`, `tablerefresh-nav.txt` | Re-run results |
| `docs/m1.4l/work/captures/armat-page-*.png` | Captures for visual review. Git ignores them (`docs/**/*.png`). |
| `docs/m1.4l/ARMAT-CONTENT-AUDIT.md` | From M1.4L.5A, unchanged here and still not committed |

**What changed automatically through the data:**

- `projectsWithPages()` now serves the route.
- `labV2ProjectPages` turns on the lab's Open project link.
- `Related` makes AriMap's card read "Open Armat".

`ProjectDetail.tsx`, `ScreenshotViewer.tsx` and everything under `app/` are unchanged. The dev server needed the usual timestamp touch of `app/lab-v2/projects/[slug]/page.tsx` before it served the new slug; the file's content is unchanged.

## 2. Page content

### 2.1 Hero

| Item | Value |
|---|---|
| Eyebrow | Educational · Project (from the station) |
| Title | Armat |
| Tagline | "Explore Armenian culture, history and literature in three languages." |
| Status | Public website · Ongoing development |
| Category | Education / Multilingual Publishing |
| Role | Creator & Full-stack Engineer |
| Languages | Eastern Armenian · Western Armenian · English |

`languages` is used here for the first time; it was already supported by the template. No release, platforms, launch date or problem and solution are shown.

### 2.2 Sections, in page order

1. **Overview.**
   - Paragraphs 1–4 are the audit's proposed text, unchanged.
   - Paragraph 5 is the approved replacement: "Armat is publicly accessible and continues to evolve. Content quality, editorial verification and search visibility remain areas for further improvement."
2. **Multilingual content architecture.** A line on coverage (all 55 articles in three languages; Eastern Armenian is the default), then items:
   - Routing;
   - Typed content;
   - Shared slugs;
   - Bibliography;
   - No silent fallback.
3. **Content discovery and search.** The five sections, then items:
   - Site search;
   - Listing filters;
   - Related reading.
4. **Engineering contributions** (eight):
   - App Router and static generation with locale routing;
   - the typed content model with shared slugs and bibliography;
   - browser search and URL-synced filters;
   - metadata, canonical links and language alternates;
   - structured data;
   - sitemap;
   - content validation script;
   - Playwright tests.
5. **Technology stack:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Leaflet, Playwright. All are in `armedu`'s `package.json` and lock file. Vercel is left out: it is seen only in the live site's response headers, not in the repository.
6. **Editorial status.**
   - **Content review:** ongoing, and not every published article has received professional editorial review.
   - **Western Armenian:** reviewed with AI assistance, without yet a comprehensive review by a native editor.
   - **Illustrations:** article images on the site are AI-generated and labeled as such.
7. **Links:** "armat.site", https://armat.site, opening in a new tab and announced as such. There is no repository link.
8. **Related project:** AriMap ("Open AriMap").

### 2.3 Wording

- **American English:** e.g. "organizes", "organization" and "labeled". The navigation script checks the page text for British spellings and finds none.
- **No unsupported claims.** The page has no indexing, ranking, traffic or visitor claims, no test totals, no WCAG claim and no hosting claim. This is checked too.

## 3. Verified facts behind each section

All entries are from the audit, §1–§3.

| Page claim | Evidence |
|---|---|
| Static generation, App Router | `generateStaticParams` on every article route; `X-Nextjs-Prerender: 1` live |
| `/hy`, `/hyw`, `/en`; correct language; 404 for other prefixes | `[locale]/layout.tsx` (root layout, `dynamicParams = false`); live `lang` correct on all 195 pages |
| Typed modules; a missing translation is a type error | `src/data/locales/*`; every locale must satisfy `UiDictionary`, where every field is required; `tsconfig` strict |
| Shared slugs, shared bibliography with identifiers | `localePath()`; `src/data/sources.ts`; the validator requires an ISBN, DOI, URL or archival reference |
| No silent fallback | Helpers that require a locale; `getContentAlternates()` lists only editions that exist |
| All 55 articles in three languages | `DECLARED_UNAVAILABLE.hyw` is empty for every category; 55 per language live |
| Browser search, no server, within one language | `src/lib/search.ts`; no API route for search |
| Listing state in the URL, Back and Forward | `useListingParams.ts` (`pushState`, `replaceState`, `popstate`); `listing.spec.ts` |
| Related links checked automatically | The validator checks that each `relatedSlugs` entry is published in that language |
| Canonical links, hreflang, structured data, sitemap | `src/lib/i18n.ts`, `src/lib/seo.ts`, `src/app/sitemap.ts`; 0 issues across 195 live pages |
| Validation script, Playwright desktop and mobile | `scripts/validate-content.ts`; 17 specs; `playwright.config.ts` (Desktop Chrome 1440×900, Pixel 5) |
| Western Armenian: AI-assisted review, no native editor | The live About page; the README's known limitations |
| AI-generated illustrations, labeled | `ARTWORK_PROVENANCE` in `src/lib/media.ts`; captions on every live article |

## 4. Verification

The dev server was `http://localhost:3000` (Next.js 16, Turbopack) in default headless Chrome, with no GPU or animation suites.

### 4.1 TypeScript

`npx tsc --noEmit -p .` exits 0, both before the test runs and again at the end. There is no ESLint configuration or lint script, so no lint was run.

### 4.2 Armat navigation and content: 52 passed, 0 failed

Run with `BASE=http://localhost:3000 node armat-nav.mjs`; results in `work/results/armat-nav.txt`.

1. **Lab deep link** (`?station=educational&project=armat`): Open project links to `/lab-v2/projects/armat`. AriMap's still links to its own page. AZIZ keeps the disabled "Coming soon".
2. **Round trip from the lab:**
   - client-side navigation (a window marker survives);
   - title "Armat — Lab v2 (experimental)", `noindex`;
   - no lab scene mounted, and the page scrolls.
3. **Content:**
   - the tagline, eyebrow, the four facts, the section order and the Overview (five paragraphs, the fifth exact);
   - eight contributions, the stack list and all ten section terms;
   - the Western Armenian and editorial-review sentences;
   - 0 images and no viewer;
   - none of the excluded claims; American spelling.
4. **Links:** armat.site opens in a new tab and is announced; there is no repository link.
5. **Back to the lab:** returns to `?station=educational&project=armat` with Armat selected, with no reload; the lab is a fixed screen again.
6. **Browser history from the lab:** Back after selecting in the lab restores the station and project; Forward returns to the page; further Back walks the lab's own history.
7. **AriMap ↔ Armat:**
   - AriMap's card reads "Open Armat", links to the page and keeps the lab summary;
   - "View Armat in the lab" is gone;
   - both directions are client-side;
   - Back, Back, Forward walk them correctly without a reload.
8. **View parameters:** `render=lite`, `render=lite&floor=original` and `floor=approved` are kept into the page, back to the lab, in the navigation and on the AriMap card.
9. **Status codes:**
   - Armat, AriMap, SQLOrbit and TableRefresh return 200;
   - AZIZ, Wallpapers, Koreez, an unknown slug and `/projects/armat` return 404;
   - unknown view values are dropped from every lab link.
10. **Keyboard:** Tab reaches the skip link, Back to the lab, armat.site and Open AriMap, each with a visible focus ring.
11. **Reduced motion:** no animations, and link transitions are 0 s.
12. **Homepage `/`:** Armat's Open project is still disabled with "Coming soon"; there are no links to project pages; the header navigation is unchanged.
13. **Console:** no errors or exceptions.

One check failed on the first run: the eyebrow comparison expected spaces that the markup doesn't contain ("Educational·Project"). The expectation was corrected; the page was not changed.

### 4.3 Affected navigation scripts

- **`arimap-nav.mjs`: 29 passed, 0 failed** (was 27/27 when committed). Changes:
  - Armat's row in the Educational panel now links to its page;
  - the "Coming soon" check uses AZIZ (`?station=playground&project=aziz`);
  - the related card is "Open Armat", linking to `/lab-v2/projects/armat`;
  - `/lab-v2/projects/armat` returns 200 and `/lab-v2/projects/aziz` returns 404;
  - the keyboard check looks for "Open Armat".
- **The keyboard check also needed more Tab presses**, and that was not caused by Armat. The committed result passed in AriMap's own commit, before M1.4L.3C made the five screenshots focusable viewer links. With those links, 14 Tab presses no longer reach the related card, so the budget is now 20, the same as `tablerefresh-nav.mjs`.
- **`tablerefresh-nav.mjs`: 40 passed, 0 failed.** The "Coming soon" check uses AZIZ, `/lab-v2/projects/armat` returns 200, and `/lab-v2/projects/aziz` returns 404.

### 4.4 Desktop and mobile layout: 44 passed, 0 failed

Run with `armat-layout.mjs` at 1648×928, 1366×768, 1024×768, 768×1024, 390×844 and 320×640. Results are in `work/results/armat-layout.txt` and `armat-layout.json`.

- **At every size:**
  - no horizontal overflow (document width, and no element past the right edge);
  - the site header from 1024 px and the compact header below;
  - eight sections in order; the page scrolls with no lab scene;
  - the four facts stay inside their panel;
  - no images;
  - page text is at least 11 px (the smallest is the 11.5 px fact labels);
  - no console errors.
- **Tagline:** two lines, with no single-word line, at both 1648 and 390: "Explore Armenian culture, history and / literature in three languages."
- **Languages value:** wraps to two lines in the facts panel at desktop widths, at 390 and at 320, with "English" on the second line. Status and Category also wrap at 320 px. All stay inside the panel.
- **Shared site header:** it is the same on every project page and is reported separately. Its "Software Engineer" label measures 10 px on mobile and 7.13 px at 1024 px, the same as on TableRefresh. It is not part of this page's content.

Two checks failed on the first run because of errors in the check itself, not the page:

- the section heading was overwritten by the box height (both used the key `h`);
- the text-size check included the shared header.

Both were fixed in the script.

### 4.5 Markup baselines (homepage regression)

The server markup of eight URLs was compared before and after the change, from `<body` to the first `<script>`. The "before" set was captured twice and was stable.

| URL | Result |
|---|---|
| `/` | identical |
| `/?station=educational&project=armat` | identical |
| `/?station=educational&project=arimap` | identical |
| `/?station=engineering&project=tablerefresh` | identical |
| `/lab-v2/projects/tablerefresh` | identical |
| `/lab-v2/projects/sqlorbit` | identical |
| `/lab-v2/projects/arimap` | **one link changed:** `/lab-v2?station=educational&project=armat` "View Armat in the lab" → `/lab-v2/projects/armat` "Open Armat" |
| `/lab-v2/projects/arimap?render=lite` | the same single change, with `?render=lite` kept |

The homepage checks inside all three navigation scripts also pass.

### 4.6 Captures for visual review

In `docs/m1.4l/work/captures/` (not tracked):

- `armat-page-1648x928.png` (full page, 1648×4552) and `-fold.png`;
- `armat-page-1366x768.png` and `-fold.png`;
- `armat-page-390x844.png` (full page, 390×6682) and `-fold.png`.

**Visual review:** the hero, facts panel and sections match the SQLOrbit, AriMap and TableRefresh pages. Without media, the page goes straight from Editorial status to Links and Related, and reads as complete. On mobile, the facts panel sits under the tagline and the section items stack, with the term above its text.

## 5. Screenshot limitations

- **Not used, until provenance and reuse rights are established:**
  - the homepage hero, `public/hero-ararat.png`: its origin has never been recorded;
  - AI article illustrations: neither the tool nor the licence is recorded;
  - historical portraits;
  - the Tigran the Great illustration.
- **The page has no `media`, `mediaNotes` or Screenshots section.** Adding approved images later is a data change: `media`, plus a textless `{ id: "screenshots", showMedia: true }` section where they should appear. Everything else stays as it is.

## 6. Image-free screenshot candidates (for owner approval, not added)

Captured from the live site with `…\scratchpad\armat\candidates.mjs`:

- headless Chrome, 1440 px wide, DPR 1, no GPU;
- each capture is clipped to stop 16 px above the first content image;
- the script then lists every `<img>`, `<picture>`, `<svg image>`, `<video>` and CSS background image inside the clip.

All six contain **no content images**, and each had 0 console errors.

Files are in `C:\Users\user\AppData\Local\Temp\claude\2856d551c7c34243\dc73d0a6-3f9f-44d7-a853-b4e29934bb06\scratchpad\armat\candidates\`. **Nothing was copied into ArsSoftLab.**

| Candidate | Page | Size | Shows |
|---|---|---|---|
| `language-menu-en.png` | `/en/places/garni-temple`, language menu open | 1440×643 | **Language navigation:** Հայերեն, Արեւմտահայերէն and English (current) over an English article header |
| `multilingual-hyw-article.png` | `/hyw/places/garni-temple` | 1440×737 | The same article header in Western Armenian classical orthography |
| `multilingual-hy-article.png` | `/hy/places/garni-temple` | 1440×737 | The same article header in Eastern Armenian |
| `category-filter-en.png` | `/en/cuisine`, "Desserts" chosen (the URL becomes `?type=dessert`) | 1440×850 | **Category filtering:** text filter, chips with Desserts active, result count, Clear all filters |
| `listing-search-en.png` | `/en/writers`, "poet" typed in the listing filter (`?q=poet`) | 1440×825 | Listing search with "8 writers match your search" (cards cut off above the portraits) |
| `site-search-en.png` | `/en/search?q=garni` | 1440×595 | **Site search:** query, "2 results for 'garni'", the first group heading (cards cut off above the thumbnails) |

**Caveats for the owner:**

- **The Armat logo mark** (`/brand/armat-mark.png`) is in the header of every candidate. Its provenance isn't recorded either: it was added in `39ee75f`, "added brend". It is the project's own brand, but confirm it can be shown.
- **Clipped captures show less than a full page,** so `site-search-en` and `listing-search-en` end at the first result row. A suggested set is `language-menu-en`, `multilingual-hyw-article` and `category-filter-en`, possibly with `site-search-en`, all landscape and stacked.
- **Re-capture when approved,** so the images match the site then; then convert losslessly to WebP in `public/projects/armat/` with recorded hashes, as for TableRefresh.
- **Live-site copy issue (Armat project, out of scope):** the filter count reads "1 article match your search", which should be "matches".

## 7. Remaining limitations

- **Testing:** only headless Chrome, against the dev server; no production build, Safari or Firefox.
- **The source was read, not run:** no `npm install`, and its tests and validator were not run. Repository facts come from code reading and the repository's own records.
- **Indexing** is not claimed or measured, and no Search Console data was used.
- **The site's Vercel deployment** is seen only in live response headers, so the page doesn't name it.
- **Lab summary:** Armat's one-sentence summary ("A multilingual platform for discovering Armenian history, literature, culture, and places.") is unchanged. It is used by the lab and by AriMap's related card.
- **Outstanding owner decisions:**
  - image rights (hero, AI illustrations, logo mark);
  - approval of the §6 candidates.

## 8. Re-running

```
# from docs/m1.4l/work, with the dev server on :3000
BASE=http://localhost:3000 node armat-nav.mjs
BASE=http://localhost:3000 node armat-layout.mjs
BASE=http://localhost:3000 node arimap-nav.mjs
BASE=http://localhost:3000 node tablerefresh-nav.mjs
npx tsc --noEmit -p .   # from the repository root
```

If a newly added slug returns 404 on the dev server, touch `app/lab-v2/projects/[slug]/page.tsx` once (a dev-server quirk seen in M1.4L.4B as well).
