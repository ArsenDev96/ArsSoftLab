# M1.4L.1: Project detail experience audit

Audit only: no application code was changed.

**Evidence:**
- the code at `e9f6cd5` (`feat/lab-v2`);
- the project data;
- captures of `/lab-v2` deep links at 1648 × 928 (and 1366 × 768 for room), default Chrome, dev server.

Scripts and measurements are in `work/`. The PNG captures are ignored by Git.

## Summary

- **Today, a "project detail" is one sentence.** Selecting a project shows its name, a one-sentence summary, and an "Open project" action that is disabled and says "Coming soon". That holds for **all seven projects**: no project has a link, a page, an image, a role, a tech stack or a contribution in the repo.
- **The presentation is sound but has no room to grow.** It is readable (about 15 px, 9–13:1 contrast) and fits the cinematic lab's typography. But under every camera shot, Engineering's in-scene label starts 8–41 px above the panel's last row. More content cannot go into the hero slot.
- **The data model already anticipates a detail page:** `slug` is "reserved for the future /projects/[slug] detail page", and `href` is the destination of "Open project".
- **Recommendation:** one reusable **project page** template at `/projects/[slug]`, in the lab's visual language, reached from the existing "Open project". Start with **SQLOrbit**.
- **Smallest meaningful milestone:** the template, plus SQLOrbit's page **with content you supply**. Nothing can be filled in from the repo beyond today's sentence (§6).

## 1. Current implementation

| Part | File | What it does |
|---|---|---|
| Project data | `data/projects.ts` | 7 projects: `id`, `name`, `slug` (reserved for detail pages), `zone`, optional `summary` (one sentence) and optional `href` ("Open project" destination). `projectSummary()` falls back to a neutral sentence built from the station, but every project has an owner-written summary, so the fallback is unused |
| Station data | `data/zones.ts` | 5 stations: title, one-line summary, the projects they hold |
| In-scene labels | `components/lab/ProjectStation.tsx` | Station title (a disclosure button) and project chips (`aria-pressed` toggles) on each station |
| Detail surface | `components/lab/StationPanel.tsx` inside `LabHero.tsx` | Replaces the hero heading while a station is selected: station title (40.5 px), station summary, project names (toggles; the selected one amber and underlined), `OpenProject`, the project sentence, the amber rule, Back to Lab (Esc) |
| "Open project" | `StationPanel.tsx` `OpenProject` | With `href`: a link. Without one (all seven): `aria-disabled`, a "Coming soon" badge, and a polite announcement on activation |
| State and URL | `LabState.tsx`, `lib/lab-url.ts` | `?station=…&project=…`: deep links, Back and Forward, and a polite live region announcing "⟨Project⟩ selected. ⟨sentence⟩" |
| Styles | `app/globals.css` | `.lab-station-info` (fade between hero and panel), `.lab-hero-project`, `.lab-project-detail` (260 ms fade-in); reduced-motion variants |

The same `StationPanel` serves the homepage `/` and `/lab-v2`. Header navigation "Projects" points to `#lab-stations` (an in-lab anchor); there is no project index or project route (`app/` has only `/` and `/lab-v2`).

### Interaction flow: station to project

1. Hover or focus a station: it lights up (the activation, or lite mode's immediate response).
2. **Select the station** by its title, platform or a chip. The camera moves to its shot (not in lite mode), the hero heading gives way to the station panel, focus moves to the panel's heading, and the URL becomes `?station=…`.
3. **Select a project**, by a chip in the scene or a name in the panel. Its name turns amber and underlined in both places, its sentence fades in, the "Open project … Coming soon" row appears, the URL gains `&project=…`, and the live region announces it.
4. **Open project:** a dead end for every project. It says the page is coming soon.
5. Back to Lab or Escape returns to the lab, with focus on the station's title.

Steps 1–3 are polished and well tested (M1.3A, M1.4I.x, M1.4K). Step 4 is where the experience stops.

## 2. Strengths

- **Consistent with the cinematic lab.** No card or modal; the hero's own type (40.5 px, weights 390 and 460), amber rule and eyebrow carry the information, so the scene stays the subject.
- **Two synchronised entry points:** the scene's chips and the hero's names reflect the same state, and either can drive it.
- **Shareable state:** every station and project is a URL (`?station=engineering&project=sqlorbit`), restored on load and through Back and Forward.
- **Accessible:**
  - disclosure buttons and toggles with the right roles;
  - focus moves into the panel and back;
  - Escape works anywhere;
  - live announcements;
  - "Open project" stays discoverable while disabled;
  - reduced motion handled.
- **Honest content handling:** the code and data refuse to invent descriptions or links, and "Coming soon" says so rather than linking nowhere.
- **Readable:** the project sentence is 14.8 px on a 15 px base, two lines at 375 px width, light grey `rgb(210 211 213)`. Measured contrast against the scene behind it is 11.9:1 (SQLOrbit), 12.8:1 (Koreez) and 12.9:1 (Armat) at the median, and at least 9.1:1 at the 75th percentile of the backdrop (`work/detail-metrics.json`).
- **A detail page was planned:** `slug` and `href` are there; "Open project" already renders a real link when `href` is set.

## 3. Weaknesses

1. **Every project ends in "Coming soon".** Seven of seven "Open project" actions are disabled. A visitor who goes looking for depth hits the same dead end every time. This undermines the portfolio's purpose more than any visual issue.
2. **The content is one sentence per project.** There is no role, period, status, stack, technical contribution, outcome, image or link for any project (§4).
3. **The project is second in the hierarchy.**
   - With a project selected, the 40.5 px heading still names the **station** ("Engineering"). The project appears as a 16.5 px name in a row and a 15 px sentence.
   - The "Coming soon" badge is 11.5 px.
   - Fine for a preview; insufficient as a detail.
4. **No room to add more in place** (`work/detail-room.json`). Engineering's label rises above the panel's last row (Back to Lab) in every shot:
   - by 8–41 px at 1648 × 928, the worst cases being the Creative Studio and Experience shots;
   - by 7–35 px at 1366 × 768.

   It overlaps the panel's column, not its text yet, so extra lines would collide with it. Keeping both readable leaves the hero about one sentence of space: it is at capacity.
5. **Some sentences are unclear:**
   - **Koreez**, at the *Experience* station ("Building and maintaining real-world software"), reads as a product description ("An educational platform involving…"). It doesn't say whether this is the owner's job or a project, or what part was theirs.
   - **Wallpapers:** "message-driven" is ambiguous without images.
   - **AZIZ:** no platform is stated.
6. **No project index.** The "Projects" navigation entry points to an in-lab anchor; there is no list of all seven outside the scene.
7. **No visual evidence anywhere.** Even the visual projects (Wallpapers, AZIZ, AriMap) have no screenshots in `public/`. The only images are the scene's.

## 4. Project content inventory (what exists in the repo)

Every field below is from `data/projects.ts` and `data/zones.ts`. "—" means no information exists anywhere in the repo: data, docs, `public/`, README.

| Project | Station | Summary (owner-written) | Link (`href`) | Images | Role, period, status | Stack | Technical contributions | Unclear in the sentence |
|---|---|---|---|---|---|---|---|---|
| **SQLOrbit** | Engineering | "A Node.js developer tool for identifying slow, repeated, and N+1 SQL queries." | — | — | — | Node.js (from the summary) | — | How it is used (library, CLI, middleware?); which databases and ORMs; where it is published |
| **TableRefresh** | Engineering | "A WordPress plugin that synchronizes TablePress tables with CSV files and Google Sheets." | — | — | — | WordPress, TablePress (from the summary) | — | Whether it is published (WordPress.org?); one-way or two-way sync; scheduling |
| **AriMap** | Educational | "An interactive geography-learning game built around exploration, lessons, and challenges." | — | — | — | — | — | Platform; audience; status |
| **Armat** | Educational | "A multilingual platform for discovering Armenian history, literature, culture, and places." | — | — | — | — | — | Which languages; web or app; status |
| **AZIZ** | Playground | "A party-game app designed around creative questions, unexpected answers, and group play." | — | — | — | — | — | Platform (iOS, Android, web); status |
| **Wallpapers** | Creative Studio | "A collection of message-driven wallpapers combining typography, visual storytelling, and design." | — | — | — | — | — | Needs images to be understood at all; where to get them |
| **Koreez** | Experience | "An educational platform involving web applications, backend services, and production systems." | — | — | — | — | — | The owner's role and period; what they built or maintained (the station implies work experience) |

None of the empty cells can be filled from the repo. They need your input. This audit invents nothing.

## 5. Proposed design: one reusable project page, starting with SQLOrbit

### Where details should live

Options weighed:
- **More in the hero slot.** Ruled out by §3.4: no room.
- **An overlay panel in the scene.** It would cover station artwork or labels. It would fight the camera shots, and lite mode's absence of them. It would also need dialog focus management on top of the station panel's. Highest risk to the approved lab.
- **A page per project, `/projects/[slug]`.** Recommended:
  - the model already reserves the slug, and "Open project" already links when `href` is set;
  - it gives each project a shareable, indexable URL and unlimited room;
  - it leaves the lab exactly as approved.

**The lab keeps its role as the preview:** station, project, one sentence, then **Open project**, which leads to the page.

### The page template (reusable; every block renders only if its data exists)

The page uses the lab's visual language without the 3D scene:
- the lab-ink background;
- the hero's type scale (40.5 px heading, weights 390 and 460, 18/26 body);
- the amber rule (`HeroRule`) and amber accents;
- `.lab-chip` pills for tags;
- the same header (`SiteHeader`) and focus styles.

Optionally, a dimmed crop of the station's existing scene image could sit behind the header band, reused unmodified, never edited.

| Block | SQLOrbit content | Source |
|---|---|---|
| **Eyebrow** | `ENGINEERING · PROJECT` | data (station) |
| **Title** | SQLOrbit (40.5 px) | data |
| **Summary** | "A Node.js developer tool for identifying slow, repeated, and N+1 SQL queries." | data |
| **Meta row** (chips) | Type, Role, Year, Status | *owner* (Type: "Developer tool · Node.js" is derivable from the summary) |
| **Actions** | Repository · Package · Documentation, only the links that exist | *owner* |
| **Media** | 1–2 screenshots (for example its report or terminal output), with alt text | *owner*; nothing in the repo |
| **The problem** | Why slow, repeated and N+1 queries matter. 2–3 sentences | *owner* (the summary names the three query types) |
| **What it does** | Detects slow, repeated and N+1 queries (from the summary), plus how it reports them | *owner* beyond the summary |
| **How it works / technical contributions** | 3–5 bullets: approach, integration point, notable engineering decisions | *owner* |
| **Stack** | Chips: Node.js, plus databases and ORMs supported | *owner* beyond "Node.js" |
| **Status / outcome** | Released or in progress; usage; what's next. No metrics unless supplied | *owner* |
| **Footer** | ← Back to the lab (returns to `/lab-v2?station=engineering&project=sqlorbit`) · Next in Engineering: TableRefresh → | data |

**Data model.** Extend `Project` with optional fields, all omitted until supplied:
- `role`, `period`, `status`, `stack[]`;
- `links[]`: `{ label, href, kind }`;
- `media[]`: `{ src, alt, caption }`;
- `sections`: `{ problem, solution, contributions[] }`.

`href` becomes `/projects/${slug}` for projects whose page is approved, so each page switches on independently, and the others keep "Coming soon".

**Accessibility and behaviour:**
- one `h1` (the project), sections as `h2`, links named for their target;
- images with alt text;
- the back link as a real link: it works without JavaScript and from a shared URL;
- no new animation beyond the existing 260 ms fade-in (and none under reduced motion).

**Decision for you: the homepage.** `StationPanel` is shared, so setting SQLOrbit's `href` also activates "Open project" on the homepage `/`. Either accept that (the page is the same for both), or limit `href` to `/lab-v2` until the lab replaces the homepage. Both are small; this audit doesn't choose.

## 6. Recommended next steps

**M1.4L.2, the smallest milestone that changes the experience: "SQLOrbit project page".**
1. **Content from you** (prerequisite; nothing is invented). For SQLOrbit:
   - role and period;
   - status;
   - stack, including databases and ORMs;
   - the links that exist (repository, package, docs);
   - 1–2 screenshots with alt text;
   - "the problem" in 2–3 sentences;
   - 3–5 contribution bullets.
2. **Data:** add the optional detail fields to `data/projects.ts` and fill SQLOrbit only.
3. **Template:** a `ProjectDetail` component and an `app/projects/[slug]/page.tsx` route that generates only projects with approved content (others return 404). It reuses `SiteHeader`, `HeroRule`, `.lab-chip` and the type scale.
4. **Link:** set SQLOrbit's `href`, after deciding on the homepage (§5). The other six keep "Coming soon".
5. **Checks** (short): typecheck; keyboard; one visual at 1648 × 928 and one at 390 × 844; and the lab's deep link round trip (lab → page → back to the same station and project).

It is meaningful because it turns the first dead end into a real destination and proves the template every other project will reuse. It is small: one route, one component, additive data, no change to the scene, animations or artwork.

**Then:**
- **M1.4L.3:** the other six pages as their content arrives. Engineering's TableRefresh first: same station, similar shape.
- **Koreez:** decide whether it is an employment entry or a project. Its page may want role and period first.
- **Wallpapers:** needs a small gallery block.
- **Later:**
  - a `/projects` index, so "Projects" in the header stops pointing at an anchor;
  - clarify the three ambiguous sentences (Koreez, Wallpapers, AZIZ) in `data/projects.ts`; they also show in the lab.

**Before building anything,** gather each project's content with the §4 table as the checklist.

## Files

- `work/detail-capture.mjs`: each project's detail view (deep link): screenshot, panel crop, measurements (`work/detail-metrics.json`).
- `work/detail-room.mjs`: room between the panel and Engineering's label under each station's shot, at two sizes (`work/detail-room.json`).
- `work/captures/*.png`: the views and panel crops, ignored by Git (`docs/**/*.png`).
