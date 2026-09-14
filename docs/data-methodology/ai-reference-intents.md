# AI reference intents

Thirty-four questions, each asked in Georgian and in English, with the answer
Fiscal.ge must give and the limitation that answer must carry. This is the
acceptance list for the query service: if one of these regresses, the service is
wrong, not merely different.

The list comes from the query-core specification (§14.3). It is executed as a
test — `apps/web/tests/factQuery/reference.test.ts`, over the fixture in
`apps/web/tests/factQuery/fixtures/referenceIntents.ts` — so it cannot rot
quietly. Running the calls tests arithmetic and evidence. Whether a real AI
client then *says* the right thing in either language needs a separate real-client
check; the service itself makes no AI calls. SDK transport tests do not establish
an external assistant's language understanding.

**Questions and responses are bilingual in schema 1.1.0.** Reviewed Georgian and
English labels, definitions, missingness, comparisons, ranking explanations and
source descriptions travel with the same figures. Clients use the appropriate
`*Ka`/`*En` fields. The existing numerical, source and comparability expectations
remain unchanged; language assertions verify the additional response fields.

## How the expected values were established

Not by recording what the code returned. Three anchors were checked by hand
against the reviewed CSVs in `data/imports/` before anything else was accepted:

| Check | Result |
| --- | --- |
| 2025 health expenditure | Single reviewed row, 2,242,454,466 GEL — matches |
| 2025 VAT | Single reviewed row, 10,158,086,603 GEL — matches |
| 2004 revenue | Exactly **ten** category rows, summing by hand to **2,283,035,800 GEL** |
| 2004 increase in liabilities | **No row exists at all** — so the answer must be "missing", never 0 |

Money is compared exactly. Ratios carry a tolerance of 1e-9 — tight enough that
a scaling error or a wrong denominator fails immediately, and far too tight to
hide one.

## The intents

| # | Question | Expected answer | Must carry |
| --- | --- | --- | --- |
| 1 | Health spending from the state budget, 2025 | 2,242,454,466 GEL | State-budget expenditure scope |
| 2 | VAT collected, 2025 | 10,158,086,603 GEL | Consolidated receipts scope — **different** from #1 |
| 3 | Total receipts, 2004 | 2,283,035,800 GEL | The 2004 total covers fewer components (severe), and the two national scopes differ (severe) |
| 4 | Increase in liabilities, 2004 | **Missing** — never 0 | The series is unavailable that year (severe) |
| 5 | VAT change, 2004→2005 | +359,273,634 GEL, +57.19% | Nominal prices only. **No** total-scope warning: this is one comparable category |
| 6 | Growth of total receipts, 2004→2005 | **Declined.** Both values returned; no growth computed | The 2004 total's narrower coverage makes it not comparable |
| 7 | Education spending change, 2015→2024 | +2,090,539,728 GEL, +250.38% | Nominal prices — not a real-terms increase |
| 8 | Health as a share of GDP, 2025 | 2.1439% | The 2025 GDP denominator is preliminary; both budget and GDP sources cited |
| 9 | Health share of GDP, 2009→2010 | +0.03 percentage **points** | The GDP accounting standard changes between these years |
| 10 | Budget deficit, 2024 | Revenue total 29,744,320,017 GEL | Revenue and expenditure are different boundaries — subtracting them is **not** a deficit |
| 11 | Health and education in Batumi and Kutaisi, 2024 | Four separate cells | Some municipal financing sits outside the functional classification |
| 12 | Khulo's budget, 2024 | 30,969,077.43 GEL | The required payment actual is missing; this is the reviewed functional total (severe) |
| 13 | Municipal total growth, 2015→2024 | **Declined.** Both values returned | The definition of the municipal total changed between them (severe) |
| 14 | Adjara's latest regional total | 1,212,519,508.44 GEL (2025) | The republican consolidation is applied once; all three sources retained |
| 15 | Georgia's municipal aggregate, latest | 6,110,301,258.08 GEL (2025) | The aggregate's scope is explained, not presented as a plain sum |
| 16 | Municipal education spending, Georgia, 2025 | 793,005,387.44 GEL | Municipal functions only; the republican budget has no reviewed functional crosswalk |
| 17 | Highest budget per resident, 2025 | Oni, then Mestia, Kazbegi, Lentekhi, Ambrolauri | 64 eligible peers; the reviewed population denominator |
| 18 | Georgia's budget per resident | **Missing** | The aggregate includes five budgets with no territorial population, so no denominator exists (severe) |
| 19 | Spending in municipal code 05 | **No row at all** | The code is excluded as not territorially attributable, with the reason given |
| 20 | Fastest-growing major programs, 2017→2024 | Entrepreneurship development +464.33% | These are reviewed programs, not every government program (severe); 17 of 48 excluded for a missing endpoint |
| 21 | Government debt, 2024 | 33,169,300,000 GEL | Debt is a central-government liability, not a budget figure (severe) |
| 22 | Debt service, 2027 | 4,388,380,862.53 GEL | Not a budget figure; a schedule of the existing portfolio, not an outcome (severe) |
| 23 | Average interest rate on external debt, 2016 | **Missing** — never estimated | Not a budget figure; no reviewed source published the rate |
| 24 | Budget deficit as a share of GDP, 2020 | −9.158% of GDP | The IMF general government balance, not receipts minus expenditure (severe); the sign is the answer |
| 25 | Nominal GDP, 2024 | 93,022,275,315.71 GEL | Nothing further: one published SNA 2008 year |
| 26 | Nominal GDP, 2025, and whether it is final | 104,598,139,883.33 GEL | The figure is preliminary |
| 27 | Construction's share of GDP, 2024 | 7.4114% | A percentage of all national GDP, not a fraction |
| 28 | Construction's real growth, 2010 | **Missing** — never 0 | Real growth starts a year after the nominal series |
| 29 | Annual inflation, August 2026 | 5.6479% | Nothing further: one published Geostat month |
| 30 | Core inflation index level, August 2026 | **Declined** — core has no published index | The valid measures are named instead |
| 31 | National Bank target, June 2014 | **Missing** — never assumed | No earlier target is verified; that does not mean none existed |
| 32 | Groups making up annual inflation, August 2026 | Twelve division contributions and a 0.1396 pp residual, summing to 5.6479% | Contributions are Fiscal.ge's approximation, not Geostat figures (severe); the residual is not a category |
| 33 | Change in annual inflation, August 2025 → August 2026 | +0.9983 percentage **points** | A point change between two published months |
| 34 | Highest annual price growth by division, August 2026 | Division 07 (transport) 15.1989%, then 04 (housing and utilities) 8.4682%, 12 (miscellaneous) 7.1272% | Twelve eligible divisions; the headline, target and residual are excluded |

## What the list is designed to catch

Six of the twenty expect the service to **decline or qualify** rather than
answer plainly. That is deliberate: the failures that matter here are not wrong
arithmetic but confident answers to questions the data cannot support.

- **#4 and #18** must return *missing*. A zero, or an interpolated value, would
  be an invented fact.
- **#6 and #13** must refuse to compute growth while still returning both
  reviewed endpoint values. A declined comparison that discarded its numbers
  would push a reader to subtract them anyway.
- **#10** is a trap: there is no deficit series, and the guard exists so a
  client does not manufacture one by subtracting two incompatible totals.
- **#19** must produce no number of any kind for an excluded code.
- **#12** is the case the specification calls out as most dangerous. The source
  data's own display flag says "no warning"; the underlying quality state says
  the required figure is missing. The engine reads the quality state.

## A defect this list found

Authoring intent 20 surfaced a real bug that 36 existing ranking tests did not.
A ranking by *percentage change* over a GEL measure returned
`{ value: 464.33, unit: "GEL" }` — the value was a percentage, the unit was
copied from the measure. Read plainly, that says "464 GEL" instead of "+464%":
exactly the class of misreading this service exists to prevent. `compare` was
never affected, because its unit describes the two endpoints and its changes sit
in separately named fields; `rank` collapses both into one value-and-unit pair,
so it has to choose.

Fixed, with regression tests, in `apps/web/lib/factQuery/rank.ts`. Percentage
changes now report `percent`. Percentage-point changes also report `percent`,
which is imprecise — the unit vocabulary has no percentage-point member, and
adding one changes the shared schema. That remains an open contract decision;
the ranking's own definition string names the exact metric in the meantime.

## Related

- `ai-grounding-and-caveats.md` — the caveat catalogue, provenance mapping and
  published bulk files.
- `docs/superpowers/specs/2026-08-28-fiscal-ai-query-core-design.md` §14.3 — the
  source of this list.
