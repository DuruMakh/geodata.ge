# Fiscal.ge Homepage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Fiscal.ge homepage paths/cards with the approved latest-year expenditure, revenue, municipality, and methodology composition while preserving the living-relief hero and existing data, SEO, and accessibility contracts.

**Architecture:** Extend the server-side landing model with three compact data-derived summaries while keeping the municipal loader separate and processing its full corpus before rendering. The landing server component renders a shared editorial dataset-section component three times, so only the latest year, total, four rows, and shares reach the page; no new client data payload or visualization dependency is introduced.

**Tech Stack:** Next.js 16 App Router, React 19 Server Components, strict TypeScript, Tailwind CSS v4, Vitest 4, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-08-23-fiscal-ge-homepage-redesign-design.md`

## Global Constraints

- Keep the current v1 scope: national expenditure, national revenue, municipal budgets, and methodology only.
- Preserve the warm editorial system and existing living-relief hero; do not introduce shadcn, cards, shadows, a new visualization library, or another post-hero graphic.
- Exact hero copy is `საქართველოს მონაცემების პლატფორმა`, `საქართველო ციფრებში`, and `გაეცანი მონაცემებს`.
- Keep area at `69.7 ათ. კმ²` and nominal GDP at `104.6 მლრდ ₾`; update only population to `3.9 მლნ` with `2026 წლის 1 იანვარი · საქსტატი`.
- Post-hero order is expenditure → revenue → municipalities → methodology → existing footer.
- Each data section renders only its independently derived latest year, one prominent applicable total, and exactly four latest-year rows when the reviewed corpus supplies at least four.
- Apply `chooseActivePublicFacts` before national year, amount, total, or basis calculations; actual wins over planned.
- Municipal headline total comes from the latest `country.georgia` `countryTotalFacts` row; top municipalities come from public `totalFacts` and use the country total as their share denominator.
- Keep excluded municipality codes excluded and rank all eligible municipalities, not only self-governing cities.
- Use existing `formatAmount` and `formatShare`; do not copy prototype precision or hardcode current budget values, years, category labels, or municipality names.
- Shared public-header label is `მონაცემები` linking to `/explorer`; methodology and About routes keep no active nav item.
- Revenue page title is `როგორ ფინანსდება საქართველოს ბიუჯეტი`; canonical term `შემოსავლები` and accurate SEO search language remain valid.
- Keep one H1, use H2 for the three datasets and methodology, semantic tables, real links, reduced-motion behavior, and visible keyboard focus.
- At 320px, 390px, and desktop widths the document must not overflow horizontally; post-hero tables must fit their parents.
- Preserve the existing canonical host, social metadata, sitemap, robots, JSON-LD, footer trust/licence content, and static build.
- Add no dependency, route, data file, public API, future-indicator content, English localization, or analytics vendor.

## File Map

- Modify `apps/web/lib/landing/landingData.ts` — derive compact latest-year national and municipal summaries and remove the superseded sparkline/waffle/Excel-preview model after the UI switches.
- Modify `apps/web/tests/landing/landingData.test.ts` — prove precedence, latest-year selection, totals, ranking, shares, labels, tie-breaks, and missing-row behavior with literal fixtures.
- Modify `apps/web/app/page.tsx` — load landing and municipal data concurrently, pass only the compact server-built model, and align the homepage metadata description.
- Create `apps/web/components/landing/landing-dataset-section.tsx` — render one accessible, responsive dataset ledger from a `LandingDatasetSummary`.
- Modify `apps/web/components/landing/landing-page.tsx` — keep the hero, update hero/stat copy, render the three summaries and one methodology block, and retain the footer.
- Delete `apps/web/components/methodology/methodology-promo.tsx` — it becomes unused when the duplicated landing promotion is removed.
- Modify `apps/web/components/site/site-header.tsx` — change only the shared public nav label to `მონაცემები`.
- Modify `apps/web/components/main-explorer/main-explorer.tsx` — change only the revenue editorial H1 wording.
- Modify `apps/web/tests/browser/landing.spec.ts` — replace obsolete cards/graphics assertions with desktop, semantic, navigation, metadata, and 390px/320px layout coverage.
- Modify `apps/web/tests/browser/methodology.spec.ts` — verify `მონაცემები` on methodology and About headers with no false active state.
- Modify `apps/web/tests/browser/main-explorer.spec.ts` — protect the revised revenue H1 at every existing assertion point.
- Modify `DESIGN.md` sections 7.1, 11, and 19 — make the canonical production visual/copy contract agree with the approved spec.
- Retain `apps/web/components/site/site-footer.tsx`, all reviewed data files, and all SEO helpers unchanged.

## Execution Preflight

The planning checkout was detached at `462e8db7f140ed481a05554d9e51e8fdb57237cf`. At execution time, use `superpowers:using-git-worktrees` to create or select an isolated worktree on `codex/homepage-redesign`; do not implement on detached `HEAD` and do not overwrite unrelated local work.

- [ ] **Step 1: Verify the execution checkout**

Run from the repository root:

```powershell
git status --short --branch
git rev-parse HEAD
git branch --show-current
```

Expected: branch is `codex/homepage-redesign`, the starting commit is the approved current `origin/main`, and the only initial changes are the approved spec and this plan. If `origin/main` has advanced, inspect the diff before rebasing the plan's line references; do not assume `462e8db7f` is still current.

- [ ] **Step 2: Preserve the approved documents first**

```powershell
git add docs/superpowers/specs/2026-08-23-fiscal-ge-homepage-redesign-design.md docs/superpowers/plans/2026-08-23-fiscal-ge-homepage-redesign.md
git diff --cached --check
git commit -m "docs: approve homepage redesign"
```

Expected: one documentation-only commit containing the approved spec and implementation plan.

---

### Task 1: Derive the three latest-year homepage summaries

**Files:**
- Modify: `apps/web/tests/landing/landingData.test.ts`
- Modify: `apps/web/lib/landing/landingData.ts`
- Modify: `apps/web/app/page.tsx`

**Interfaces:**
- Consumes: `ServedBudgetFact[]`, `Map<string, GlossaryEntry>`, `SourceDocumentRow[]`, `Municipality[]`, public municipal `MunicipalTotalFact[]`, and Georgia `MunicipalTotalFact[]`.
- Produces: `LandingBasisStatus`, `LandingSummaryRow`, `LandingDatasetSummary`, and `LandingModel` fields `expenditure`, `revenue`, `municipalities`, and `commonLatestYear`.
- Final builder signature: `buildLandingModel(input: BuildLandingModelInput): LandingModel`, where municipal inputs are named `municipalities`, `municipalTotalFacts`, and `municipalCountryTotalFacts`.

- [ ] **Step 1: Replace the obsolete visual-model fixtures with literal summary fixtures**

In `apps/web/tests/landing/landingData.test.ts`, replace the sparkline, waffle, and Excel-preview fixture with served-row fixtures. Use the real final types and a complete municipal-total helper:

```ts
import { describe, expect, it } from "vitest";
import type { GlossaryEntry } from "../../lib/data/glossary";
import type { Municipality, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import type { ServedBudgetFact } from "../../lib/servedRows";
import { buildLandingModel } from "../../lib/landing/landingData";

function glossaryEntry(id: string, kaLabel: string): [string, GlossaryEntry] {
  return [id, { id, kaLabel, enLabel: id, description: "", notes: "" }];
}

const glossary = new Map<string, GlossaryEntry>([
  glossaryEntry("spending.alpha", "ალფა"),
  glossaryEntry("spending.beta", "ბეტა"),
  glossaryEntry("spending.gamma", "გამა"),
  glossaryEntry("spending.delta", "დელტა"),
  glossaryEntry("spending.epsilon", "ეფსილონი"),
  glossaryEntry("revenue.alpha", "შემოსავალი ა"),
  glossaryEntry("revenue.beta", "შემოსავალი ბ"),
  glossaryEntry("revenue.gamma", "შემოსავალი გ"),
  glossaryEntry("revenue.delta", "შემოსავალი დ"),
  glossaryEntry("revenue.epsilon", "შემოსავალი ე"),
  glossaryEntry("spending.missing", "მონაცემის გარეშე"),
]);

const sourceDocuments: SourceDocumentRow[] = [
  { sourceId: "source.a", sourceName: "A", sourceUrlOrFile: "docs/a", lastReviewedAt: "2026-05-10" },
  { sourceId: "source.b", sourceName: "B", sourceUrlOrFile: "docs/b", lastReviewedAt: "2026-06-01" },
];

const facts: ServedBudgetFact[] = [
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 400, basis: "planned", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.alpha", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.beta", amountGel: 40, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.gamma", amountGel: 30, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.delta", amountGel: 20, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "spending.epsilon", amountGel: 10, basis: "actual", sourceId: "source.a" },
  { year: 2025, side: "expenditure", itemId: "expenditure.total", amountGel: 999, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "expenditure", itemId: "expenditure.total", amountGel: 1_100, basis: "actual", sourceId: "source.a" },
  { year: 2004, side: "revenue", itemId: "revenue.alpha", amountGel: 1, basis: "actual", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.alpha", amountGel: 50, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.beta", amountGel: 20, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.gamma", amountGel: 15, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.delta", amountGel: 10, basis: "planned", sourceId: "source.a" },
  { year: 2024, side: "revenue", itemId: "revenue.epsilon", amountGel: 5, basis: "planned", sourceId: "source.a" },
  { year: 2026, side: "revenue", itemId: "revenue.total", amountGel: 120, basis: "actual", sourceId: "source.a" },
];

const municipalities: Municipality[] = [
  { code: "10", sortId: 10, nameKa: "არაქალაქი", displayNameKa: "არაქალაქი", regionId: "region.a", isSelfGoverningCity: false },
  { code: "11", sortId: 11, nameKa: "ქალაქი", displayNameKa: "ქალაქი", regionId: "region.a", isSelfGoverningCity: true },
  { code: "12", sortId: 12, nameKa: "მუნიციპალიტეტი 12", displayNameKa: "მუნიციპალიტეტი 12", regionId: "region.b", isSelfGoverningCity: false },
  { code: "13", sortId: 13, nameKa: "მუნიციპალიტეტი 13", displayNameKa: "მუნიციპალიტეტი 13", regionId: "region.b", isSelfGoverningCity: false },
  { code: "14", sortId: 14, nameKa: "მუნიციპალიტეტი 14", displayNameKa: "მუნიციპალიტეტი 14", regionId: "region.c", isSelfGoverningCity: false },
  { code: "15", sortId: 15, nameKa: "ფაქტის გარეშე", displayNameKa: "ფაქტის გარეშე", regionId: "region.c", isSelfGoverningCity: false },
];

function municipalTotal(year: number, municipalityCode: string, publicTotalGel: number): MunicipalTotalFact {
  return {
    year,
    municipalityCode,
    publicTotalGel,
    publicTotalMeasure: "total_payments",
    totalPaymentsGel: publicTotalGel,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel: publicTotalGel,
    reconciliationDifferenceGel: null,
    warningAmountGel: null,
    showWarning: false,
    warningType: "none",
    basis: "actual",
    sourceId: "source.municipal",
  };
}

const municipalTotalFacts = [
  municipalTotal(2026, "11", 250),
  municipalTotal(2026, "10", 250),
  municipalTotal(2026, "12", 200),
  municipalTotal(2026, "13", 150),
  municipalTotal(2026, "14", 100),
];

const municipalCountryTotalFacts = [municipalTotal(2025, "country.georgia", 900), municipalTotal(2026, "country.georgia", 1_000)];
```

- [ ] **Step 2: Write failing summary-contract tests**

Add these assertions. They intentionally prove that a non-city can rank first, equal amounts use stable IDs, explicit totals stay out of ranking rows but remain the applicable total, a total-only future year does not advance a section, planned duplicates lose to actuals, and absent facts do not become zero rows:

```ts
describe("landing model", () => {
  const model = buildLandingModel({
    facts,
    glossary,
    sourceDocuments,
    municipalities,
    municipalTotalFacts,
    municipalCountryTotalFacts,
  });

  it("uses the active explicit total for the latest detail year", () => {
    expect(model.expenditure).toMatchObject({ latestYear: 2025, totalGel: 999, basis: "mixed" });
    expect(model.expenditure.rows.map((row) => row.id)).toEqual([
      "spending.alpha",
      "spending.beta",
      "spending.gamma",
      "spending.delta",
    ]);
    expect(model.expenditure.rows[0]).toMatchObject({ labelKa: "ალფა", amountGel: 40 });
    expect(model.expenditure.rows[0]!.share).toBeCloseTo(40 / 999);
  });

  it("falls back to the latest detail sum when an explicit total is absent", () => {
    expect(model.revenue).toMatchObject({ latestYear: 2024, totalGel: 100, basis: "planned" });
    expect(model.revenue.rows).toHaveLength(4);
  });

  it("keeps shared context and independently derived latest years", () => {
    expect(model.yearsLabel).toBe("2004–2024");
    expect(model.updatedAt).toBe("2026-06-01");
    expect(model.commonLatestYear).toBeNull();
  });

  it("uses the Georgia aggregate and ranks every eligible municipality", () => {
    expect(model.municipalities).toMatchObject({ latestYear: 2026, totalGel: 1_000, basis: "actual" });
    expect(model.municipalities.rows.map((row) => row.id)).toEqual(["10", "11", "12", "13"]);
    expect(model.municipalities.rows[0]).toEqual({
      id: "10",
      labelKa: "არაქალაქი",
      amountGel: 250,
      share: 0.25,
    });
    expect(model.municipalities.rows.some((row) => row.id === "15")).toBe(false);
  });
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run from `apps/web`:

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
```

Expected: FAIL because `buildLandingModel` does not accept municipal inputs and the four summary fields do not exist.

- [ ] **Step 4: Add the final summary interfaces and builders**

In `apps/web/lib/landing/landingData.ts`, add these imports and types. Keep the current legacy sparkline/waffle/Excel fields only through this task so the old landing component remains compilable; Task 2 removes them immediately after switching the UI.

```ts
import {
  MUNICIPAL_COUNTRY_ID,
  type Municipality,
  type MunicipalTotalFact,
} from "../data/municipal/types";

export type LandingBasisStatus = "actual" | "planned" | "mixed";

export type LandingSummaryRow = {
  id: string;
  labelKa: string;
  amountGel: number;
  share: number;
};

export type LandingDatasetSummary = {
  latestYear: number;
  totalGel: number;
  basis: LandingBasisStatus;
  rows: LandingSummaryRow[];
};
```

Append these final fields to `LandingModel`:

```ts
expenditure: LandingDatasetSummary;
revenue: LandingDatasetSummary;
municipalities: LandingDatasetSummary;
commonLatestYear: number | null;
```

Extend `BuildLandingModelInput` exactly as follows:

```ts
type BuildLandingModelInput = {
  facts: ServedBudgetFact[];
  glossary: Map<string, GlossaryEntry>;
  sourceDocuments: SourceDocumentRow[];
  municipalities: Municipality[];
  municipalTotalFacts: MunicipalTotalFact[];
  municipalCountryTotalFacts: MunicipalTotalFact[];
};
```

Add these pure helpers above `buildLandingModel`:

```ts
function basisStatus(rows: ServedBudgetFact[]): LandingBasisStatus {
  const hasActual = rows.some((row) => row.basis === "actual");
  const hasPlanned = rows.some((row) => row.basis === "planned");
  return hasActual && hasPlanned ? "mixed" : hasPlanned ? "planned" : "actual";
}

function buildNationalSummary(
  activeFacts: ServedBudgetFact[],
  glossary: Map<string, GlossaryEntry>,
  side: ServedBudgetFact["side"],
): LandingDatasetSummary {
  const detailFacts = activeFacts.filter((fact) => fact.side === side && !isDerivedTotalItemId(fact.itemId));
  const latestYear = detailFacts.map((fact) => fact.year).sort((left, right) => left - right).at(-1) ?? 0;
  const latestFacts = detailFacts.filter((fact) => fact.year === latestYear);
  const totalId = side === "revenue" ? "revenue.total" : "expenditure.total";
  const explicitTotal = activeFacts.find((fact) => fact.year === latestYear && fact.itemId === totalId);
  const totalGel = explicitTotal?.amountGel ?? latestFacts.reduce((sum, fact) => sum + fact.amountGel, 0);

  return {
    latestYear,
    totalGel,
    basis: basisStatus(explicitTotal ? [...latestFacts, explicitTotal] : latestFacts),
    rows: latestFacts
      .slice()
      .sort((left, right) => right.amountGel - left.amountGel || left.itemId.localeCompare(right.itemId))
      .slice(0, 4)
      .map((fact) => ({
        id: fact.itemId,
        labelKa: glossary.get(fact.itemId)?.kaLabel ?? fact.itemId,
        amountGel: fact.amountGel,
        share: fact.amountGel / totalGel,
      })),
  };
}

function buildMunicipalSummary(
  municipalities: Municipality[],
  municipalTotalFacts: MunicipalTotalFact[],
  municipalCountryTotalFacts: MunicipalTotalFact[],
): LandingDatasetSummary {
  const countryTotal = municipalCountryTotalFacts
    .filter((fact) => fact.municipalityCode === MUNICIPAL_COUNTRY_ID)
    .slice()
    .sort((left, right) => left.year - right.year)
    .at(-1)!;
  const labels = new Map(municipalities.map((municipality) => [municipality.code, municipality.displayNameKa]));

  return {
    latestYear: countryTotal.year,
    totalGel: countryTotal.publicTotalGel,
    basis: "actual",
    rows: municipalTotalFacts
      .filter((fact) => fact.year === countryTotal.year && labels.has(fact.municipalityCode))
      .slice()
      .sort(
        (left, right) =>
          right.publicTotalGel - left.publicTotalGel || left.municipalityCode.localeCompare(right.municipalityCode),
      )
      .slice(0, 4)
      .map((fact) => ({
        id: fact.municipalityCode,
        labelKa: labels.get(fact.municipalityCode)!,
        amountGel: fact.publicTotalGel,
        share: fact.publicTotalGel / countryTotal.publicTotalGel,
      })),
  };
}
```

Inside `buildLandingModel`, call `chooseActivePublicFacts(facts)` once, keep derived totals out of the lightweight landing context, and pass all active facts to the national summaries so they can apply explicit-total precedence:

```ts
const active = chooseActivePublicFacts(facts);
const context = buildLandingContextFromActive(
  active.filter((fact) => !isDerivedTotalItemId(fact.itemId)),
  sourceDocuments,
);
const expenditure = buildNationalSummary(active, glossary, "expenditure");
const revenue = buildNationalSummary(active, glossary, "revenue");
const municipalSummary = buildMunicipalSummary(
  municipalities,
  municipalTotalFacts,
  municipalCountryTotalFacts,
);
const commonLatestYear =
  expenditure.latestYear === revenue.latestYear && revenue.latestYear === municipalSummary.latestYear
    ? expenditure.latestYear
    : null;
```

Return them as `expenditure`, `revenue`, `municipalities: municipalSummary`, and `commonLatestYear`.

- [ ] **Step 5: Load municipal data concurrently on the server**

Change `apps/web/app/page.tsx` imports and `Home` body to:

```tsx
import { loadServedLandingData, loadServedMunicipalData } from "../lib/data/servedData";

export default async function Home() {
  const [landingData, municipalData] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
  ]);
  const model = buildLandingModel({
    ...landingData,
    municipalities: municipalData.municipalities,
    municipalTotalFacts: municipalData.totalFacts,
    municipalCountryTotalFacts: municipalData.countryTotalFacts,
  });

  return <LandingPage model={model} />;
}
```

Do not add municipal rows to `LandingData` or `ExplorerData`. `LandingPage` remains a Server Component and receives only `LandingModel`.

- [ ] **Step 6: Run the focused test and typecheck for GREEN**

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run typecheck
```

Expected: the landing model tests pass, and TypeScript confirms the existing UI still compiles with the temporarily retained legacy fields.

- [ ] **Step 7: Commit the data-derived summary boundary**

```powershell
git add apps/web/lib/landing/landingData.ts apps/web/tests/landing/landingData.test.ts apps/web/app/page.tsx
git diff --cached --check
git commit -m "feat: derive homepage dataset summaries"
```

---

### Task 2: Build the approved responsive homepage composition

**Files:**
- Modify: `apps/web/tests/browser/landing.spec.ts`
- Create: `apps/web/components/landing/landing-dataset-section.tsx`
- Modify: `apps/web/components/landing/landing-page.tsx`
- Delete: `apps/web/components/methodology/methodology-promo.tsx`
- Modify: `apps/web/lib/landing/landingData.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `DESIGN.md` section 19

**Interfaces:**
- Consumes: `LandingDatasetSummary` from Task 1 and existing `SiteHeader`, `HeroReliefLazy`, `SiteFooter`, `formatAmount`, and `formatShare`.
- Produces: `LandingDatasetSection(props: LandingDatasetSectionProps)` and test hooks `landing-data`, `landing-dataset-{kind}`, `landing-dataset-index`, `landing-dataset-copy`, `landing-dataset-data`, `landing-dataset-total`, and `landing-methodology`.
- Removes: `ExcelPreview`, sparkline fields, waffle fields, Excel-preview fields, their constants/calculations, `PathCardLabel`, `PathCardLink`, and the orphaned `MethodologyPromo` component.

- [ ] **Step 1: Replace browser expectations with the approved page contract**

Keep the existing screenshot helper and WebGL canvas/fallback check. Add these helpers to `apps/web/tests/browser/landing.spec.ts`:

```ts
async function expectNoPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(width.scroll).toBe(width.client);
}

async function expectDatasetTableFits(page: Page, testId: string) {
  const section = page.getByTestId(testId);
  await expect(section.locator("tbody tr")).toHaveCount(4);
  const geometry = await section.locator("table").evaluate((table) => {
    const tableBox = table.getBoundingClientRect();
    const parentBox = table.parentElement!.getBoundingClientRect();
    return { tableLeft: tableBox.left, tableRight: tableBox.right, parentLeft: parentBox.left, parentRight: parentBox.right };
  });
  expect(geometry.tableLeft).toBeGreaterThanOrEqual(geometry.parentLeft);
  expect(geometry.tableRight).toBeLessThanOrEqual(geometry.parentRight + 0.5);
}
```

Replace the obsolete desktop test with:

```ts
test("landing renders the approved latest-year data composition", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(baseUrl);

  await expect(page).toHaveTitle("საქართველოს ბიუჯეტი და მუნიციპალური მონაცემები | Fiscal.ge");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("საქართველო ციფრებში");
  await expect(page.getByText("საქართველოს მონაცემების პლატფორმა", { exact: true })).toBeVisible();
  await expect(page.getByTestId("hero-cta")).toHaveText("გაეცანი მონაცემებს");
  await expect(page.getByTestId("hero-cta")).toHaveAttribute("href", "#data");
  await expect(page.locator("figure canvas").or(page.getByText("ვიზუალი ვერ ჩაიტვირთა"))).toBeVisible({ timeout: 15_000 });

  const figures = page.getByTestId("key-numbers");
  await expect(figures).toContainText("3.9");
  await expect(figures).toContainText("2026 წლის 1 იანვარი · საქსტატი");
  await expect(figures).toContainText("69.7");
  await expect(figures).toContainText("104.6");

  const orderedHeadings = await page.locator("#data h2").allTextContents();
  expect(orderedHeadings).toEqual([
    "როგორ იხარჯება საქართველოს ბიუჯეტი",
    "როგორ ფინანსდება საქართველოს ბიუჯეტი",
    "როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები",
    "მეთოდოლოგია და პირველწყაროები",
  ]);
  await expect(page.getByTestId("landing-data-header")).toContainText("ბოლო ხელმისაწვდომი წელი · 2025");

  for (const testId of [
    "landing-dataset-expenditure",
    "landing-dataset-revenue",
    "landing-dataset-municipalities",
  ]) {
    const section = page.getByTestId(testId);
    await expect(section.getByTestId("landing-dataset-total")).toBeVisible();
    await expect(section.locator("tbody tr")).toHaveCount(4);
    await expect(section.locator("tbody tr").first().getByRole("rowheader")).not.toBeEmpty();
    await expect(section.locator("tbody tr").first().getByRole("cell")).toHaveCount(2);
    const latestYear = await section.getByTestId("landing-dataset-total").locator("strong").textContent();
    await expect(section.locator("thead th").nth(1)).toHaveText(latestYear!);
  }

  await expect(page.getByTestId("landing-dataset-expenditure").getByRole("link")).toHaveAttribute("href", "/explorer/expenditure");
  await expect(page.getByTestId("landing-dataset-revenue").getByRole("link")).toHaveAttribute("href", "/explorer/revenue");
  await expect(page.getByTestId("landing-dataset-municipalities").getByRole("link")).toHaveAttribute("href", "/explorer/municipalities");
  await expect(page.getByText("უდიდესი მუნიციპალური ბიუჯეტები", { exact: true })).toBeVisible();
  await expect(page.getByTestId("landing-methodology").getByRole("link", { name: "მეთოდოლოგიის ნახვა →" })).toHaveAttribute("href", "/methodology");

  await expect(page.getByTestId("landing-data").locator("svg, canvas")).toHaveCount(0);
  await expect(page.getByTestId("three-paths")).toHaveCount(0);
  await expect(page.getByTestId("waffle-grid")).toHaveCount(0);
  await expect(page.getByTestId("excel-preview")).toHaveCount(0);
  await expect(page.getByTestId("methodology-promo")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "რა არის Fiscal.ge?" })).toHaveCount(0);

  const footer = page.getByTestId("landing-footer");
  await expect(footer.getByRole("link", { name: "info@fiscal.ge" })).toHaveAttribute("href", "mailto:info@fiscal.ge");
  await expect(footer).toContainText("CC BY 4.0");
  await capture(page, "landing-desktop");
});
```

Replace the old card-navigation test with direct-link coverage:

```ts
test("landing data and methodology links use real destinations", async ({ page }) => {
  await page.goto(baseUrl);
  await expect(page.getByTestId("landing-header").locator('a[href="/explorer"]')).toBeVisible();
  await page.getByTestId("hero-cta").click();
  await expect(page).toHaveURL(/\/#data$/);
  await expect(page.getByTestId("landing-data")).toBeInViewport();

  await page.getByTestId("landing-dataset-revenue").getByRole("link").click();
  await expect(page).toHaveURL(/\/explorer\/revenue/);
  await expect(page.getByTestId("explorer-shell")).toBeVisible();
});
```

Replace the mobile test with the two-width layout contract:

```ts
test("landing keeps stats and dataset tables inside narrow viewports", async ({ page }) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(baseUrl);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByTestId("key-numbers").locator("[data-country-stat]")).toHaveCount(3);
    await expectNoPageOverflow(page);

    for (const testId of [
      "landing-dataset-expenditure",
      "landing-dataset-revenue",
      "landing-dataset-municipalities",
    ]) {
      await expectDatasetTableFits(page, testId);
      const section = page.getByTestId(testId);
      const positions = await section.locator(
        '[data-testid="landing-dataset-index"], [data-testid="landing-dataset-copy"], [data-testid="landing-dataset-data"]',
      ).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top));
      expect(positions[1]).toBeGreaterThanOrEqual(positions[0]!);
      expect(positions[2]).toBeGreaterThanOrEqual(positions[1]!);
    }

    if (width === 320) {
      await expect(page.getByTestId("population-unit")).toHaveCSS("display", "block");
    }
    await capture(page, `landing-${width}`);
  }
});
```

Keep the existing footer/methodology-discovery assertion, but change it to expect the new `landing-methodology` section and the absence of `methodology-promo`.

- [ ] **Step 2: Run the focused browser file and verify RED**

```powershell
npm.cmd run test:browser -- tests/browser/landing.spec.ts
```

Expected: FAIL on the old H1, `3.7`, missing latest-year sections/test IDs, old cards/graphics, duplicated methodology promo, and narrow-width layout contract.

- [ ] **Step 3: Create the reusable accessible dataset ledger**

Create `apps/web/components/landing/landing-dataset-section.tsx` with this interface and structure:

```tsx
import Link from "next/link";
import { formatAmount, formatShare } from "../../lib/explorer/format";
import type { LandingBasisStatus, LandingDatasetSummary } from "../../lib/landing/landingData";

const STATUS_LABEL: Record<LandingBasisStatus, string> = {
  actual: "ფაქტობრივი შესრულება",
  planned: "გეგმა",
  mixed: "ფაქტი და გეგმა",
};

type LandingDatasetSectionProps = {
  kind: "expenditure" | "revenue" | "municipalities";
  index: "01" | "02" | "03";
  overline: string;
  heading: string;
  description: string;
  href: string;
  linkLabel: string;
  totalLabel: string;
  firstColumnLabel: string;
  summary: LandingDatasetSummary;
};

export function LandingDatasetSection({
  kind,
  index,
  overline,
  heading,
  description,
  href,
  linkLabel,
  totalLabel,
  firstColumnLabel,
  summary,
}: LandingDatasetSectionProps) {
  const headingId = `landing-${kind}-title`;

  return (
    <section
      data-testid={`landing-dataset-${kind}`}
      aria-labelledby={headingId}
      className="grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11"
    >
      <div data-testid="landing-dataset-index" aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]">
        {index}
      </div>
      <div data-testid="landing-dataset-copy" className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)]">{overline}</p>
        <h2 id={headingId} className="mt-2.5 text-balance font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16] tracking-[-0.015em]">
          {heading}
        </h2>
        <p className="mt-4 max-w-[470px] text-[13px] leading-[1.75] text-[var(--body)]">{description}</p>
        <Link href={href} className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222]">
          {linkLabel}
        </Link>
      </div>
      <div data-testid="landing-dataset-data" className="min-w-0">
        <div data-testid="landing-dataset-total" className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-y-2 border-[var(--ink)] py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{totalLabel}</p>
            <p className="mt-2 font-[family-name:var(--font-display)] text-[clamp(24px,5vw,42px)] font-semibold leading-none tracking-[-0.02em]">
              {formatAmount(summary.totalGel)}
            </p>
          </div>
          <div className="text-right">
            <span className="block text-[9px] uppercase tracking-[0.06em] text-[var(--faint)]">ბოლო ხელმისაწვდომი წელი</span>
            <strong className="mt-1 block font-[family-name:var(--font-numeric)] text-[18px]">{summary.latestYear}</strong>
            <span className="mt-1 block text-[10px] text-[var(--muted)]">{STATUS_LABEL[summary.basis]}</span>
          </div>
        </div>
        <div className="min-w-0 overflow-hidden">
          <table className="mt-3 w-full table-fixed text-[11px] max-[380px]:text-[10px]" aria-label={`${heading} — ${summary.latestYear}`}>
            <colgroup><col className="w-[52%]" /><col className="w-[30%]" /><col className="w-[18%]" /></colgroup>
            <thead className="text-[var(--muted)]">
              <tr className="border-b border-[var(--hairline-soft)]">
                <th scope="col" className="py-2 pr-2 text-left font-medium">{firstColumnLabel}</th>
                <th scope="col" className="px-1 py-2 text-right font-medium">{summary.latestYear}</th>
                <th scope="col" className="py-2 pl-1 text-right font-medium">წილი</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--hairline-soft)] last:border-b-0">
                  <th scope="row" className="break-words py-2.5 pr-2 text-left font-medium leading-snug">{row.labelKa}</th>
                  <td className="whitespace-nowrap px-1 py-2.5 text-right font-[family-name:var(--font-numeric)]">{formatAmount(row.amountGel)}</td>
                  <td className="whitespace-nowrap py-2.5 pl-1 text-right font-[family-name:var(--font-numeric)]">{formatShare(row.share)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
```

Do not add `"use client"`; this component is server-rendered.

- [ ] **Step 4: Replace the landing page body with the approved hierarchy**

In `apps/web/components/landing/landing-page.tsx`:

1. Remove the `MethodologyPromo` import, `ANALYSIS_HREF`, `PathCardLabel`, and `PathCardLink`.
2. Import `LandingDatasetSection`.
3. Replace `KEY_NUMBERS` with:

```ts
const KEY_NUMBERS = [
  { label: "მოსახლეობა", value: "3.9", unit: "მლნ", caption: "2026 წლის 1 იანვარი · საქსტატი", mobileCaption: "2026 · საქსტატი", unitTestId: "population-unit" },
  { label: "ფართობი", value: "69.7", unit: "ათ. კმ²", caption: "საქართველოს ტერიტორია", mobileCaption: "ტერიტორია", unitTestId: "area-unit" },
  { label: "ეკონომიკის ზომა", value: "104.6", unit: "მლრდ ₾", caption: "ნომინალური მშპ · 2025, წინასწარი", mobileCaption: "მშპ · 2025", unitTestId: "gdp-unit" },
] as const;
```

4. Keep `HERO_ARIA_LABEL` unchanged.
5. Replace the hero visible copy and link exactly:

```tsx
<p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--muted)] min-[768px]:text-[11px]">
  საქართველოს მონაცემების პლატფორმა
</p>
<h1 className="mt-2.5 text-pretty font-[family-name:var(--font-display)] text-[33px] font-semibold leading-[1.12] tracking-[-0.015em] min-[768px]:mt-3 min-[768px]:text-[30px] min-[1100px]:text-[40px]">
  საქართველო ციფრებში
</h1>
<Link href="#data" data-testid="hero-cta" className="text-[12px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4 hover:text-[#8F3222] min-[768px]:text-[12.5px]">
  გაეცანი მონაცემებს
</Link>
```

6. Use `h-[330px] min-[768px]:h-[500px] min-[1100px]:h-[clamp(560px,78vh,820px)]` for the hero figure so mobile becomes shorter without changing desktop behavior.
7. Render country figures as a fixed three-column row:

```tsx
<section data-testid="key-numbers" className="grid grid-cols-3 gap-3 border-t border-[var(--hairline-soft)] pt-[18px] min-[768px]:gap-8">
  {KEY_NUMBERS.map((entry) => (
    <div key={entry.label} data-country-stat className="min-w-0">
      <div className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] min-[768px]:text-[11px] min-[768px]:tracking-[0.08em]">{entry.label}</div>
      <div className="mt-2 font-[family-name:var(--font-display)] text-[clamp(22px,7vw,46px)] font-semibold leading-[1.05] tracking-[-0.02em]">
        {entry.value}{" "}
        <span data-testid={entry.unitTestId} className="text-[clamp(11px,3vw,25px)] max-[380px]:mt-1 max-[380px]:block">{entry.unit}</span>
      </div>
      <div className="mt-2 text-[9px] leading-snug text-[var(--muted)] min-[768px]:text-[12px]">
        <span className="hidden min-[381px]:inline">{entry.caption}</span>
        <span aria-hidden="true" className="min-[381px]:hidden">{entry.mobileCaption}</span>
        <span className="sr-only min-[381px]:hidden">{entry.caption}</span>
      </div>
    </div>
  ))}
</section>
```

8. Replace the old paths/About/promo region with one `main`-content wrapper using `id="data"` and `data-testid="landing-data"`. Render all three calls explicitly:

```tsx
<div id="data" data-testid="landing-data" className="mt-14 scroll-mt-4 border-t-2 border-[var(--ink)]">
  <div data-testid="landing-data-header" className="flex flex-wrap items-end justify-between gap-3 py-5">
    <p className="font-[family-name:var(--font-display)] text-[22px] font-semibold">საჯარო ფინანსების წლიური</p>
    <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">
      {model.commonLatestYear === null
        ? "ბოლო ხელმისაწვდომი მონაცემები"
        : `ბოლო ხელმისაწვდომი წელი · ${model.commonLatestYear}`}
    </span>
  </div>

  <LandingDatasetSection
    kind="expenditure"
    index="01"
    overline="სახელმწიფო ხარჯები"
    heading="როგორ იხარჯება საქართველოს ბიუჯეტი"
    description={`ნახე ${model.expenditure.latestYear} წლის ხარჯები სფეროების, სამინისტროებისა და ძირითადი პროგრამების მიხედვით.`}
    href="/explorer/expenditure"
    linkLabel="ხარჯების მონაცემები →"
    totalLabel="მთლიანი ხარჯი"
    firstColumnLabel="სფერო"
    summary={model.expenditure}
  />
  <LandingDatasetSection
    kind="revenue"
    index="02"
    overline="სახელმწიფო შემოსავლები"
    heading="როგორ ფინანსდება საქართველოს ბიუჯეტი"
    description={`ნახე ${model.revenue.latestYear} წლის გადასახადები, გრანტები, სხვა შემოსავლები და ვალდებულებები.`}
    href="/explorer/revenue"
    linkLabel="შემოსავლების მონაცემები →"
    totalLabel="მთლიანი შემოსავლები"
    firstColumnLabel="მუხლი"
    summary={model.revenue}
  />
  <LandingDatasetSection
    kind="municipalities"
    index="03"
    overline="მუნიციპალური ბიუჯეტები"
    heading="როგორ ხარჯავენ ბიუჯეტს საქართველოს მუნიციპალიტეტები"
    description={`64 მუნიციპალიტეტისა და 11 რეგიონის ${model.municipalities.latestYear} წლის ბიუჯეტები.`}
    href="/explorer/municipalities"
    linkLabel="მუნიციპალური მონაცემები →"
    totalLabel="საქართველოს მუნიციპალური ჯამი"
    firstColumnLabel="უდიდესი მუნიციპალური ბიუჯეტები"
    summary={model.municipalities}
  />

  <section data-testid="landing-methodology" aria-labelledby="landing-methodology-title" className="grid gap-5 border-t border-[var(--hairline)] py-8 min-[850px]:grid-cols-[52px_minmax(230px,0.82fr)_minmax(0,1.35fr)] min-[850px]:gap-8 min-[850px]:py-11">
    <div aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[12px] text-[var(--accent)]">04</div>
    <h2 id="landing-methodology-title" className="font-[family-name:var(--font-display)] text-[26px] font-semibold leading-[1.16]">მეთოდოლოგია და პირველწყაროები</h2>
    <div>
      <p className="text-[13px] leading-[1.75] text-[var(--body)]">თითოეული რიცხვი უკავშირდება ოფიციალურ წყაროს, კლასიფიკაციის წესსა და გადამოწმების შედეგს.</p>
      <ol className="mt-5 border-t border-[var(--hairline-soft)]">
        {["ოფიციალური დოკუმენტის შენარჩუნება", "კლასიფიკაცია და გარდაქმნის წესი", "შეჯერება და ხარისხის შემოწმება", "ჩამოსატვირთი მონაცემები"].map((label, index) => (
          <li key={label} className="grid grid-cols-[28px_1fr] gap-3 border-b border-[var(--hairline-soft)] py-2.5 text-[11.5px] text-[var(--body)]">
            <span aria-hidden="true" className="font-[family-name:var(--font-numeric)] text-[var(--faint)]">{String(index + 1).padStart(2, "0")}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>
      <Link href="/methodology" className="mt-4 inline-flex text-[12.5px] font-semibold text-[var(--accent)] underline decoration-[1.5px] underline-offset-4">მეთოდოლოგიის ნახვა →</Link>
    </div>
  </section>
</div>
```

Keep `<SiteFooter updatedAt={model.updatedAt} />` immediately after this wrapper.

- [ ] **Step 5: Remove the obsolete model and component code**

From `apps/web/lib/landing/landingData.ts`, delete:

- the `colorForItem` import;
- `ExcelPreview`;
- legacy `LandingModel` fields `revMin`, `revMax`, `expMax`, `sparkTotal`, `sparkVat`, `sparkEndX`, `sparkEndY`, `waffleCells`, and `excelPreview`;
- `SPARK_WIDTH`, `SPARK_HEIGHT`, `SPARK_PAD`, and `WAFFLE_CELLS`;
- all sparkline, waffle, and Excel-preview calculations.

Keep `yearsLabel`, `updatedAt`, the four final summary fields, and the small revenue-year range calculation needed for `yearsLabel`.

Delete `apps/web/components/methodology/methodology-promo.tsx` after confirming its landing import was the only caller:

```powershell
rg -n "MethodologyPromo" apps/web
```

Expected before deletion: only the component definition remains. Expected after deletion: no matches.

- [ ] **Step 6: Align homepage metadata**

In `apps/web/app/page.tsx`, retain the title and replace only the description:

```ts
description:
  "საქართველოს სახელმწიფო და მუნიციპალური ბიუჯეტების გადამოწმებული მონაცემები — ხარჯები, შემოსავლები, მუნიციპალიტეტები, მეთოდოლოგია და ჩამოსატვირთი მონაცემები.",
```

Do not change `fiscalMetadata`, canonical-host resolution, Open Graph/Twitter defaults, JSON-LD, sitemap, or robots code.

- [ ] **Step 7: Replace `DESIGN.md` section 19 with the approved production contract**

Record:

- exact header/hero copy and the `#data` CTA;
- the three maintained country figures and population date/source;
- fixed post-hero order and repeated ledger anatomy;
- exact three headings, total labels, and destinations;
- data-derived latest-year/top-four/municipal-country-total rules;
- the single methodology section and retained footer;
- desktop, `<850px`, and `<=380px` layout behavior;
- no post-hero graphic, prior-year comparison, old three-path cards, About block, or separate methodology promo;
- the new landing QA contract instead of the old 30-cell/sparkline/Excel-preview checks.

Do not copy the prototype's hardcoded 2025 amounts into `DESIGN.md`.

- [ ] **Step 8: Run focused unit, browser, and type checks for GREEN**

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run typecheck
npm.cmd run test:browser -- tests/browser/landing.spec.ts
```

Expected: all commands pass. Review `apps/web/test-results/visual-reference/landing-desktop.png`, `landing-390.png`, and `landing-320.png` against Variant J. Confirm totals have strong double rules, the three sections share a consistent rhythm, country figures remain one row, and no text or table is clipped.

- [ ] **Step 9: Commit the responsive homepage**

```powershell
git add apps/web/app/page.tsx apps/web/components/landing/landing-page.tsx apps/web/components/landing/landing-dataset-section.tsx apps/web/components/methodology/methodology-promo.tsx apps/web/lib/landing/landingData.ts apps/web/tests/browser/landing.spec.ts DESIGN.md
git diff --cached --check
git commit -m "feat: redesign Fiscal.ge homepage"
```

---

### Task 3: Apply shared header and revenue wording consistently

**Files:**
- Modify: `apps/web/tests/browser/landing.spec.ts`
- Modify: `apps/web/tests/browser/methodology.spec.ts`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts`
- Modify: `apps/web/components/site/site-header.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx`
- Modify: `DESIGN.md` sections 7.1 and 11

**Interfaces:**
- Consumes: existing `SiteHeader` props and `MainExplorer` navigation state.
- Produces: the same routes and active-state behavior with visible header label `მონაცემები` and revenue H1 `როგორ ფინანსდება საქართველოს ბიუჯეტი`.
- Does not change: `/explorer` href, sidebar labels, footer phrase `მრავალწლიანი ექსპლორერი`, About body copy, canonical term `შემოსავლები`, or metadata query language.

- [ ] **Step 1: Update browser tests first**

In `apps/web/tests/browser/landing.spec.ts`, add:

```ts
const dataNav = page.getByTestId("landing-header").getByRole("link", { name: "მონაცემები", exact: true });
await expect(dataNav).toHaveAttribute("href", "/explorer");
await expect(page.getByTestId("landing-header").getByRole("link", { name: "ექსპლორერი", exact: true })).toHaveCount(0);
```

In the first header test in `apps/web/tests/browser/methodology.spec.ts`, cover both methodology and About shared-header uses:

```ts
for (const [path, testId] of [
  ["/methodology", "methodology-header"],
  ["/methodology/expenditure", "methodology-header"],
  ["/methodology/revenue", "methodology-header"],
  ["/methodology/municipalities", "methodology-header"],
  ["/about", "about-header"],
] as const) {
  await page.goto(`http://localhost:3100${path}`);
  const header = page.getByTestId(testId);
  await expect(header.getByRole("link", { name: "მთავარი" })).toHaveAttribute("href", "/");
  await expect(header.getByRole("link", { name: "მონაცემები", exact: true })).toHaveAttribute("href", "/explorer");
  await expect(header.locator("[aria-current]")).toHaveCount(0);
}
```

Replace all three existing revenue-heading assertions in `apps/web/tests/browser/main-explorer.spec.ts` with:

```ts
await expect(page.getByRole("heading", { level: 1 })).toHaveText("როგორ ფინანსდება საქართველოს ბიუჯეტი");
```

- [ ] **Step 2: Run focused browser tests and verify RED**

```powershell
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/methodology.spec.ts tests/browser/main-explorer.spec.ts
```

Expected: FAIL because the shared header still says `ექსპლორერი` and the revenue explorer still says `როგორ ივსება საქართველოს ბიუჯეტი`.

- [ ] **Step 3: Make the two surgical production copy changes**

In `apps/web/components/site/site-header.tsx`, replace only the visible link text:

```tsx
<Link
  href="/explorer"
  aria-current={active === "explorer" ? "page" : undefined}
  className={navLinkClass(active === "explorer")}
>
  მონაცემები
</Link>
```

In `apps/web/components/main-explorer/main-explorer.tsx`, change only the revenue branch of `screenTitle`:

```ts
const screenTitle = analysisModel
  ? `${analysisModel.year} წლის ბიუჯეტის სურათი — ${analysisSide === "expenditure" ? "სად მიდის საჯარო ფული" : "საიდან მოდის საჯარო ფული"}`
  : nav === "expenditure"
    ? "როგორ იხარჯება საქართველოს ბიუჯეტი"
    : "როგორ ფინანსდება საქართველოს ბიუჯეტი";
```

- [ ] **Step 4: Update the canonical copy rules**

In `DESIGN.md`:

- section 7.1: replace the shared public-header label `ექსპლორერი` with `მონაცემები`, keep `/explorer`, and keep methodology/About inactive;
- section 11: replace the revenue editorial title with `როგორ ფინანსდება საქართველოს ბიუჯეტი`;
- section 19: ensure the header bullet also says `მონაცემები`.

Do not replace valid uses of the product term `ექსპლორერი` in the footer, About description, sidebar, or technical documentation.

- [ ] **Step 5: Verify focused behavior and stale-copy boundaries**

```powershell
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/methodology.spec.ts tests/browser/main-explorer.spec.ts
rg -n -F "როგორ ივსება საქართველოს ბიუჯეტი" apps/web/components/main-explorer apps/web/tests/browser/main-explorer.spec.ts DESIGN.md
rg -n -F "ექსპლორერი" apps/web/components/site/site-header.tsx apps/web/tests/browser/landing.spec.ts apps/web/tests/browser/methodology.spec.ts
```

Expected: browser files pass; both `rg` commands return no matches in the deliberately narrow scopes. Other valid `ექსპლორერი` occurrences elsewhere remain unchanged.

- [ ] **Step 6: Commit the shared copy alignment**

```powershell
git add apps/web/components/site/site-header.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/tests/browser/landing.spec.ts apps/web/tests/browser/methodology.spec.ts apps/web/tests/browser/main-explorer.spec.ts DESIGN.md
git diff --cached --check
git commit -m "fix: align public homepage wording"
```

---

### Task 4: Verify the full change and prepare review

**Files:**
- Verify all changed files; no additional production file is expected.
- Review generated screenshots under `apps/web/test-results/visual-reference/`.

**Interfaces:**
- Consumes: the completed data model, responsive page, shared header copy, revenue title, tests, and canonical design documentation.
- Produces: fresh repository-level and browser evidence; optional GitHub delivery only when separately authorized.

- [ ] **Step 1: Run focused model and browser verification again**

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run test:browser -- tests/browser/landing.spec.ts tests/browser/methodology.spec.ts tests/browser/main-explorer.spec.ts
```

Expected: all focused tests pass with zero failures and no browser console/page errors.

- [ ] **Step 2: Run the repository definition of done**

From `apps/web`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test:browser
```

Expected: lint, strict typecheck, all unit tests, data validation, static production build, and the complete Playwright suite pass.

- [ ] **Step 3: Perform visual and payload review**

Open the three fresh landing screenshots and verify them against `design-shotgun/homepage-below-hero-2026-08-23/variant-j.html`:

- desktop hierarchy is index → copy → total/table;
- 390px and 320px hierarchy is index → copy → total/table in one column;
- all three country figures remain in one row;
- `3.9` is visually cleaner than `3.94` and retains its full date/source;
- total blocks are visually stronger than the four-row lists;
- no 2024→2025 comparison, chart, map, or decorative graphic exists below the hero;
- no horizontal clipping, table overflow, or desktop-style mobile stacking remains.

Inspect the rendered homepage HTML or browser DOM and confirm a known non-top municipality label is absent. The model may read the full municipal corpus on the server, but only four municipality rows may appear in the homepage output.

- [ ] **Step 4: Review the final Git boundary**

From the repository root:

```powershell
git status --short --branch
git diff --check
git log --oneline --decorate -4
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- apps/web/app/page.tsx apps/web/lib/landing/landingData.ts apps/web/components/landing apps/web/components/site/site-header.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/tests/landing/landingData.test.ts apps/web/tests/browser/landing.spec.ts apps/web/tests/browser/methodology.spec.ts apps/web/tests/browser/main-explorer.spec.ts DESIGN.md docs/superpowers/specs/2026-08-23-fiscal-ge-homepage-redesign-design.md docs/superpowers/plans/2026-08-23-fiscal-ge-homepage-redesign.md
```

Expected: branch is `codex/homepage-redesign`; worktree is clean; every changed line belongs to this approved redesign; no data import, dependency, route, unrelated refactor, or deployment file changed.

- [ ] **Step 5: Request code review before delivery**

Use `superpowers:requesting-code-review`. Resolve every actionable finding and rerun the focused command affected by each correction, followed by `npm.cmd run check` if production code changed.

- [ ] **Step 6: Deliver only when publication is authorized**

If the user authorizes publishing, follow the repository workflow without skipping gates:

```powershell
git push -u origin codex/homepage-redesign
gh pr create --draft --title "Redesign Fiscal.ge homepage" --body "Implements the approved Fiscal.ge homepage redesign with data-derived latest-year expenditure, revenue, and municipality summaries; responsive 320px/390px coverage; shared public wording updates; and preserved SEO, methodology, and accessibility contracts."
```

Wait for required CI, resolve review conversations, mark the PR ready, merge only when required checks are green, delete the branch, synchronize the local checkout, and verify the production Vercel deployment is `READY` for the merged SHA.

Live verification must cover `https://fiscal.ge/` at desktop and mobile widths, the three homepage explorer links, `/methodology`, `/explorer/revenue`, canonical/description metadata, no console errors, no horizontal overflow, and the deployed commit identity. A green hook or alias alone is not production proof.

After the live release is verified, the site owner may inspect `/` in Google Search Console and record the submitted/indexed state. Search Console remains an owner-operated measurement step; repository tests and deployment evidence must not be described as proof of ranking or indexing.
