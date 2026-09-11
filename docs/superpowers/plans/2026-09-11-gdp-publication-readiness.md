# GDP publication-readiness implementation plan

> Execute inline with superpowers:executing-plans. The user authorized closing the readiness gaps on 2026-09-11. Publishing remains a separate step.

**Goal:** Make the reviewed GDP dataset discoverable/queryable by AI, resolve the chart clipping, add overview Dataset metadata, and prove database serving before release.

**Architecture:** Extend the existing build-time snapshot and read-only MCP query layer. Six stable GDP series carry their own currency/price basis and source status. Query results retain published values (growth percentage points, not fractions), bilingual definitions and caveats. Do not add GDP rankings or derived cumulative comparisons. Keep the existing budget GDP denominator separate.

- [x] Add query_gdp, the seventh dataset, six-series discovery, source narrowing, bilingual definitions/status/caveats, and snapshot validation. Test all six values, missing years, bad requests, historical bounds, source resolution and version pinning.
- [x] Publish the same observations through gdp-overview.json; include GDP JSON and CSV in the hash manifest. Update llms.txt and bilingual connection guidance. Test catalogue/publication parity and runtime MCP output validation.
- [x] Give the GDP chart adequate left-axis space through a bounded shared-chart option, preserving other callers. Add overview Dataset metadata using the existing JSON-LD helper. Verify Georgian/English, growth units and all chart labels in browser.
- [x] Locate or provision a disposable local PostgreSQL instance, apply migrations, import twice, prove persisted decimal parity and rollback, and build in db mode. Never use production as a test database. Record any actual unavailable external prerequisite explicitly.
- [x] Run targeted tests, then final check/build/browser gates; inspect local MCP results and downloads. Update execution evidence and save local commits. No production deployment until authorized.


## Verified execution - 2026-09-11

Implemented inline on `codex/gdp-overview`. No production database, deployment, PR or remote branch was changed.

- `query_gdp` and seven-dataset discovery are available through the locally enabled MCP route. Direct protocol calls verified ten advertised tools, six GDP series, all six 2025 observations, 66 real-GDP years, and successful source narrowing for 1960.
- MCP growth returns 7.46161504152039 percent for 2025; constant real GDP is labelled USD_2015; four 2025 Geostat series are preliminary. Per-person values remain published values rather than calculated population estimates.
- The snapshot preserves the canonical decimal strings and hashes the bilingual GDP definitions. The manifest verifies 396 JSON cells (251 available plus explicit missing cells) and 251 CSV observations. Both downloaded file hashes matched the manifest.
- Both overview pages carry stable Dataset identities and six explicit measured variables. The connection page and llms.txt disclose the GDP coverage and price-basis distinction. Georgian real-GDP tick bounds are now positive; formerly clipped labels have approximately 9.85 SVG units of remaining space.
- Disposable PostgreSQL 17.11 at localhost:55439: all 12 migrations applied; two complete imports passed row and field parity, each with 251 GDP observations. An isolated test trigger changed one incoming value during a third import. The importer rejected the mismatch, and every table's row count and content digest remained identical after rollback. The trigger was removed. GDP RLS is enabled; anon/authenticated SELECT privileges are absent.
- `GEODATA_DATA_SOURCE=db npm run build` passed against that database: 197 static-generation entries, only MCP request-time, and all 12 publication artifact checks passed. The CSV and database snapshots had identical dataVersion values.
- Final check run: lint and typechecking passed; 1,790 unit tests passed and two existing fixture/list assumptions failed. Both were updated for GDP; their three targeted checks passed. Total suite coverage is 1,792 tests. Data validation and localization were then run separately and passed. Final affected-test lint and typechecking passed.
- Full browser run: 474 passed and two failed out of 476. The existing ministries-workbook check had a connection reset and passed unchanged on rerun. The AI connection test was updated from six to seven datasets, allowed the GDP note's terminal punctuation and explicitly asserted its range; it passed on rerun. All GDP chart, metadata, language and download checks passed. This records targeted follow-up, not a claim of a single uninterrupted all-green full run.

Evidence retained under ignored `.tmp/gdp-publish-review/`: `database-validation.json`, `db-repeat-import.log`, `db-rejected-import.log`, `mcp-ready.json`, `ready-ka-desktop.png`, and `ready-ka-mobile.png`. PostgreSQL came from the Windows binary distribution linked by postgresql.org; binaries and the disposable cluster are confined to `.tmp/gdp-postgres/`. No application dependency was added.

Remaining delivery work is the authorized-release workflow: push/draft PR, GitHub CI and review, migration/import/build through the deployment pipeline, then verification of the deployed commit, bilingual pages, source downloads, sitemap and live GDP MCP results. Local results do not establish production deployment or search indexing.

The disposable PostgreSQL server was stopped after verification. The same live local MCP queries and published-file hash checks passed again with that database offline, confirming the request path serves its bundled snapshot.
