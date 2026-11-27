# M1.4L.8A — Wallpapers content audit

This is research only:

- no application code changed;
- no project repository was touched;
- no artwork was created or copied.

**Context:**

- **ArsSoftLab:** `feat/lab-v2` at `84ef553`.
- **Audit:** 27 November 2026.
- **Scope corrected and owner decisions recorded:** the same day, at the office-to-home handoff.

## Summary

- **Wallpapers is a message-led wallpaper collection with a planned mobile app.** Its positioning is "Wallpapers that speak to you." (owner decision, §9).
- **Where the work lives:** most of the project's development so far happened in **ChatGPT conversations this audit couldn't access**. Over 100 wallpaper concepts were planned there.
- **What the audit could search** (§2) held no Wallpapers code, artwork or documentation:
  - the office computer's local folders;
  - the owner's 13 public GitHub repositories.
- **That is a finding about those sources only.** It does **not** mean no Wallpapers work exists.
- **Unverified:**
  - how many finished, approved artwork files exist;
  - whether a mobile app has been implemented.
  
  Neither may be described as existing until it is checked.
- **Decided:**
  - the portfolio page is **deferred**;
  - Wallpapers stays the lab's "Coming soon" project;
  - the existing lab summary stays **unchanged**.

Everything below separates three kinds of information:

- **[Verified]:** checked in this audit;
- **[Intended]:** owner decisions and specifications, not yet verified as deliverables;
- **[Unverified]:** may exist, but wasn't seen.

---

## 1. Verified project status

| Question | Finding |
|---|---|
| Product | A message-led wallpaper collection and a planned mobile app. **[Intended]** |
| Concepts | More than 100 planned across earlier ChatGPT conversations. **[Unverified]**: the conversations weren't available to this audit. |
| Finished, approved artwork | **[Unverified]**: the number is unknown. None was found in the searched sources. |
| Mobile app implementation | **[Unverified]**: no code was found in the searched sources. Not claimed. |
| Public release | None found: no store listing, website or public repository. **[Verified]** for the sources searched. |
| In ArsSoftLab | A project entry with no page. Only `/lab-v2` shows it, in the Creative Studio station (amber), as "Coming soon". The navigation tests use it as the unfinished-project example. **[Verified]** |
| Portfolio page | **Deferred** (owner decision) |

## 2. Repository and source evidence

**Searched (read-only) on the office computer:**

| Source | Result |
|---|---|
| Local user folders and project drives, by file and folder name | One **empty** folder named after the app; no wallpaper files |
| App manifests (`package.json`, `app.json`, `pubspec.yaml`, Gradle, Xcode) | None mentions wallpapers |
| Text search for "speak to you", "wallpaper app", "message-led" and "message-driven wallpaper" | No match outside ArsSoftLab |
| The owner's public GitHub repositories (13) | None is a Wallpapers project |
| ArsSoftLab | The `wallpapers` entry in `data/projects.ts` (summary only, present since the first commit on 20 Nov 2026), the `creative` station in `data/zones.ts`, and the navigation tests' "Coming soon" checks |

**Not available to this audit:**

- **the ChatGPT conversations where the project was developed;**
- the owner's phone;
- cloud storage;
- any private repository;
- the home computer.

**What the result does and doesn't show:** the empty result describes only the sources above. Before any page is built, the concepts, artwork and any app code must be gathered from where they actually live and verified (§9).

## 3. Existing assets

| Asset | Status |
|---|---|
| Wallpaper concepts (more than 100) | **[Unverified]**: planned in ChatGPT conversations; not seen |
| Finished, approved artwork files | **[Unverified]**: the count is unknown; none seen |
| Collections or themes | Six themes decided (§4). **[Intended]** |
| Typography or style guide | Not seen. **[Unverified]** |
| Image-generation records (tools, prompts) | Not seen. **[Unverified]** |
| Dimensions | Specification decided: 1440 × 3200 (§4). No file has been measured. |

**Nothing is presented as finished.**

## 4. Product positioning

**Owner decisions, all [Intended]:**

| Element | Decision |
|---|---|
| Positioning | "Wallpapers that speak to you." |
| Product | A message-led wallpaper collection and a planned mobile app |
| Initial language | English |
| Artwork format | Portrait **9:20**, target **1440 × 3200 px**, PNG |
| Creative themes | Emotional, motivational, philosophical, funny, bold, personal |
| Design principle | **The artwork directly reinforces its message:** image and words make one statement, rather than text laid over an unrelated picture |
| Related project | **AZIZ** (provisional) |
| Lab summary | **Unchanged:** "A collection of message-driven wallpapers combining typography, visual storytelling, and design." |

**Specifications aren't deliverables.** The format, themes and principle describe what the artwork is meant to be. Whether each finished file meets them must be checked when the files are supplied, for example by measuring the actual pixel dimensions and confirming each file's theme.

## 5. Verified technical work

**None verified.** No application code was available to this audit. The following must not be described, because nothing verified implements them:

- platforms;
- navigation;
- download, saving and sharing;
- image handling;
- the stack;
- tests;
- a build or publication status.

The planned mobile app is recorded as **planned only**.

## 6. Draft tagline and Overview

**These are concept-stage drafts, for later.** The portfolio page is deferred, and the drafts claim only decided intent.

| Field | Draft |
|---|---|
| Category | Creative / Visual Design |
| Tagline | "Wallpapers that speak to you." |
| Role | Creator & Designer. Add "Engineer" only when app code is verified. |
| Status | To be set from verified facts. For example, "In design" if no app exists. |
| Platforms | Omit until an app is verified |
| Languages | English (intended) |
| Related project | AZIZ (provisional) |

### Overview (draft, three paragraphs)

1. "Wallpapers is a collection of phone wallpapers that carry a message. Each one pairs a short line of text with artwork made to reinforce it, so the screen you see most often says something worth reading."
2. "The collection spans six moods: emotional, motivational, philosophical, funny, bold and personal. Each wallpaper is designed message-first: the words come first, and the image, type and composition serve them."
3. "A mobile app for browsing and saving the collection is planned."

**Before publication:**

- ¶2 may only say "collection" once finished artwork is verified;
- ¶3 must be updated to reflect whatever is actually built.

**Design versus engineering:** design work (messages, typography, artwork) and application engineering stay separate on the page. Each is claimed only once verified.

## 7. Artwork recommendations

**No artwork can be recommended yet:** none was available to inspect, so no source path, dimension or approval can be recorded.

**When the owner supplies finished files, the selection should follow these rules:**

- **Count:** 5 images.
  - The existing viewer shows an all-portrait set as one row of five (`ScreenRow`), so 9:20 portrait wallpapers fit without any template change.
  - All five must be portrait.
- **Diversity:** five different messages, ideally five of the six themes, varied in composition (type-led or image-led, text placement) and color.
- **Only approved finals.** Each image record should include:
  - the source file;
  - measured pixel dimensions (target 1440 × 3200);
  - the theme;
  - the approval date;
  - provenance: hand-made, or the generation tool;
  - typefaces and their licenses;
  - the author of the message;
  - alt text: the message plus a description of the image.
- **Real files only,** with no device mockups or promotional composites. Files are converted to WebP under `public/projects/wallpapers/`, as with AriMap and TableRefresh. The PNG masters stay outside the repository.

## 8. Publication and licensing limitations

| Topic | Limitation |
|---|---|
| Existence | Don't describe artwork counts, an app, downloads, users or a release as existing until verified |
| Concept count | "More than 100 concepts planned" is the owner's statement. It describes planning, not finished wallpapers. Don't use it as a collection size. |
| Image generation | If artwork is AI-generated, record the tool and check its terms for portfolio and commercial use. Don't publish prompts that name other artists. |
| Typography | Fonts must be licensed for distributed images. Record each typeface. |
| Message text | Original wording only. Quotations, lyrics and slogans need rights or must be in the public domain. No trademarks. |
| People | No identifiable people without releases |
| Mockups | None in this phase |

## 9. Owner decisions

**Recorded at the handoff (27 Nov 2026):**

- **Product:** a message-led wallpaper collection and a planned mobile app.
- **Positioning:** "Wallpapers that speak to you."
- **Initial language:** English.
- **Artwork specification:** portrait 9:20, target 1440 × 3200, PNG.
- **Themes:** emotional, motivational, philosophical, funny, bold, personal.
- **Principle:** the artwork directly reinforces its message.
- **Concepts:** more than 100 planned in previous conversations.
- **Unverified:** the number of finished, approved artwork files.
- **Unverified:** the mobile app implementation.
- **Portfolio page:** deferred.
- **Related project:** AZIZ, provisional.
- **Lab summary:** unchanged.

**Still open:**

| # | Decision |
|---|---|
| W1 | Gather the concepts and finished artwork from the ChatGPT conversations and other sources, and say which files are approved finals |
| W2 | Whether any app code exists, where it lives, and its platform(s) |
| W3 | Provenance and usage rights for the artwork (tools, terms) |
| W4 | Typefaces and their licenses; who wrote the messages |
| W5 | Final role, category and status wording (§6) |
| W6 | Confirm AZIZ as the related project |

## 10. Proposed M1.4L.8B scope

**Deferred.** There will be no Wallpapers page until W1–W5 are answered. Wallpapers stays the lab's "Coming soon" example, so the current navigation tests stay valid.

**When resumed, 8B would cover:**

1. **Verification.** A short final pass on this audit. Record each supplied file's measured dimensions, theme, provenance and approval, and verify any app code read-only.
2. **Assets.** Five approved portrait finals, converted to WebP in `public/projects/wallpapers/`.
3. **Data.** Add `projects.wallpapers.detail` in `data/projects.ts`:
   - tagline, overview, category, role, status;
   - `sections`: the message-led principle, and the themes with `showMedia`;
   - five portrait `media` items, which gives `ScreenRow`;
   - `mediaNotes` (provenance, fonts);
   - `stack` and `links` only if verified;
   - `related: ["aziz"]`.
   
   **No component changes.** The lab summary stays unchanged.
4. **Tests.** Once Wallpapers has a page, the navigation scripts lose their "Coming soon" example. Koreez qualifies only while it stays unbuilt. Agree on the replacement before 8B.
5. **Verification.** The same focused set as AZIZ:
   - TypeScript;
   - a `wallpapers-nav` script and a layout script at 1648, 390 and 320 px;
   - the viewer with five portrait images;
   - byte-identical baselines for `/` and the existing pages.
6. **Out of scope:**
   - generating artwork or mockups;
   - homepage changes.
