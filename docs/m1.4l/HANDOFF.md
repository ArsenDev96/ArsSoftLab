# M1.4L handoff: office to home

**State.** Branch `feat/lab-v2`, after this checkpoint. **M1.4L.1 (audit) is done. M1.4L.2 has not started:** no application code has been written for it.

## Where things stand

| Milestone | State | Record |
|---|---|---|
| M1.4K, M1.4K.3 | Verification (CONDITIONAL GO), lag diagnosis, compositing prototype (no change kept) | `docs/m1.4k/`, `docs/performance/animation-lag-diagnosis.md`, `compositing-optimization.md` |
| M1.4K.4 / 5A | Lite mode for all five stations, approved and committed (`a80b16e`) | `docs/performance/lightweight-mode-*.md` |
| M1.4K.5B | Cinematic / Lite selector in `/lab-v2`'s header, approved and committed (`e9f6cd5`) | `docs/performance/render-mode-selector.md` |
| **M1.4L.1** | **Project detail audit, done** (this checkpoint) | [`PROJECT-DETAIL-AUDIT.md`](PROJECT-DETAIL-AUDIT.md) |
| **M1.4L.2** | **Next: SQLOrbit project page. Not started** | this file |

## Current implementation (from the audit)

- **Data.** `data/projects.ts` lists 7 projects (SQLOrbit, TableRefresh, AriMap, Armat, AZIZ, Wallpapers, Koreez). Each has a name, a `slug` (reserved for detail pages), a station, **one owner-written sentence**, and an optional `href` that is **unset for all seven**. `data/zones.ts` lists the 5 stations.
- **Detail surface.** Selecting a project (`components/lab/StationPanel.tsx`, in the hero slot) shows its name, its sentence and an "Open project" action. Because no project has an `href`, that action is disabled and says **"Coming soon"** for every project.
- **Shared panel.** The same panel serves the homepage `/` and `/lab-v2`.
- **No other project information anywhere in the repo:** no links, screenshots, role, stack or contributions.

## Audit findings (short)

- **Strengths:**
  - consistent with the cinematic lab;
  - scene chips and hero names stay in sync;
  - shareable `?station=…&project=…` URLs;
  - good accessibility;
  - readable text (about 15 px, 9–13:1 contrast);
  - honest content handling.
- **Weaknesses:**
  - every "Open project" is a dead end;
  - one sentence per project;
  - the project is secondary to the station heading;
  - **no room to grow in the hero**: under every camera shot, Engineering's label rises 8–41 px above the panel's last row at 1648 × 928;
  - Koreez, Wallpapers and AZIZ have unclear sentences;
  - there is no project index.

## Decisions

1. **One reusable project-detail page**, in the lab's visual language (type scale, amber rule, chips, header). Every block renders only if its content exists. **SQLOrbit first;** the others follow as their content arrives.
2. **Experimental route: `/lab-v2/projects/sqlorbit`.**
   - It lives under the experimental `/lab-v2`, so it is not indexed and not linked from production. That makes the route `app/lab-v2/projects/[slug]/page.tsx`.
   - The audit's `/projects/[slug]` is the later, public location.
3. **The production homepage `/` must remain unchanged.**
   - `StationPanel` is shared, so SQLOrbit's "Open project" must link **only in `/lab-v2`**.
   - On `/` it must still say "Coming soon".
   - Setting `href` globally in `data/projects.ts` would change `/`, so scope it to `/lab-v2` (for example a prop or a lab-v2-only destination). Check that `/` renders byte-identical, as in M1.4K.5B.
4. **SQLOrbit is in development:**
   - the page must say so;
   - **do not invent** releases, versions, download or repository links, screenshots, metrics, users, or security reviews and approvals;
   - only content supplied by the owner goes in, and blocks without content are left out.

## M1.4L.2: next milestone (not started)

**Goal:** turn SQLOrbit's "Coming soon" in `/lab-v2` into a real page.

1. **Content from the owner** (prerequisite):
   - status wording;
   - role and period;
   - stack (databases and ORMs);
   - only the links that exist;
   - screenshots with alt text, if any;
   - "the problem" in 2–3 sentences;
   - 3–5 technical-contribution bullets.

   Anything not supplied is left out.
2. **Data:** add optional detail fields to `Project` (role, period, status, stack, links, media, sections), and fill SQLOrbit only.
3. **Template:**
   - a `ProjectDetail` component and `app/lab-v2/projects/[slug]/page.tsx`;
   - only projects with approved content are generated, the others return 404;
   - it reuses `SiteHeader`, `HeroRule`, `.lab-chip` and the hero's type scale;
   - no new animation, and reduced motion respected.
4. **Link:**
   - "Open project" for SQLOrbit goes to `/lab-v2/projects/sqlorbit`, in `/lab-v2` only;
   - the page's "Back to the lab" returns to `/lab-v2?station=engineering&project=sqlorbit`, keeping `render` if it was set;
   - the other six keep "Coming soon".
5. **Checks** (short):
   - typecheck and keyboard;
   - one visual at 1648 × 928 and one at 390 × 844;
   - the lab → page → lab round trip;
   - `/` unchanged.

The proposed SQLOrbit block structure is in the audit, §5.

## Other open items (unchanged by this checkpoint)

> **Closed since (2026-11-26, M1.4K.6–M1.4K.10):** the RTX 4060 checks, D1 (fixed), D2 (accepted as P3), the selector delay (31–49 ms in production) and the floor tone (Cinematic default). See `docs/m1.4k/NOTES.md`.

- **RTX 4060 (home):**
  - full mode unchanged: `docs/performance/work/lite-capture.mjs` with `compare.py`;
  - lite measured once: `lite-perf.mjs`;
  - `lite5-check.mjs`;
  - M1.4K's release conditions in `docs/m1.4k/NOTES.md`.
- **M1.4K defects:** D1 (Playground lights early on a quick return) and D2 (AZIZ chip during descent) remain open in full mode (`docs/m1.4k/defects.md`).
- **Selector:** a switch waits 0.65–1.9 s for the dev server; a production build was not measured.

## Running at home

```bash
git fetch origin && git checkout feat/lab-v2 && git pull
npm install
npx next dev -p 3002     # the probes default to http://localhost:3002 (BASE to override)
npm run typecheck
```

The probes in `docs/*/work/` start their own headless Chrome (`scripts/visual/cdp.mjs`). Each run leaves a temporary profile (`arssoftlab-visual-*`) in the system temp folder, which can be deleted afterwards. Captures (`*.png`) are ignored by Git; the probes regenerate them.
