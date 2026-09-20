# Served data loading and client payload: specification

Date: 2026-09-17
Status: Draft for user review. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 6 of 8. No dependency on the other specs; if spec 1 lands first, the §3 weight projection must keep `year`.

## 1. Outcome and scope

1. Each new dataset loads once per build process, in CSV and database mode alike. The snapshot serves GDP and sectors from the same served loaders as every other dataset.
2. Explorer pages send the browser only the fields client code reads, as `lib/servedRows.ts:4-17` already requires, and a browser test guards every explorer route.
3. The GDP mirror reader uses the timezone-safe date helper.
4. The explorer footer stops bundling server-scoped message catalogues.

No figure, chart, table or workbook changes.

### 1.1 User-approved decisions (2026-09-17)

- Packaging only.

### 1.2 Decisions taken in this spec

- **Memo scope.** Memoisation is per process. `next build` prerenders in worker processes, so acceptance counts loads per process.
- **Source IDs stay on the client.** They move out of rows into one small map per page, because the workbook builders read them (`lib/explorer/inflationOverview.ts:49-53`, `lib/explorer/economicSectorsWorkbook.ts:43-59`, `lib/explorer/gdpOverview.ts:65-83`).
- **Per-request MCP server stays.** `lib/mcp/tools.ts` builds the server per request by design and is unchanged.

## 2. Loaders

### 2.1 Evidence

- **Rebuilt per call:**
  - `loadServedGovernmentDebtData` (`lib/data/governmentDebt/importGovernmentDebtFacts.ts:249-267`)
  - `loadServedGeneralGovernmentBalanceData` (`lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts:108-135`)
  - `loadServedGdpOverviewData` (`lib/data/gdpOverview/importGdpOverview.ts:50-66`)
  - `loadServedEconomicSectorsData` (`lib/data/economicSectors/importEconomicSectors.ts:35-46`)

  In database mode each call re-queries the mirror and re-runs the full-row parity check.
- **Established memo:** `lib/data/servedData.ts` memoises its loaders (`:427-490`), with reset `resetServedDataCacheForTests` (`:456-460`). Its comment documents exactly this cost.
- **Five copies of mode parsing,** with two different error messages: debt `:252-256`, deficit `:111-119`, GDP `:53-55`, sectors `:36-37`, inflation `lib/data/inflation/importInflation.ts:145-146`. `resolveServedDataSource` (`servedData.ts:137-149`) is not used by any of them; inflation memoises but has no reset.
- **Debt calls per `next build`:** about 25 — home, hub, debt page and its metadata, methodology hub, seven methodology articles in both locales, and the sitemap — plus one per snapshot run. `lib/pages/methodology-article.tsx:120-127` loads debt data for every article; only the debt article's coverage uses it.
- **Snapshot:** `lib/factQuery/buildSnapshot.ts:479` names 9 results of a 10-promise `Promise.all` and discards `loadServedGdpOverviewData()` (`:489`). It then reads the CSVs directly for GDP and sectors (`:670-671`), so in database mode those two datasets bypass the mirror while every other dataset does not.

### 2.2 Change

1. **Mode resolver:** move `resolveServedDataSource` to `lib/data/servedDataSource.ts`, re-exported by `servedData.ts`. This avoids an import cycle with the debt and deficit loaders that `servedData.ts:83-84` re-exports. All five loaders call it; their local parsers and messages go.
2. **Memoisation:** memoise the four loaders with module-level promises. Register each reset, plus inflation's, with `resetServedDataCacheForTests`.
3. **Snapshot:** take GDP and sector facts from `loadServedGdpOverviewData()` and `loadServedEconomicSectorsData()`, with no result discarded. Snapshot output in CSV mode must be byte-identical: compare `lib/factQuery/generated/snapshot.json` before and after.
4. **Methodology articles:** `methodology-article.tsx` loads debt data only for the debt article.

### 2.3 Tests

- **Memo:** a new `tests/data/servedLoaders.test.ts` asserts that two calls to each served loader share one promise, and that `resetServedDataCacheForTests` clears all of them.
- **Parity:** `tests/i18n/servingParity.test.ts` adds `loadEconomicSectorFactsFromDb` to the mirror mock and asserts that each mirror loader is called once per snapshot build in database mode.
- **Errors:** `tests/data/economicSectors/servingBoundary.test.ts` keeps asserting the invalid-mode error, now the shared message.

## 3. Client payload

### 3.1 Evidence

Full served rows cross into client components:

| Page | Rows | Unread fields |
|---|---|---|
| `lib/pages/inflation.tsx:98` | 1,960 CPI rows | `sourceLocator`, `status`, per-row `lastReviewedAt` |
| `lib/pages/inflation.tsx:151` | 786 basket-weight rows | `sourceId`, `lastReviewedAt` |
| `lib/pages/economic-sectors.tsx:43` | 987 sector rows | `unit`, `valuation`, `priceBasis`, `sourceLocator`, per-row `lastReviewedAt` |
| `lib/pages/gdp.tsx:82-86` | 251 rows | `unit`, `accountingStandard`, `sourceLocator` |
| `lib/pages/debt.tsx:67` | debt rows | `snapshotDate`, `lastReviewedAt`; the page already passes `lastUpdatedAt` once (`:72`) |

- **Size:** estimated uncompressed JSON per locale is about 393 KB (inflation overview), 334 KB (sectors) and 63 KB (GDP), of which 41–47% is unread. This is an estimate from CSV column sizes, not a build measurement.
- **Contract bypassed:** these served types live under `lib/data/*` as ingestion rows minus `value`, the placement `lib/servedRows.ts:13-17` warns against. The projections pattern exists in `lib/explorer/clientData.ts:14-43`.
- **Guard gap:** `tests/browser/main-explorer.spec.ts:1188-1211` guards only `/explorer/expenditure`, `/explorer/revenue` and `/explorer/analysis`.

### 3.2 Change

Add client row types to `lib/servedRows.ts` and projections to `lib/explorer/clientData.ts`:

| Data | Client row | Hoisted once per page |
|---|---|---|
| CPI | `{ seriesId, measure, period, value }` | `sourceIdBySeriesMeasure` |
| Basket weights | `{ categoryId, year, weightPct }` | — |
| Sectors | `{ seriesId, year, measure, value, status }` | `sourceIdByMeasure` |
| GDP | `{ seriesId, year, value, status }` | `sourceIdBySeries` |
| Debt | the current row without `snapshotDate` and `lastReviewedAt` | — |

- **Last reviewed date:** each page passes one `lastReviewedAt` (the maximum) where the client shows it (`components/gdp/gdp-overview.tsx:112-115`, `components/inflation/inflation-overview.tsx:69`).
- **Consumers:** the client components and workbook builders read the hoisted maps instead of per-row `sourceId`.
- **Dead branch:** `lib/explorer/economicSectorsWorkbook.ts:59` reads `calculation === "year_over_year"`, a value no fact carries (every real-growth row is `index_to_growth`). Remove the branch rather than projecting `calculation`.

### 3.3 Guard and acceptance

- **Extended guard:** the payload test also covers `/explorer/debt`, `/explorer/deficit`, `/explorer/economy/gdp`, `/explorer/economy/sectors`, `/explorer/inflation/overview` and `/explorer/inflation/categories`. On each of these routes, `sourceLocator`, `snapshotDate`, `valuation`, `priceBasis` and `accountingStandard` must not occur, and `sourceId` must occur at most 20 times (hoisted maps only). The three budget routes keep their exact zero assertions.
- **No visible change:** the existing chart, table and workbook tests pass unchanged, with identical workbook models for fixed inputs.
- **Evidence in the PR:** record before and after HTML sizes of the six routes, from a production build, in both locales.

## 4. GDP mirror date — `lib/db/mirrorRows.ts:461`

Evidence:

- The GDP overview reader uses `row.lastReviewedAt.toISOString().slice(0, 10)`. Every other date in the file goes through `isoDate()` (`:40-49`), introduced by `38d2f9b97` after the same bug hit municipal population on a UTC+4 machine.
- A shifted date fails the full-row parity check (`lib/data/gdpOverview/importGdpOverview.ts:57-63`), so the failure is closed but blocks a local import or database-mode build east of UTC.

Change: `lastReviewedAt: isoDate(row.lastReviewedAt)`.

Test: extend the timezone-pinned `isoDate` test added with `38d2f9b97` to the GDP overview reader.

## 5. Explorer footer — `components/shell/explorer-footer.tsx`

Evidence:

- The `"use client"` footer imports `lib/i18n/common.server.ts`, which bundles both locales' `common` messages into every explorer route's client JavaScript.
- It passes the literal `{updatedAt}` through `message()` for `components/site/site-footer.tsx:11` to split.
- The explorer layouts already provide `common` messages through `I18nProvider` (`lib/pages/explorer-layout.tsx:12-16`).

Change:

- The footer reads messages with `useI18n()`.
- `lib/i18n/common.server.ts` gains `import "server-only"`, so a future client import fails the build.
- The rendered footer text is unchanged in both locales.

## 6. Non-goals

- Per-request MCP server construction.
- Compression settings and caching headers.
- Municipal page payloads, which were not audited.

## 7. Documents to update in the same change

- `docs/data-methodology/database-import.md`: loaders are memoised per process, and `resolveServedDataSource` owns mode parsing.
- `lib/servedRows.ts` header comment: the new client row types, which record the contract in code.

## 8. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/data/servedLoaders.test.ts tests/i18n/servingParity.test.ts tests/data/economicSectors/servingBoundary.test.ts
```

```bash
npx playwright test tests/browser/main-explorer.spec.ts
```

Done-check: `npm run check`, `npm run build` and `npm run test:browser` on the production-build recipe. If mirror credentials are available locally, also run one database-mode build (`GEODATA_DATA_SOURCE=db npm run build`); otherwise the weekly `db-health` workflow covers it after merge.

Acceptance:

- One load per dataset per process.
- An identical snapshot in CSV mode.
- A mirror-backed snapshot for GDP and sectors in database mode.
- The payload guard passes on nine routes.
- The GDP reader uses `isoDate`.
- `common.server.ts` is server-only.
- No visible or workbook change.

## 9. Authority and next step

This spec owns the bounded decisions in §1. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-served-data-loading-and-payload.md`.
