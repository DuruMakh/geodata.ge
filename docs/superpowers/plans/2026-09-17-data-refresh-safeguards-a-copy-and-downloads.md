# Data-Refresh Safeguards A: Copy, Deficit Vintage and Downloads — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** A data refresh can no longer leave stale figures or a stale IMF edition on the page, and each public CSV has one writer with a real on-disk check.

**Architecture:** Three independent changes plus cleanup:
1. A test recomputes every figure quoted in the GDP summaries from `data/imports/gdp-overview-annual.csv`, and the period boundaries move from a literal in the component into an exported constant the test shares.
2. The deficit page derives its forecast marker from the facts and its edition text, workbook source and dataset description from the IMF manifest.
3. The duplicate public CSV scripts go, and `preparePublicDatasets` gains an output check that actually reads the written files.

**Tech Stack:** TypeScript, Vitest 4, Playwright, zod, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-09-17-data-refresh-safeguards-design.md` (§2, §3, §6). Its §4 (nominal GDP in three pipelines) and §5 (World Bank preliminary basis) are planned separately in `2026-09-17-data-refresh-safeguards-b-pipelines.md`, because they change the IMF and Geostat pipelines and the query service.

## Global Constraints

- **Branch and paths:** work on `codex/data-refresh-safeguards-copy`, created from `main`. Never commit to `main`. Commands run from `apps/web`; repository paths are written `../../…`.
- **No figure changes.** No CSV, workbook or served value changes. Rendered text stays identical today except the one source sentence in §Task 3, which the owner approves on the PR.
- **Copy stays reviewed.** The GDP summaries remain fixed editorial text, as `2026-09-10-gdp-overview-design.md:213` and `:217` approved. The test enforces the review, it does not generate prose.
- **Locale formats:** English uses `.` decimals and `,` thousands; Georgian uses `,` decimals and a space (U+0020) for thousands, exactly as the current copy does.
- **Sequencing:** if `2026-09-17-identifiers-and-source-lineage.md` has merged, `tests/explorer/deficitRoute.test.tsx:47` already asserts `deficit.general_government.balance`; leave whichever id is in the file.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 6.

---

### Task 1: A test that recomputes every GDP summary figure

**Files:**
- Modify: `apps/web/components/gdp/gdp-summary.tsx` (lines 26–29)
- Create: `apps/web/tests/i18n/gdpSummaryFigures.test.ts`

**Interfaces:**
- Consumes: `loadGdpOverviewFacts()` from `lib/data/gdpOverview/importGdpOverview.ts`, which returns `GdpObservation[]` whose `value` is a decimal string; `getMessages(locale, ["gdp"])`.
- Produces: `REAL_GDP_SUMMARY_PERIODS: readonly (readonly [number, number])[]`, exported from `components/gdp/gdp-summary.tsx`. The growth summary uses its last two entries, as the component does today.

- [x] **Step 1: Write the failing test**

Create `apps/web/tests/i18n/gdpSummaryFigures.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { REAL_GDP_SUMMARY_PERIODS } from "../../components/gdp/gdp-summary";
import { loadGdpOverviewFacts } from "../../lib/data/gdpOverview/importGdpOverview";
import { getMessages } from "../../lib/i18n/messages.server";
import type { Locale, Messages } from "../../lib/i18n/types";

// The four GDP summaries are reviewed editorial copy (spec 2026-09-10 §213, §217),
// so this test does not generate prose. It recomputes every figure they quote from
// the canonical CSV, and fails when the data moves under the text.

type Series = Map<number, number>;

let facts: Awaited<ReturnType<typeof loadGdpOverviewFacts>>;
const messagesByLocale = new Map<Locale, Messages>();

beforeAll(async () => {
  facts = await loadGdpOverviewFacts();
  for (const locale of ["ka", "en"] as const) messagesByLocale.set(locale, await getMessages(locale, ["gdp"]));
});

const seriesOf = (seriesId: string): Series =>
  new Map(facts.filter((fact) => fact.seriesId === seriesId).map((fact) => [fact.year, Number(fact.value)]));
const at = (series: Series, year: number): number => {
  const value = series.get(year);
  if (value === undefined) throw new Error(`No observation for ${year}`);
  return value;
};
const yearsOf = (series: Series): number[] => [...series.keys()].sort((left, right) => left - right);
const changePct = (series: Series, from: number, to: number) => (at(series, to) / at(series, from) - 1) * 100;
const cagrPct = (series: Series, from: number, to: number) => ((at(series, to) / at(series, from)) ** (1 / (to - from)) - 1) * 100;

function num(value: number, decimals: number, locale: Locale): string {
  const [integer, fraction] = Math.abs(value).toFixed(decimals).split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, locale === "en" ? "," : " ");
  return fraction ? `${grouped}${locale === "en" ? "." : ","}${fraction}` : grouped;
}

function claimsFor(locale: Locale): Array<{ key: string; figures: string[] }> {
  const real = seriesOf("real_usd_2015");
  const growth = seriesOf("real_growth_percent");
  const nominalGel = seriesOf("nominal_gel");
  const nominalUsd = seriesOf("nominal_usd");
  const perCapitaGel = seriesOf("per_capita_gel");
  const perCapitaUsd = seriesOf("per_capita_usd");

  const realYears = yearsOf(real);
  const last = realYears.at(-1)!;
  const bn = (series: Series, year: number) => num(at(series, year) / 1e9, 1, locale);
  const pct = (value: number) => num(value, 1, locale);
  const whole = (series: Series, year: number) => num(at(series, year), 0, locale);

  const sovietYears = realYears.filter((year) => year <= 1991);
  const peakYear = sovietYears.reduce((best, year) => (at(real, year) > at(real, best) ? year : best), sovietYears[0]!);
  const exceedYear = realYears.find((year) => year > peakYear && at(real, year) > at(real, peakYear))!;
  const recentGrowthYears = yearsOf(growth).filter((year) => year >= 2000);
  const maxGrowthYear = recentGrowthYears.reduce((best, year) => (at(growth, year) > at(growth, best) ? year : best), recentGrowthYears[0]!);
  const contractionYears = recentGrowthYears.filter((year) => at(growth, year) < 0);
  const [, secondPeriod, lastPeriod] = REAL_GDP_SUMMARY_PERIODS;

  // The real table has one row per period; the growth table reuses rows 1 and 2.
  const periodClaims = REAL_GDP_SUMMARY_PERIODS.flatMap(([from, to], index) => [
    { key: `gdp.summary.total${index}`, figures: [pct(changePct(real, from, to))] },
    { key: `gdp.summary.annual${index}`, figures: [pct(cagrPct(real, from, to))] },
  ]);

  return [
    { key: "gdp.nominalSummary.recent", figures: [bn(nominalGel, last), bn(nominalUsd, last), pct(changePct(nominalGel, last - 1, last))] },
    { key: "gdp.nominalSummary.periods", figures: [pct(changePct(nominalGel, last - 5, last)), bn(nominalGel, last - 5), bn(nominalGel, last), pct(changePct(nominalGel, last - 10, last))] },
    { key: "gdp.nominalSummary.note", figures: [] },
    { key: "gdp.growthSummary.recent", figures: [pct(at(growth, last)), pct(at(growth, last - 1)), pct(at(growth, last - 1) - at(growth, last))] },
    { key: "gdp.growthSummary.comparison", figures: [String(lastPeriod![1] - lastPeriod![0]), String(secondPeriod![1] - secondPeriod![0])] },
    { key: "gdp.growthSummary.context", figures: [pct(at(growth, maxGrowthYear)), ...contractionYears.map((year) => pct(at(growth, year)))] },
    { key: "gdp.growthSummary.note", figures: [] },
    { key: "gdp.per_capitaSummary.recent", figures: [whole(perCapitaGel, last), whole(perCapitaUsd, last), pct(changePct(perCapitaGel, last - 1, last)), pct(changePct(perCapitaUsd, last - 1, last))] },
    { key: "gdp.per_capitaSummary.periods", figures: [pct(changePct(perCapitaGel, last - 5, last)), whole(perCapitaGel, last - 5), whole(perCapitaGel, last), pct(changePct(perCapitaGel, last - 10, last)), pct(changePct(perCapitaUsd, last - 5, last)), pct(changePct(perCapitaUsd, last - 10, last))] },
    { key: "gdp.per_capitaSummary.note", figures: [] },
    { key: "gdp.summary.recent", figures: [bn(real, last), pct(changePct(real, last - 5, last)), pct(changePct(real, last - 10, last))] },
    ...periodClaims,
    { key: "gdp.summary.peak", figures: [bn(real, peakYear), bn(real, exceedYear - 1), bn(real, exceedYear), String(exceedYear - peakYear)] },
    { key: "gdp.summary.sovietGrowth", figures: [pct(cagrPct(real, sovietYears[0]!, 1990))] },
    { key: "gdp.summary.note", figures: [] },
    // Coverage sentences quote the first and last year of their own series. A
    // key may appear twice: the assertion loop checks each entry's figures, and
    // the completeness loop unions them per key.
    { key: "gdp.summary.recent", figures: [String(realYears[0]), String(last)] },
    { key: "gdp.nominalSummary.note", figures: [String(yearsOf(nominalGel)[0]), String(last)] },
    { key: "gdp.growthSummary.note", figures: [String(yearsOf(growth)[0]), String(last)] },
    { key: "gdp.per_capitaSummary.note", figures: [String(yearsOf(perCapitaGel)[0]), String(last)] },
    { key: "gdp.summary.peak", figures: [String(peakYear), String(exceedYear - 1), String(exceedYear)] },
    { key: "gdp.growthSummary.context", figures: [String(maxGrowthYear), ...contractionYears.map(String)] },
  ];
}

const tokenPattern = {
  en: /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g,
  ka: /\d{1,3}(?: \d{3})+(?:,\d+)?|\d+(?:,\d+)?/g,
} as const;
const isYear = (token: string) => /^(?:19|20)\d{2}$/.test(token);

describe.each(["ka", "en"] as const)("GDP summary figures: %s", (locale) => {
  it("quotes only figures the canonical CSV reproduces", () => {
    const messages = messagesByLocale.get(locale)!;
    const claims = claimsFor(locale);

    for (const claim of claims) {
      const value = messages[claim.key];
      expect(value, claim.key).toBeTypeOf("string");
      for (const figure of claim.figures) {
        expect(value, `${claim.key} should quote ${figure}`).toContain(figure);
      }
    }

    // Completeness: no unlisted number may hide in the reviewed copy.
    const allowed = new Set(claims.flatMap((claim) => claim.figures));
    for (const key of new Set(claims.map((claim) => claim.key))) {
      const tokens = (messages[key]!.match(tokenPattern[locale]) ?? []).filter((token) => !isYear(token));
      for (const token of tokens) {
        expect(allowed.has(token), `${key} quotes an unchecked figure: ${token}`).toBe(true);
      }
    }
  });

  it("states data facts that still hold", () => {
    const real = seriesOf("real_usd_2015");
    const growth = seriesOf("real_growth_percent");
    const realYears = yearsOf(real);
    const last = realYears.at(-1)!;

    // "the highest level in the displayed series"
    expect(at(real, last)).toBe(Math.max(...realYears.map((year) => at(real, year))));
    // "the economy contracted in only two years" since 2000
    expect(yearsOf(growth).filter((year) => year >= 2000 && at(growth, year) < 0)).toHaveLength(2);
    // "the starting year, 2020, was a year of economic contraction"
    expect(at(growth, last - 5)).toBeLessThan(0);
    // The 2025 Geostat series are preliminary, as the nominal and per-capita copy says.
    expect(facts.some((fact) => fact.seriesId === "nominal_gel" && fact.year === last && fact.status === "preliminary")).toBe(true);
  });
});
```

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/i18n/gdpSummaryFigures.test.ts`
Expected: FAIL, because `REAL_GDP_SUMMARY_PERIODS` is not exported by `components/gdp/gdp-summary.tsx`.

- [x] **Step 3: Export the period boundaries**

In `apps/web/components/gdp/gdp-summary.tsx`, add above the component:

```tsx
/** The reviewed comparison periods. Exported so tests can recompute their figures. */
export const REAL_GDP_SUMMARY_PERIODS = [
  [1994, 2003],
  [2003, 2012],
  [2012, 2025],
] as const satisfies readonly (readonly [number, number])[];
```

Replace lines 26–29:

```tsx
  const periods =
    indicator === "real"
      ? ["1994–2003", "2003–2012", "2012–2025"]
      : ["2003–2012", "2012–2025"];
```

with:

```tsx
  const periods = (indicator === "real" ? REAL_GDP_SUMMARY_PERIODS : REAL_GDP_SUMMARY_PERIODS.slice(1)).map(
    ([from, to]) => `${from}–${to}`,
  );
```

- [x] **Step 4: Run it and fix what it catches**

Run: `npx vitest run tests/i18n/gdpSummaryFigures.test.ts`
Expected: PASS for both locales. A failure here means either the claim list is wrong or a quoted figure no longer matches the data — read the message it names and fix the claim before touching the copy.

Run: `npx vitest run tests/explorer/gdpRoute.test.tsx tests/explorer/economyHub.test.tsx`
Expected: PASS; the rendered period labels are unchanged.

- [x] **Step 5: Point the refresh procedure at the test**

In `../../docs/data-methodology/gdp-overview.md`, append to `## Validation and refresh`:

```markdown
The four indicator summaries under the chart are reviewed editorial copy holding about 45 figures per language. `npx vitest run tests/i18n/gdpSummaryFigures.test.ts` recomputes every one of them from `data/imports/gdp-overview-annual.csv`. After any refresh, run it; when it fails, update `lib/i18n/messages/{ka,en}/gdp.json` in both languages and re-review the wording, as the design spec requires (`2026-09-10-gdp-overview-design.md` §213, §217).
```

- [x] **Step 6: Commit**

```bash
git add components/gdp/gdp-summary.tsx tests/i18n/gdpSummaryFigures.test.ts ../../docs/data-methodology/gdp-overview.md
git commit -m "test(gdp): recompute every summary figure from the canonical CSV"
```

---

### Task 2: The deficit forecast marker comes from the facts

**Files:**
- Modify: `apps/web/components/deficit/deficit-explorer.tsx:231`
- Test: `apps/web/tests/explorer/deficitRoute.test.tsx`

**Interfaces:**
- Consumes: `model.forecastStartYear` is range-filtered (`lib/explorer/deficitExplorer.ts:48`), so the marker uses the unfiltered `facts` prop instead, as debt does (`components/debt/debt-explorer.tsx:128-131`).
- Produces: nothing new.

- [x] **Step 1: Write the failing test**

Append inside the `describe` block of `apps/web/tests/explorer/deficitRoute.test.tsx`:

```tsx
  it("marks the first projection year the facts declare", async () => {
    const components = await import("../../components/deficit/deficit-explorer");
    const shifted = facts.map((fact) =>
      fact.year === 2026 ? { ...fact, status: "actual" as const } : fact,
    );
    const markup = renderGeorgianMarkup(createElement(components.DeficitExplorer, {
      facts: shifted,
      workbookSources: [],
      lastUpdatedAt: "2026-09-04",
      edition: "2026 წლის აპრილი",
    }));

    expect(markup).toContain('data-testid="range-marker"');
    const marker = /<[^>]*data-testid="range-marker"[\s\S]*?<\/[a-z]+>/.exec(markup)?.[0] ?? "";
    expect(marker).toContain("2027");
    expect(marker).not.toContain("2026");
  });
```

Match the file's existing way of building `facts` and rendering (`renderGeorgianMarkup`, `createElement`); if the file renders `renderDeficitPage` instead of the component, render the component the same way the existing test at line 30 does.

- [x] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/explorer/deficitRoute.test.tsx`
Expected: FAIL; the marker still reads 2026, and `edition` is not a prop yet (Task 3 adds it — until then, drop `edition` from this test and add it back in Task 3 Step 5).

- [x] **Step 3: Implement**

In `apps/web/components/deficit/deficit-explorer.tsx`, add beside the other derived values (near line 58):

```tsx
  // The marker belongs to full coverage, not the selected range, so it must come
  // from the facts rather than from the range-filtered model (debt does the same).
  const forecastBoundaryYear = facts.find((fact) => fact.status === "projection")?.year ?? null;
```

Replace line 231:

```tsx
                marker={{ year: 2026, label: message(messages, "deficit.forecast") }}
```

with:

```tsx
                marker={forecastBoundaryYear === null
                  ? undefined
                  : { year: forecastBoundaryYear, label: message(messages, "deficit.forecast") }}
```

- [x] **Step 4: Run the tests**

Run: `npx vitest run tests/explorer/deficitRoute.test.tsx`
Expected: PASS.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/deficit.spec.ts`
Expected: PASS; the marker still reads `პროგნოზი` at 2026 on the real data.

- [x] **Step 5: Commit**

```bash
git add components/deficit/deficit-explorer.tsx tests/explorer/deficitRoute.test.tsx
git commit -m "fix(deficit): take the forecast marker from the facts"
```

---

### Task 3: Edition text, workbook source and coverage come from the IMF manifest

**Files:**
- Modify: `apps/web/lib/i18n/messages/en/deficit.json` and `apps/web/lib/i18n/messages/ka/deficit.json`
- Modify: `apps/web/lib/methodology/workbookSources.ts` (add the manifest reader)
- Modify: `apps/web/lib/pages/deficit.tsx` (lines 18–24, 34–40, 64–70)
- Modify: `apps/web/components/deficit/deficit-explorer.tsx` (props; the note at lines 233–241)
- Modify: `DESIGN.md` §8.6, line 600
- Test: `apps/web/tests/explorer/deficitRoute.test.tsx`
- Test: `apps/web/tests/methodology/workbookSources.test.ts` (create if absent)

**Interfaces:**
- Produces:
  - `loadImfWeoManifest(): Promise<{ retrievedFileUrl: string; retrievedAt: string; publicationDate: string; yearMin: number; yearMax: number }>` in `lib/methodology/workbookSources.ts`.
  - `DeficitExplorerProps.edition: string` — the formatted edition, for example `April 2026` or `2026 წლის აპრილი`.
  - Message keys `deficit.weoEdition`, `deficit.weoMonth.4`, `deficit.weoMonth.10`; parameters on `deficit.forecastNote`, `deficit.source`, `deficit.datasetDescription` and `deficit.workbookTitle`.

The IMF publishes WEO in April and October only, so an unexpected month raises a missing-message error, which is the wanted loud failure.

- [x] **Step 1: Write the failing tests**

Append to `apps/web/tests/explorer/deficitRoute.test.tsx`:

```tsx
  it("names the IMF edition and projection years from the reviewed manifest", async () => {
    const { renderDeficitPage } = await import("../../lib/pages/deficit");
    const html = renderToStaticMarkup(await renderDeficitPage("en"));

    expect(html).toContain("World Economic Outlook, April 2026");
    expect(html).toContain("The IMF projects the figures for 2026–2031");
    expect(html).toContain("This WEO edition identifies 1995–2025 as the actual-data period");
  });
```

Add `import { renderToStaticMarkup } from "react-dom/server";` if the file does not already import it.

Create `apps/web/tests/methodology/workbookSources.test.ts` (or append to it if it exists):

```ts
import { describe, expect, it } from "vitest";
import { loadImfWeoManifest } from "../../lib/methodology/workbookSources";

describe("IMF WEO manifest", () => {
  it("reads the reviewed edition's url, dates and coverage", async () => {
    const manifest = await loadImfWeoManifest();
    expect(manifest.retrievedFileUrl.startsWith("https://")).toBe(true);
    expect(manifest.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.publicationDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(manifest.yearMax).toBeGreaterThan(manifest.yearMin);
  });
});
```

Run: `npx vitest run tests/methodology/workbookSources.test.ts tests/explorer/deficitRoute.test.tsx`
Expected: FAIL; `loadImfWeoManifest` does not exist, and the page still prints the hard-coded sentence.

- [x] **Step 2: Read the manifest**

In `apps/web/lib/methodology/workbookSources.ts`, add:

```ts
const imfWeoManifestSchema = z.object({
  retrieved_file_url: z.string().url().startsWith("https://"),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  year_min: z.coerce.number().int(),
  year_max: z.coerce.number().int(),
});

let imfWeoManifest: Promise<ImfWeoManifest> | null = null;

export type ImfWeoManifest = {
  retrievedFileUrl: string;
  retrievedAt: string;
  publicationDate: string;
  yearMin: number;
  yearMax: number;
};

/** The reviewed IMF WEO edition behind the deficit dataset, read from its package manifest. */
export function loadImfWeoManifest(): Promise<ImfWeoManifest> {
  imfWeoManifest ??= (async () => {
    const manifestPath = path.resolve(
      process.cwd(),
      "../..",
      "docs/Raw Data/Deficit/imf-weo-general-government-balance/source-manifest.csv",
    );
    const rows = parse(await readFile(manifestPath, "utf8"), { bom: true, columns: true, skip_empty_lines: true, trim: true }) as unknown[];
    if (rows.length !== 1) throw new Error("Expected exactly one IMF WEO manifest row");
    const row = imfWeoManifestSchema.parse(rows[0]);
    return {
      retrievedFileUrl: row.retrieved_file_url,
      retrievedAt: row.retrieved_at,
      publicationDate: row.publication_date,
      yearMin: row.year_min,
      yearMax: row.year_max,
    };
  })();
  return imfWeoManifest;
}
```

In `resetWorkbookSourceCacheForTests` (line 247), add `imfWeoManifest = null;`.

- [x] **Step 3: Parameterise the copy**

In `apps/web/lib/i18n/messages/en/deficit.json`, replace these four values and add three keys:

```json
  "deficit.forecastNote": "The IMF projects the figures for {projectionFirst}–{projectionLast}. This WEO edition identifies {actualFirst}–{actualLast} as the actual-data period.",
  "deficit.source": "Data: the International Monetary Fund’s (IMF) World Economic Outlook, {edition}.",
  "deficit.datasetDescription": "Georgia’s general government deficit or surplus, as a percentage of GDP and in nominal GEL, {first}–{last}; {projectionFirst}–{projectionLast} are IMF projections.",
  "deficit.workbookTitle": "IMF World Economic Outlook — {edition}",
  "deficit.weoEdition": "{month} {year}",
  "deficit.weoMonth.4": "April",
  "deficit.weoMonth.10": "October",
```

In `apps/web/lib/i18n/messages/ka/deficit.json`:

```json
  "deficit.forecastNote": "{projectionFirst}–{projectionLast} წლები IMF-ის პროგნოზია; {actualFirst}–{actualLast} წლები ამ WEO გამოცემაში ფაქტობრივ პერიოდადაა მონიშნული.",
  "deficit.source": "მონაცემები: საერთაშორისო სავალუტო ფონდის (IMF) World Economic Outlook, {edition}.",
  "deficit.datasetDescription": "საქართველოს ზოგადი მთავრობის დეფიციტი ან პროფიციტი, მშპ-ის პროცენტად და ნომინალურ ლარში, {first}–{last}; {projectionFirst}–{projectionLast} IMF-ის პროგნოზია.",
  "deficit.workbookTitle": "IMF World Economic Outlook — {edition}",
  "deficit.weoEdition": "{year} წლის {month}",
  "deficit.weoMonth.4": "აპრილი",
  "deficit.weoMonth.10": "ოქტომბერი",
```

The English and Georgian source sentences now place the edition after the publication name. That is the one wording change in this plan; call it out on the PR for the owner.

- [x] **Step 4: Build the page from the manifest**

In `apps/web/lib/pages/deficit.tsx`, replace `workbookSourcesFor` (lines 18–24) with:

```tsx
function editionLabel(messages: Parameters<typeof message>[0], publicationDate: string): string {
  const [year, month] = publicationDate.split("-");
  return message(messages, "deficit.weoEdition", {
    year: year!,
    month: message(messages, `deficit.weoMonth.${Number(month)}`),
  });
}

function workbookSourcesFor(
  messages: Parameters<typeof message>[0],
  manifest: ImfWeoManifest,
  edition: string,
): WorkbookPublicSource[] {
  return [{
    years: Array.from({ length: manifest.yearMax - manifest.yearMin + 1 }, (_, index) => manifest.yearMin + index),
    title: message(messages, "deficit.workbookTitle", { edition }),
    organization: message(messages, "deficit.workbookOrganization"),
    downloadHref: manifest.retrievedFileUrl as `https://${string}`,
    retrievedAt: manifest.retrievedAt,
  }];
}
```

Add the imports:

```tsx
import { loadImfWeoManifest, type ImfWeoManifest } from "../methodology/workbookSources";
```

In `renderDeficitPage`, load the manifest beside the facts and derive the projection years:

```tsx
  const [{ facts }, manifest] = await Promise.all([
    loadServedGeneralGovernmentBalanceData(),
    loadImfWeoManifest(),
  ]);
```

and after `const description = …` (line 40):

```tsx
  const edition = editionLabel(messages, manifest.publicationDate);
  const projections = facts.filter((fact) => fact.status === "projection").map((fact) => fact.year);
```

Change the dataset description to pass the projection years:

```tsx
  const description = message(messages, "deficit.datasetDescription", {
    first: firstYear,
    last: lastYear,
    projectionFirst: projections[0] ?? lastYear,
    projectionLast: projections.at(-1) ?? lastYear,
  });
```

and the explorer element (lines 65–70):

```tsx
      <DeficitExplorer
        facts={facts}
        workbookSources={workbookSourcesFor(messages, manifest, edition)}
        edition={edition}
        siteOrigin={resolveSiteUrl()}
        lastUpdatedAt={lastUpdatedAt}
      />
```

- [x] **Step 5: Use the parameters in the explorer**

In `apps/web/components/deficit/deficit-explorer.tsx`:

1. Add `edition: string;` to `DeficitExplorerProps` and to the destructured props.
2. Beside `forecastBoundaryYear` (Task 2), add:
   ```tsx
   const actualYears = facts.filter((fact) => fact.status === "actual").map((fact) => fact.year);
   const projectionYears = facts.filter((fact) => fact.status === "projection").map((fact) => fact.year);
   ```
3. The forecast note (lines 233–235) becomes:
   ```tsx
               <p data-testid="deficit-forecast-note" className="mt-3 max-w-[680px] text-xs leading-relaxed text-[var(--muted)]">
                 {message(messages, "deficit.forecastNote", {
                   projectionFirst: projectionYears[0] ?? "",
                   projectionLast: projectionYears.at(-1) ?? "",
                   actualFirst: actualYears[0] ?? "",
                   actualLast: actualYears.at(-1) ?? "",
                 })}
               </p>
   ```
4. The source note (line 240) becomes:
   ```tsx
                 {message(messages, "deficit.source", { edition })}
   ```

Add `edition` to the props the Task 2 test passes.

- [x] **Step 6: State the rule in DESIGN.md**

In `DESIGN.md` §8.6 (line 600), replace `The deck line always reports the latest actual observation (2025), while 2026–2031 render as a dashed continuation with a visible \`პროგნოზი\` marker and table labels.` with:

```markdown
The deck line always reports the latest actual observation, while every projection year renders as a dashed continuation with a visible `პროგნოზი` marker and table labels. The boundary, the coverage sentences and the edition name come from the facts and the reviewed IMF manifest, never from written-in years.
```

- [x] **Step 7: Run the tests**

Run: `npx vitest run tests/explorer/deficitRoute.test.tsx tests/methodology/workbookSources.test.ts tests/explorer/deficitWorkbook.test.ts`
Expected: PASS.

Run: `npm run i18n:check && npm run typecheck`
Expected: exit 0.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/deficit.spec.ts tests/browser/bilingual-debt-deficit.spec.ts tests/browser/seo.spec.ts`
Expected: PASS. `bilingual-debt-deficit.spec.ts:51` and `seo.spec.ts:176` still find `2026–2031`, now rendered from the data.

- [x] **Step 8: Commit**

```bash
git add lib/i18n/messages/en/deficit.json lib/i18n/messages/ka/deficit.json lib/methodology/workbookSources.ts lib/pages/deficit.tsx components/deficit/deficit-explorer.tsx tests/explorer/deficitRoute.test.tsx tests/methodology/workbookSources.test.ts ../../DESIGN.md
git commit -m "fix(deficit): derive the IMF edition, coverage and workbook source from the manifest"
```

---

### Task 4: One writer per public CSV, and a check that reads the files

**Files:**
- Delete: `apps/web/scripts/prepare-gdp-public.ts`, `apps/web/scripts/prepare-economic-sectors-public.ts`
- Modify: `apps/web/package.json` (lines 10, 12, 14, 26, 101–102, 105–106, and the `data:check-public-datasets` entry)
- Modify: `apps/web/lib/data/publicDatasetExports.ts` (the `mode` option and the write branch at lines 109–193)
- Modify: `apps/web/scripts/prepare-public-datasets.ts` (argument parsing)
- Modify: `apps/web/scripts/prepare-fact-query-publications.ts:30-32`
- Test: `apps/web/tests/data/publicDatasetExports.test.ts`

**Interfaces:**
- Produces: `preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" | "check" | "check-output" })`. `check-output` compares the five written CSVs on disk byte for byte and throws naming every stale or missing file.
- `buildAllPublications` keeps writing `gdp-overview.csv` and `economic-sectors.csv`, and `data:check-fact-query-publications` keeps checking them (`scripts/prepare-fact-query-publications.ts:81-83`).

- [x] **Step 1: Write the failing test**

Append inside `describe("public SEO dataset exports", …)` in `apps/web/tests/data/publicDatasetExports.test.ts`:

```ts
  it("checks the written downloads and names a stale or missing file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fiscal-public-data-"));
    tempRoots.push(root);
    const publicRoot = path.join(root, "public");
    await preparePublicDatasets({ repositoryRoot, publicRoot, mode: "write" });

    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).resolves.toHaveLength(5);

    const target = path.join(publicRoot, "downloads", "data", "government-debt.csv");
    await writeFile(target, "year,family\n", "utf8");
    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).rejects.toThrow("government-debt.csv");

    await rm(target);
    await expect(preparePublicDatasets({ repositoryRoot, publicRoot, mode: "check-output" })).rejects.toThrow("missing");
  });
```

Add `writeFile` to the `node:fs/promises` imports at the top of the file.

Run: `npx vitest run tests/data/publicDatasetExports.test.ts`
Expected: FAIL; `"check-output"` is not an accepted mode.

- [x] **Step 2: Implement the output check**

In `apps/web/lib/data/publicDatasetExports.ts`, change the signature (line 112) to:

```ts
  mode: "write" | "check" | "check-output";
```

and replace the write branch (lines 187–192) with:

```ts
  const outputRoot = path.join(options.publicRoot, "downloads", "data");
  if (options.mode === "write") {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
    await Promise.all(outputs.map((output) => writeFile(path.join(outputRoot, output.fileName), output.bytes)));
  } else if (options.mode === "check-output") {
    // "check" validates the inputs; only this mode reads what was written.
    const stale: string[] = [];
    for (const output of outputs) {
      const onDisk = await readFile(path.join(outputRoot, output.fileName)).catch(() => null);
      if (onDisk === null) stale.push(`${output.fileName}: missing`);
      else if (!onDisk.equals(output.bytes)) stale.push(`${output.fileName}: content differs`);
    }
    if (stale.length > 0) throw new Error(`Public dataset downloads are stale:\n${stale.join("\n")}`);
  }
  return validations;
```

- [x] **Step 3: Accept the new flag in the script**

In `apps/web/scripts/prepare-public-datasets.ts`, replace lines 6–15 with:

```ts
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  const checkOutput = process.argv.includes("--check-output");
  if ([write, check, checkOutput].filter(Boolean).length !== 1) {
    throw new Error("Pass exactly one of --write, --check or --check-output");
  }

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const validations = await preparePublicDatasets({
    repositoryRoot,
    publicRoot: path.join(process.cwd(), "public"),
    mode: write ? "write" : checkOutput ? "check-output" : "check",
  });
```

- [x] **Step 4: Delete the duplicate writers and rewire the scripts**

Delete `apps/web/scripts/prepare-gdp-public.ts` and `apps/web/scripts/prepare-economic-sectors-public.ts`.

In `apps/web/package.json`:
1. Remove the four entries `data:prepare-gdp-public`, `data:check-gdp-public`, `data:prepare-economic-sectors-public` and `data:check-economic-sectors-public`.
2. Rename `data:check-public-datasets` to `data:validate-public-dataset-inputs`, keeping its command.
3. Add `"data:check-public-datasets-output": "tsx scripts/prepare-public-datasets.ts --check-output",`.
4. `predev` (line 10) and `prebuild` (line 12) drop `&& npm run data:prepare-gdp-public && npm run data:prepare-economic-sectors-public`.
5. `postbuild` (line 14) becomes:
   ```
   npm run data:check-fact-query-publications && npm run data:check-public-datasets-output && npm run data:check-inflation-public
   ```
6. `data:validate` (line 26) uses `npm run data:validate-public-dataset-inputs` in place of `npm run data:check-public-datasets`.

- [x] **Step 5: Correct the stale comment**

In `apps/web/scripts/prepare-fact-query-publications.ts`, replace lines 30–32:

```ts
    // Deliberately NOT clearing OUTPUT_DIR: preparePublicDatasets already wiped
    // and rewrote it with the three public CSVs immediately before this script
    // runs (see the prebuild chain), and clearing again would delete them.
```

with:

```ts
    // Deliberately NOT clearing OUTPUT_DIR: preparePublicDatasets wipes and
    // rewrites it with its five public CSVs earlier in the prebuild chain, and
    // the inflation CSV is written between the two. Clearing would delete them.
```

- [x] **Step 6: Verify**

Run: `npx vitest run tests/data/publicDatasetExports.test.ts`
Expected: PASS.

Run: `npm run data:validate`
Expected: exit 0, with `data:validate-public-dataset-inputs` in the output and no `data:check-public-datasets`.

Run: `npm run build`
Expected: exit 0. The prebuild chain still writes `gdp-overview.csv` and `economic-sectors.csv` through `data:prepare-fact-query-publications`, and postbuild now checks both the publications and the five public datasets on disk.

Run: `ls public/downloads/data`
Expected: the five public dataset CSVs, the inflation CSV, `gdp-overview.csv`, `economic-sectors.csv`, the publication JSON files and `manifest.json`.

- [x] **Step 7: Commit**

```bash
git add package.json scripts/prepare-public-datasets.ts scripts/prepare-fact-query-publications.ts lib/data/publicDatasetExports.ts tests/data/publicDatasetExports.test.ts
git rm scripts/prepare-gdp-public.ts scripts/prepare-economic-sectors-public.ts
git commit -m "fix(data): one writer per public CSV and a real on-disk download check"
```

---

### Task 5: Record the deficit refresh in its methodology

**Files:**
- Modify: `../../docs/data-methodology/general-government-balance.md` (`## Reproduction`)

- [x] **Step 1: Describe what a new edition now needs**

Append to `## Reproduction`:

```markdown
The page reads the edition from the package manifest: the forecast marker comes from the first `projection` fact, and the source sentence, the workbook source sheet and the dataset description come from `publication_date`, `retrieved_file_url`, `retrieved_at`, `year_min` and `year_max`. A new WEO edition therefore needs no edit in the page or its copy, provided it is an April or October edition (`deficit.weoMonth.*` covers those two; another month raises a missing-message error).
```

- [x] **Step 2: Commit**

```bash
git add ../../docs/data-methodology/general-government-balance.md
git commit -m "docs(methodology): record how the deficit page reads its IMF edition"
```

---

### Task 6: Done-check and acceptance

**Files:** none (verification only).

- [x] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0.

- [x] **Step 2: Build**

Run: `npm run build`
Expected: exit 0, with the new prebuild and postbuild chains.

- [x] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass.

- [x] **Step 4: Acceptance walk**

1. Change one value in `data/imports/gdp-overview-annual.csv`, run `npx vitest run tests/i18n/gdpSummaryFigures.test.ts`, and confirm it fails naming the message. Restore the file.
2. Add an unlisted number to one summary message, run the same test, and confirm the completeness check fails. Restore the message.
3. On `/explorer/deficit` in both locales, the marker sits at the first projection year, the note names the projection and actual ranges, and the source sentence ends with the edition.
4. The deficit workbook's Sources sheet shows the IMF URL, the retrieval date and the manifest's year range.
5. `public/downloads/data` holds one copy of each CSV, and `npm run build` passes with the postbuild output check.

- [x] **Step 5: Hand off**

Push `codex/data-refresh-safeguards-copy` and open a draft PR. Flag the reworded deficit source sentence for owner approval. Merge only after CI is green.

## Execution amendments (2026-09-20)

- Based on current main `f7d3b5371`; Plan 4 is a separate unmerged branch. Existing deficit identifiers are preserved.
- GDP numeric completeness is checked per message across all summary keys, using whole numeric tokens rather than substring matches.
- The shifted forecast fixture includes a real 2027 projection; marker placement is tested at the rail endpoint because its visible label does not contain the year.
- Future October-edition tests exercise both locales and workbook source metadata. The short route fixture reports its own coverage rather than the production dataset range.
- Repeated browser/data/build steps are grouped into final acceptance, following the repository rule against rerunning unchanged passing gates. Already-passed focused results are recorded without rerunning solely for ledger bookkeeping.
- Methodology now names the surviving publication check, replacing its reference to the removed separate CSV checker.

- Final review found stale-year and year-shaped-percentage gaps in the planned GDP test. Both were reproduced and fixed with explicit per-message years and percent-bearing tokens; corrupted copy now fails in both languages.
- Remote main advanced to `248036d16` with regional economies. Only this plan’s commits were rebased onto it, leaving the unrelated local-main navigation commit out. Regional preparation/check steps are preserved; final gates run again because their inputs changed.

## Final verification (2026-09-20)

- Integrated base: remote main `248036d16` (regional economies preserved); production build commit `32032ee1a854859583050f9038c7baa81333789a`.
- `npm run check`: 263 files / 2,265 tests passed, plus lint, typecheck, all data checks and localization (113 public page identities).
- `npm run build`: 235 static pages; 19 publications and their hashes verified; all five on-disk CSV checks plus regional and inflation CSV checks passed.
- Full browser suite against that production build: 570/570 passed in 3.1 minutes. Initial pre-integration suite also passed 540/540.
- Desktop and 390px mobile rendering inspected; no browser errors. Actual bilingual Excel downloads preserve the IMF URL, retrieval date and full 1995–2031 source coverage.
- Data/copy mutation checks reject changed GDP values, extra numbers, stale observation years, and unchecked percentages shaped like years; temporary files restored exactly.
- Independent review found two Important test gaps, both fixed in one pass. Post-fix unit suite passed before current-main integration; no deferred minor findings.
- No canonical data or financial values changed. No database migration, production deployment or merge was performed. Plan 5B and Plan 4 identifier changes remain separate.
- Source sentence for owner review: English now ends with “World Economic Outlook, April 2026.”; Georgian ends with “World Economic Outlook, 2026 წლის აპრილი.”.

Delivery: [draft PR #124](https://github.com/DuruMakh/geodata.ge/pull/124). GitHub records subsequent CI and merge state.

## Follow-up review fix pass (2026-09-21)

A fresh review of the current branch found one Important test-design gap and one Minor whitespace defect. Both were fixed inline:

- GDP summary checks now require each claim's expected figures to appear in order. Swapping the current and previous year or their two valid growth values fails in both locales instead of passing an unordered membership check.
- The latest growth value is tied to direction-sensitive wording (`grew by` / `contracted by` and the Georgian equivalents), so reversing the prose while retaining the same number fails.
- The trailing whitespace in `docs/data-methodology/gdp-overview.md` was removed; the full branch range now passes `git diff --check`.

The two regression cases were observed failing before the checker changed, then passing. Focused verification passed 5 files / 40 tests. Final `npm run check` passed lint, type checking, 263 files / 2,269 tests, all data validation, and localization. The production build generated 235 pages and verified 19 publications with data version `881113cae4fe683331ef75ddd067d08bcb7f5df376aa8f9ea1244030d7e106ff`. The browser suite was not repeated because this pass changed only safeguards and documentation, with no rendered UI input or component change. Deferred minors: none.

### Execution rulings and limits

- Consolidate plan Tasks 2/3 browser runs and Task 4 full data/build gates into Task 6 production acceptance — repository forbids repeating unchanged passing gates — cost if wrong: browser-only problems appear later.
- Make numeric-token completeness local to each summary message, not the plan's global allowed set, and inspect all summary messages — prevents one message borrowing an unrelated valid number — cost if wrong: extra editorial review on new numeric copy.
- marker contains only its label, not the year; assert its 100% rail position with a real 2027 projection fixture — proves visible placement — cost if wrong: test tied to existing rail rendering.
- augment baseline-only planned tests with a future-edition page/workbook test in both locales; update the short component fixture expectation to its actual 2026-only forecast — proves refresh behavior rather than hardcoded current output — cost if wrong: fixture maintenance.
- Record already-passed focused results without rerunning task-done solely for bookkeeping — repository forbids redundant passing gates — cost if wrong: ledger is manually recorded.
- update GDP methodology reference to removed CSV checker to surviving publication check — avoids documenting a deleted check — cost if wrong: documentation correction only.
- pipeline guards, GDP consistency and preliminary caveats remain Plan 5B scope — approved split — cost if wrong: refresh still needs pipeline work until 5B.
- preserve current deficit identifiers pending separate Plan 4 merge — explicit sequencing — cost if wrong: later merge needs reconciliation.
- rely on serving validators for sorted/nonempty actual-and-projection facts and reviewed manifest validation — accepted production input contract — cost if wrong: invalid inputs could render incorrect ranges.
- unsupported publication month fails loudly; semantic editorial interpretation stays manual — approved spec — cost if wrong: new month requires localization and editorial judgments require human review.
- reviewer did not judge delivery evidence; executor verifies build/browser/CI — separation of responsibilities — cost if wrong: overlooked delivery failure.
- rebase only this plan commits onto remote main 248036d16 after regional-economy merge; exclude unrelated local-main f7d3b5371 commit and preserve all regional prepare/check steps — clean PR scope and current integration — cost if wrong: integration regression; rerun changed-input completion gates.
