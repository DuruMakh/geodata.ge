# Fiscal.ge Readable Excel Exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace public explorer CSV downloads with one Fiscal.ge `.xlsx` workbook containing a formatted `მარტივი ცხრილი` sheet and a filterable `მონაცემები` sheet.

**Architecture:** Normalize national and municipal explorer rows into one pure workbook model, then serialize that model in the browser through a lazily imported ExcelJS writer. Server routes project validated methodology manifests into compact public-source metadata and pass the resolved site origin to client explorers; no API route or server-side file generation is added.

**Tech Stack:** Next.js 16.2.11, React 19.2.8, strict TypeScript, ExcelJS 4.4.x, Vitest 4.1.5, Playwright 1.60.0, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-08-21-readable-xlsx-exports-design.md`

## Global Constraints

- Start implementation from Fiscal.ge `main` at merge commit `2c5c1403` or later; preserve the committed specification.
- Keep one public action labelled `Excel ჩამოტვირთვა`; do not add a public CSV action or file-format menu.
- Every workbook has exactly two visible sheets in this order: `მარტივი ცხრილი`, `მონაცემები`.
- `მარტივი ცხრილი` starts its table on row 3; year headings and numeric values are right-aligned.
- `მონაცემები` uses Georgian headers and never exposes category IDs, parent IDs, English labels, source IDs, hashes, review notes, or repository paths.
- Build source hyperlinks from the resolved site origin plus validated `downloadHref`; never hardcode Fiscal.ge or a Vercel hostname in workbook-generation code.
- Preserve actual-over-planned precedence, municipal public-total semantics, missing values, real zeros, negative values, and selected-series ordering.
- Load ExcelJS only after the user activates the download.
- Preserve the fully static deployment model; add no API route, server write, persisted export, public API, or direct database mutation.
- Methodology manifests, original-source files, ZIPs, canonical import CSVs, and database parity remain unchanged.
- Use `npm.cmd` commands from `apps/web` on Windows.
- Stage only task-owned files. Never stage `outputs/01a024ba-8afd-7061-b6c1-4efce14a46d9/`.

## Execution Preflight

- [ ] Update the feature branch from merged Fiscal.ge `main` before Task 1.

```powershell
git fetch origin main
git rebase origin/main
git merge-base --is-ancestor 2c5c1403 HEAD
```

Expected: the final command exits `0`, and `git log -1 --oneline origin/main` is `2c5c1403` or newer. If command-line credentials are unavailable, use the Codex App's update-from-main control, then run the ancestry check locally.

- [ ] Confirm the branch contains only the specification plus intentional task work.

```powershell
git status --short --branch
git diff --stat origin/main...HEAD
```

Expected before implementation: `docs/superpowers/specs/2026-08-21-readable-xlsx-exports-design.md` is the only tracked feature diff. Prototype workbooks may remain untracked under `outputs/` and must not be staged.

---

### Task 1: Pure Workbook Export Model

**Files:**
- Create: `apps/web/lib/explorer/workbookModel.ts`
- Test: `apps/web/tests/explorer/workbookModel.test.ts`

**Interfaces:**
- Consumes: normalized selected explorer series, active years, active measure, scope copy, and projected public sources.
- Produces: `WorkbookExportInput`, `WorkbookExportModel`, `buildWorkbookExportModel(input)`, and `absoluteWorkbookSourceUrl(siteOrigin, downloadHref)` for every later task.

- [ ] **Step 1: Write failing tests for the approved model boundary**

Create fixtures that cover nominal values, a negative starting value, a missing year, a selected total, planned status, and duplicate source rows.

```ts
import { describe, expect, it } from "vitest";
import {
  absoluteWorkbookSourceUrl,
  buildWorkbookExportModel,
  type WorkbookExportInput,
} from "../../lib/explorer/workbookModel";

const input: WorkbookExportInput = {
  filenameBase: "revenue",
  titleKa: "საქართველოს საგადასახადო შემოსავლები",
  groupLabelKa: "გადასახადები",
  years: [2020, 2021],
  measure: { kind: "amount", unitLabelKa: "მილიონი ₾", readableScale: 1_000_000 },
  totalId: "revenue.total",
  series: [
    {
      id: "revenue.total",
      kind: "total",
      parentLabelKa: null,
      labelKa: "გადასახადები სულ",
      pointsByYear: {
        2020: { amountGel: 90, basis: "actual" },
        2021: { amountGel: 130, basis: "actual" },
      },
    },
    {
      id: "revenue.vat",
      kind: "item",
      parentLabelKa: null,
      labelKa: "დამატებული ღირებულების გადასახადი",
      pointsByYear: {
        2020: { amountGel: -10, basis: "actual" },
        2021: { amountGel: 30, basis: "planned" },
      },
    },
  ],
  sources: [
    {
      years: [2020],
      titleKa: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
      organizationKa: "საქართველოს ფინანსთა სამინისტრო",
      downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
      retrievedAt: "2026-06-09",
    },
    {
      years: [2020],
      titleKa: "2020 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
      organizationKa: "საქართველოს ფინანსთა სამინისტრო",
      downloadHref: "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
      retrievedAt: "2026-06-09",
    },
  ],
  siteOrigin: "https://fiscal.ge/",
};

describe("buildWorkbookExportModel", () => {
  it("builds two-sheet content without public IDs or duplicate sources", () => {
    const model = buildWorkbookExportModel(input);

    expect(model.filename).toBe("fiscal-revenue-2020-2021.xlsx");
    expect(model.readable.years).toEqual([2020, 2021]);
    expect(model.readable.rows.map((row) => row.labelKa)).toEqual([
      "გადასახადები სულ",
      "დამატებული ღირებულების გადასახადი",
    ]);
    expect(model.analysis.headers).toEqual([
      "წელი",
      "მთავარი ჯგუფი",
      "კატეგორია",
      "თანხა (₾)",
      "სტატუსი",
    ]);
    expect(model.analysis.rows[0]).not.toContain("revenue.vat");
    expect(model.readable.sources).toHaveLength(1);
  });

  it("leaves change blank for a negative starting value", () => {
    const model = buildWorkbookExportModel(input);
    expect(model.readable.rows[1]?.change).toBeNull();
  });

  it("normalizes the site origin without hardcoding a host", () => {
    expect(
      absoluteWorkbookSourceUrl(
        "https://fiscal.ge/",
        "/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
      ),
    ).toBe("https://fiscal.ge/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf");
  });
});
```

- [ ] **Step 2: Run the tests and verify the missing module failure**

Run:

```powershell
npm.cmd test -- tests/explorer/workbookModel.test.ts
```

Expected: FAIL because `lib/explorer/workbookModel` does not exist.

- [ ] **Step 3: Implement the typed pure model**

Define the exact public types and keep all workbook-library objects out of this file.

```ts
export type WorkbookBasis = "actual" | "planned";

export type WorkbookPoint = {
  amountGel: number;
  measureValue?: number | null;
  basis: WorkbookBasis;
};

export type WorkbookSeries = {
  id: string;
  kind: "total" | "group" | "item";
  parentLabelKa: string | null;
  labelKa: string;
  pointsByYear: Record<number, WorkbookPoint | null | undefined>;
};

export type WorkbookPublicSource = {
  years: number[];
  titleKa: string;
  organizationKa: string;
  downloadHref: `/downloads/methodology/${string}`;
  retrievedAt: string;
};

export type WorkbookMeasure =
  | { kind: "amount"; unitLabelKa: string; readableScale: number }
  | { kind: "percentage"; unitLabelKa: string; analysisHeaderKa: string };

export type WorkbookExportInput = {
  filenameBase: string;
  titleKa: string;
  groupLabelKa: string;
  years: number[];
  measure: WorkbookMeasure;
  totalId: string | null;
  series: WorkbookSeries[];
  sources: WorkbookPublicSource[];
  siteOrigin: string;
};

export type WorkbookReadableRow = {
  kind: WorkbookSeries["kind"];
  parentLabelKa: string | null;
  labelKa: string;
  valuesByYear: Record<number, number | null>;
  basisByYear: Record<number, WorkbookBasis | null>;
  change: number | null;
};

export type WorkbookExportModel = {
  filename: string;
  readable: {
    titleKa: string;
    subtitleKa: string;
    unitLabelKa: string;
    years: number[];
    rows: WorkbookReadableRow[];
    sources: Array<WorkbookPublicSource & { absoluteUrl: string }>;
  };
  analysis: {
    headers: string[];
    rows: Array<Array<string | number | null>>;
  };
};
```

Implement these exact rules:

```ts
const statusKa = (basis: WorkbookBasis) => (basis === "planned" ? "გეგმა" : "ფაქტი");

export function absoluteWorkbookSourceUrl(siteOrigin: string, downloadHref: string): string {
  return `${siteOrigin.replace(/\/+$/, "")}/${downloadHref.replace(/^\/+/, "")}`;
}

function safeChange(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start <= 0 || end < 0) return null;
  return end / start - 1;
}
```

`buildWorkbookExportModel` must:

1. preserve `input.series` order;
2. omit years outside `input.years`;
3. represent missing values as `null` and real zero as `0`;
4. compute amount-mode readable values as `amountGel / input.measure.readableScale`;
5. use `measureValue` for percentage mode and keep the full `amountGel` in analysis rows;
6. use exact total points rather than summing component rows;
7. omit the total from `analysis.rows` when at least one non-total series exists;
8. include the total in `analysis.rows` when it is the only selected series;
9. emit `მთავარი ჯგუფი` as `parentLabelKa ?? input.groupLabelKa`;
10. emit `ფაქტი` / `გეგმა` rather than internal basis values;
11. add `measure.analysisHeaderKa` only for percentage mode;
12. deduplicate sources by `downloadHref`, filter them to active years, and sort by earliest covered year.

- [ ] **Step 4: Add coverage for missing years, zero, percentage mode, non-additive totals, and total-only selection**

Add focused tests asserting:

```ts
expect(missingYearModel.readable.rows[0]?.valuesByYear[2020]).toBeNull();
expect(zeroModel.readable.rows[0]?.valuesByYear[2020]).toBe(0);
expect(shareModel.analysis.headers.at(-1)).toBe("მშპ-ის წილი (%)");
expect(nonAdditiveTotalModel.readable.rows[0]?.valuesByYear[2025]).toBe(1_212.5);
expect(totalOnlyModel.analysis.rows).toHaveLength(totalOnlyModel.readable.years.length);
```

- [ ] **Step 5: Run the model tests**

Run:

```powershell
npm.cmd test -- tests/explorer/workbookModel.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```powershell
git add -- apps/web/lib/explorer/workbookModel.ts apps/web/tests/explorer/workbookModel.test.ts
git commit -m "feat: add shared Excel export model"
```

---

### Task 2: Validated Public Source Projection

**Files:**
- Create: `apps/web/lib/methodology/workbookSources.ts`
- Test: `apps/web/tests/methodology/workbookSources.test.ts`

**Interfaces:**
- Consumes: `ValidatedSourceManifestRow[]` from `loadReviewedSourceManifest`.
- Produces: `projectWorkbookSources(rows)` and memoized `loadWorkbookSources(datasetId): Promise<WorkbookPublicSource[]>` for route components.

- [ ] **Step 1: Write failing projection and cache tests**

```ts
import { describe, expect, it } from "vitest";
import { projectWorkbookSources } from "../../lib/methodology/workbookSources";

describe("projectWorkbookSources", () => {
  it("keeps only client-safe public fields", () => {
    const projected = projectWorkbookSources([
      {
        source_id: "source.mof.revenue.2025.form_1",
        dataset_id: "revenue",
        year: "2025",
        years: [2025],
        source_organization: "საქართველოს ფინანსთა სამინისტრო",
        display_title_ka: "2025 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
        official_filename: "2025.pdf",
        official_url_or_archive_url: "Repository archive",
        repository_source_path: "docs/Raw Data/Revenue/2025.pdf",
        public_download_path: "downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        downloadHref: "/downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        media_type: "application/pdf",
        byte_size: 10,
        sha256: "a".repeat(64),
        retrieved_at: "2026-05-14",
        retrieved_at_basis: "repository_first_commit_proxy",
        license_id: "official-public-document-no-explicit-license",
        attribution_text: "საქართველოს ფინანსთა სამინისტრო",
        redistribution_status: "repository_owner_approved",
        notes: "internal note",
      },
    ]);

    expect(projected).toEqual([
      {
        years: [2025],
        titleKa: "2025 წლის კონსოლიდირებული ბიუჯეტის შემოსავლები",
        organizationKa: "საქართველოს ფინანსთა სამინისტრო",
        downloadHref: "/downloads/methodology/revenue/files/2025/mof-revenue-form-1.pdf",
        retrievedAt: "2026-05-14",
      },
    ]);
    expect(JSON.stringify(projected)).not.toContain("docs/Raw Data");
    expect(JSON.stringify(projected)).not.toContain("source.mof");
  });
});
```

- [ ] **Step 2: Run the test and verify the missing module failure**

```powershell
npm.cmd test -- tests/methodology/workbookSources.test.ts
```

Expected: FAIL because `workbookSources.ts` does not exist.

- [ ] **Step 3: Implement the safe projection and build-time memo**

```ts
import path from "node:path";
import type { WorkbookPublicSource } from "../explorer/workbookModel";
import { loadReviewedSourceManifest, type ValidatedSourceManifestRow } from "./sourceManifest";
import type { MethodologyDatasetId } from "./types";

export function projectWorkbookSources(
  rows: readonly ValidatedSourceManifestRow[],
): WorkbookPublicSource[] {
  return rows.map((row) => ({
    years: row.years,
    titleKa: row.display_title_ka,
    organizationKa: row.source_organization,
    downloadHref: row.downloadHref,
    retrievedAt: row.retrieved_at,
  }));
}

const cache = new Map<MethodologyDatasetId, Promise<WorkbookPublicSource[]>>();

export function loadWorkbookSources(datasetId: MethodologyDatasetId): Promise<WorkbookPublicSource[]> {
  const existing = cache.get(datasetId);
  if (existing) return existing;

  const repositoryRoot = path.resolve(process.cwd(), "../..");
  const pending = loadReviewedSourceManifest(repositoryRoot, datasetId).then(projectWorkbookSources);
  cache.set(datasetId, pending);
  return pending;
}

export function resetWorkbookSourceCacheForTests(): void {
  cache.clear();
}
```

- [ ] **Step 4: Test all three live dataset IDs and public-path safety**

Add parameterized cases for `expenditure`, `revenue`, and `municipalities`. Assert every `downloadHref` starts with `/downloads/methodology/{dataset}/files/` and no projected object contains `repository_source_path`.

- [ ] **Step 5: Run the source tests and methodology archive tests**

```powershell
npm.cmd test -- tests/methodology/workbookSources.test.ts tests/methodology/sourceManifest.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```powershell
git add -- apps/web/lib/methodology/workbookSources.ts apps/web/tests/methodology/workbookSources.test.ts
git commit -m "feat: project public workbook sources"
```

---

### Task 3: Lazy ExcelJS Workbook Writer

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/lib/explorer/workbookWriter.client.ts`
- Test: `apps/web/tests/explorer/workbookWriter.test.ts`

**Interfaces:**
- Consumes: `WorkbookExportModel` from Task 1.
- Produces: `createWorkbookBuffer(model): Promise<ArrayBuffer>` and `downloadWorkbook(model): Promise<void>`.

- [ ] **Step 1: Add ExcelJS as an exact production dependency**

Run from `apps/web`:

```powershell
npm.cmd install --save-exact exceljs@4.4.0
```

Expected: `exceljs` appears under `dependencies`, not `devDependencies`, and the lockfile changes only for ExcelJS and its transitive packages.

- [ ] **Step 2: Write failing round-trip tests**

The test must import ExcelJS only to read the produced buffer and assert workbook structure.

```ts
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";

it("writes the approved two-sheet workbook", async () => {
  const buffer = await createWorkbookBuffer(approvedModelFixture);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "მარტივი ცხრილი",
    "მონაცემები",
  ]);
  expect(workbook.views[0]?.activeTab).toBe(0);

  const readable = workbook.getWorksheet("მარტივი ცხრილი")!;
  expect(readable.getCell("A1").value).toBe("საქართველოს საგადასახადო შემოსავლები");
  expect(readable.getCell("B3").value).toBe(2020);
  expect(readable.getCell("B3").alignment?.horizontal).toBe("right");
  expect(readable.views[0]).toMatchObject({ state: "frozen", xSplit: 1, ySplit: 3 });

  const analysis = workbook.getWorksheet("მონაცემები")!;
  expect(analysis.getRow(1).values).toEqual([
    undefined,
    "წელი",
    "მთავარი ჯგუფი",
    "კატეგორია",
    "თანხა (₾)",
    "სტატუსი",
  ]);
  expect(analysis.getCell("D2").type).toBe(ExcelJS.ValueType.Number);
  expect(JSON.stringify(analysis.getRow(1).values)).not.toContain("კატეგორიის კოდი");
});
```

- [ ] **Step 3: Run the writer test and verify failure**

```powershell
npm.cmd test -- tests/explorer/workbookWriter.test.ts
```

Expected: FAIL because `workbookWriter.client.ts` does not exist.

- [ ] **Step 4: Implement the client writer with one delayed library import**

Use a dynamic import inside `createWorkbookBuffer`; do not import ExcelJS at module scope.

```ts
import type { WorkbookExportModel } from "./workbookModel";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function createWorkbookBuffer(model: WorkbookExportModel): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Fiscal.ge";
  workbook.created = new Date();
  workbook.views = [{ activeTab: 0 }];

  const readable = workbook.addWorksheet("მარტივი ცხრილი", {
    views: [{ state: "frozen", xSplit: 1, ySplit: 3, topLeftCell: "B4" }],
  });
  const analysis = workbook.addWorksheet("მონაცემები", {
    views: [{ state: "frozen", ySplit: 1, topLeftCell: "A2" }],
  });

  writeReadableSheet(readable, model.readable);
  writeAnalysisSheet(analysis, model.analysis);

  const bytes = await workbook.xlsx.writeBuffer();
  return new Uint8Array(bytes).buffer;
}

export async function downloadWorkbook(model: WorkbookExportModel): Promise<void> {
  const buffer = await createWorkbookBuffer(model);
  const url = URL.createObjectURL(new Blob([buffer], { type: XLSX_MIME }));
  const link = document.createElement("a");
  link.href = url;
  link.download = model.filename;
  link.click();
  URL.revokeObjectURL(url);
}
```

Implement `writeReadableSheet` with these exact workbook mechanics:

- merge title across all used columns in row 1;
- merge subtitle across all used columns in row 2;
- write the table header in row 3;
- place years in columns `B...` and the change column last;
- right-align all year/change headers and numeric cells;
- write totals from exact model values, not inferred sums;
- format nominal readable values as `#,##0.0;[Red](#,##0.0);–`;
- format percentages as `0.0%;[Red](0.0%);–`;
- indent `kind: "item"` rows with a parent label;
- keep planned cells numeric and make the marker visible through a per-cell number format suffix: `#,##0.0 "გეგმა"` for amounts or `0.0% "გეგმა"` for percentages, plus the approved faint planned-cell fill;
- write sources after the reading note;
- assign hyperlink cells as `{ text: source.absoluteUrl, hyperlink: source.absoluteUrl, tooltip: source.titleKa }`.

Implement `writeAnalysisSheet` with `worksheet.addTable({ name: "FiscalExportData", ref: "A1", headerRow: true, ... })`, filter buttons on every column, full numeric GEL values, and no totals row.

- [ ] **Step 5: Add exact writer tests for styles, hyperlinks, filters, formulas, and forbidden text**

Assert:

```ts
expect(readable.getCell("E18").value).toMatchObject({
  hyperlink: "https://fiscal.ge/downloads/methodology/revenue/files/2020/mof-revenue-form-1.pdf",
});
expect(analysis.getTables()).toHaveLength(1);
expect(JSON.stringify(analysis.getSheetValues())).not.toMatch(
  /category_id|parent_id|source_id|docs\/Raw Data/,
);
```

Also load a percentage fixture and verify `მშპ-ის წილი (%)` is the sixth header only for that fixture.

- [ ] **Step 6: Run writer, model, audit, and type checks**

```powershell
npm.cmd test -- tests/explorer/workbookWriter.test.ts tests/explorer/workbookModel.test.ts
npm.cmd run typecheck
npm.cmd audit --omit=dev --audit-level=high
```

Expected: all commands PASS; audit reports zero high/critical production vulnerabilities.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- apps/web/package.json apps/web/package-lock.json apps/web/lib/explorer/workbookWriter.client.ts apps/web/tests/explorer/workbookWriter.test.ts
git commit -m "feat: write styled Excel workbooks"
```

---

### Task 4: Shared Download Action and National Explorer Integration

**Files:**
- Create: `apps/web/components/explorer/excel-download-button.tsx`
- Modify: `apps/web/components/main-explorer/main-explorer.tsx` around `downloadCsv` and the dataset-owned button
- Modify: `apps/web/app/explorer/expenditure/page.tsx`
- Modify: `apps/web/app/explorer/revenue/page.tsx`
- Modify: `apps/web/tests/browser/main-explorer.spec.ts` around the existing CSV tests

**Interfaces:**
- Consumes: `buildWorkbookExportModel`, `downloadWorkbook`, `loadWorkbookSources`, `resolveSiteUrl`, and `ExplorerTableRow` models.
- Produces: reusable `ExcelDownloadButton` and fully functional national expenditure/revenue XLSX downloads.

- [ ] **Step 1: Replace browser expectations with failing XLSX expectations**

Update the existing download helper in `main-explorer.spec.ts` to read `.xlsx` bytes with ExcelJS.

```ts
async function downloadWorkbook(page: Page) {
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("series-excel").click();
  const download = await downloadPromise;
  const path = await download.path();
  if (!path) throw new Error("Expected a local XLSX download path");
  const bytes = await readFile(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return { download, workbook };
}
```

Add assertions for:

- filename `^fiscal-(fields|ministries|revenue)-\d{4}-\d{4}\.xlsx$`;
- exact sheet names;
- selected range only;
- selected series only;
- no `series-csv` action;
- `Excel მზადდება…` while generation is pending;
- retryable Georgian error copy after a mocked writer rejection;
- `% მშპ-ში` adds `მშპ-ის წილი (%)` to `მონაცემები`.

- [ ] **Step 2: Run the representative browser test and verify failure**

```powershell
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts --grep "Excel|download"
```

Expected: FAIL because `series-excel` and XLSX generation do not exist.

- [ ] **Step 3: Implement the shared stateful action**

```tsx
"use client";

import { useState } from "react";

type ExcelDownloadButtonProps = {
  testId: string;
  disabled: boolean;
  onDownload: () => Promise<void>;
};

export function ExcelDownloadButton({ testId, disabled, onDownload }: ExcelDownloadButtonProps) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function start() {
    if (disabled || status === "working") return;
    setStatus("working");
    try {
      await onDownload();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mt-[18px]">
      <button
        type="button"
        data-testid={testId}
        disabled={disabled || status === "working"}
        onClick={start}
        className="h-[38px] w-full cursor-pointer rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] transition-opacity duration-150 hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {status === "working" ? "Excel მზადდება…" : "Excel ჩამოტვირთვა"}
      </button>
      <p aria-live="polite" className="mt-2 min-h-4 text-[11px] text-[var(--negative)]">
        {status === "error" ? "ფაილი ვერ მომზადდა — სცადეთ თავიდან." : ""}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Pass validated sources and resolved origin from national routes**

In each route, load data and sources together:

```ts
const [{ facts, glossary, sourceDocuments, adminFacts, adminCategories, gdpFacts }, workbookSources] =
  await Promise.all([
    loadServedExplorerData(),
    loadWorkbookSources("expenditure"),
  ]);

<MainExplorer
  siteOrigin={resolveSiteUrl()}
  workbookSources={workbookSources}
  {...existingProps}
/>
```

The revenue route uses `loadWorkbookSources("revenue")` and retains the current rule that admin facts/categories are not shipped.

- [ ] **Step 5: Replace `downloadCsv` with the national workbook adapter**

Inside `MainExplorer`, map only `model.tableRows` and `model.years`. Use:

- `amountGel = row.valuesByYear[year]`;
- `measureValue = share ? row.shareByYear?.[year] : undefined`;
- `kind = total | group | item` from `row.level` and total identity;
- `parentLabelKa` from the active ministry parent map, otherwise `null`;
- `groupLabelKa = შემოსავლები | ხარჯები | უწყებები`;
- `measure.analysisHeaderKa = "მშპ-ის წილი (%)"` only when `share` is active.

Render:

```tsx
<ExcelDownloadButton
  testId="series-excel"
  disabled={model.tableRows.length === 0}
  onDownload={() => downloadWorkbook(buildWorkbookExportModel(workbookInput))}
/>
```

Delete the direct Blob CSV code from `MainExplorer` but keep `csvExport.ts` until Task 5 removes the municipal caller.

- [ ] **Step 6: Run national unit, browser, type, and lint checks**

```powershell
npm.cmd test -- tests/explorer/workbookModel.test.ts tests/explorer/workbookWriter.test.ts
npm.cmd run test:browser -- tests/browser/main-explorer.spec.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 4**

```powershell
git add -- apps/web/components/explorer/excel-download-button.tsx apps/web/components/main-explorer/main-explorer.tsx apps/web/app/explorer/expenditure/page.tsx apps/web/app/explorer/revenue/page.tsx apps/web/tests/browser/main-explorer.spec.ts
git commit -m "feat: download national data as Excel"
```

---

### Task 5: Municipality, Region, and Georgia Workbook Integration

**Files:**
- Modify: `apps/web/components/municipalities/municipal-explorer.tsx` around `downloadCsv`
- Modify: `apps/web/app/explorer/municipalities/[code]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`
- Modify: `apps/web/app/explorer/municipalities/georgia/page.tsx`
- Modify: `apps/web/tests/browser/municipal-entity.spec.ts`
- Modify: `apps/web/tests/browser/municipal-region.spec.ts`
- Modify: `apps/web/tests/browser/municipal-georgia.spec.ts`
- Delete: `apps/web/lib/explorer/csvExport.ts`
- Delete: `apps/web/tests/explorer/csvExport.test.ts`

**Interfaces:**
- Consumes: shared model/writer/button and `WorkbookPublicSource[]` from Tasks 1–4.
- Produces: identical XLSX behavior across 64 municipality routes, 11 regions, and Georgia aggregate; removes the final public CSV writer consumer.

- [ ] **Step 1: Replace municipal CSV tests with failing workbook tests**

For municipality, region, and Georgia tests, assert:

```ts
expect(download.suggestedFilename()).toMatch(
  /^fiscal-(municipality-04|region-adjara|municipalities-georgia)-\d{4}-\d{4}\.xlsx$/,
);
expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
  "მარტივი ცხრილი",
  "მონაცემები",
]);
```

Set a narrow range in the page before download, then assert no year outside that range appears in readable row 3 or analysis column `წელი`. On Georgia, assert no aggregate-only code or internal entity ID appears anywhere in either sheet.

- [ ] **Step 2: Run the three targeted browser files and verify failure**

```powershell
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/municipal-georgia.spec.ts
```

Expected: FAIL because the pages still download CSV and municipal download ignores the active range.

- [ ] **Step 3: Pass one cached municipality source projection and site origin through all routes**

Each route loads:

```ts
const [servedMunicipalData, landingData, workbookSources] = await Promise.all([
  loadServedMunicipalData(),
  loadServedLandingData(),
  loadWorkbookSources("municipalities"),
]);
```

Pass `siteOrigin={resolveSiteUrl()}` and `workbookSources={workbookSources}` into `MunicipalExplorer`. Rename `csvBasename` to `workbookBasename` in its props and all call sites.

- [ ] **Step 4: Build the municipal workbook from active state**

Use exactly:

```ts
const selectedRows = [model.totalRow, ...model.rows].filter((row) =>
  state.selectedIds.includes(row.itemId),
);
const years = allYears.filter(
  (year) => year >= state.range.start && year <= state.range.end,
);
```

For nominal mode, set `measure = { kind: "amount", unitLabelKa: "მილიონი ₾", readableScale: 1_000_000 }`. For `% წილი`, set `measureValue = amountGel / model.totalRow.valuesByYear[year]` and add `წილი მთლიან ბიუჯეტში (%)` to the analysis sheet. Always keep `amountGel` as full GEL in `მონაცემები`.

Use the exact public total row supplied by `buildMunicipalEntityModel`; never calculate it by summing functions. For the Georgia workbook title/context, use the public label `საქართველო`, never `country.georgia`.

- [ ] **Step 5: Replace the municipal button and remove CSV code**

Render `ExcelDownloadButton` with `testId="municipal-excel"`. Remove `downloadCsv`, CSV-specific Georgia prefix injection, `buildExplorerCsv` imports, and CSV MIME/filename code.

After both national and municipal callers are gone, delete:

```text
apps/web/lib/explorer/csvExport.ts
apps/web/tests/explorer/csvExport.test.ts
```

- [ ] **Step 6: Run municipal model, browser, type, and lint checks**

```powershell
npm.cmd test -- tests/explorer/workbookModel.test.ts tests/explorer/workbookWriter.test.ts
npm.cmd run test:browser -- tests/browser/municipal-entity.spec.ts tests/browser/municipal-region.spec.ts tests/browser/municipal-georgia.spec.ts
npm.cmd run typecheck
npm.cmd run lint
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```powershell
git add -- apps/web/components/municipalities/municipal-explorer.tsx apps/web/app/explorer/municipalities/[code]/page.tsx apps/web/app/explorer/municipalities/region/[id]/page.tsx apps/web/app/explorer/municipalities/georgia/page.tsx apps/web/tests/browser/municipal-entity.spec.ts apps/web/tests/browser/municipal-region.spec.ts apps/web/tests/browser/municipal-georgia.spec.ts
git add --update -- apps/web/lib/explorer/csvExport.ts apps/web/tests/explorer/csvExport.test.ts
git commit -m "feat: download municipal data as Excel"
```

---

### Task 6: Landing Copy and Authoritative Documentation

**Files:**
- Modify: `Project_Definition.md` section 2 export scope
- Modify: `DESIGN.md` sections 7.8, 10, 11, 15, 18, and 19
- Modify: `apps/web/lib/landing/landingData.ts`
- Modify: `apps/web/tests/landing/landingData.test.ts`
- Modify: `apps/web/components/landing/landing-page.tsx`
- Modify: `apps/web/tests/browser/landing.spec.ts`
- Modify: `README.md` and `apps/web/README.md` only where they describe public CSV export behavior

**Interfaces:**
- Consumes: the final workbook contract.
- Produces: user-facing and authoritative documentation with no stale public CSV promise.

- [ ] **Step 1: Write failing landing assertions for Excel terminology**

Replace the CSV-preview expectations with:

```ts
expect(page.getByText("Excel მონაცემები")).toBeVisible();
await expect(page.getByText("მარტივი ცხრილი")).toBeVisible();
await expect(page.getByText("მონაცემები")).toBeVisible();
await expect(page.getByText(/year,category_id|amount_gel/)).toHaveCount(0);
```

The landing preview remains data-backed: show one real category label and two real year values, not a fake screenshot or hardcoded budget number.

- [ ] **Step 2: Run landing tests and verify failure**

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run test:browser -- tests/browser/landing.spec.ts
```

Expected: FAIL on stale CSV copy/preview.

- [ ] **Step 3: Replace the landing CSV model with a small workbook preview model**

Change `csvLines` to:

```ts
type ExcelPreview = {
  sheetNames: ["მარტივი ცხრილი", "მონაცემები"];
  headers: ["კატეგორია", string, string];
  rows: Array<[string, number, number]>;
};
```

Populate it from the same active facts already used by `buildLandingData`; use the latest two available years and real Georgian labels.

- [ ] **Step 4: Update authoritative documents exactly**

Document:

- one `Excel ჩამოტვირთვა` action;
- two sheet names and exact Georgian analysis headers;
- table beginning on row 3 and right-aligned years;
- source hyperlinks from the validated public archive;
- no public explorer CSV action;
- methodology manifest CSVs remain unchanged;
- active range/selection behavior;
- Fiscal filenames ending `.xlsx`.

Do not alter data methodology or original-source archive semantics.

- [ ] **Step 5: Run landing, documentation-adjacent, lint, and type checks**

```powershell
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run test:browser -- tests/browser/landing.spec.ts
npm.cmd run lint
npm.cmd run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```powershell
git add -- Project_Definition.md DESIGN.md README.md apps/web/README.md apps/web/lib/landing/landingData.ts apps/web/tests/landing/landingData.test.ts apps/web/components/landing/landing-page.tsx apps/web/tests/browser/landing.spec.ts
git commit -m "docs: make Excel the public export format"
```

---

### Task 7: Full Verification, Review, and Fiscal.ge Release

**Files:**
- Modify only files required by verified failures from this task.
- Do not add features or refactor unrelated code.

**Interfaces:**
- Consumes: completed Tasks 1–6.
- Produces: a reviewed, merged, deployed, and live-verified Fiscal.ge Excel-export release.

- [ ] **Step 1: Run the complete local quality stack**

From `apps/web`:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=high
```

Expected: lint, strict TypeScript, all unit tests, all data validation, static build, and production dependency audit PASS.

- [ ] **Step 2: Confirm ExcelJS is absent from the initial explorer route chunk**

Inspect `.next` build output and browser network requests before clicking download. Record:

- initial `/explorer/revenue` JS resources;
- resources requested after `series-excel` is clicked;
- the ExcelJS-containing chunk appears only after the click.

Fail this step if the writer dependency is in the initial route payload.

- [ ] **Step 3: Run the full browser suite**

```powershell
npm.cmd run test:browser
```

Expected: all browser tests PASS, including desktop and mobile XLSX downloads.

- [ ] **Step 4: Perform manual workbook smoke checks in Microsoft Excel**

Download representative workbooks for:

1. national revenue nominal;
2. expenditure ministries with a selected program;
3. national `% მშპ-ში`;
4. municipality `04` with a narrowed range;
5. Adjara region;
6. Georgia aggregate.

For each, confirm:

- Excel opens without repair warning;
- `მარტივი ცხრილი` is active;
- `მონაცემები` filters work;
- Georgian text is not clipped;
- numbers remain numeric;
- a source URL opens the public original;
- no local repository path appears;
- zero, blank, negative, planned, hierarchy, total, and range behavior match the page.

Import the national revenue workbook into Google Sheets and confirm both sheet names, numeric cells, filters, Georgian labels, and public hyperlinks survive without conversion errors.

- [ ] **Step 5: Review the branch diff against the specification**

```powershell
git status --short
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
```

Expected: no unintended files, no prototype outputs, no whitespace errors, and every changed file traces to the specification.

- [ ] **Step 6: Return failures to their owning task before publication**

If Steps 1–5 reveal a failure, return to the task that owns the failing file, add a failing regression test there, apply the smallest fix, rerun that task's commands, and use that task's explicit `git add -- ...` file list and commit message. Do not create a generic cleanup commit and do not continue until the full verification stack is green.

- [ ] **Step 7: Publish through the required Fiscal.ge workflow**

```text
codex/readable-xlsx-exports branch
→ push
→ draft PR
→ required CI
→ review and resolved conversations
→ mark ready
→ merge
→ delete remote branch
```

Do not bypass a required check. The PR description must include the six workbook scenarios and dependency/lazy-loading evidence.

- [ ] **Step 8: Verify deployment and live Fiscal.ge behavior**

Require all of the following before completion:

- Vercel deployment status `READY`;
- deployed commit equals the PR merge commit;
- `https://fiscal.ge/explorer/revenue` and representative national/municipal routes return `200`;
- no browser console or runtime errors;
- live download filenames begin `fiscal-` and end `.xlsx`;
- both live sheets parse with the approved names and headers;
- live source hyperlinks resolve to `https://fiscal.ge/downloads/methodology/...` and representative files return `200 application/pdf`;
- the old Vercel alias behavior matches `docs/deployment.md` redirect/alias policy.

- [ ] **Step 9: Record final evidence**

Report:

- branch and all feature commits;
- PR URL and merge SHA;
- required CI results;
- Vercel deployment ID and matching SHA;
- live URLs tested;
- workbook scenarios opened;
- any explicitly unverified boundary.
