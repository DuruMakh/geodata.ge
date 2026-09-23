# SEO Metadata and Documentation Hygiene — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The GDP methodology page emits the same Dataset metadata as every other dataset, the economy URLs carry their own `lastmod`, and no comment, scope line or dead export contradicts what ships.

**Architecture:** Four small, independent changes: route the `gdp` methodology article through `datasetJsonLd`; derive three sitemap dates from their own facts; correct two lines of `Project_Definition.md`; and remove three pieces of stale or test-only code, followed by a formatting pass with no behaviour change.

**Tech Stack:** TypeScript, Next.js 16 App Router, Vitest 4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-17-seo-and-documentation-hygiene-design.md`

## Global Constraints

- **Branch and paths:** work on `codex/seo-and-doc-hygiene`, created from `main`. Never commit to `main`. Commands run from `apps/web`; repository paths are written `../../…`.
- **No user-facing copy changes** (spec §6). Nothing a reader sees moves, in either language.
- **Analytics are out of scope** by the user's decision on 2026-09-17: GA4, Microsoft Clarity, Vercel Analytics and Speed Insights stay exactly as they are.
- **Inflation keeps its hand-built Dataset JSON-LD** (spec §1.2): the shared vocabulary deliberately excludes it (`lib/seo/datasetVocabulary.ts:28-30`) and `tests/browser/inflation-overview.spec.ts:126` pins its shape.
- **No scope is added.** `Project_Definition.md` is corrected to match what already ships, nothing more.
- **`npx playwright test tests/browser/seo.spec.ts` needs `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`,** or about ten URL assertions fail for reasons unrelated to this work.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 6.

---

### Task 1: The GDP methodology page uses the shared Dataset builder

**Files:**
- Modify: `apps/web/lib/pages/methodology-article.tsx:133-141`
- Test: `apps/web/tests/browser/seo.spec.ts`

**Interfaces:**
- Consumes: `datasetJsonLd({ locale, origin, path, datasetId, name, description, firstYear, lastYear, dateModified, downloadPath, jsonDownloadPaths })` (`lib/seo/structuredData.ts:194`). `DATASET_SCHEMA_IDS.gdp` is already `"gdp-overview"` (`methodology-article.tsx:51`) and `DATASET_DOWNLOADS.gdp` is `/downloads/data/gdp-overview.csv`.
- The hand-built branch keeps `inflation` only.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/browser/seo.spec.ts`, beside the other JSON-LD assertions:

```ts
test("the GDP methodology page emits the shared Dataset vocabulary", async ({ page }) => {
  for (const path of ["/methodology/gdp", "/en/methodology/gdp"]) {
    await page.goto(`${TEST_BASE_URL}${path}`);
    const json = JSON.parse(
      (await page.getByTestId("dataset-json-ld").textContent()) ?? "{}",
    );

    expect(json["@type"], path).toBe("Dataset");
    expect(Array.isArray(json.keywords), `${path} keywords`).toBe(true);
    expect(json.keywords.length, `${path} keywords`).toBeGreaterThan(0);
    expect(Array.isArray(json.variableMeasured), `${path} variableMeasured`).toBe(true);
    expect(Array.isArray(json.distribution), `${path} distribution`).toBe(true);
    expect(json.distribution.map((entry: { contentUrl: string }) => entry.contentUrl)).toContain(
      `${TEST_BASE_URL}/downloads/data/gdp-overview.csv`,
    );
  }
});
```

Use the file's own base-URL constant and its `getByTestId` helper if it wraps them.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/seo.spec.ts -g "GDP methodology"`
Expected: FAIL — `keywords` and `variableMeasured` are absent and `distribution` is a single object.

- [ ] **Step 2: Narrow the hand-built branch**

In `apps/web/lib/pages/methodology-article.tsx`, change the branch condition from `dataset === "gdp" || dataset === "inflation"` to `dataset === "inflation"`, leaving the inflation object exactly as it is. The `datasetJsonLd(...)` call below already passes everything `gdp` needs; no other edit is required.

- [ ] **Step 3: Run the tests**

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/seo.spec.ts`
Expected: PASS, including the existing inflation JSON-LD assertions and `tests/browser/inflation-overview.spec.ts:126` if it runs in the same file set.

Run: `npx vitest run tests/seo`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/pages/methodology-article.tsx tests/browser/seo.spec.ts
git commit -m "fix(seo): emit the shared Dataset vocabulary on the GDP methodology page"
```

---

### Task 2: The economy URLs carry their own sitemap dates

**Files:**
- Modify: `apps/web/lib/seo/sitemap.ts` (lines 18–33 for the loads, 70–72 for the entries)
- Test: `apps/web/tests/seo/sitemap.test.ts` (extend, or create if absent)

**Interfaces:**
- Consumes: `loadServedGdpOverviewData()` and `loadServedEconomicSectorsData()`, which the sitemap does not load today. Both return facts carrying `lastReviewedAt`.
- The English list is produced by `georgian.flatMap(...)` at line 136, so each date is set once.

- [ ] **Step 1: Write the failing test**

Create or extend `apps/web/tests/seo/sitemap.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const gdpFact = (lastReviewedAt: string) => ({ seriesId: "nominal_gel", year: 2025, value: 1, status: "preliminary", lastReviewedAt });
const sectorFact = (lastReviewedAt: string) => ({ seriesId: "economy.gdp_total", measure: "nominal", year: 2025, value: 1, status: "preliminary", lastReviewedAt });

vi.mock("../../lib/data/gdpOverview/importGdpOverview", () => ({
  loadServedGdpOverviewData: async () => ({ facts: [gdpFact("2026-09-11"), gdpFact("2026-05-01")] }),
}));
vi.mock("../../lib/data/economicSectors/importEconomicSectors", () => ({
  loadServedEconomicSectorsData: async () => ({ facts: [sectorFact("2026-06-19")] }),
  ECONOMIC_SECTORS: [],
}));

describe("sitemap economy dates", () => {
  beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });

  it("dates the economy URLs from their own facts", async () => {
    const { default: sitemap } = await import("../../lib/seo/sitemap");
    const entries = await sitemap();
    const at = (url: string) => entries.find((entry) => entry.url === url)!;

    expect(at("https://fiscal.ge/explorer/economy/gdp").lastModified).toEqual(new Date("2026-09-11"));
    expect(at("https://fiscal.ge/explorer/economy/sectors").lastModified).toEqual(new Date("2026-06-19"));
    // The hub is the later of the two.
    expect(at("https://fiscal.ge/explorer/economy").lastModified).toEqual(new Date("2026-09-11"));
    // The English list mirrors the Georgian one.
    expect(at("https://fiscal.ge/en/explorer/economy/gdp").lastModified).toEqual(new Date("2026-09-11"));
  });
});
```

If the file already exists with its own mocking of the other loaders, add these two mocks and this case to it rather than re-mocking the world; the other loaders must stay mocked or the test loads the real CSVs.

Run: `npx vitest run tests/seo/sitemap.test.ts`
Expected: FAIL — the three URLs carry the budget `lastModified`.

- [ ] **Step 2: Derive the dates**

In `apps/web/lib/seo/sitemap.ts`, add the two loads to the existing `Promise.all` (they are memoised after the served-loading plan, and cheap either way):

```ts
  }, { facts: debtFacts }, { facts: balanceFacts }, { facts: inflationFacts }, { facts: gdpOverviewFacts }, { facts: sectorFacts }] = await Promise.all([
    loadServedLandingData(),
    loadServedMunicipalData(),
    loadServedGovernmentDebtData(),
    loadServedGeneralGovernmentBalanceData(),
    loadServedInflationData(),
    loadServedGdpOverviewData(),
    loadServedEconomicSectorsData(),
  ]);
```

with the two imports, and add beside `inflationModified`:

```ts
  // A GDP or sector refresh must move these URLs' lastmod, exactly as an
  // inflation or debt refresh moves theirs. They used to carry the budget date.
  const latestReviewed = (facts: readonly { lastReviewedAt: string }[]): Date | undefined =>
    facts.length > 0 ? new Date(facts.map((fact) => fact.lastReviewedAt).sort().at(-1)!) : undefined;
  const gdpModified = latestReviewed(gdpOverviewFacts);
  const sectorsModified = latestReviewed(sectorFacts);
  const economyModified = [gdpModified, sectorsModified]
    .filter((date): date is Date => date !== undefined)
    .sort((left, right) => right.getTime() - left.getTime())[0];
```

Replace lines 70–72:

```ts
    { url: `${siteUrl}/explorer/economy`, lastModified: economyModified },
    { url: `${siteUrl}/explorer/economy/gdp`, lastModified: gdpModified },
    { url: `${siteUrl}/explorer/economy/sectors`, lastModified: sectorsModified },
```

- [ ] **Step 3: Run the tests**

Run: `npx vitest run tests/seo`
Expected: PASS.

Run: `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/seo.spec.ts`
Expected: PASS — every sitemap URL still appears, in both languages.

- [ ] **Step 4: Commit**

```bash
git add lib/seo/sitemap.ts tests/seo/sitemap.test.ts
git commit -m "fix(seo): date the economy sitemap entries from their own facts"
```

---

### Task 3: The scope document stops contradicting what ships

**Files:**
- Modify: `Project_Definition.md` (the `მალე` line at :35 and the V2 exclusion at :85-86)

**Interfaces:**
- The sidebar's teasers are `const TEASERS = ["unemployment", "demography"]` (`components/shell/data-sidebar.tsx:18`), so the scope line names those two and nothing else.

- [ ] **Step 1: Correct the teaser line**

Replace the `მალე` bullet:

```markdown
- `მალე` markers for named future datasets (`უმუშევრობა` and `დემოგრაფია` in the sidebar). Labels only: no routes, not clickable, no data. Inflation and economic growth are no longer markers — both ship (see the Economy item above and 2C).
```

- [ ] **Step 2: Correct the V2 exclusion**

Replace the exclusion bullet so it no longer excludes a dataset that ships:

```markdown
- Any dataset V1 does not already serve, including quarterly and monthly data (inflation: see 2C),
  capital projects, and procurement.
```

Government debt ships at `/explorer/debt` (`Project_Definition.md:34`) and `/mcp` serves `query_debt`, so it leaves the exclusion list. No other line in this section changes.

- [ ] **Step 3: Check nothing else claims otherwise**

Run: `grep -n "მალე\|public debt" ../../Project_Definition.md`
Expected: the teaser line names only the two sidebar teasers, and no remaining line excludes public debt. If another line does, report it rather than editing beyond this spec.

- [ ] **Step 4: Commit**

```bash
git add ../../Project_Definition.md
git commit -m "docs(scope): match the scope text to the shipped datasets"
```

---

### Task 4: Remove stale comments and test-only runtime code

**Files:**
- Modify: `apps/web/lib/factQuery/index.ts:3-11`
- Modify: `apps/web/lib/methodology/catalog.ts:39-42` (delete `FUTURE_METHODOLOGY_DATASETS`)
- Modify: `apps/web/tests/methodology/catalog.test.ts:73-76` (delete the assertion and the import)
- Create: `apps/web/tests/helpers/contrast.ts`
- Modify: `apps/web/lib/explorer/inflationGrid.ts:44-54` (remove `luminance` and `contrastRatio`)
- Modify: `apps/web/tests/explorer/inflationGrid.test.ts:3`, `apps/web/tests/explorer/inflationCategoryGrid.test.ts:2`

**Interfaces:**
- Produces: `contrastRatio(foreground: string, background: string): number` in `tests/helpers/contrast.ts`, the same WCAG 2.x implementation, moved verbatim.
- `lib/explorer/colors.ts:160-174` keeps its own private luminance function; it is used in production and is not touched.

- [ ] **Step 1: Correct the entry-point comment**

In `apps/web/lib/factQuery/index.ts`, replace lines 3–11:

```ts
// The public entry point: one reviewable list of the query service's surface.
// Most consumers import from here. Two do not, deliberately — lib/mcp/tools.ts
// and lib/factQuery/publications.ts reach for modules inside the folder — so
// this list is the catalogue, not a wall.
//
// Every query function here is pure: each takes a FactQuerySnapshot and returns
// a FactQueryResponse, with no filesystem, database, network, model call or
// logging anywhere behind it (tests/factQuery/purity.test.ts enforces it).
// buildFactQuerySnapshot is the single exception and the only thing here that
// touches the loaders — build the snapshot once, then hand it to everything
// else.
```

- [ ] **Step 2: Delete the unused export and its assertion**

In `apps/web/lib/methodology/catalog.ts`, delete the `FUTURE_METHODOLOGY_DATASETS` export (lines 39–42).

In `apps/web/tests/methodology/catalog.test.ts`, delete the four assertion lines that pin it (73–76) and remove it from the file's import list. This is the one test expectation this plan removes: the value had no runtime importer, so the assertion pinned a constant only the test used.

Run: `grep -rn "FUTURE_METHODOLOGY_DATASETS" lib components app tests`
Expected: no matches.

- [ ] **Step 3: Move the contrast helper to the tests**

Create `apps/web/tests/helpers/contrast.ts`:

```ts
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG 2.x contrast ratio between two #RRGGBB colours. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}
```

Delete both functions from `apps/web/lib/explorer/inflationGrid.ts`, and change the two test imports:

```ts
import { CONTRIBUTION_BINS, GRID_TINTS, binFor, legendLabelsPp } from "../../lib/explorer/inflationGrid";
import { contrastRatio } from "../helpers/contrast";
```

```ts
import { GRID_TINTS, MOM_BINS, YOY_BINS, binFor, buildMonthGrid, decemberAverages, displayedValue, legendLabels } from "../../lib/explorer/inflationGrid";
import { contrastRatio } from "../helpers/contrast";
```

`tests/explorer/colors.test.ts`, `tests/explorer/themeTokens.test.ts` and `tests/browser/municipalities.spec.ts` each define their own local copy; leave them alone — consolidating them is not in this spec.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/explorer/inflationGrid.test.ts tests/explorer/inflationCategoryGrid.test.ts tests/methodology tests/factQuery/purity.test.ts`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: exit 0, with no unused-import warnings in the touched files.

- [ ] **Step 5: Commit**

```bash
git add lib/factQuery/index.ts lib/methodology/catalog.ts lib/explorer/inflationGrid.ts tests/helpers/contrast.ts tests/methodology/catalog.test.ts tests/explorer/inflationGrid.test.ts tests/explorer/inflationCategoryGrid.test.ts
git commit -m "chore: correct the query-service comment and drop test-only runtime code"
```

---

### Task 5: Reformat the dense one-line code

**Files:**
- Modify: `apps/web/lib/factQuery/queryEconomicSectors.ts` (whole file)
- Modify: `apps/web/lib/db/servedDataDb.ts:104`
- Modify: `apps/web/lib/db/mirrorRows.ts:459-462`
- Modify: `apps/web/lib/seo/datasetVocabulary.ts:97-98`
- Modify: any remaining single-line builder in `apps/web/lib/factQuery/publications.ts`, `apps/web/lib/factQuery/describeCoverage.ts` and `apps/web/lib/mcp/tools.ts`

**Interfaces:** none. This task changes no identifier, no value and no control flow.

- [ ] **Step 1: Record the behaviour before touching anything**

Run:

```bash
npm run data:prepare-fact-query-snapshot && cp lib/factQuery/generated/snapshot.json ../../.git/snapshot-before-format.json
```

- [ ] **Step 2: Reformat, one property or statement per line**

Work file by file, matching the surrounding style: object literals get one property per line, chained `.map(...).filter(...)` calls break at the dot, and long ternaries become `if`/`else` only where that is the file's existing idiom. Do not rename anything, do not reorder object keys, do not change a `const` to a `let`, and do not "simplify" an expression along the way — a reviewer must be able to read this diff as whitespace.

`lib/seo/datasetVocabulary.ts:97-98` is the clearest example: the `"economic-sectors"` and `"gdp-overview"` entries become the shape their neighbour `"national-expenditure"` already has (`:99-106`).

- [ ] **Step 3: Prove nothing moved**

Run: `npm run lint && npm run typecheck`
Expected: exit 0.

Run:

```bash
npm run data:prepare-fact-query-snapshot && diff ../../.git/snapshot-before-format.json lib/factQuery/generated/snapshot.json && rm ../../.git/snapshot-before-format.json
```

Expected: no differences, then the temporary file is removed.

Run: `npx vitest run tests/factQuery tests/db tests/seo`
Expected: PASS, with no test edited in this task. If a test needs changing, the reformat changed behaviour — revert that file and redo it.

- [ ] **Step 4: Commit**

```bash
git add lib/factQuery/queryEconomicSectors.ts lib/db/servedDataDb.ts lib/db/mirrorRows.ts lib/seo/datasetVocabulary.ts lib/factQuery/publications.ts lib/factQuery/describeCoverage.ts lib/mcp/tools.ts
git commit -m "style: format the dense one-line builders to the surrounding style"
```

---

### Task 6: Done-check and acceptance

**Files:** none (verification only).

- [ ] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: exit 0, and `git status` clean — no regenerated artifact changed.

- [ ] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass.

- [ ] **Step 4: Acceptance walk**

1. `/methodology/gdp` and `/en/methodology/gdp` carry `keywords`, `variableMeasured` and an array `distribution` naming `gdp-overview.csv`; `/methodology/inflation` is unchanged.
2. `/sitemap.xml` gives `/explorer/economy`, `/explorer/economy/gdp` and `/explorer/economy/sectors` their own `lastmod`, in both language lists.
3. `Project_Definition.md` names only the two sidebar teasers and no longer excludes public debt.
4. `FUTURE_METHODOLOGY_DATASETS` and the test-only contrast helpers are gone from `lib/`.
5. The reformatted files changed no behaviour: the snapshot is byte-identical and no test was edited for them.

- [ ] **Step 5: Hand off**

Push `codex/seo-and-doc-hygiene` and open a draft PR. Note in the description that the one removed test expectation is `catalog.test.ts`'s `FUTURE_METHODOLOGY_DATASETS` assertion, as the spec approves. Merge only after CI is green.
