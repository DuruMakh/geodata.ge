# Georgia municipal aggregate (design)

Date: 2026-08-14
Status: approved design; implementation pending
Scope: add one Georgia-wide municipal-budget aggregate without exposing the five
occupied-territory-associated municipal bodies as territorial municipality or
region data.

## 1. Outcome

The municipalities explorer gains a nationwide option named `საქართველო`.
It is the first row when the user switches the index list to `რეგიონები`, and
the first option in the municipality/region entity picker. Selecting it opens a
dedicated page that presents the same multi-year statistics as a region page.

The Georgia aggregate sums all 69 official municipal-budget series available in
the reviewed raw package for 2015–2025:

- the 64 municipalities already served through public pages and regional
  roll-ups; and
- codes `05`, `42`, `43`, `46`, and `64`, included only in the Georgia
  aggregate.

Those five codes remain absent from municipality pages, map interactions,
rankings, picker municipality options, member lists, and the 11 regional
roll-ups. Their inclusion in the country total does not describe the spending
as territorially delivered inside occupied municipalities.

## 2. Data boundary

### 2.1 Preserve the public entity dataset

The existing public registry remains exactly 64 municipalities across 11
regions. The existing municipal fact CSVs, Prisma municipality relations, route
generation, map geometry, and regional aggregation continue to use those 64
entities only.

No visibility flag is added to `Municipality`, and the five aggregate-only
codes are not inserted into `data/imports/municipalities.csv`. Keeping them out
of the entity model makes accidental publication structurally difficult.

### 2.2 Add a separate country aggregate

The municipal fact generator reads the preserved 69-entity raw inputs and
writes two new reviewed serving files:

- `data/imports/municipal-georgia-function-facts-2015-2025.csv`: 110 rows
  (11 years × 10 functions);
- `data/imports/municipal-georgia-total-facts-2015-2025.csv`: 11 rows
  (one official public-total aggregate per year).

Each output row uses the stable scope ID `country.georgia`. Function amounts are
the exact annual sum across all 69 source rows for that category. Total and
component fields follow the current roll-up rules: required amounts are summed;
nullable components are null if any constituent value is missing, so an
incomplete sum is never presented as complete;
`public_total_measure` and source metadata retain a shared value when all rows
agree and an explicit mixed marker otherwise. No residual category is created
and no value is normalized to force reconciliation.

The generator must fail if any expected year, category, or one of the 69 source
codes is missing; if duplicate source keys exist; or if a generated aggregate
does not equal an independent sum of the raw rows.

### 2.3 Database mirror and parity

The country rows receive dedicated Prisma models and a migration rather than a
synthetic municipality record. `npm run data:import` imports them in the same
transaction as the existing reviewed municipal facts. CSV mode and database
mode load the same country-level shape, and the existing row-by-row parity gate
is extended to cover both new datasets.

The reviewed CSVs remain canonical. The application never calculates the
country total from live municipality pages or from a database-only query.

## 3. Routes and interface

### 3.1 Route

Add one explicit static route:

```text
/explorer/municipalities/georgia
```

An explicit route keeps Georgia distinct from the 11 semantic region IDs and
avoids a misleading `/region/georgia` URL. It is not added to the 64-code
`generateStaticParams` list.

### 3.2 Discovery

On `/explorer/municipalities`, the `რეგიონები` list is ordered:

1. `საქართველო` — pinned nationwide row;
2. the existing 11 region rows in their current value-ranked order.

The Georgia row links to the explicit country route and uses the subtitle
`69 მუნიციპალური ბიუჯეტი`. The municipality tab, search behavior, region
ranking, and map remain unchanged. Search may filter the Georgia row like any
other visible list row. The region-tab result count includes this nationwide
option (12 unfiltered rows), while region ranks remain calculated among the 11
actual regions.

The entity picker places a standalone `საქართველო` option before the 11 region
groups. It is not presented as a municipality and has no child municipality
rows. Keyboard navigation, focus return, and search include the new option.

### 3.3 Country page

The page reuses `MunicipalExplorer`, the chart/table switch, year-range control,
share mode, shared series selector, comparison section, movers section, and CSV
download. Only the applicable total is selected by default, preserving the
shared selector contract.

Page copy:

- picker trigger: `საქართველო`;
- H1: `როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები`;
- meta: `69 მუნიციპალური საბიუჯეტო ერთეული · 2015–2025`, with the year range
  derived from loaded facts rather than hardcoded in the component;
- no rank, previous/next region navigation, map, or member-municipality list.

Country KPIs are:

1. official municipal budget at the selected range end;
2. growth from the selected range start;
3. largest function and its share of the official country total;
4. `მუნიციპალური ბიუჯეტები` with value `69` and detail
   `64 საჯარო გვერდი · 5 მხოლოდ საქართველოს ჯამში`.

### 3.4 Explanation and territorial meaning

The country page and the municipality index source note explain, in Georgian,
that the Georgia total combines 69 official municipal-budget units. Five are
budgets of Georgian municipal bodies associated with occupied territories;
they are not shown as territorially attributable expenditure and appear only
inside the Georgia aggregate.

Existing region notes continue to explain that regional totals contain only
their publicly served member municipalities. The Adjara autonomous republic's
own budget remains outside this municipal package.

The five aggregate-only codes receive no names, links, tooltip rows, map marks,
or standalone values in the public interface or CSV export.

## 4. Consistent national denominators

Where the municipalities explorer describes a countrywide municipal total or a
municipality/region share of national municipal spending, it uses the new
69-series Georgia aggregate. This applies to:

- the index's municipal-expenditure, growth, concentration, and largest-function
  calculations;
- `წილი მუნიციპალურ ხარჯებში` on municipality pages; and
- `წილი მუნიციპალურ ხარჯებში` on region pages.

Municipality rankings remain out of 64 and region rankings remain out of 11.
The 11 region rows do not sum to the Georgia row because the five
aggregate-only budgets have no territorial region assignment; the public note
makes that difference explicit.

## 5. CSV export

The Georgia page's CSV uses the existing municipal explorer export format and
contains only the country total and ten country-level function series by year.
It identifies the entity as `საქართველო` / `country.georgia`, preserves source
and basis metadata, and includes no row or label for any of the five underlying
aggregate-only codes. Georgian Excel compatibility keeps the existing UTF-8 BOM
contract.

## 6. Verification

Implementation follows test-driven development. Before production code, tests
must fail for the missing behavior and then pass after the minimum change.

### 6.1 Data tests

- raw coverage is exactly 69 codes × 11 years, with 10 functions per code-year;
- generated country outputs are exactly 110 function rows and 11 total rows;
- representative annual country values equal independent sums over all 69 raw
  rows;
- removing any of the five aggregate-only codes changes the expected result and
  fails the coverage contract;
- the existing public outputs remain 64 municipalities, 7,040 function facts,
  and 704 total facts;
- CSV and database country rows pass field-by-field parity;
- data import remains transactional and deterministic.

### 6.2 Model and route tests

- Georgia is first in the region list and picker;
- its route builds the country model from the dedicated aggregate facts;
- country totals drive the national KPI denominators;
- region roll-ups still use only their current public members;
- no aggregate-only code appears in routes, lists, search, map data, member
  lists, or public CSV content;
- the default selection remains the total only.

### 6.3 Browser checks

- switch the index to `რეგიონები` and open the first `საქართველო` row;
- verify the country heading, 69-unit explanation, chart, table, selector,
  range control, share mode, comparison rows, and CSV download;
- verify mobile widths without horizontal overflow;
- verify a representative municipality and region still render their existing
  counts and source notes.

Final gates are the repository definition of done from `CLAUDE.md`:
`npm.cmd run check`, `npm.cmd run build`, and `npm.cmd run test:browser` from
`apps/web`, plus `git diff --check`.

## 7. Documentation ownership

The implementation updates the durable owners in the same change:

- `Project_Definition.md` section 2: 64 public municipality pages and one
  69-series Georgia aggregate;
- `DESIGN.md`: route inventory, actual data coverage, region-tab ordering, and
  country-page behavior;
- `docs/data-methodology/municipal-functional-annual-2015-2025.md`: generation,
  aggregation semantics, exclusions, public notes, row counts, import/parity,
  and validation.

No unrelated municipal indicator, map, population, per-capita, or national
budget feature is included.
