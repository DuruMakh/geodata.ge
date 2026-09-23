# Government Debt Explorer Design

**Date:** 2026-09-02
**Status:** Approved
**Reference:** `design-shotgun/debt-explorer-2026-09-01/variant-d.html`

## Goal

Add one annual Government Debt explorer under Budget using Fiscal.ge's existing explorer system. The route is `/explorer/debt`; deficit remains out of scope.

## Product surface

- Add `ვალი` as Budget section 05 in the existing sidebar and hub.
- Use the existing shell, breadcrumb, page header, deck line, line/table control, range strip, hierarchical series panel, search, Excel action, source note and footer.
- Render exactly one chart or table. Do not add cards, a debt dashboard, top metric tabs or separate metric routes.
- H1: `რამდენია მთავრობის ვალი და როგორ ვიხდით მას`.
- Default: full 2013–2025 range, nominal GEL, line mode, only `მთლიანი ვალი` selected; every parent group is expanded.

## Series hierarchy and selection

The right panel reuses the `სამინისტროები` parent/child presentation:

```text
მთლიანი ვალი
  საშინაო ვალი
  საგარეო ვალი

ვალის გადახდა
  ძირი თანხა
  პროცენტი

საპროცენტო განაკვეთი
  საშინაო განაკვეთი
  საგარეო განაკვეთი
```

The three parent rows are selectable real series:

- `მთლიანი ვალი`: total Government Debt stock;
- `ვალის გადახდა`: total principal plus interest;
- `საპროცენტო განაკვეთი`: total weighted-average rate.

All groups start expanded and may use the existing caret to collapse. Within one family, any combination of parent and children may be selected. Selecting an item from another family clears every previous selection and activates the new family. Search filters visible rows only. `გასუფთავება` produces the existing empty-selection callout.

Public payment rows are total service, principal and interest. Domestic/external service components remain validated source data but are not additional public selector levels in this first UI.

## Measures, periods and missing values

| Family | Public series | Period | Measure |
| --- | --- | --- | --- |
| Debt stock | total, domestic, external | 2013–2025 | GEL or `% მშპ-ში` |
| Debt service | total, principal, interest | actual 2013–2025; forecast 2026–2030 | GEL |
| Interest rate | total, domestic, external | 2015–2025 | percent |

- Debt stock reuses the existing `% მშპ-ში` pill and canonical same-year GDP. No GDP data is duplicated.
- Payments hide the GDP pill and use GEL.
- Rates hide the GDP pill and automatically use `%`.
- Rate gaps remain gaps; no interpolation or zero substitution.
- Payment forecast lines continue from 2025 as dashed 2026–2030 segments with a visible boundary and `პროგნოზი` label. The note states that this is the portfolio outstanding on 2025-12-31, not a full future-budget forecast.
- Switching families resets the range to that family's full coverage and removes incompatible selections.

## Table, Excel and URL state

- Table mode reuses the current sticky annual table. Forecast-year payment cells carry `პროგნოზი`; rate gaps display `—`.
- One `ჩამოტვირთვა` action exports the active family, selected rows, range and measure using the existing three-sheet Fiscal.ge workbook style: `მარტივი ცხრილი`, `მონაცემები`, `წყაროები`.
- The hash stores mode, share state, range and selected series. Mixed-family deep links are invalid: keep the first valid family's series and discard the rest.

## Data boundary and methodology

- Government Debt is not the broader Public/State Debt total.
- Existing `spending.debt_service` expenditure data remains byte-for-byte and behaviorally unchanged.
- Public methodology is concise: the Government Debt boundary, the 2019 budgetary-organization change, the 2022 general-government SOE change, exact rate gaps, and forecast snapshot limitations.
- Reuse the prepared official package under `docs/Raw Data/Debt/government-debt-annual/`; do not re-extract, estimate or fetch data during builds.

## Reuse versus new code

### Reuse directly

`DataSidebar`, `SectionNav`, `BudgetHub`, `PageHeader`, `EditorialLineChart`, `ExplorerTable`, `RangeStrip`, `SeriesSelector`, `SeriesSelectorRow`, `ExcelDownloadButton`, `SourceNote`, formatting utilities, workbook writer and methodology/source components.

### Small extensions

- optional forecast start on chart series;
- optional forecast marker on the range strip and forecast cell labels in the table;
- debt-family selection policy over the existing hierarchical selector;
- a debt workbook-model adapter using the existing writer.

### New focused units

- Government Debt serving facts and parity loader;
- debt explorer model/state adapter;
- `/explorer/debt` route and thin `DebtExplorer` composition.

No new chart library, selector system, workbook renderer, shell or visual design system is permitted.

## Verification

- Unit tests cover serving parity, totals, GDP shares, gaps, forecast split, family exclusivity, URL restoration and workbook contents.
- Browser tests cover the default expanded hierarchy, one-chart invariant, same-family multi-selection, cross-family clearing, line/table, GDP pill visibility, rate gaps, forecast styling, Excel and desktop/mobile behavior.
- Required gates: `npm run check`, `npm run test:browser`, and `npm run build`.

## Amendment — 2026-09-17

The deck line reports the latest actual year for every family, and the rate change is shown in percentage points. This supersedes the earlier 2030 service headline. See `2026-09-17-figure-accuracy-fixes-design.md` §2.
