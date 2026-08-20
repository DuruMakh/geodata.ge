# 2004 National Expenditure Data Design

## Goal

Extend the national expenditure explorer from 2005–2025 to 2004–2025 in both existing groupings:

- public spending functions;
- ministries/administrative spending.

Revenue remains 2005–2025.

## Approved source scope

The public 2004 expenditure total is the complete state-budget actual of **1,930,210.3 thousand GEL** (GEL 1,930,210,300). The previously archived standalone functional PDF reports only the central budget, approximately GEL 1.5 billion, and must not be loaded or displayed as a separate public series.

The source package consists of:

- the Ministry of Finance 2004 execution annex, 317 pages, SHA-256 `C999654E8C2A430778E48FE67C1BFC7D15DC30F76A60CEEF4477614A31849889`;
- the Ministry of Finance 2004 annual execution overview, SHA-256 `9E368DDD2E873AA020C552A1E8A2D26115CD8E2DD39E97FE5EB7A384D5B5D52E`;
- the existing central-budget functional PDF, retained only as supporting detail and provenance.

The execution annex is the canonical numeric source. Its page 232 contains the full-state functional table, while pages 2–231 contain the organizational execution table.

## Functional data

The full-state functional table provides the 14 historical functional groups, revised plan, actual expenditure, and an actual grand total of GEL 1,930,210,300. Only actual expenditure is served.

The 14 historical groups map into the existing `spending.*` taxonomy. The mapping reuses the reviewed old-classification method already used for 2005–2006:

- direct parent groups map to their corresponding public function;
- the combined culture/religion/sport group uses the source-backed sport carve-out and assigns its remainder to culture;
- the residual group uses source-backed debt and intergovernmental-transfer carve-outs, assigning only the remaining balance to other/unclassified;
- the full-state health, social-protection, and transport totals are used directly, so the Social Insurance Fund and Road Fund are included without any estimated allocation;
- no amount is prorated, invented, or silently dropped.

The generated 13-category panel must sum to GEL 1,930,210,300 within the existing GEL 1,000 reconciliation tolerance.

## Ministry data

The execution annex contains 47 top-level organizational institutions. These rows are the reviewed 2004 ministry-level source and must be preserved in staging with their official code, Georgian label, plan, actual, page/row provenance, and source ID.

The public explorer will use its existing ministries grouping and stable `admin_spending.*` taxonomy. The 47 institution rows will be aggregated through a reviewed 2004 institution mapping. Historical bundled Finance and Culture/Sport lines may be split only where exact component amounts are present in the official 2004 documents; each split must preserve the institution total and be recorded in mapping notes. Uncertain rows go explicitly to `admin_spending.other_costs`.

The 2004 ministry view is institution-total only. It will not create 2004 major-program series or a new drilldown interface.

Because thousand-GEL source rows are independently rounded, the 47 institution actuals may sum to GEL 1,930,210,400 while the printed grand total is GEL 1,930,210,300. The GEL 100 difference is accepted by the existing GEL 1,000 source-reconciliation rule and must be disclosed in the report.

## Explorer behavior

- The existing expenditure explorer automatically starts in 2004 for both grouping modes.
- The existing chart, table, period comparison, GDP-share mode, and CSV download include 2004.
- The functional grouping exposes the full 13-category panel for 2004.
- The ministries grouping exposes the existing stable administrative categories for 2004 and no 2004 major-program children.
- No separate central-budget label, toggle, or GEL 1.5 billion series is added.
- Existing 2005–2025 values and item identities must remain unchanged.

## Provenance and public methodology

Both new official PDFs must be copied from the research area into the immutable source archive, registered with byte size and SHA-256, exposed through the expenditure methodology downloads, and referenced by the canonical source IDs used in the generated facts.

The public methodology and decision register must replace the obsolete “2004 excluded” decision with the reviewed inclusion decision. They must explain that the complete state-budget annex supersedes the central-only document for public totals while the latter remains archived as supporting evidence.

## Acceptance criteria

1. Functional 2004 actuals contain all 13 public expenditure fields and total exactly GEL 1,930,210,300.
2. The source pins include health GEL 147,362,300, social protection GEL 364,257,700, and transport/communications GEL 67,416,800.
3. The organizational extractor preserves 47 top-level institutions and reconciles within GEL 1,000 of the printed state total.
4. Both explorer grouping modes begin in 2004; revenue still begins in 2005.
5. 2004 CSV exports include actual basis, source IDs, GDP metadata, and year-specific official institution labels where applicable.
6. Source, mapping, coverage, parity, import, methodology, unit, browser, and production checks pass.
7. Regenerating the data is deterministic and does not change any 2005–2025 value.

## Out of scope

- Publishing the GEL 1.5 billion central-budget series.
- Adding 2004 revenue.
- Creating a new explorer, filter, or detail page.
- Adding 2004 major programs or subprogram drilldown.
- Changing the existing expenditure or administrative taxonomies.
