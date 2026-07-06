# Ministries expenditure — Group C (annual-execution-report backfill)

> **This is a detailed per-year appendix** for the 2006–2012, 2015, 2016 annual-execution-report
> extraction (config knobs + SHA-256 table). The authoritative full methodology — model, all
> classification decisions, drill-down rules, validation — is
> [`ministries-expenditure-methodology.md`](ministries-expenditure-methodology.md).


Extends the ministries (organizational / "tavi VI") expenditure dataset (`ADMIN_SPENDING_YEARS`)
to the years whose only real source is an official mof.ge **annual budget-execution report**
PDF: **2006–2012, 2015, 2016**. Each report contains an organizational (spending-institution,
codes `NN 00`) ACTUAL expenditure table whose grand total reconciles to the year's payments
total.

> **Review adjustments (2026-07-06).** A post-backfill review + owner sign-off deliberately
> refined a few 2017–2024 baseline classifications (so 2017–2025 is *no longer* frozen — see
> `apps/web/lib/data/adminSpending/categories.ts`, the source of truth):
> - **IDP/Refugees ministry → Health & Social for all years 2005–2018** (not gated `<2017`). Tracing
>   the abolition showed its programs consolidated into the IDPs/Labour/Health super-ministry
>   (institution 27) in 2019+, not the nominal resettlement→RegDev / migration→Interior / social→Health
>   split; so 2017/2018 moved out of Other costs into Health & Social.
> - **Environment (old "გარემოსა და ბუნებრივი რესურსების" naming) → Environment & Agriculture through
>   2017**; from 2018 it merged with agriculture and the modern rule handles it.
> - **Sport/Culture de-merge for 2018–2024**: the combined Culture+Sport ministry (2018, 2022–2024)
>   and the Education mega-ministry (2019–2021) bundled Sport (and, in the mega-ministry, Culture) into
>   the parent. A program-level rule now routes clearly-sport programs → Sport and clearly-culture →
>   Culture (mixed culture+sport → Culture; apparatus and general education/science stay put), so both
>   series are continuous 2005–2025. Reconciliation is unaffected (leaves only move between categories).
> - Bug fixes: penitentiary token stem (`სასჯელაღსრულებ`, 2009–2013 → Justice) and the drill-down
>   `qualifyingIds` threshold now measured over 2017+ rows only.

## Architecture

PDF parsing is async and slow, and the pipeline is synchronous, so extraction is two-stage
(mirroring how the `<year>-fact.xlsx` files were themselves pre-extracted from PDFs):

1. **Pre-extraction** — `apps/web/scripts/extract-annual-report-pdf.ts`
   (`npm run data:extract-annual-reports`) reads each report PDF, transliterates legacy
   AcadNusx-font years to Mkhedruli, parses the organizational table with
   `apps/web/lib/data/adminSpending/parseAnnualReportPdf.ts`, and writes the reviewable
   staging CSV `data/staging/admin-spending-annual-report-rows.csv`
   (`year, code, label, approved, revised, actual` in thousand GEL). It prints each year's
   reconciliation (00 00 total vs sum of `NN 00` institutions) and the PDF SHA-256.
2. **Pipeline read** — `apps/web/lib/data/adminSpending/extractAnnualReportYears.ts` reads
   that staging CSV synchronously and builds `OfficialExpenditureRow[]` with the same leaf
   detection + institution context as `parseTavi6Rows`, so the existing category/debt
   classifier and leaf-aggregation reconcile these years exactly like 2013/2017–2025.

### The PDF table parser (`parseAnnualReportPdf.ts`)

- A **coded row** is `NN`-group code (depth 1–4) + label + three trailing amounts
  (approved plan, revised plan, ACTUAL). The interleaved no-code economic-classification
  lines (`ხარჯები`, `შრომის ანაზღაურება`, …) and repeated page headers do not match a code
  and are ignored.
- **Wrapped labels** (governor administrations wrap the municipality list over several
  lines, with the three amounts alone on a later line) are joined until the amounts appear.
- **Amounts** require a decimal, so space-thousands ("1 234,5") and comma-thousands
  ("10,297,950.0") both split unambiguously into three values.
- The parser **stops at the post-table narrative** "explanations" section via a
  coded-row gap threshold, so its code-like prose is never mis-parsed.

## Reconciliation basis

The organizational grand total is the **payments** total (includes financial-asset growth +
liability reduction / debt principal), i.e. the same basis as 2013/2017–2025 — NOT the
functional-classification total (which runs ~5–10% lower). Reconcile the category sum to the
report's own `00 00` row.

## Owner decisions (apply the established precedents consistently)

- **Drill-down**: categories for all Group C years; **program-level drill-down only for
  2012 & 2016** (their program detail sub-reconciles). Other years extract at institution
  level. (The modern-presence rule already keeps only programs surviving into 2017–2025.)
- **Debt service**: split into its own category — from the state-wide-payments institution
  for 2010–2016 (the existing classifier handles it), and synthesized for 2006–2009 where
  debt is nested inside Finance (as done for 2005).
- **Culture + Sport** were one ministry in 2006–2009 (separate from 2010 on): split Sport
  out using each report's sport department, as done for 2005.
- **Regional governors / state-minister offices** → Other costs (individually tiny; Other is
  visibly larger pre-2017).
- **2015** institution-level residual (undistributed AR/municipal allocations, ~86M) is
  recovered from the 2015 functional report.

## Extraction knobs (per year, in `extractAnnualReportYears.ts` / the pre-extraction config)

- **`tableStartMarker`** (pre-extraction) — full annual reports embed the org table deep in a
  narrative document; slice the text from the grand-total row (e.g. 2012 `"00 00 მხარჯავი
  დაწესებულებები"`) so the parser locks onto the org table, not an earlier summary/revenue table.
- **`drillDown`** — `true` keeps program rows (2012, 2016); `false` aggregates at institution
  level (2015, and the legacy years) because the printed program detail is incomplete. In
  institution mode the state-wide-payments institution keeps its depth-2 children so debt still
  splits.
- **`maxDepth`** — for drill-down years, the deepest level whose leaf sum still reconciles.
  2016 is complete to depth 4; 2012's depth-4 subprograms undercount ~10M, so 2012 caps at depth 3.
- **`syntheticTotalThousandGel`** — legacy reports often have no coded `00 00` row (the total is
  uncoded/overflowed); synthesize the isTotal row from the known payments total so reconciliation
  still checks the extracted category sum against a real figure (2010).
- **`amountOverrides`** — per-code ACTUAL corrections for `#######` overflow cells, reconstructed
  from the row's economic sub-lines and documented at the call site (2010 `35 00`).
- **`financeSplit` / `cultureSportSplit`** — split the Finance ministry three ways (debt / finance-proper / other), and peel Sport
  and Youth out of the combined Culture+Sport ministry, into synthetic rows that classify
  correctly (mirrors the 2005 splits). Figures are sourced/confirmed per year (2006–2009).

## Status

| Year | Source | SHA-256 | Status |
|---|---|---|---|
| 2016 | `2016-annual-execution-tavi-VI-programmatic.pdf` | `94206ba75b2acb7f1f28ce88f69db64e18617ea548537d195e055fe395436c7d` | **Shipped** — full drill-down (depth 4), 00 00 = 10,292,234.1k, reconciles, debt_service 740,185.7k. |
| 2015 | `2015-annual-execution-tavi-VI-programmatic.pdf` | `fc2056952a81fb514d6cc90a81ccf8ceeb299a563eb2a3d962a6d959d1c0bed4` | **Shipped** — institution-level, 00 00 = 9,703,127.1k, reconciles exactly, debt_service 731,023.7k (58 00 children). |
| 2012 | `2012-annual-execution-report.pdf` | `fd0e3a36731fec184a8907b04024457e77139f2823547afc5ab560c696980829` | **Shipped** — drill-down capped at depth 3 (depth-4 incomplete), 00 00 = 7,806,801.8k, reconciles (−300 GEL), debt_service 378,554.6k. |
| 2011 | `2011-annual-execution-report.pdf` | `3a6a2f5eb176e0a58ea18c4502eefea32d9c5d77d9d9b533fee739775cb085c1` | **Shipped** — legacy AcadNusx, institution-level, coded 00 00 = 7,459,279.5k, reconciles (−200 GEL), debt_service 428,356.2k (state-wide 50 00), culture/sport separate. |
| 2010 | `2010-annual-execution-report.pdf` | `e95bbbf23808045f56e6e54cf531f4e00eb5f36ff3b4d6dc9fb26e6316c6f00d` | **Shipped** — legacy AcadNusx, institution-level, **synthesized 00 00** (6,972,344.0k, no coded total) + **`35 00` overflow override** (`#######` → 1,605,041.4k), reconciles (−200 GEL), debt_service 358,555.8k (state-wide 53 00). |
| 2009 | `2009-annual-execution-report.pdf` | `ce18d097ca2394a1841a7256e53ceafedbc14e32c11e33f6d739f99414a14b85` | **Shipped** — larger table-gap; synthesized 00 00 = 6,754,106.8k; Finance 23 00 three-way split (debt 318,057.6 / proper 142,157.5 / rest→Other); culture ministry split (sport 11,784.0, youth 955.6). |
| 2008 | `2008-annual-execution-report.pdf` | `b30010f44be0e89639a5fb14b467f6362eb3a2be4ce7266258ebd0eab60add67` | **Shipped** — plan/actual/% column layout; synth 00 00 = 6,758,831.8k; Finance 25 00 three-way (debt 203,689.1 / proper 107,917.4 / rest→Other); culture split (sport 15,125.8, youth 661.4). |
| 2007 | `2007-annual-execution-report.pdf` | `557a2e620f32149680c15bee4714cde10571a16fe7b8ff5fb2dce5fbdbaff26c` | **Shipped** — plan/actual/% layout; synth 00 00 = 5,237,131.1k; Finance 25 00 three-way (debt 249,205.0 / proper 107,992.1 / rest→Other); culture split (sport 8,682.6, youth 70.0). |
| 2006 | `2006-annual-execution-report.pdf` | `306841dbd25c9a7becb071aa0307d8e4e37ff3817e3555d8b503a279507f50b3` | **Shipped** — split codes rejoined; synth 00 00 = 3,822,512.6k; Finance 25 00 three-way (debt 334,908.6 / proper 80,502.2 / rest→Other); culture split (sport 4,705.3, youth 70.0). |

**Group C is complete: the ministries dataset covers 2005–2025 contiguously (21 reconciling years).** Only 2004 remains (Group D — a scope decision, not an extraction gap).

## Finance three-way split (2006–2009)

Unlike 2010+ (where debt/transfers/reserves sit in a dedicated state-wide-payments institution), 2006–2009 book all of that under the **Finance ministry**. So the Finance institution is split three ways (`financeSplit`) to keep the `finance` category comparable across years: **debt** (external + domestic servicing & repayment, excluding on-lending) → `debt_service`; **finance-proper** (the `NN 01` "ფინანსთა სამინისტრო" own line) → `finance`; **remainder** (intergovernmental transfers, reserves, funds) → `other_costs`. Debt and finance-proper figures were sourced/confirmed per year from each report.
