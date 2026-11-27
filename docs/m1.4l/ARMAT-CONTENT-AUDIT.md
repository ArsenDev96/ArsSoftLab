# M1.4L.5A — Armat content and media audit

This is research and content planning only. The page is not implemented, no application code changed, no screenshots were copied into ArsSoftLab, the Armat repository is untouched, and nothing was committed.

- **ArsSoftLab:** `feat/lab-v2` at `b2f3296`.
- **Armat source:** `ArsenDev96/armedu`, `main` at `fdcd43c`.
- **Live site:** https://armat.site.
- **Audited:** 27 November 2026.
- **Owner decisions applied:** see §4.

## How claims are marked

| Mark | Meaning |
|---|---|
| **[Source]** | Verified in the `armedu` source at `fdcd43c` |
| **[Live]** | Observed on https://armat.site on 27 Nov 2026 |
| **[Record]** | Stated in the repository's own records (`PROJECT_STATE.md`, README) but not re-run for this audit |
| **[Unverified]** | No supporting evidence: kept out of public copy |

**The repository README is partly out of date.** For example, it says 17 articles with Western Armenian at 9 of 17, and "No deployment, CI, analytics or Search Console". The code and the live site show 55 articles in all three editions and Google Analytics in production. This audit relies on code and live behaviour, and uses the README only where the code agrees.

## Summary

- **The source is available and verified:**
  - Next.js 16.2.10 App Router, React 19.2.7, TypeScript 5.9.3 in strict mode, Tailwind CSS 4.3.3;
  - typed, local content with no database or CMS;
  - Playwright end-to-end tests and a content validation script.
- **The live site matches `main`.** It carries PR #19's Garni Temple sourcing correction, merged 18 Nov 2026, the same day the CDN cache ages point to.
- **The technical SEO is implemented in code and consistent live on all 195 sitemap URLs:**
  - canonical URLs;
  - hreflang alternates with `x-default` rules;
  - JSON-LD (Organization, WebSite with SearchAction, Article, BreadcrumbList, citations, `about` entities);
  - a generated sitemap.
- **Indexing is not claimed** and no Search Console metrics are used (§4).
- **Images:**
  - every article image is AI-generated and captioned as such, but the repository records neither the tool nor the licence;
  - the homepage hero's provenance has never been established;
  - writer portraits are excluded.
- **The page fits the existing template with no code changes.** The only effects elsewhere are AriMap's related card and the Armat assertions in two navigation tests (§8).

---

## 1. Source-repository verification

### 1.1 Access

| Item | Result |
|---|---|
| Local checkout | None. A Claude project folder for `D:\armedu` exists, but the directory itself no longer does. |
| GitHub | `ArsenDev96/armedu` is reachable with the existing git credentials (`git ls-remote`, then a read-only clone into the session scratchpad). No access restriction was bypassed. |
| Branches | `main` plus `analiytics`, `content`, `fix/garni-sourcing`, `place`, `seo`, `writer`. **All are fully merged into `main`:** none has commits that `main` lacks. |
| History | 127 commits, from 2026-07-19 ("Initial commit") to 2026-11-18 (merge of PR #19). |
| Authors | All commits are by the owner's identities (`Arsen`, `ArsenDev96`, `Ars`). This supports "Creator". |
| PR #19 | `37ab766` "Correct sourcing in the English Garni Temple article". It changed `src/data/locales/en/articles/places.ts` and `src/data/sources.ts`. The new source note is on the live page; the old one is gone. **[Source]** **[Live]** |
| Modifications | None. The clone is in the scratchpad and is used read-only. No `npm install` was run and none of its scripts were executed. |

### 1.2 Next.js and TypeScript

**[Source]** Versions are from `package-lock.json`:

- Next.js 16.2.10, React 19.2.7, TypeScript 5.9.3;
- `tsconfig.json` sets `"strict": true`;
- scripts: `build`, `typecheck` (`tsc --noEmit`), `validate:content` (`tsx scripts/validate-content.ts`), `test:e2e` (`playwright test`).

### 1.3 Routing and static generation

**[Source]**

- **Locale routing.** `src/app/[locale]/layout.tsx` is the root layout, so `<html lang>` carries each page's real language. It sets `generateStaticParams` over the locales and `dynamicParams = false`, so an unsupported first segment returns 404.
- **The `/` redirect** is a temporary (307) redirect to `/hy` in `next.config.ts`, not middleware.
- **Article routes** (`[locale]/{history,writers,works,cuisine,places}/[slug]`) prerender every slug with `generateStaticParams`. Seventeen route files export `generateMetadata`.
- **The only dynamic route** is `src/app/api/contact/route.ts` (`force-dynamic`).
- **[Live]** Every page is prerendered (`X-Nextjs-Prerender: 1`); `/fr` and `/de` return 404.

### 1.4 Content storage and organisation

**[Source]**

- **Typed TypeScript modules in the repo, not a CMS or database.** All types are in `src/data/types.ts`.
- `src/data/locales/<hy|hyw|en>/` holds `ui.ts`, `pages.ts`, listing data (`history.ts`, `writers.ts`, `works.ts`, …) and `articles/` grouped by section.
- **Slugs are Latin and shared across editions.** Content stores paths without a locale, and `localePath()` adds the prefix when the page renders.
- **The bibliography** is in `src/data/sources.ts`, keyed by slug and shared by all editions. Every citation needs an identifier: ISBN, DOI, stable URL or archival reference.
- **Images** are registered by slug in `src/lib/media.ts` (`IMAGES`). One registry serves all three editions; alt text and captions come from each locale's dictionary.

### 1.5 The three language editions

**[Source]**

- **Locales:** `SUPPORTED_LOCALES = ["hy", "hyw", "en"]`, default `hy`. `LOCALE_META` sets `htmlLang` to `hy`, `hyw` and `en`. Western Armenian uses the BCP 47 tag `hyw` on purpose, with a code comment explaining the Open Graph `hy_AM` compromise.
- **No fallback between editions.** Every content helper requires a `locale`, and there is nowhere to fall back to.
- **Missing interface strings fail compilation:** every locale must satisfy `UiDictionary`, where every field is required.
- **Untranslated articles** are handled explicitly. Such an article would get a `noindex` "not translated yet" page and be left out of hreflang. Today `DECLARED_UNAVAILABLE.hyw` is empty for all five categories, so **Western Armenian is complete**.
- **[Live]** All 55 articles exist in all three editions.

### 1.6 Search

**[Source]** `src/lib/search.ts`:

- **Client-side, one locale at a time:** a normalised substring scan, with multiple terms combined as AND, over pre-joined "haystacks". There is no index service, API route or external service.
- **Listings keep their state in the URL** through the History API (`useListingParams.ts`), so filtered views can be linked and Back and Forward work.
- **`/<locale>/search`** groups results by type and is `robots: { index: false, follow: true }`.

**[Live]** `?q=garni` returned two grouped results (Cuisine: Gata; Places: Garni Temple), and `?q=tumanyan` returned three.

### 1.7 SEO metadata, canonical, hreflang, structured data and sitemap

**[Source]**

- **hreflang** (`src/lib/i18n.ts`):
  - `getContentAlternates()` lists only the editions that exist;
  - `getStaticAlternates()` handles the fixed pages;
  - `x-default` is added only where the default edition can serve the page.
- **Structured data** (`src/lib/seo.ts`). Its documented rule is that structured data restates only what is rendered on the page:
  - Organization (deliberately not `EducationalOrganization`);
  - WebSite with `SearchAction` on the homepage;
  - Article with citations: Book when there is an ISBN, otherwise CreativeWork;
  - BreadcrumbList;
  - `about` entities: Person for writers, CreativeWork for works.
  - Cuisine pages deliberately do not use `Recipe`, because they are not recipes.
- **Sitemap** (`src/app/sitemap.ts`):
  - entries for every page in every locale, with `alternates.languages`;
  - `lastModified` from article `updated` dates, and from the newest article for listings and the homepage;
  - About, Contact and Privacy get no invented date;
  - the article image is included when one exists;
  - only articles that exist in that locale.
- **Robots** (`src/app/robots.ts`): allow all, with a sitemap reference.

**[Live]** A crawl of all 195 sitemap URLs on 27 Nov 2026 found 0 issues. Every page has:

- status 200;
- the correct `lang`;
- a canonical link to itself;
- the full set of reciprocal hreflang links (`hy`, `hyw`, `en`, and `x-default` pointing to `hy`);
- `index, follow`;
- a description and one h1.

Every article has Article JSON-LD with citations. The sitemap has 195 URLs, 780 hreflang links and 165 image entries.

### 1.8 Tests and validation

- **Playwright** **[Source]**:
  - 17 spec files in `tests/e2e/`, covering article, brand, contact form, cuisine, header, listing, locale, mobile, navigation, newsletter, places, search, SEO, visit map, visit, works and writers;
  - two projects: Desktop Chrome at 1440×900 and Pixel 5;
  - examples: `seo.spec.ts` checks the WebSite and SearchAction graph, Article and breadcrumb nodes, and `x-default` rules; `locale.spec.ts` checks the redirect, 404s, language switching that keeps the page and the query, and that no page links out of its own edition.
- **Content validator** `scripts/validate-content.ts` (1,953 lines) **[Source]**. It checks:
  - required fields;
  - unique slugs;
  - cross-references within a locale;
  - filter ids;
  - declared translation gaps;
  - **Western Armenian orthography** (catches Eastern spellings);
  - that every article has a source with an identifier;
  - that registered images exist on disk.
- **Recorded results** **[Record]** (`PROJECT_STATE.md` §111–§112, 27 Sep 2026):
  - the last full suite: 579 tests, 573 passed, 1 failed (a timeout that passed when re-run alone), 5 skipped;
  - after §112's wording changes: `tsc` clean, `validate:content` passing (234 entries), focused re-runs passing; the full suite was not re-run.
- **No recorded run covers the current `main`.** It differs only by PR #19's English sourcing text.
- **Not re-run for this audit:** that would need `npm install` and a dev server inside the source checkout. The public copy should therefore not quote test counts (§4.4).

### 1.9 Deployment configuration

- **[Live]** Hosted on Vercel; prerendered pages served from the CDN cache.
- **[Source]** There is no `vercel.json` and no `.github/` workflow, so there is no CI in the repo. Deployment is configured outside the repository, so **its configuration is unverified**.
- **[Source]** Environment variables are listed in `.env.example`: Supabase URL and anon key, SMTP, and map tiles.

### 1.10 Accessibility

**[Source]** found in components:

- a skip link to `#main`;
- `aria-current` (5 uses);
- `aria-expanded` (6) on menus;
- `aria-live` (6), for example search counts and the copy-link fallback;
- `aria-invalid` and `aria-describedby` on form fields (8);
- Escape-key handling (2);
- `sr-only` text (10);
- language links as real `<a>` elements with `hrefLang`, `lang` and `aria-label` (also tested in `locale.spec.ts`).

**[Live]** At 390×844 and 1440×900, no captured page had horizontal overflow or console errors.

**[Unverified]**

- No WCAG audit, contrast measurement or screen-reader run is recorded.
- No `prefers-reduced-motion` handling was found.

The case study should describe these measures, not claim compliance.

### 1.11 Other implemented features

**[Source]**

- **Contact form:** `/api/contact` sends the message by SMTP (nodemailer) and files a copy in Supabase `contact_messages`. It has a honeypot, a per-IP rate limit, and length limits in both the route and SQL, and it never reports a false success.
- **Newsletter:** a Supabase insert-only row-level-security policy, with no browser read or update.
- **Visit map:** Leaflet, loaded only when the map scrolls into view, with a configurable tile provider. If tiles fail, the map says so and does not silently fall back to another provider.
- **Google Analytics** (`GoogleAnalytics.tsx`): loads only in production builds, with the `afterInteractive` strategy.

---

## 2. Confirmed technology stack

| Technology | Evidence | Public copy? |
|---|---|---|
| Next.js 16 (App Router, static generation) | lock 16.2.10; `generateStaticParams`; `X-Nextjs-Prerender` | Yes |
| React 19 | lock 19.2.7 | Yes |
| TypeScript (strict) | lock 5.9.3; `tsconfig` `strict: true` | Yes |
| Tailwind CSS 4 | lock 4.3.3; `@tailwindcss/postcss` | Yes |
| Supabase | `@supabase/supabase-js` 2.110.7; newsletter and contact copy | Yes |
| Leaflet | 1.9.4; Visit map | Yes |
| Nodemailer (SMTP) | `/api/contact` | Optional |
| Playwright | 1.61.1; 17 e2e specs | Yes |
| Vercel | Live response headers only; no configuration in the repo | Yes, as hosting |
| Google Analytics | `GoogleAnalytics.tsx`; Privacy page | No. It's analytics, not engineering, and could invite questions about metrics, which are excluded. |

No other tools are claimed: no CMS, database for content, CI or search service.

---

## 3. Verified engineering contributions

Each item is backed by §1. The wording is proposed for the page.

1. Built a statically generated Next.js and TypeScript site with locale-prefixed routing for Eastern Armenian, Western Armenian and English, with the correct `lang` on every page.
2. Designed a typed, translation-first content model with shared slugs and no silent fallback between languages. Missing interface translations fail at compile time.
3. Generated per-language metadata, canonical URLs and hreflang alternates that list only the translations that exist.
4. Produced structured data for articles, breadcrumbs, the publisher and the website, including source citations, while restating only what each page shows.
5. Generated a multilingual XML sitemap with language alternates, article images and modification dates taken from content.
6. Implemented browser-based search and URL-synced listing filters that never cross into another language.
7. Wrote a content validation script that checks cross-references, translation coverage, Western Armenian orthography and that every article cites an identifiable source.
8. Built a Supabase-backed newsletter and a contact form with SMTP delivery, spam protection and honest failure states.
9. Covered routing, language switching, search, SEO markup and content pages with Playwright tests on desktop and mobile.

Items 8–9 are optional if the page should stay focused on content and SEO.

---

## 4. Final content recommendations

### 4.1 Owner decisions applied

| Decision | Applied as |
|---|---|
| Role | "Creator & Full-stack Engineer" |
| Status | "Public website · Ongoing development" |
| Public link | https://armat.site |
| Launch date | Omitted (unverified). The first commit is 2026-07-19, but that is not a launch date. |
| Indexing and Search Console | No indexing claims and no metrics |
| SEO | Implementation only (§4.3) |
| AI-assisted content and Western Armenian | §4.4. No native-editor verification is claimed. |
| Portraits | Excluded (§5) |
| Unverified technologies and tests | Excluded. Only §2 items marked "Yes" are used. |

### 4.2 Hero fields

| Field | Value |
|---|---|
| Tagline | "A multilingual educational website for Armenian history, literature and culture." (draft, owner to approve) |
| Category | Educational platform / Multilingual web |
| Role | Creator & Full-stack Engineer |
| Status | Public website · Ongoing development |
| Platforms | Web |
| Languages | Eastern Armenian · Western Armenian · English |
| Release (`milestone`) | Leave unset. There is no versioned release, and the launch date is omitted. |

### 4.3 Sections

- **Overview:** the five proposed paragraphs (§6), once approved.
- **"Multilingual architecture"** (after Overview). Items:
  - *Routing:* "Each language is a path prefix (`/hy`, `/hyw`, `/en`) over one shared content structure; Eastern Armenian is the default."
  - *No silent fallback:* "Every page is rendered from its own edition; missing interface translations fail at compile time, and untranslated articles are never advertised as translations."
  - *Coverage:* "All 55 articles are published in all three languages."
  - *Western Armenian:* "Published in classical orthography as a separate edition; an automated check flags Eastern Armenian spellings."
  - *Switching:* "The language switcher opens the same page, and the same search, in the chosen language."
- **Engineering contributions:** §3, items 1–7, with 8–9 optional.
- **Technology stack:** Next.js, React, TypeScript, Tailwind CSS, Supabase, Leaflet, Playwright, Vercel.
- **"Technical SEO"** (after Stack). Implementation only:
  > "Every page is statically generated with a self-referencing canonical URL, hreflang alternates for the languages it exists in, and an `x-default` where the default edition can serve it. Structured data describes articles, breadcrumbs and cited sources without adding claims that are not on the page, and a generated sitemap lists every page with its language alternates and article image."
  
  No sentence about rankings, indexing or traffic.
- **"Editorial status"** (after the SEO section). Items:
  - *Sources:* "Every article lists its sources with an ISBN, DOI, stable link or archival reference, and corrections are made in all three languages."
  - *Western Armenian:* "Reviewed with AI assistance; it has not yet been reviewed by a native Western Armenian editor."
  - *Illustrations:* "Article images are AI-generated illustrations and are labelled as such on the site."
- **Link:** "armat.site", https://armat.site. No GitHub link: the repository's visibility hasn't been confirmed for publication.
- **Related:** AriMap.

### 4.4 Wording to avoid

- "Indexed", "ranks", "SEO success", or any traffic or visitor figure.
- "Fully verified", "fact-checked", "native-reviewed", or "WCAG compliant".
- Test counts. Recorded runs predate the current `main` and were not re-run (§1.8). "Covered by Playwright tests" is supported.
- "Since <date>" or "launched in …".

---

## 5. Screenshot recommendations and image-rights limitations

### 5.1 Image provenance in the source

| Image | Provenance | Use? |
|---|---|---|
| Article illustrations (history, works, cuisine, places) | **[Source]** Every `IMAGES` entry inherits `ARTWORK_PROVENANCE` ("AI-generated editorial illustrations"), and captions say so in every edition. **[Record]** `PROJECT_STATE.md` limitation 5: *which tool* and *what licence* are not recorded. | Only partly visible, with a disclosure note. Owner to confirm the generator's terms allow portfolio reuse. |
| Writer portraits | **[Live]** AI-generated; five are "based on surviving historical photographs". Real people. | **Excluded** (owner decision) |
| Historical figures in history illustrations (e.g. Tigran the Great) | AI-generated scenes depicting real historical people | **Avoided** under the same principle as portraits |
| Homepage hero `public/hero-ararat.png` | **[Source]** The code comment calls it a "Photograph". `PROJECT_STATE.md` says its provenance "has never been established", which is why it is outside the AI registry. | **Unverified.** Needs owner confirmation before any homepage screenshot is used. |
| Interface, logo, layout | The owner's own work | Yes |

### 5.2 Recommended set

Five landscape images at 1440×900, from the live site. Captures are in `…\scratchpad\armat\shots\`, and **nothing has been copied into ArsSoftLab.**

| # | Capture | Page | Shows | Images visible |
|---|---|---|---|---|
| 1 | `home-en-1440.png` | `/en` | **Homepage:** hero, navigation, category cards | Homepage hero (provenance unverified) and faint category-card backgrounds. **Conditional on §7 item 1.** |
| 2 | `places-article-en-1440.png` | `/en/places/garni-temple` | **Article:** breadcrumbs, label, lead, byline, updated date, reading time, Copy link | Top of an AI illustration of the temple (no person) |
| 3 | `cuisine-hyw-1440.png` | `/hyw/cuisine/lavash` | **Multilingual content:** the same article template in Western Armenian classical orthography, with the language chip | Top of an AI still life (no person) |
| 4 | `search-garni-en-1440.png` | `/en/search?q=garni` | **Search:** "2 results for 'garni'", grouped by Cuisine and Places | One AI dish thumbnail (no person) |
| 5 | `cuisine-index-en-1440.png` | `/en/cuisine` | **Category discovery:** text filter, category chips, "12 articles available" | Edge of a featured-dish image only |

**Excluded from the set:**

- `search-en-1440.png` (`?q=tumanyan`) and `search-monastery-en-1440.png`: their results include writer portraits;
- `writer-hy-1440.png` and `writer-en-390.png`: portraits;
- `history-article-en-1440.png`: Tigran the Great is depicted;
- `work-en-1440.png`: not checked for depicted people, and not needed;
- the 390-px captures: mixing them with landscape captures would stack them full width (§8).

**If the hero is not cleared,** don't substitute another homepage capture: the same hero appears in all three languages. Use a capture of the homepage scrolled to the category cards instead. That is still an authentic view, and it is captured in 5B.

**Proposed `mediaNotes`:**

> "Screenshots of the live armat.site. Article illustrations on Armat are AI-generated and labelled as such on the site; writer portraits are not shown."

Add a hero credit only once its origin is known.

**Capture method:** headless Chrome at device-pixel ratio 1, no GPU, after fonts load and a 2.5 s settle. All captures had 0 console errors and no horizontal overflow. In 5B, re-capture the approved views fresh so the images match the site at that time.

---

## 6. Proposed Overview verification

The wording is **unchanged**; it is quoted as supplied. Each paragraph is checked against §1–3.

| ¶ | Text (verbatim) | Evidence | Verdict |
|---|---|---|---|
| 1 | "Armenian history, literature and culture are spread across many sources, making it difficult to explore related people, places, works and traditions in one structured experience." | Motivation statement. Related-content links exist (`relatedSlugs`, validated cross-references) **[Source]**. | **Supported.** This is the owner's framing of the problem, not a factual claim needing evidence. |
| 2 | "I created Armat to bring this knowledge together in a multilingual educational website, with content available in Eastern Armenian, Western Armenian and English." | All commits are by the owner. All 55 articles exist in `hy`, `hyw` and `en` **[Source]** **[Live]**. | **Supported.** |
| 3 | "The project organizes articles about history, writers, literary works, cuisine and places, with consistent navigation and browser-based search to help visitors discover related topics." | Five sections; shared header navigation; client-side search; related cards **[Source]** **[Live]**. | **Supported.** |
| 4 | "From an engineering perspective, Armat focuses on multilingual content organization, statically generated pages and search-engine discoverability. The site includes canonical URLs, language alternatives, structured data and a sitemap designed to help search engines understand its content." | §1.3, §1.7; 195/195 pages checked **[Source]** **[Live]**. | **Supported.** "Designed to help" states intent, not outcomes, which fits the no-indexing-claims decision. |
| 5 | "Armat is publicly accessible and remains under active development, with ongoing work on content quality, editorial verification and search visibility." | Public: yes **[Live]**. Commits: content work through 27 Sep 2026, then PR #19 on 18 Nov 2026 **[Source]**. | **Flag for owner review (two phrases):** |

The two phrases in paragraph 5 are:

- **"active development".** The last commits were on 18 Nov and 27 Sep 2026. "Ongoing development" matches the approved status exactly. Keep "active" only if work is continuing now.
- **"ongoing work on … search visibility".** The repository has no SEO commits after the `seo` branch merges of August 2026 (last 2026-08-10). This is acceptable as owner-attested intent. It claims no results, but it should reflect work actually under way.

**"Content quality" and "editorial verification" are supported:**

- PR #19 corrected sources;
- the recorded fact-check and correction history (§112);
- the declared need for native-speaker review.

No paragraph claims native-editor review, indexing, rankings or traffic.

---

## 7. Remaining decisions requiring owner approval

1. **Homepage hero image:** what is its origin (photograph, stock or AI), and may it appear in a screenshot? The repository has never recorded it. If not cleared, use the scrolled homepage view (§5.2).
2. **AI illustration rights:** confirm that the generator's terms allow reuse in a portfolio. The tool and licence are not recorded in the repository.
3. **Overview paragraph 5:** keep "active development" and "search visibility", or align with the status ("ongoing development")? (§6)
4. **Tagline:** approve the draft in §4.2 or supply one.
5. **Section scope:**
   - include contributions 8–9 (forms, tests)?
   - include the "Editorial status" section as drafted?
6. **Repository visibility:** is `armedu` public, and should it be linked? Default: no link.
7. **Screenshot set:** approve §5.2, specifically one Western Armenian image (3) alongside English.
8. **README drift** (not for ArsSoftLab): the `armedu` README understates current coverage and says there is no analytics. This is for the owner to fix in that project if wanted. No change is proposed here.

---

## 8. Focused M1.4L.5B implementation plan

**Smallest change: data and assets only. No component changes are expected.**

1. **`data/projects.ts`.** Add `projects.armat.detail` with:
   - `tagline`, the five `overview` paragraphs, `category`, `role`, `status: "Public website · Ongoing development"`, `platforms: ["Web"]`;
   - `languages: ["Eastern Armenian", "Western Armenian", "English"]`. This is the first project to use the field: check that the "Languages" row renders and wraps at 390 px.
   - `sections`:
     - `multilingual` after `overview`;
     - `screenshots` (`showMedia`, textless);
     - `seo` after `stack`;
     - `editorial` after `stack`;
   - `contributions`, `stack` and `media` with alt text written for each image;
   - `mediaNotes` (§5.2);
   - `links: [{ label: "armat.site", href: "https://armat.site" }]`;
   - `related: ["arimap"]`.
   
   Leave `milestone`, `problem` and `solution` unset unless the owner wants them.
2. **Media.**
   - Re-capture the approved views from the live site at 1440×900, DPR 1, using the same method.
   - Convert losslessly to WebP in `public/projects/armat/`.
   - Record source, size and SHA-256, and check pixel identity, as for TableRefresh.
   - All landscape, so `ScreenStack` and `ScreenshotViewer` are used unchanged.
   - No portraits, no Tigran illustration, and the hero only if cleared.
3. **Expected changes elsewhere, all driven by data:**
   - **The lab:** Armat's row shows "Open project", linking to `/lab-v2/projects/armat`.
   - **AriMap's related card:** "View Armat in the lab" becomes "Open Armat". This is the only change to AriMap's markup; check it with a markup baseline.
   - **`/` and the Cinematic and Lite scenes:** unchanged. `scripts/visual/urls.mjs` and `stations.mjs` reference Armat only as a lab selection, which is unaffected. Confirm with byte-identical markup baselines for `/` and its station and project variants.
4. **Test updates** (ArsSoftLab work scripts only):
   - `docs/m1.4l/work/arimap-nav.mjs`:
     - line 22–31: Armat's "Coming soon" check becomes an "Open project" link, or another project still without a page is used as the "Coming soon" example (AZIZ, Wallpapers or Koreez);
     - lines 47–48: the related link becomes `/lab-v2/projects/armat`;
     - line 100: `/lab-v2/projects/armat` becomes 200;
     - line 120: "View Armat in the lab" becomes "Open Armat".
   - `docs/m1.4l/work/tablerefresh-nav.mjs`:
     - lines 26–38: use another page-less project for "Coming soon";
     - line 140: `/lab-v2/projects/armat` becomes 200.
   - Leave `detail-capture.mjs` and `detail-room.mjs`. They capture lab panels, not pages.
5. **Verification, the same focused set as TableRefresh:**
   - TypeScript;
   - a new `armat-nav.mjs`: lab link, Back to the lab, related link to and from AriMap, browser Back and Forward, the website link, 404s, keyboard;
   - an `armat-viewer` check with five images;
   - tagline and Languages wrap at 1648 px and 390 px;
   - the updated AriMap and TableRefresh navigation scripts;
   - markup baselines for `/`, its variants and AriMap.
   - No GPU or animation suites.
6. **Report and commit:**
   - `docs/m1.4l/ARMAT-PROTOTYPE.md`, with the image provenance table carried over from §5.1;
   - no commit until the owner approves.
7. **Out of scope:**
   - any change to `armedu` or armat.site, including its 404 page without `lang`, the cut-off Eastern Armenian header subtitle and the README drift;
   - Search Console work;
   - new artwork.

---

## Appendix A — Live-site findings (kept from the first pass)

- **Site structure** **[Live]**:
  - 195 sitemap URLs: 65 per language, all returning 200;
  - 55 articles per language: History 7, Writers 13, Literary works 10, Cuisine 12, Places 13;
  - plus Home, About, Contact, Privacy, Visit Armenia, five category indexes, and Search (`noindex`);
  - unknown paths return a real 404.
- **Self-description** **[Live]**, from the About page:
  - "an independent educational project", "an early version";
  - Western Armenian is "complete and has undergone multiple AI-assisted editorial reviews, but it has not been reviewed by a native Western Armenian editor";
  - images are "illustrations made for the site rather than documentary photographs, and replacing them with licensed museum material is still on the list".
  - The byline is "Armat Editorial Team".
- **Privacy** **[Live]**: Google Analytics, and Supabase for the newsletter and contact form (updated 3 Aug 2026).
- **Article dates** **[Live]**: `datePublished` from 2026-02-17 to 2026-09-27 (English). These are content dates, not a launch date.
- **Minor live issues** (Armat project, out of scope):
  - the 404 page (`src/app/not-found.tsx`, outside `[locale]`) has no `lang` and always shows Armenian;
  - the Eastern Armenian header subtitle is cut off at 1440 px;
  - 11 titles are identical in `hy` and `hyw` where the spelling doesn't differ.
- **Worth investigating, not a confirmed fault:** Google's hreflang documentation asks for ISO 639-1 codes, and `hyw` has none, so Google may ignore that alternate. The source chose BCP 47 `hyw` deliberately (§1.5). This belongs to the Armat project, not the case study.
- **Indexing evidence:** none. No Search Console access; a web search limited to `armat.site` with a non-Google provider returned nothing, which proves nothing either way.

## Appendix B — Evidence and re-running

All files are in the temporary session scratchpad:
`C:\Users\user\AppData\Local\Temp\claude\2856d551c7c34243\dc73d0a6-3f9f-44d7-a853-b4e29934bb06\scratchpad\armat\`

| Path | Contents |
|---|---|
| `src/` | Read-only clone of `ArsenDev96/armedu` at `fdcd43c` |
| `raw/` | Homepage, robots.txt, sitemap.xml and sample pages with headers |
| `crawl/` | All 195 sitemap pages and `status.txt` |
| `check.py` | Per-page SEO checks (run with `python -I check.py crawl`) |
| `shoot.mjs`, `shoot-search.mjs` | Captures using `scripts/visual/cdp.mjs`; no GPU |
| `shots/` | Captures, `report.json`, `report-search.json` |

To reproduce the source checks:

```
git clone https://github.com/ArsenDev96/armedu.git
git -C armedu checkout fdcd43c
```

Then read the files cited in §1. No install is needed.
