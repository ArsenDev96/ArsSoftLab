# M1.3B part 2: URL deep-linking

Every station and project can now be linked directly. Browser Back and Forward walk through selections. At `/` the lab is pixel-identical to the M1.3A code.

## URLs

| URL | State |
| --- | --- |
| `/` | the lab |
| `/?station=engineering` | Engineering |
| `/?station=engineering&project=sqlorbit` | Engineering + SQLOrbit |
| `/?station=educational&project=arimap` | Educational + AriMap |

All five stations and seven projects use their existing ids. The routing code has no project-to-station table: it reads `LAB_ZONES[].projects`.

## Design

```
request  /?station=engineering&project=sqlorbit
  app/page.tsx (server)  resolveLabLocation(query)  ──initial──▶  LabStateProvider
                                                                   useReducer(labReducer, initial)
click / key / tap ─▶ dispatch ─▶ reducer ─▶ effect: URL ≠ state?  ─▶ history.pushState
Back / Forward ─▶ popstate ─▶ dispatch "restore" ─▶ reducer ─▶ effect: URL = state ─▶ nothing
load or popstate on a non-canonical URL ─▶ history.replaceState (canonical form)
```

- **One source of truth.** The reducer holds the state. The URL is written from it and read into it only on load and on `popstate`.
  - The write effect compares the URL with the state and pushes only when they differ.
  - A restored or initial selection already matches the URL, so nothing is ever written back. There is no loop and no flag to keep in sync.
- **Server-resolved initial state.** The page reads `searchParams`, so a deep link is rendered already selected:
  - no flash of the default lab;
  - no camera transition (the transform is there on the first style pass);
  - no hydration mismatch (server and client start from the same prop).

  The cost: `/` is now rendered per request (`ƒ`) instead of prerendered.
- **History.**
  - One entry per selection change: station, project, project cleared, switch, Back to Lab or Escape.
  - Hover, keyboard focus and the "returning" phase are not in the URL and never touch history.
  - Native `pushState` / `replaceState` integrate with the App Router. Tests confirm that no RSC request is made and the page is never reloaded.
- **Normalization.** The URL keeps the longest valid part of station → project. The URL is rewritten in place and no entry is added.
  - unknown or missing station → `/`
  - project unknown or of another station → the station alone
  - matching is case-insensitive
  - a repeated parameter uses its first value
  - unrelated parameters are kept
- **Focus.** A panel moves focus to its heading only when it changes from closed to open, so a deep link loads with focus at the top of the page.
  - Back / Forward behave like the matching action: focus goes to the heading on open, or back to the station title on return.
  - Returning to the lab restores focus as in M1.3A.

## Files

| File | Change |
| --- | --- |
| `lib/lab-url.ts` | New. Parse, normalize and serialize; pure and shared by the server and the client. |
| `app/page.tsx` | Async; resolves `searchParams` and passes `initial` to the provider. |
| `components/lab/LabState.tsx` | `initial` prop, `restore` action, URL sync effects (push, popstate, canonicalize). |
| `components/lab/StationPanel.tsx` | Focus only on a closed → open change (no focus jump on load). |
| `scripts/visual/urls.mjs` | New. Deep-link probes, history and transition instrumentation, invalid-URL table. |
| `scripts/visual/check.mjs` | Section 12 (deep links) and deep-link pixel comparisons. |
| `scripts/visual/cdp.mjs` | Pins `prefers-reduced-motion` in both modes; longer Chrome start-up wait. |
| `README.md` | Deep-link section and test list. |

## Tests

`npm run typecheck` and `npm run build` pass. `npm run visual` passed **262 of 265** (`regression.txt`).

New checks (all pass):
- **Direct navigation.** Each of the 5 stations is selected with its info, the camera is framed with no transition, focus is not moved, the URL is kept and nothing is pushed. Each of the 7 projects shows its approved summary.
- **Invalid URLs.** 13 invalid or non-canonical URLs normalize in place.
- **History.**
  - One entry per selection; hover and focus add none.
  - Back restores every step, including the lab with the camera home and focus on the station. Forward replays them (`history.txt`).
  - No reload and no server fetch.
- **Return to Lab, Escape and keyboard** from a deep link.
- **Reduced motion and touch** with deep links.
- **Console.** No console errors or hydration warnings on any deep-link page (production build).
- **Pixels.**
  - A deep link matches the same state selected by click: max 3/255 outside the in-scene chips.
  - Returning to `/` after a deep link, or via Back, matches idle (max 0).

The 3 failures are the comparisons against the M1.1 baseline PNG: idle, reduced-motion idle and invalid link. They are environmental and predate this milestone.
- Chrome on this machine updated to 157 on 2026-11-19. The plate is now resampled slightly differently (mean 1.12, max 72, on edges across the whole frame, header included).
- A/B with the same Chrome: the unchanged M1.3A commit gives exactly the same numbers against the baseline. M1.3B part 2's `/` is pixel-identical to it (max 0, five repeats, invalid links included).

## Known issues

1. **The M1.1 baseline needs re-capturing for Chrome 157.** Until then the three baseline checks fail on any code.
2. **`/` is dynamic.** It is rendered per request instead of prerendered, which is the price of a correct first paint for deep links. A CDN can still cache it per query string.
3. **The Engineering chips raster differently** when they arrive through the camera and lift animation than when painted at rest (max 225 on about 2,000 px, sub-pixel and not visible at 4×). This is the Chrome behaviour noted in M1.3A limitation 3. The deep-link comparison reports that box separately.
4. **Occasional plate raster variance.** In 2 of about 8 fresh-browser captures, the plate was painted with a slightly different filter (whole frame, max 37–72). It is unrelated to state (identical DOM) and did not reproduce in repeats.
5. **Environment.** Windows "Animation effects" off makes Chrome report reduced motion. The harness now pins the preference; earlier runs on such a machine silently tested reduced motion only.
6. **Document title** is unchanged per station; share previews show the lab's title.

## Next milestone

M1.3C: share-ready links.
- `generateMetadata` per station / project: title, description, Open Graph.
- Update `document.title` on selection.
- A "Copy link" action in the station panel.
- Re-capture the baseline for the current Chrome.
