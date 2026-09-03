# Ministries Expenditure — Full Methodology (2004–2025)

**Status:** authoritative reference for the *ministries* (organizational) expenditure dataset.
Covers what the data is, where each year comes from, how it is processed, and every
classification decision with its rationale. This document consolidates and supersedes the two
processing-group notes (`2005-2014-ministries-expenditure-methodology.md`,
`group-c-annual-report-ministries-methodology.md`), which remain as detailed per-year config
appendices. Where any older note disagrees with this document or with
`apps/web/lib/data/adminSpending/categories.ts`, **this document and the code are authoritative.**

Last reviewed: 2026-08-20 (2004 complete-annex inclusion and program successions — see
`ministries-drilldown-programs-methodology.md`, the authoritative deep-dive on the §7
drill-down; §7 here is the summary).

---

## 1. What this dataset is

Fiscal.ge exposes national-budget **expenditure** two ways:

1. **Public spending fields** (functional / COFOG-like: health, education, defence, …) — the
   default single-year and multi-year view.
2. **Ministries / major programs** (this dataset) — expenditure by the **organizational
   classification**, i.e. by the spending *institution* (ministry) that the money was
   appropriated to, per Georgia's budget "**tavi VI**" (თავი VI, "chapter 6") organizational
   table. Internally this is the `admin_spending` dataset.

The two are different lenses on the same budget: functional answers *"what was the money for?"*,
organizational answers *"which ministry spent it?"*. They do **not** reconcile to each other
line-by-line (a single ministry funds several functions and vice-versa), but both reconcile to
the same year grand total.

**Coverage:** contiguous **2004–2025** (22 years). The 2004 administrative categories use the
complete state-budget execution annex (see §6.11). In the
multi-year explorer the ministries and their major programs appear as **selectable series**
(this is series selection, not clickable drill-down), and major programs are shown **by name
only** (§7.5).

**Why organizational at all:** it lets users track a ministry (and its large programs) across
two decades of machinery-of-government changes — mergers, splits, renames — which the functional
view hides.

---

## 2. Source data & collection

All sources are **official** Georgian Ministry of Finance / Treasury budget-execution documents.
V1 uses **reviewed** data (manual review + deterministic extraction), never live scraping. Every
figure is an **ACTUAL** (საკასო, cash-executed) amount, in **thousand GEL** at source, stored as
GEL. The basis is always `actual` (planned figures are never used for public values).

### 2.1 Two source families

| Family | Format | Years | Notes |
|---|---|---|---|
| **Excel fact workbooks** | `.xlsx` (`excel-fact-files-2004-2025/<year>-fact.xlsx`) | 2005, 2013, 2014, 2017–2025 | Reviewed workbooks with the full organizational table. 2014's actuals live in the **2015** workbook (see §5.3). |
| **Annual budget-execution reports** | `.pdf` (`annual-execution-reports/…`) | 2004, 2006–2012, 2015, 2016 | Official year-end execution reports. The only real organizational source for these years. Parsed with a bespoke table parser (§4.2). |

### 2.2 Per-year source registry

Every year's rows carry a `sourceId` that resolves to a row in
`data/sources/source-documents.csv` (validated: all 22 resolve, all files exist on disk, all
SHA-256 hashes match the appendix tables in the two group docs).

| Year | `sourceId` | Source file | Approach |
|---|---|---|---|
| 2004 | `source.mof_2004_programmatic_fact_actual` | `annual-execution-reports/2004-annual-execution-annex.pdf` | Complete execution annex, pp. 2–231; `extractOlderMinistryYears.ts` (§6.11) |
| 2005 | `mof_2005_programmatic_fact_actual` | `excel-fact-files/2005-fact.xlsx` | AcadNusx, ministry-totals (§5.4) |
| 2006 | `mof_2006_programmatic_fact_actual` | `annual-execution-reports/2006-annual-execution-report.pdf` | Legacy PDF (§5.5) |
| 2007 | `mof_2007_programmatic_fact_actual` | `…/2007-annual-execution-report.pdf` | Legacy PDF |
| 2008 | `mof_2008_programmatic_fact_actual` | `…/2008-annual-execution-report.pdf` | Legacy PDF |
| 2009 | `mof_2009_programmatic_fact_actual` | `…/2009-annual-execution-report.pdf` | Legacy PDF |
| 2010 | `mof_2010_programmatic_fact_actual` | `…/2010-annual-execution-report.pdf` | Legacy PDF |
| 2011 | `mof_2011_programmatic_fact_actual` | `…/2011-annual-execution-report.pdf` | Legacy PDF |
| 2012 | `mof_2012_programmatic_fact_actual` | `…/2012-annual-execution-report.pdf` | PDF, drill-down |
| 2013 | `mof_2013_programmatic_fact_actual` | `excel-fact-files/2013-fact.xlsx` | Drop-in workbook (§5.2) |
| 2014 | `mof_2014_programmatic_fact_actual` | `excel-fact-files/2015-fact.xlsx` (`col_4`) | Column extract (§5.3) |
| 2015 | `mof_2015_programmatic_fact_actual` | `…/2015-annual-execution-tavi-VI-programmatic.pdf` | PDF, drill-down |
| 2016 | `mof_2016_programmatic_fact_actual` | `…/2016-annual-execution-tavi-VI-programmatic.pdf` | PDF, drill-down |
| 2017–2025 | `mof_<year>_programmatic_fact_actual` | `excel-fact-files/<year>-fact.xlsx` | Confirmed baseline (§5.1) |

### 2.3 Grand-total (reconciliation) basis

The organizational grand total (row `00 00`) is the **payments** total — it includes
financial-asset growth and liability reduction (debt principal), i.e. the same basis as the
2017–2025 baseline. For 2005–2025 it runs ~5–10 % higher than the
functional-classification total (which excludes some of those), so the two datasets have
deliberately different year totals. **2004 is the sole rounding exception:** both views use
the complete annex, with administrative categories GEL 100 above the printed total because its
47 official roots are rounded. The 22 totals run from **2004 ≈ 1.93 B GEL → 2025 ≈ 27.72 B GEL**.

---

## 3. Data model

### 3.1 Categories (the 14 administrative owners)

Every leaf row is aggregated into exactly one of **14** stable, lowercase-ASCII, label-independent
category IDs (`apps/web/lib/data/adminSpending/categories.ts`). Georgian/English labels are
display-only.

| ID (`admin_spending.*`) | English |
|---|---|
| `health_social_affairs` | Health, labour & social affairs |
| `education_science_youth` | Education, science & youth |
| `regional_development_infrastructure` | Regional development & infrastructure |
| `defence` | Defence |
| `internal_affairs` | Internal affairs |
| `environment_agriculture` | Environment & agriculture |
| `economy_sustainable_development` | Economy & sustainable development |
| `justice` | Justice |
| `foreign_affairs` | Foreign affairs |
| `finance` | Finance |
| `culture` | Culture |
| `sport` | Sport |
| `debt_service` | Debt service |
| `other_costs` | Other costs (explicit catch-all) |

### 3.2 Two fact levels

- **`admin_category`** — one fact per (year, category): the sum of that ministry-group's leaf rows.
- **`major_program`** — the drill-down: the large depth-2 programs that still exist in the
  2017–2025 series (§7). Emitted with the program name; the official code is kept in the facts CSV
  for provenance but **not surfaced** in the explorer.

### 3.3 The classifier

`classifyAdminSpendingCategory(row)` routes a leaf by matching keyword fragments against the row's
**institution label** (`institutionLabelKa`), in a fixed cascade. Two structural rules run first
(debt-service and state-wide payments), then backfill-era rules, then a program-level Sport/Culture
split for the combined-ministry years, then the modern ministry cascade. **The final,
unconditional fallback is `other_costs`** — no row is ever dropped or left unclassified (a v1
requirement). Because the classifier keys on institution *labels*, and labels change spelling
across years, most classification decisions are about handling those label variants (§6).

---

## 4. Pipeline architecture

```
raw sources ──► extraction ──► OfficialExpenditureRow[] ──► generateAdminSpendingFacts ──► facts
                                                                    │
                                                    reconciliation gate + validation report
```

### 4.1 Extraction

`extractAdminSpendingOfficialRows()` (`extractWorkbooks.ts`) produces a uniform
`OfficialExpenditureRow[]` for all years. It dispatches per year:

- **xlsx years** (2013, 2017–2025) → `parseTavi6Rows` (the shared workbook parser).
- **2004, 2005, 2014** → `extractOlderMinistryYears.ts` (2004 complete annex; AcadNusx totals; 2015-workbook column).
- **2006–2012, 2015, 2016** → `extractAnnualReportYears.ts` (reads the pre-extracted staging CSV).

Every row carries: year, code (`NN NN…`), depth, institution label, program label, `isLeafCode`,
`isTotal`, and the ACTUAL amount. Leaf detection + institution context is identical across sources
so downstream aggregation is source-agnostic.

### 4.2 Two-stage PDF extraction (2006–2012, 2015, 2016)

`pdf-parse` is async and slow; the fact pipeline is synchronous. So PDF years are pre-extracted:

1. **Pre-extraction** (`scripts/extract-annual-report-pdf.ts`, `npm run data:extract-annual-reports`)
   reads each report PDF, transliterates legacy AcadNusx-font years to Mkhedmuli, parses the
   organizational table with `parseAnnualReportPdf.ts` (a wrap-aware, decimal-anchored table
   parser that stops at the post-table narrative), and writes a reviewable staging CSV
   (`data/staging/admin-spending-annual-report-rows.csv`). It prints each year's reconciliation
   and the PDF SHA-256.
2. **Pipeline read** (`extractAnnualReportYears.ts`) reads that staging CSV synchronously and
   builds rows exactly like the workbook path.

Per-year config knobs (documented at each call site and in the group-C appendix):
`tableStartMarker`, `drillDown`, `maxDepth`, `percentColumn` (2007/2008 plan/actual/% layout),
`maxGap` (wide 2009 table), `rejoinSplitCodes` (2006 codes split across lines),
`syntheticTotalThousandGel` (2006–2010 print no coded `00 00`), `amountOverrides` (2010 `35 00`
`#######` overflow), `financeSplit` and `cultureSportSplit` (§6).

### 4.3 Fact generation & reconciliation

`generateAdminSpendingFacts(rows)`:
1. Sums leaf rows by category → `admin_category` facts.
2. Selects qualifying depth-2 programs → `major_program` facts (§7).
3. `buildAdminSpendingReport` checks, per year, that the category sum equals the source `00 00`
   grand total within **1 000 GEL** (`ADMIN_SPENDING_RECONCILIATION_TOLERANCE_GEL`), the
   rounding noise of thousand-GEL figures. `npm run data:validate` regenerates and fails on any
   breach.

---

## 5. Year-by-year handling

Grouped by processing approach (each group's fine-grained config lives in the referenced code /
appendix).

### 5.1 2017–2025 — the confirmed baseline

Reviewed `<year>-fact.xlsx` organizational workbooks with full program detail. Standard
`parseTavi6Rows` + leaf aggregation; debt service splits automatically out of the state-wide
payments institution. These years were the original shipped dataset; the 2005–2016 backfill was
built to feed the **same** pipeline. (2017/2018 and 2018–2024 received small owner-approved
re-classifications during the 2026-07-06 review — §6.)

### 5.2 2013 — drop-in

`2013-fact.xlsx` is a genuine full organizational table (51 institutions, `00 00` =
8,104,217.6 k, reconciles). Pure config change: widen `ADMIN_SPENDING_YEARS`. Has program detail
(drill-down).

### 5.3 2014 — from the 2015 workbook, column `col_4`

The repo's `2014-fact.xlsx` is the budget **law** (plan), not actuals. 2014 **actuals** live in
`2015-fact.xlsx` (`col_3` = 2013 fact, `col_4` = 2014 fact, `col_5` = 2015 plan). Full leaf
detail; `00 00` = **9,009,812.2 k** (official payments total); debt service =
`58 01` + `58 02` = 779,134.4 k.

### 5.4 2005 — AcadNusx ministry-totals + owner splits

The 2005 workbook stores labels in the **AcadNusx** legacy font (Latin glyphs encoding Georgian)
and prints only ministry **totals** (sub-program detail is incomplete). So 2005 is an
**institution-level** year — no drill-down programs.
- **Transliteration** (`transliterateAcadNusx.ts`): deterministic 1:1 Latin→Mkhedruli map.
- **Total & residual**: the workbook itemises only **2,609,022.9 k** by ministry, but the official
  2005 payments total is **2,626,507.3 k** (the treasury functional E11 figure the functional
  pipeline reconciles to; org == official holds from 2006 on). The ~17.5 M the 2005 annex does not
  itemise is booked to `other_costs` as an explicit undistributed residual, so 2005 reconciles to
  the official total instead of understating it by 0.67 %.
- **Finance line split** (owner-approved): `25 00` "Ministry of Finance" = 574,203.3 k bundles
  debt + transfers + finance. Split using the 2005 **functional** report: debt 282,040.4 k →
  `debt_service`; transfers/other 178,800.8 k → `other_costs`; finance-proper 113,362.1 k →
  `finance`. Without this, 2005 would show a false 6× Finance spike and zero debt.
- **Culture/Sport/Youth split** (owner-approved): `33 00` (Culture, Monuments **and** Sport =
  34,433.2 k) split via the 2005 annual-execution report into sport 6,915.1 k → `sport`, youth
  2,887.9 k → `education_science_youth`, culture remainder 24,630.2 k → `culture`.

### 5.5 2006–2012 — legacy annual-execution-report PDFs

Extracted from the official year-end reports (§4.2). 2006–2011 are AcadNusx (transliterated
pre-parse); 2007–2008 use a two-amount "plan / actual / %" layout (`percentColumn`), and 2009 a
wider table (`maxGap`). Shared characteristics:
- **Synthesized `00 00`** for 2006–2010 (no coded grand-total row printed).
- **Finance three-way split** (`financeSplit`): unlike 2010+ (where debt/transfers/reserves sit in
  a dedicated state-wide institution), 2006–2009 book all of that under the **Finance ministry**.
  So Finance is split three ways to keep the `finance` category comparable across years:
  debt → `debt_service`, finance-proper (`NN 01` own line) → `finance`, remainder
  (intergovernmental transfers, reserves) → `other_costs`. Figures sourced per year.
- **Culture + Sport were one ministry 2006–2009** → Sport (and Youth) peeled out via
  `cultureSportSplit`, matching the 2005 approach (owner: "match 2005").
- **2010** needed a synthesized total *and* an `amountOverride` for the `35 00` `#######` overflow
  cell (reconstructed to 1,605,041.4 k).
- **2012** carries program detail (drill-down), capped at depth 3 (depth-4 subprograms undercount).
- Regional governors / state-minister offices → `other_costs` (individually tiny).

### 5.6 2015, 2016 — tavi-VI annual-execution-report PDFs

- **2016** — full program detail (drill-down, depth 4), `00 00` = 10,292,234.1 k, debt service
  740,185.7 k.
- **2015** — full program detail (drill-down, depth 4; enabled 2026-07-07), `00 00` = 9,703,127.1 k,
  debt service 731,023.7 k. All 23 program-carrying institutions sum to their totals at every
  depth (121 depth-2 rows); the 38 small institutions print no program rows and remain their own
  aggregation leaves. An earlier note calling 2015 "institution-level (printed program detail
  incomplete)" was **wrong** and is superseded — the drill-down was initially left off by mistake.

### 5.7 Drill-down availability by year

Program-level (`major_program`) points exist for **2012–2025** (full source depth-2 detail) plus
**owner-approved joined points for 2006–2011** (§7.6): nine modern series carry pre-2012 values
mapped from the annual reports' organizational lines (2008–2011 from the summary tables;
2006–2007 recovered from the reports' per-ministry detail sections). **2005–2011 remain
institution-level for aggregation** — category totals never use program rows there. Only 2005
(totals-only source) has no drill-down points.

---

## 6. Classification decisions & rationale

The taxonomy is fixed to the 14 modern categories; the work is mapping each year's ministries onto
them. Guiding principle: **map an old ministry to where its function sits in the 2017–2025
taxonomy.** Where a decision was a genuine judgment call it was taken to the owner. Backfill-era
rules are gated by year so they only touch the years they are meant to.

### 6.1 IDP / Refugees ministry → Health & Social (2005–2018)
The standalone Refugees/IDP ministry (labels `ლტოლვილთა` / `გადაადგილებულ`) maps to
`health_social_affairs` for **2005–2018** (`row.year <= 2018`). **Rationale (traced against
2019–2025):** when the ministry was absorbed, its core programs — resettlement-maintenance
(successor `27 06 03 …სოციალური`), livelihood, migration-policy — consolidated into the
**IDPs/Labour/Health super-ministry** (institution 27, caught by the modern health rule), *not*
the nominally-announced three-way split (resettlement→Regional Dev / migration→Interior
/ social→Health). The separate Regional-Development IDP-housing line (`25 06`) was always its own
program. So Health & Social is the consistent home. From 2019 institution 27 carries `დევნილ` and
is caught by the modern rule.

### 6.2 Environment (old naming) → Environment & Agriculture (through 2017)
The pre-2018 "Environment & Natural Resources" ministry (`გარემოსა და ბუნებრივი რესურსების`) maps
to `environment_agriculture` for `row.year <= 2017`. From 2018 it merged with agriculture
(`გარემოს დაცვისა`) and the modern rule handles it. The phrase is unique to ≤2017 and does **not**
match the 2013 Energy ministry (`ენერგეტიკისა და ბუნებრივი რესურსების`), which stays in `economy`.

### 6.3 Sport / Culture de-merge (2004, 2018–2024)
Georgia repeatedly combined these ministries: **Culture + Sport** (2018, 2022–2024) and an
**Education + Science + Culture + Sport mega-ministry** (2019–2021). Left alone, Sport would be 0
for 2018–2024 and Culture 0 for 2019–2021. Owner decision: **full de-merge.** A program-level rule
(gated 2018–2024, triggered when the ministry name itself contains `სპორტ`) routes:
- clearly-**sport** programs (`სპორტ`, not culture/arts term) → `sport`;
- clearly-**culture** programs (culture/arts/heritage term, no education/science term) → `culture`;
- **mixed** culture+sport (no education/science term) → `culture` (the primary sector);
- ministry apparatus + all general education/science → stay with the parent.

The complete 2004 annex also has a combined Culture/Sport root: its exact sport source leaf and
the additive culture remainder are split separately in §6.11. Both series are now continuous
2004–2025. Reconciliation is unaffected (leaves only move between categories). **Gotcha
guarded:** `ტრანსპორტ` (transport) contains the substring `სპორტ` (sport) — stripped before the
sport test so the school-transport program is not mis-routed. Youth needs no action: in the
modern taxonomy it is part of the "Education, science & youth" category already.

### 6.4 Penitentiary / Corrections → Justice (2009–2013)
Matched by the shared token stem `სასჯელაღსრულებ`, which covers both the pre-2014 spelling
(`სასჯელაღსრულების`) and the 2014+ spelling (`სასჯელაღსრულებისა`). Before this fix ~110–160 M/yr
was stranded in Other costs.

### 6.5 Youth Affairs → Education (2005)
The 2005 Culture ministry's Youth Affairs *Department* → `education_science_youth` (owner
decision — youth sits in that category in the modern taxonomy). Keyed on
`ახალგაზრდობის საქმეთა დეპარტამენტი`; requiring `დეპარტამენტი` leaves the 2014 sport-and-youth
*ministry* on sport.

### 6.6 Finance three-way split (2005; 2006–2009)
See §5.4, §5.5 — keeps the `finance` category comparable across years by separating debt principal
and intergovernmental transfers/reserves out of the Finance ministry line.

### 6.7 Culture / Sport split for the combined ministries (2005; 2006–2009)
See §5.4, §5.5 — Sport (and Youth) peeled from the combined Culture ministry per the owner
"match 2005" decision.

### 6.8 Economy ministry keyword (2005)
`ეკონომიკური` catches the 2005 "Economic Development" ministry (`ეკონომიკური განვითარების`);
verified no-op for 2013 and 2017–2025 (their economy ministry uses `ეკონომიკის`).

### 6.9 Debt service
Split into its own category — from the state-wide payments institution for 2010–2025 (the
classifier detects the `ვალდებულებების მომსახურება და დაფარვა` line), and synthesized from inside
the Finance ministry for 2005–2009.

### 6.10 Governors, state-minister offices, constitutionally-independent bodies → Other costs
Regional governors and state-minister offices (individually tiny) go to `other_costs`. Bodies that
are constitutionally independent — Prosecutor's Office (independent since 2018), CEC, Parliament,
courts, State Security Service, Public Broadcaster — and the state-wide transfers/reserves buckets
also sit in `other_costs`, consistent with the 2017–2025 baseline. This is why `other_costs` is
visibly larger before 2017. No genuine functional ministry is hidden there (validated §8).

### 6.11 2004 — complete state-budget administrative inclusion
The canonical `2004-annual-execution-annex.pdf` organizational table is pages 2–231 (SHA-256
`C999654E8C2A430778E48FE67C1BFC7D15DC30F76A60CEEF4477614A31849889`). It contains 47 official
institution roots, each retained as an auditable source leaf. Their rounded actuals sum to
GEL 1,930,210,400 and the printed page-231 state-budget total is GEL 1,930,210,300: a GEL 100
rounding difference, within the existing GEL 1,000 reconciliation tolerance.

Five separately identifiable, source-backed split leaves replace only their same-year official
parents: Finance remainder, debt service, territorial transfers, Culture remainder, and Sport.
They remain exactly additive to the two official parent totals. All 2004 facts are `actual`; the
annex has no depth-2 program rows, so the public 2004 major-program count is zero. The separate
Treasury E11 is central-budget-only corroboration and supplies no administrative fact.

---

## 7. The drill-down (major programs)

> **Full reference:** `ministries-drilldown-programs-methodology.md` — data structure, all
> identity rules (eras, successions, joins), the complete 48-series coverage table, decision
> log and maintenance guide. This section is the summary.

### 7.1 Threshold
A program is a "major program" only if it reaches **`MAJOR_PROGRAM_THRESHOLD_GEL` = 100 M GEL** in
at least one **modern (≥ 2017)** year (`MAJOR_PROGRAM_MODERN_MIN_YEAR = 2017`). Measuring the
threshold over modern years only prevents a large pre-2017 backfill amount from promoting a
below-threshold modern program that happens to share its code (`qualifyingIds`).

### 7.2 Modern-presence rule
The drill-down shows only programs that **still exist in 2017–2025**. A pre-2017 figure appears
only when it belongs to a program that survives to 2017+ (same code, same or slightly-renamed
program). Abolished programs are not shown as their own line — their money still counts in the
category totals.

### 7.3 Program identity, semantic eras & successions
Identity = `code | parentCategory | eraKey`. By default all rows of a code+category merge into one
series (so a **rename** stays a continuous series). `PROGRAM_SEMANTIC_ERAS` splits a code into
distinct identities across year ranges when the same code was **recycled** for a genuinely
different program — the old program gets its own identity and is then dropped (it never reaches the
threshold in a modern year). `PROGRAM_SUCCESSIONS` (`programSuccessions.ts`, owner-approved
2026-07-09) does the inverse: when the SAME program continued under a **new code** (ministry
merger, renumbering, or the state-wide institution's near-yearly code rotation), all segments
resolve to one canonical identity — the latest code — so the series is continuous (e.g. social
protection 35 02 → 27 02 runs 2006–2025 as one series; external debt service runs 2012–2025
across eleven code segments). Succession ranges take precedence over eras; perimeter changes
(e.g. the 2019 border-guard split of 30 01) are NOT successions and stay separate series.

### 7.4 Code-reuse rule (the maintenance hazard)
When a code is recycled between the pre-2017 organizational coding and the 2017+ coding, its
pre-2017 years must be split off — but **only the genuinely-different years**, because a code can
be *partly* rename and *partly* reuse. Worked examples (all in `PROGRAM_SEMANTIC_ERAS`):
- Fully recycled → cover all pre-2017 years: `24 06`, `24 07`, `25 05` (2012–2016), `29 05`,
  `32 05`, `27 02` (2013–2016).
- Partly recycled → cover only the different years: `30 06` (2012 archive-digitization split; 2016
  civil-security kept), `32 07` (2016 Millennium Challenge split; 2017+ infrastructure kept),
  `36 03` (2012–2013 municipal/energy-infra split; 2014/2016 electricity-transmission kept).
- Legitimate renames → **never split** (kept continuous): `24 01`, `25 04`, `26 01`, `27 01`,
  `29 01`, `29 02`, `32 02`, `32 04`, `35 02`, `35 03`, and modern-only drifts like `29 09`
  (ლოგისტიკური/ლოჯისტიკური spelling).

The **earliest organizational-coding year is 2012**, so legacy ranges start at 2012 where a 2012
row exists. One era deliberately reaches further back: `30 01` `public_order_and_border` starts at
**2012** (owner decision 2026-07-07) — the pre-2019 "public order + state border" program is the
same program back through 2012 (identical labels 2013–2016), so the series runs 2012–2018 and the
post-border-split `public_order` era continues 2019+. A guard test
(`tests/data/adminSpending.test.ts` "splits recycled program codes…") asserts the fixed codes drop
their legacy years and that any major-program identity with more than one distinct program name is
on a documented rename allowlist — so a new reuse leak fails CI.

### 7.5 Display: names only
The explorer shows each drill-down program **by name** (the series' LATEST `officialLabelKa`);
the tavi-VI code is intentionally **not** surfaced, because it changes across reorganizations —
the same sport-development program is `39 02` → `33 05` → `32 12` → `32 11` → `33 07` → `34 02`
across the years (since 2026-07-09 those segments are succession-joined into one continuous
2010–2025 series). The per-point `officialCode` remains in the facts CSV for provenance.
(`lib/explorer/explorerData.ts` sets `detailLabel: null` for admin facts.)

### 7.6 Pre-2012 legacy program joins (2006–2011)

Georgia's budget switched to **program budgeting with the 2012 budget**; before that, depth-2
lines are organizational units (departments, LEPLs, financing lines). The 2008–2011
annual-execution reports print those lines in full (157–175 per year), under a **different code
numbering** (e.g. `25 00` = Finance in 2008 but Regional Development from 2009); the 2006–2007
reports print them only in per-ministry **detail sections** deep in the document (recovered by a
targeted whitelist pass, `parseDetailProgramRows` — codes split across lines and amounts wrapping
mid-number are rejoined; nothing outside the whitelist can enter staging). Owner decision
(2026-07-07, "map as many programs as long as they existed"): where a modern qualifying program's
function is carried by one or a few pre-2012 lines with continuous label/value evidence, those
years **join the modern series**. Nine series were approved (`legacyProgramJoins.ts` holds every
component code + amount):

| Series | 2006 | 2007 | 2008 | 2009 | 2010 | 2011 | Notes |
|---|---|---|---|---|---|---|---|
| `25 02` roads | 181.2M | 277.1M | 272.3M | 509.2M | 549.9M | 580.8M | 2006–2008 under the Economy ministry (2006 = Roads Department line, confirmed by the narrative's 181.2M transport total) |
| `35 02` social/pensions | 562.9M | 699.9M | 990.0M | 1 142.7M | 1 166.6M | 1 219.4M | 2006 = fund+agency minus health (see below); 2011 = merge of pensions + assistance + rehabilitation |
| `35 03` health programmes | 123.5M | 158.6M | 226.5M | 285.6M | 329.2M | 277.2M | 2006 = narrative carve-out (see below) |
| `32 02` general education | 188.8M | 204.1M | 286.1M | 326.3M | 365.4M | 349.1M | owner-chosen perimeter: schools + support units (resource centers, curriculum, teacher dev, mandaturi, textbooks — as each existed) |
| `32 04` higher ed & science | 47.2M | 64.3M | 84.8M | 99.5M | 99.4M | 94.7M | university/research support + science + exams center (+ constitutionalism) |
| `28 01` foreign policy | 43.6M | 57.8M | 57.1M | 66.0M | 67.9M | 74.5M | merge: apparatus + missions + international organisations |
| `09 01` common courts | 26.3M | 28.5M | 32.7M | 35.2M | 30.6M | 29.9M | source code `09 02` |
| `34 02` IDP maintenance | 15.6M | 20.4M | 24.5M | 22.2M | 25.8M | 23.9M | source codes `34 04`/`34 03` |
| `39 02` sport | — | — | — | — | 28.5M | 34.3M | ministry created 2010; same code+label |

**The 2006 Social Insurance Fund split (owner-approved).** 2006 predates the social/health
financing reform: state pensions AND the state health programmes both ran through the Social
Insurance Fund's single line (`35 22` = 630,504.7k), with a separate assistance agency
(`35 23` = 55,916.1k). Per the report narrative (health programmes = **123.5M**), the fund is
split: social = 630,504.7 + 55,916.1 − 123,500.0 = **562,920.8k**, health = **123,500.0k** —
the two carve-outs complement the printed lines exactly. This is a modelled split like the 2005
finance/culture splits, carried as `amountThousandGelOverride` on the join entries.

**Mechanics.** `extractAnnualReportYears` injects one synthetic depth-2 row per join (sum of the
source rows, or the documented override), keeping the **primary source code, source label and
source institution** for provenance and carrying a `legacyProgramJoin` marker with the target
series. The row is `isLeafCode=false` and excluded from leaf detection, so **2006–2011 category
aggregation and reconciliation are byte-identical to the institution-level pipeline** — the
joins are drill-down-only. `generateAdminSpendingFacts` resolves the marked rows straight to the
modern identity and stamps the series' parent category plus a per-point provenance note
(`mapping_notes`).

**Explicitly NOT mapped** (owner-reviewed): defence `29 01` and MIA `30 xx` (pre-2012 = one
whole-ministry line each), prisons department (its true successor is the dropped `27 02`
criminal-justice-reform legacy program, not the small modern `27 01` policy program), and the
**modern series** municipal `25 03`, water `25 04`, vocational `32 03`, justice `26 01`, economy
`24 01`, energy `36 03` (perimeter or aggregation mismatch). Those are 2012+ series codes — not
to be confused with the pre-2012 **source** codes in the table above, which reuse the same
numbers for different programs under the old numbering (the 2009–2011 roads source lines are
literally coded `25 03`/`25 04`, and 2007's schools line is `32 03`).

**Caveats.** (1) Pre-2012 points are the closest organizational-unit equivalents of the modern
programs — a modelled continuity, not a source-stated one; per-point composition is in the facts'
`mapping_notes`. (2) The 2008 roads point precedes its modern parent category (no Regional
Development ministry until 2009): the drill-down follows the *program*, the category follows the
*administrative owner* — the two integrity tests document this exemption.

---

## 8. Reconciliation & validation

### 8.1 The reconciliation gate — and its limitation
Every year's category sum must equal the source `00 00` grand total within 1 000 GEL. **All 22
years pass** (per-year deltas 0–600 GEL, pure thousand-GEL rounding). **Important limitation:** the
gate only checks the year *total*. An internally-consistent **mis-split** (money in the wrong
category, but the year total still correct) passes undetected. This is why every hardcoded split
figure (finance, debt, sport, youth, overrides) is independently re-derived against the source
document, and why classification is validated separately (below).

### 8.2 Validation report
`npm run data:validate` regenerates the facts and writes
`data/reports/admin-spending-2004-2025-report.json`: rows, per-year reconciliation status,
source and category totals, and the signed category-minus-source reconciliation difference for
every year. For 2004 that difference is explicitly `100` GEL, documenting the accepted rounding
exception. Validation exits non-zero on any breach.

### 8.3 Validation history
The 2026-07-06 eight-dimension audit covered the then-current 2005–2025 corpus: reconciliation,
series anomaly scanning, 2017–2025 baseline integrity, backfill classification, owner-approved
changes, drill-down coherence, requirements conformance, and provenance. Its one finding — six
recycled codes leaking pre-2017 spend into modern series — was fixed (§7.4) and locked with a
guard test.

On 2026-08-20 the same gates were rerun for the 2004 extension. The complete dataset passed the
v1 requirements: reconciliation and no silent drops, stable ASCII IDs, `actual` basis, contiguous
2004–2025 category coverage, no fabricated 2004 major programs, names-only selectable drill-down,
and CSV source/basis metadata. The 2004 administrative total's signed `100` GEL difference from
the printed state-budget total is retained explicitly as source-table rounding.

---

## 9. Known limitations & caveats

1. **Reconciliation checks the year total only** — mis-splits need independent figure review (§8.1).
2. **Drill-down continuity across reorganizations is modelled** — program codes change at each
   machinery-of-government change, so a continuous *function* (e.g. sport development) spans
   several code segments. Since 2026-07-09 `PROGRAM_SUCCESSIONS` joins those segments into one
   series wherever the label evidence shows the SAME program (see
   `ministries-drilldown-programs-methodology.md` §5); this is a documented modelling layer, not
   a source-stated continuity. Perimeter changes remain separate series.
3. **2005–2011 are institution-level for aggregation.** Nine drill-down series carry
   owner-approved joined points for 2006–2011 (§7.6); everything else has no program points before
   2012. 2005 is totals-only.
4. **Classifier keys on institution labels** — a new year with an unforeseen label spelling could
   mis-route; always re-run the anomaly-scan (below) after adding a year.
5. **2004 has no major-program rows** — the complete annex is institution-level (§6.11).
6. **Combined-ministry splits are functional overlays on organizational data** — the Sport/Culture
   de-merge (§6.3) and the 2005–2009 culture/sport & finance splits impose a functional split on a
   genuinely-combined ministry line. Defensible and owner-approved, but a modeling choice, not a
   raw source fact.

---

## 10. How to extend / maintain (future reference)

To add a new (older or newer) year:

1. **Register the source** in `data/sources/source-documents.csv` and record its SHA-256.
2. **Wire extraction**: xlsx → confirm `parseTavi6Rows` handles it; PDF → add a `YearConfig` to the
   pre-extraction script and a `YearSource` to `extractAnnualReportYears.ts`, then run
   `npm run data:extract-annual-reports` and eyeball the staging CSV.
3. **Add the year** to `ADMIN_SPENDING_YEARS` (`lib/data/coverage.ts`).
4. **Reconcile**: `npm run data:validate` must show the year passing within 1 000 GEL. If it
   doesn't, the extraction is wrong — never widen the tolerance.
5. **Verify the split figures** independently against the source PDF (reconciliation won't catch a
   mis-split).
6. **Classify**: run a ministry → category dump; anything landing in `other_costs` that is a real
   functional ministry needs a keyword rule (gate it to the relevant years so 2017–2025 is not
   disturbed unless the owner authorizes it).
7. **Drill-down / reused codes**: run the per-year label diff (`officialLabelKa` by year for each
   code). Same/slight-rename → leave merged; recycled → add a `PROGRAM_SEMANTIC_ERAS` legacy entry
   covering **only** the truly-different years (see §7.4); add the code to the guard-test allowlist
   only if it is a genuine multi-name rename.
8. **Anomaly-scan**: dump all 14 category series and confirm no implausible jump/zero.
9. **Owner sign-off** for any taxonomy-relevance judgment (a ministry that maps ambiguously, a
   combined ministry to split, a program to drop) — do not decide these unilaterally.

**Key files:** `lib/data/adminSpending/{categories,generateAdminSpendingFacts,programSuccessions,legacyProgramJoins,extractWorkbooks,extractAnnualReportYears,extractOlderMinistryYears,parseAnnualReportPdf,transliterateAcadNusx}.ts`,
`scripts/extract-annual-report-pdf.ts`, `lib/data/coverage.ts`, `lib/explorer/explorerData.ts`.
**Tests:** `tests/data/adminSpending.test.ts`, `tests/data/adminSpending/{annualReportYears,olderMinistryYears,semanticEras}.test.ts`, `tests/data/sourceCoverage.test.ts`.
**Detailed per-year config appendices:** `group-c-annual-report-ministries-methodology.md`
(2006–2012, 2015, 2016 + SHA-256 table), `2005-2014-ministries-expenditure-methodology.md`
(2005, 2014 + SHA-256 table).

## Querying this dataset

These figures are served publicly two ways, both from the same reviewed
rows: the bulk JSON files under `/downloads/data/` and the read-only MCP
connection at `https://fiscal.ge/mcp`.

- Tool: `query_ministries`
- Legal measures: `amount_gel`, `share_of_total_pct`, `share_of_gdp_pct`
- `level` selects `admin_category` or `major_program`. The two are separate
  populations and their rows must never be summed together.

Call `describe_coverage` for the exact ids and year ranges rather than
assuming them; coverage is derived from the loaded data, never hardcoded.
See `ai-grounding-and-caveats.md` for the caveat catalogue.
