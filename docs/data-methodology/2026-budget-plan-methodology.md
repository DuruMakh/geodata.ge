# 2026 Budget Plan Methodology

Status: working methodology for the planned 2026 state budget on the Spending pages

Scope: national budget expenditure, planned (`basis = planned`), 2026, by spending area and by ministry

This document explains how the 2026 numbers on the Spending pages were made. 2026 is the approved plan from the Law of Georgia on the 2026 State Budget, not an execution result. It follows the same two-source method as the 2025 actuals (`2025-expenditure-final-methodology.md`) and the same ministry pipeline as 2004–2025 (`ministries-expenditure-methodology.md`), with the law in place of the Treasury E11 PDF and the execution workbook. Every 2026 row is marked `planned` and is replaced by actuals when they are published (section 9).

## 1. What ships

- 13 planned rows in `data/imports/expenditure-facts-2026-planned.csv` (Spending by area), source `source.mof_2026_budget_law_planned`.
- 62 planned rows in `data/imports/admin-spending-facts-2026-planned.csv` (Spending by ministry): 14 administrative categories and 48 major programmes, same source id.
- Both files are read next to the 2004–2025 files by the shared loaders (`loadReviewedBudgetFactRows`, `loadReviewedAdminSpendingFacts` in `apps/web/lib/data/servedData.ts`). The 2004–2025 files are unchanged byte for byte, and keep their "2004-2025" names because the year range is read from the rows.
- Out of scope by design: Revenue, Spending by type, Municipalities, Debt and Deficit. The Revenue page shows the consolidated (state plus municipal) budget, and the law covers the state budget only.

## 2. Source

The Law of Georgia on the 2026 State Budget (№1219-IVმს-XIმპ, adopted 10/12/2025, published 19/12/2025, in force 01/01/2026, matsne document 6701007), as published by the Ministry of Finance at `https://mof.ge/ka/govbudget?year=2026`. Checked 2026-10-24: matsne lists no consolidated versions and the Ministry's budget page lists only the original law. The Ministry announced a planned amendment in early September 2026 (bm.ge, 3 September 2026); none had been adopted at the check date. If the law is amended, follow section 10.

The perimeter is the same as the live Spending pages. The law's own "2024 წლის ფაქტი" payments total equals the site's 2024 spending total (25,946,342.9 thousand GEL), and the ministries total equals the spending total in every year.

### 2.1 Files and hashes

| Chapter | Used for | File | SHA-256 | Source registry id |
| --- | --- | --- | --- | --- |
| თავი III, Article 9 | Functional classification of expenses plus non-financial assets growth (COFOG codes 7.x), 27,311,597.0 thousand GEL. Columns: 2024 fact, 2025 plan, 2026 plan, funding split. | `docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-III.doc` (258,560 bytes) | `4244b3c5cc9565da0326e88397dd21af727391fc9d6c8347a2adad2e69fb8297` | `source.mof.expenditure.2026.budget_law_tavi_iii` |
| თავი VI, Article 16 | Appropriations by institution, programme and subprogramme (expenses, non-financial assets growth, financial assets growth, liabilities decrease). Grand total row `00 00` = 30,881,358.0 thousand GEL. | `docs/Raw Data/Expenditure/mof.ge/budget-law-2026/2026-tavi-VI.docx` (156,171 bytes) | `fecd149457fd373422e6c5f4c0b47d88380416b68c90863495bd7a97a16103d7` | `source.mof.expenditure.2026.budget_law_tavi_vi` |

Both files are recorded in `data/methodology/source-archives/expenditure.csv` (retrieved 2026-10-24, redistribution status `repository_owner_approved`) and the hashes are asserted in code by `apps/web/lib/data/budgetLaw/sources.ts` (`BUDGET_LAW_2026`).

Chapter I (Article 2, payments total 30,881,358.0 thousand GEL; financial assets growth 650,000.0 and liabilities decrease 2,919,761.0 thousand GEL) is not archived or read by the pipeline. The reconciliation total is the Tavi VI grand-total row `00 00`, which prints the same 30,881,358.0, and the two supplement totals are checked against the Tavi VI rows (section 4.2).

### 2.2 The converted Tavi III

Tavi III is published as `.DOC`. It is converted once with LibreOffice (`soffice --headless --convert-to docx`) to a generated intermediate:

```text
data/staging/budget-law-2026/2026-tavi-III.docx
data/staging/budget-law-2026/2026-tavi-III.docx.provenance.json
```

The provenance record stores the source hash above, the converted file's SHA-256 (`ef4484ce21102eb35d2a6bd1e6c49f058214512ce782fe127f6af94547adea7a`), the converter command and version (LibreOffice 24.2.7.2) and the conversion date (2026-10-24). The converted bytes are not reproducible across LibreOffice versions, so only its parsed table content is tested. The hash of the official `.DOC` is the authority; the converted file is never treated as raw data. The generator checks the original `.DOC` hash, the Tavi VI hash and the converted file against its provenance record before it reads anything.

The law tables are read by `apps/web/lib/data/budgetLaw/readDocxTables.ts` (a small reader over the existing `fflate` dependency) and shaped into the existing row types by `apps/web/lib/data/budgetLaw/lawRows.ts`. No `.docx` reader existed before; the Treasury PDF parsers were not reused because the law's column layout differs from the Treasury forms.

## 3. Generated files

```text
data/imports/expenditure-facts-2026-planned.csv
data/imports/admin-spending-facts-2026-planned.csv
data/staging/expenditure-2026-planned-financial-assets-liabilities-supplement.csv
data/staging/admin-spending-official-rows-2026-planned.csv
data/mappings/review/admin-spending-program-concordance-2026.csv
data/mappings/review/spending-field-mapping-review-2023-2025.csv   (two 2026 rows added, section 4.3)
data/reports/expenditure-planned-2026-report.json                  (gitignored)
data/reports/admin-spending-2026-planned-report.json               (gitignored)
```

The staging files are generated intermediates, not raw data. One caution for a reviewer who opens `admin-spending-official-rows-2026-planned.csv`: it reuses the workbook-row shape of the 2004–2025 pipeline, so the 2026 plan sits in the column named `actual_thousand_gel`, and the 170 uncoded "მომუშავეთა რიცხოვნობა" (headcount) rows hold people, not thousand GEL, in the same column. No fact uses either: the generator requires a programme code on every row it counts, and a test checks that the coded leaf rows alone sum to exactly 30,881,358,000 GEL.

## 4. Spending by area

### 4.1 Method

```text
2026 planned field amounts
= Article 9 functional rows mapped by the unchanged COFOG rules (generateCompactPdfSpendingMappings)
+ financial assets growth and liabilities decrease taken from the Tavi VI programme rows
  (extractFinancialAssetAndLiabilitySupplements, reviewed code and label mappings)
```

Composition uses `composeFinalExpenditureFacts`, which gained an optional `basis` (default `actual`, so every earlier year is byte-identical). For `planned`, `mapping_notes` read "Budget law Article 9 mapped rows: N; Tavi VI financial-asset/liability supplement rows: M". The supplement mapping helpers moved from the 2025 script to `apps/web/lib/data/realExpenditurePdf/supplementMappings.ts` without behaviour change; rerunning the 2025 generator gives output byte-identical to before the move.

Command: `npm run data:generate-planned-2026-expenditure`.

### 4.2 Reconciliation

| Check | Result |
| --- | --- |
| Article 9 mapped total against the Article 9 grand total | 27,311,597,000 against 27,311,597,000 GEL |
| Supplements | 3,569,761,000 GEL: financial assets growth 650,000,000 plus liabilities decrease 2,919,761,000, across 23 rows |
| Planned total | 30,881,358,000 GEL |
| Tavi VI `00 00` total | 30,881,358,000 GEL, difference 0 |
| Unclassified | 0 GEL (`spending.other_unclassified` has no 2026 amount) |

The generator throws if the difference exceeds 1,000 GEL.

### 4.3 Rulings applied

**COFOG 7.1.2, foreign economic aid (2,000.0 thousand GEL in 2026).** The COFOG rule list has no 7.1.2 rule, so without a ruling the Article 9 mapping fell 2,000,000 GEL short of its grand total and the generator stopped. The row is mapped to `spending.general_public_services` (medium confidence; COFOG 01.2 belongs to general public services like its 7.1 siblings) by a rule that applies on the budget-law path only (`budgetLawArticle9ExtraMappingRules`, passed through the optional `extraRules` argument of `generateCompactPdfSpendingMappings`; its default leaves every other caller unchanged).

Why 2025 E11 is unaffected: the Treasury 2025 E11 contains a 7.1.2 row of 190,528 GEL, but its own 7.1 total (3,919,933,677 GEL) leaves that row out, so the 2025 mapping reconciles only because 7.1.2 has no rule. A rule on the shared path would push the 2025 mapped total 190,528 GEL above its grand total and fail validation. Restricted to the law path, the 2025 output was proven byte-identical (`cmp`) before and after, and a unit test in `publicMapping.test.ts` shows 7.1.2 skipped by default and mapped only when the extra rule is passed. In the 2024 column of the law 7.1.2 is 0, so the rule makes no difference to the cross-check.

**Supplements.** All 23 supplement rows are medium confidence; none is low or unclassified.
- Financial assets growth: 650,000,000 GEL. Liabilities decrease: 2,919,761,000 GEL.
- Every liabilities-decrease row maps to `spending.debt_service` (24 17, 54 01, 54 02) except `45 12` (61,000 GEL, a transfer to the Akhalkalaki and Kumurdo eparchy training centre), which goes to `spending.education`, as in the reviewed 2024 and 2025 supplements.
- 15 rows use reviewed exact-label propagation from 2023–2025, 2 use the 2026 review rows below, and 6 use generated candidates that agree with the reviewed history of the same project (24 14 01 01/02/03/05, 24 18, 54 14 12).

**Two 2026 review rows.** For two projects the 2026 label punctuation (curly quotes, spacing around commas, and for 54 14 01 a dropped donor) differs from the reviewed labels, so the exact-label match missed and the generated candidate said infrastructure while the latest reviewed decision said otherwise. Two rows were added to the review CSV, following the 2025 review for the same project:

| Code | Project | 2026 plan | Field |
| --- | --- | ---: | --- |
| 24 14 01 06 | Kheledula–Lajanuri–Oni (EU-NIF, KfW) | 45,000,000 GEL | `spending.economic_affairs` |
| 54 14 01 | Adjara solid waste project (E5P, EBRD) | 8,000,000 GEL | `spending.agriculture_environment` |

They live in `spending-field-mapping-review-2023-2025.csv`, whose file name does not say 2026; the 2026 amount is in its `actual_gel` column and the row note says so. The two rows move 40,000,000 and 5,000,000 GEL of financial-assets growth (the supplement part of those projects) away from infrastructure compared with the generated candidate. A regeneration of every year 2007–2025 before and after adding the rows gave 38 byte-identical output files, so no earlier year changed.

### 4.4 2026 planned amounts by field

| Field | 2026 plan, GEL | Confidence | Article 9 rows | Supplement rows |
| --- | ---: | --- | ---: | ---: |
| social_protection | 7,859,787,000 | high | 1 | 0 |
| health | 2,400,710,000 | high | 1 | 0 |
| education | 3,540,028,300 | medium | 1 | 1 |
| defence | 1,986,330,000 | high | 1 | 0 |
| public_order_safety | 2,706,636,000 | high | 1 | 0 |
| infrastructure_regional_development | 3,873,850,000 | medium | 3 | 15 |
| economic_affairs | 1,359,165,000 | medium | 5 | 3 |
| agriculture_environment | 837,511,000 | medium | 2 | 1 |
| culture | 427,167,700 | medium | 4 | 0 |
| sport | 304,978,000 | high | 1 | 0 |
| general_public_services | 827,495,000 | medium | 5 | 0 |
| debt_service | 4,757,700,000 | medium | 1 | 3 |
| other_unclassified | 0 | high | 0 | 0 |
| **Total** | **30,881,358,000** | | 25 | 23 |

### 4.5 The 2024 cross-check

Method check (not shipped): the law's own "2024 წლის ფაქტი" Article 9 column is mapped with the same rules and compared with the shipped 2024 functional facts. The shipped 2024 totals contain the 2024 financial-assets and liabilities supplement (1,655,264,173 GEL, `data/staging/expenditure-2024-financial-assets-liabilities-supplement.csv`), which Article 9 does not, so the comparison is against the shipped 2024 amount minus that supplement, which equals the shipped 2024 Treasury E11 mapped amount exactly.

At total level the two agree within **155 GEL** (24,291,078,900 against 24,291,078,745 GEL). Every functional code the 2024 E11 mapping uses is present in the law and maps to the same field there, so the mapping rules are not the cause of any difference. Per field the two differ, because the law restates 2024 actuals between COFOG codes compared with the Treasury E11:

| Field | Shipped 2024 | Supplement | Shipped minus supplement (E11) | Law 2024 fact, mapped | Law minus E11, GEL |
| --- | ---: | ---: | ---: | ---: | ---: |
| social_protection | 6,413,435,181 | 0 | 6,413,435,181 | 6,416,382,700 | +2,947,519 |
| health | 2,029,609,918 | 0 | 2,029,609,918 | 2,029,609,900 | -18 |
| education | 2,925,471,905 | 41,000 | 2,925,430,905 | 2,921,026,600 | -4,404,305 |
| defence | 1,677,796,352 | 110,000,000 | 1,567,796,352 | 1,567,796,400 | +48 |
| public_order_safety | 2,100,297,240 | 0 | 2,100,297,240 | 2,100,297,200 | -40 |
| infrastructure_regional_development | 4,578,210,021 | 246,508,906 | 4,331,701,115 | 4,331,501,800 | -199,315 |
| economic_affairs | 1,240,477,876 | 7,085,259 | 1,233,392,617 | 1,224,484,800 | -8,907,817 |
| agriculture_environment | 836,224,290 | 0 | 836,224,290 | 836,224,300 | +10 |
| culture | 329,905,670 | 5,278,320 | 324,627,350 | 316,162,600 | -8,464,750 |
| sport | 229,876,602 | 0 | 229,876,602 | 239,798,300 | +9,921,698 |
| general_public_services | 822,822,122 | 1,667,861 | 821,154,261 | 830,261,400 | +9,107,139 |
| debt_service | 2,762,215,741 | 1,284,682,827 | 1,477,532,914 | 1,477,532,900 | -14 |
| other_unclassified | 0 | 0 | 0 | 0 | 0 |
| **Total** | 25,946,342,918 | 1,655,264,173 | 24,291,078,745 | 24,291,078,900 | +155 |

The differences come from these code-level restatements (law minus E11, GEL):
- 7.1.1.1 +9,107,152 and 7.4.9 -9,107,194: about 9.1 m GEL from economic affairs to general public services.
- 7.8.1 +9,921,698, 7.8.6 -7,877,692, 7.8.2 -587,116 and 7.9 -4,404,305 net: sport, culture and education.
- 7.10.9 +2,947,534: social protection.
- 7.4.3.5 +199,332 and 7.4.5.1 -199,362: about 0.2 m GEL from infrastructure to economic affairs.
- Moves inside one field that cancel in the field totals: 7.6.3 -150,564,988 against 7.6.6 +150,565,000; 7.9.2 +105.3 m against 7.9.6 and 7.9.8 -112.6 m; 7.5.4 and 7.5.6 about 0.74 m each way.

The largest field difference is 9.9 m GEL (sport, +4.3%).

**What this means for comparing 2025 actual with 2026 plan.** The site's 2025 actual comes from the Treasury E11 classification; the 2026 plan comes from the law's classification. For the same year the two classifications can differ by up to about 10 m GEL in a single field (sport, general public services, economic affairs, culture and, to a lesser extent, education) with no change in total. A change between 2025 actual and 2026 plan in one of these fields that is below about 10 m GEL can be a reclassification rather than a real change, and the field-level year-on-year change should be read with that in mind. Totals, and fields that agree to within a few GEL in 2024 (health, defence, public order and safety, agriculture and environment, debt service), are not affected. This is a property of the law's own restatement, not a mapping defect, and it is not corrected for in the data.

## 5. Spending by ministry

### 5.1 Method

The Tavi VI rows go through the existing `generateAdminSpendingFacts` (14 administrative categories plus major programmes of at least 100 m GEL), with `plannedYears = [2026]` so that every 2026 fact has basis `planned` (only while 2026 has no execution rows; section 9). The same script writes the 2004–2025 facts to the unchanged base file and the 2026 facts to `admin-spending-facts-2026-planned.csv`: `npm run data:generate-admin-spending`. The script fails if the 2026 reconciliation fails.

The ministries 2026 total is 30,881,358,000 GEL: it equals the Tavi VI `00 00` total (difference 0, status `passed`) and the Spending-by-area 2026 total.

| Category | 2026 plan, GEL |
| --- | ---: |
| health_social_affairs | 9,668,640,000 |
| debt_service | 4,733,000,000 |
| other_costs | 3,868,879,000 |
| regional_development_infrastructure | 3,246,550,000 |
| education_science_youth | 2,702,198,000 |
| defence | 1,890,000,000 |
| internal_affairs | 1,547,000,000 |
| economy_sustainable_development | 928,550,000 |
| environment_agriculture | 808,161,000 |
| justice | 443,235,000 |
| culture | 364,835,000 |
| sport | 325,310,000 |
| foreign_affairs | 225,000,000 |
| finance | 130,000,000 |
| **Total** | **30,881,358,000** |

### 5.2 The 2026 restructuring

The 2026 law renumbers and splits institutions. `25 00` is now the Ministry of Infrastructure, `35 00` the new Ministry of Regional Development, `54 00` the state-wide general payments (it was `57 00`), and `57 00` is now the Civil Service Bureau.

**The 25 00 / 35 00 classification rule.** In `apps/web/lib/data/adminSpending/categories.ts`, an institution named "ინფრასტრუქტურის სამინისტრო" or "რეგიონული განვითარების სამინისტრო" is routed to `admin_spending.regional_development_infrastructure` before the fallback. Without it both would land in Other costs. The rule is a verified no-op for 2004–2025: a test regenerates 2004–2025 and compares every row with the committed file, and the committed base file shows no diff. Regional development and infrastructure 2026 is 3,113,650,000 (25 00) plus 132,900,000 (35 00) GEL, with nothing else added. No other classification rule was needed: for every institution in 2026 Other costs, the institution with the same label sat in Other costs in 2025 too.

**Other costs in 2026 (3,868,879,000 GEL).** The largest items are the state-wide payments `54 00` outside debt service (2,541.13 m GEL), the State Security Service (380.0 m), common courts (180.3 m), the Special State Protection Service (126.5 m), the Public Broadcaster (101.2 m), the Prosecutor's Office (98.7 m) and Parliament (91.5 m). Eight bodies are in the law at 0 for 2026 (among them the Civil Service Bureau and the Kutaisi International University), and the Intelligence Service (25.5 m in 2025) is not listed.

**Moves between ministries that change category totals.** The new Ministry of Regional Development (`35 00`, 132.9 m GEL) includes school-pupil transport (`35 02`, 70.0 m GEL) that was inside Education's `32 02` before. About 70 m GEL therefore moves from Education to Regional development at category level. Separately, school construction moves from Education to Infrastructure (below).

**No 57 xx programme rows in 2026.** The law prints `57 00` with 0.0 for 2026 and lists no `57 xx` programmes, and the same holds for `55 00`–`62 00`, which carry comparison columns only. No 2026 row from `57 00` reaches a fact. A test asserts that no 2026 row with a `57 xx` code has an amount above zero, so a change in the law's structure would be noticed.

### 5.3 Programme identity: the planned-year qualification rule

A major programme is a drill-down series if it reaches 100 m GEL in a modern year. For a planned year this works in one direction only: **a plan never changes which actual-year series exist.** A 2026 programme of at least 100 m GEL can become a series for 2026 only (a "planned-only" series), and it does not promote earlier actual points of a programme that never reached 100 m GEL in 2017–2025. Without this, the plan figures of `24 08`, `31 02`, `32 06`, `40 01` and `54 07` would have pulled their 2017–2025 rows into the published actual series. In `generateAdminSpendingFacts`, `qualifyingIds` excludes planned rows and decides which series have actual points; `plannedQualifyingIds` (planned rows included) can only add a series' points in a planned year.

A consequence: the fact-query reference fixture, intent 20 (major programmes over 2017 to 2024), now counts 54 candidate series instead of 48 because 6 series exist only in the 2026 plan. The ranked result (31 eligible series, the top three ids and values) is unchanged, because only the count of candidates excluded for lacking 2017 or 2024 data grew. This was ruled and recorded when the fixture was updated. If the owner prefers that a plan never creates a series, a one-line change in `generateAdminSpendingFacts` (dropping `plannedQualifyingIds`) does it, and the 6 series would lose their lone 2026 point while their money stays in the category totals.

### 5.4 Successions and eras: the exception to "latest code"

`PROGRAM_SEMANTIC_ERAS` and `PROGRAM_SUCCESSIONS` gain 2026-only entries (`apps/web/lib/data/adminSpending/`). The existing rule says a succession points at the series' latest code. For planned years the entries point at the **existing canonical code** instead, so that no 2004–2025 item id changes. The file header and the `targetCode` comment state the exception. The new entries carry the note prefix "(2026 budget law concordance)" because, unlike the earlier ones, they are not owner-approved yet.

| 2026 code | Points at | Programme |
| --- | --- | --- |
| 54 01 | 57 01 | External debt service |
| 54 02 | 57 02 | Domestic debt service |
| 54 04 | 57 04 | Municipal transfers |
| 54 11 | 57 11 | Pension co-financing |
| 54 14 | 57 14 | Donor-financed payments |
| 24 16 | 24 17 `anaklia_port` | Anaklia deep-sea port |
| 25 06 | 25 07 `tourism_infrastructure` | Tourism infrastructure |
| 25 05 | 25 06 `school_infrastructure` | School construction |

Era entries keep the 2025 identity for 26 02, 29 07, 29 08, 30 01, 30 02, 31 06 and 33 02 (otherwise they would silently start new series), and give two reused codes their own keys: `24 15` `maritime_vocational_education` and `25 07` `sport_infrastructure`. The 2026 `25 05` needs no era of its own: it resolves through the succession to the school-construction series.

### 5.5 The concordance

`data/mappings/review/admin-spending-program-concordance-2026.csv` has 51 rows with columns `code_2026, label_2026, amount_2026_gel, code_2025, label_2025, decision, note`. Its scope is every 2026 depth-2 programme with a non-zero 2026 amount that meets one of three conditions: it is at least 100 m GEL, its 2025 counterpart is a major series, or it reuses the code of a 2025 major series. Every note gives the label evidence and the scale (2025 actual to 2026 plan).

**42 join / 6 new / 3 separate.** A test proves that each `join` row gives the item id of its 2025 fact, and that no `new` or `separate` 2026 fact has a historical item id.

- **join (42).** The same programme continues a 2025 series: 34 with the same code (33 with an identical label, plus the renamed `32 07`), and 8 renumbered with an identical label or a documented slight rename (the seven succession rows above, plus `25 05`). The review compared the law's restated 2024-fact and 2025-plan columns with the joined series: they match for 36 of the 41 joins then in the file and for `32 07`.
- **new (6).** Each is a planned-only series: `24 08` innovation (156.4 m GEL), `31 02` food safety (108.1 m), `32 06` inclusive education (101.3 m), `40 01` protected persons (114.8 m), `54 07` regional projects fund (760.0 m) and `25 07` sport infrastructure (205.0 m; this is 2025's `25 08` at 10.9 m, which never reached 100 m).
- **separate (3).** Deliberately kept apart from a 2025 series, none produces a 2026 fact: `24 15` (2026 maritime vocational education reuses the code of 2025's electricity and gas supply), `24 17` (2026 bilateral-agreement obligations reuse the Anaklia code) and `31 16` (solid waste moved from Regional development to Environment and agriculture; successions never cross categories).

2025 major series with no 2026 point: `06 04` elections (0 in 2026), `24 15` electricity and gas supply (now `24 21`, 0), `25 05` solid waste (now `31 16`, below 100 m) and `25 06` school construction (continued by the new `25 05`).

### 5.6 Caveats on individual programmes

- **`25 05` joins school construction `25 06`; `32 07` falls because of a move, not a cut.** The 2026 `25 05` (667.0 m GEL) is the Ministry of Infrastructure's construction and rehabilitation of educational institutions. The law's own comparison column prints its 2024 fact as 303,100.0 thousand GEL, exactly the 2024 actual of the school-construction series `25 06` (303,100,050 GEL), and its 2025 plan as 366,000.0 thousand, so the law itself presents it as the continuation. The same transfer shows on the other side: `32 07` (Education) is 401,435.3 thousand GEL in 2024 fact and 538,115.0 in the 2025 plan, but 90.4 m GEL in 2026, because general-education construction (`32 07 01`: 2025 plan 467.7 m GEL, 2026 plan 54.0 m GEL) moves to `25 05`, about 414 m GEL. The `32 07` series is therefore a join with a slight rename ("ინფრასტრუქტურის განვითარება" to "საგანმანათლებლო და სამეცნიერო ინფრასტრუქტურის განვითარების ხელშეწყობა"; 2017–2018 already used a near-identical wording), and its fall must not be read as a cut. `25 05` was first treated as a new series and then joined once the law's own columns showed the continuation. Code `25 05` was 2025's solid-waste programme (now `31 16`), which it does not join.
- **`24 06` and `24 16` swap about 50 m GEL of 2024 in the law's restatement.** The law's 2024 fact is 108.3 m GEL for `24 06` (state property management) where the site's series has 158.3 m, and 52.7 m for `24 16` (Anaklia) where the site's series has 2.7 m. The same 50.0 m GEL moves between the two. The site's 2004–2025 numbers are not changed; this only affects reading the law's comparison columns.
- **`31 06` loses subprogrammes `31 06 03` and `31 06 04`.** Irrigation modernization is 54.0 m GEL in 2026 against 209.5 m in 2025 actual. The law's 2025 plan for those two subprogrammes was 45.0 m and 34.0 m GEL (79.0 m together) and both are 0.0 in 2026. The programme is a join; the drop is a smaller programme, not a break in the series.
- **`54 07` regional projects fund: 760 m GEL planned only.** The 2026 plan is 760.0 m GEL; the law's 2024 fact is 0.0 and 2025 executed 0.0, because the fund is allocated to other lines during the year. It is a planned-only series with no succession (the 2025 `57 07` has no fact to anchor an identity), and its executed value will usually be 0. A reader comparing the plan with the executed 2026 value should expect a large gap that is a reallocation, not underspending.
- **`54 04` and other large drops against 2025 actual.** The 2025 actual of `54 04` (municipal transfers) was 1,568.3 m GEL against the law's printed 2025 plan of 665.8 m GEL. The same applies to `24 06`, `25 04`, `27 05` and `31 06`: the law's 2025 plan column confirms the scale of the 2026 plan, so these falls compare a plan with an execution that exceeded its plan.
- **Plan against execution in general.** Ministry structures differ between a plan and its execution (programmes are reallocated during the year), which is why admin facts resolve actual over planned for a whole year rather than item by item (section 7).

### 5.7 Programme concordance and the English text

The English labels and programme histories for the 6 new ids and the `32 07` and `25 05` renames in `data/localization/en/` are translations written with this change, dated 2026-10-24, and are listed for a native proofread. The other joined programmes reuse the reviewed 2025 English text.

## 6. Validation results

| Check | Result |
| --- | --- |
| Spending by area 2026 total against Article 2 and Tavi VI `00 00` | 30,881,358,000 GEL, difference 0 (limit 1,000 GEL) |
| Article 9 functional part | 27,311,597,000 GEL, equals the Article 9 grand total |
| Supplements against Tavi VI totals | 650,000,000 plus 2,919,761,000 GEL, exact |
| Ministries 2026 total | 30,881,358,000 GEL, equals the Tavi VI `00 00` total, difference 0 |
| Tavi VI leaf rows counted once | 373 coded rows (225 two-level, 115 three-level, 33 four-level), 325 leaves; the 170 uncoded headcount rows never enter a fact |
| Unclassified | 0 GEL |
| 2004–2025 rows unchanged | The base files show no diff; the regenerated 2004–2025 admin facts equal the committed file row for row; Spending by area for every year 2007–2025 regenerates byte-identically |
| 2024 cross-check | Total level within 155 GEL; per-field differences are documented in section 4.5 |
| Reference fixture `tests/factQuery/reference.test.ts` | Passes. Two expectations changed because the data now reaches 2026: intent 20 `candidateCount` 48 to 54 (section 5.3), and the "refuses a year beyond this baseline" case now asks for 2027 |
| `npm run data:validate` | 45 data checks pass; 914 admin spending fact rows (852 actual plus 62 planned); the Expenditure and Admin spending year requirements are unconditional and include 2026 |

## 7. Basis rules, downloads and share of GDP

The shared rule is actual over planned, and it is applied wherever data is shown or served:

- **Charts, tables and workbooks** show the actual value when both exist for an item and year (`chooseActivePublicFacts`). A planned value stays visibly marked: a hollow chart point, the plan mark in the table and a "planned" basis status in the Excel workbook. When the latest year holds an active planned value, the headline reads "2026 plan", the table total and the Budget hub card carry the plan mark (all three by the one rule `isPlannedYear` in `apps/web/lib/explorer/explorerData.ts`), and the landing row reads planned or mixed. The page description and Dataset JSON-LD, the explorer source note and the methodology basis line then name the actual years and the plan year apart; all of it is derived from the facts, with no fixed year.
- **Admin facts (ministries) resolve actual over planned per year, not per item.** `loadReviewedAdminSpendingFacts` drops the planned rows of any year for which the base file holds actual rows. Admin facts are unique per year and item with no basis in the key, and ministry and programme structures differ between a plan and its execution, so item-level mixing would be wrong.
- **The raw national-expenditure CSV download** carries every row with its `basis` column. Once 2026 actuals are imported it will hold both the planned and the actual 2026 rows, labelled, as a raw download; the plan rows are not removed from it. The JSON publications and `/mcp` carry planned rows with `basis = planned` and the existing `planned_values` caveat.
- **Share of GDP has no 2026 point** until 2026 GDP is published by Geostat (GDP facts end in 2025). The chart shows the gap and the fact-query service returns null for 2026.

## 8. Known limits

- The 2026 numbers are the approved plan. Execution typically differs, so a plan-to-actual comparison is a comparison of two different things (sections 4.5 and 5.6).
- Field-level changes between 2025 actual and 2026 plan below about 10 m GEL can be classification restatement (section 4.5).
- The chapters of the law not read here (Tavi I, and the other chapters) are not archived; only Articles 9 and 16 feed the data.
- The mapping of 23 supplement rows is medium confidence, reviewed against history; the two 2026 review rows (45 m and 8 m GEL) follow the 2025 review for the same projects.

## 9. When 2026 actuals arrive (early 2027)

No reader and no plan-specific code changes. Actual wins over planned in every reader (charts, tables, workbooks, JSON publications, the snapshot and MCP, CSV and database mode), and the ministries generator stops using a plan year's law rows once that year's execution rows are extracted (`unexecutedPlanRows` in `apps/web/lib/data/adminSpending/generateAdminSpendingFacts.ts`). The 2026 actuals themselves still come in through the normal annual pipeline and its own steps (see `2025-expenditure-final-methodology.md`): archiving the execution sources, moving `APP_END_YEAR` in `apps/web/lib/data/coverage.ts` to 2026, generating the 2026 Spending-by-area actuals, and placing the 2026 programmatic execution workbook where the ministries extractor reads it.

The plan-specific steps:

1. **Keep `PLANNED_BUDGET_YEARS = [2026]`** in `apps/web/lib/data/coverage.ts`. `scripts/validate-data-files.ts` requires every row of the two planned files to carry a year from that list, and `expenditure-facts-2026-planned.csv` keeps its 2026 rows. Removing 2026 from the list makes `npm run data:validate` fail.
2. **Keep both planned files and their `SERVED_DATA_FILES` entries** (`budgetPlannedFacts`, `adminSpendingPlannedFacts` in `apps/web/lib/data/servedData.ts`). The combined loaders (`loadReviewedBudgetFactRows`, `loadReviewedAdminSpendingFacts`), the database import and `data:validate` read both files, and stop with ENOENT if one is missing. Retiring them is a code change (the two entries, the loaders, the validation and their tests), not a data step.
3. **Spending by area:** leave `expenditure-facts-2026-planned.csv` as it is and do not re-run `data:generate-planned-2026-expenditure`. The 2026 actual rows go into the base expenditure facts file. `BudgetFact` is unique on `(year, side, itemId, basis)`, so both rows import, and every reader picks the actual one per item. The raw `national-expenditure.csv` download keeps both rows, labelled by basis (section 7).
4. **Ministries:** run `npm run data:generate-admin-spending`. Once the extractor returns 2026 execution rows, 2026 is generated as actual into the base admin facts file and reconciled against the execution report. `admin-spending-facts-2026-planned.csv` and `data/staging/admin-spending-official-rows-2026-planned.csv` are rewritten with their header only. The planned-only programme series (section 5.3) disappear unless the executed programme reaches 100 m GEL. The readers would drop planned admin rows for a year that has actual rows in any case (year-level resolution, section 7).
5. **Update the tests that pin today's plan.** They fail by design once 2026 is actual. Among them: `tests/data/servedData.test.ts`, `tests/data/adminSpending/plannedMinistries2026.test.ts`, `tests/data/budgetLaw/`, the 2026 counts in `tests/factQuery/` and `tests/landing/`, the basis-line case in `tests/methodology/methodologyArticle.test.tsx`, and the 2026 plan block in `tests/browser/main-explorer.spec.ts`. If `tests/factQuery/reference.test.ts` changes (intent 20's candidate count includes the plan-only series), that is a stop condition to report under CLAUDE.md's definition of done, not an expectation to edit.
6. **Copy and documents.** The page metadata, the explorer source note, the headline, the hub card and the methodology basis line derive the plan wording from the facts, so they return to the all-actual wording by themselves. The Spending methodology text names 2026 as a plan in its scope and sources paragraphs (`apps/web/lib/methodology/content/expenditure.ts` and `content/en/expenditure.ts`): rewrite those. Then update section 1 of this document, `Project_Definition.md` section 2 and `database-import.md`.
7. Run `npm run data:validate`, `npx vitest run tests/data tests/factQuery tests/methodology`, then `npm run check` and `npm run build`. Share of GDP gets a 2026 point once 2026 GDP is published.

## 10. When the law is amended

If Parliament amends the 2026 budget, only the 2026 planned rows change:

1. Download the amended chapters and archive them next to the originals under `docs/Raw Data/Expenditure/mof.ge/` with new SHA-256 hashes, and add them to `data/methodology/source-archives/expenditure.csv`.
2. Register a new source id, `source.mof_2026_budget_law_amended_<date>_planned`, in `data/sources/source-documents.csv` and the English source names, and update `BUDGET_LAW_2026` in `apps/web/lib/data/budgetLaw/sources.ts` (paths, hashes, source id). A `.DOC` chapter is converted again with its own provenance record.
3. Re-run `npm run data:generate-planned-2026-expenditure` and `npm run data:generate-admin-spending`. Both stop on a hash or reconciliation failure.
4. Review the concordance and the successions for changed codes, the review CSV for new supplement rows, and the 2024 cross-check; then update this document, including the file hashes, the field amounts (section 4.4) and the counts in section 5.5.
5. Run `npm run check` and `npm run build`; the 2004–2025 rows must show no diff.

## 11. Reproduce

```powershell
cd apps/web
npm run data:generate-planned-2026-expenditure
npm run data:generate-admin-spending
npx vitest run tests/data/budgetLaw tests/data/adminSpending tests/factQuery/reference.test.ts
npm run data:validate
```

## 12. Source trust rule

The 2026 facts are reviewed public-category aggregates built from the approved Law of Georgia on the 2026 State Budget, published by the Ministry of Finance. They are a plan, not execution. The law supplies the functional classification (Article 9) and the programme appropriations (Article 16); the classification into public spending fields, administrative categories and continuous programme series is Fiscal.ge's reviewed work. The converted `.docx` and the staging CSVs are parser outputs used for review and validation, not official raw data.
