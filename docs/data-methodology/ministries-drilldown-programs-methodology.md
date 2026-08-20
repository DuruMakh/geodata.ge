# Ministries Drill-Down — Major Programs Methodology (2006–2025)

**Status:** authoritative reference for the **program-level drill-down** of the ministries
(organizational) expenditure dataset — what a drill-down series is, where every point comes
from, the identity rules that make a series continuous across code changes, and every decision
with its date and rationale. The parent dataset (categories, sources, extraction, reconciliation)
is documented in `ministries-expenditure-methodology.md`; this document goes deep on §7 of that
file and supersedes it wherever they disagree.

Last reviewed: 2026-07-09 (program-succession continuity shipped; full suite 295 tests pass).

---

## 1. What this dataset is

Under each administrative category (ministry group), the explorer offers the ministry's **major
programs** as selectable series — the depth-2 tavi-VI programs (e.g. `27 02` მოსახლეობის
სოციალური დაცვა). Internally these are `major_program` facts in
`data/imports/admin-spending-facts-2004-2025.csv`.

The core design promise: **one series = one program, shown continuously for as long as it
existed**, no matter how many times its tavi-VI code changed. Georgia's organizational codes are
unstable three ways, and each has a dedicated mechanism:

| Instability | Example | Mechanism |
|---|---|---|
| Ministry mergers/renumberings move a program to a new code | 35 02 social protection → 27 02 (2019 super-ministry) | `PROGRAM_SUCCESSIONS` (§5) |
| The same code is recycled for an unrelated program | 25 05 = IDP support 2012-2016, solid waste 2017+ | `PROGRAM_SEMANTIC_ERAS` (§4) |
| Pre-2012 budgets are organizational-unit-based, not program-based | 2008 roads = line 26 11 under the Economy ministry | `LEGACY_PROGRAM_JOINS` (§6) |

**Coverage:** 48 program series. Native program detail exists 2012–2025; nine series carry
owner-approved joined points for 2006–2011; 2005 has no program-level data at all (the source
prints ministry totals only), so 2006–2025 is the maximum possible range.

---

## 2. Data structure

### 2.1 Fact schema (`major_program` rows of the facts CSV)

| Field | Meaning |
|---|---|
| `year` | Budget year of the ACTUAL (cash-executed) amount |
| `item_id` | Stable series identity: `admin_program.<canonical code>.<8-hex hash>` (§3) |
| `parent_item_id` | The series' administrative category (`admin_spending.*`) |
| `level` | `major_program` |
| `amount_gel` | Actual amount in GEL (source figures are thousand GEL) |
| `basis` | Always `actual` |
| `source_id` | Resolves to `data/sources/source-documents.csv` (per-year official document) |
| `official_code` | The **source-year** tavi-VI code — provenance, NOT the identity (a series' points carry different codes across code changes) |
| `official_label_ka` | The source-year printed program label |
| `official_institution_code/_label_ka` | The source-year spending institution |
| `mapping_confidence` | `medium` for all program facts |
| `mapping_notes` | Provenance: legacy-join composition note, succession note, or the generic threshold note |

### 2.2 Identity model

A series identity is the hash of **`code | parentCategory | eraKey`**:

1. Default: all rows of one code within one category merge → renames stay continuous.
2. A **semantic era** splits a recycled code into distinct identities per year-range (§4).
3. A **succession** redirects a code segment's rows to the identity of the series' **latest
   code** — the canonical identity (§5).
4. A **legacy join** injects a pre-2012 organizational line as a point of a modern series (§6);
   the join target then passes through succession resolution like any row.

Resolution order per row (`programItemId` in `generateAdminSpendingFacts.ts`): legacy-join
target → succession → semantic era → default. Succession resolution is **single-step**: entries
always point directly at the chain's final code.

### 2.3 Qualification (which programs appear at all)

- **Threshold:** a series qualifies only if it reaches **100M GEL in at least one year ≥ 2017**
  (`MAJOR_PROGRAM_THRESHOLD_GEL`, `MAJOR_PROGRAM_MODERN_MIN_YEAR`). Measuring over modern years
  only means a large pre-2017 amount can never promote a small modern program that shares its
  code. Once a series qualifies, **all** its years are emitted, including sub-threshold ones.
- **Modern presence:** the drill-down shows only programs alive in 2017–2025 (owner rule,
  2026-07-04). Programs abolished before 2017 are dropped from the drill-down; their money stays
  in the category totals, which aggregate leaf rows independently of this table.
- **Display is names-only:** the explorer labels a series by its **latest** point's
  `official_label_ka`; tavi-VI codes are not surfaced (they change across reorganizations).

### 2.4 What the drill-down never touches

Category totals and the ≤1,000-GEL reconciliation gate read **leaf rows only** and consult none
of the three identity tables. Joins are injected as non-leaf rows; successions and eras only
relabel program identities. Category facts are byte-identical with or without the drill-down
(guarded by tests).

---

## 3. Sources by year

Same per-year sources as the parent dataset (`ministries-expenditure-methodology.md` §2); what
matters for the drill-down is which years carry **program detail**:

| Years | Source | Program detail |
|---|---|---|
| 2005 | 2005 workbook (AcadNusx ministry totals) | none — no drill-down points |
| 2006–2011 | annual-execution-report PDFs | organizational lines only; nine series joined (§6) |
| 2012 | 2012 annual-execution-report PDF | full (capped at depth 3) |
| 2013 | `2013-fact.xlsx` | full |
| 2014 | `2015-fact.xlsx` col_4 | full |
| 2015, 2016 | tavi-VI programmatic PDFs | full (2015 enabled 2026-07-07 after being wrongly off) |
| 2017–2025 | `<year>-fact.xlsx` (confirmed baseline) | full |

---

## 4. Semantic eras (`PROGRAM_SEMANTIC_ERAS`)

Split one code into distinct identities when it was **recycled for a genuinely different
program**. Cover ONLY the truly-different years — a code can be partly rename, partly reuse
(30 06: 2012 reuse, 2014/2016 rename). Classified by the per-year label diff (§9 procedure).

**Pre-2017 recycles (legacy identity split off and dropped):** 24 06, 24 07, 25 05 (2012–2016),
29 05, 32 05 (2013–2016), 27 02 criminal-justice-reform (2013–2016), 30 06 (2012 only),
36 03 (2012–2013).

**Modern splits (both sides stay, as separate series):** 06 04 (party financing → elections,
2019), 24 17 (BTK compensation → Anaklia port, 2021), 25 06 (IDP housing → school construction,
2025), 25 07 (school → tourism, 2025), 25 08 (tourism → sport infrastructure, 2025), 26 02
(prosecution → penitentiary, 2019), 29 07 (military industry → defence capabilities, 2024),
30 01 (public order + border → public order, 2019), 30 02 (protected assets → border protection,
2019), 31 06 (cooperatives → irrigation, 2020), 32 08/32 09/32 11/32 12 (education mega-ministry
churn 2018–2025), 33 02/33 05/33 07 (culture/sport reshuffles), 56 11 (international
obligations 2018 vs later pension use).

Eras whose entire range was superseded by a succession were **removed** on 2026-07-09
(25 07 school 2019–2024, 25 08 tourism 2023–2024, 29 08 defence-capabilities 2017–2023,
32 08 millennium-challenge 2017, 56 11 pension 2020–2024, 32 07 MC-legacy 2016); the succession
table now covers those years.

---

## 5. Program successions (`programSuccessions.ts`) — owner-approved 2026-07-09

**Rule:** when the SAME program (identical label, or a documented slight rename) continues under
a new code — because its ministry merged, renumbered, or the state-wide institution's own code
rotated — all segments join **one canonical identity: the latest code segment**. Perimeter
CHANGES are not successions: 30 01 "public order + state border" (2012–2018) stays separate from
the post-border-split 30 01 "public order" (2019+), because the border guard's money moved to
30 02 — merging them would fake a jump in the series.

### 5.1 The succession chains

| Canonical series | Years | Code chain (year of each segment) |
|---|---|---|
| 27 02 Social protection | 2006–2025 | joins §6 (2006–2011) → 35 02 (2012–2018) → 27 02 (2019+) |
| 27 03 Health care | 2006–2025 | joins (2006–2011) → 35 03 (2012–2018) → 27 03 (2019+) |
| 27 06 IDP & migrant support | 2006–2025 | joins (2006–2011) → 34 02 (2012–2018) → 27 06 (2019+) |
| 26 02 Penitentiary system | 2012–2025 | 27 01 (2012–2018) → 26 02 (2019+), identical label |
| 24 14 Electricity transmission grid | 2014–2025 | 36 03 (2014–2017, Energy ministry) → 24 14 (2018+) |
| 31 05 Unified agro-project | 2017–2025 | 37 05 (2017) → 31 05 (2018+) |
| 31 06 Irrigation modernization | 2017–2025 | 37 07 (2017) → 31 07 (2018–2019) → 31 06 (2020+) |
| 29 07 Defence capabilities | 2017–2025 | 29 08 (2017–2023) → 29 07 (2024+) |
| 29 08 Logistics support | 2018–2025 | 29 09 (2018–2023) → 29 08 (2024+) |
| 25 06 School/kindergarten construction | 2019–2025 | 25 07 (2019–2024) → 25 06 (2025) |
| 25 07 Tourism infrastructure | 2023–2025 | 25 08 (2023–2024) → 25 07 (2025) |
| 34 02 Sport development | 2010–2025 | 39 02 (2010–2017, incl. 2010–2011 joins) → 33 05 (2018) → 32 12 (2019) → 32 11 (2020–2021) → 33 07 (2022–2024) → 34 02 (2025) |
| 33 02 Culture development support | 2019–2025 | 32 10 (2019) → 32 09 (2020–2021) → 33 05 (2022–2024) → 33 02 (2025), identical label every year |
| 32 09 Millennium Challenge Georgia | 2014–2018 | 32 06 (2014–2015) → 32 07 (2016) → 32 08 (2017) → 32 09 (2018) |
| 57 01 External debt service | 2012–2025 | 49 01 → 51 01 → 58 01 → 62 01 → 60 01 → 56 01 → 54 01 → 56 01 → 55 01 → 56 01 → 57 01 |
| 57 02 Domestic debt service | 2012–2025 | same rotation, `NN 02` codes |
| 57 04 Municipal transfers | 2012–2025 | same rotation, `NN 04` codes (label renamed 2021: თვითმმართველი ერთეულები → მუნიციპალიტეტები) |
| 57 11 Funded-pension co-financing | 2018–2025 | 56 12 (2018) → 54 11 (2019) → 56 11 (2020–2021) → 55 11 (2022–2023) → 56 11 (2024) → 57 11 (2025) |
| 57 14 Donor-financed state payments | 2012–2025 | 49 14 → 51 11 → 58 10 → 62 12 → 60 12 → 56 13 → 54 12 → 56 13 → 55 13 → 56 13 → 57 14 |
| 55 14 Pilot-regions program | 2021–2022 | 56 14 (2021) → 55 14 (2022); the program ended with 2022 |

The state-wide rotation reflects the payments institution's own code changing almost yearly
(49 → 51 → 58 → 62 → 60 → 56 → 54 → 56 → 55 → 56 → 57 over 2012–2025) with labels identical
throughout — this resolved the previously-open "state-wide code rotation" question.

### 5.2 Points the successions recovered

Merging did more than relabel: 34 points that were invisible before now appear, because their
code segment never reached 100M on its own while the joined series qualifies. Notable: pension
co-financing's first year (2018: 79.6M under 56 12), donor payments 2019/2022/2023
(54 12/55 13), irrigation 2018–2019 (31 07), Millennium Challenge 2014–2016 (32 06/32 07 —
reversing the earlier "2016 one-off, drop it" call: with successions available, the right
treatment of the label-identical MC point is joining, not dropping), culture support 2019–2021
under the mega-ministry (32 10/32 09), the 2025 tourism point (61.8M), pilot regions 2021, and
the full 2012–2016 state-wide block (debt, transfers, donor). Every recovered point is
value-locked in `tests/data/adminSpending/programSuccessions.test.ts`.

### 5.3 Mechanics & invariants

- Redirect happens in `programItemId` only; the fact keeps its source-year
  `official_code/label/institution` and gets the succession's provenance note in
  `mapping_notes` (legacy-join notes take priority on pre-2012 points).
- Entries per (code, parent) must not overlap in years; targets must be chain-final
  (single-step resolution); each canonical identity must contain at least one fact carrying the
  target code itself; no (year, identity) may receive two facts. All four are guard-tested.
- Choosing the LATEST code as canonical means a future code rotation (e.g. the state-wide
  institution becoming `58 xx` in 2026) is handled by adding succession entries FROM the current
  canonical codes TO the new ones — regenerating shifts every series' `item_id` to the new
  canonical hash (the explorer keys series by `item_id` per build, so this is safe).

---

## 6. Pre-2012 legacy joins (`legacyProgramJoins.ts`) — owner-approved 2026-07-07

Program budgeting starts with the 2012 budget; before that, depth-2 lines are organizational
units under a DIFFERENT code numbering. Where a modern program's function is carried by one or a
few pre-2012 lines with continuous label/value evidence, those years join the modern series
("map as many programs as long as they existed"). Nine series carry 50 joined points (8/year
2006–2009, 9/year 2010–2011; sport starts 2010): roads, social/pensions, health programmes,
general education (owner-chosen perimeter: schools + support units), higher education & science
(university support + science + exams center), foreign policy (3-line merge), common courts
(source 09 02), IDP maintenance, sport. 2006–2007 lines come from the reports' per-ministry
detail sections (`parseDetailProgramRows` + per-year whitelist); the **2006 Social Insurance
Fund split** carves health (123.5M, report narrative) out of the pensions+health fund line so
social = fund + agency − health = 562,920.8k, complementary by construction.

**Explicitly NOT joined** (owner-reviewed): defence and MIA (pre-2012 = whole-ministry lines),
prisons department (true successor is the dropped 27 02 criminal-justice-reform program), and
the modern series 25 03 municipal / 25 04 water / 32 03 vocational / 26 01 justice / 24 01
economy (perimeter or aggregation mismatch pre-2012).

Full per-year compositions, amounts and mechanics: `ministries-expenditure-methodology.md` §7.6
and the join table itself.

---

## 7. Coverage — all 48 series (start–end, as shipped)

Series marked ⛓ are succession chains (see §5.1 for their code chains); ⛏ carry pre-2012
joined points.

**Health & social:** 27 02 Social protection 2006–2025 ⛓⛏ · 27 03 Health care 2006–2025 ⛓⛏ ·
27 06 IDP & migrant support 2006–2025 ⛓⛏ · 27 01 Program management 2019–2025 ·
27 05 Employment reforms 2019–2025

**Education, science & youth:** 32 02 General education 2006–2025 ⛏ · 32 04 Higher education
2006–2025 ⛏ · 32 03 Vocational education 2012–2025 · 32 07 Infrastructure 2017–2025 ·
32 09 Millennium Challenge 2014–2018 ⛓

**Regional development & infrastructure:** 25 02 Roads 2006–2025 ⛏ · 25 03 Municipal
rehabilitation 2012–2025 · 25 04 Water supply 2012–2025 · 25 05 Solid waste 2017–2025 ·
25 06 School construction 2019–2025 ⛓ · 25 07 Tourism infrastructure 2023–2025 ⛓

**Defence:** 29 01 Defence management 2012–2025 · 29 02 Military education 2012–2025 ·
29 05 Infrastructure 2017–2025 · 29 07 Defence capabilities 2017–2025 ⛓ · 29 08 Logistics
2018–2025 ⛓

**Internal affairs:** 30 01 Public order + border 2012–2018 (perimeter predecessor, kept
separate) · 30 01 Public order 2019–2025 · 30 02 Border protection 2019–2025 · 30 06 Civil
security 2015–2025 (gap 2018: the code does not exist in the 2018 source — the
emergency-management function sat outside MIA that year)

**Economy:** 24 01 Economic policy 2012–2025 · 24 06 State property 2017–2025 ·
24 07 Entrepreneurship 2017–2025 · 24 14 Transmission grid 2014–2025 ⛓ · 24 15 Electricity/gas
supply 2018–2025 · 24 17 Anaklia port 2021–2025

**Environment & agriculture:** 31 03 Viticulture/wine 2018–2025 · 31 05 Agro-project
2017–2025 ⛓ · 31 06 Irrigation 2017–2025 ⛓

**Justice:** 26 01 Legal policy 2012–2025 · 26 02 Penitentiary 2012–2025 ⛓

**Foreign affairs:** 28 01 Foreign policy 2006–2025 ⛏

**Sport:** 34 02 Sport development 2010–2025 ⛓⛏

**Culture:** 33 02 Culture development 2019–2025 ⛓

**Debt service:** 57 01 External 2012–2025 ⛓ · 57 02 Domestic 2012–2025 ⛓

**Other costs:** 09 01 Common courts 2006–2025 ⛏ · 20 01 State Security Service 2018–2025 ·
06 04 Elections 2019–2025 · 57 04 Municipal transfers 2012–2025 ⛓ · 57 11 Pension co-financing
2018–2025 ⛓ · 57 14 Donor-financed payments 2012–2025 ⛓ · 55 14 Pilot regions 2021–2022 ⛓

Only remaining hole in any series: 30 06's 2018 (source truth). Five series span the full
possible 2006–2025 natively-joined range with a single identity from day one (32 02, 32 04,
25 02, 28 01, 09 01); the three health/social chains span 2006–2025 via succession.

---

## 8. Decision log (chronological)

| Date | Decision | Where |
|---|---|---|
| 2026-07-04 | 100M threshold; modern-presence rule (drill-down = programs alive 2017–2025; abolished programs stay in category totals only); names-only display | owner (durumakh) |
| 2026-07-05 | 2016 + 2015 + 2012 extraction; drill-down for 2012/2016; 2012 capped at depth 3 (depth-4 undercounts) | owner + extraction review |
| 2026-07-06 | Semantic-era leak audit (6 codes, ~196M) fixed; partial-reuse rule ("cover only truly-different years"); threshold measured over 2017+ rows only; IDP→health 2005–2018; env→env_agri ≤2017; Sport/Culture full de-merge 2018–2024 | owner + adversarial review |
| 2026-07-07 | 2015 drill-down enabled (was wrongly off); 30 01 era back to 2012; legacy joins: nine series 2006–2011, Tier A/B perimeters, 2006 fund split, NOT-joined list; post-review hardening (label last-fact-wins, join-completeness guard, value locks) | owner |
| 2026-07-09 | **Successions:** every program shown as ONE continuous series across code changes — 20 canonical chains (§5.1), incl. the state-wide rotation (resolving that open question) and the reversal of the "drop 2016 MC" call; perimeter changes (30 01 border split) explicitly NOT joined; 34 recovered points value-locked | owner ("successors should be shown as a continuous single program") |
| 2026-07-13 | Historical: import CSV was renamed `admin-spending-facts-2004-2025.csv` → `admin-spending-facts-2005-2025.csv` when it shipped 2005–2025 rows only. On 2026-08-20, reviewed 2004 administrative categories were added and the current filename returned to `admin-spending-facts-2004-2025.csv`; 2004 still has zero major-program rows. | audit follow-up |

---

## 9. Verification & maintenance

**Automated guards** (all in `apps/web/tests/data/`): reconciliation gate (21/21 years ≤1,000
GEL); category facts unaffected by drill-down changes; join-completeness (every join entry
materializes exactly once) + per-year joined-sum value locks; succession structure (disjoint
ranges, chain-final targets, anchored canonicals, one fact per year+identity), per-chain
continuity (exact year lists), and the 34 recovered-point value locks; recycled-code leak guard
+ label-coherence allowlist (`KNOWN_RENAME_CODES`) + pre-2017 rename allowlist — any new
mixed-label identity fails CI.

**Adding a new year** (drill-down steps; see the parent doc §10 for extraction/classification):

1. Run the per-year label diff for every depth-2 code (old label vs new label by code).
2. Same/slight rename, same code → nothing to do (default identity continues).
3. Same program, NEW code (merger/renumber/rotation) → add `PROGRAM_SUCCESSIONS` entries mapping
   every old canonical segment to the new code (the new latest segment becomes canonical).
4. Same code, different program → add a `PROGRAM_SEMANTIC_ERAS` entry covering only the
   reused years.
5. Perimeter change (program split/absorbed) → separate identities; document, don't join.
6. Update the guard-test allowlists ONLY for documented renames; regenerate
   (`npm run data:generate-admin-spending`), run the suite, confirm continuity in the review CSV
   (`data/mappings/review/admin-spending-major-program-review-2004-2025.csv` has per-identity
   year lists).
7. Owner sign-off for every same-program-or-not judgment call.

**Key files:** `apps/web/lib/data/adminSpending/{generateAdminSpendingFacts,programSuccessions,legacyProgramJoins,categories}.ts`;
tests `apps/web/tests/data/adminSpending.test.ts`, `apps/web/tests/data/adminSpending/{programSuccessions,semanticEras,annualReportYears}.test.ts`.

---

## 10. Caveats & open items

1. **Successions and joins are modelled continuity** — the official documents never state "27 02
   continues 35 02"; the evidence is label identity plus documented reorganization facts. Every
   point's `mapping_notes` says which mechanism placed it.
2. **27 06's perimeter** is slightly wider than its 34 02 predecessor (adds migrant support);
   owner-traced as the function's home after the 2019 merger.
3. **Millennium Challenge** is treated as one program 2014–2018 although the 2018 label says
   "მეორე პროექტი" (both are Compact II activity; labels otherwise identical).
4. **Culture before 2019**: the 2017–2018 "arts development" program (33 02 era) is a different
   perimeter and stays out of the 33 02 culture-support chain; culture has no qualifying
   drill-down series before 2019.
5. **30 06 gap (2018)** and **sport infrastructure 25 08 (2025, sub-threshold)** are source
   truth, not pipeline artifacts.
6. **Canonical codes shift with future rotations** (§5.3) — series `item_id`s are stable within
   a build, not across builds that add a new canonical segment.
