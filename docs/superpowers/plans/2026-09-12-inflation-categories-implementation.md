# Inflation Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/explorer/inflation/categories` — Georgia's CPI decomposed into its 12 COICOP divisions and 43 subgroups, with a derived contribution-to-inflation measure whose parts always re-add to the published headline.

**Architecture:** Category price changes already sit in the archived Geostat `yoy`/`mom` workbooks the overview reads and ignores; the reader gains a category mode. Basket weights are one new annually-refreshed archived source. Two new canonical CSVs mirror into two new Prisma models. Contributions are never stored: they are derived at build time from published changes and weights, following the `% of GDP` precedent in `lib/explorer/debtExplorer.ts`, with a residual that closes the stack on the published headline exactly.

**Tech Stack:** Next.js 16, strict TypeScript, Tailwind v4, Prisma 7 / Supabase Postgres, `xlsx`, `decimal.js`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-12-inflation-categories-design.md` — read it before Task 1 and keep it open; every task argues from it.

## Global Constraints

- Run every command from `apps/web`.
- Canonical CSVs store **published values only**. Contributions are never written to a CSV.
- Category IDs are lowercase ASCII COICOP codes: divisions `cpi.cat.01`…`cpi.cat.12`, subgroups `cpi.cat.01_1`…`cpi.cat.12_7`. Labels are display data.
- Weights are stored as **percentages with six decimals** (`30.320378`); the arithmetic divides by 100.
- Contributions exist from **2013-01** only. Category y/y starts 2005-01, m/m starts 2004-01.
- Category series may have gaps; the national series may not. Never relax the national rule.
- The overview's extraction path (the `Total` row) and every existing inflation test must stay **unmodified and green**.
- Feedback loop is the narrowest command that observes your change (`npx vitest run tests/<file>`, ~5s). `npm run check`, `npm run build` and `npm run test:browser` are the done-check in Task 17, run once.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Do not push, open a PR, or run `npm run data:import` against production. Publishing needs explicit authorization.

## File Structure

**Data layer** (`apps/web/lib/data/inflation/`)
- `types.ts` — *modify*: add `CpiCategoryFact`, `BasketWeightRow`, their served twins, `categoryIdFromCoicop`.
- `readGeostatCpi.ts` — *modify*: add `readGeostatCpiCategories`, gap-tolerant. The `Total` path is untouched.
- `readBasketWeights.ts` — *create*: the weights workbook reader.
- `basketWeightFiles.ts` — *create*: manifest verification for the weights archive.
- `validateInflation.ts` — *modify*: add `validateCategoryFacts`, `validateBasketWeights`.
- `contributions.ts` — *create*: the contribution formula, the residual, and the reconstruction check. Pure; used by both the pipeline and the page.
- `prepareInflation.ts` — *modify*: write and check the two new CSVs, extend the report.
- `importInflation.ts` — *modify*: `loadCpiCategoryFacts`, `loadBasketWeights`, parity, served loader.

**Serving** — `prisma/schema.prisma`, one migration, `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `lib/data/servedData.ts`, `scripts/import-budget-facts.ts`.

**Explorer** (`apps/web/lib/explorer/`)
- `inflationCategories.ts` — *create*: state, hash, coverage, selection, chart and table models. Mirrors `inflationOverview.ts`.
- `inflationCategoryLabels.ts` — *create*: category labels and colours.
- `inflationCategoryWorkbook.ts` — *create*: the export model.
- `colors.ts`, `inflationGrid.ts`, `inflationHubCards.ts` — *modify*.

**Components** — `components/main-explorer/stacked-column-chart.tsx` (*create*), `components/inflation/inflation-categories.tsx`, `-category-panel.tsx`, `-category-table.tsx`, `-category-indicators.tsx` (*create*), `series-selector.tsx` (*modify*, one optional prop), `shell/data-sidebar.tsx` (*modify*).

**Routes** — `app/(ka)/explorer/inflation/categories/page.tsx`, `app/(en)/en/explorer/inflation/categories/page.tsx`, `lib/pages/inflation.tsx` (*modify*).

**Data and docs** — `data/imports/cpi-categories-monthly.csv`, `data/imports/cpi-basket-weights.csv`, `docs/Raw Data/Inflation/geostat-basket-weights/2026/`, `data/sources/source-documents.csv`, `data/methodology/source-archives/inflation.csv`, `docs/data-methodology/inflation-cpi-national.md`, `Project_Definition.md`, `DESIGN.md`.

---

### Task 1: Archive the basket-weights source

**Files:**
- Create: `docs/Raw Data/Inflation/geostat-basket-weights/2026/en/basket-weights.xlsx`
- Create: `docs/Raw Data/Inflation/geostat-basket-weights/2026/source-manifest.csv`
- Create: `docs/Raw Data/Inflation/geostat-basket-weights/2026/README.md`
- Modify: `data/sources/source-documents.csv`

**Interfaces:**
- Consumes: nothing.
- Produces: source id `source.geostat_basket_weights` (and `source.geostat_basket_weights_ka` if a Georgian file exists), and a manifest with the columns `file_role,language,source_id,title,source_page_url,retrieved_file_url,retrieved_at,local_file,sha256,bytes` — the same header the CPI vintages use.

- [ ] **Step 1: Download the English file**

Geostat blocks Python's TLS client and redirects `geostat.ge` → `www.geostat.ge`, so use curl with a browser agent and follow redirects:

```bash
mkdir -p "../../docs/Raw Data/Inflation/geostat-basket-weights/2026/en"
curl -sSL -A "Mozilla/5.0" -o "../../docs/Raw Data/Inflation/geostat-basket-weights/2026/en/basket-weights.xlsx" "https://geostat.ge/media/76662/Consumer-basket-weights.xlsx"
```

Expected: about 25,626 bytes. A zero-byte file means the redirect was not followed.

- [ ] **Step 2: Find the Georgian twin**

Open `https://www.geostat.ge/ka/modules/categories/26/cpi-inflation` and find the download link whose title is `სამომხმარებლო კალათის წონები`. **Do not reuse media id 76653** — that URL was produced by an automated page read and returns 404. If the Georgian file exists, download it to `ka/basket-weights.xlsx` and add a manifest row for it. If it genuinely does not exist, record that in the README and the methodology and continue with English only; Georgian category labels come from the CPI workbooks, not from this file.

- [ ] **Step 3: Write the manifest**

Compute the real values rather than copying these:

```bash
cd "../../docs/Raw Data/Inflation/geostat-basket-weights/2026"
sha256sum en/basket-weights.xlsx && stat -c %s en/basket-weights.xlsx
```

Then write `source-manifest.csv` with a leading BOM, one row per file:

```
file_role,language,source_id,title,source_page_url,retrieved_file_url,retrieved_at,local_file,sha256,bytes
weights,en,source.geostat_basket_weights,"Consumer basket weights, %",https://www.geostat.ge/en/modules/categories/26/cpi-inflation,https://geostat.ge/media/76662/Consumer-basket-weights.xlsx,<today>,en/basket-weights.xlsx,<sha256>,<bytes>
```

- [ ] **Step 4: Write the README**

```markdown
# Geostat consumer basket weights — 2026

Untouched Geostat basket-weight workbook, covering 2012–2026. Unlike the CPI
vintages this file refreshes once a year, in January, so it lives in its own
tree named after the latest year it covers. English is canonical.
`source-manifest.csv` records the download URL, date, byte count and SHA-256.
```

- [ ] **Step 5: Register the source**

Add a row to `data/sources/source-documents.csv` with `source_id` `source.geostat_basket_weights`, following the shape of the existing `source.geostat_cpi_yoy` row exactly (same publisher, same archive conventions). Read that row first and match every column.

- [ ] **Step 6: Verify the file parses and the sums are exact**

```bash
node -e "const X=require('./node_modules/xlsx');const r=X.utils.sheet_to_json(X.readFile('../../docs/Raw Data/Inflation/geostat-basket-weights/2026/en/basket-weights.xlsx').Sheets['Weights'],{header:1,raw:true,defval:null});console.log(r[2].slice(0,5),r[3].slice(4,7));console.log('rows',r.length)"
```

Expected: row 2 reads `N | Level | COICOP code | Groups/subgroups | Year`, row 3 starts at 2012, 73 rows.

- [ ] **Step 7: Commit**

```bash
git add "../../docs/Raw Data/Inflation/geostat-basket-weights" ../../data/sources/source-documents.csv
git commit -m "data(inflation): archive the Geostat consumer basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: COICOP identity helper

**Files:**
- Modify: `lib/data/inflation/types.ts`
- Test: `tests/data/inflation/categoryIds.test.ts`

**Interfaces:**
- Produces:
  - `CPI_CATEGORY_MEASURES = ["yoy_pct", "mom_pct"] as const`, `type CpiCategoryMeasure`
  - `type CpiCategoryFact = { categoryId, coicopCode, level: 2 | 3, parentId: string | null, measure: CpiCategoryMeasure, period: string, value: string, status: "published", sourceId: string, sourceLocator: string, lastReviewedAt: string }`
  - `type ServedCpiCategoryFact = Omit<CpiCategoryFact, "value"> & { value: number }`
  - `type BasketWeightRow = { categoryId: string; year: number; weightPct: string; sourceId: string; lastReviewedAt: string }`
  - `type ServedBasketWeightRow = Omit<BasketWeightRow, "weightPct"> & { weightPct: number }`
  - `categoryIdFromCoicop(code: string, level: 2 | 3): { categoryId: string; parentId: string | null }`

- [ ] **Step 1: Write the failing test**

The ambiguity this helper exists to remove: Geostat writes both division 11 (Restaurants and hotels) and subgroup 11 (Food, under division 1) as the bare code `11`. Only the level separates them.

```ts
// tests/data/inflation/categoryIds.test.ts
import { describe, expect, it } from "vitest";
import { categoryIdFromCoicop } from "../../../lib/data/inflation/types";

describe("categoryIdFromCoicop", () => {
  it("pads divisions to two digits", () => {
    expect(categoryIdFromCoicop("1", 2)).toEqual({ categoryId: "cpi.cat.01", parentId: null });
    expect(categoryIdFromCoicop("12", 2)).toEqual({ categoryId: "cpi.cat.12", parentId: null });
  });

  it("separates a subgroup from the division sharing its digits", () => {
    expect(categoryIdFromCoicop("11", 3)).toEqual({ categoryId: "cpi.cat.01_1", parentId: "cpi.cat.01" });
    expect(categoryIdFromCoicop("11", 2)).toEqual({ categoryId: "cpi.cat.11", parentId: null });
  });

  it("splits three-digit codes on the last digit", () => {
    expect(categoryIdFromCoicop("105", 3)).toEqual({ categoryId: "cpi.cat.10_5", parentId: "cpi.cat.10" });
    expect(categoryIdFromCoicop("127", 3)).toEqual({ categoryId: "cpi.cat.12_7", parentId: "cpi.cat.12" });
  });

  it("rejects codes outside the twelve divisions", () => {
    expect(() => categoryIdFromCoicop("13", 2)).toThrow(/division/);
    expect(() => categoryIdFromCoicop("0", 2)).toThrow(/division/);
    expect(() => categoryIdFromCoicop("x1", 3)).toThrow(/COICOP code/);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/categoryIds.test.ts`
Expected: FAIL — `categoryIdFromCoicop is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/data/inflation/types.ts`:

```ts
export const CPI_CATEGORY_MEASURES = ["yoy_pct", "mom_pct"] as const;
export type CpiCategoryMeasure = (typeof CPI_CATEGORY_MEASURES)[number];

export type CpiCategoryFact = {
  categoryId: string;
  coicopCode: string;
  level: 2 | 3;
  parentId: string | null;
  measure: CpiCategoryMeasure;
  period: string;
  value: string;
  status: "published";
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedCpiCategoryFact = Omit<CpiCategoryFact, "value"> & { value: number };

/** Weights are stored as percentages with six decimals; the arithmetic divides by 100. */
export type BasketWeightRow = { categoryId: string; year: number; weightPct: string; sourceId: string; lastReviewedAt: string };
export type ServedBasketWeightRow = Omit<BasketWeightRow, "weightPct"> & { weightPct: number };

// Geostat writes COICOP codes bare: division 11 and subgroup 11 (Food, under
// division 1) are both "11". Only the level tells them apart, so the ID carries
// the division padded to two digits and the subgroup after an underscore.
export function categoryIdFromCoicop(code: string, level: 2 | 3): { categoryId: string; parentId: string | null } {
  if (!/^\d{1,3}$/.test(code)) throw new Error(`Unexpected COICOP code ${code}`);
  const divisionDigits = level === 2 ? code : code.slice(0, -1);
  const division = Number(divisionDigits);
  if (!Number.isInteger(division) || division < 1 || division > 12) throw new Error(`COICOP division out of range: ${code}`);
  const parentId = `cpi.cat.${String(division).padStart(2, "0")}`;
  return level === 2 ? { categoryId: parentId, parentId: null } : { categoryId: `${parentId}_${code.slice(-1)}`, parentId };
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/categoryIds.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/data/inflation/types.ts tests/data/inflation/categoryIds.test.ts
git commit -m "feat(inflation): COICOP category identity helper" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Read categories out of the CPI workbooks

**Files:**
- Modify: `lib/data/inflation/readGeostatCpi.ts`
- Test: `tests/data/inflation/readGeostatCpiCategories.test.ts`

**Interfaces:**
- Consumes: `CpiLanguage`, `text`, `numeric`, `locator`, `findMonthHeader` from the same module.
- Produces: `type ParsedCategoryCell = { period: number; value: string; locator: string }`, `type ParsedCategorySeries = { coicopCode: string; level: 2 | 3; label: string; cells: ParsedCategoryCell[] }`, and `readGeostatCpiCategories(content: Buffer, role: "yoy" | "mom", language: CpiLanguage): ParsedCategorySeries[]`.

**Why a second function rather than a flag:** the national path must be provably unchanged, and the two differ in the one rule that matters — the `Total` row may never have a gap, category rows may.

- [ ] **Step 1: Write the failing test**

Tests read the committed archive; it is deterministic and hash-verified.

```ts
// tests/data/inflation/readGeostatCpiCategories.test.ts
import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readGeostatCpiCategories } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage } from "../../../lib/data/inflation/sourceFiles";
import { periodKey } from "../../../lib/data/inflation/periods";

async function workbook(language: "en" | "ka", role: "yoy" | "mom") {
  const vintage = await latestCpiVintage();
  const file = role === "yoy" ? "cpi-yoy.xlsx" : "cpi-mom.xlsx";
  return fs.readFile(path.join(INFLATION_RAW_ROOT, "geostat-cpi", vintage, language, file));
}

describe("readGeostatCpiCategories", () => {
  it("reads twelve divisions and forty-three subgroups", async () => {
    const series = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    expect(series.filter((row) => row.level === 2)).toHaveLength(12);
    expect(series.filter((row) => row.level === 3)).toHaveLength(43);
  });

  it("keeps Geostat's own labels per language", async () => {
    const en = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    const ka = readGeostatCpiCategories(await workbook("ka", "yoy"), "yoy", "ka");
    expect(en.find((row) => row.coicopCode === "7" && row.level === 2)?.label).toBe("Transport");
    expect(ka.find((row) => row.coicopCode === "7" && row.level === 2)?.label).toBe("ტრანსპორტი");
    expect(en.map((row) => `${row.level}:${row.coicopCode}`)).toEqual(ka.map((row) => `${row.level}:${row.coicopCode}`));
  });

  it("rebases the =100 index to percentage change", async () => {
    const series = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    const transport = series.find((row) => row.coicopCode === "7" && row.level === 2)!;
    const last = transport.cells.at(-1)!;
    expect(periodKey(last.period)).toBe("2026-08");
    expect(Number(last.value)).toBeCloseTo(15.2, 1);
  });

  it("tolerates discontinued and late-starting categories", async () => {
    const series = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    const postal = series.find((row) => row.coicopCode === "81")!;
    expect(periodKey(postal.cells.at(-1)!.period)).toBe("2011-12");
    const holidays = series.find((row) => row.coicopCode === "96")!;
    expect(periodKey(holidays.cells[0]!.period)).toBe("2020-01");
  });

  it("keeps interior gaps as absent months rather than shifting later values", async () => {
    const series = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    const insurance = series.find((row) => row.coicopCode === "125")!;
    const periods = insurance.cells.map((cell) => cell.period);
    expect(periods).toEqual([...periods].sort((a, b) => a - b));
    expect(new Set(periods).size).toBe(periods.length);
    expect(periods.length).toBeLessThan(periods.at(-1)! - periods[0]! + 1);
  });

  it("starts monthly change a year before annual change", async () => {
    const yoy = readGeostatCpiCategories(await workbook("en", "yoy"), "yoy", "en");
    const mom = readGeostatCpiCategories(await workbook("en", "mom"), "mom", "en");
    const first = (rows: typeof yoy) => periodKey(rows.find((row) => row.coicopCode === "7" && row.level === 2)!.cells[0]!.period);
    expect(first(yoy)).toBe("2005-01");
    expect(first(mom)).toBe("2004-01");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/readGeostatCpiCategories.test.ts`
Expected: FAIL — `readGeostatCpiCategories is not a function`.

- [ ] **Step 3: Implement**

Append to `lib/data/inflation/readGeostatCpi.ts`. Note it reuses the module's existing `text`, `numeric`, `locator`, `findMonthHeader`, `NATIONAL_SHEET`, `EN_TITLES` and `toValue` helpers — do not duplicate them.

```ts
export type ParsedCategoryCell = { period: number; value: string; locator: string };
export type ParsedCategorySeries = { coicopCode: string; level: 2 | 3; label: string; cells: ParsedCategoryCell[] };

// The national sheet of the yoy and mom workbooks carries the whole COICOP tree
// under the Total row: column A the level, B the code, C the label. Category rows
// may start late, end early or skip months, so unlike the Total row they are read
// gap-tolerantly — but the months are still located by the shared header.
export function readGeostatCpiCategories(content: Buffer, role: "yoy" | "mom", language: CpiLanguage): ParsedCategorySeries[] {
  const book = XLSX.read(content, { type: "buffer" });
  const found = book.SheetNames.find((name) => name.trim() === NATIONAL_SHEET[language]);
  if (!found) throw new Error(`CPI layout: national sheet "${NATIONAL_SHEET[language]}" not found in ${role}`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[found]!, { header: 1, raw: true, defval: null });
  if (language === "en" && !text(rows[0]?.[0]).toLowerCase().includes(EN_TITLES[role].toLowerCase())) {
    throw new Error(`CPI layout: ${role} title does not contain "${EN_TITLES[role]}"`);
  }
  const sheet = found.trim();
  const header = findMonthHeader(rows);
  const years = rows[header.row - 1] ?? [];
  const months = rows[header.row] ?? [];
  if (language === "en" && text(rows[header.row - 1]?.[0]) !== "Level") {
    throw new Error(`CPI layout: ${role} has no Level column where the category tree is expected`);
  }

  const series: ParsedCategorySeries[] = [];
  for (let row = header.row + 1; row < rows.length; row += 1) {
    const values = rows[row] ?? [];
    const level = numeric(values[0]);
    if (level === null) continue;
    if (level !== 2 && level !== 3) throw new Error(`CPI layout: unexpected category level ${level} at row ${row + 1}`);
    const code = text(values[1]);
    if (!/^\d{1,3}$/.test(code)) throw new Error(`CPI layout: category row ${row + 1} has no COICOP code`);
    const label = text(values[2]);
    if (label === "") throw new Error(`CPI layout: category ${code} has no label at row ${row + 1}`);

    const cells: ParsedCategoryCell[] = [];
    for (let col = header.col; col < months.length; col += 1) {
      const monthLabel = text(months[col]);
      if (monthLabel === "") break;
      const offset = col - header.col;
      if (monthLabel !== MONTHS[offset % 12]) throw new Error(`CPI layout: unexpected month header "${monthLabel}" at ${locator(sheet, header.row, col)}`);
      const year = numeric(years[col - (offset % 12)]);
      if (year === null || !Number.isInteger(year)) throw new Error(`CPI layout: no year above ${locator(sheet, header.row, col)}`);
      const raw = numeric(values[col]);
      // A gap is data about the category, not a layout fault: 04.2 and 08.1 end in
      // 2011, 09.6 starts in 2020, 12.5 and 12.6 skip interior months.
      if (raw === null) continue;
      cells.push({ period: makePeriod(year, (offset % 12) + 1), value: toValue(raw, true), locator: locator(sheet, row, col) });
    }
    if (cells.length === 0) throw new Error(`CPI layout: category ${code} has no values`);
    series.push({ coicopCode: code, level, label, cells });
  }

  if (series.filter((row) => row.level === 2).length !== 12) {
    throw new Error(`CPI layout: expected 12 COICOP divisions in ${role}, found ${series.filter((row) => row.level === 2).length}`);
  }
  return series;
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/readGeostatCpiCategories.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Prove the national path did not move**

Run: `npx vitest run tests/data/inflation/prepareInflation.test.ts`
Expected: PASS, unmodified.

- [ ] **Step 6: Commit**

```bash
git add lib/data/inflation/readGeostatCpi.ts tests/data/inflation/readGeostatCpiCategories.test.ts
git commit -m "feat(inflation): read the COICOP tree from the CPI workbooks" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Read the basket weights

**Files:**
- Create: `lib/data/inflation/readBasketWeights.ts`
- Create: `lib/data/inflation/basketWeightFiles.ts`
- Test: `tests/data/inflation/readBasketWeights.test.ts`

**Interfaces:**
- Consumes: `categoryIdFromCoicop` (Task 2).
- Produces:
  - `type ParsedWeightRow = { coicopCode: string; level: 2 | 3; label: string; byYear: Map<number, string> }`
  - `readGeostatBasketWeights(content: Buffer): ParsedWeightRow[]` — values already converted to percentages with six decimals.
  - `BASKET_WEIGHTS_ROOT`, `latestBasketWeightVintage(rawRoot?): Promise<string>`, `readVerifiedBasketWeightFiles(vintageDir: string): Promise<VerifiedBasketWeightFile[]>` where `VerifiedBasketWeightFile = { source_id: string; language: "en" | "ka"; retrieved_at: string; local_file: string; content: Buffer }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/inflation/readBasketWeights.test.ts
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { readGeostatBasketWeights } from "../../../lib/data/inflation/readBasketWeights";
import { BASKET_WEIGHTS_ROOT, latestBasketWeightVintage, readVerifiedBasketWeightFiles } from "../../../lib/data/inflation/basketWeightFiles";
import path from "node:path";

async function english() {
  const vintage = await latestBasketWeightVintage();
  const files = await readVerifiedBasketWeightFiles(path.join(BASKET_WEIGHTS_ROOT, vintage));
  return files.find((file) => file.language === "en")!.content;
}

describe("readGeostatBasketWeights", () => {
  it("reads twelve divisions and forty-one subgroups", async () => {
    const rows = readGeostatBasketWeights(await english());
    expect(rows.filter((row) => row.level === 2)).toHaveLength(12);
    expect(rows.filter((row) => row.level === 3)).toHaveLength(41);
  });

  it("covers 2012 to the current year", async () => {
    const rows = readGeostatBasketWeights(await english());
    const years = [...rows.find((row) => row.coicopCode === "1" && row.level === 2)!.byYear.keys()];
    expect(Math.min(...years)).toBe(2012);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2026);
  });

  it("converts fractions to percentages", async () => {
    const rows = readGeostatBasketWeights(await english());
    const food = rows.find((row) => row.coicopCode === "1" && row.level === 2)!;
    expect(Number(food.byYear.get(2026))).toBeCloseTo(33.6, 1);
  });

  it("sums each level to 100 percent in every year", async () => {
    const rows = readGeostatBasketWeights(await english());
    const years = [...rows[0]!.byYear.keys()];
    for (const level of [2, 3] as const) {
      for (const year of years) {
        const total = rows
          .filter((row) => row.level === level)
          .reduce((sum, row) => sum.plus(row.byYear.get(year) ?? "0"), new Decimal(0));
        expect(Math.abs(total.minus(100).toNumber())).toBeLessThan(0.001);
      }
    }
  });

  it("omits the two subgroups that ended before weights began", async () => {
    const rows = readGeostatBasketWeights(await english());
    expect(rows.some((row) => row.level === 3 && row.coicopCode === "42")).toBe(false);
    expect(rows.some((row) => row.level === 3 && row.coicopCode === "81")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/readBasketWeights.test.ts`
Expected: FAIL — cannot resolve `readBasketWeights`.

- [ ] **Step 3: Implement the manifest reader**

`lib/data/inflation/basketWeightFiles.ts` — the same discipline as `sourceFiles.ts`, verifying bytes and SHA-256:

```ts
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";

export const BASKET_WEIGHTS_ROOT = path.resolve(process.cwd(), "../../docs/Raw Data/Inflation/geostat-basket-weights");

const rowSchema = z.object({
  file_role: z.literal("weights"),
  language: z.enum(["en", "ka"]),
  source_id: z.string().regex(/^source\.[a-z0-9_]+$/),
  title: z.string().min(1),
  source_page_url: z.string().url(),
  retrieved_file_url: z.string().url(),
  retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  local_file: z.string().min(1),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  bytes: z.coerce.number().int().positive(),
});

export type BasketWeightManifestRow = z.infer<typeof rowSchema>;
export type VerifiedBasketWeightFile = BasketWeightManifestRow & { content: Buffer };

/** The newest weights folder, named after the last year it covers. */
export async function latestBasketWeightVintage(root = BASKET_WEIGHTS_ROOT): Promise<string> {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const vintages = entries.filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name)).map((entry) => entry.name).sort();
  const latest = vintages.at(-1);
  if (!latest) throw new Error("No basket-weight vintage under docs/Raw Data/Inflation/geostat-basket-weights");
  return latest;
}

export async function readVerifiedBasketWeightFiles(vintageDir: string): Promise<VerifiedBasketWeightFile[]> {
  const text = await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record) => rowSchema.parse(record));
  if (rows.filter((row) => row.language === "en").length !== 1) throw new Error("Basket-weight manifest must list exactly one English file");
  return Promise.all(
    rows.map(async (row) => {
      const content = await fs.readFile(path.join(vintageDir, row.local_file));
      const sha256 = createHash("sha256").update(content).digest("hex");
      if (content.length !== row.bytes || sha256 !== row.sha256) throw new Error(`Basket-weight source hash mismatch: ${row.local_file}`);
      return { ...row, content };
    }),
  );
}
```

- [ ] **Step 4: Implement the workbook reader**

`lib/data/inflation/readBasketWeights.ts`:

```ts
import Decimal from "decimal.js";
import * as XLSX from "xlsx";

export type ParsedWeightRow = { coicopCode: string; level: 2 | 3; label: string; byYear: Map<number, string> };

const SHEET = "Weights";
const TITLE = "consumer basket weights";

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw).replace(/\s+/g, " ").trim();
}

// Geostat publishes weights as fractions of one, one column per year from 2012.
// They are stored as percentages with six decimals, so the yearly sums are checked
// against 100 with a tolerance rather than for equality (spec §3.5).
export function readGeostatBasketWeights(content: Buffer): ParsedWeightRow[] {
  const book = XLSX.read(content, { type: "buffer" });
  const sheet = book.Sheets[SHEET];
  if (!sheet) throw new Error(`Basket weights: sheet "${SHEET}" not found`);
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  if (!text(rows[0]?.[0]).toLowerCase().includes(TITLE)) throw new Error("Basket weights: unexpected title row");
  const headerRow = rows.findIndex((row) => text(row?.[1]) === "Level" && text(row?.[2]) === "COICOP code");
  if (headerRow === -1) throw new Error("Basket weights: Level / COICOP code header not found");
  const yearRow = rows[headerRow + 1] ?? [];
  const years: Array<{ year: number; col: number }> = [];
  for (let col = 4; col < yearRow.length; col += 1) {
    const year = yearRow[col];
    if (typeof year === "number" && Number.isInteger(year) && year > 2000 && year < 2100) years.push({ year, col });
  }
  if (years.length === 0) throw new Error("Basket weights: no year columns");

  const parsed: ParsedWeightRow[] = [];
  let sawTotal = false;
  for (let row = headerRow + 2; row < rows.length; row += 1) {
    const values = rows[row] ?? [];
    const level = values[1];
    if (typeof level !== "number") continue;
    if (level === 0) {
      sawTotal = true;
      continue;
    }
    if (level !== 2 && level !== 3) throw new Error(`Basket weights: unexpected level ${level} at row ${row + 1}`);
    const code = text(values[2]);
    if (!/^\d{1,3}$/.test(code)) throw new Error(`Basket weights: row ${row + 1} has no COICOP code`);
    const byYear = new Map<number, string>();
    for (const { year, col } of years) {
      const raw = values[col];
      if (typeof raw !== "number") continue;
      byYear.set(year, new Decimal(String(raw)).times(100).toFixed(6));
    }
    if (byYear.size === 0) throw new Error(`Basket weights: category ${code} has no values`);
    parsed.push({ coicopCode: code, level, label: text(values[3]), byYear });
  }
  if (!sawTotal) throw new Error("Basket weights: the Total row is missing");
  if (parsed.filter((row) => row.level === 2).length !== 12) throw new Error("Basket weights: expected 12 COICOP divisions");
  return parsed;
}
```

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/readBasketWeights.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Commit**

```bash
git add lib/data/inflation/readBasketWeights.ts lib/data/inflation/basketWeightFiles.ts tests/data/inflation/readBasketWeights.test.ts
git commit -m "feat(inflation): read the Geostat basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Validate categories and weights

**Files:**
- Modify: `lib/data/inflation/validateInflation.ts`
- Test: `tests/data/inflation/validateCategories.test.ts`

**Interfaces:**
- Consumes: `CpiCategoryFact`, `BasketWeightRow` (Task 2).
- Produces:
  - `categoryFactKey(fact): string` — `${categoryId}:${measure}:${period}`
  - `validateCategoryFacts(facts: CpiCategoryFact[]): { lastPeriod: string; categoryCount: number; gaps: string[] }`
  - `validateBasketWeights(weights: BasketWeightRow[], categoryIds: Set<string>): { years: number[]; maxSumErrorPct: number }`
  - `findCategoryRevisions(previous, next): string[]`, `assertNoCategoryRevisions(previous, next): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/inflation/validateCategories.test.ts
import { describe, expect, it } from "vitest";
import { validateBasketWeights, validateCategoryFacts, assertNoCategoryRevisions } from "../../../lib/data/inflation/validateInflation";
import type { BasketWeightRow, CpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (over: Partial<CpiCategoryFact> = {}): CpiCategoryFact => ({
  categoryId: "cpi.cat.01", coicopCode: "1", level: 2, parentId: null, measure: "yoy_pct",
  period: "2026-08", value: "5.02", status: "published", sourceId: "source.geostat_cpi_yoy",
  sourceLocator: "Georgia!D7", lastReviewedAt: "2026-09-11", ...over,
});
const weight = (over: Partial<BasketWeightRow> = {}): BasketWeightRow => ({
  categoryId: "cpi.cat.01", year: 2026, weightPct: "100.000000", sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12", ...over,
});

describe("validateCategoryFacts", () => {
  it("accepts a gap and reports it", () => {
    const result = validateCategoryFacts([
      fact({ period: "2026-06" }),
      fact({ period: "2026-08" }),
    ]);
    expect(result.lastPeriod).toBe("2026-08");
    expect(result.gaps).toEqual(["cpi.cat.01:yoy_pct after 2026-06"]);
  });

  it("rejects a subgroup whose parent is absent", () => {
    expect(() => validateCategoryFacts([fact({ categoryId: "cpi.cat.09_6", coicopCode: "96", level: 3, parentId: "cpi.cat.09" })]))
      .toThrow(/parent/);
  });

  it("rejects a duplicate observation", () => {
    expect(() => validateCategoryFacts([fact(), fact()])).toThrow(/Duplicate/);
  });

  it("rejects an implausible rate", () => {
    expect(() => validateCategoryFacts([fact({ value: "412" })])).toThrow(/plausible/);
  });
});

describe("validateBasketWeights", () => {
  const ids = new Set(["cpi.cat.01"]);

  it("accepts a level that sums to 100", () => {
    expect(validateBasketWeights([weight()], ids).years).toEqual([2026]);
  });

  it("rejects a level that does not sum to 100", () => {
    expect(() => validateBasketWeights([weight({ weightPct: "94.000000" })], ids)).toThrow(/sum/);
  });

  it("rejects a weight for a category with no price data", () => {
    expect(() => validateBasketWeights([weight({ categoryId: "cpi.cat.04_2" })], ids)).toThrow(/no price data/);
  });
});

describe("assertNoCategoryRevisions", () => {
  it("throws when a published month changes", () => {
    expect(() => assertNoCategoryRevisions([fact()], [fact({ value: "5.03" })])).toThrow(/revised/);
  });

  it("passes when history is untouched and a month is added", () => {
    expect(() => assertNoCategoryRevisions([fact()], [fact(), fact({ period: "2026-09" })])).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/validateCategories.test.ts`
Expected: FAIL — the four functions are not exported.

- [ ] **Step 3: Implement**

Append to `lib/data/inflation/validateInflation.ts`:

```ts
export const WEIGHT_SUM_TOLERANCE_PCT = 0.001;

export function categoryFactKey(fact: Pick<CpiCategoryFact, "categoryId" | "measure" | "period">): string {
  return `${fact.categoryId}:${fact.measure}:${fact.period}`;
}

/**
 * Unlike the national series (validateCpiFacts), a category may start late, end
 * early or skip months — 04.2 and 08.1 end in 2011, 09.6 starts in 2020, 12.5 and
 * 12.6 skip interior months. Gaps are recorded, not rejected (spec §3.4).
 */
export function validateCategoryFacts(facts: CpiCategoryFact[]): { lastPeriod: string; categoryCount: number; gaps: string[] } {
  const seen = new Set<string>();
  const divisions = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    if (fact.level === 2) divisions.add(fact.categoryId);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid category period ${fact.period}`);
    if (!(CPI_CATEGORY_MEASURES as readonly string[]).includes(fact.measure)) throw new Error(`Unknown category measure ${fact.measure}`);
    const key = categoryFactKey(fact);
    if (seen.has(key)) throw new Error(`Duplicate category observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite category observation ${key}`);
    if (value.decimalPlaces() > 6) throw new Error(`Category observation ${key} has more than 6 decimals: ${fact.value}`);
    if (value.abs().gte(PLAUSIBLE_RATE_PCT * 8)) throw new Error(`Category rate ${key} is outside a plausible range: ${fact.value}`);
    if (fact.status !== "published") throw new Error(`Invalid category status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`Category provenance missing ${key}`);
    const group = `${fact.categoryId}:${fact.measure}`;
    periodsByGroup.set(group, [...(periodsByGroup.get(group) ?? []), periodFromKey(fact.period)]);
  }
  for (const fact of facts) {
    if (fact.level === 3 && (fact.parentId === null || !divisions.has(fact.parentId))) {
      throw new Error(`Category ${fact.categoryId} has no parent division in the data`);
    }
  }

  const gaps: string[] = [];
  let last = -Infinity;
  for (const [group, periods] of periodsByGroup) {
    periods.sort((a, b) => a - b);
    for (let index = 1; index < periods.length; index += 1) {
      if (periods[index] !== periods[index - 1]! + 1) gaps.push(`${group} after ${periodKey(periods[index - 1]!)}`);
    }
    last = Math.max(last, periods.at(-1)!);
  }
  if (!Number.isFinite(last)) throw new Error("Category coverage is empty");
  return { lastPeriod: periodKey(last), categoryCount: new Set(facts.map((fact) => fact.categoryId)).size, gaps: gaps.sort() };
}

export function validateBasketWeights(weights: BasketWeightRow[], categoryIds: Set<string>): { years: number[]; maxSumErrorPct: number } {
  if (weights.length === 0) throw new Error("Basket weights are empty");
  const levels = new Map<string, Decimal>();
  const years = new Set<number>();
  for (const row of weights) {
    if (!categoryIds.has(row.categoryId)) throw new Error(`Basket weight for ${row.categoryId} has no price data`);
    const value = new Decimal(row.weightPct);
    if (!value.isFinite() || value.lt(0) || value.gt(100)) throw new Error(`Invalid basket weight ${row.weightPct} for ${row.categoryId}`);
    if (value.decimalPlaces() > 6) throw new Error(`Basket weight for ${row.categoryId} has more than 6 decimals`);
    if (!row.sourceId || !DATE.test(row.lastReviewedAt)) throw new Error(`Basket weight provenance missing for ${row.categoryId}`);
    years.add(row.year);
    const level = row.categoryId.includes("_") ? 3 : 2;
    const key = `${level}:${row.year}`;
    levels.set(key, (levels.get(key) ?? new Decimal(0)).plus(value));
  }
  let maxSumErrorPct = 0;
  for (const [key, total] of levels) {
    const error = total.minus(100).abs().toNumber();
    if (error > WEIGHT_SUM_TOLERANCE_PCT) throw new Error(`Basket weights for level ${key} sum to ${total.toFixed(6)}, not 100`);
    maxSumErrorPct = Math.max(maxSumErrorPct, error);
  }
  return { years: [...years].sort((a, b) => a - b), maxSumErrorPct };
}

export function findCategoryRevisions(previous: CpiCategoryFact[], next: CpiCategoryFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [categoryFactKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(categoryFactKey(fact));
    if (!current) problems.push(`${categoryFactKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${categoryFactKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

export function assertNoCategoryRevisions(previous: CpiCategoryFact[], next: CpiCategoryFact[]): void {
  const revisions = findCategoryRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published category history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}
```

Add `CPI_CATEGORY_MEASURES`, `type BasketWeightRow` and `type CpiCategoryFact` to the existing import from `./types` at the top of the file.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/validateCategories.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/data/inflation/validateInflation.ts tests/data/inflation/validateCategories.test.ts
git commit -m "feat(inflation): validate category facts and basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The contribution measure

**Files:**
- Create: `lib/data/inflation/contributions.ts`
- Test: `tests/data/inflation/contributions.test.ts`

**Interfaces:**
- Consumes: `ServedCpiCategoryFact`, `ServedBasketWeightRow`, `periodFromKey`, `periodYear`.
- Produces:
  - `CONTRIBUTION_FIRST_YEAR = 2013`
  - `MAX_RECONSTRUCTION_ERROR_PP = 1.0`, `MAX_MEAN_RECONSTRUCTION_ERROR_PP = 0.2`
  - `contributionFor(changePct: number, weightPct: number): number`
  - `buildContributionIndex(facts, weights): Map<string, Map<number, number>>` keyed by `categoryId`
  - `reconstructionErrors(contributions, headline): { months: number; maxPp: number; meanPp: number; worstPeriod: string | null }`
  - `assertReconstruction(errors): void`

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/inflation/contributions.test.ts
import { describe, expect, it } from "vitest";
import { CONTRIBUTION_FIRST_YEAR, assertReconstruction, buildContributionIndex, contributionFor, reconstructionErrors } from "../../../lib/data/inflation/contributions";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (categoryId: string, period: string, value: number, level: 2 | 3 = 2): ServedCpiCategoryFact => ({
  categoryId, coicopCode: "1", level, parentId: level === 2 ? null : "cpi.cat.01", measure: "yoy_pct",
  period, value, status: "published", sourceId: "source.geostat_cpi_yoy", sourceLocator: "Georgia!D7", lastReviewedAt: "2026-09-11",
});
const weight = (categoryId: string, year: number, weightPct: number): ServedBasketWeightRow => ({
  categoryId, year, weightPct, sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12",
});

describe("contributionFor", () => {
  it("multiplies a percentage-point change by the weight as a fraction", () => {
    expect(contributionFor(15.2, 11.4)).toBeCloseTo(1.7328, 4);
  });
});

describe("buildContributionIndex", () => {
  it("starts in 2013 even when weights and prices reach further back", () => {
    const index = buildContributionIndex(
      [fact("cpi.cat.01", "2012-06", 5), fact("cpi.cat.01", "2013-06", 5)],
      [weight("cpi.cat.01", 2012, 30), weight("cpi.cat.01", 2013, 30)],
    );
    const periods = [...index.get("cpi.cat.01")!.keys()].map((period) => Math.floor(period / 12));
    expect(Math.min(...periods)).toBe(CONTRIBUTION_FIRST_YEAR);
  });

  it("uses the weight of the year the month falls in", () => {
    const index = buildContributionIndex(
      [fact("cpi.cat.01", "2025-06", 10), fact("cpi.cat.01", "2026-06", 10)],
      [weight("cpi.cat.01", 2025, 20), weight("cpi.cat.01", 2026, 40)],
    );
    const values = [...index.get("cpi.cat.01")!.values()];
    expect(values).toEqual([2, 4]);
  });

  it("omits a category with no weight for that year", () => {
    const index = buildContributionIndex([fact("cpi.cat.01", "2013-06", 5)], []);
    expect(index.size).toBe(0);
  });
});

describe("reconstructionErrors", () => {
  it("measures the gap between the summed parts and the published headline", () => {
    const contributions = new Map([["cpi.cat.01", new Map([[24157, 3.0]])]]);
    const headline = new Map([[24157, 3.4]]);
    const errors = reconstructionErrors(contributions, headline);
    expect(errors.months).toBe(1);
    expect(errors.maxPp).toBeCloseTo(0.4, 6);
    expect(errors.meanPp).toBeCloseTo(0.4, 6);
  });

  it("throws past the bound", () => {
    expect(() => assertReconstruction({ months: 1, maxPp: 1.4, meanPp: 0.1, worstPeriod: "2013-01" })).toThrow(/1.4/);
  });

  it("passes within the bound", () => {
    expect(() => assertReconstruction({ months: 160, maxPp: 0.59, meanPp: 0.09, worstPeriod: "2021-04" })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/contributions.test.ts`
Expected: FAIL — cannot resolve `contributions`.

- [ ] **Step 3: Implement**

```ts
// lib/data/inflation/contributions.ts
import { periodFromKey, periodKey, periodYear } from "./periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "./types";

// A category's share of the headline: its published price change, weighted by its
// share of the basket. Never stored — derived at build time from two published
// series, as `% of GDP` is in lib/explorer/debtExplorer.ts (spec §4.6).

/**
 * Weights begin in 2012, but that first column reconstructs the headline an order
 * of magnitude worse than every later year (0.82 pp mean against ≤0.13 pp), so
 * contributions begin the year after. 2012 weights still ship as panel context.
 */
export const CONTRIBUTION_FIRST_YEAR = 2013;

/** Monitoring tripwires against a future Geostat change, not accuracy claims. */
export const MAX_RECONSTRUCTION_ERROR_PP = 1.0;
export const MAX_MEAN_RECONSTRUCTION_ERROR_PP = 0.2;

export function contributionFor(changePct: number, weightPct: number): number {
  return (weightPct / 100) * changePct;
}

export function buildContributionIndex(
  facts: ServedCpiCategoryFact[],
  weights: ServedBasketWeightRow[],
): Map<string, Map<number, number>> {
  const weightByKey = new Map(weights.map((row) => [`${row.categoryId}:${row.year}`, row.weightPct]));
  const index = new Map<string, Map<number, number>>();
  for (const fact of facts) {
    if (fact.measure !== "yoy_pct") continue;
    const period = periodFromKey(fact.period);
    const year = periodYear(period);
    if (year < CONTRIBUTION_FIRST_YEAR) continue;
    const weightPct = weightByKey.get(`${fact.categoryId}:${year}`);
    if (weightPct === undefined) continue;
    if (!index.has(fact.categoryId)) index.set(fact.categoryId, new Map());
    index.get(fact.categoryId)!.set(period, contributionFor(fact.value, weightPct));
  }
  return index;
}

export type ReconstructionErrors = { months: number; maxPp: number; meanPp: number; worstPeriod: string | null };

/** How far the summed parts fall from the published whole, month by month. */
export function reconstructionErrors(contributions: Map<string, Map<number, number>>, headline: Map<number, number>): ReconstructionErrors {
  const sums = new Map<number, number>();
  for (const byPeriod of contributions.values()) {
    for (const [period, value] of byPeriod) sums.set(period, (sums.get(period) ?? 0) + value);
  }
  let maxPp = 0;
  let total = 0;
  let months = 0;
  let worstPeriod: string | null = null;
  for (const [period, sum] of sums) {
    const published = headline.get(period);
    if (published === undefined) continue;
    const error = Math.abs(published - sum);
    months += 1;
    total += error;
    if (error > maxPp) {
      maxPp = error;
      worstPeriod = periodKey(period);
    }
  }
  return { months, maxPp, meanPp: months === 0 ? 0 : total / months, worstPeriod };
}

export function assertReconstruction(errors: ReconstructionErrors): void {
  if (errors.maxPp > MAX_RECONSTRUCTION_ERROR_PP) {
    throw new Error(`Category contributions miss the published headline by ${errors.maxPp.toFixed(3)} pp at ${errors.worstPeriod} (limit ${MAX_RECONSTRUCTION_ERROR_PP})`);
  }
  if (errors.meanPp > MAX_MEAN_RECONSTRUCTION_ERROR_PP) {
    throw new Error(`Category contributions miss the published headline by ${errors.meanPp.toFixed(3)} pp on average (limit ${MAX_MEAN_RECONSTRUCTION_ERROR_PP})`);
  }
}
```

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/contributions.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/data/inflation/contributions.ts tests/data/inflation/contributions.test.ts
git commit -m "feat(inflation): derive category contributions with a reconstruction check" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Write the canonical CSVs

**Files:**
- Modify: `lib/data/inflation/prepareInflation.ts`
- Modify: `package.json` (no new scripts; confirm `data:prepare-inflation` and `data:check-inflation` now cover the new files)
- Create: `data/imports/cpi-categories-monthly.csv`, `data/imports/cpi-basket-weights.csv` (generated)
- Test: `tests/data/inflation/prepareCategories.test.ts`

**Interfaces:**
- Consumes: Tasks 3–6.
- Produces: `prepareInflationCategories(options?): Promise<{ facts: CpiCategoryFact[]; weights: BasketWeightRow[]; validation: InflationCategoryReport }>`, `serializeCategoryFacts(facts): string`, `serializeBasketWeights(weights): string`. `writeInflationArtifacts` writes four files instead of two. The report gains `categories: { count, lastPeriod, gaps, weightYears, maxWeightSumErrorPct, reconstruction }`.
- Also produces `loadCpiCategoryFacts(relativePath?)` in `lib/data/inflation/importInflation.ts`, because the revision guard here reads the committed CSV back. Task 8 builds the rest of the serving surface on top of it.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/inflation/prepareCategories.test.ts
import { describe, expect, it } from "vitest";
import { prepareInflationCategories, serializeBasketWeights, serializeCategoryFacts } from "../../../lib/data/inflation/prepareInflation";
import { MAX_MEAN_RECONSTRUCTION_ERROR_PP, MAX_RECONSTRUCTION_ERROR_PP } from "../../../lib/data/inflation/contributions";

describe("prepareInflationCategories", () => {
  it("extracts every category for both measures", async () => {
    const { facts, validation } = await prepareInflationCategories({ previousFacts: null });
    expect(validation.categoryCount).toBe(55);
    expect(facts.filter((fact) => fact.measure === "yoy_pct")).toHaveLength(13492);
    expect(facts.filter((fact) => fact.measure === "mom_pct")).toHaveLength(14176);
  });

  it("keeps the reconstruction inside the published bounds", async () => {
    const { validation } = await prepareInflationCategories({ previousFacts: null });
    expect(validation.reconstruction.maxPp).toBeLessThan(MAX_RECONSTRUCTION_ERROR_PP);
    expect(validation.reconstruction.meanPp).toBeLessThan(MAX_MEAN_RECONSTRUCTION_ERROR_PP);
    expect(validation.reconstruction.months).toBeGreaterThan(150);
  });

  it("records the known gaps rather than failing on them", async () => {
    const { validation } = await prepareInflationCategories({ previousFacts: null });
    expect(validation.gaps.some((gap) => gap.startsWith("cpi.cat.12_5:"))).toBe(true);
  });

  it("carries weights for 2012 onward", async () => {
    const { weights, validation } = await prepareInflationCategories({ previousFacts: null });
    expect(validation.weightYears[0]).toBe(2012);
    expect(weights.some((row) => row.categoryId === "cpi.cat.01" && row.year === 2026)).toBe(true);
  });

  it("serializes a stable, sorted CSV", async () => {
    const { facts, weights } = await prepareInflationCategories({ previousFacts: null });
    const csv = serializeCategoryFacts(facts).split("\n");
    expect(csv[0]).toContain("category_id,coicop_code,level,parent_id,measure,period,value");
    expect(csv[1]!.startsWith("cpi.cat.01,")).toBe(true);
    expect(serializeBasketWeights(weights).split("\n")[0]).toContain("category_id,year,weight_pct");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/prepareCategories.test.ts`
Expected: FAIL — `prepareInflationCategories` is not exported.

- [ ] **Step 3: Implement**

In `lib/data/inflation/prepareInflation.ts` add the file constants beside the existing ones:

```ts
const CATEGORY_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-categories-monthly.csv");
const BASKET_WEIGHTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-basket-weights.csv");
const CATEGORY_HEADERS = ["category_id", "coicop_code", "level", "parent_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
const WEIGHT_HEADERS = ["category_id", "year", "weight_pct", "source_id", "last_reviewed_at"];
```

Then the builder. It pairs the English and Georgian workbooks by COICOP code — the label check is what proves the two files describe the same tree, since the values are compared cell by cell:

```ts
export type InflationCategoryReport = {
  categoryCount: number;
  lastPeriod: string;
  gaps: string[];
  weightYears: number[];
  maxWeightSumErrorPct: number;
  reconstruction: ReconstructionErrors;
};

export async function prepareInflationCategories(options: { rawRoot?: string; previousFacts?: CpiCategoryFact[] | null } = {}) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage));

  const facts: CpiCategoryFact[] = [];
  for (const role of ["yoy", "mom"] as const) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const en = readGeostatCpiCategories(english.content, role, "en");
    const ka = readGeostatCpiCategories(georgian.content, role, "ka");
    if (en.length !== ka.length) throw new Error(`English and Georgian ${role} files list different categories`);
    en.forEach((series, position) => {
      const other = ka[position]!;
      if (other.coicopCode !== series.coicopCode || other.level !== series.level) {
        throw new Error(`English and Georgian ${role} files differ in category order at ${series.coicopCode}`);
      }
      const left = series.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
      const right = other.cells.map((cell) => `${cell.period}=${cell.value}`).join("|");
      if (left !== right) throw new Error(`English and Georgian ${role} files differ for category ${series.coicopCode}`);
      const { categoryId, parentId } = categoryIdFromCoicop(series.coicopCode, series.level);
      for (const cell of series.cells) {
        facts.push({
          categoryId, coicopCode: series.coicopCode, level: series.level, parentId,
          measure: role === "yoy" ? "yoy_pct" : "mom_pct",
          period: periodKey(cell.period), value: cell.value, status: "published",
          sourceId: english.source_id, sourceLocator: cell.locator, lastReviewedAt: english.retrieved_at,
        });
      }
    });
  }
  facts.sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period));

  const weightVintage = await latestBasketWeightVintage();
  const weightFiles = await readVerifiedBasketWeightFiles(path.join(BASKET_WEIGHTS_ROOT, weightVintage));
  const weightSource = weightFiles.find((file) => file.language === "en")!;
  const weights: BasketWeightRow[] = readGeostatBasketWeights(weightSource.content)
    .flatMap((row) => {
      const { categoryId } = categoryIdFromCoicop(row.coicopCode, row.level);
      return [...row.byYear].map(([year, weightPct]) => ({ categoryId, year, weightPct, sourceId: weightSource.source_id, lastReviewedAt: weightSource.retrieved_at }));
    })
    .sort((a, b) => a.categoryId.localeCompare(b.categoryId) || a.year - b.year);

  const coverage = validateCategoryFacts(facts);
  const weightCheck = validateBasketWeights(weights, new Set(facts.map((fact) => fact.categoryId)));
  const previous = options.previousFacts === undefined ? await loadPreviousCategoryFacts() : options.previousFacts;
  if (previous) assertNoCategoryRevisions(previous, facts);

  const served = facts.map((fact) => ({ ...fact, value: Number(fact.value) }));
  const servedWeights = weights.map((row) => ({ ...row, weightPct: Number(row.weightPct) }));
  const headline = new Map(
    (await loadCpiFacts())
      .filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
      .map((fact) => [periodFromKey(fact.period), Number(fact.value)]),
  );
  const reconstruction = reconstructionErrors(
    buildContributionIndex(served.filter((fact) => fact.level === 2), servedWeights),
    headline,
  );
  assertReconstruction(reconstruction);

  const validation: InflationCategoryReport = {
    categoryCount: coverage.categoryCount,
    lastPeriod: coverage.lastPeriod,
    gaps: coverage.gaps,
    weightYears: weightCheck.years,
    maxWeightSumErrorPct: Number(weightCheck.maxSumErrorPct.toFixed(6)),
    reconstruction: {
      ...reconstruction,
      maxPp: Number(reconstruction.maxPp.toFixed(4)),
      meanPp: Number(reconstruction.meanPp.toFixed(4)),
    },
  };
  return { facts, weights, validation };
}

async function loadPreviousCategoryFacts(): Promise<CpiCategoryFact[] | null> {
  try {
    return await loadCpiCategoryFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function serializeCategoryFacts(facts: CpiCategoryFact[]): string {
  const lines = facts.map((fact) =>
    [fact.categoryId, fact.coicopCode, String(fact.level), fact.parentId ?? "", fact.measure, fact.period, fact.value, fact.status, fact.sourceId, fact.sourceLocator, fact.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [CATEGORY_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export function serializeBasketWeights(weights: BasketWeightRow[]): string {
  const lines = weights.map((row) => [row.categoryId, String(row.year), row.weightPct, row.sourceId, row.lastReviewedAt].map(csvEscape).join(","));
  return BOM + [WEIGHT_HEADERS.join(","), ...lines].join("\n") + "\n";
}
```

`loadPreviousCategoryFacts` needs a reader for the committed CSV, so add `loadCpiCategoryFacts` to `lib/data/inflation/importInflation.ts` now — the exact implementation is given in Task 8 Step 3; write that function here and import it. Task 8 adds the weights loader and the served path on top of it.

Then extend `writeInflationArtifacts`: call `prepareInflationCategories()` alongside `prepareInflation()`, push `[CATEGORY_FACTS_FILE, serializeCategoryFacts(facts)]` and `[BASKET_WEIGHTS_FILE, serializeBasketWeights(weights)]` onto `outputs`, and add `categories: categoryValidation` to the report object written to `REPORT_FILE`. Add the new source ids to the registered-source check already in `prepareInflation`.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/prepareCategories.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Generate the CSVs**

```bash
npm run data:prepare-inflation
```

Expected: `data/imports/cpi-categories-monthly.csv` with 27,669 lines plus the header, `cpi-basket-weights.csv` with about 786, and `data/reports/inflation-cpi-validation.json` carrying the new `categories` block. Read the reconstruction figures in the report and confirm `maxPp` is below 0.6 and `meanPp` below 0.13; if either is larger, stop and investigate rather than raising the bound.

- [ ] **Step 6: Confirm the check mode agrees**

```bash
npm run data:check-inflation
```

Expected: PASS with no diff.

- [ ] **Step 7: Commit**

```bash
git add lib/data/inflation/prepareInflation.ts tests/data/inflation/prepareCategories.test.ts ../../data/imports/cpi-categories-monthly.csv ../../data/imports/cpi-basket-weights.csv ../../data/reports/inflation-cpi-validation.json
git commit -m "feat(inflation): write the category and basket-weight CSVs" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Serve the new CSVs

**Files:**
- Modify: `lib/data/inflation/importInflation.ts`
- Modify: `lib/data/servedData.ts`
- Test: `tests/data/inflation/loadCategories.test.ts`

**Interfaces:**
- Produces: `CPI_CATEGORY_FACTS_CSV`, `BASKET_WEIGHTS_CSV`, `loadCpiCategoryFacts(path?): Promise<CpiCategoryFact[]>`, `loadBasketWeights(path?): Promise<BasketWeightRow[]>`, and `loadServedInflationData()` returning `{ facts, targets, categories, weights }` where the last two are the served (numeric) shapes.

- [ ] **Step 1: Write the failing test**

```ts
// tests/data/inflation/loadCategories.test.ts
import { describe, expect, it } from "vitest";
import { loadBasketWeights, loadCpiCategoryFacts, loadServedInflationData } from "../../../lib/data/inflation/importInflation";

describe("category loaders", () => {
  it("loads and validates every category fact", async () => {
    const facts = await loadCpiCategoryFacts();
    expect(facts).toHaveLength(27668);
    expect(new Set(facts.map((fact) => fact.categoryId)).size).toBe(55);
  });

  it("resolves each subgroup to its division", async () => {
    const facts = await loadCpiCategoryFacts();
    const divisions = new Set(facts.filter((fact) => fact.level === 2).map((fact) => fact.categoryId));
    expect(facts.filter((fact) => fact.level === 3).every((fact) => divisions.has(fact.parentId!))).toBe(true);
  });

  it("loads weights as numbers on the served path", async () => {
    const weights = await loadBasketWeights();
    expect(weights.length).toBeGreaterThan(700);
    const served = await loadServedInflationData();
    expect(typeof served.weights[0]!.weightPct).toBe("number");
    expect(served.categories.length).toBe(27668);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/loadCategories.test.ts`
Expected: FAIL — `loadCpiCategoryFacts` is not exported.

- [ ] **Step 3: Implement**

In `importInflation.ts`, mirroring `loadCpiFacts` exactly:

```ts
export const CPI_CATEGORY_FACTS_CSV = "../../data/imports/cpi-categories-monthly.csv";
export const BASKET_WEIGHTS_CSV = "../../data/imports/cpi-basket-weights.csv";

export async function loadCpiCategoryFacts(relativePath = CPI_CATEGORY_FACTS_CSV): Promise<CpiCategoryFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiCategoryFact => {
    const level = Number(row.level);
    if (level !== 2 && level !== 3) throw new Error(`Unknown category level ${row.level}`);
    if (!(CPI_CATEGORY_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown category measure ${row.measure}`);
    return {
      categoryId: row.category_id,
      coicopCode: row.coicop_code,
      level,
      parentId: row.parent_id === "" ? null : row.parent_id,
      measure: row.measure as CpiCategoryMeasure,
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiCategoryFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCategoryFacts(facts);
  return facts;
}

export async function loadBasketWeights(relativePath = BASKET_WEIGHTS_CSV): Promise<BasketWeightRow[]> {
  const rows = await readCsvRecords(relativePath);
  return rows.map((row) => ({
    categoryId: row.category_id,
    year: Number(row.year),
    weightPct: new Decimal(row.weight_pct).toFixed(),
    sourceId: row.source_id,
    lastReviewedAt: row.last_reviewed_at,
  }));
}
```

Extend `loadServedInflationData` to load both, run `validateBasketWeights(weights, new Set(categories.map((fact) => fact.categoryId)))`, include the new source ids in the registered-source check, and return `categories` and `weights` as served (numeric) rows. Add both paths to `SERVED_DATA_FILES` in `lib/data/servedData.ts` as `inflationCategoryFacts` and `inflationBasketWeights`.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/data/inflation/loadCategories.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Prove the serving boundary still holds**

The serving path must never import the workbook reader.

Run: `npx vitest run tests/data/inflation/servingBoundary.test.ts`
Expected: PASS, unmodified. If it fails, you imported `readBasketWeights` or `readGeostatCpi` from `importInflation.ts` — move it back to `prepareInflation.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/data/inflation/importInflation.ts lib/data/servedData.ts tests/data/inflation/loadCategories.test.ts
git commit -m "feat(inflation): serve category facts and basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Mirror the new tables

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260913000000_inflation_categories/migration.sql`
- Modify: `lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `scripts/import-budget-facts.ts`
- Modify: `lib/data/inflation/importInflation.ts` (parity)
- Test: `tests/data/inflation/categoryParity.test.ts`

**Interfaces:**
- Produces: models `InflationCategoryFact` and `InflationBasketWeight`; `loadInflationCategoryFactsFromMirror(db)`, `loadInflationBasketWeightsFromMirror(db)`; `assertInflationParity` extended to four collections.

Read `docs/data-methodology/database-import.md` before writing the migration — migrations here are hand-written, never generated.

- [ ] **Step 1: Write the failing parity test**

```ts
// tests/data/inflation/categoryParity.test.ts
import { describe, expect, it } from "vitest";
import { assertInflationParity } from "../../../lib/data/inflation/importInflation";
import type { BasketWeightRow, CpiCategoryFact } from "../../../lib/data/inflation/types";

const fact: CpiCategoryFact = {
  categoryId: "cpi.cat.07", coicopCode: "7", level: 2, parentId: null, measure: "yoy_pct",
  period: "2026-08", value: "15.2", status: "published", sourceId: "source.geostat_cpi_yoy",
  sourceLocator: "Georgia!IW38", lastReviewedAt: "2026-09-11",
};
const weight: BasketWeightRow = { categoryId: "cpi.cat.07", year: 2026, weightPct: "11.400000", sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12" };
const base = { facts: [], targets: [], categories: [fact], weights: [weight] };

describe("assertInflationParity", () => {
  it("passes when the mirror matches", () => {
    expect(() => assertInflationParity(base, base)).not.toThrow();
  });

  it("fails when a category value differs", () => {
    expect(() => assertInflationParity(base, { ...base, categories: [{ ...fact, value: "15.3" }] })).toThrow();
  });

  it("fails when a weight is missing", () => {
    expect(() => assertInflationParity(base, { ...base, weights: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/data/inflation/categoryParity.test.ts`
Expected: FAIL — the parity signature takes two collections, not four.

- [ ] **Step 3: Extend the schema**

Add to `prisma/schema.prisma`, beside `InflationCpiFact` at line 412:

```prisma
model InflationCategoryFact {
  categoryId       String
  coicopCode       String
  level            Int
  parentId         String?
  measure          String
  period           String
  value            Decimal        @db.Decimal(20, 6)
  status           String
  sourceLocator    String
  sourceDocumentId String
  sourceDocument   SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt   DateTime       @db.Date
  importRunId      String?
  importRun        ImportRun?     @relation(fields: [importRunId], references: [id])

  @@id([categoryId, measure, period])
}

model InflationBasketWeight {
  categoryId       String
  year             Int
  weightPct        Decimal        @db.Decimal(12, 6)
  sourceDocumentId String
  sourceDocument   SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt   DateTime       @db.Date
  importRunId      String?
  importRun        ImportRun?     @relation(fields: [importRunId], references: [id])

  @@id([categoryId, year])
}
```

Prisma requires the opposite side of each relation: add `inflationCategoryFacts InflationCategoryFact[]` and `inflationBasketWeights InflationBasketWeight[]` to **both** `SourceDocument` (after line 83) and `ImportRun` (after line 108).

- [ ] **Step 4: Write the migration by hand**

`prisma/migrations/20260913000000_inflation_categories/migration.sql`:

```sql
CREATE TABLE "InflationCategoryFact" (
    "categoryId" TEXT NOT NULL,
    "coicopCode" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "measure" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "value" DECIMAL(20,6) NOT NULL,
    "status" TEXT NOT NULL,
    "sourceLocator" TEXT NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,
    CONSTRAINT "InflationCategoryFact_pkey" PRIMARY KEY ("categoryId","measure","period")
);

CREATE TABLE "InflationBasketWeight" (
    "categoryId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "weightPct" DECIMAL(12,6) NOT NULL,
    "sourceDocumentId" TEXT NOT NULL,
    "lastReviewedAt" DATE NOT NULL,
    "importRunId" TEXT,
    CONSTRAINT "InflationBasketWeight_pkey" PRIMARY KEY ("categoryId","year")
);

ALTER TABLE "InflationCategoryFact" ADD CONSTRAINT "InflationCategoryFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InflationCategoryFact" ADD CONSTRAINT "InflationCategoryFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InflationBasketWeight" ADD CONSTRAINT "InflationBasketWeight_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InflationBasketWeight" ADD CONSTRAINT "InflationBasketWeight_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

Compare the exact constraint wording against the previous migration, `prisma/migrations/20260912000000_inflation_cpi/migration.sql`, and match it.

- [ ] **Step 5: Regenerate the client**

```bash
npx prisma generate
```

Expected: success. Do **not** run `prisma migrate dev` — it would try to reach the database.

- [ ] **Step 6: Extend the mirror loaders and the import**

In `lib/db/mirrorRows.ts` add `loadInflationCategoryFactsFromMirror` and `loadInflationBasketWeightsFromMirror`, following `loadInflationCpiFactsFromMirror` at line 463 exactly — same ordering discipline, same `value.toFixed()` and `isoDate()` conversions, `sourceId: row.sourceDocumentId`. Order categories by `[categoryId, measure, period]` and weights by `[categoryId, year]`.

In `lib/db/servedDataDb.ts` extend `loadInflationDataFromDb` to load all four. In `scripts/import-budget-facts.ts` mirror the existing inflation block: load from the CSVs at lines 229-231, `deleteMany()` both new tables beside lines 376-377, `createMany` beside lines 631-646, extend `mirrorInflation` at 647-651, and add two rows to the parity summary at 843-844.

In `importInflation.ts` widen `assertInflationParity` to take `{ facts, targets, categories, weights }` on both sides and add:

```ts
assertSameServedRows("Inflation categories", csv.categories, db.categories, categoryFactKey);
assertSameServedRows("Inflation basket weights", csv.weights, db.weights, (row) => `${row.categoryId}:${row.year}`);
```

- [ ] **Step 7: Run the parity test and the typecheck**

Run: `npx vitest run tests/data/inflation/categoryParity.test.ts && npm run typecheck`
Expected: PASS, 3 tests, and a clean typecheck. A `.next/dev` type error that names a route you did not touch is the known stale-gate problem — check `git status` before chasing it.

- [ ] **Step 8: Commit**

```bash
git add prisma lib/db tests/data/inflation/categoryParity.test.ts lib/data/inflation/importInflation.ts scripts/import-budget-facts.ts
git commit -m "feat(inflation): mirror category facts and basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Page state and selection

**Files:**
- Create: `lib/explorer/inflationCategories.ts`
- Create: `lib/explorer/inflationCategoryLabels.ts`
- Modify: `lib/explorer/colors.ts`
- Test: `tests/explorer/inflationCategories.test.ts`

**Interfaces:**
- Consumes: `ServedCpiCategoryFact`, `ServedBasketWeightRow`, `buildContributionIndex`, `CONTRIBUTION_FIRST_YEAR`.
- Produces:
  - `CATEGORY_TABS = ["yoy", "mom", "contrib"] as const`, `type CategoryTab`
  - `DEFAULT_CATEGORY_STATE: CategoryState`, `type CategoryState = { tab: CategoryTab; mode: "chart" | "table"; range: InflationRange; selected: string[]; expanded: string[]; tableSeries: string | null }`
  - `buildCategoryIndex(facts, weights): CategoryIndex` with `{ values: Map<string, Map<number, number>>; contributions: Map<string, Map<number, number>>; tree: CategoryNode[]; weights: Map<string, Map<number, number>> }` and `type CategoryNode = { categoryId: string; level: 2 | 3; children: string[] }`
  - `categoryCoverage(index, tab)`, `resolveCategoryRange`, `changeCategoryTab`, `toggleCategory`, `toggleExpanded`, `buildStackModel`, `latestContributors`, `parseCategoryHash`, `serializeCategoryHash`
  - `buildStackModel(index, state, range, headline): { periods: number[]; segments: Array<{ categoryId: string; values: Array<number | null> }>; residual: number[]; headline: Array<number | null> }`

- [ ] **Step 1: Write the failing test**

The residual is the contract worth pinning hardest: whatever is selected, segments plus residual equal the published headline.

```ts
// tests/explorer/inflationCategories.test.ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_STATE, buildCategoryIndex, buildStackModel, changeCategoryTab, categoryCoverage,
  parseCategoryHash, resolveCategoryRange, serializeCategoryHash, toggleCategory,
} from "../../lib/explorer/inflationCategories";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../lib/data/inflation/types";

const fact = (categoryId: string, period: string, value: number, measure: "yoy_pct" | "mom_pct" = "yoy_pct", level: 2 | 3 = 2): ServedCpiCategoryFact => ({
  categoryId, coicopCode: "1", level, parentId: level === 2 ? null : "cpi.cat.01", measure, period, value,
  status: "published", sourceId: "source.geostat_cpi_yoy", sourceLocator: "Georgia!D7", lastReviewedAt: "2026-09-11",
});
const weight = (categoryId: string, year: number, weightPct: number): ServedBasketWeightRow => ({
  categoryId, year, weightPct, sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12",
});

const facts = [
  fact("cpi.cat.01", "2026-08", 5.02), fact("cpi.cat.07", "2026-08", 15.2),
  fact("cpi.cat.01", "2026-08", 0.4, "mom_pct"), fact("cpi.cat.07", "2026-08", 0.9, "mom_pct"),
  fact("cpi.cat.01", "2004-06", 3.1, "mom_pct"),
];
const weights = [weight("cpi.cat.01", 2026, 33.6), weight("cpi.cat.07", 2026, 11.4)];
const headline = new Map([[makePeriod(2026, 8), 5.65]]);

describe("buildStackModel", () => {
  it("closes on the published headline with everything selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.01", "cpi.cat.07"] };
    const range = resolveCategoryRange(state, index);
    const model = buildStackModel(index, state, range, headline);
    const total = model.segments.reduce((sum, segment) => sum + (segment.values[0] ?? 0), 0) + model.residual[0]!;
    expect(total).toBeCloseTo(5.65, 10);
  });

  it("closes on the published headline with one category selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.07"] };
    const range = resolveCategoryRange(state, index);
    const model = buildStackModel(index, state, range, headline);
    expect(model.segments).toHaveLength(1);
    expect(model.segments[0]!.values[0]! + model.residual[0]!).toBeCloseTo(5.65, 10);
  });

  it("makes the residual the whole headline when nothing is selected", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, selected: [] };
    const model = buildStackModel(index, state, resolveCategoryRange(state, index), headline);
    expect(model.residual[0]).toBeCloseTo(5.65, 10);
  });
});

describe("coverage", () => {
  it("gives each tab its own span", () => {
    const index = buildCategoryIndex(facts, weights);
    expect(categoryCoverage(index, "mom").min).toBe(makePeriod(2004, 6));
    expect(categoryCoverage(index, "yoy").min).toBe(makePeriod(2026, 8));
  });

  it("clamps a manual range when the destination tab starts later", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = { ...DEFAULT_CATEGORY_STATE, tab: "mom" as const, range: { kind: "manual" as const, start: makePeriod(2004, 6), end: makePeriod(2026, 8) } };
    expect(changeCategoryTab(state, "contrib", index).range.kind).toBe("all");
  });
});

describe("selection and hash", () => {
  it("keeps selection in COICOP order", () => {
    const index = buildCategoryIndex(facts, weights);
    const state = toggleCategory({ ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.07"] }, "cpi.cat.01", index);
    expect(state.selected).toEqual(["cpi.cat.01", "cpi.cat.07"]);
  });

  it("round-trips through the hash", () => {
    const state = { ...DEFAULT_CATEGORY_STATE, tab: "mom" as const, mode: "table" as const, selected: ["cpi.cat.01", "cpi.cat.10_5"] };
    expect(parseCategoryHash(serializeCategoryHash(state))).toMatchObject({ tab: "mom", mode: "table", selected: ["cpi.cat.01", "cpi.cat.10_5"] });
  });

  it("drops an unknown category from the hash", () => {
    expect(parseCategoryHash("i=contrib&sel=cpi.cat.01,nonsense").selected).toEqual(["cpi.cat.01"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/inflationCategories.test.ts`
Expected: FAIL — cannot resolve `inflationCategories`.

- [ ] **Step 3: Implement**

Write `lib/explorer/inflationCategories.ts` modelled directly on `lib/explorer/inflationOverview.ts` — same pure-module discipline, no DOM, no rendering. The parts that differ from the overview:

```ts
export const CATEGORY_TABS = ["yoy", "mom", "contrib"] as const;
export type CategoryTab = (typeof CATEGORY_TABS)[number];

// The section exists for the decomposition, so it lands there even though the two
// rate tabs are listed first (spec §6).
export const DEFAULT_CATEGORY_STATE: CategoryState = {
  tab: "contrib", mode: "chart", range: { kind: "all" }, selected: DIVISION_IDS, expanded: [], tableSeries: null,
};

export const DIVISION_IDS = Array.from({ length: 12 }, (_, index) => `cpi.cat.${String(index + 1).padStart(2, "0")}`);

/**
 * The residual is the published headline minus the selected contributions, so the
 * stack always closes on the figure Geostat published — whether the whole basket
 * is selected or three subgroups are. It absorbs both the unselected categories
 * and the basket-rebasing approximation (spec §4.6).
 */
export function buildStackModel(index: CategoryIndex, state: CategoryState, range: ResolvedPeriodRange, headline: Map<number, number>) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const segments = state.selected
    .filter((categoryId) => index.contributions.has(categoryId))
    .map((categoryId) => ({ categoryId, values: periods.map((period) => index.contributions.get(categoryId)?.get(period) ?? null) }));
  const headlineValues = periods.map((period) => headline.get(period) ?? null);
  const residual = periods.map((period, position) => {
    const published = headlineValues[position];
    if (published === null) return 0;
    return published - segments.reduce((sum, segment) => sum + (segment.values[position] ?? 0), 0);
  });
  return { periods, segments, residual, headline: headlineValues };
}
```

Sort `selected` by COICOP order in `toggleCategory` (divisions ascending, each division's subgroups after it) so the stack order is stable and independent of click order. `categoryCoverage` reads `index.values` for the rate tabs and `index.contributions` for `contrib`. `parseCategoryHash` validates every id against the tree and drops the rest, exactly as the overview filters `SELECTION_ORDER`.

Add the twelve category colours to `lib/explorer/colors.ts` in the `SERIES_COLORS` map, keeping each concept's existing colour:

```ts
  // COICOP divisions. A concept keeps its colour site-wide (DESIGN.md §4.2):
  // health, education and transport take the same hues as the budget categories.
  "cpi.cat.01": "#B3402A",
  "cpi.cat.02": "#9C3D5E",
  "cpi.cat.03": "#7A4E8C",
  "cpi.cat.04": "#A5822B",
  "cpi.cat.05": "#8A7B65",
  "cpi.cat.06": "#1F6E56",
  "cpi.cat.07": "#C26E4C",
  "cpi.cat.08": "#4A707A",
  "cpi.cat.09": "#4E5D74",
  "cpi.cat.10": "#3D5A98",
  "cpi.cat.11": "#8C5A32",
  "cpi.cat.12": "#2F4B3A",
  "cpi.cat.residual": "#94856D",
```

In `inflationCategoryLabels.ts`, resolve a subgroup's colour to its division's and expose `categoryColor(categoryId)`, `categoryLabel(messages, categoryId)` and `formatContribution(value)` (one decimal, always signed, `პპ`).

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/explorer/inflationCategories.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Extract the fixture the later tasks share**

Tasks 12, 14 and 15 all need the same small index. Put it in `tests/explorer/fixtures/inflationCategories.ts` now, so no later task invents its own:

```ts
import { makePeriod } from "../../../lib/data/inflation/periods";
import { buildCategoryIndex, DEFAULT_CATEGORY_STATE, type CategoryState } from "../../../lib/explorer/inflationCategories";
import type { ServedBasketWeightRow, ServedCpiCategoryFact } from "../../../lib/data/inflation/types";

const fact = (categoryId: string, level: 2 | 3, parentId: string | null, measure: "yoy_pct" | "mom_pct", period: string, value: number): ServedCpiCategoryFact => ({
  categoryId, coicopCode: categoryId.replace("cpi.cat.", "").replace(/^0|_/g, ""), level, parentId, measure, period, value,
  status: "published", sourceId: measure === "yoy_pct" ? "source.geostat_cpi_yoy" : "source.geostat_cpi_mom",
  sourceLocator: "Georgia!D7", lastReviewedAt: "2026-09-11",
});

/** Three divisions, two subgroups and 2026 weights — enough to render every surface. */
export const fixtureFacts: ServedCpiCategoryFact[] = [
  fact("cpi.cat.01", 2, null, "yoy_pct", "2026-08", 5.02),
  fact("cpi.cat.04", 2, null, "yoy_pct", "2026-08", 8.47),
  fact("cpi.cat.07", 2, null, "yoy_pct", "2026-08", 15.2),
  fact("cpi.cat.01_1", 3, "cpi.cat.01", "yoy_pct", "2026-08", 4.8),
  fact("cpi.cat.01", 2, null, "mom_pct", "2026-08", 0.4),
  fact("cpi.cat.07", 2, null, "mom_pct", "2026-08", 0.9),
  // 04.2 ended in 2011 and has no weight, so it must render as "—" on the contribution tab.
  fact("cpi.cat.04_2", 3, "cpi.cat.04", "yoy_pct", "2011-12", 2.2),
];

export const fixtureWeights: ServedBasketWeightRow[] = (
  [["cpi.cat.01", 33.6], ["cpi.cat.04", 9.7], ["cpi.cat.07", 11.4], ["cpi.cat.01_1", 27.5]] as const
).map(([categoryId, weightPct]) => ({ categoryId, year: 2026, weightPct, sourceId: "source.geostat_basket_weights", lastReviewedAt: "2026-09-12" }));

export const fixtureHeadline = new Map([[makePeriod(2026, 8), 5.65]]);
export const fixtureIndex = () => buildCategoryIndex(fixtureFacts, fixtureWeights);
export const fixtureState = (over: Partial<CategoryState> = {}): CategoryState => ({
  ...DEFAULT_CATEGORY_STATE, selected: ["cpi.cat.01", "cpi.cat.04", "cpi.cat.07"], ...over,
});
```

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/inflationCategories.ts lib/explorer/inflationCategoryLabels.ts lib/explorer/colors.ts tests/explorer/inflationCategories.test.ts tests/explorer/fixtures/inflationCategories.ts
git commit -m "feat(inflation): category page state, selection and stack model" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: The stacked column chart

**Files:**
- Create: `components/main-explorer/stacked-column-chart.tsx`
- Test: `tests/explorer/stackedColumnChart.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks; it takes plain arrays.
- Produces:

```ts
export type StackSegment = { id: string; label: string; color: string; values: Array<number | null> };
export type StackedColumnChartProps = {
  periods: number[];
  segments: StackSegment[];
  overlay: { label: string; values: Array<number | null> } | null;
  formatPeriod: (period: number) => string;
  formatValue: (value: number) => string;
  ariaLabel: string;
};
```

- [ ] **Step 1: Write the failing test**

```tsx
// tests/explorer/stackedColumnChart.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackedColumnChart } from "../../components/main-explorer/stacked-column-chart";

const props = {
  periods: [24157, 24158],
  segments: [
    { id: "a", label: "Food", color: "#B3402A", values: [1.5, 1.2] },
    { id: "b", label: "Communication", color: "#4A707A", values: [-0.3, -0.2] },
  ],
  overlay: { label: "Headline", values: [1.2, 1.0] },
  formatPeriod: (period: number) => String(period),
  formatValue: (value: number) => value.toFixed(1),
  ariaLabel: "Contribution to inflation",
};

describe("StackedColumnChart", () => {
  it("draws one rect per segment and period", () => {
    const { container } = render(<StackedColumnChart {...props} />);
    expect(container.querySelectorAll("rect[data-segment]")).toHaveLength(4);
  });

  it("puts negative segments below the zero line", () => {
    const { container } = render(<StackedColumnChart {...props} />);
    const zero = Number(container.querySelector("line[data-zero]")!.getAttribute("y1"));
    const negative = container.querySelector('rect[data-segment="b"]')!;
    expect(Number(negative.getAttribute("y"))).toBeGreaterThanOrEqual(zero - 0.01);
  });

  it("draws the overlay over the stack", () => {
    const { container } = render(<StackedColumnChart {...props} />);
    expect(container.querySelector("path[data-overlay]")).not.toBeNull();
  });

  it("names every segment for assistive technology", () => {
    render(<StackedColumnChart {...props} />);
    expect(screen.getByLabelText("Contribution to inflation")).toBeTruthy();
    expect(screen.getAllByText(/Food/)).not.toHaveLength(0);
  });

  it("renders nothing but an empty frame with no periods", () => {
    const { container } = render(<StackedColumnChart {...props} periods={[]} segments={[]} overlay={null} />);
    expect(container.querySelectorAll("rect[data-segment]")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/stackedColumnChart.test.tsx`
Expected: FAIL — cannot resolve `stacked-column-chart`.

- [ ] **Step 3: Implement**

Build it as an inline SVG with no chart library, following `components/main-explorer/editorial-line-chart.tsx` for the axis, tick and label conventions and reusing `lib/explorer/dotLattice.ts` for x-label thinning. Requirements the tests pin, plus these:

- The y domain spans the largest positive stack and the most negative stack, always including zero, with a drawn `line[data-zero]`.
- Positive segments stack upward from zero in `segments` order; negative segments stack downward. Each `rect` carries `data-segment={id}`, a `<title>` of `{label}: {formatValue(value)}`, and the segment colour.
- The overlay renders after the bars as `path[data-overlay]` in `var(--ink)`.
- A `figure` wrapper with `role="img"` and `aria-label={ariaLabel}`, plus a visually-hidden list naming each segment and its latest value, so the chart is not colour-only.
- No hardcoded strings: every label arrives through props.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/explorer/stackedColumnChart.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add components/main-explorer/stacked-column-chart.tsx tests/explorer/stackedColumnChart.test.tsx
git commit -m "feat(explorer): stacked column chart with a zero line and overlay" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: The category series panel

**Files:**
- Create: `components/inflation/inflation-category-panel.tsx`
- Modify: `components/main-explorer/series-selector.tsx` (one optional prop)
- Test: `tests/explorer/inflationCategoryPanel.test.tsx`

**Interfaces:**
- Consumes: `CategoryIndex`, `CategoryState`, `toggleCategory`, `toggleExpanded`, `categoryColor`, `categoryLabel`.
- Produces: `<InflationCategoryPanel index state range onToggle onToggleExpanded onClear downloadAction />`.
- Modifies: `SeriesSelectorRow` gains `meta?: string` — a second, quieter metric rendered before `value`. Every existing caller omits it and is unaffected.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/explorer/inflationCategoryPanel.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InflationCategoryPanel } from "../../components/inflation/inflation-category-panel";
// Use the harness the other inflation component tests use to wrap in I18nProvider.
import { renderWithMessages } from "../helpers/renderWithMessages";

describe("InflationCategoryPanel", () => {
  it("lists twelve divisions and no subgroups until expanded", () => {
    renderWithMessages(<InflationCategoryPanel {...baseProps} />);
    expect(screen.getAllByTestId(/^series-row-cpi\.cat\.\d{2}$/)).toHaveLength(12);
    expect(screen.queryByTestId("series-row-cpi.cat.01_1")).toBeNull();
  });

  it("shows a division's subgroups when expanded", () => {
    renderWithMessages(<InflationCategoryPanel {...baseProps} state={{ ...baseProps.state, expanded: ["cpi.cat.01"] }} />);
    expect(screen.getByTestId("series-row-cpi.cat.01_1")).toBeTruthy();
  });

  it("counts divisions and subgroups separately", () => {
    renderWithMessages(<InflationCategoryPanel {...baseProps} />);
    expect(screen.getByTestId("series-selector").textContent).toContain("12 / 12");
  });

  it("shows each category's basket weight", () => {
    renderWithMessages(<InflationCategoryPanel {...baseProps} />);
    expect(screen.getByTestId("series-row-cpi.cat.01").textContent).toContain("33.6%");
  });

  it("shows a dash for a category with no value on the active tab", () => {
    renderWithMessages(<InflationCategoryPanel {...baseProps} state={{ ...baseProps.state, expanded: ["cpi.cat.04"] }} />);
    expect(screen.getByTestId("series-row-cpi.cat.04_2").textContent).toContain("—");
  });
});
```

`baseProps` comes from the shared fixture written in Task 10 Step 5:

```tsx
import { fixtureIndex, fixtureState } from "./fixtures/inflationCategories";

const index = fixtureIndex();
const baseProps = {
  index, state: fixtureState(), range: { min: 0, max: 0, start: 24319, end: 24319 },
  onToggle: () => {}, onToggleExpanded: () => {}, onClear: () => {}, downloadAction: null,
};
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/inflationCategoryPanel.test.tsx`
Expected: FAIL — cannot resolve the panel.

- [ ] **Step 3: Implement**

Compose `SeriesSelector` and `SeriesSelectorRow` exactly as `components/inflation/inflation-series-panel.tsx` does. The two-level behaviour needs **no new component** — `SeriesSelectorRow` already takes `level`, `parentId`, `showCaretColumn`, `hasChildren`, `expanded`, `onToggleExpanded`, `isChild` and `showRail`. Pass `countLabel` built from the message `inflation.categoryCounts` with `{selected}`, `{total}` and `{subgroups}`, and `supplementalSelected` for the subgroup count, so search never scopes the denominator.

Add `meta` to `SeriesSelectorRowProps` and render it before `value` in a `text-[10px] text-[var(--ink-fg-faint)] font-[family-name:var(--font-mono)]` span. Default it to `undefined` so no existing caller changes.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/explorer/inflationCategoryPanel.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Prove no existing selector changed**

Run: `npx vitest run tests/explorer/ministriesPanel.test.tsx tests/explorer/inflationOverviewRender.test.tsx`
Expected: PASS, unmodified. (If `ministriesPanel.test.tsx` is named differently, run every test that touches `series-selector`: `npx vitest run tests/explorer`.)

- [ ] **Step 6: Commit**

```bash
git add components/inflation/inflation-category-panel.tsx components/main-explorer/series-selector.tsx tests/explorer/inflationCategoryPanel.test.tsx
git commit -m "feat(inflation): two-level category panel with basket weights" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: The category table

**Files:**
- Modify: `lib/explorer/inflationGrid.ts`
- Create: `components/inflation/inflation-category-table.tsx`
- Test: `tests/explorer/inflationCategoryGrid.test.ts`

**Interfaces:**
- Produces: `CONTRIBUTION_BINS = [0, 0.25, 0.75, 1.5] as const` and `legendLabelsPp(edges)` in `inflationGrid.ts`; `<InflationCategoryTable index state range onTableSeriesChange />`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/explorer/inflationCategoryGrid.test.ts
import { describe, expect, it } from "vitest";
import { CONTRIBUTION_BINS, GRID_TINTS, binFor, contrastRatio, legendLabelsPp } from "../../lib/explorer/inflationGrid";

describe("contribution bins", () => {
  it("puts a negative contribution in the deflation bin", () => {
    expect(binFor(-0.24, CONTRIBUTION_BINS)).toBe(0);
  });

  it("separates a small contribution from a large one", () => {
    expect(binFor(0.1, CONTRIBUTION_BINS)).toBe(1);
    expect(binFor(1.74, CONTRIBUTION_BINS)).toBe(4);
  });

  it("labels the legend in percentage points", () => {
    expect(legendLabelsPp(CONTRIBUTION_BINS)[0]).toBe("< 0 პპ");
    expect(legendLabelsPp(CONTRIBUTION_BINS).at(-1)).toBe("≥ 1.5 პპ");
  });

  it("keeps every tint readable", () => {
    for (const tint of GRID_TINTS) expect(contrastRatio(tint.text, tint.background)).toBeGreaterThanOrEqual(4.5);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/inflationCategoryGrid.test.ts`
Expected: FAIL — `CONTRIBUTION_BINS` is not exported.

- [ ] **Step 3: Implement**

Add to `inflationGrid.ts`:

```ts
// Contributions are percentage points, so they need their own bins: a 1.7 pp
// contribution is large where a 1.7% price change is not.
export const CONTRIBUTION_BINS = [0, 0.25, 0.75, 1.5] as const;

export function legendLabelsPp(edges: readonly number[]): string[] {
  return [`< ${edges[0]} პპ`, ...edges.slice(0, -1).map((edge, index) => `${edge}–${edges[index + 1]} პპ`), `≥ ${edges.at(-1)} პპ`];
}
```

Write `inflation-category-table.tsx` as a near-copy of `inflation-table.tsx`'s composition — same `MonthGridTable`, same picker built from the selected categories, `edges` chosen by tab (`YOY_BINS`, `MOM_BINS`, `CONTRIBUTION_BINS`), and no summary column (Geostat publishes no annual average per category, so passing `summaryByYear` would invent one).

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/explorer/inflationCategoryGrid.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/explorer/inflationGrid.ts components/inflation/inflation-category-table.tsx tests/explorer/inflationCategoryGrid.test.ts
git commit -m "feat(inflation): category month grid with contribution bins" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: The page, its route and its messages

**Files:**
- Create: `components/inflation/inflation-categories.tsx`, `components/inflation/inflation-category-indicators.tsx`
- Create: `app/(ka)/explorer/inflation/categories/page.tsx`, `app/(en)/en/explorer/inflation/categories/page.tsx`
- Modify: `lib/pages/inflation.tsx`, `lib/explorer/inflationHubCards.ts`, `components/shell/data-sidebar.tsx`
- Modify: `lib/i18n/messages/ka/inflation.json`, `lib/i18n/messages/en/inflation.json`
- Test: `tests/explorer/inflationCategoriesRender.test.tsx`, `tests/explorer/inflationHub.test.ts` (extend)

**Interfaces:**
- Consumes: Tasks 10–13.
- Produces: `renderInflationCategories(locale)`, `inflationCategoriesMetadata(locale)` exported from `lib/pages/inflation.tsx`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/explorer/inflationCategoriesRender.test.tsx
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithMessages } from "../helpers/renderWithMessages";
import { InflationCategories } from "../../components/inflation/inflation-categories";

describe("InflationCategories", () => {
  it("lands on the contribution tab", () => {
    renderWithMessages(<InflationCategories {...props} />);
    expect(screen.getByTestId("inflation-category-tab-contrib").getAttribute("aria-selected")).toBe("true");
  });

  it("carries the unit line alone under the H1, with no headline value line", () => {
    renderWithMessages(<InflationCategories {...props} />);
    expect(screen.getByTestId("inflation-category-unit").textContent).toContain("პროცენტული პუნქტი");
    expect(screen.queryByTestId("inflation-category-headline")).toBeNull();
  });

  it("names the largest contributor in the indicators hero", () => {
    renderWithMessages(<InflationCategories {...props} />);
    expect(screen.getByTestId("inflation-category-hero").textContent).toContain("ტრანსპორტი");
  });

  it("selects all twelve divisions by default", () => {
    renderWithMessages(<InflationCategories {...props} />);
    expect(screen.getByTestId("series-selector").textContent).toContain("12 / 12");
  });

  it("switches to the line chart on a rate tab", async () => {
    const { user } = renderWithMessages(<InflationCategories {...props} />);
    await user.click(screen.getByTestId("inflation-category-tab-yoy"));
    expect(document.querySelector("path[data-overlay]")).toBeNull();
  });
});
```

`props` comes from the shared fixture written in Task 10 Step 5:

```tsx
import { fixtureFacts, fixtureHeadline, fixtureWeights } from "./fixtures/inflationCategories";

const props = { facts: fixtureFacts, weights: fixtureWeights, headline: fixtureHeadline, sources: [], siteOrigin: "https://fiscal.ge" };
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/inflationCategoriesRender.test.tsx`
Expected: FAIL — cannot resolve the component.

- [ ] **Step 3: Add the messages**

Add to both `lib/i18n/messages/ka/inflation.json` and `en/inflation.json`, each with a review date in the shape the file already uses. Georgian is canonical:

| key | ka | en |
| --- | --- | --- |
| `categoriesHeading` | `კატეგორიები` | `Categories` |
| `categoriesDescription` | `რომელი ჯგუფები ძვირდება და რამდენად განსაზღვრავენ ისინი საერთო ინფლაციას.` | `Which groups are rising, and how much of the headline they explain.` |
| `categoryTab.yoy` | `წლიური ინფლაცია` | `Annual inflation` |
| `categoryTab.mom` | `თვიური ინფლაცია` | `Monthly inflation` |
| `categoryTab.contrib` | `წვლილი ინფლაციაში` | `Contribution to inflation` |
| `categoryUnit.contrib` | `პროცენტული პუნქტი · წვლილი წლიურ ინფლაციაში ({headline})` | `Percentage points · contribution to annual inflation ({headline})` |
| `categoryCounts` | `ჯგუფები {selected} / {total} · ქვეჯგუფები {subgroups}` | `Groups {selected} / {total} · subgroups {subgroups}` |
| `residual` | `დანარჩენი` | `The rest` |
| `basketShare` | `კალათის წილი` | `Basket share` |
| `topContributor` | `ყველაზე დიდი წვლილი` | `Largest contributor` |
| `derivedNote` | `წვლილი გამოთვლილია Fiscal.ge-ის მიერ, საქსტატის გამოქვეყნებული ცვლილებებისა და კალათის წონების საფუძველზე.` | `Contributions are calculated by Fiscal.ge from Geostat's published changes and basket weights.` |
| `chartMode.columns` | `სვეტები` | `Columns` |

Add one message per COICOP division and subgroup under `inflation.category.<id>`, taking the Georgian from the `ka` workbook and the English from the `en` workbook — the reader already surfaces both, so extract them rather than translating.

- [ ] **Step 4: Implement the page**

`inflation-categories.tsx` follows `inflation-overview.tsx` line for line in structure: `useState` on the state module's default, hash read after hydration behind `ready`, `history.replaceState` on change, `document.body.dataset.appReady`. It renders `PageHeader`, the h1, then **the unit line alone** — no headline value line, per `DESIGN.md` §25 as amended by `f8dd5e05c`; copy the header markup and its 16px/12px spacing from `inflation-overview.tsx:100-103` rather than reinventing it — the three `TextTab`s (`data-testid="inflation-category-tab-<tab>"`), the `SegmentedTabs` mode toggle, then either `StackedColumnChart` (contrib), `EditorialLineChart` (rates) or `InflationCategoryTable`, the legend, `RangeStrip`, the source note with `derivedNote` on the contribution tab, `InflationCategoryPanel` and `InflationCategoryIndicators`.

`inflation-category-indicators.tsx` renders the hero (largest contributor, 62px mono value, its rate and basket share, one sentence) and three KPI cells with `Sparkline` over the last 36 months, from `latestContributors(index, 4)`.

In `lib/pages/inflation.tsx` add `renderInflationCategories` and `inflationCategoriesMetadata` beside the overview pair, loading `categories` and `weights` from `loadServedInflationData()`. **Memoize the served load and the category index once per build** — this is 28k rows and the page is rendered twice per locale; follow the pattern PR #102 introduced in `factQuery`.

Both route files re-export in the shape the sibling `overview/page.tsx` files use.

**Two hand-maintained route lists must learn about the page**, or it ships invisible to search and fails the i18n gate:

- `lib/seo/sitemap.ts:73` — add `{ url: \`${siteUrl}/explorer/inflation/categories\`, lastModified: inflationModified }` beside the overview entry.
- `lib/i18n/inventory.server.ts:18` — add `"/explorer/inflation/categories"` to the path list.

In `inflationHubCards.ts` make card 02 active: `href: "/explorer/inflation/categories"`, `comingSoon: false`, sparkline from the largest division's contribution series, footer `{month} · {label} {value} პპ`. Add the sidebar row in `components/shell/data-sidebar.tsx` beside the overview entry.

- [ ] **Step 5: Run it and watch it pass**

Run: `npx vitest run tests/explorer/inflationCategoriesRender.test.tsx tests/explorer/inflationHub.test.ts`
Expected: PASS. Update the hub test's expected card states — that file legitimately changes, since card 02 is no longer coming-soon.

- [ ] **Step 6: Check the i18n gate**

Run: `npm run i18n:check`
Expected: PASS. A missing review date or an untranslated key fails here.

- [ ] **Step 7: Commit**

```bash
git add components/inflation app/\(ka\)/explorer/inflation/categories app/\(en\)/en/explorer/inflation/categories lib/pages/inflation.tsx lib/explorer/inflationHubCards.ts components/shell/data-sidebar.tsx lib/i18n/messages tests/explorer
git commit -m "feat(inflation): the categories page, hub card and sidebar entry" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: The Excel export

**Files:**
- Create: `lib/explorer/inflationCategoryWorkbook.ts`
- Test: `tests/explorer/inflationCategoryWorkbook.test.ts`

**Interfaces:**
- Produces: `buildInflationCategoryWorkbookExportModel({ index, state, range, headline, presentation, sources, siteOrigin }): WorkbookExportModel`.

- [ ] **Step 1: Write the failing test**

`contribInput` comes from the shared fixture written in Task 10 Step 5, plus the presentation helper the other workbook tests use (`tests/explorer/inflationWorkbook.test.ts` shows how it builds a `Presentation`):

```ts
// tests/explorer/inflationCategoryWorkbook.test.ts
import { describe, expect, it } from "vitest";
import { buildInflationCategoryWorkbookExportModel } from "../../lib/explorer/inflationCategoryWorkbook";
import { fixtureHeadline, fixtureIndex, fixtureState } from "./fixtures/inflationCategories";
import { georgianPresentation } from "./helpers/presentation";

const contribInput = {
  index: fixtureIndex(),
  state: fixtureState({ tab: "contrib" }),
  range: { min: 24319, max: 24319, start: 24319, end: 24319 },
  headline: fixtureHeadline,
  presentation: georgianPresentation(),
  sources: [],
  siteOrigin: "https://fiscal.ge",
};

describe("buildInflationCategoryWorkbookExportModel", () => {
  it("includes the residual row on the contribution tab", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.readable.rows.some((row) => row.parentLabel === "დანარჩენი")).toBe(true);
  });

  it("omits the residual on a rate tab", () => {
    const model = buildInflationCategoryWorkbookExportModel({ ...contribInput, state: { ...contribInput.state, tab: "yoy" } });
    expect(model.readable.rows.some((row) => row.parentLabel === "დანარჩენი")).toBe(false);
  });

  it("carries the COICOP code, level and weight on the analysis sheet", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.analysis.headers).toContain("COICOP კოდი");
    expect(model.analysis.rows[0]).toHaveLength(model.analysis.headers.length);
  });

  it("names the file after the tab and range", () => {
    const model = buildInflationCategoryWorkbookExportModel(contribInput);
    expect(model.filename).toMatch(/^fiscal-inflation-categories-contrib-\d{4}-\d{2}-\d{4}-\d{2}\.xlsx$/);
  });

  it("lists the weights source only when contributions are exported", () => {
    const contrib = buildInflationCategoryWorkbookExportModel(contribInput);
    const rates = buildInflationCategoryWorkbookExportModel({ ...contribInput, state: { ...contribInput.state, tab: "yoy" } });
    expect(contrib.sources.some((row) => row.sourceId === "source.geostat_basket_weights")).toBe(true);
    expect(rates.sources.some((row) => row.sourceId === "source.geostat_basket_weights")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/explorer/inflationCategoryWorkbook.test.ts`
Expected: FAIL — cannot resolve the module.

- [ ] **Step 3: Implement**

Model it on `lib/explorer/inflationWorkbook.ts`, with these differences: rows come from the selected categories plus the residual on the contribution tab; there is no summary column; the analysis headers are `წელი`, `თვე`, `კატეგორია`, `COICOP კოდი`, `დონე`, `წონა (%)`, `მნიშვნელობა`, `ერთეული`, `სტატუსი`; percentages leave as fractions with `numericFormats` on the value column, and the weight column takes `0.0"%"`. Contribution exports append the `derivedNote` message to the readable sheet's subtitle.

- [ ] **Step 4: Run it and watch it pass**

Run: `npx vitest run tests/explorer/inflationCategoryWorkbook.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire the button**

Add `ExcelDownloadButton` to the panel's `downloadAction` in `inflation-categories.tsx`, exactly as the overview does.

- [ ] **Step 6: Commit**

```bash
git add lib/explorer/inflationCategoryWorkbook.ts components/inflation/inflation-categories.tsx tests/explorer/inflationCategoryWorkbook.test.ts
git commit -m "feat(inflation): category Excel export with the residual row" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Documents

**Files:**
- Modify: `docs/data-methodology/inflation-cpi-national.md`
- Modify: `Project_Definition.md` (§2C)
- Modify: `DESIGN.md`
- Modify: `data/methodology/source-archives/inflation.csv`
- Modify: `lib/methodology/content/inflation.ts`, `lib/methodology/content/en/inflation.ts`

- [ ] **Step 1: Extend the internal methodology**

Add to `docs/data-methodology/inflation-cpi-national.md`: the category extraction and its anchors; the two COICOP levels and the 2004 break; the gap inventory from spec §3.4 with the reason gaps are permitted for categories and never for the national series; the weights source, its annual refresh and its own archive tree; the contribution formula; the residual's definition; the measured reconstruction error; and why contributions start in 2013. Update the monthly-refresh section to note that categories need no extra step, and add an annual weights-refresh section.

- [ ] **Step 2: Amend the scope**

In `Project_Definition.md` §2C, move categories, subgroups and basket weights from the excluded list into the approved list, naming this spec. Leave cities, products, the calculator, other price indices, HICP and inflation MCP/JSON publications excluded.

- [ ] **Step 3: Record the visuals**

In `DESIGN.md`, extend the Inflation surfaces section with the categories page, and add the stacked column chart (zero line, positive above and negative below, published overlay, residual segment) and the COICOP colour block to the component and colour sections.

- [ ] **Step 4: Register the archive**

Add the weights file to `data/methodology/source-archives/inflation.csv` with its `repository_source_path`, `byte_size`, `sha256`, `retrieved_at` and public download path, matching the columns the CPI rows use. Add the public-facing text to the methodology content files so `/methodology/inflation` names the weights source and states plainly that contributions are a Fiscal.ge calculation.

- [ ] **Step 5: Verify the archive gate**

Run: `npm run data:check-methodology-archives`
Expected: PASS. This check covers every file under `docs/Raw Data/Inflation`, so a missing row fails here.

- [ ] **Step 6: Commit**

```bash
git add ../../docs/data-methodology/inflation-cpi-national.md ../../Project_Definition.md ../../DESIGN.md ../../data/methodology/source-archives/inflation.csv lib/methodology/content
git commit -m "docs(inflation): methodology, scope and design for categories" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 17: Browser coverage

**Files:**
- Create: `tests/browser/inflation-categories.spec.ts`

- [ ] **Step 1: Write the spec**

Cover, at desktop and at 390px, in both locales: the page loads from the hub card and the sidebar; the contribution tab is active on landing and the stack renders; switching to `წლიური ინფლაცია` swaps the stack for lines; the mode toggle shows the month grid; deselecting a division grows the residual (assert the legend still lists `დანარჩენი` and the chart still renders); expanding a division reveals subgroups; the hash survives a reload; the language switch keeps the tab and selection; the download button is present and enabled. Follow `tests/browser/inflation-overview.spec.ts` for the harness, selectors and locale helpers.

- [ ] **Step 2: Run it against a production build**

```bash
npm run build && npm run start -- --port 3100
```

then, in a second shell:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/inflation-categories.spec.ts
```

Expected: all pass. `next dev` fails hydration-dependent clicks — always test the production bundle. Compare the screenshots against the overview at the same widths: no clipped axis labels, no horizontal page overflow, tabs centred, the table scrolling inside its own frame.

- [ ] **Step 3: Commit**

```bash
git add tests/browser/inflation-categories.spec.ts
git commit -m "test(inflation): browser coverage for the categories page" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 18: Done-check

- [ ] **Step 1: The gates, once**

```bash
npm run check
```

Expected: lint, typecheck, unit tests, `data:validate` (now covering the two new CSVs) and `i18n:check` all pass.

```bash
npm run build
```

Expected: success. Watch the build time — if it has grown by more than a few seconds, the category index is being rebuilt per page; memoize it.

```bash
npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: the whole browser suite passes. A lone timeout in `municipal-entity.spec.ts` "sourced percentage workbook" is a known load flake — re-run it isolated before treating it as a regression.

- [ ] **Step 2: Walk the spec's acceptance list (§12)**

Confirm each item with the command that proves it: archive hash parity including the weights file (Task 1, 4); extraction parity at both levels and en/ka parity (Tasks 3, 7); weight sums (Task 5); the gap inventory (Tasks 5, 7); the revision guard (Task 5); reconstruction within bounds (Tasks 6, 7); mirror parity (Task 9); contributions absent before 2013 (Task 6); the stack closing on the published headline with and without a full selection (Task 10); the residual responding to selection (Tasks 10, 17); two-level counts (Task 12); tint bins and contrast (Task 13); range transitions across three coverages (Task 10); hash restore and language switch (Task 17); workbook contents (Task 15); and every existing inflation test green **unmodified** except `inflationHub.test.ts`, whose card-state expectation legitimately changed in Task 14.

- [ ] **Step 3: Report**

Tell the user what shipped, the four decisions recorded in spec §1.2, the measured reconstruction figures from `data/reports/inflation-cpi-validation.json`, and the outcome of the Georgian weights-file collection task. Do not push, open a PR, or run `npm run data:import`; publishing follows the `codex/*` branch → PR → CI → merge route only when authorized.
