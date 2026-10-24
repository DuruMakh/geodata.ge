# Homepage Redesign, Step 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage's ledger tables with the redesign's five budget chapters, a sources section, an Ask AI band and a new footer, all computed from served facts.

**Architecture:** Pure builders in `lib/landing/chapters/` turn served facts into one small `HomeChapters` model at build time. The server page renders every heading, sentence, list and readout as HTML; each chart is a client component in `components/landing/chapters/` whose code chunk loads when its section nears the viewport and draws on a canvas (raw WebGL for the municipal relief). The page stays fully static.

**Tech Stack:** Next.js 16 (app router, static), React 19, TypeScript strict, Tailwind v4 tokens from `globals.css`, Canvas 2D / WebGL 1, Vitest, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-24-homepage-redesign-step1-design.md`. Design board for exact styles and drawing code: `/mnt/project-files/homepage-redesign/design-board/Main.dc.html` (CSS lines 115-357, script from line 752; chart functions `createScale`, `createTree`/`squarify`, `createRev`/`stackLabels`, `createDef`, `createMuni`, helpers `c2d`, `tipCtl`, `chartCore`, `nice`, `fit`, `glPoints`, `soft2d`, `makeCam`/`camUpdate`). Port drawing and layout logic from there; never copy its data constants.

## Global Constraints

- No new npm dependencies. Lucide only for UI icons (`Play`, `Pause`, `ArrowRight`, `Copy`, `Check`).
- Every number comes from served facts at build time; only population and area stay hand-maintained (existing `COUNTRY_NUMBERS`).
- Below 768px the hero never requests Three.js (unchanged `HeroReliefLazy`).
- Canvas device-pixel ratio capped at 2. Animations run once on first view; `prefers-reduced-motion: reduce` shows final states with no animation.
- All user-facing text lives in `lib/i18n/messages/{ka,en}/landing.json` (or `common.json` for the footer); Georgian strings are the board's; English drafts go on the proofread list.
- Heading links: 01 `/explorer/analysis`, 02 `/explorer/expenditure`, 03 `/explorer/revenue`, 04 `/explorer/municipalities`, 05 `/explorer/deficit`, always through `pageHref(path, locale)`.
- Chart colours: existing tokens; revenue bands `#28568e` VAT, `#50aed5` income, `#007f69` profit, `#83c084` excise, `#7668ad` other taxes, `#d2ab5f` other income, `var(--accent)` liabilities.
- Section anchors: `ch-01` … `ch-05`, `sources`, `ai`.
- Do not push, open a PR or run the full gates before Duru approves the preview (project rule).

## Review Focus

1. **A year with a planned value** (spending or revenue): the chart must use the active fact (actual wins) and the year label must say planned; covered in Task 1.
2. **A scale measure missing for the GDP year** (e.g. debt not yet published): the measure is dropped, not shown as 0; covered in Task 2.
3. **No surplus years / deepest deficit is the first year**: deficit annotations must be `null`, not crash; covered in Task 3.
4. **A municipality whose shape rasterises to zero cells** (tiny shapes): it must still get at least one cell; covered in Task 4.
5. **Clipboard blocked** (insecure context, permission denied): the copy button selects the address text instead of throwing; covered in Task 9.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/web/lib/landing/chapters/types.ts` | Shared model types (below) |
| `apps/web/lib/landing/chapters/budgetSeries.ts` | Spending and revenue series (Task 1) |
| `apps/web/lib/landing/chapters/scale.ts` | Chapter 01 measures (Task 2) |
| `apps/web/lib/landing/chapters/deficit.ts` | Chapter 05 series and annotations (Task 3) |
| `apps/web/lib/landing/chapters/municipalRelief.ts` | Chapter 04 places and dot grid (Task 4) |
| `apps/web/lib/landing/chapters/sourcesAi.ts` | Sources rows and MCP tool names (Task 5) |
| `apps/web/lib/landing/chapters/index.ts` | `buildHomeChapters` assembling all five plus sentences (Task 5) |
| `apps/web/components/landing/chapters/canvas.ts` | Canvas helpers ported from the board (Task 6) |
| `apps/web/components/landing/chapters/chapter.tsx` | Server chapter shell: rule, heading link, lede, anchor (Task 6) |
| `apps/web/components/landing/chapters/reveal.tsx` | Client: fade-in on first view and lazy chart mount (Task 6) |
| `apps/web/components/landing/chapters/scale-chart.tsx` etc. | One client file per chart (Tasks 7-8, 10-11) |
| `apps/web/components/landing/chapters/sources-section.tsx`, `ai-section.tsx`, `copy-endpoint.tsx` | Task 9 |
| `apps/web/components/site/site-footer-view.tsx` | `variant` prop (Task 12) |
| `apps/web/components/landing/landing-page.tsx`, `apps/web/lib/pages/home.tsx` | Assembly (Task 13) |

### Model types (`types.ts`, Task 1 creates the file; later tasks add their types to it)

```ts
export type ChapterLink = { title: string; href: string; hint: string };
export type SpendingSeries = {
  years: number[];                    // ascending, first..latest active expenditure year
  planned: boolean[];                 // per year: any active fact of that year is planned
  totals: number[];                   // GEL per year, sum of fields
  fields: { id: string; label: string; values: number[] }[]; // 13 fields, GEL, sorted by latest-year value desc, other_unclassified last
};
export type RevenueBandId = "vat" | "income" | "profit" | "excise" | "otherTaxes" | "otherIncome" | "liabilities";
export type RevenueSeries = {
  years: number[]; totals: number[]; taxShare: number[];          // taxShare as fraction 0..1
  bands: { id: RevenueBandId; label: string; values: (number | null)[] }[];
  peakBorrowing: { year: number; share: number } | null;
};
export type ScaleMeasureId = "gdp" | "revenue" | "spending" | "debt" | "balance" | "municipal" | "fdi" | "remittances";
export type ScaleChapter = { year: number; gdpGel: number; squares: number; defaultId: "spending";
  measures: { id: ScaleMeasureId; label: string; valueGel: number; squares: number; share: number }[] };
export type DeficitChapter = { years: number[]; pctGdp: number[]; gel: number[]; projectionFrom: number | null;
  deepest: { year: number; pct: number }; earlier: { year: number; pct: number } | null; surplusRun: { first: number; last: number } | null };
export type ReliefPlace = { code: string; name: string; totalGel: number; perResidentGel: number; rank: number; city: boolean };
export type MunicipalChapter = { year: number; totalGel: number; places: ReliefPlace[];
  grid: { cols: number; rows: number; cells: number[] } }; // cells[r*cols+c]: place index, -1 empty, -2 occupied area
export type SourceRow = { name: string; firstYear: number; lastYear: number; files: number };
export type HomeChapters = { scale: ScaleChapter; spending: SpendingSeries; revenue: RevenueSeries; municipal: MunicipalChapter;
  deficit: DeficitChapter; sources: { rows: SourceRow[]; totalFiles: number; reviewedAt: string }; tools: string[];
  sentences: Record<"spending" | "revenue" | "municipal" | "deficit", string> };
```

---

### Task 1: Spending and revenue series

**Files:**
- Create: `apps/web/lib/landing/chapters/types.ts`, `apps/web/lib/landing/chapters/budgetSeries.ts`
- Test: `apps/web/tests/landing/chapters/budgetSeries.test.ts`

**Interfaces:**
- Consumes: `chooseActivePublicFacts`, `isDerivedTotalItemId` (as `landingData.ts` imports them), `publicLabel`, `ServedBudgetFact`, `GlossaryEntry`, `Presentation`.
- Produces: `buildSpendingSeries(facts: ServedBudgetFact[], glossary: Map<string, GlossaryEntry>, presentation: Presentation): SpendingSeries` and `buildRevenueSeries(facts, glossary, presentation): RevenueSeries`; exported `REVENUE_BANDS: Record<RevenueBandId, readonly string[]>`.

- [ ] **Step 1: Write failing tests** with hand-made facts (style of `tests/landing/landingData.test.ts`):
  - `spending uses actual over planned and marks planned years`: 2024 planned-only `spending.health` 50 → `planned[i2024] === true`; 2025 actual 40 + planned 400 for the same item → value 40, `planned[i2025] === false`.
  - `spending totals equal the field sum and fields sort by latest value with other_unclassified last`.
  - `spending years run from the first to the latest year with any field fact; a missing field-year is 0`.
  - `revenue groups items into seven bands`: `revenue.import_tax` + `revenue.property_tax` + `revenue.other_taxes` → `otherTaxes`; `revenue.grants` + `revenue.other_revenue` + `revenue.asset_decrease` → `otherIncome`; `revenue.increase_liabilities` → `liabilities`; a year without any liabilities fact → `null`, and its total treats null as 0.
  - `taxShare is (vat+income+profit+excise+otherTaxes)/total` and `peakBorrowing is the year with the highest liabilities share` (ties: earliest).
  - `an item outside REVENUE_BANDS throws` (message names the item id), so a new revenue line cannot silently vanish.
- [ ] **Step 2:** `cd apps/web && npx vitest run tests/landing/chapters/budgetSeries.test.ts` → FAIL (module not found).
- [ ] **Step 3: Implement.** `REVENUE_BANDS = { vat: ["revenue.vat"], income: ["revenue.income_tax"], profit: ["revenue.profit_tax"], excise: ["revenue.excise_tax"], otherTaxes: ["revenue.import_tax","revenue.property_tax","revenue.other_taxes"], otherIncome: ["revenue.grants","revenue.other_revenue","revenue.asset_decrease"], liabilities: ["revenue.increase_liabilities"] }`. Band labels come from new messages `landing.revBand.{id}`; field labels via `publicLabel(locale, id, glossary kaLabel, presentation.englishLabels)`. Exclude derived totals with `isDerivedTotalItemId`.
- [ ] **Step 4:** Add the seven `landing.revBand.*` keys to `ka/landing.json` (`დღგ`, `საშემოსავლო`, `მოგების`, `აქციზი`, `სხვა გადასახადები`, `სხვა შემოსავლები`, `ვალდებულებების ზრდა`) and `en/landing.json` (`VAT`, `Income tax`, `Profit tax`, `Excise`, `Other taxes`, `Other income`, `Increase in liabilities`). Re-run the test → PASS; `npm run i18n:check` → no errors.
- [ ] **Step 5: Commit** `feat(home): spending and revenue series for the homepage chapters`.

### Task 2: Chapter 01 measures

**Files:** Create `apps/web/lib/landing/chapters/scale.ts`; Test `apps/web/tests/landing/chapters/scale.test.ts`.

**Interfaces:**
- Consumes: `SpendingSeries`, `RevenueSeries` (Task 1); `ServedGdpObservation[]`, `ServedGovernmentDebtFact[]`, `ServedGeneralGovernmentBalanceFact[]`, municipal country total `number` for the year, `ForeignInvestmentFact[]` (`fdi.total`), `MoneyTransferFact[]` (`transfer.total`, `received`).
- Produces: `buildScaleChapter(input: { gdp; spending; revenue; debtFacts; balanceFacts; municipalTotals: Map<number, number>; fdiFacts; transferFacts }, messages: Messages): ScaleChapter`.

- [ ] **Step 1: Failing tests:**
  - `year is the latest nominal_gel year; squares = round(gdpGel / 10_000_000)` (104_598_139_883 → 10_460).
  - `measures come in the order gdp, revenue, spending, debt, balance, municipal, fdi, remittances; defaultId is spending`.
  - `usd measures convert with nominal_gel / nominal_usd of the same year` (fdi 1_900_386_201 USD with gdp 104_598_139_883 GEL / 38_143_610_371 USD → 5_211_… GEL, assert to 1 GEL).
  - `balance uses the absolute GEL value and its label says deficit or surplus by sign` (`landing.scale.deficit` / `landing.scale.surplus`).
  - `a measure with no value for the year is omitted` (no debt fact for 2025 → no `debt`).
  - `share = valueGel / gdpGel; squares = round(valueGel / 10_000_000)`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Debt: `family === "stock" && seriesId === "debt.stock.total" && status === "actual" && valueKind === "amount_gel"`. FDI/transfer `valueUsd` is a decimal string; `Number()` it, skip null.
- [ ] **Step 4:** Messages `landing.scale.{gdp,revenue,spending,debt,deficit,surplus,municipal,fdi,remittances}` (ka from the board's `SCALE_OPTS` names plus `ბიუჯეტის პროფიციტი`; en drafts). Run → PASS.
- [ ] **Step 5: Commit** `feat(home): budget-next-to-economy measures`.

### Task 3: Chapter 05 deficit series

**Files:** Create `apps/web/lib/landing/chapters/deficit.ts`; Test `apps/web/tests/landing/chapters/deficit.test.ts`.

**Interfaces:** Produces `buildDeficitChapter(facts: ServedGeneralGovernmentBalanceFact[]): DeficitChapter`.

- [ ] **Step 1: Failing tests:**
  - `years ascending; projectionFrom is the first year with status projection, null when none`.
  - `deepest is the most negative actual pct; earlier is the most negative actual pct at least five years before deepest` (series with 2009 −6.37, 2020 −9.16 → deepest 2020, earlier 2009).
  - `earlier is null when no actual year is five or more years before deepest`.
  - `surplusRun is the longest run of consecutive actual years with pct > 0 (ties: earliest); null when none` (2004-2007 positive → `{first: 2004, last: 2007}`).
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(home): deficit series and annotations`.

### Task 4: Chapter 04 places and dot grid

**Files:** Create `apps/web/lib/landing/chapters/municipalRelief.ts`; Test `apps/web/tests/landing/chapters/municipalRelief.test.ts`.

**Interfaces:**
- Consumes: `buildMunicipalListRows` and `MUNICIPAL_PER_RESIDENT_YEAR` (`lib/explorer/municipalData.ts`), `MUNICIPALITY_MAP_ARTIFACT` (`lib/explorer/municipalityMapData.ts`), `publicLabel`.
- Produces: `buildMunicipalChapter(rows: MunicipalListRow[], year: number, presentation: Presentation, artifact = MUNICIPALITY_MAP_ARTIFACT, cell = 8): MunicipalChapter` and `rasterizeMunicipalities(artifact, codes: string[], cell: number): { cols; rows; cells }`.

- [ ] **Step 1: Failing tests** (small synthetic artifact: two square paths `M0 0L40 0L40 40L0 40Z`, `M40 0L80 0L80 40L40 40Z`, one city marker at (20,20), one occupied square):
  - `cols = ceil(1000/cell), rows = ceil(540/cell)` for the real viewBox.
  - `a cell whose centre lies inside a path belongs to that place; occupied-area cells are -2; others -1`.
  - `a city marker takes the 4 cells nearest its point that belong to a non-city place`.
  - `every place gets at least one cell` (a path smaller than one cell gets the cell containing its first point).
  - `places carry total, per-resident value and rank by total desc (1 = largest); city = has a marker other than 04`.
  - With the real data (`loadMunicipalData` from CSV, as `tests/explorer/municipal*.test.ts` do): `64 places, every code from the list rows appears, none of 05/42/43/46/64`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Paths are `M`/`L`/`Z` polylines in viewBox units: split on `M`, read number pairs, even-odd point-in-polygon per cell centre. Tbilisi (`04`) is a shape, so it is not treated as a city column even though it has a marker.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(home): municipal relief places and dot grid`.

### Task 5: Sources, tools, sentences and `buildHomeChapters`

**Files:** Create `apps/web/lib/landing/chapters/sourcesAi.ts`, `apps/web/lib/landing/chapters/index.ts`; Test `apps/web/tests/landing/chapters/homeChapters.test.ts`.

**Interfaces:**
- Consumes: Tasks 1-4; `MethodologyHubEntry[]` (from `buildMethodologyHubEntries`), `TOOLS` (`lib/mcp/tools.ts`, names only), `message`.
- Produces: `buildSourceRows(entries: MethodologyHubEntry[], reviewedAt: string)`, `toolNames(): string[]`, `buildHomeChapters(input: HomeChaptersInput, presentation: Presentation): HomeChapters` where `HomeChaptersInput` holds the served inputs listed in Tasks 1-4 plus `methodologyEntries` and `updatedAt`.

- [ ] **Step 1: Failing tests:**
  - `source rows keep methodology order with title, coverage years and originalFileCount; totalFiles is their sum`.
  - `toolNames returns every TOOLS name in registry order` (length equals `TOOLS.length`).
  - Sentence tests with fixed numbers, ka locale: spending → `2025 წელს სახელმწიფო ბიუჯეტიდან 27.7 მილიარდი ლარი დაიხარჯა — ყველაზე მეტი სოციალურ დაცვაზე.`; revenue → `2025 წელს ნაერთი ბიუჯეტის შემოსულობებმა 32.4 მილიარდი ლარი შეადგინა: 79% გადასახადებიდან შემოვიდა, 9.6% — ვალდებულებების ზრდიდან.`; municipal → `64 მუნიციპალიტეტის 2025 წლის ბიუჯეტი 6.1 მილიარდი ლარია — მესამედზე მეტი, 2.1 მილიარდი, თბილისზე მოდის.`; deficit → `ზოგადი მთავრობის დეფიციტი 2025 წელს მშპ-ის 1.5% იყო; ყველაზე ღრმა — 9.2% — 2020 წელს, პანდემიის დროს.`
  - `the pandemic clause appears only when the deepest year is 2020`.
  - `the Tbilisi share phrase picks by share`: < 0.25 `მეოთხედზე ნაკლები`, < 1/3 `მეოთხედზე მეტი`, < 0.5 `მესამედზე მეტი`, else `ნახევარზე მეტი` (en: `less than a quarter`, `more than a quarter`, `more than a third`, `more than half`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement.** Largest spending field in the sentence uses a dative form message per field id, `landing.spendingField.{id}` (13 ka keys such as `სოციალურ დაცვაზე`; en uses the plain label "social protection"). Numbers: billions with one decimal, shares with `formatShare`-style rounding (tax share 0 decimals, liabilities 1). Sentence templates: `landing.sentence.{spending,revenue,municipal,deficit,deficitPandemic}`.
- [ ] **Step 4:** Run → PASS; `npm run i18n:check` → no errors.
- [ ] **Step 5: Commit** `feat(home): sources rows, tool list, chapter sentences`.

### Task 6: Chapter shell, reveal and canvas helpers

**Files:** Create `components/landing/chapters/{chapter.tsx,reveal.tsx,canvas.ts}` (under `apps/web`); Test `apps/web/tests/landing/chapters/canvas.test.ts`.

**Interfaces:**
- Produces:
  - `<Chapter id="ch-01" link={ChapterLink | null} title={string} lede={string} children />` (server component): 1.5px ink top rule, `h2` in `--font-display` `clamp(22px,2.2vw,30px)`, linked title with the accent `ArrowRight` after the last word wrapped in `white-space:nowrap`, hover hint (from 1200px), lede `p`; margins per spec §4.
  - `<Reveal>` (client): adds `data-in` once when 15% visible (IntersectionObserver); CSS in `globals.css` under a `.home-rv` class: opacity 0 → 1, translateY 16px → 0, `.9s cubic-bezier(.22,.7,.18,1)`; reduced motion shows immediately.
  - `useNearViewport(ref, rootMargin = "100% 0px"): boolean` (client hook in `reveal.tsx`): true once the element is within one screen; charts mount their dynamic chunk only then.
  - `canvas.ts`: `sizeCanvas(cv, w, h): CanvasRenderingContext2D` (dpr ≤ 2), `niceTicks(max, n)`, `fitText(ctx, s, maxW)`, `squarify(values, x, y, w, h): [number, number, number, number][]`, `stackLabels(want, gap, lo, hi)`, `prefersReducedMotion()`, `placeTip(el, x, y, w, h)` — ports of the board's `c2d`, `nice`, `fit`, `squarify`, `stackLabels`, `RM`, `tipCtl.show`.
- [ ] **Step 1: Failing tests** for the pure helpers: `squarify areas are proportional to values and fill the rectangle (sum of areas = w*h within 1e-6)`; `zero values get zero rectangles`; `niceTicks(32.4, 7)` top ≥ 32.4 with round steps; `stackLabels keeps gap and stays within [lo, hi]`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS; `npm run typecheck` → clean.
- [ ] **Step 5: Commit** `feat(home): chapter shell, reveal and canvas helpers`.

### Task 7: Chapter 01 squares chart

**Files:** Create `components/landing/chapters/scale-chapter.tsx` (client: buttons, readout, chart).

**Interfaces:** Consumes `ScaleChapter`, `useNearViewport`, `sizeCanvas`, `placeTip`. Produces `<ScaleChapter data labels />` where `labels` is a plain object of strings (`squareNote`, `ofGdp`, `cumulative`, `included`, `notIncluded`, `bnGel`).

- [ ] **Step 1:** Port `createScale` layout (rows 16-220 chosen so height ≤ 1.04 × clamp(0.56·W, 280, 520)), fill order (column-major from bottom-left), first-view fade, measure tween (1.1s ease-in-out, accent edge band), marker with `{share} of GDP`, tooltip per square. Measure buttons are real `<button aria-pressed>` with dot, name and value; readout in an `aria-live="polite"` region. Canvas `role="img"` with an `aria-label` naming the squares count and selected measure.
- [ ] **Step 2:** Verify in a local `next dev` page at 1440px and 375px: buttons switch the fill; reduced-motion emulation shows final state; no console errors.
- [ ] **Step 3: Commit** `feat(home): budget-next-to-economy squares chapter`.

### Task 8: Chapter 02 spending blocks

**Files:** Create `components/landing/chapters/spending-chapter.tsx`.

**Interfaces:** Consumes `SpendingSeries`, `squarify`, `useNearViewport`. Produces `<SpendingChapter data labels />`.

- [ ] **Step 1:** Port `createTree`: block area scaled by `sqrt(total[year] / max(total))`, anchored bottom-left; tones from `#26211b` to `#d6cab5` by latest-year rank, first six dark; dotted texture; labels when blocks fit (≥82×46 name+amount, +share when ≥64 tall; ≥44×24 share only); dashed frame plus `landing.spending.maxFrame` text when the year is not the largest; tween 520ms.
- [ ] **Step 2:** Controls: big year (with `landing.planned` suffix when `planned[i]`), total, play/pause `<button>` (Lucide `Play`/`Pause`, steps one year per 900ms from the first year, stops at the latest), `<input type="range">` with a `<label class="sr-only">`, total-spending sparkline under the slider. Side list of `<button>` rows with name, amount, share and a bar; hover/focus highlights the block.
- [ ] **Step 3:** Verify locally: slider and play change year, list and blocks; keyboard arrows move the slider; no console errors.
- [ ] **Step 4: Commit** `feat(home): spending chapter with year control`.

### Task 9: Sources and Ask AI sections

**Files:** Create `components/landing/chapters/{sources-section.tsx,ai-section.tsx,copy-endpoint.tsx}`; Test `apps/web/tests/landing/chapters/copyEndpoint.test.ts`, `apps/web/tests/landing/chapters/sourcesSection.test.tsx`.

**Interfaces:** Consumes `HomeChapters["sources"]`, `tools`. Produces `<SourcesSection>` (server, `id="sources"`), `<AiSection>` (server, `id="ai"`), `<CopyEndpoint url="https://fiscal.ge/mcp" copyLabel copiedLabel />` (client), and the pure `copyOrSelect(text: string, clipboard: Pick<Clipboard, "writeText"> | undefined, select: () => void): Promise<"copied" | "selected">` in `copy-endpoint.tsx`.

- [ ] **Step 1: Failing tests** (the repo has no DOM test library; components are checked with `renderToStaticMarkup` as in `tests/explorer/chartFrame.test.tsx`): `copyOrSelect resolves "copied" after writeText`; `copyOrSelect calls select and resolves "selected" when writeText rejects or clipboard is undefined`; `SourcesSection renders one row per source with years and file count, the total and the methodology link`.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement `CopyEndpoint`. Sources: four steps as an `<ol>` (copy `landing.sourceStep{1-4}Title/Text` from the board), coverage rows on a 1990-2030 axis with bars `left = (max(1990, first) − 1990)/40`, `width = (last + 1 − max(1990, first))/40`, "from 1960"-style tag when first < 1990, file count right, total row. AI band: full-bleed `#1e1b16` with the board's grain and colours (`.fx-ai*` CSS), facts, tool chips from `tools`, CTA to `/connect`, the five-node "how it works" card. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(home): sources and Ask AI sections`.

### Task 10: Chapters 03 and 05 charts

**Files:** Create `components/landing/chapters/{revenue-chart.tsx,deficit-chart.tsx}`.

**Interfaces:** Consume `RevenueSeries` / `DeficitChapter`, canvas helpers. Produce `<RevenueChart data labels />`, `<DeficitChart data labels />`.

- [ ] **Step 1:** Revenue: port `createRev` (stacked areas with paper separators, y ticks via `niceTicks`, x labels at first year, every 4th and last; right-hand labels with `stackLabels` when ≥620px wide, share-only otherwise; callout at `peakBorrowing`; hover guide with dots; tooltip rows top band first, `—` for null). Legend above the chart in HTML.
- [ ] **Step 2:** Deficit: port `createDef` (bars from 1995 to last year, ink deficits, `--positive` surpluses, projection band from `projectionFrom` at 40% opacity with `landing.deficit.imf` label, dashed accent −3% line and label, labels on `deepest` and `earlier`, bracket over `surplusRun` with `landing.deficit.surplusRun` text). Legend in HTML.
- [ ] **Step 3:** Verify locally at 1440px and 375px; tooltips show correct years; no console errors.
- [ ] **Step 4: Commit** `feat(home): revenue and deficit charts`.

### Task 11: Chapter 04 municipal relief

**Files:** Create `components/landing/chapters/municipal-relief.tsx`.

**Interfaces:** Consumes `MunicipalChapter`, `useNearViewport`. Produces `<MunicipalRelief data labels />`.

- [ ] **Step 1:** Port `createMuni` with `glPoints` / `soft2d` fallback and the camera helpers: dots per grid cell, height ∝ place `totalGel` (Tbilisi capped as the board's `MU_SMAX`), city columns, occupied cells flat grey, slow drift, labels for the top three places by total, hover tooltip (name, total, per resident, rank). Stage heights 640 / 500 (<900px) / 330px (<600px), full-bleed.
- [ ] **Step 2:** Stop the animation loop when off screen (IntersectionObserver) or `document.hidden`; release GL buffers on unmount; reduced motion renders one still frame.
- [ ] **Step 3:** Verify locally: WebGL path renders; with `getContext('webgl')` forced to null in DevTools the 2D fallback renders; no console errors.
- [ ] **Step 4: Commit** `feat(home): municipal budget relief`.

### Task 12: Footer variant

**Files:** Modify `apps/web/components/site/site-footer-view.tsx`, `apps/web/components/site/site-footer.tsx`, `lib/pages/{about,connect,methodology,methodology-article}.tsx`; messages `common.json` (ka, en); Test `apps/web/tests/site/siteFooter.test.tsx`.

**Interfaces:** `SiteFooterView({ ..., variant?: "compact" | "site" })`, default `"compact"` = today's markup unchanged. `SiteFooter` passes `variant="site"` through from a new optional prop; the four site pages and the homepage pass it; `ExplorerFooter` does not.

- [ ] **Step 1: Failing tests** (`renderToStaticMarkup`): `default variant renders today's markup` (inline snapshot of current output, captured before the change); `site variant shows the mission sentence, info@fiscal.ge, a "data" list with every DATASET_HUBS entry and a "platform" list with methodology, AI connection, about and the other language`.
- [ ] **Step 2:** Run → FAIL (site variant). **Step 3:** Implement the site variant from the board's `.fx-foot*` CSS (logo 220px; grid of three on desktop; phones one column with two-column 44px link rows). Messages `common.footerMission`, `common.footerData`, `common.footerPlatform`. **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `feat(site): larger footer for the homepage and site pages`.

### Task 13: Assemble the homepage and remove the old sections

**Files:** Modify `apps/web/lib/pages/home.tsx`, `apps/web/components/landing/landing-page.tsx`, `apps/web/lib/landing/landingData.ts`, `apps/web/app/globals.css`, messages; Delete `components/landing/landing-dataset-section.tsx`, `components/landing/landing-fiscal-sections.tsx`, `lib/landing/landingDatasets.ts`, `tests/landing/landingDatasets.test.ts`; Update `tests/landing/landingData.test.ts`, `tests/i18n/landingPresentation.test.ts`, `tests/site/linkPrefetch.test.ts` where they reference removed code.

**Interfaces:** `renderHomePage` additionally loads `loadServedForeignInvestmentData()`, `loadServedMoneyTransfersData()`, `loadGeneratedArchiveSummaries(repositoryRoot)` (as `lib/pages/methodology.tsx` does), calls `buildMunicipalListRows` for `MUNICIPAL_PER_RESIDENT_YEAR`, then `buildHomeChapters`. `LandingPage({ chapters, gdpFigure, presentation, updatedAt })`.

- [ ] **Step 1:** Wire the order of spec §3. Each chart is imported with `next/dynamic(..., { ssr: false })` inside a small client wrapper that renders the chart only when `useNearViewport` is true, with a fixed-height placeholder so layout does not shift; if the chunk fails to load the placeholder shows `landing.chartUnavailable` (`ვიზუალი ვერ ჩაიტვირთა — მონაცემები ხელმისაწვდომია ექსპლორერში`). Chapter copy keys: `landing.ch{1..5}.title`, `.hint`, plus `landing.ch1.lede` (`ყოველი კვადრატი 10 მილიონი ლარია.`), `landing.sources.*`, `landing.ai.*`, using the board's Georgian text.
- [ ] **Step 2:** Remove `buildLandingDatasetLinks`, the ledger summaries (`buildNationalSummary`, `buildMunicipalSummary`, `buildDebtSummary`, `buildDeficitSummary`) and their types and messages only where nothing else imports them (`rg` each name first; `buildLandingContext` stays for Methodology). Keep `landing.portal`, `landing.heading`, `landing.explore`, hero and country-number keys.
- [ ] **Step 3:** `npx vitest run tests/landing tests/i18n tests/site` → PASS; `npm run typecheck` and `npm run lint` → clean; `npm run i18n:check` → no errors.
- [ ] **Step 4:** `npx next dev` smoke check of `/` and `/en` at 1440 and 375px: no console errors, no horizontal scroll.
- [ ] **Step 5: Commit** `feat(home): new homepage chapters replace the ledger sections`.

### Task 14: Browser tests, design doc and proofread list

**Files:** Modify `apps/web/tests/browser/landing.spec.ts` (remove tests for the dataset row, ledger tables and old methodology block; keep hero, header, font and focus tests), `tests/browser/{bilingual-content,accessibility-polish,mobile-site-menu,methodology,connect}.spec.ts` only where they assert the old footer or removed sections; `DESIGN.md` §19; Create `/mnt/project-files/homepage-redesign/notes-for-duru.md`.

- [ ] **Step 1: New browser tests in `landing.spec.ts`:**
  - `homepage sections appear in the approved order` (ka and en): `#ch-01 … #ch-05, #sources, #ai`, then `footer[data-variant=site]`.
  - `chapter headings link to their explorer pages` (five hrefs, both locales).
  - `choosing a measure updates the readout` (click debt → readout shows its billions and share).
  - `the year slider and play button change the spending year` (set range to the first year → big year shows it; play → year advances within 2s).
  - `reduced motion shows final states` (emulate; chapter content visible without scrolling delay; squares readout shows default measure).
  - `no horizontal overflow at 375 and 390px` (`document.documentElement.scrollWidth <= innerWidth`).
  - `site footer on /, /methodology, /connect, /about; compact footer on /explorer/expenditure`.
  - `no console errors or warnings while scrolling the whole page`.
- [ ] **Step 2:** Build and serve once (CLAUDE.md recipe, port 3100); run `CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/landing.spec.ts` → all pass.
- [ ] **Step 3:** Rewrite `DESIGN.md` §19 for the new order, chapter shell, each chart, revenue palette, AI band and the two footer variants. Write the proofread list (every new ka and en string, grouped by section).
- [ ] **Step 4: Commit** `test(home): browser coverage for the redesigned homepage; docs`.

### Task 15: Preview for Duru, then delivery

- [ ] **Step 1:** With the 3100 server, screenshot `/` and `/en` at 1440×900 (full page) and 375×812 into `/mnt/project-files/homepage-redesign/screenshots/` (Chromium via `executablePath: '/opt/pw-browsers/chromium'` if the bundled one is missing). Stop the server group.
- [ ] **Step 2:** Post the screenshots and a decision card ("Clickable preview" / "Screenshots are enough" / "Looks good, go ahead"). Push the branch only for a preview after Duru picks it; no PR.
- [ ] **Step 3:** After Duru's OK: merge `origin/main`, run `npm run check`, `npm run build`, `npm run test:browser` (full, against the built server), open the PR with the attribution block, assign and request review from DuruMakh, subscribe to PR activity, and merge only on Duru's go once CI is green.
