# Services trade local browser verification

Task 5; checkout `C:\Users\Mylaptop\.codex\worktrees\d51c\Geodata.ge`, branch `codex/trade-services`, task base `0f3cc1a35a3dd1689f34f4f15d2da89ccdfa4f27`.

This evidence concerns local implementation only. Publishing, live migration/import and real PostgreSQL verification were not run; no approved disposable database was supplied. The two UK services-country discrepancies remain outside this accepted national/type subset.

## Browser behavior and workbook checks

`apps/web/tests/browser/trade-services.spec.ts` adds 14 real-browser cases: Georgian/English at 390, 768 and 1440 pixels, both default views, removable total, all/empty selection, multilingual search, global bulk scope, stable scales, independent ranking, same-year national denominators for turnover/exports/imports, signed balance without share, 2020 missing export and absent turnover/balance, numerical imports, chart/table, keyboard range/selection/tabs, view memory, reload/back/forward, active sidebar and language changes. Heading/control/axis readability and document overflow are asserted. Existing `explorer-table` helpers read the phone and desktop layouts.

Both languages download all thirteen identities for all five years under each of four measures while search is filtered. ExcelJS reads each actual XLSX: 520 type/year/measure rows checked against the accepted CSV, including six blank cells across both languages (missing export and two unsupported derivations per language), plus 40 national rows. The 514 numerical type cells retain the browser's source-number projection exactly, including negatives. Workbooks have three sheets, actual basis, unspecified publication status, services filenames and no internal provenance columns. Applicable export/import source hyperlinks are fetched and SHA-256 checked against the reviewed archive; derived measures use both originals. The metadata PDF is checked too.

There are **no numerical zero observations in this accepted dataset**. Zero preservation is verified by the existing synthetic-zero ExcelJS regression in `apps/web/tests/explorer/tradeServicesWorkbook.test.ts`; no artificial zero was added to production data or claimed as an actual browser observation.

## Failure and focused recovery

The first 14-case development run returned 10 passed / 4 failed in 3.2m. Three Georgian cases could not find Travel after an English query: the inherited selector searched only the current display language. The controller confirmed spec §4 and DESIGN's bilingual-search requirement and approved the narrow services-only fix. `trade-partners-series-panel.tsx` now passes both reviewed Georgian and English names to the existing matcher only for services; goods/Domestic defaults are unchanged. The fourth failure was a test wording mistake: Georgian Actual is the established `ფაქტი`, not `ფაქტობრივი`; the test expectation was corrected. The first case also included cold development compilation (18.9s for the Trade hub).

Focused render/workbook command: `npx.cmd vitest run tests/explorer/tradeServicesRender.test.tsx tests/explorer/tradeServicesWorkbook.test.ts tests/explorer/tradePartnersRender.test.tsx`; **3 files / 11 tests passed**, 3.23s. Log: `.tmp/services-logs/render-workbook.log`.

The corrected development browser run, `npx.cmd playwright test tests/browser/trade-services.spec.ts tests/browser/trade-domestic.spec.ts`, passed **19/19** (14 services and all five Domestic exports regressions), Playwright 2.8m / command 173.9s. Log: `.tmp/services-logs/narrow-2.log`.

The first full check exposed an integration boundary failure: two newly registered native services source bindings were not covered by the existing query snapshot's Trade exclusion prefix. They increased query sources from the approved 145 to 147 and failed strict provenance resolution. The controller approved appending the explicit services prefix exclusion to the existing filter in `lib/factQuery/buildSnapshot.ts`, plus absence regressions. This restores the existing MCP scope; no service facts/tool/publication were added. The full internal registry legitimately grows from 187 to 189, pinned to the exact two new binding IDs in `tests/factQuery/buildSnapshot.test.ts`; the query-source count stays 145. The unchanged mandatory `tests/factQuery/reference.test.ts` and source-resolution tests passed in the focused rerun; the initial focused combined run had 109 passed / one stale full-registry count failure before that expectation was corrected. No reference expectation was edited.

The failed initial full-check attempt was aborted after 416.7s while its remaining unit files were still running, with source-resolution, raw-registry count and sitemap inventory failures already recorded; this is **not a completed gate result**. Only task-owned Vitest PID 7556 and its confirmed worker children 27808/10116 were stopped; a separate worktree's tests were left alone. Evidence: `.tmp/services-logs/check-initial-aborted.log` and `check-initial-aborted-result.txt` (`exit=-1`).

After the approved supporting expectation fixes, `tests/factQuery/buildSnapshot.test.ts` passed **21/21**, 25.74s, and `tests/seo/routes.test.ts` passed **3/3**, 10.91s. Logs: `snapshot-focused.log`, `routes-focused.log`. The expected complete page inventory grows from 249 to 250 bilingual identities / 498 to 500 URLs. The exact sitemap and all-page browser inventory assertions now include the two services URLs; their content, uniqueness and language checks remain intact.

Development uses this checkout's verified-free `http://localhost:3217`, process PID 41652, exec session 25314; explicit `PLAYWRIGHT_BASE_URL`, `PW_WORKERS=1` and `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`. Every command sets TEMP/TMP to this checkout's `.tmp/services-test-temp`. The first predev attempt encountered the known Windows source-inventory realpath EPERM; the unchanged command passed with read-capable escalation. Integrity checks were retained.

## Screenshots and visual review

The default Overview and Service types views are captured in this directory for `ka/en × 390/768/1440`: `services-{overview,types}-{ka,en}-{390,768,1440}.png` (12 images). All twelve final images were overwritten against the production artifact and personally inspected: legible Georgian/English, wrapped long category names, readable chart ticks, controls and ranking, and no page overflow. Desktop selectors retain their established internal scrolling. Production captures remove the development badge without changing application configuration.

The controller also visually inspected all twelve production images and confirmed readable names, controls, amounts and ranking with no visible overflow. This visual pass preceded the independent code reviews; their completed outcome is in [review-summary.md](review-summary.md).

## Completion gate and build boundaries

`npm.cmd run check` passed, exit 0, **817.56s**. Its unit phase passed **466 files / 3,797 tests**, with one file / 13 existing tests skipped, 674.83s. Data validation (including deterministic services reproduction and unchanged country holds) and localization passed: 5,674 labels / 250 page identities. Logs: `.tmp/services-logs/check.log`, `check-result.txt`.

`npm.cmd run build` passed, exit 0, **120.92s**, with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge` and task-local TEMP/TMP. It lists both `/explorer/trade/services` and `/en/explorer/trade/services` as `○`; the prerender manifest includes each with `initialRevalidateSeconds=false`. Both route file traces contain 321 files and no raw research workbook, canonical CSV or preparation paths. Scanning their traced JavaScript found no services preparation markers; all 59 client JavaScript chunks exclude the services raw/preparer/loader/CSV markers. Log: `bundle-boundary.log`.

The existing source-inventory definitions intentionally reference approved original filenames for **build-time** archive integrity checks; these are distinct from a raw-workbook preparation import. The intentionally public three originals remain downloadable and hash-verified. Prerendered services pages answer from generated HTML/client data, with no request-time dataset fetch. The existing MCP snapshot and its 23 publications remain current at dataVersion `db554fc80dcc752a0e7d37bba5ae396f6b53447e23b9c481ba297e0af233f993`; no services source/fact/tool was added to them.

`npm.cmd run test:browser` completed with **1,259 passed / two failed**, 12.1m / command **726.03s**, exit 1. The only failures were the two old bilingual Trade-methodology archive-count expectations (15 rather than the approved 18 originals). All 14 Services cases and existing Domestic cases passed. The controller approved correcting 15→18 and explicitly pinning the three services filenames. The focused rerun `npx.cmd playwright test tests/browser/trade-overview.spec.ts --grep 'Trade methodology and navigation have the bounded source archive'` then passed **2/2**, Playwright 3.8s / command 5.54s, exit 0. Thus all **1,261 distinct browser cases** are accounted for by the full run and focused recovery; this was not a 1,261/1,261 first pass. Logs: `browser-full.log`, `browser-full-result.txt`, `archive-focused.log`, `archive-focused-result.txt`.

The first focused archive rerun could not launch Edge in the restricted sandbox (named-pipe/closed-target failure before page actions). The unchanged command passed with authorized escalation; this launch-only attempt is retained as `archive-focused-sandbox-launch.log` and its result file. No product configuration changed. Check/build were not repeated for this test-only expectation correction.

The production artifact used verified-free `http://localhost:3218`, PID 2620 / exec session 28186, with explicit `PLAYWRIGHT_BASE_URL`, `PW_WORKERS=4`, local Edge and the same pinned site origin. No rebuild ran while this server served `.next`. After the focused recovery, its listener was confirmed to belong to PID 2620 and only that process was stopped. The development PID 41652 was stopped before building. Next's development startup had regenerated tracked `apps/web/AGENTS.md`; it was restored to exact HEAD bytes after shutdown and verified unchanged again after build. Both instruction files and accepted CSV/taxonomy/validation/raw Trade files have a clean diff against task HEAD.

At the Task 5 implementation handoff, independent task/whole-branch review was pending. Both reviews and the final scoped fix review are now complete; see [review-summary.md](review-summary.md).

## Baseline warnings

Preserved focused-run Vite warning (minor, no unrelated configuration cleanup), exact `.tmp/services-logs/render-workbook.log:1–3`:

```text
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.
```

The corrected full check uses the existing native config loader and reports this separate exact diagnostic, `.tmp/services-logs/check.log:26–29`:

```text
(node:30384) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///C:/Users/Mylaptop/.codex/worktrees/d51c/Geodata.ge/apps/web/vitest.config.ts?fresh-import-0eae1hgw22m=0,file:///C:/Users/Mylaptop/.codex/worktrees/d51c/Geodata.ge/apps/web/vitest.config.ts is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to C:\Users\Mylaptop\.codex\worktrees\d51c\Geodata.ge\apps\web\package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
```

Playwright also reports the existing environment warning that `NO_COLOR` is ignored while `FORCE_COLOR` is set. It does not indicate a browser-page error.

## Final review correction

This correction follows the independent whole-branch review at `803e75b69da2d90b0a5eb64f390473d30677f80c` (FIX_BASE). It fixes only findings 1 and 2: the missing bilingual Geostat Services publisher anchor and the national workbook assertion that previously accepted any indicator amount for a year. Findings 3 (dense preparation/validation formatting) and 4 (existing configuration/environment warnings) remain explicitly deferred housekeeping. Independent scoped re-review approved both corrections at bb7656eda7df1e710a0d2de42f315ae8e50e888c with no new breakage; see [review-summary.md](review-summary.md).

The existing MethodologyArticle renderer now accepts optional section source links, with its established accent/underline presentation. Both Trade methodology languages link to the exact frozen and verified publisher URL, `https://www.geostat.ge/en/modules/categories/766/international-trade-in-services`, using natural local text. No archive entry or original bytes changed. The national Excel browser check maps each translated indicator label to its canonical indicator and exact accepted CSV amount; it rejects duplicate pairs and requires all twenty national indicator/year pairs. Production workbook code is unchanged. Existing type downloads, selections, null checks and archive hashes remain covered.

The new actual bilingual article-rendering tests first failed for the missing anchors, then passed. The first sandbox attempt hit the known source-inventory `realpath` EPERM before assertions; the same test with read-capable escalation produced the intended two missing-link failures. Logs: `.tmp/services-logs/final-fix-red.log`, `final-fix-red-escalated.log`. Focused methodology/source content coverage passed **5 files / 57 tests**, 2.89s (`final-fix-focused.log`). Targeted ESLint and `npm.cmd run typecheck` both exited 0 (`final-fix-lint.log`, `final-fix-typecheck.log`).

One current final `npm.cmd run check` passed, exit 0, **747.24s**: **466 files / 3,799 tests**, with one file / 13 existing skips, unit duration 633.78s; data validation and localization passed (5,674 labels / 250 page identities). One current `npm.cmd run build` passed, exit 0, **114.93s**. These gates were justified by the production methodology content/interface change and were not repeated. Logs/results: `final-fix-check.log`, `final-fix-check-result.txt`, `final-fix-build.log`, `final-fix-build-result.txt` in `.tmp/services-logs/`.

The rebuilt artifact permanently prerenders both Services routes and both Trade methodology routes (`initialRevalidateSeconds=false`). Each Services route trace has 321 files and zero raw/preparation paths. Generated methodology HTML contains exactly one visible-text publisher anchor in each locale. A first scratch-only trace inspection used paths without Next's `(ka)`/`(en)` groups and failed to locate the trace; correcting that inspection path passed without a source change or rebuild. Both attempts are retained as `final-fix-boundary-initial.log` and `final-fix-boundary.log`. The MCP snapshot dataVersion remains `db554fc80dcc752a0e7d37bba5ae396f6b53447e23b9c481ba297e0af233f993`, with the existing 23 publications current.

Against that rebuilt artifact, `npx.cmd playwright test tests/browser/trade-services.spec.ts tests/browser/trade-overview.spec.ts --grep 'Services real Excel|Trade methodology and navigation have the bounded source archive'` passed **4/4**, Playwright 22.4s / command **26.77s**, exit 0. Both actual Services XLSX cases retain 520 type/year/measure rows, six blank missing cells, applicable source SHA-256 checks and metadata; all forty national rows across both languages now have exact indicator/amount and unique-pair checks. Both actual methodology/navigation cases prove the new translated publisher link and unchanged eighteen-original archive. Log/result: `final-fix-browser.log`, `final-fix-browser-result.txt`. Prior full browser evidence above remains distinct: 1,259 passes / two failed expectations, followed by 2/2 recovery at FIX_BASE. No second unrelated full browser suite was run for this bounded correction.

All final commands used this checkout, `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`, CSV mode, and TEMP/TMP at checkout `.tmp/services-test-temp`. Browser runs explicitly used `PLAYWRIGHT_BASE_URL=http://localhost:3218`; local Edge ran four cases using two workers. Port 3218 was free before startup. Only task-owned production server session 46874 / listener PID 3948 served the rebuilt artifact; its listener was reconfirmed before stopping only PID 3948, and the port was confirmed no longer listening. No build ran while this server served `.next`; no unrelated process was stopped.

These runs executed FIX_BASE plus this correction's seven production/test file edits. Their SHA-256 inputs were captured before completion at `final-fix-tested-inputs.txt` and rechecked unchanged before committing; only review/evidence documentation changed afterward. The final scoped commit bb7656eda7df1e710a0d2de42f315ae8e50e888c and clean status are recorded in the durable [review and local delivery record](review-summary.md). Both instruction files, reviewed Services CSV/catalogue/report, Trade archive manifest, raw evidence and deferred formatting remain unchanged against FIX_BASE. The existing Vite/native module-format warning recurred in tests, and `NO_COLOR`/`FORCE_COLOR` in Playwright; neither was suppressed or reconfigured. No live DB check/import/migration, push, PR, merge or publication was run.
