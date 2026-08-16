# Adjara consolidated regional budget (design)

Date: 2026-08-16
Status: approved direction; awaiting written-spec review
Scope: replace the six-municipality-only Adjara headline with a consolidated
Adjara total and carry the same net addition into the Georgia aggregate.

## 1. Outcome

The existing `region.adjara` page remains the only Adjara regional entity. No
separate Adjara Autonomous Republic page, picker option, map entity, ranking
row, or downloadable entity is added.

For every year from 2015 through 2025, the public Adjara total is:

```text
six Adjara municipality public totals
+ Adjara republican budget actual payments
- transfers from the Adjara republican budget to territorial budgets
```

The transfer subtraction prevents the same money appearing once when the
Adjara republic pays it and again when a municipality spends it. The same
annual net republican amount is added once to `country.georgia`, whose base is
the existing 69-series Georgia municipal aggregate.

The municipalities index, the Adjara region page, the Georgia page, national
municipal-share denominators, comparisons, growth figures, and CSV totals all
use these consolidated values.

## 2. Reviewed inputs

### 2.1 Republican payments

Use actual `გადასახდელები` (payments), not the narrower `ხარჯები` (expenses).
Payments comprise expenses, growth of non-financial assets, growth of financial
assets excluding cash balances, and decrease in liabilities.

- 2015: `170,031.4` thousand GEL from the official Adjara budget table published
  on Matsne. The table explicitly identifies this as 2015 actual payments.
- 2016–2025: the actual `გადასახდელები` row in the user-supplied workbook
  `2. აჭარის ა.რ. (1).xlsx`.

Cash/deposit balance changes are not payments and are never added.

### 2.2 Transfers to municipalities

Use the already-reviewed annual Treasury consolidated-revenue rows retained in
`docs/Raw Data/Revenue/` and normalized in
`data/staging/revenue-official-rows-2005-2025.csv`.

- 2015–2018: autonomous-republic transfer total code `1332`.
- 2019–2025: current/special transfer code `1.3.3.1.2` plus capital transfer
  code `1.3.3.2.2`.
- Measure: `territorial_budget_actual_gel`.

The Treasury transfer values were independently checked by the user against
the Adjara annual execution reports. Reserve or project-fund lines are not
subtracted separately because they are already represented in the transfer
receipts where applicable.

### 2.3 Preserved reviewed file

Add one reviewed 11-row CSV containing the two operands and their difference:

`data/imports/municipal-adjara-budget-adjustments-2015-2025.csv`

Columns:

```text
year,scope_id,republic_payments_gel,municipal_transfers_gel,
net_republic_payments_gel,basis,republic_source_id,transfer_source_id
```

`scope_id` is always `region.adjara`, `basis` is always `actual`, and
`net_republic_payments_gel` must exactly equal republican payments minus
municipal transfers. The original workbook and 2015 Matsne PDF are retained
under the municipal raw-source archive with URL/hash/size/review metadata.

## 3. Aggregation behavior

### 3.1 Adjara

The existing six-municipality roll-up remains the source of Adjara's municipal
total and ten municipal functional series. A narrow helper applies the reviewed
annual net republican adjustment to the roll-up's `publicTotalGel`.

The resulting total uses a distinct public measure marker,
`adjara_consolidated_total`, and composite source metadata. It does not pretend
that the republican budget is a seventh municipality.

For 2015 the reviewed municipal portion is the existing functional-total
fallback; therefore the consolidated public total is valid, while the optional
official total-payment component remains null. For 2016–2025 the consolidated
`totalPaymentsGel` equals the consolidated public total. Component fields that
cannot be combined without a reviewed transfer classification remain null.

The verified 2015 result is:

```text
216,011,449.37 + 170,031,400.00 - 27,186,011.29
= 358,856,838.08 GEL
```

### 3.2 Georgia

The existing 69-series municipal country total remains the base. For each year,
add the same Adjara net republican amount once. Regenerate
`municipal-georgia-total-facts-2015-2025.csv` from the preserved raw 69-series
inputs plus the reviewed adjustment CSV.

The Georgia functional file is unchanged: it continues to contain the ten
municipal functions summed across 69 official municipal-budget series. The
country total file carries the consolidated public total and does not invent a
functional allocation for the Adjara republican layer.

The verified 2015 Georgia result is:

```text
2,043,872,100.46 + 142,845,388.71
= 2,186,717,489.17 GEL
```

## 4. Functional-series boundary

The supplied Adjara republic dataset provides fiscal totals, not a reviewed
2015–2025 crosswalk into the explorer's ten municipal functional categories.
Therefore:

- the total line and total-denominator percentages use the consolidated total;
- the ten function lines continue to represent municipality-classified
  expenditure only;
- no residual, invented function, or proportional allocation is created; and
- Adjara and Georgia source notes and CSV metadata disclose this coverage.

This is preferable to presenting an unsupported functional breakdown. A full
Adjara republican functional series would be a separate source-review project.

## 5. Interface

### 5.1 Municipalities index

The latest-year Adjara row uses the consolidated total. The Georgia row and all
countrywide KPI values use the adjusted Georgia total. Municipality and other
region values, maps, ranks, counts, and routes remain unchanged.

The source note says that Adjara includes the autonomous republic's actual
payments and its six municipalities, with internal transfers removed. The
existing occupied-territory explanation remains.

### 5.2 Adjara region page

The existing route remains:

```text
/explorer/municipalities/region/adjara
```

Its total, growth, shares, comparisons, chart total line, table total row, and
CSV total row use the consolidated series. The heading identifies the result as
the Adjara consolidated budget. The page still shows six member municipalities
and keeps their pages unchanged.

### 5.3 Georgia page

`/explorer/municipalities/georgia` keeps its 69-unit entity boundary and gains
the Adjara net republican amount only inside its totals. Copy explains that
Adjara's autonomous-republic layer is included without adding a separate
entity. The 69-unit count does not become 70.

## 6. Data serving and validation

The adjustment CSV is canonical reviewed data and receives the same CSV/Prisma
mirror/parity treatment as the other municipal serving files. The import is
transactional. CSV and database builds must return identical adjustment rows
and derived totals.

Validation must prove:

- exactly one adjustment row for every year 2015–2025;
- exact arithmetic for every net adjustment;
- exact Adjara consolidated totals from six municipal totals plus the net;
- exact Georgia totals from the 69-series base plus the same net;
- no change to any municipality, any other region, or the country functional
  rows;
- no separate Adjara republic entity or route; and
- every source ID resolves to reviewed source metadata.

## 7. Verification and documentation

Implementation follows test-driven development: failing data/model/browser
tests first, then the minimum code to pass them.

Final gates from `CLAUDE.md` are:

```text
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
git diff --check
```

Update `Project_Definition.md`, `DESIGN.md`, the municipal methodology page,
the public municipalities methodology copy, and source metadata in the same
change. No map redesign, new category, new explorer, or unrelated data work is
included.
