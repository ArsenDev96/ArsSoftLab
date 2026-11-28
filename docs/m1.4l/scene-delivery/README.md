# M1.4R.1 evidence: scene asset delivery

This folder backs [`../SCENE-DELIVERY-AUDIT.md`](../SCENE-DELIVERY-AUDIT.md).

**Measurement conditions:**

- Collected on 28 Nov 2026, 15:00–15:12 local time, on an idle machine.
- Home computer with an RTX 4060; Chrome 158.0.8127.88 headless.
- A production build of `f724729`, served by `next start` on localhost (HTTP/1.1).

**Not kept:** traces, screenshots, Chrome profiles, server logs.

## Results (`results/`)

| File | What it holds |
|---|---|
| `scene-assets.csv` | One row per scene asset requested on an initial, unthrottled load of `/`, `/lab-v2` and `/lab-v2?render=lite` (173 rows). Columns: transfer size, decoded dimensions (read from the file headers), Cache-Control, ETag and Last-Modified presence, its role for `PlateGate` (awaited by it, in the gated layer but not awaited, or outside the gate), how the page uses it, fetch priority, initiator, and start and end times |
| `inventory-summary.json` | Per route: the gate scripts and how many assets each awaits; every non-scene request (type, Cache-Control, render-blocking status); and scene URLs referenced in the DOM but not fetched on initial load |
| `delivery.json` | The controlled delivery measurement: 2 routes × 3 visit types × 2 network profiles × 7 trials. Per trial: FCP, scene first visible, scene fully visible, gate style time, image delivery end, scene requests, wire 200 and 304 counts, disk- and memory-cache hits, network bytes |
| `profile-shutdown.json` | The secondary reused-profile experiment: FCP on a reused profile when Chrome is killed 0.3 s or 1.5 s after `Browser.close`, for `/`, Lite and Cinematic (5 trials each), and each profile's persistent Graphite cache size |

## Scripts (`scripts/`)

Run them from this folder against a production server (`npm run build`, then `npm run start`). They use the launcher in `../../first-paint/scripts/cdp2.mjs`.

| File | Purpose |
|---|---|
| `sd-inventory.mjs` | The inventory. Set `PUBLIC_DIR` to the repository's `public` folder so dimensions can be read from the files. It deliberately never loads images in the page: an earlier version used `new Image()` to read dimensions, and its own requests showed up as a late "wave" of duplicate and fallback fetches |
| `sd-measure.mjs` | The delivery measurement, with these conditions:<ul><li>One Chrome with a fresh profile per cell, warmed by one unthrottled visit, so every trial has the same warm GPU state.</li><li>Before each measured visit the tab goes to another site, forcing a new renderer process, so only the HTTP disk cache can help.</li><li>Every cell goes through a test-only local proxy. One port passes headers through; the other rewrites `/scene/*` to `Cache-Control: public, max-age=86400` (the `repeat-fresh` cells).</li><li>Network emulation: `50-20` (50 Mbps, 20 ms RTT) and `12-70` (12 Mbps, 70 ms RTT).</li></ul> |
| `sd-summary.mjs` | The median [min–max] and IQR table from `delivery.json`. Scene-visible time is clamped to no earlier than FCP |
| `sd-profile.mjs` | The shutdown-delay experiment |
