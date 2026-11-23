# M1.4I.1A: Black scene after client-side navigation

**Fixed on `/` and `/lab-v2`** (M1.4I defect P1-1). Verified on the dev server only, in Chrome. Nothing committed or pushed. Branch `feat/lab-v2`, on top of `65c2c77`.

| | Before | After |
|---|---|---|
| Route entries that showed the scene | 15 of 51 | **60 of 60** |
| Entries with a console error | 17 | **0** |
| Station activations that powered and returned to rest | 7 of 7 possible | **38 of 38** |

All 36 black entries were in documents that had not been loaded on a lab page. The "after" total is higher because it also includes a second run on 404 pages.

## 1. Root cause
**Missed initialization.** The two scene layers (`.lab-plate-gate`) start at `opacity: 0` in `globals.css`. An inline script in the page opened them, by adding one rule to `<head>` once every scene image had decoded, or after 4 s.

- The browser runs that script only when it parses it from the server's HTML.
- After a client-side navigation React creates the `<script>` element itself, and a script created that way never runs. Neither the image wait nor the 4 s fallback starts, so the scene stays at opacity 0.
- Next documents this in `preventing-flash-before-hydration.md` ("Scripts inserted via DOM updates don't execute").

Evidence on the original code:
- Every scene image was loaded and decodable (29 of 29, 84 of 84), no 4 s timer existed and the rule was missing.
- **Executing the same script text by hand opened the scene at once** (opacity 0 → 1), with nothing else changed.
- Remounting six times, Back and Forward never recovered it. Only a full load did.

**Why it was easy to miss:** the rule survives route changes. Once a document has been loaded on `/` or `/lab-v2`, every later navigation in it works, including `/` ↔ `/lab-v2`.

Ruled out: image loading or decoding, invalid references, WebGL/Canvas, CSS transitions, animation loops and effect cleanup.

## 2. Files changed

| File | Change |
|---|---|
| `components/lab/PlateGate.tsx` | New client component: the same inline script, plus an effect |
| `components/lab/PlatformPower.tsx` | `PlateGate` and its script removed (moved) |
| `components/lab/LabScene.tsx` | Import path |

No CSS, asset, station, animation, label or contact change. Probes and data are in `docs/m1.4i1/work/`. The temporary test route was removed.

## 3. Why this fixes it
- **Full load:** the inline script runs as before. It also sets `window.__labGate`, so the effect does nothing. Image decodes on a full load are unchanged (78 on `/`, 84 on `/lab-v2`).
- **Client-side entry:** the flag is not set, so the effect opens the gate, under the same condition and with the same 4 s fallback.
- **Later mounts:** the flag is set and the rule is in place, so there is no timer, decode or second rule.
- **Leaving before it opens:** cleanup cancels the timer, and the next mount starts over.
- On the client the script has `type="text/plain"`, as Next recommends, which removes React's "Encountered a script tag" error.

## 4. Reproduction before the fix
1. Full load of a page without the lab: any 404 such as `/nope`, or a test route with `next/link` links.
2. Click a link to `/` or `/lab-v2`, or run `window.next.router.push("/lab-v2")`.
3. Header, hero text and labels show on black, and stay so (sampled for 20 s). A reload shows the scene.

## 5. Verification after the fix
`npm run typecheck` passes, also after the test route was removed.

| Entry | Before | After |
|---|---|---|
| Full load of `/` and `/lab-v2`, and reload | shown | shown |
| Client-side from a test route (`next/link`) | black | shown |
| Client-side from a 404 (router) | black (M1.4I) | shown |
| `/` → `/lab-v2` → `/`, first entry by full load | shown | shown |
| `/` → `/lab-v2` → `/`, first entry client-side | black, 3 of 3 | shown |
| Back and Forward, including across both labs | black, 5 of 5 | shown |
| Loaded on a lab, left, Back | shown | shown |
| Six mounts and unmounts, each lab | black, 12 of 12 | shown |
| `?station=experience` client-side, then Back and Forward | black | shown, station selected |
| Left while images were held back, then returned | black | shown |
| Images that never arrive | black client-side | fallback opens it (4.5–4.8 s from the click) |
| Reduced motion, full load | shown | shown |
| Reduced motion, client-side | black | shown; arcade still, no lift, no spark |

- **Activation:** Playground powered on, ran its arcade and returned to rest in all 38 checks, covering every kind of entry above except reload, deep link and stalled images. Under reduced motion its still state was checked instead.
- **No duplicate loops:** one animation frame callback per frame while the arcade runs, 0 at rest, on every mount.
- **Cleanup:** over six mounts, 160 listeners while mounted and 156 after leaving, with no growth; the same as before the fix. No gate timer was left pending.
- **No reloads:** on the test route, every client-side entry stayed in the same document.
- **JavaScript off:** both pages still show the scene.

**Appearance**
- Homepage: full loads are identical on the original and the fixed code (8 captures each, difference 0). Client-side entry is identical to a full load.
- `/lab-v2`: client-side entry matches a full load within 2 of 255.
- Two capture variations exist on the original code as well, and are not caused by the fix. Playground's cabinet on `/lab-v2` is sometimes resampled (max 66; 3 of 5 original full loads, 4 of 5 fixed ones). One original homepage capture was resampled (max 37), taken just after the files had been swapped, and did not recur.

## 6. Remaining limitations
- **Dev server only.** A production build was out of scope. React Strict Mode in development runs the effect twice, so a first client-side entry there asks for each image to decode twice; a production build runs it once.
- **Chrome only.** Firefox, Edge and Safari were not rerun.
- **Lab to lab in one document:** the gate is already open, so the second page's images are not waited for. This is unchanged. On localhost they were all in by the first frame seen; on a slow connection they could appear one after another.
- **Back to a 404** causes a full load, done by Next. The scene still shows on Forward.
- The gate's condition now exists twice, in the inline script and in the effect. Change both together.
- The other M1.4I findings were not touched.
