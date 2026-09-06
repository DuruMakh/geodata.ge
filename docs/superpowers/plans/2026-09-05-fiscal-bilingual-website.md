# Fiscal.ge Bilingual Website and Downloads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Follow active-session delegation instructions before dispatching workers.

**Goal:** Give every current public page and Excel exporter a complete English experience with identical analytical results.

**Architecture:** Extend existing page renderers and presentation models with explicit locale, scoped text, and the F3 English label catalogue. Reuse all chart, aggregation, source-selection, and workbook logic. Both language route wrappers call the same page-family renderer.

**Tech Stack:** Existing Next.js/React/TypeScript/Tailwind, ExcelJS, Vitest, Playwright, and the custom editorial components.

**Spec:** [Approved design](../specs/2026-09-05-fiscal-bilingual-design.md). Read the [master plan](2026-09-05-fiscal-bilingual.md) and [foundation interfaces](2026-09-05-fiscal-bilingual-foundation.md) before execution.

## Global Constraints

- Both languages use the same reviewed facts, calculations, source documents, and editorial design.
- English workbooks have exactly three sheets: `Summary`, `Data`, and `Sources`.
- Georgian filenames retain their existing form; English files add `-en` before `.xlsx`.
- English text does not silently fall back to Georgian or a technical identifier.
- Do not translate IDs or hash keys.
- Original source files remain original. Their descriptions are translated and their document language is identified where verified.
- No data model, selection, chart, colour, currency-conversion, or scope expansion accompanies translation. The master plan's remaining global constraints apply unchanged.

## Shared presentation interfaces

W1 adds this type to `apps/web/lib/i18n/types.ts`:

```ts
export type Presentation = {
  locale: Locale;
  englishLabels: Readonly<Record<string, string>>;
  messages: Messages;
};
```

Each shared renderer loads the catalogue and only its own label IDs/scopes. `Presentation` crosses the server/client boundary as plain serializable objects. Do not send the full source registry or every methodology paragraph to an explorer client. Pure numerical functions keep their signatures. Presentation-producing functions accept a final optional `Presentation` argument so existing Georgian-only model tests can keep their current inputs; every public language wrapper supplies it explicitly. `undefined` preserves legacy Georgian presentation only and is never an English fallback.

For all new scope names below, create both JSON dictionaries under `apps/web/lib/i18n/messages/{ka,en}/`, extend `MessageScope` and the explicit loader table, and register coverage in `checkLocalization()`. Copy existing Georgian strings exactly, translate full English sentences, and test interpolation parity. Do not leave empty message files to make imports pass.

## Task W1: Make common formatting and controls language-aware

**Depends on:** F2–F4.

**Files:** Modify `apps/web/lib/explorer/format.ts`, `apps/web/lib/i18n/types.ts`, `apps/web/components/ui/{editorial,horizontal-scroll-hint}.tsx`, `apps/web/components/explorer/excel-download-button.tsx`, and `apps/web/components/main-explorer/{series-selector,range-strip}.tsx`. Add dictionaries `format.json` and `controls.json` in both languages. Test `apps/web/tests/i18n/format.test.ts`, existing `apps/web/tests/explorer/format.test.ts`, and `apps/web/tests/browser/bilingual-controls.spec.ts`.

**Interfaces:** Preserve existing numerical helper behaviour. Add final `locale: Locale = 'ka'` to `formatAmount(value, locale)`, `formatSignedAmount(value, locale)`, `formatPerResidentGel(value, locale)`, and `formatAmountParts(value, signed = false, locale = 'ka')`. Add `unitsFor(locale: Locale): { bn: ValueUnit; mln: ValueUnit }` and `formatDisplayDate(isoDate: string, locale: Locale): string`. The tiny format dictionaries can be statically imported by the pure formatter; do not make it depend on filesystem or the full message loader.

- [x] Add numeric parity regressions for null, zero, a negative amount, the billion threshold, and the small nonzero-value floor. Preserve existing precision; only unit text changes.

```ts
it('changes units without changing numerical precision or missingness', () => {
  expect(formatAmountParts(2_200_000_000, false, 'en')).toEqual({ num: '2.2', unit: 'bn GEL' });
  expect(formatAmountParts(2_200_000_000, false, 'ka')).toEqual({ num: '2.2', unit: 'მლრდ ₾' });
  expect(formatAmountParts(null, false, 'en')).toEqual({ num: '—', unit: '' });
  expect(formatAmountParts(-1000, false, 'en').num)
    .toBe(formatAmountParts(-1000, false, 'ka').num);
  expect(unitsFor('en').bn.divisor).toBe(unitsFor('ka').bn.divisor);
});
```

- [x] Run `npx vitest run tests/i18n/format.test.ts tests/explorer/format.test.ts`, confirm the new language assertions fail, then localize only unit strings and formatted display dates. Keep `fixed`, threshold logic, minus handling, `MISSING`, and division arithmetic unchanged. Use UTC when formatting a date-only ISO value so a browser timezone cannot move it to the previous day.

```ts
export function formatDisplayDate(isoDate: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'ka-GE', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`));
}
```

- [x] Replace hardcoded shared-control labels with `message(messages, key)`, using `useI18n()` or explicit props for non-context consumers. Cover search accessible names, select/clear text, totals and programme counts, chart/table controls, download progress/failure, coming-soon badges, and horizontal-scroll instructions. A count must retain its current denominator and supplemental programme count.
- [x] Add a browser assertion that filtering results does not change the bulk-action denominator, and that English screen-reader names correspond to the visible buttons. Run the focused browser file against the isolated build, plus `npm run typecheck` and `npm run i18n:check`.
- [x] Commit the named files with `feat: localize shared controls and number units`.

**Done:** shared controls and number displays work in English; numerical and selection semantics stay unchanged.

> W1 verified on 2026-09-05: 11 new numerical/date regressions; full check passed 166 files / 1,651 tests. Focused shared-component tests passed; isolated rendering fixtures retain their existing Georgian expectations inside the real language provider. Production build and unchanged publication hashes passed. Bilingual controls/navigation passed 13 browser tests, followed by seven final English-control and Georgian-selector/range checks. Desktop/mobile screenshots confirmed label-and-count groups stay together. Evidence: .tmp/bilingual/w1-*. Page-specific copy and chart/model labels remain in W2 and the later family tasks.

## Task W2: Complete expenditure and receipts explorers

**Depends on:** W1.

**Files:** Modify `apps/web/lib/pages/expenditure.tsx`; create `apps/web/lib/pages/revenue.tsx` and paired revenue wrappers in `apps/web/app/{(ka),(en)/en}/explorer/revenue/page.tsx`. Modify `apps/web/lib/explorer/{explorerData,indicators,types}.ts`, `apps/web/components/main-explorer/{main-explorer,series-panel,explorer-view,explorer-table,editorial-line-chart,indicators}.tsx`. Add `main.json` dictionaries. Test `apps/web/tests/i18n/nationalPresentation.test.ts`, `apps/web/tests/browser/bilingual-national.spec.ts`, and existing `tests/browser/main-explorer.spec.ts`.

**Interfaces:** `renderRevenuePage(locale: Locale): Promise<React.ReactElement>` and `revenuePageMetadata(locale: Locale): Promise<Metadata>`. Extend `MainExplorerProps` with required `presentation: Presentation`. Existing `buildExplorerModel(input: ExplorerModelInput, presentation?: Presentation): ExplorerModel` preserves IDs/points/order and resolves the `enLabel` fields from `presentation.englishLabels` when supplied. Keep Georgian `kaLabel` values intact. All public consumers choose a displayed label through `publicLabel`.

- [x] Build a small model test fixture with one actual and one planned value for the same category/year, two selected categories, and a missing year. Feed the identical fixture to each language. Compare points, years, selected IDs, totals, status, and colour identities exactly; compare text separately.

```ts
const glossary = new Map([
  ['spending.education', { id: 'spending.education', kaLabel: 'განათლება', enLabel: 'Education', description: '', notes: '' }],
  ['spending.health', { id: 'spending.health', kaLabel: 'ჯანდაცვა', enLabel: 'Health', description: '', notes: '' }],
]);
const englishLabels = { 'spending.education': 'Education', 'spending.health': 'Health', 'expenditure.total': 'Total expenditure' };
const input: ExplorerModelInput = {
  facts: [
    { year: 2020, side: 'expenditure', itemId: 'spending.education', amountGel: 100, basis: 'actual' },
    { year: 2020, side: 'expenditure', itemId: 'spending.education', amountGel: 120, basis: 'planned' },
    { year: 2020, side: 'expenditure', itemId: 'spending.health', amountGel: 50, basis: 'actual' },
  ],
  glossary, side: 'expenditure', selectedItemIds: ['spending.education', 'spending.health'],
  startYear: 2020, endYear: 2021, measure: 'nominal',
};

it('keeps every numerical point identical between languages', () => {
  const ka = buildExplorerModel(input, { locale: 'ka', englishLabels, messages: kaMessages });
  const en = buildExplorerModel(input, { locale: 'en', englishLabels, messages: enMessages });
  expect(en.points).toEqual(ka.points);
  expect(en.years).toEqual(ka.years);
  expect(en.selectedItems.map(item => item.id)).toEqual(ka.selectedItems.map(item => item.id));
});
```

Import `ExplorerModelInput` from `explorerData.ts` and load `kaMessages`/`enMessages` with `await getMessages(locale, ['common', 'main'])` in `beforeAll`. Additionally assert that the active 2020 education value is 100, not 120 or their sum, and 2021 is not reported as zero. Do not compare a field carrying translated text as if it were numerical.
- [x] Run the new model/browser regressions, then resolve category, ministry, programme, and total labels using the reviewed catalogue. The latest reviewed programme name and historical explanations follow existing year/identity rules. Do not infer English programme names from official codes or reintroduce the Georgian-to-English fallback in `adminFactForModel`.
- [x] Pass the correct locale, units, and scoped sentences through the main explorer, table, chart, selectors, legend/tooltips, empty states, warnings, growth summaries, source dates, and accessible chart descriptions. Search both reviewed languages using `matchesLabelQuery` on the same candidates as today; selection remains unlimited and existing bulk behaviour remains global to its scope.

```tsx
const { locale, englishLabels, messages } = presentation;
const displayedName = publicLabel(locale, item.id, item.kaLabel, englishLabels);
return <span>{displayedName}</span>;
```

- [x] Review the English receipts heading/total against the source boundary. Use `Budget receipts` for the full receipts concept and retain specific tax/revenue component names. Do not change the underlying route `/explorer/revenue`, IDs, or Georgian wording. Review `% of GDP`, planned status, the unavailable 2004 liabilities item, and all historical caveats.
- [x] Add tests switching in both directions with fields/ministries, table/line, selected programmes, non-default ranges, and GDP-share mode. Query English and Georgian names on the English page. Verify the same selected rows and plotted values after reload and back navigation.
- [x] Run the focused tests, `tests/factQuery/agreement.test.ts`, `npm run typecheck`, and `npm run i18n:check`. Commit with `feat: complete English expenditure and receipts explorers`.

**Done:** an English reader can perform every existing national multi-year interaction using reviewed English names and descriptions.

> W2 verified on 2026-09-05: 475 focused tests passed across 46 files, including numerical/label parity, actual-over-planned precedence, zero versus missing values, existing explorer cases, AI agreement and the reference fixture. All 54 national/bilingual browser tests passed, including initial English HTML without JavaScript, both-language search, table/GDP-share parity, selected-programme plot parity across switching/back/reload, and existing Georgian workbook behavior. Lint, typecheck, translation checks and a production build passed; 101 static-generation entries, only /mcp dynamic, unchanged publication hashes/dataVersion. Desktop/mobile screenshots reviewed under .tmp/bilingual/w2-*. Rich translated sentences preserve styled numbers through a small escaped React message component; labels cross the client boundary only for the active page. English Excel content is W3; final language-paired SEO is W9.

## Task W3: Localize the existing Excel pipeline and source descriptions

**Depends on:** W2 and F3.

**Files:** Modify `apps/web/lib/explorer/{workbookModel,workbookWriter.client,debtWorkbook,deficitWorkbook}.ts`, `apps/web/lib/methodology/workbookSources.ts`, exporter call sites in `components/main-explorer/main-explorer.tsx`, `components/municipalities/municipal-explorer.tsx`, `components/debt/debt-explorer.tsx`, and `components/deficit/deficit-explorer.tsx`. Add `workbook.json` dictionaries and `apps/web/tests/browser/bilingual-workbooks.spec.ts`; extend `tests/explorer/{workbookModel,workbookWriter}.test.ts`, `tests/methodology/workbookSources.test.ts`, and existing lineage browser coverage.

**Interfaces:** Make internal workbook display-property names neutral: `titleKa→title`, `groupLabelKa→groupLabel`, `labelKa→label`, `parentLabelKa→parentLabel`, `organizationKa→organization`, `unitLabelKa→unitLabel`, `analysisHeaderKa→analysisHeader`, and `subtitleKa→subtitle`. Add required `locale: Locale` to `WorkbookExportInput` and `WorkbookExportModel`. `buildWorkbookExportModel` retains its one-input signature. Public source loader signatures gain an optional last locale argument defaulting to Georgian; their caches must include locale, or cache language-neutral source records and project after lookup. Export the two approved sheet-name tuples rather than unrestricted names.

- [x] Extend the existing workbook fixtures to include explicit `locale`, neutral presentation names, actual/planned/forecast/missing status, zero, negative values, and English text. Add a test that checks exact sheet names, filename suffix, English annotations, numerical cells, and selected-source URLs.

```ts
const georgianModel = buildWorkbookExportModel(input);
const englishInput: WorkbookExportInput = {
  ...input, locale: 'en', title: 'Georgia tax revenue', groupLabel: 'Taxes',
  measure: { kind: 'amount', unitLabel: 'GEL million', readableScale: 1_000_000 },
  series: input.series.map(series => ({ ...series, label: series.id === 'revenue.total' ? 'Total taxes' : 'VAT' })),
  sources: input.sources.map(source => ({ ...source, title: 'Consolidated budget receipts, 2020', organization: 'Ministry of Finance of Georgia' })),
};

it('exports the English table without converting amounts', () => {
  const model = buildWorkbookExportModel(englishInput);
  expect(model.sheetNames).toEqual(['Summary', 'Data', 'Sources']);
  expect(model.filename).toBe('fiscal-revenue-2020-2021-en.xlsx');
  expect(model.analysis.headers.slice(0, 5)).toEqual(['Year', 'Group', 'Category', 'Amount (GEL)', 'Status']);
  expect(model.analysis.rows.map(row => row[3])).toEqual(georgianModel.analysis.rows.map(row => row[3]));
  expect(model.sources.map(source => source.absoluteUrl)).toEqual(georgianModel.sources.map(source => source.absoluteUrl));
});
```

Construct `englishInput` from the existing workbook fixture with only its new locale/display fields translated; `georgianModel` uses the same numerical fixture. Update existing test property names mechanically while retaining every numeric expectation.
- [x] Confirm failure, then adapt the model/writer and all existing exporter call sites together so intermediate commits do not leave a broken signature. Keep English labels selected before model construction. Preserve original source IDs for lookup before the loader strips them; map ordinary manifest `source_id` to F3 document records and use the existing package-document IDs for GDP/debt sources. The writer must not perform filesystem translation lookups.

```ts
export const SHEET_NAMES = {
  ka: ['მარტივი ცხრილი', 'მონაცემები', 'წყაროები'],
  en: ['Summary', 'Data', 'Sources'],
} as const;
const filename = `fiscal-${input.filenameBase}-${years[0]}-${years.at(-1)}${input.locale === 'en' ? '-en' : ''}.xlsx`;
```

- [x] Localize status lookup, title/subtitle, headings, source labels, download hyperlink text, and the quoted planned marker in Excel number formats. Preserve workbook numeric formatting, hierarchy, filters, frozen rows/columns, source-role selection, archive URLs, GDP-source conditions, and the debt-rate blank GEL column. Public workbooks keep three sheets and no internal provenance columns.
- [x] Capture an actual browser download and load the bytes with the existing ExcelJS test pattern. Check sheet names and cell types rather than only the export model. Assert the English and Georgian source links resolve to the same originals and source selection matches the active measure/range.

```ts
const downloadPromise = page.waitForEvent('download');
await page.getByTestId('series-excel').click();
const download = await downloadPromise;
expect(download.suggestedFilename()).toMatch(/-en\.xlsx$/);
const filePath = await download.path();
if (!filePath) throw new Error('Expected downloaded workbook path');
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(filePath);
expect(workbook.worksheets.map(sheet => sheet.name)).toEqual(['Summary', 'Data', 'Sources']);
```

- [x] Run focused workbook/lineage tests, `npm run typecheck`, and `npm run i18n:check`. Commit with `feat: generate English Excel workbooks with source parity`.

**Done:** the exporter can generate either language for every existing export family. W5–W7 will expose English exporter inputs as their pages are localized. Do not add a new export action to a page that currently has none.

> W3 verified on 2026-09-06: full check passed 168 files / 1,669 tests; focused export/catalogue/source cases passed. Ten browser tests passed, including four paired real English/Georgian downloads with equal numeric cells, formulas, blank-versus-text structure, source URLs, source periods and retrieval dates. Files are retained under .tmp/bilingual/w3-workbooks. English debt/rate and signed deficit workbooks were also opened with ExcelJS; rates retain blank GEL cells. Source caches now distinguish locale and join reviewed translations before removing document IDs. The existing deficit UI ID differs from the service ID; both are now explicitly covered in the 265-label inventory, with no identifier changes. Production build passed; publication hashes/dataVersion remained unchanged. Neutral workbook field names were applied to all consumers; English municipal/debt/deficit page inputs will become public with W6/W7.

## Task W4: Translate complete methodology and source archives

**Depends on:** W3.

**Files:** Modify `apps/web/lib/methodology/{types,catalog}.ts` and existing `content/{expenditure,revenue,municipalities,debt}.ts`; create parallel `content/en/{expenditure,revenue,municipalities,debt}.ts`. Modify `apps/web/components/methodology/{methodology-hub,methodology-article,decision-record,method-journey,source-archive,document-visuals}.tsx`. Create `apps/web/lib/pages/methodology.tsx` and paired hub/dataset wrappers. Add `methodology.json` dictionaries and `apps/web/tests/i18n/methodologyCoverage.test.ts`, `apps/web/tests/browser/bilingual-methodology.spec.ts`. Modify `check-localization.ts` to invoke long-form coverage validation.

**Interfaces:** Make `MethodologyContent`/`MethodologyDecision` presentation property names language-neutral in both languages: `title`, `summary`, `disclosure`, `label`, `value`, `paragraphs`, `group`, `detail`, and `statusLabel` replace corresponding `*Ka` names. Status display labels can be either language; stable decision IDs/classification mapping retain meaning. Keep all current structural/data fields. Export `getMethodologyContent(dataset: MethodologyDatasetId, locale: Locale): MethodologyContent`, `renderMethodologyHub(locale)`, and `renderMethodologyArticle(dataset, locale)` from their owners; page renderers return `Promise<React.ReactElement>`. `methodologyPageMetadata(dataset: MethodologyDatasetId | null, locale: Locale): Promise<Metadata>` serves both hub and detail wrappers.

- [x] Add a structural coverage test across the four current subjects, including hidden groups and technical appendices. Compare decision IDs, canonical references, section IDs/kinds, coverage source, archive identity, and key-fact value kinds; compare English prose separately.

```ts
for (const dataset of LIVE_METHODOLOGY_IDS) {
  it(`preserves ${dataset} public decision coverage`, () => {
    const ka = getMethodologyContent(dataset, 'ka');
    const en = getMethodologyContent(dataset, 'en');
    expect(en.sections.map(section => [section.id, section.kind]))
      .toEqual(ka.sections.map(section => [section.id, section.kind]));
    expect(en.decisions.map(decision => [decision.id, decision.canonicalDecisionIds]))
      .toEqual(ka.decisions.map(decision => [decision.id, decision.canonicalDecisionIds]));
    expect(en.technicalAppendix.map(decision => decision.id)).toEqual(ka.technicalAppendix.map(decision => decision.id));
    expect(en.archiveManifestId).toBe(ka.archiveManifestId);
    const visibleIds = (content: MethodologyContent) => content.decisions
      .filter(decision => !content.hiddenDecisionGroups?.includes(decision.group))
      .map(decision => decision.id);
    expect(visibleIds(en)).toEqual(visibleIds(ka));
  });
}
```

- [x] Confirm failure, then rename Georgian presentation fields without changing their values, author the full English parallel content, and implement language selection in `catalog.ts`. Preserve every limitation and source distinction. Translate `hiddenDecisionGroups` consistently with each English decision's `group` label, and assert the same visible/hidden decision IDs and group memberships in both languages so translated labels cannot merge or expose groups accidentally. Register each dataset's translation review date; do not update it merely because code rebuilds.
- [x] Localize archive search, filters, counts, download affordances, original-file descriptions, source-organization names, archive labels, document-visual captions, disclosure labels, and accessibility text. Search both reviewed names while displaying the selected language. Join translations by manifest/document IDs, never by display strings. Retain original manifest files byte-for-byte.

```tsx
const content = getMethodologyContent(dataset, locale);
return <MethodologyArticle
  content={content}
  coverage={coverage}
  rows={rows}
  archiveSummary={archiveSummary}
  processedDataHref={processedDataHref}
  processedDataJsonLinks={processedDataJsonLinks}
  breadcrumbItems={breadcrumbItems}
/>;
```

The seven supporting values above come from the existing methodology page's data assembly, moved into the shared renderer. Keep its source/archive inputs. Rename `processedDataJsonLinks[].labelKa` to neutral `label` at the component boundary and resolve it in the page's language.
- [x] Mark retained original-language fragments with `lang="ka"` and a specific `data-original-language` attribute; accompany them with English explanation. Verify document language from originals or retain an unknown label. Do not imply the original file is an official English translation. Keep download paths, hashes, role distinctions, and licensing obligations.
- [x] Run `npx vitest run tests/i18n/methodologyCoverage.test.ts tests/methodology`, focused browser coverage, `npm run i18n:check`, and `npm run typecheck`. Commit with `feat: translate methodology and original-source descriptions`.

**Done:** the expenditure vertical slice includes English explanations, originals, and a working workbook. Complete an A2 expenditure example before extending all remaining families, as specified in the master sequence.

> W4 verified on 2026-09-06: full check passed 170 files / 1,676 tests; 172 focused translation/methodology tests and all 33 methodology browser tests passed. Four complete English articles retain the same section/decision IDs, canonical references, figures, status meanings, hidden groups and original review dates; separate English translation reviews are dated 2026-09-06. Build-time validation rejects missing text and changed figures/codes/classifications. All five English methodology pages render without JavaScript. Archive descriptions join by document ID and search both languages; original filenames, downloads and manifest bytes remain intact. Browser tests cover mobile/desktop, keyboard disclosure, anchors, filters, empty results and actual source bytes. Production build passed with 106 static-generation entries, only /mcp dynamic, and unchanged publication hashes/dataVersion. Screenshots reviewed under .tmp/bilingual/w4-*. Shared logo embedded Georgian copy remains the explicitly scheduled W8 asset task; final language-paired structured metadata remains W9.

## Task W5: Complete the single-year analysis views

**Depends on:** W2–W4.

**Files:** Modify `apps/web/lib/explorer/{singleYear,types}.ts`, `apps/web/components/analysis/{analysis-view,treemap,ranking,radar,every-100,budget-field}.tsx`, and analysis paths in `components/main-explorer/main-explorer.tsx`. Create `apps/web/lib/pages/analysis.tsx`, paired analysis wrappers, `analysis.json` dictionaries, `apps/web/tests/i18n/analysisPresentation.test.ts`, and `apps/web/tests/browser/bilingual-analysis.spec.ts`.

**Interfaces:** `renderAnalysisPage(locale: Locale): Promise<React.ReactElement>` and `analysisPageMetadata(locale: Locale): Promise<Metadata>`. Existing `buildSingleYearSnapshotModel(input, presentation?: Presentation)` preserves its numerical output and resolves display names through F3.

- [x] Add a year/grouping parity test and browser tests for all six current visualizations. The test must verify that the language switch retains `as`, `ag`, and `ay` hash values, and that English labels appear in focus/hover details.

```ts
test('keeps analysis year and grouping across languages', async ({ page }) => {
  await page.goto('/explorer/analysis#as=expenditure&ag=ministries&ay=2024');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  const before = new URL(page.url()).hash;
  await page.getByTestId('language-switch').getByRole('link', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true');
  expect(new URL(page.url()).hash).toBe(before);
});
```

- [x] Confirm failure, then pass `Presentation` to the existing snapshot presentation and visualization components. Replace full headline sentences, tooltips, chart summaries, category names, ranks/ordinals, unit descriptions, and accessible labels. Retain every numerical position/size/rank and its selected side/group/year.

```ts
const title = message(presentation.messages, 'analysis.every100.title');
const amount = formatAmountParts(value, false, presentation.locale);
```

Define `analysis.every100.title` as the unchanged Georgian title and `Every 100 GEL` in English. Keep decimal handling and share calculations in the current functions.
- [x] Run the model tests, relevant existing single-year tests, focused browser coverage at desktop/mobile, `npm run typecheck`, and `npm run i18n:check`. Commit with `feat: localize single-year budget analysis`.

**Done:** the six visualizations and all accessible descriptions are English-complete without new chart behaviour.

> W5 verified on 2026-09-06: full check passed 173 files / 1,697 tests; 118 focused translation/model/agreement tests and all 53 main-explorer/English-analysis browser tests passed. Every served year in expenditure fields, administrative categories and receipts has identical model rows, ranks, numerical headlines, radar inputs and 100-cell allocations in both languages. English initial HTML, source notes, hover/focus details, the first-year growth limitation, mobile controls, and state across switching/back/reload are verified. Treemap geometry, radar paths, bubble coordinates, cell colours and displayed ranking numbers stay identical. The existing synthetic snapshot.other display ID is now reviewed in the 266-label catalogue; no data ID or calculation changed.

> Final production build passed with 107 static-generation entries, only /mcp dynamic, unchanged dataVersion a6c927f06f86396992ed7afd5fc0aae3accfc83700f3213fc28ddcbc7c1ceeff, and all ten publication hashes verified. Desktop/mobile screenshots reviewed under .tmp/bilingual/w5-*. Preview: http://127.0.0.1:3217/en/explorer/analysis. There is no new analysis download action. Shared English metadata completion remains W9.

## Task W6: Complete municipal index, municipality, region, and country pages

**Depends on:** W1–W4.

**Files:** Modify `apps/web/lib/explorer/{municipalData,municipalLabels,municipalityMapData}.ts`, `apps/web/lib/seo/municipalMetadata.ts`, and `apps/web/components/municipalities/{municipalities-index,municipal-explorer,municipal-indicators,municipality-map,entity-picker}.tsx`. Create `apps/web/lib/pages/municipal.tsx`; paired municipal index, country, `[slug]`, and `region/[id]` wrappers; `municipal.json` dictionaries; `apps/web/tests/i18n/municipalPresentation.test.ts` and `apps/web/tests/browser/bilingual-municipal.spec.ts`.

**Interfaces:** `renderMunicipalIndex(locale)`, `renderMunicipalCountry(locale)`, `renderMunicipality(slug: string, locale)`, and `renderMunicipalRegion(id: string, locale)` return `Promise<React.ReactElement>`. `municipalPageMetadata(kind: 'index' | 'country' | 'municipality' | 'region', id: string | null, locale: Locale): Promise<Metadata>`. Localize the existing presentation-producing municipal functions using the optional final `Presentation` argument; aggregation and geometry functions remain unchanged.

- [ ] Add model parity for a municipality, ordinary region, Adjara, and the Georgia aggregate. Cover municipality total, functions, rank, per-resident index values, null country per-resident value, and generated summaries. Add browser cases for both-language search and link continuity from the English map/index.

```ts
test('finds Batumi using Georgian on the English index', async ({ page }) => {
  await page.goto('/en/explorer/municipalities');
  await page.getByTestId('municipal-entity-search').fill('ბათუმი');
  const batumi = page.getByRole('link', { name: /Batumi/ }).first();
  await expect(batumi).toHaveAttribute('href', '/en/explorer/municipalities/batumi');
  await batumi.click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
```

Add the stable `municipal-entity-search` test ID to the existing index search input; do not create a new search control. Keep tests for the unchanged 64-page territorial set separate from source-only aggregate identities.
- [ ] Confirm failure, then use reviewed short/full English entity names according to context, consistent region spellings, and translated municipal functions. Where a full English name is needed, use a reviewed catalogue entry under the stable entity ID's `.official-name` display key and register that derived display key in the inventory; do not alter public entity IDs.
- [ ] Translate complete municipality/region summary templates and existing Georgian grammatical helpers through separate English sentences. Keep fixed latest-year summaries tied to their current data year rather than the active chart range. English Adjara text must explain its six municipalities plus net republican amount and its municipal-only function rows.

```ts
const summary = message(presentation.messages, 'municipal.latestSummary', {
  name: publicLabel(presentation.locale, entityId, nameKa, presentation.englishLabels),
  year: latestYear,
  amount: formatAmount(total, presentation.locale),
});
```

- [ ] Localize map legend and hover/focus descriptions, index KPIs, ranking suffixes, entity pickers, function selectors, compare/mover text, source dates, and the W3 workbook input. Preserve territory overlays as currently non-interactive/unlabelled, geometry, fills, rankings, default totals, and per-resident scope.
- [ ] Run municipal model/metadata tests, all four existing municipal browser families plus the new bilingual test, `npm run typecheck`, and `npm run i18n:check`. Commit with `feat: complete English municipal and regional explorers`.

**Done:** every public municipal route has a complete English counterpart and unchanged accounting/territorial behaviour.

## Task W7: Complete debt and deficit pages

**Depends on:** W1, W3, W4.

**Files:** Modify `apps/web/lib/explorer/{debtExplorer,deficitExplorer,debtWorkbook,deficitWorkbook}.ts`, `apps/web/components/debt/{debt-explorer,debt-series-panel}.tsx`, `apps/web/components/deficit/deficit-explorer.tsx`. Create `apps/web/lib/pages/{debt,deficit}.tsx`, paired route wrappers, `debt.json` and `deficit.json` dictionaries, `apps/web/tests/i18n/debtDeficitPresentation.test.ts`, and `apps/web/tests/browser/bilingual-debt-deficit.spec.ts`.

**Interfaces:** `renderDebtPage(locale)`/`renderDeficitPage(locale)` return `Promise<React.ReactElement>`; `debtPageMetadata(locale)`/`deficitPageMetadata(locale)` return `Promise<Metadata>`. Keep existing model inputs and numerical output. Extend presentation-only descriptions and exporter inputs with locale; existing URL-state serializers retain their signatures and key vocabulary.

- [ ] Add tests for debt stock, actual service, optional existing-portfolio forecast, weighted rates, missing rates, signed deficit, and actual/projection distinction. Compare existing model values across languages and assert English units/status descriptions independently.

```ts
test('explains English debt rates without describing them as GEL', async ({ page }) => {
  await page.goto('/en/explorer/debt#f=rate&sel=debt.rate.total');
  await expect(page.getByTestId('debt-measure-label')).toContainText('%');
  await expect(page.getByTestId('debt-measure-label')).not.toContainText('GEL');
});
```

The existing debt serializer recognizes `f=rate` and the selected rate-series ID. Also test selecting the rate through its existing series row; do not add a new family button solely for this test.
- [ ] Confirm failure, then localize all nine debt series, deficit/balance naming, family/measure controls, legends/tooltips, yearly summaries, rate gaps, limitations, projection notices, source links, and W3 export text. English prose must distinguish a debt stock from spending and an existing-portfolio schedule from a government budget plan.

```ts
const shownLabel = publicLabel(presentation.locale, seriesId, labelKa, presentation.englishLabels);
const note = message(presentation.messages, 'debt.portfolioProjection', { date: snapshotDate });
```

- [ ] Verify switching preserves the existing debt and deficit hashes, future-year ranges, selection, and chart/table mode, with the corresponding forecast notices still visible. Verify rate exports retain blank GEL amounts and deficit exports retain signed nominal values. Keep `spending.debt_service` separate from government-debt service.
- [ ] Run existing debt/deficit model and browser tests plus the new tests, typecheck, and translation checks. Commit with `feat: localize debt and deficit exploration`.

**Done:** both pages explain and export the correct fiscal measures in English, including their limitations.

## Task W8: Complete home, data hub, About, and connection pages

**Depends on:** W2, W4–W7. Coordinate `/connect` wording with A5 before final acceptance.

**Files:** Modify `apps/web/components/landing/{landing-page,landing-fiscal-sections,landing-dataset-section}.tsx`, `apps/web/lib/landing/landingData.ts` (including its exported presentation types), `apps/web/components/hub/budget-hub.tsx`, `apps/web/lib/explorer/hubCards.ts`, and `apps/web/components/connect/copy-endpoint.tsx`. Create `apps/web/lib/pages/{home,hub,about,connect}.tsx` and paired wrappers. Add `landing.json`, `about.json`, `connect.json`, and `hub.json` dictionaries. Test `apps/web/tests/i18n/landingPresentation.test.ts`, `apps/web/tests/browser/bilingual-content.spec.ts`, and existing landing/about/connect browser files. Inspect brand SVGs and social assets for text; modify an asset only if actual embedded copy needs translation.

**Interfaces:** each page module exports `renderHomePage`, `renderHubPage`, `renderAboutPage`, or `renderConnectPage` with `(locale: Locale): Promise<React.ReactElement>`, plus its matching `{home,hub,about,connect}PageMetadata(locale): Promise<Metadata>`. Existing landing/hub data builders accept optional presentation only for display text; their facts, coverage dates, ordering, and numerical headline logic stay unchanged.

- [ ] Add a browser journey from English home → data hub → a dataset → methodology → connection, verifying every human page stays under `/en` and the copied endpoint remains shared.

```ts
test('English connection still points to the shared endpoint', async ({ page }) => {
  await page.goto('/en/connect');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('https://fiscal.ge/mcp', { exact: true }).first()).toBeVisible();
  await expect(page.locator('a[href="/en/mcp"]')).toHaveCount(0);
});
```

- [ ] Confirm failure, then translate home headings/descriptions, data-derived narrative templates, coverage/status labels, trust/process sections, hub cards, About copy, licensing text, footer content, and the connection instructions. Preserve the approved hero, data-derived actual headlines, coming-soon markers, and route exclusions.

```tsx
<Link href={pageHref('/explorer/expenditure', locale)}>
  {message(messages, 'landing.expenditure.action')}
</Link>
```

- [ ] Keep Fiscal.ge brand and its contact address unchanged. English future indicators remain non-clickable labels. Translate alt text and embedded descriptive text only where present; do not regenerate decorative images just because the page language changes. The final connection page must describe A5's actual schema/examples and all current tool coverage.
- [ ] Run the focused content and existing landing/about/connect tests, `npm run typecheck`, `npm run i18n:check`, and inspect desktop/mobile composition. Commit with `feat: complete English public information pages`.

**Done:** an English reader can enter through any public content page and continue through the complete site in English.

## Task W9: Finish language-specific SEO, social previews, and exhaustive route coverage

**Depends on:** W1–W8 and completed English body content. Final service/distribution wording also depends on A5.

**Files:** Modify `apps/web/lib/seo/{metadata,structuredData,municipalMetadata,internalLinks}.ts`, `apps/web/components/seo/breadcrumb-json-ld.tsx`, `apps/web/app/sitemap.ts`, the shared page renderers' metadata functions, and `apps/web/app/opengraph-image.tsx`. Create a static English social image route at `apps/web/app/(en)/en/opengraph-image.tsx` with the shared existing image composition, and `apps/web/lib/seo/socialImage.tsx` to own that composition. Add `seo.json` dictionaries and `data/localization/en/page-revisions.json`; update `checkLocalization` to cover page revisions. Test existing `tests/seo/` and new `tests/seo/bilingual.test.ts`, `tests/browser/bilingual-seo.spec.ts`.

**Interfaces:** `fiscalMetadata` gains explicit `locale: Locale` in its input. Page `path` remains unprefixed; the helper uses `pageHref`. Shared structured-data builders gain locale or explicit language lists as appropriate. `page-revisions.json` maps every unprefixed public page path to the actual reviewed English revision date. The sitemap uses `max(existingDataOrContentDate, translationRevisionDate)` for English only; dates remain validated ISO values.

- [ ] Add self-canonical and reciprocal-language tests for a normal page, root, municipality, and methodology. Verify the known homepage trailing-slash contract in rendered HTML, including the existing manual root tags; do not remove them without demonstrating equivalent output and exactly one canonical.

```ts
it('gives English its own canonical and pairs both real pages', () => {
  const metadata = fiscalMetadata({ title: 'Government debt', description: 'Reviewed government debt data.', path: '/explorer/debt', locale: 'en' });
  expect(metadata.alternates?.canonical).toBe('https://fiscal.ge/en/explorer/debt');
  expect(metadata.alternates?.languages).toEqual({
    ka: 'https://fiscal.ge/explorer/debt',
    en: 'https://fiscal.ge/en/explorer/debt',
    'x-default': 'https://fiscal.ge/explorer/debt',
  });
});
```

- [ ] Confirm failure, then implement locale-aware titles, descriptions, Open Graph locale/image/alt text, Twitter fields, breadcrumb names, site/page language markers, and methodology links. Use shared numerical dataset IDs/distribution URLs for one dataset; describe bilingual labelled publications with both language codes where appropriate. Machine CSVs and original archives keep their URLs.

```ts
const ka = new URL(pageHref(path, 'ka'), origin).href;
const en = new URL(pageHref(path, 'en'), origin).href;
const alternates = { canonical: locale === 'en' ? en : ka, languages: { ka, en, 'x-default': ka } };
```

- [ ] Generate paired sitemap entries from F3's route inventory and current per-page data freshness. Include all real English routes; exclude `/mcp`, 404s, resources, and filter-specific page inventions. Add genuine page translation revision dates, not build dates. Translation corrections update only affected page dates, including shared chrome consumers when their actual public content changes.
- [ ] Extract the existing social-image composition for both languages. Preserve dimensions, brand, contrast, and static generation; change only language-specific text and necessary line wrapping. Verify the English image actually contains English readable text and its metadata points to the correct static route.
- [ ] Crawl the final paired route inventory in initial HTML and a real browser. Check visible/accessible strings, alternates, canonicals, sitemap entries, social assets, scoped links, and zero unintended Georgian fallbacks. Use a targeted original-language exception registry with marked fragments; never skip all chart SVG text or all source descriptions.
- [ ] Run `npx vitest run tests/seo tests/i18n`, all relevant bilingual browser tests, `npm run i18n:check`, typecheck, and a production build. Confirm static social images and content routes. Commit with `feat: publish complete bilingual metadata and discovery`.

**Done:** complete English pages can be discovered and shared correctly. This does not claim search-engine indexing has occurred; V1 and authorized V2 remain the release gate.
