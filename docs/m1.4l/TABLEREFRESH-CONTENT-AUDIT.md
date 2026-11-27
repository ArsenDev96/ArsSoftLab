# M1.4L.4A: TableRefresh content and media audit

**Purpose:** verified facts and draft content for a TableRefresh case study at `/lab-v2/projects/tablerefresh`, built on the existing project-detail system. Audit only:
- no application code, project page or portfolio data was changed;
- the TableRefresh repository was only read.

**Sources:**
- **The local repository** `D:\tableRefresh`:
  - `main` = `6f05d33` = tag `v1.0.1`; clean working tree;
  - `origin` is `github.com/ArsenDev96/tableRefresh`.
- **The public WordPress.org listing**, read live on **2026-11-27 (08:04 UTC)**:
  - the plugin page;
  - the plugin information API;
  - the plugin's SVN repository (`tags/`, `assets/`);
  - the two release ZIPs, downloaded and compared file by file with the repository.

**Rule used below:** a fact is **verified** only if the code, the repository's own test records or the live listing shows it. The plugin's readme is the author's documentation; where it describes behaviour, the code was checked too. Installation counts, ratings and reviews are **not** used anywhere.

## Summary

- **TableRefresh is a released, public WordPress plugin.**
  - Listed in the WordPress.org plugin directory since **2026-11-05**.
  - Current version **1.0.1**, updated **2026-11-20**.
  - Both released versions trace exactly to commits in the repository.
- **It synchronizes one way:** a CSV file or a public Google Sheet → an existing TablePress table, hourly, daily, weekly or on demand.
  - The engineering weight is in making unattended updates safe: all-or-nothing writes with recovery, conflict detection against edits in TablePress, locking, scheduling on WP-Cron, and source hardening.
- **The test evidence is strong for 1.0.0 and thinner for 1.0.1.**
  - 1.0.0 has a full recorded release verification.
  - For 1.0.1 the repository records one compatibility run (273 test cases, all passing); its other planned checks have no record.
- **Five authentic, current interface screenshots exist:** the WordPress.org set, byte-identical to the repository's copies, with fictional sample data. Older development screenshots are outdated and unsuitable.
- **The page needs no redesign.** Every content field already exists in `ProjectDetail`. One small template step is recommended so wide screenshots can use the existing full-size viewer (§8).

## 1. Verified facts

### Identity and distribution

| Fact | Value | Verified by |
|---|---|---|
| Name | **TableRefresh – Auto Sync for TablePress** (directory name); "TableRefresh" in the portfolio | listing, plugin header |
| Slug / text domain | `tablerefresh` | listing, plugin header |
| Author / contributor | Arsen Manukyan (`arsenmanukyan` on WordPress.org) | listing, API, plugin header |
| License | GPL-2.0-or-later | plugin header, readme |
| Public listing | https://wordpress.org/plugins/tablerefresh/ (live; no warning or closure notice) | fetched 2026-11-27 |
| Added to the directory | **2026-11-05** | API `added` |
| Current version | **1.0.1**, last updated **2026-11-20, 11:29 GMT** | API, listing ("Version 1.0.1") |
| Released versions | 1.0.0 and 1.0.1 (SVN `tags/`) | SVN |
| Published 1.0.1 = repository | WordPress.org's `tablerefresh.1.0.1.zip`: 25 files, **identical** to `git archive v1.0.1` (`6f05d33`) | ZIP compared file by file |
| Published 1.0.0 = repository | `tablerefresh.1.0.0.zip`: 25 files, **identical** to `f269c27` ("RC6", untagged) | ZIP compared file by file |
| Requirements | WordPress **6.7+**, PHP **7.4+** (with cURL), the free **TablePress 3.0+** (declared with `Requires Plugins: tablepress`), MySQL or MariaDB with InnoDB. SQLite unsupported | header, readme, listing, code (`MIN_VERSION = '3.0'`) |
| Tested up to | WordPress **7.1.5** on the listing (the readme says 7.1; WordPress.org shows the latest 7.1.x) | API, listing |
| Directory tags | csv, Google Sheets, import, sync, tablepress | API |
| Independence | "An independent add-on for the free TablePress plugin … not made by, affiliated with, or endorsed by TablePress or its developer" | readme, listing |
| External services | Only the source address the user enters (and Google's servers for Sheets). No account, paid service or tracking | readme; code: the fetcher only requests the configured source |
| Source code | Public on GitHub (`ArsenDev96/tableRefresh`, HTTP 200). Tag `v1.0.1` on GitHub; no GitHub releases or Actions | `git ls-remote`, handoff |
| Size | About 5,400 lines in the plugin: 19 PHP classes, main file, uninstall, one JS and one CSS file | `wc` |

### Release history (repository records)

| Date (2026) | Milestone | Record |
|---|---|---|
| Oct 26 | Development builds 0.x; compatibility matrices begin | `dev/matrix-results.txt` |
| Oct 27 | RC1 tagged (`v1.0.0-rc1`); WordPress.org screenshots made; admin moved to a top-level menu below TablePress | `HANDOFF.md`, `release/README.md` |
| Oct 27–28 | RC2–RC5. RC4 fixed a scheduling race; RC5 had compliance fixes. RC5 submitted to WordPress.org on Oct 28 | `HANDOFF.md`, `rc*-results/` |
| Nov 1 | WordPress.org review "pending corrections" (prefixes, notice scope) → RC6 (`f269c27`) | `rc6-results/focused-verification.txt` |
| **Nov 5** | **Listed in the directory: 1.0.0 = RC6** | API `added`, ZIP comparison |
| Nov 19–20 | 1.0.1 scheduler work: a time budget per web cron request, fair ordering, deferral that keeps due times, and repairs for overlapping cron runs. Merged with RC6 | commits `e19e98c`…`e6a39d9` |
| **Nov 20** | **1.0.1 published** (`6f05d33`) | API `last_updated`, ZIP comparison |

### What it does (implementation verified in code)

| Area | Behaviour | Where |
|---|---|---|
| Sources | A CSV file at any web address; a public Google Sheet. Sharing links are converted to the CSV export address, and the tab comes from the link's `gid` | `class-google-sheets.php`, `class-csv-parser.php` (delimiters `,` `;` tab `|`) |
| Direction | **One way**: source → TablePress table. Only rows and columns are replaced; table ID, shortcode, name, description and options are kept | `class-table-updater.php`, `class-tablepress-adapter.php` |
| Scheduling | Hourly, daily, weekly (`FREQUENCIES`) on WP-Cron. Manual "Sync now". WP-CLI `sync` and `recover` | `class-scheduler.php`, `class-sync-config.php`, `class-cli-command.php` |
| Busy sites (1.0.1) | A web cron request starts no further sync after **10 s** (`TIME_BUDGET`, filterable); the first due sync always starts; the longest-waiting go first; deferred tables keep their due time | `class-scheduler.php` |
| All-or-nothing update | The complete file is downloaded and checked first. The write happens in a database **transaction** (`START TRANSACTION` … verify … `COMMIT`, `ROLLBACK` on failure, up to 3 attempts). A **journal** lets an interrupted update be finished or undone (`recover`, which also runs before every sync). On non-InnoDB storage, sync is refused unless explicitly allowed | `class-table-updater.php`, `class-journal.php` |
| Edits in TablePress | A table changed in TablePress after the last sync is not overwritten: automatic sync pauses until the user chooses **keep the changes** or **replace with the source**. A table open in the editor isn't synced, and an older editor session can't save over newer synced data | `class-editor-guard.php`, `class-sync-state.php`, Admin |
| Locking | One sync per table at a time; the lock expires after **300 s** (filterable) | `class-table-lock.php` |
| Failures | A failed sync leaves the table unchanged. After **5** failures in a row (`MAX_FAILURES`), automatic sync pauses until a successful "Sync now" | `class-sync-runner.php` |
| History | The last **10** attempts per table (`MAX_ENTRIES`), in plain language, plus the last successful sync | `class-sync-log.php` |
| Revisions | At most **5** sync-created revisions kept per table; the user's own revisions are never deleted | `class-revision-policy.php` |
| Source safety | Requests to private or internal networks blocked (`BLOCKED_RANGES`); ports 80 and 443 only; WordPress HTTP proxies refused unless allowed; at most **5 MB** and **15 s** per download, redirects included | `class-url-guard.php`, `class-http-fetcher.php` |
| Content safety | HTML filtered with `wp_kses_post()`; formulas (`=`…) and shortcodes from the source shown as text, not run (WP-CLI options can allow them for trusted sources) | `class-sync-service.php`, readme |
| Permissions | `manage_options` (filterable with `tablerefresh_capability`) **and** permission to edit the table in TablePress; nonces on every action | `class-admin.php`, RC6 audit |
| Admin | Top-level "TableRefresh" menu directly below TablePress: list, setup, settings and history, decisions; a phone layout | `class-admin.php`, screenshots |
| Uninstall | Deactivation stops schedules and keeps settings. Deletion removes settings, history, events, locks and journals; TablePress tables keep their data | `uninstall.php`, `ScheduledSyncTest` |

### Testing and compatibility (records in the repository)

**Tooling:**
- PHPUnit integration tests against real WordPress and TablePress in Docker: 21 test files, 177 test methods, expanded to 273 test cases;
- PHPCS (WordPress Coding Standards 3.1 with PHPCompatibilityWP);
- mutation testing (`dev/mutation-check.sh`, 65 mutations defined);
- compatibility matrices (`dev/test-matrix.sh`);
- WordPress.org Plugin Check;
- browser workflow and accessibility scripts (Puppeteer and axe-core);
- reproducible release ZIP builds.

| Release | Recorded verification | Source |
|---|---|---|
| **1.0.0** (RC6, `f269c27`, the published 1.0.0) | PHP 8.3 and 7.4 suites with a Redis object cache: **251 tests, 2,334 assertions, all passing**. PHP lint, 7.4 and 8.3: no errors. PHPCS: no findings. **Mutations: 48 of 49 caught**; the 49th is caught on PHP 7.4, an expected libcurl difference. Live Google Sheets group passes. Targeted matrix: TablePress 3.0, WordPress 6.7.10, PHP 8.4.27, each 251 tests passing. Upgrade from RC5 on a clean site: **62/62**. **Plugin Check 2.1.0: "No errors found."** Browser workflow from the uploaded ZIP: **38/38** | `dev/release-checks/rc6-results/focused-verification.txt`, `dev/matrix-results.txt` |
| **1.0.1** (`6f05d33`; plugin code as `e6a39d9`) | **One recorded run:** WordPress 6.7.10, TablePress 3.5, PHP 8.3.36, MariaDB 10.11 — **273 tests, 6,238 assertions, 0 failures** (4 skipped, as in every run). Before the RC6 merge, 18 of 18 scheduler mutations were caught | `dev/matrix-results.txt` (2026-11-20 08:54 UTC), `HANDOFF.md` |
| 1.0.1, **not recorded** | The handoff (2026-11-20, written before publication) lists these as **"NOT done yet"** on the merged code, and the repository has no results for them: the full mutation check (65), full suites on PHP 8.3 and 7.4 with Redis, the TablePress 3.0, PHP 8.4 and database matrices, Plugin Check on an installed build, the 1.0.0 → 1.0.1 upgrade check, and the browser workflow. 1.0.1 was published 40 minutes after its version commit | `HANDOFF.md` |
| Development (Oct 26) | Database servers MySQL 5.7, 8.0, 8.4 and MariaDB 10.11, 11.4: all passing (211 tests, `65d09f6`). **Every TablePress release 3.0–3.4.1** was run once (`2026-10-26 10:59`): 3.0.x had 8 failures each, and 3.2.7 and 3.3 had 1 each. These were fixed in the tests (`9ad4002`, which reads TablePress 3.0.x's editor variables); a representative re-run (3.0, 3.0.4, 3.1, 3.2, 3.2.7, 3.3, 3.4.1) passed. The full re-run stopped after 3.0.3 | `dev/matrix-results.txt` |

**What may be claimed publicly:**
- Tested with WordPress 6.7–7.1 (listing: up to 7.1.5), PHP 7.4–8.4, and TablePress 3.0 and 3.4.1.
  - These are the requirements and tested versions the plugin itself states.
  - They are backed by 1.0.0's recorded verification. For 1.0.1 the repository records only the WordPress 6.7.10 run on PHP 8.3.
- An automated integration suite, mutation testing and WordPress.org's Plugin Check were part of the release process (recorded for 1.0.0).

**What may not:**
- "every TablePress release passes on the current version";
- database-server compatibility for the released code (it was tested on a development commit);
- any test count for 1.0.1 beyond the one recorded run.

### Planned, deferred or out of scope (not to be presented as features)

- **Deferred** (handoff "Remaining"): matrices for TablePress 3.1–3.4 and MySQL 8.x on the release code; a screen-reader pass.
- **The remaining 1.0.1 checks** listed above.
- **Not supported** (readme, "Known limitations"):
  - private Google Sheets or any source that needs signing in;
  - formats other than CSV;
  - more than one source per table;
  - two-way sync;
  - downloads over 5 MB;
  - SQLite;
  - TablePress Pro and Max (untested);
  - multi-connection database drop-ins (untested).
- **WP-Cron dependency:** on quiet sites, syncs can run later than planned unless a server cron job drives WP-Cron.

## 2. Public release status

| Item | Status |
|---|---|
| Available | **Yes**, at https://wordpress.org/plugins/tablerefresh/, installable from *Plugins → Add New* |
| Version | **1.0.1** (2026-11-20). Changelog: improved scheduling on busy sites; slow syncs no longer repeatedly delay other tables; deferred syncs keep their due times; more reliable scheduling during overlapping or interrupted cron requests. Upgrade notice: existing settings are preserved |
| First release | 1.0.0, in the directory since 2026-11-05 |
| Description | As in the readme (§1): CSV or public Google Sheet → TablePress, hourly, daily, weekly or one click; edits never overwritten without asking; all-or-nothing updates; filtered content; WP-CLI; no account, paid service or tracking |
| Screenshots | 5, with captions (§5) |
| Banners / icon | 772 × 250 and 1544 × 500 banners; SVG and PNG icons. Original artwork, "no TablePress or Google logos" (`release/README.md`) |
| Official links on the listing | The listing itself, its support forum (`/support/plugin/tablerefresh/`) and the author profile (`profiles.wordpress.org/arsenmanukyan/`, HTTP 200). **No plugin homepage is set** |
| Adoption metrics | **Not used.** The listing shows counters and a reviews area; none are quoted, by design |

## 3. Draft project overview (for the owner to rewrite or approve)

SQLOrbit's and AriMap's Overviews are the owner's own words. The Overview is now the owner's (below). The other fields in this section are still **drafts in that voice**, made only from §1, to be rewritten or approved.

**Lab summary** (existing, accurate, no change needed): "A WordPress plugin that synchronizes TablePress tables with CSV files and Google Sheets."

**Tagline**, options:
1. "Scheduled, safe synchronization for TablePress tables." *(recommended: short, and states the engineering focus)*
2. "Keep TablePress tables in sync with CSV files and Google Sheets."
3. The directory's own line: "Keep TablePress tables up to date with a CSV file or a public Google Sheet: hourly, daily, weekly, or with one click."

**Overview: owner's text, approved (2026-11-27).** Use it verbatim:
1. "Keeping website tables updated sounds simple until the source data changes, a scheduled task fails, or someone edits the table directly in WordPress."
2. "I created TableRefresh to automate CSV and Google Sheets synchronization for existing TablePress tables, while giving site administrators control over when and how their data is replaced."
3. "The most challenging part wasn't importing rows. It was making synchronization reliable: validating external data, preventing conflicting updates, recovering from interrupted operations, and preserving manual edits until an administrator decides what should happen."
4. "TableRefresh is publicly available through the WordPress plugin directory. Its development focuses on predictable behavior, compatibility and making synchronization failures understandable rather than silently overwriting data."

**Fact check against §1:** every claim is supported. There are no adoption, performance or test-count claims.

| Claim | Supported by |
|---|---|
| "a scheduled task fails" | WP-Cron schedules; a failed sync leaves the table unchanged; pause after 5 failures |
| "someone edits the table directly in WordPress" | Edits in TablePress are detected (editor guard, sync state) |
| "I created TableRefresh" | All 57 commits share one author email (author names "Arsen" and "Ars"); readme `Contributors: arsenmanukyan` only. This also supports the Role wording (decision 2) |
| "CSV and Google Sheets synchronization for existing TablePress tables" | Sources and direction. The sheet must be **public**; the Problem and Solution fields below say "public Google Sheet", so that limit still appears on the page |
| "control over when and how their data is replaced" | Hourly, daily, weekly, Sync now, automatic sync on or off, replace confirmation, keep-or-replace decision |
| "validating external data" | URL guard, 5 MB / 15 s limits, CSV parsing, HTML filtering, formulas and shortcodes shown as text |
| "preventing conflicting updates" | Per-table lock; no sync while the table is open in the editor; older editor sessions can't save over synced data |
| "recovering from interrupted operations" | Transaction plus journal; `recover`, also run before every sync |
| "preserving manual edits until an administrator decides" | Automatic sync pauses until **Keep the changes** or **Replace with source data** (screenshot L4) |
| "publicly available through the WordPress plugin directory" | Live listing, 1.0.1 |
| "making synchronization failures understandable rather than silently overwriting data" | Plain-language history of the last 10 attempts; status "Paused: needs your decision"; failed syncs leave the table unchanged |
| "compatibility" | A stated focus, not a version claim. Supported by the matrices and stated requirements (§1). The specific versions stay in the "Testing and compatibility" section |

Earlier draft, replaced (kept only for reference): it covered the same points and also named version 1.0.1. With the owner's text, the release version appears only in the facts panel.

**Facts panel** (the existing rows):

| Row | Draft value |
|---|---|
| Status | Released |
| Release | Version 1.0.1 on WordPress.org (November 2026) |
| Category | WordPress plugin / Data synchronization |
| Role | Creator and developer *(owner to confirm; SQLOrbit uses "Creator and full-stack engineer")* |
| Platforms | WordPress · TablePress |

Leave Languages out: the plugin is English, with a translation template, but no translations are shipped.

**Problem** (draft): "Tables published with TablePress often come from data kept elsewhere, in spreadsheets and CSV exports, and keeping them current means repeated manual imports that can overwrite edits made on the site."

**Solution** (draft): "TableRefresh keeps an existing TablePress table synchronized with a CSV file or a public Google Sheet, on a schedule or on demand, replacing the data all at once and never overwriting edits without asking."

## 4. Engineering contributions (draft, each verified in §1)

1. Designed an all-or-nothing update path: the complete source is downloaded and validated, written in a single database transaction, verified, and rolled back on failure, with a journal to finish or undo an interrupted update.
2. Built conflict detection between synchronized data and edits made in TablePress, with a keep-or-replace decision and a guard against older editor sessions saving over newer data.
3. Implemented per-table locking and a WP-Cron scheduler for hourly, daily and weekly syncs. In 1.0.1 it gained a time budget per web request, longest-waiting-first ordering, and repair of overlapping cron runs.
4. Hardened source handling: blocked requests to internal networks, restricted ports, refused proxies, size and time limits, HTML filtering, and formulas and shortcodes shown as text.
5. Made Google Sheets sharing links work directly, and added WP-CLI commands for scripted sync and recovery.
6. Took the plugin through the WordPress.org review: a vendor namespace, notices limited to the Plugins screen, and a complete uninstall.
7. Built the test and release tooling: integration tests against real WordPress and TablePress, mutation testing, compatibility matrices, Plugin Check, browser workflow checks and reproducible release builds.

**Technology stack:** PHP · WordPress · TablePress · WP-Cron · WP-CLI · MySQL / MariaDB · PHPUnit · Docker. Optionally also JavaScript (the small admin script and the Puppeteer checks).

**Testing and compatibility** (a short extra section, `ProjectSection` after the contributions), draft:
- *Paragraph:* "Each release was checked with an automated integration suite running against real WordPress and TablePress installations, mutation testing, WordPress.org's Plugin Check and a browser workflow."
- *Items:*

  | Term | Text |
  |---|---|
  | WordPress | 6.7 to 7.1 |
  | PHP | 7.4 to 8.4 |
  | TablePress | 3.0 and newer (tested with 3.0 and 3.4.1) |
  | Database | MySQL or MariaDB with InnoDB |

All within §1's "may be claimed". Test counts are left out (owner decision 4).

**Public link:** "TableRefresh on WordPress.org" → https://wordpress.org/plugins/tablerefresh/. The existing `Links` component opens it in a new tab and says so.

**Related project: SQLOrbit.** It has a page, so the card links there ("Open SQLOrbit"). In return, SQLOrbit's related card would change from "View TableRefresh in the lab" to "Open TableRefresh" by itself. That is the documented behaviour (`SQLORBIT-PROTOTYPE.md` §5), but it is a **change to SQLOrbit's page** (owner decision 8).

## 5. Screenshot inventory

| # | File (source) | Size | Shows | Current? | Portfolio suitability |
|---|---|---|---|---|---|
| L1 | `screenshot-1.png`, WordPress.org listing = `release/wordpress-org-assets/` (byte-identical) | 1280 × 900 | The TableRefresh list: one table ("Class roster"), Google Sheets, every hour, "Updated", Sync now, Settings and history; the menu below TablePress | **Yes.** Made on `9d79fae`; since then the admin screens changed only in the "TablePress missing" error notice, which isn't shown | **Recommended:** the product at a glance |
| L2 | `screenshot-2.png` (same) | 1280 × 900 | "Set up table sync": table, Google Sheets link, how often, automatic sync, replace confirmation, "Save and sync now" | Yes | **Recommended:** how it's configured |
| L3 | `screenshot-3.png` (same) | 1280 × 1315 | Settings and history: status, Sync now, recent syncs (Updated / No changes, rows × columns), Remove sync setup with confirmation | Yes | Good; optional (tall) |
| L4 | `screenshot-4.png` (same) | 1280 × 1664 | **Conflict decision:** "This table was changed in TablePress" with Keep the changes / Replace with source data; status "Paused: needs your decision"; history with "Not updated" | Yes | **Recommended:** the strongest engineering story; tall |
| L5 | `screenshot-5.png` (same) | 390 × 844 | The list on a phone | Yes | Optional, to show the responsive admin |
| B1, B2 | `banner-772x250.png`, `banner-1544x500.png` | 772 × 250, 1544 × 500 | Directory banner, original artwork | Yes | **Not recommended:** marketing art; the template has no hero image |
| I1 | `icon.svg`, `icon-128/256.png` | — | Plugin icon | Yes | Not needed |
| D1–D7 | `dev/screenshots/*.png` (after-sync-now, list, list-mobile, set-up, settings-conflict, settings-failed-source, settings-mobile) | 1280 × 900 to 390 × 2304 | Development screens from **2026-10-26** (`99554bd`, version 0.2.0) | **No:** TableRefresh under *Tools*, older headings ("Automatic sync: …", "Remove automatic sync"), a "TableRefresh Dev" site and test-fixture addresses (`http://fixtures/status?code=404`) | **Unsuitable** |

**About the L screenshots:**
- Taken on a clean WordPress 7.1.3 with TablePress 3.4.1, by the project's own script (`dev/release-checks/browser/store-shots.js`).
- The data is Google's public "Class Data" sample sheet: fictional names, and a public sample address in the source field.
- The site is "Example Site", the user "admin", and the timestamps are October 27, 2026.
- No personal data, no TablePress or Google logos.
- They are the owner's own release assets, so usable in the portfolio.

**Draft titles and captions** (alt text to describe each screen in full, as on AriMap):

| Shot | Title | Caption |
|---|---|---|
| L1 | Tables | Every synchronized table with its schedule and last result. |
| L2 | Setup | Choose a table, paste a CSV or Google Sheets link, choose how often. |
| L4 | Decision | A table edited in TablePress waits for a decision instead of being overwritten. |
| L3 (optional) | History | Recent syncs in plain language, with what changed. |

**Note under the screenshots:** "Screenshots: TableRefresh 1.0 on WordPress 7.1 with TablePress, using Google's public sample sheet (fictional data)."

## 6. Links

| Link | Status | Use |
|---|---|---|
| https://wordpress.org/plugins/tablerefresh/ | **Verified live** (canonical; version 1.0.1) | **Approved for the page:** "TableRefresh on WordPress.org" |
| https://wordpress.org/support/plugin/tablerefresh/ | Verified (linked from the listing) | Not needed on the page |
| https://profiles.wordpress.org/arsenmanukyan/ | Verified (HTTP 200) | Not needed (site-wide, if anywhere) |
| https://github.com/ArsenDev96/tableRefresh | Public (HTTP 200) | **Owner decision.** It also holds internal working notes: `HANDOFF.md` still says 1.0.1 is "not for release yet", plus review IDs and machine notes |
| https://downloads.wordpress.org/plugin/tablerefresh.1.0.1.zip | Verified | **Don't link directly**; the listing is the install path |
| https://wordpress.org/plugins/tablepress/ | Third-party | Only if TablePress is named with a link; keep the independence wording |
| Plugin homepage | **None set** on the listing | — |

## 7. Content requiring owner confirmation

1. ~~**Overview:** rewrite or approve the four draft paragraphs (§3).~~ **Resolved 2026-11-27:** the owner supplied their own four paragraphs. They are recorded verbatim in §3 and checked against §1, with no corrections needed.
2. **Tagline, category and role:** pick or change (§3). For Role, "Creator and developer" now matches the Overview's "I created TableRefresh".
3. **Status wording:** "Released" with "Version 1.0.1 on WordPress.org (November 2026)". Or name the first release date, 5 November 2026?
4. **Test evidence:**
   - **Were 1.0.1's remaining checks run** (full suites on 7.4 and 8.3, mutations, Plugin Check, upgrade, browser)? Their results aren't in the repository.
   - If yes, commit the results; then counts may be cited for 1.0.1.
   - If not, the page cites no numbers, or labels 1.0.0's as 1.0.0's.
5. **GitHub link:** show the source repository? If yes, consider updating `HANDOFF.md`'s outdated "not for release" line first. That is outside ArsSoftLab.
6. **Screenshots:** which ones, and how many. Recommended: L1, L2 and L4, plus L5 or L3 optionally.
7. **Independence statement:** add "An independent add-on for TablePress, not affiliated with it" to the page? Recommended, as on the listing.
8. **SQLOrbit's related card** will change from "View TableRefresh in the lab" to "Open TableRefresh". Accept, as designed?
9. **Planned work:** should the page mention anything beyond 1.0.1? Nothing is planned in the repository besides the deferred checks.

## 8. Recommended implementation scope (M1.4L.4B)

**Reuse, no redesign.** SQLOrbit's and AriMap's template covers everything; TableRefresh is mostly data.

1. **Data** (`data/projects.ts`, TableRefresh's `detail`):
   - tagline, overview, category, role, status, milestone, platforms;
   - problem, solution, contributions, stack;
   - one `sections` entry, "Testing and compatibility", after the contributions;
   - `media` with `title`, `caption` and full `alt`, plus `mediaNotes`;
   - `links` (WordPress.org);
   - `related: ["sqlorbit"]`.

   The route, the lab's "Open project" link and SQLOrbit's related card follow automatically (`projectsWithPages()`).
2. **Assets:** copy the chosen WordPress.org screenshots to `public/projects/tablerefresh/`, as WebP at their own size (as AriMap). Record their source and SHA-256 in the prototype report.
3. **One small template step:** the screenshots are mostly wide (1280 × 900) or tall (1280 × 1315 / 1664). Mixed or wide media uses `Media`'s stacked layout, which has neither titles nor the full-size viewer. Two options:
   - **A (smallest):** wrap the stacked layout in the existing `ScreenshotViewer` and make each image a link to its file, exactly as `ScreenRow` does. Optionally show `title` there too. L4 would stand about 1,070 px tall at the content width. SQLOrbit has no media, so it is unaffected.
   - **B:** a two-column grid of desktop screenshots, at their own proportions, opening in the viewer (a sibling of `ScreenRow`). More compact, but a new layout piece.

   **A is recommended** unless the owner finds the stacked page too long.
4. **Checks**, the focused set used for AriMap:
   - TypeScript;
   - one desktop and one mobile capture;
   - the viewer, if A;
   - the lab link and the round trip;
   - SQLOrbit: a smoke check, with its related card's expected change;
   - `/` unchanged.

**Out of scope:** Cinematic, Static Lite, the homepage, the TableRefresh repository, and any install, rating or review figures.
