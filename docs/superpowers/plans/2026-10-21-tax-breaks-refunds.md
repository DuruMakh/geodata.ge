# Tax Breaks and Refunds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/explorer/tax-breaks-refunds` (+ `/en`), a Budget page showing the Finance Ministry's tax breaks 2018–2024 and the Treasury's tax refunds 2008–2025 in ₾ and % of GDP, with Excel, methodology and a database mirror.

**Architecture:** A new canonical dataset `tax-breaks-refunds` (the Money CSV columns), prepared in TypeScript from archived originals: the Georgian Ministry workbook and the Treasury XML. It is mirrored to a new `TaxBreaksRefundsFact` table with CSV/DB parity. The page is a small topic explorer built on `lib/explorer/topicSeries.ts` and the explorer shell, following Money supply's ₾ / % of GDP switch. It joins the Budget sections after Revenue.

**Tech Stack:** Next.js 16, strict TypeScript, Vitest, Playwright, Prisma 7, decimal.js, xlsx + fflate (exact cell text, as in `prepareMoneyBanks.ts`).

**Spec:** `docs/superpowers/specs/2026-10-21-tax-breaks-refunds-design.md`

## Global Constraints

- Names: heading "საგადასახადო შეღავათები და დაბრუნება" / "Tax breaks and refunds"; sidebar "შეღავათები და დაბრუნება" / "Tax breaks and refunds".
- IDs (fixed list order): `tax_breaks.total`; `tax_breaks.vat.{total,education,health,child_care,gambling,vehicles,agriculture,medicines,other}`; `tax_breaks.income.{total,personal,profit,old_profit,other}`; `tax_refunds.total`. That is 16 ids.
- Years: tax breaks 2018–2024 (15 ids × 7 = 105 rows); refunds 2008–2025 (18 rows); 123 rows in total. Treasury 2007 and "09.2026" are never read.
- Units: CSV `gel_million` at full source precision. The chart, table and list use million ₾ (`unitsFor(locale).mln`); the heading line and hub card use billion ₾ with one decimal.
- % of GDP = amount ÷ the site's national GDP (`shareOfGdp` from `lib/explorer/debtExplorer.ts`), computed client-side. Years with preliminary GDP are named in the source line, as on Money.
- Default selection: `tax_breaks.total, tax_refunds.total`. Every row is visible under four headings (Tax breaks / VAT / Income and profit tax / Refunds). Nothing is collapsible, names carry no prefixes, and there is no search field.
- Under the heading there is one `LatestValueLine` only, on one line at 375px. There is one source line under the chart, and the measure switches are icon-only.
- Use the Georgian workbook `TER graphs GEO 2024.xlsx` only, never the English one.
- The page stays outside MCP and the central JSON/CSV publications. The Revenue page's output is unchanged.

## Review Focus

1. Ticking only VAT rows and choosing years 2008–2017 leaves no tax-break values. The chart must show the existing "no data in range" callout, not an empty axis or a crash (Task 3 test).
2. A deep link `#sel=tax_refunds.total&start=2008&end=2012` must keep 2008–2012, even though the default selection's union is the same span (Task 3 test).
3. In % of GDP, refunds for 2025 must be computed against preliminary GDP and the source line must name 2025 as preliminary (Task 3 test).
4. The Treasury XML gains a new year-to-date column (for example "10.2026") or a 2026 full year: the preparation must fail on an unexpected category list instead of silently serving it (Task 1 test).
5. Excel for refunds only, 2008–2017, must list only Treasury sources, and the Ministry report must not appear (Task 4 test).

---

### Task 1: Data foundation (archive, manifest, preparation, canonical CSV)

**Files:**
- Create: `docs/Raw Data/Revenue/tax-breaks-refunds/sources/` holding `TER graphs GEO 2024.xlsx`, `TER graphs ENG 2024.xlsx`, `TER 2024 GEO.pdf`, `TER 2024 ENG.pdf` (copied from `/mnt/project-files/tax-expenditures-sources/`, checksums in its `source-urls.txt`) and `treasury-newChart-2026-10-21.xml` (sha256 `d5d5a1ce16cfd08b17a36f9f6f90a111d8e8adafaa1529920f45e6a13fba76aa`)
- Create: `docs/Raw Data/Revenue/tax-breaks-refunds/source-manifest.json`: one entry per file with `source_id`, `local_file`, `sha256`, `bytes`, `url`, `retrieved_at: "2026-10-21"`, `role` (`canonical_input` for the GEO xlsx and the XML; `archived_not_served` for the rest). Source ids are `mof_tax_expenditure_report_2024_xlsx_ka`, `mof_tax_expenditure_report_2024_xlsx_en`, `mof_tax_expenditure_report_2024_pdf_ka`, `mof_tax_expenditure_report_2024_pdf_en` and `treasury_tax_refunds_chart`.
- Create: `apps/web/lib/data/taxBreaksRefunds/{types.ts,validation.ts,prepareTaxBreaksRefunds.ts}`, `apps/web/scripts/prepare-tax-breaks-refunds.ts`
- Create (generated): `data/imports/tax-breaks-refunds-annual.csv`, `data/reports/tax-breaks-refunds-validation.json`
- Modify: `apps/web/package.json` (`data:prepare-tax-breaks-refunds`, `data:check-tax-breaks-refunds`), `apps/web/scripts/validate-all.ts`
- Create: `docs/data-methodology/tax-breaks-refunds.md` (spec §4 and §5 in plain words, cell map table)
- Test: `apps/web/tests/data/taxBreaksRefunds/prepareTaxBreaksRefunds.test.ts`

**Interfaces:**
- Produces, in `types.ts`: `TAX_BREAKS_REFUNDS_INDICATORS` (the 16 ids, in order, `as const`) and `TaxBreaksRefundsIndicator`; `TaxBreaksRefundsFact`, the same shape as `MoneyBanksFact` with `unit: "gel_million"` and `valueStatus: "official"`; `ClientTaxBreaksRefundsFact = { year; indicatorId; sourceId; value: number /* GEL */; unit: "gel" }`; `TaxBreaksRefundsAcceptance`, the same shape as `MoneyBanksAcceptance` without `researchStatus`; `taxBreaksRefundsFactKey(f) => \`${indicatorId}:${year}\``; and `TAX_BREAKS_REFUNDS_SOURCES` (the two served source ids).
- Produces: `validateTaxBreaksRefundsFacts(facts: readonly TaxBreaksRefundsFact[]): void` (known ids, years per id as in Global Constraints, unique keys, numeric values, and every identity in spec §4 within 0.01). Also `prepareTaxBreaksRefundsData(repositoryRoot: string, mode: "write" | "check"): Promise<void>`, `TAX_BREAKS_REFUNDS_CSV_HEADERS` (the money-banks header list) and `REVIEWED_AT = "2026-10-21"`.
- Cell map (record it in the methodology doc; confirm every row label against the Georgian sheet before coding it): "Figure 1" rows for income, VAT and total over columns C:I = 2018–2024; Table 4.a rows for the eight VAT parts and the grand total D; Table 3.a sub-total rows for personal income (excluding memorandum items), II.A, II.B, III and the grand total. `source_sheet` and `source_cell` hold the sheet name and A1 address. For the XML they hold `newChart.xml` and `series[0]/row[N]` (1-based row index).
- `published_value` is the value rounded half-up to 2 decimals.

- [ ] **Step 1: Tests.** In `prepareTaxBreaksRefunds.test.ts`:
  - (a) `prepareTaxBreaksRefundsData(root, "check")` passes on the committed files;
  - (b) there are 123 rows: 105 with ids starting `tax_breaks.` over years 2018–2024 and 18 `tax_refunds.total` rows over 2008–2025;
  - (c) these anchors match exactly: `tax_breaks.total` 2024 ≈ 6403.18; `tax_breaks.vat.total` 2018 ≈ 2229.77; `tax_breaks.income.total` 2023 ≈ 432.10 (not the English workbook's 406.1); `tax_refunds.total` 2025 = "2721.10"; 2008 = "124"; there is no 2007 row;
  - (d) a tampered byte in an archived file fails with the checksum message;
  - (e) an XML copy with an extra category `10.2026` or a missing `2015` fails with "Treasury refund categories changed";
  - (f) a fact list whose VAT parts are 1 million off the VAT total fails `validateTaxBreaksRefundsFacts`.
- [ ] **Step 2:** Run `npx vitest run tests/data/taxBreaksRefunds`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** following `prepareMoneyBanks.ts`:
  - Read and verify every manifest file with `readVerifiedPackageFile`.
  - Read the exact numeric tokens with the sheet-XML cell regex.
  - Assert each mapped row label, as Georgian text, against the cell to its left.
  - Parse the XML with a small regex over `<categories><row en="…">` and `<item>…<row>…</row>`. Require categories to be exactly `2007…2025` plus one `MM.YYYY`, and read indexes 2–19.
  - Sort by indicator order, then year. Write the BOM CSV and the acceptance JSON (`canonicalSha256`). In check mode use `assertGeneratedArtifactMatches("tax-breaks-refunds", …)`.
- [ ] **Step 4:** Run the tests and `npm run data:check-tax-breaks-refunds`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(data): tax breaks and refunds canonical dataset`.

### Task 2: Serving loader and database mirror

**Files:**
- Create: `apps/web/lib/data/taxBreaksRefunds/importTaxBreaksRefunds.ts`, `apps/web/prisma/migrations/20261021120000_tax_breaks_refunds/migration.sql` (copy the money-banks migration's RLS and revoke statements)
- Modify: `apps/web/prisma/schema.prisma` (`TaxBreaksRefundsFact` mirrors `MoneyBanksFact`'s columns, with relations on `SourceDocument` and `ImportRun`), `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/scripts/import-budget-facts.ts` (load, delete, create, parity, summary row), `data/sources/source-documents.csv` (5 rows `source.<id>`), `docs/data-methodology/database-import.md`, `docs/deployment.md` (release checks: 123 rows; anchors 6,403.18 and 2,721.10)
- Test: `apps/web/tests/data/taxBreaksRefunds/importTaxBreaksRefunds.test.ts`

**Interfaces:**
- Consumes: the Task 1 CSV, report and validation.
- Produces: `loadTaxBreaksRefundsFacts(): Promise<TaxBreaksRefundsFact[]>`, `assertTaxBreaksRefundsParity(csv, mirror): void`, `loadServedTaxBreaksRefundsData(): Promise<{ facts: TaxBreaksRefundsFact[] }>`, `toClientTaxBreaksRefundsFact(f): ClientTaxBreaksRefundsFact` (value = full-precision `value` × 1,000,000), `taxBreaksRefundsMirrorCreateRows(facts, importRunId)`, `loadTaxBreaksRefundsFactsFromMirror(db)` and `loadTaxBreaksRefundsFactsFromDb()`.

- [ ] **Step 1: Tests.**
  - The loader returns 123 facts.
  - A CSV whose sha differs from the report throws "fingerprint mismatch".
  - Mirror create-rows followed by load-from-mirror (with a fake client) round-trips equal, and parity passes.
  - A changed value fails parity.
  - `toClientTaxBreaksRefundsFact` on refunds 2025 gives 2721100000.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement after `importMoneyBanks.ts` and the money-banks mirror functions, then run `npx prisma generate`.
- [ ] **Step 4:** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(data): serve and mirror tax breaks and refunds`.

### Task 3: Page model and explorer component

**Files:**
- Create: `apps/web/lib/explorer/taxBreaksRefunds.ts`, `apps/web/components/tax-breaks-refunds/tax-breaks-refunds-explorer.tsx`
- Modify: `apps/web/lib/explorer/colors.ts` (16 distinct colours; the two totals drawn in distinct strong colours, because both are on by default)
- Test: `apps/web/tests/explorer/taxBreaksRefundsModel.test.ts`

**Interfaces:**
- Consumes: `ClientTaxBreaksRefundsFact`, `ClientNationalGdpFact`, the `topicSeries` helpers and `shareOfGdp`.
- Produces:
  ```ts
  export const TAX_BREAKS_REFUNDS_PATH = "/explorer/tax-breaks-refunds";
  export type TaxBreaksRefundsView = "amount" | "gdp";
  export type TaxBreaksRefundsHeading = "breaks" | "vat" | "income" | "refunds";
  export type TaxBreaksRefundsSeries = TopicSeriesDefinition & { heading: TaxBreaksRefundsHeading };  // reference: false for all
  export const TAX_BREAKS_REFUNDS_SERIES: readonly TaxBreaksRefundsSeries[];   // the 16 ids in order
  export const TAX_BREAKS_REFUNDS_DEFAULT: readonly string[];                   // ["tax_breaks.total","tax_refunds.total"]
  export type TaxBreaksRefundsState = TopicState & { view: TaxBreaksRefundsView };
  export function taxBreaksRefundsViewFacts(view, facts, gdpFacts): readonly ClientTaxBreaksRefundsFact[]; // gdp → value = share×100, unit "percent"
  export function taxBreaksRefundsCoverage(view, selectedIds, facts, gdpFacts): TopicCoverage;            // union of years of the selected ids (all ids when none selected)
  export function parseTaxBreaksRefundsHash(hash, facts, gdpFacts): TaxBreaksRefundsState;               // tab=gdp, else amount
  export function serializeTaxBreaksRefundsHash(state): string;                                          // tab only when "gdp"
  export function buildTaxBreaksRefundsModel(facts, state, gdpFacts): { range; years; series; selected; unit: "gel" | "percent"; hasData: boolean };
  export function taxBreaksRefundsHeadline(facts): { refunds: { year; value }; breaks: { year; value } }; // latest of each total, amounts in GEL
  ```
  `TaxBreaksRefundsExplorer` props: `{ facts; labels: Record<string,string>; headings: Record<TaxBreaksRefundsHeading,string>; sources; gdpFacts; gdpSources; lastReviewedAt; siteOrigin }`.

- [ ] **Step 1: Tests.**
  - The default state selects exactly `["tax_breaks.total","tax_refunds.total"]` with range 2008–2025.
  - Selecting only VAT rows gives coverage 2018–2024.
  - `#sel=tax_refunds.total&start=2008&end=2012` parses to range 2008–2012.
  - VAT rows over 2008–2017 give `hasData === false`.
  - The `gdp` view's `tax_breaks.total` 2024 ≈ 6.88 (6403.18 ÷ site GDP 2024), and refunds 2025 come from preliminary GDP.
  - Serialising and re-parsing a gdp-view state is lossless.
  - The headline gives refunds 2025 = 2.7211e9 and breaks 2024 = 6.40318e9.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the model with `buildTopicModel`. Build the component after `money-banks-explorer.tsx`, with these differences:
  - Two icon views (₾, `ChartPie`).
  - Unit `unitsFor(locale).mln` for amounts.
  - `FlatSeriesPanel` rows carry `heading: headings[series.heading]`, with `searchable={false}`, no nesting, no `totalId`/`pinTotal`.
  - The `no-range-data-callout` shows when `!hasData`.
  - `LatestValueLine` reads "{refunds label} {year}: {x} · {breaks label} {year}: {y}" in billions in the ₾ view, and shares in the gdp view.
  - The source line holds the sources, `main.gdpSource` and the preliminary GDP years in the gdp view, and the methodology link `/methodology/tax-breaks-refunds`.
- [ ] **Step 4:** Run the tests and `npm run typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(explorer): tax breaks and refunds model and explorer`.

### Task 4: Page, Budget navigation, hub card, messages, Excel, SEO

**Files:**
- Create: `apps/web/lib/pages/tax-breaks-refunds.tsx`, `apps/web/app/(ka)/explorer/tax-breaks-refunds/page.tsx`, `apps/web/app/(en)/en/explorer/tax-breaks-refunds/page.tsx`, `apps/web/lib/i18n/messages/{ka,en}/taxBreaksRefunds.json`, `apps/web/lib/explorer/taxBreaksRefundsWorkbook.ts`
- Modify:
  - `apps/web/lib/explorer/sections.ts` (`taxBreaksRefunds` after `revenue`, label "შეღავათები და დაბრუნება");
  - `apps/web/lib/explorer/hubCards.ts` and `apps/web/lib/pages/hub.tsx` (a card after Revenue: refunds sparkline 2008–2025, footer "2025 · დაბრუნება 2.7 მლრდ ₾"; renumber later cards);
  - `messages/{ka,en}/common.json` (`common.taxBreaksRefunds`, `hub.taxBreaksRefundsDescription`);
  - `apps/web/lib/i18n/{types.ts,messages.server.ts,inventory.server.ts}`;
  - `apps/web/lib/navigation/navTree.ts` (source-note map entry);
  - `apps/web/lib/seo/{sitemap.ts,datasetVocabulary.ts}` and `apps/web/public/llms.txt`;
  - `apps/web/lib/factQuery/buildSnapshot.ts` (exclude the five `source.*` ids).
- Test: `apps/web/tests/explorer/taxBreaksRefundsPage.test.tsx`, `apps/web/tests/explorer/taxBreaksRefundsWorkbook.test.ts`, plus count updates in `tests/navigation/navTree.test.ts`, `tests/seo/routes.test.ts`, the budget hub tests, `tests/site/datasetHubs.test.ts` and `tests/seo/agentFiles.test.ts` as they fail.

**Interfaces:**
- Produces: `taxBreaksRefundsPageMetadata(locale)`, `renderTaxBreaksRefundsPage(locale)` (after `renderMoneyBanksPage`, sources via `loadSourcedWorkbookSources("tax-breaks-refunds", locale)`) and `buildTaxBreaksRefundsWorkbookExportModel(input, presentation): WorkbookExportModel` (after `buildMoneyBanksWorkbookExportModel`; million GEL `#,##0.0`, percent `0.00`; filename `tax-breaks-refunds[-gdp]-{start}-{end}`).

- [ ] **Step 1: Tests.**
  - The page renders the heading "საგადასახადო შეღავათები და დაბრუნება" and "Tax breaks and refunds".
  - The latest line contains "2.7" and "6.4".
  - The list shows the four headings in both languages, in order.
  - Budget hub card 03 links to `/explorer/tax-breaks-refunds` and its footer contains "2.7".
  - The sidebar lists the page between Revenue and Municipalities.
  - The refunds-only workbook for 2008–2017 cites only `treasury_tax_refunds_chart`.
  - The gdp workbook adds the GDP sources.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the new and touched tests, `npm run typecheck`, `npm run lint` and `npm run i18n:check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(budget): tax breaks and refunds page`.

### Task 5: Methodology page and source archive

**Files:**
- Create: `apps/web/lib/methodology/content/tax-breaks-refunds.ts`, `.../content/en/tax-breaks-refunds.ts`, `data/methodology/source-archives/tax-breaks-refunds.csv`
- Modify: `apps/web/lib/methodology/{types.ts,catalog.ts,sourceInventory.ts}`, `content/en/revisions.ts`, `apps/web/lib/pages/methodology-article.tsx`, `data/localization/en/{sources.json,documents.json,page-revisions.json}`, `data/methodology/decision-register.csv` (two-total default, Georgian workbook only, 2007 not read, site GDP for shares)
- Test: the existing `tests/methodology/*` and `tests/i18n/methodologyCoverage.test.ts`, with the new id added to their expected lists.

- [ ] **Step 1:** Add the id to the expected lists. Expected: FAIL.
- [ ] **Step 2:** Write the content covering spec §5's six points in plain words, in both languages.
- [ ] **Step 3:** Run `npx vitest run tests/methodology tests/i18n`. Expected: PASS.
- [ ] **Step 4:** Commit `feat(methodology): tax breaks and refunds`.

### Task 6: Scope docs, browser test, preview

**Files:**
- Modify: `Project_Definition.md` §2 (new approved item including the two-total default; update the hub/section count line), `DESIGN.md` (§6.7 Budget sidebar order, Budget hub cards, page entry, URL-state row)
- Create: `apps/web/tests/browser/tax-breaks-refunds.spec.ts`; update the browser specs that count routes or Budget cards.

- [ ] **Step 1:** Write the browser spec:
  - ka and en load, with two default lines;
  - the % of GDP switch changes `data-view` and the source line names preliminary 2025;
  - table mode works;
  - the heading line stays on one line at 375px (otherwise apply the spec's refunds-only fallback and note it for Duru);
  - the Excel download starts;
  - the hub card and sidebar link navigate to the page.
- [ ] **Step 2:** Build with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build` and serve on port 3100 in its own process group. Run the new spec plus `hubs.spec.ts` and `methodology.spec.ts` with `CI=1`. Expected: PASS.
- [ ] **Step 3:** Take screenshots (desktop and phone, ka; both views; hub; methodology) into `/mnt/project-files/screenshots/tax-breaks-refunds/` and post the preview card to Duru. Run the full gates, push and open the PR only after Duru's OK. If another Budget thread (Government spending by type) has merged first, merge main and redo the `sections.ts`, hub-card and count edits.
