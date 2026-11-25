# M1.4K: paused, how to resume

**The review is not finished. No GO / NO-GO can be given yet.** Paused 2026-11-26, 00:45, on the home computer at the owner's request. Review only: no application code, artwork or animation was changed.

**Not written yet:** `NOTES.md`, `defects.md`, `performance.md`, the six sheets and the video. Two scripts for them do not exist yet either (section 4).

## 1. State when paused

Home computer: Chrome 158, RTX 4060, 60 Hz, 1648 × 928, the dev server on port 3002. Results: `work/results/`.

| Test | State | Saved |
|---|---|---|
| Baseline: git status, checksums of 432 app files | **Completed.** Rechecked when pausing: 432 of 432 unchanged | `work/git-status-start.txt`, `work/baseline.md5` |
| `k1-stations` (section 3 of the brief), 5 runs × 5 stations | **Completed** | `k1.txt`, `k1-stations.json` |
| `k3-switching` (section 4), 165 runs | **Completed** | `k3.txt`, `k3-switching.json` |
| `k3-switching hub,around`, trial, 10 runs | Completed, replaced by the above. Made before the one-frame rule (section 2) | `k3-switching-hub-around.json` |
| `k5-quick test`, Educational only, 64 runs | **Completed** (trial) | `k5-quick-test.json` |
| `k5-quick a`, all stations, 320 runs (section 5) | **Interrupted.** Engineering finished (64 of 64). Educational was running; Playground, Creative Studio and Experience had not started. The script writes its data only at the end, so **Engineering's summary line is all that was kept** | `k5-a.txt` |
| `k5-quick` with the CPU slowed 4 and 6 times | Not started | |
| `qr-run` (Educational, Creative Studio, Experience), `eng-return` (Engineering) | Not started | |
| `k6-hits`, `k6b-map`, `transitions` (section 6) | Not started | |
| `k7-captures` (sections 2, 3, 7, 9, 11) | Not started | |
| `k8-perf`, `perf`, `decode`, `p4-perf` (section 8) | Not started | |
| `k9-viewport` (section 9) | Not started | |
| `p5-a11y`, `nav` (section 10) | Not started | |
| `k10-firefox`, Edge (section 12) | Not started | |
| Floor tone (section 11): captures, `k8-perf`, `perf` | Not started | |
| `npm run typecheck` for this milestone | Not started (it passed at the end of M1.4J.4; no app file has changed since) | |

**`k6-hits`, `k6b-map`, `k7-captures`, `k8-perf`, `k9-viewport` and `k10-firefox` have never been run.** Only their syntax was checked (`node --check`). Expect small corrections to the probes. `qr-run`, `eng-return`, `perf`, `decode`, `nav`, `transitions` and the `p*` files are copies of earlier milestones' probes with only their imports changed, so that nothing in those folders is overwritten.

## 2. Findings so far (partial)

**No P0 or P1 found yet.** This covers only the tests above.

| | Lift (approved) | First movement / half / full | Down | Frames in 800 ms, first visit → later |
|---|---|---|---|---|
| Playground | 18.0 (18) | 17 / 200 / 450 ms | 450 | 33 → 47–49 |
| Engineering | 12.2 (12) | 80 / 247 / 663 | 417 | 42 → 48 |
| Educational | 10.1 (10) | 107 / 290 / 757 | 417 | 48 → 48 |
| Creative Studio | 10.1 (10) | 110 / 293 / 760 | 417 | 48 → 48 |
| Experience | 10.1 (10) | 107 / 307 / 790 | 417 | 48 → 48 |

Heights are scene px; whole device pixels, hence 12.2 and 10.1. Times are after the spark's arrival, medians of 5.

- **`k1`, all 25 runs:** nothing moves or lights before the arrival; every layer together (spread 0); no overshoot; no other station moves, lights or sparks; 0 of 18 floor parts move; at rest afterwards, no residual. 0 errors.
- **`k3`, 165 runs, 0 flagged:** every pair in four phases (80), re-entering during descent (55), sweeps (20), random walks (6), across the A (4). Right heights, one spark per visit, nothing stuck. 0 errors.
- **`k5`:** Engineering 64 of 64, Educational (trial) 64 of 64, 0 flagged.

To look at again before they are classified:

| Observation | What is known |
|---|---|
| First visit on a new page has one long frame: 100 ms (Engineering, the first station visited), 150 ms (Playground) | As in M1.4I.2. Whether the lifts made it longer is open: `k8-perf`, `perf` |
| Engineering's scan stays visible 6–12 frames (about 100 ms) after leaving, at up to full strength | M1.4I listed a 100 ms fade as intended. Not yet checked by eye with the lift |
| Playground's strips and lift can start one frame (16.8 ms) before the spark's own clock | The spark's animation starts up to one frame after the styles that wait for it. The rule in `analyse.mjs` therefore allows 18 ms; 12 of 165 runs used it. Beyond that, nothing |
| In a sweep up to five sparks are visible at once; one pair had two stations not at rest at once | M1.4I: release fades, intended. Confirm |
| Educational's early strip or pool light (M1.4J.2: 2 of 122) | Not seen in 64 runs. `qr-run educational` and the slowed runs are the real test |
| Playground's title, leftmost pixel column (M1.4I.2.1) | Not tested yet: `k6-hits outline` |

## 3. Commands to resume

Git Bash, from the repository root. Needs Node 22 or later, Chrome; Firefox and Edge for section 12; Python with NumPy and Pillow for the sheets. Run one test at a time, with nothing else using the GPU.

```bash
git fetch && git checkout feat/lab-v2 && git pull
npm ci                                   # only if node_modules is missing or older
npm run dev -- --port 3002               # in a second terminal; leave it running
git diff --stat HEAD -- app components data lib public scripts     # must print nothing
npm run typecheck
cd docs/m1.4k/work
```

- Another port: `export BASE=http://localhost:<port>`. Chrome elsewhere: `export CHROME_PATH="<path>"`.
- Do not use `baseline.md5` on another computer: Git may change line endings. Use the `git diff` above.
- `results/` is in Git. Use new labels so that the home results stay.

**Quick returns (section 5).** Complete, because the interrupted run kept no data (64 runs took about 4 minutes here):

```bash
node k5-quick.mjs b  1 1 > results/k5-b.txt  2>&1     # all five, 320 runs; "b" replaces the interrupted "a"
node k5-quick.mjs x4 4 1 > results/k5-x4.txt 2>&1     # CPU slowed 4 times
node k5-quick.mjs x6 6 1 > results/k5-x6.txt 2>&1
for s in educational creative experience; do node qr-run.mjs k $s mouse grid sequences edge > results/qr-$s.txt 2>&1; done
node eng-return.mjs k grid mouse sequences > results/qr-engineering.txt 2>&1
mv qr-*-k.json eng-k.json results/
```

To run only what had not finished: `node k5-quick.mjs b 1 1 educational,playground,creative,experience`. Repeat anything flagged before believing it: `node k5-quick.mjs again 1 5 <station>`.

**Hover and clicks (section 6).**

```bash
node k6-hits.mjs chips   > results/k6-chips.txt   2>&1     # 7 chips x 3 places x 8 moments
node k6-hits.mjs still   > results/k6-still.txt   2>&1
node k6-hits.mjs outline > results/k6-outline.txt 2>&1     # with every pixel of Playground's title
node k6b-map.mjs         > results/k6b.txt        2>&1
node transitions.mjs k all > results/transitions.txt 2>&1 && mv transitions-k.json results/
```

**Captures (sections 2, 3, 7, 9, 11).** Images are ignored by Git.

```bash
node k7-captures.mjs captures full,phases,hub,seams,raised > results/k7.txt 2>&1
node k7-captures.mjs captures viewport > results/k7-viewport.txt 2>&1
```

**Viewports (section 9):** `node k9-viewport.mjs > results/k9.txt 2>&1`

**Navigation and accessibility (section 10).**

```bash
node p5-a11y.mjs > results/a11y.txt 2>&1 && mv a11y.json results/
MSYS_NO_PATHCONV=1 OTHER=/nope node nav.mjs k > results/nav.txt 2>&1 && mv k.json results/nav-k.json
```

Still to check by hand or with a small probe: the "Let's Talk" mail link, and that `/` requests nothing under `/scene/v2/`.

**Browsers (section 12).**

```bash
node k10-firefox.mjs captures/firefox > results/k10-firefox.txt 2>&1     # its path is fixed: C:/Program Files/Mozilla Firefox/firefox.exe
cp results/k1-stations.json results/k1-stations-chrome.json
CHROME_PATH="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" node k1-stations.mjs 2 > results/k1-edge.txt 2>&1
mv results/k1-stations.json results/k1-stations-edge.json && mv results/k1-stations-chrome.json results/k1-stations.json
```

**Performance (section 8) and the tone's cost (section 11).**

```bash
node k8-perf.mjs > results/k8.txt 2>&1                                   # lifts on against held at 0
MSYS_NO_PATHCONV=1 node k8-perf.mjs "/lab-v2?floor=approved" > results/k8-tone.txt 2>&1
node perf.mjs k 3 > results/perf.txt 2>&1 && mv perf-k.json results/
MSYS_NO_PATHCONV=1 node perf.mjs k-tone 3 "/lab-v2?floor=approved" > results/perf-tone.txt 2>&1 && mv perf-k-tone.json results/
node decode.mjs k > results/decode.txt 2>&1 && mv decode-k.json results/
node p4-perf.mjs load > results/p4-load.txt 2>&1
node p4-perf.mjs growth > results/p4-growth.txt 2>&1 && mv perf-load.json perf-growth.json results/
```

## 4. Still to write
- The sheet script (`all-five-lifts`, `connection-closeups`, `viewport-comparison`, `floor-tone-comparison`, the two full scenes) and the video script (`station-switching.webm`; `docs/m1.4i/work/p7-video.mjs` is the pattern, and its output path must be changed). The video must be disclosed as frame-stepped.
- `NOTES.md`, `defects.md`, `performance.md`, with the 11 points of the brief and the recommendation.

## 5. Home or office

- **Section 8 of the brief asks for the RTX 4060.** Its measurements have to be made at home. Run at the office, the same commands measure the Radeon HD 5450, which no lift has been measured on yet: useful, but report it separately (add `-office` to the labels).
- **On the office GPU, timing results differ.** M1.4J.2 recorded the spark's clock starting up to about 80 ms late there under load, and a few flags from it. Do not mix both computers in one table; repeat flagged runs.
- Functional tests (clicks, viewports, navigation, browsers) can run on either.
- The images and videos of M1.4J.3 and M1.4J.4 are ignored by Git and stay on the home computer. Their notes, data and probes are pushed.
