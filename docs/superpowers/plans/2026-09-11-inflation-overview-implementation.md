# Inflation Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Inflation as a peer dataset in the Data Explorer: archived and validated Geostat CPI data, an Inflation hub, and the `ინფლაციის მიმოხილვა` page with three centred tabs, a monthly chart, a year × month table (`ცხრილი`), key indicators, an Excel download and a methodology page, in Georgian and English.

**Architecture:** A deterministic `prepare-inflation` pipeline turns archived Geostat XLSX files (English and Georgian) into one reviewed canonical CSV plus a hand-reviewed NBG target CSV, both mirrored to Supabase with exact parity. Months are integers (`year × 12 + month − 1`) everywhere below the CSV, so the existing year-based chart, range strip and lattice gain small, backward-compatible "periods per year" extensions instead of being copied. Page state lives in pure, tested model modules; components only compose them.

**Tech Stack:** Next.js 16 (static), strict TypeScript, Tailwind v4 editorial layer, SheetJS (`xlsx`) for parsing, `decimal.js`, `zod`, Prisma 7 + Supabase Postgres, ExcelJS, Vitest (node, static markup), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-11-inflation-overview-design.md` — read it before starting any task. Where this plan and the spec disagree, stop and ask.

## Global Constraints

- Scope is the Inflation hub and overview only. No categories, basket, cities, products, calculator, other price indices, HICP, MCP intents, JSON publications, API or `lib/factQuery/` changes.
- Starts from `main` **after** `codex/gdp-overview` has merged (spec §3). Code in this plan that touches shared files is written against that branch at commit `e064d1d60`; if the merged version differs, adapt the call site to the merged shape, never re-implement GDP's shared change a second way.
- Existing Budget, Debt, Deficit and GDP behaviour must not change. Their existing tests must pass **unmodified**, except the explicit count updates listed in Task 15.
- Canonical data lives in `data/imports/`; the database is written only by `npm run data:import`. Store only published values; never derive y/y for 2001–2003, never derive an index level for core.
- Stable lowercase ASCII IDs. Series: `cpi.headline`, `cpi.core`, `cpi.core_ex_tobacco`. Measures: `index_2010`, `yoy_pct`, `mom_pct`, `avg12_pct`. UI selection keys: `cpi`, `core`, `core_ex_tobacco`, `target`. Tabs: `yoy`, `mom`, `index`.
- Derive coverage, ranges and defaults from loaded facts. Never hardcode `2026-08` in production code (tests may pin historical anchor months, which Geostat does not revise).
- Inflation values are never coloured good/bad. Rate changes are stated in percentage points (`პპ` / `pp`). Falling prices read `გაიაფდა`.
- Design: DESIGN.md v4.1 tokens only; the only new colours are the five table tints in `lib/explorer/inflationGrid.ts`, each passing WCAG AA (≥ 4.5:1) with its text colour.
- Test loop per `CLAUDE.md`: run the single test file you touched (`npx vitest run tests/<path>`, ~5s) while working. `npm run check`, `npm run build` and `npm run test:browser` run **once**, in Task 16.
- Commits end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. Do not push or open a PR unless the user authorizes publishing.
- All commands run from `apps/web` unless a step says otherwise. Shell is Git Bash on Windows.

## Decisions this plan makes inside the spec (flag to the user at handoff)

1. Geostat publishes headline y/y, m/m and the 12-month average as indices (`same month of previous year = 100`). The canonical CSV stores **percent change = published index − 100**, computed exactly with `decimal.js` (`105.6479` → `5.6479`). Core files already publish percent change and are stored as is.
2. The canonical CSV gains a `source_locator` column (`Georgia!D5`), matching the GDP overview CSV.
3. A vintage folder is named after the **last month it covers** (`geostat-cpi/2026-08/`).
4. The methodology article requires a processed-data link, so the canonical CSV is copied to `/downloads/data/inflation-cpi-national.csv` at build time. No JSON, no MCP.
5. No explorer `Dataset` JSON-LD on the inflation pages (it would need the fact-query vocabulary, which is out of scope). The pages carry `BreadcrumbList`; the methodology page carries its own `Dataset` node, as GDP's does.
6. Keeping every monthly vintage adds about 3.4 MB of XLSX per month to the repository and the methodology archive. This milestone has one vintage; the retention policy is a user decision before the first refresh.

## File Map

Data and pipeline (new unless marked):

| File | Responsibility |
| --- | --- |
| `docs/Raw Data/Inflation/geostat-cpi/2026-08/{en,ka}/*.xlsx`, `…/source-manifest.csv`, `…/README.md` | Untouched Geostat files, provenance |
| `docs/Raw Data/Inflation/nbg-inflation-target/official/*`, `…/source-manifest.csv` | NBG target source snapshot |
| `data/imports/nbg-inflation-target.csv` | Hand-reviewed target rows |
| `data/imports/cpi-national-monthly.csv` | Generated canonical CPI facts |
| `data/reports/inflation-cpi-validation.json` | Generated validation evidence |
| `data/sources/source-documents.csv` (modify) | Seven new source rows |
| `apps/web/lib/data/inflation/periods.ts` | Month ↔ integer period helpers |
| `apps/web/lib/data/inflation/types.ts` | Series, measures, fact and target types |
| `apps/web/lib/data/inflation/readGeostatCpi.ts` | Content-located XLSX parsing |
| `apps/web/lib/data/inflation/sourceFiles.ts` | Vintage discovery, manifest, hash verification |
| `apps/web/lib/data/inflation/validateInflation.ts` | Coverage, recomputation, parity, revision guard, target rules |
| `apps/web/lib/data/inflation/prepareInflation.ts` | Orchestration, CSV serialization, write/check/public |
| `apps/web/lib/data/inflation/importInflation.ts` | CSV loaders, served data, mirror parity |
| `apps/web/scripts/prepare-inflation.ts` | CLI: `--write`, `--check`, `--public` |
| `apps/web/prisma/schema.prisma`, `prisma/migrations/20260912000000_inflation_cpi/migration.sql` | Mirror tables |
| `apps/web/lib/db/mirrorRows.ts`, `lib/db/servedDataDb.ts`, `lib/data/servedData.ts`, `scripts/import-budget-facts.ts` (modify) | Mirror read-back and import |

Shared component extensions (modify):

| File | Change |
| --- | --- |
| `apps/web/lib/explorer/dotLattice.ts` | `periodsPerYear`, `firstPeriod`, returns `colOffset` |
| `apps/web/lib/explorer/periodAxis.ts` (new) | Axis label positions for years and months |
| `apps/web/components/main-explorer/editorial-line-chart.tsx` | `periodsPerYear`, `formatPeriod`, `ChartSeries.dashed` |
| `apps/web/components/main-explorer/range-strip.tsx` | `periodsPerYear`, `formatPeriod`, `rangeChips`, `stepRangeHandle` |
| `apps/web/components/main-explorer/series-selector.tsx` | `swatch="dashed"` |
| `apps/web/components/main-explorer/kpi-blocks.tsx` (new), `indicators.tsx` | Extracted `HeroKpi`, `SideKpiList` |
| `apps/web/components/main-explorer/month-grid-table.tsx` (new) | The one new component |
| `apps/web/lib/explorer/workbookModel.ts`, `workbookWriter.client.ts` | `readable.headerLabels`, `sourceYears` |

Inflation UI (new): `lib/explorer/inflationOverview.ts`, `inflationLabels.ts`, `inflationGrid.ts`, `inflationWorkbook.ts`, `inflationHubCards.ts`; `components/inflation/inflation-overview.tsx`, `inflation-series-panel.tsx`, `inflation-table.tsx`, `inflation-indicators.tsx`; `lib/pages/inflation.tsx`; routes under `app/(ka)/explorer/inflation/` and `app/(en)/en/explorer/inflation/`; messages `lib/i18n/messages/{ka,en}/inflation.json`.

Navigation, SEO, methodology, docs (modify unless marked): `components/shell/data-sidebar.tsx`, `components/shell/explorer-footer.tsx`, `lib/i18n/types.ts`, `lib/i18n/messages.server.ts`, `lib/i18n/messages/{ka,en}/common.json`, `lib/i18n/messages/{ka,en}/controls.json`, `lib/i18n/inventory.server.ts`, `lib/seo/sitemap.ts`, `data/localization/en/*.json`, `data/localization/ka/service-messages.json`, `lib/methodology/{types,catalog,sourceInventory}.ts`, `lib/methodology/content/inflation.ts` (new), `lib/methodology/content/en/inflation.ts` (new), `lib/methodology/content/en/revisions.ts`, `components/methodology/methodology-hub.tsx`, `lib/pages/methodology-article.tsx`, `data/methodology/source-archives/inflation.csv` (new), `docs/data-methodology/inflation-cpi-national.md` (new), `docs/data-methodology/database-import.md`, `Project_Definition.md`, `DESIGN.md`, `apps/web/package.json`.

---

### Task 0: Preconditions

**Files:** none changed.

- [ ] **Step 1: Confirm the Economy branch has merged**

Run (repository root):

```bash
git fetch origin --prune && git merge-base --is-ancestor codex/gdp-overview origin/main && echo MERGED || echo NOT_MERGED
```

Expected: `MERGED`. If `NOT_MERGED`, **stop** and tell the user (spec §3). Do not continue.

- [ ] **Step 2: Rebase this branch onto main**

```bash
git switch claude/inflation-data-collection-21a296 && git rebase origin/main
```

Expected: clean rebase (the branch only adds the spec). Then from `apps/web`: `npm ci`.

- [ ] **Step 3: Re-read the merged shared files**

Read the merged versions of `components/shell/data-sidebar.tsx`, `components/shell/explorer-footer.tsx`, `lib/explorer/workbookModel.ts`, `lib/explorer/workbookWriter.client.ts`, `components/main-explorer/editorial-line-chart.tsx`, `lib/pages/methodology-article.tsx`, `lib/methodology/catalog.ts`. Note every difference from the snippets quoted in Tasks 7–14; those tasks adapt to the merged shape.

- [ ] **Step 4: Baseline**

Run `npm run typecheck` and `npx vitest run tests/explorer/editorialLineChart.test.ts tests/explorer/rangeStrip.test.ts tests/explorer/dotLattice.test.ts tests/explorer/seriesSelector.test.ts tests/explorer/workbookWriter.test.ts`. Expected: all pass. A typecheck failure on a fresh worktree is stale `node_modules` (see `CLAUDE.md`), not breakage.

---

### Task 1: Collect and archive the sources

**Files:**
- Create: `docs/Raw Data/Inflation/geostat-cpi/2026-08/en/{cpi-index-2010,cpi-yoy,cpi-mom,cpi-avg12,core-yoy,core-mom}.xlsx`
- Create: `docs/Raw Data/Inflation/geostat-cpi/2026-08/ka/` (same six names)
- Create: `docs/Raw Data/Inflation/geostat-cpi/2026-08/source-manifest.csv`, `README.md`
- Create: `docs/Raw Data/Inflation/nbg-inflation-target/official/inflation-target-{en,ka}.html` (or `.pdf`, Step 6), `…/source-manifest.csv`
- Create: `data/imports/nbg-inflation-target.csv`
- Modify: `data/sources/source-documents.csv`

The exploratory files in `.tmp/inflation-exploration/` are research material; re-download, do not copy them (spec §4.2). Geostat blocks Python's TLS client; use `curl -A "Mozilla/5.0"`.

- [ ] **Step 1: Find the six English file links**

From the repository root:

```bash
curl -sL -A "Mozilla/5.0" "https://www.geostat.ge/en/modules/categories/26/cpi-inflation" -o /tmp/cpi-en.html
grep -o 'https://www.geostat.ge/media/[0-9]*/[^"]*\.xlsx' /tmp/cpi-en.html | sort -u
```

Pick the six whose names are, in Geostat's spelling: `consumer-price-index-2010=100` (index), `consumer-price-index-to-the-same-month-of-previous-year` (y/y), `Consumer-Price-Indices-(Previous-month=100)` (m/m), `consumer-price-index-12-month-avarage-over-the-previous-12-month-avarage` (avg12), `Core-Inflation-(to-the-same-month-of-the-previous-year)`, `Core-Inflation-(to-the-previous-month)`. The link text may be percent-encoded (`%28`, `%3D`); keep the URL exactly as found.

- [ ] **Step 2: Download the English files under stable names**

```bash
V="docs/Raw Data/Inflation/geostat-cpi/2026-08"; mkdir -p "$V/en" "$V/ka"
curl -sL -A "Mozilla/5.0" "<index url>" -o "$V/en/cpi-index-2010.xlsx"
curl -sL -A "Mozilla/5.0" "<yoy url>"   -o "$V/en/cpi-yoy.xlsx"
curl -sL -A "Mozilla/5.0" "<mom url>"   -o "$V/en/cpi-mom.xlsx"
curl -sL -A "Mozilla/5.0" "<avg12 url>" -o "$V/en/cpi-avg12.xlsx"
curl -sL -A "Mozilla/5.0" "<core y/y url>" -o "$V/en/core-yoy.xlsx"
curl -sL -A "Mozilla/5.0" "<core m/m url>" -o "$V/en/core-mom.xlsx"
```

Replace each `<… url>` with the URL found in Step 1. If Geostat has published a newer month than August 2026 by the time you run this, name the folder after that month (e.g. `2026-09`) and use that name everywhere this plan says `2026-08`; nothing else changes because all code and tests derive the latest month from the files.

- [ ] **Step 3: Find and download the Georgian equivalents**

```bash
KA=$(grep -o 'https://www.geostat.ge/ka/modules/categories/26/[^"]*' /tmp/cpi-en.html | head -1); echo "$KA"
curl -sL -A "Mozilla/5.0" "$KA" -o /tmp/cpi-ka.html
grep -o 'https://www.geostat.ge/media/[0-9]*/[^"]*\.xlsx' /tmp/cpi-ka.html | sort -u
```

The Georgian page lists the same files in the same order. Download the six counterparts into `$V/ka/` with the same stable names. Confirm each one by its first-sheet title (row 1):

```bash
node -e 'const X=require("./apps/web/node_modules/xlsx");for(const f of process.argv.slice(1)){const b=X.readFile(f);const r=X.utils.sheet_to_json(b.Sheets[b.SheetNames[0]],{header:1});console.log(f.split("/").pop(),JSON.stringify(b.SheetNames),JSON.stringify(r[0]?.[0]))}' "$V"/ka/*.xlsx "$V"/en/*.xlsx
```

Expected: English titles contain `2010 average=100`, `Same month of the previous year=100`, `Previous month=100`, `12 month average over the previous 12 month average`, and the two core titles; city-sheet files list `Georgia` / `საქართველო` as the first sheet; the Georgian y/y title reads `…წინა წლის შესაბამისი თვე=100`. Task 2's parity test is the definitive check that every Georgian file carries the English values.

- [ ] **Step 4: Write the Geostat manifest**

Compute bytes and hashes:

```bash
for f in "$V"/en/*.xlsx "$V"/ka/*.xlsx; do echo "$(sha256sum "$f" | cut -d' ' -f1),$(stat -c %s "$f"),${f#$V/}"; done
```

Create `$V/source-manifest.csv` (UTF-8 **with BOM**, per AGENTS.md; lowercase SHA-256). Header and the row shape:

```csv
file_role,language,source_id,title,source_page_url,retrieved_file_url,retrieved_at,local_file,sha256,bytes
index_2010,en,source.geostat_cpi_index_2010,"Consumer Price Indices in Georgia, 2010 average=100",https://www.geostat.ge/en/modules/categories/26/cpi-inflation,<exact url>,<YYYY-MM-DD>,en/cpi-index-2010.xlsx,<sha256>,<bytes>
```

Twelve rows: roles `index_2010`, `yoy`, `mom`, `avg12`, `core_yoy`, `core_mom` × languages `en`, `ka`. English `source_id`s: `source.geostat_cpi_index_2010`, `source.geostat_cpi_yoy`, `source.geostat_cpi_mom`, `source.geostat_cpi_avg12`, `source.geostat_core_yoy`, `source.geostat_core_mom`. Georgian rows use the same id with `_ka` appended (`source.geostat_cpi_yoy_ka`). `title` is the file's row-1 title with the line break replaced by `, `. `retrieved_at` is today's date. `source_page_url` for Georgian rows is the `$KA` page.

- [ ] **Step 5: Write the vintage README**

`$V/README.md`:

```markdown
# Geostat CPI — vintage 2026-08

Untouched Geostat consumer price index workbooks, downloaded on <YYYY-MM-DD>, covering data through August 2026. English files are canonical; Georgian files exist to prove identical values. Only the national sheet (`Georgia` / `საქართველო`) is read. `source-manifest.csv` records each file's download URL, date, byte count and SHA-256; `npm run data:check-inflation` re-verifies them. Geostat media URLs change with every monthly upload, so each vintage keeps its own.
```

- [ ] **Step 6: Snapshot the NBG target source**

```bash
N="docs/Raw Data/Inflation/nbg-inflation-target"; mkdir -p "$N/official"
curl -sL -A "Mozilla/5.0" "https://nbg.gov.ge/en/page/inflation-target" -o "$N/official/inflation-target-en.html"
curl -sL -A "Mozilla/5.0" "https://nbg.gov.ge/page/inflation-target" -o "$N/official/inflation-target-ka.html"
grep -c "3%" "$N/official/inflation-target-en.html"
```

Expected: a count ≥ 1 and the page text states 5% (2015–2016), 4% (2017) and 3% (from 2018). If the saved HTML does not contain the figures (the site renders client-side), delete both files, open the page in the Browser pane, find the NBG monetary-policy document it cites that states the target path, and archive that PDF (English and Georgian) under `official/` instead. Write `$N/source-manifest.csv` (BOM, lowercase SHA-256):

```csv
language,source_id,title,source_page_url,retrieved_file_url,retrieved_at,local_file,sha256,bytes
en,source.nbg_inflation_target,National Bank of Georgia inflation target,https://nbg.gov.ge/en/page/inflation-target,<url>,<YYYY-MM-DD>,official/inflation-target-en.html,<sha256>,<bytes>
ka,source.nbg_inflation_target_ka,საქართველოს ეროვნული ბანკის ინფლაციის მიზნობრივი მაჩვენებელი,https://nbg.gov.ge/page/inflation-target,<url>,<YYYY-MM-DD>,official/inflation-target-ka.html,<sha256>,<bytes>
```

- [ ] **Step 7: Research targets before 2015 (collection task, spec §4.1)**

Search NBG's "Main Directions of Monetary and Foreign Exchange Policy" documents for 2009–2014. Decision rule: add a pre-2015 target row **only** if an archived NBG primary document states a numeric annual target for that year; archive that document in `$N/official/` with a manifest row. If the targets you find leave gaps between years, stop and ask the user (Task 3's contiguity rule would reject gaps). If nothing is verifiable, keep 2015 as the start and write the outcome ("not verified; searched: …") into Task 13's methodology doc. Never state publicly that no earlier target existed.

- [ ] **Step 8: Write the reviewed target CSV**

`data/imports/nbg-inflation-target.csv` (BOM), with the capture date from Step 6:

```csv
effective_from,effective_to,target_pct,source_id,last_reviewed_at
2015-01,2016-12,5,source.nbg_inflation_target,<YYYY-MM-DD>
2017-01,2017-12,4,source.nbg_inflation_target,<YYYY-MM-DD>
2018-01,,3,source.nbg_inflation_target,<YYYY-MM-DD>
```

Plus any rows verified in Step 7, earliest first.

- [ ] **Step 9: Register the sources**

Append to `data/sources/source-documents.csv` (columns `source_id,source_name,source_url_or_file,last_reviewed_at`):

```csv
source.geostat_cpi_index_2010,"Geostat consumer price index, 2010 average=100",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-index-2010.xlsx,<YYYY-MM-DD>
source.geostat_cpi_yoy,"Geostat consumer price index, same month of the previous year=100",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-yoy.xlsx,<YYYY-MM-DD>
source.geostat_cpi_mom,"Geostat consumer price index, previous month=100",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-mom.xlsx,<YYYY-MM-DD>
source.geostat_cpi_avg12,"Geostat consumer price index, 12-month average over the previous 12-month average",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-avg12.xlsx,<YYYY-MM-DD>
source.geostat_core_yoy,"Geostat core inflation, change on the same month of the previous year",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/core-yoy.xlsx,<YYYY-MM-DD>
source.geostat_core_mom,"Geostat core inflation, change on the previous month",docs/Raw Data/Inflation/geostat-cpi/2026-08/en/core-mom.xlsx,<YYYY-MM-DD>
source.nbg_inflation_target,National Bank of Georgia inflation target,docs/Raw Data/Inflation/nbg-inflation-target/official/inflation-target-en.html,<YYYY-MM-DD>
```

Adjust the last path if Step 6 archived a PDF. The file uses LF line endings — write it with the Edit tool, not Python (Python writes CRLF on this machine).

- [ ] **Step 10: Give the new source IDs reviewed names**

Registered source IDs enter the translation inventory, so `npm run i18n:check` fails until each has names. Mirror the GDP entries' shape exactly (use today's date for `reviewedAt`):

`data/localization/en/sources.json` — one entry per ID:

```json
"source.geostat_cpi_yoy": { "name": { "text": "Geostat consumer price index, same month of the previous year = 100", "reviewedAt": "<YYYY-MM-DD>" }, "derivation": null }
```

English names: index `Geostat consumer price index, 2010 average = 100`; yoy as above; mom `Geostat consumer price index, previous month = 100`; avg12 `Geostat consumer price index, 12-month average over the previous 12-month average`; core y/y `Geostat core inflation, change on the same month of the previous year`; core m/m `Geostat core inflation, change on the previous month`; target `National Bank of Georgia inflation target`.

`data/localization/en/service-messages.json` — `"sources.<id>.name": "<same English name>"` for all seven.

`data/localization/ka/service-messages.json` — `"sources.<id>.name"`: index `საქსტატი · სამომხმარებლო ფასების ინდექსი, 2010 წლის საშუალო = 100`; yoy `საქსტატი · სამომხმარებლო ფასების ინდექსი, წინა წლის შესაბამისი თვე = 100`; mom `საქსტატი · სამომხმარებლო ფასების ინდექსი, წინა თვე = 100`; avg12 `საქსტატი · 12 თვის საშუალო წინა 12 თვის საშუალოსთან`; core y/y `საქსტატი · საბაზო ინფლაცია, წინა წლის შესაბამის თვესთან`; core m/m `საქსტატი · საბაზო ინფლაცია, წინა თვესთან`; target `საქართველოს ეროვნული ბანკი · ინფლაციის მიზნობრივი მაჩვენებელი`.

These three files are LF; edit them with the Edit tool.

Run: `npm run i18n:check`
Expected: `Translation catalogue and registered messages valid: …`

- [ ] **Step 11: Commit**

```bash
git add "docs/Raw Data/Inflation" data/imports/nbg-inflation-target.csv data/sources/source-documents.csv data/localization
git commit -m "data: archive Geostat CPI and NBG target sources" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Read the Geostat workbooks

**Files:**
- Create: `apps/web/lib/data/inflation/periods.ts`
- Create: `apps/web/lib/data/inflation/types.ts`
- Create: `apps/web/lib/data/inflation/readGeostatCpi.ts`
- Create: `apps/web/lib/data/inflation/sourceFiles.ts`
- Test: `apps/web/tests/data/inflation/readGeostatCpi.test.ts`

**Interfaces:**
- Produces: `makePeriod(year, month)`, `periodFromKey("YYYY-MM")`, `periodKey(period)`, `periodYear(period)`, `periodMonth(period)` (1–12).
- Produces: types `CpiSeriesId`, `CpiMeasure`, `CPI_SERIES_IDS`, `CPI_MEASURES`, `CPI_SERIES_MEASURES`, `CpiFact`, `ServedCpiFact`, `InflationTargetRow`, `ServedInflationTargetRow`.
- Produces: `CPI_FILE_ROLES`, `CpiFileRole`, `CpiLanguage`, `ParsedCpiSeries = { seriesId; measure; cells: { period: number; value: string; locator: string }[] }`, `readGeostatCpiFile(content: Buffer, role, language): ParsedCpiSeries[]`.
- Produces: `INFLATION_RAW_ROOT`, `latestCpiVintage(rawRoot?)`, `readVerifiedCpiFiles(vintageDir): Promise<VerifiedCpiFile[]>` where `VerifiedCpiFile = CpiManifestRow & { content: Buffer }`.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/data/inflation/readGeostatCpi.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { beforeAll, describe, expect, it } from "vitest";
import { makePeriod, periodFromKey, periodKey, periodMonth, periodYear } from "../../../lib/data/inflation/periods";
import { CPI_FILE_ROLES, readGeostatCpiFile, type CpiFileRole, type ParsedCpiSeries } from "../../../lib/data/inflation/readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles, type VerifiedCpiFile } from "../../../lib/data/inflation/sourceFiles";

let files: VerifiedCpiFile[];
let vintageDir: string;

beforeAll(async () => {
  vintageDir = path.join(INFLATION_RAW_ROOT, "geostat-cpi", await latestCpiVintage());
  files = await readVerifiedCpiFiles(vintageDir);
});

const file = (role: CpiFileRole, language: "en" | "ka") =>
  files.find((row) => row.file_role === role && row.language === language)!;

function cell(series: ParsedCpiSeries[], seriesId: string, key: string) {
  return series.find((row) => row.seriesId === seriesId)!.cells.find((entry) => entry.period === periodFromKey(key));
}

describe("periods", () => {
  it("encodes months as consecutive integers", () => {
    expect(makePeriod(2026, 8)).toBe(2026 * 12 + 7);
    expect(periodFromKey("2026-08")).toBe(makePeriod(2026, 8));
    expect(periodKey(makePeriod(2004, 1))).toBe("2004-01");
    expect(periodYear(makePeriod(2010, 12))).toBe(2010);
    expect(periodMonth(makePeriod(2010, 12))).toBe(12);
    expect(makePeriod(2011, 1) - makePeriod(2010, 12)).toBe(1);
    expect(() => periodFromKey("2026-13")).toThrow(/Invalid period/);
  });
});

describe("Geostat CPI workbooks", () => {
  it("verifies all twelve archived files against the manifest", () => {
    expect(files).toHaveLength(12);
  });

  it("reads each national series at published precision, rebasing only =100 files", () => {
    const index = readGeostatCpiFile(file("index_2010", "en").content, "index_2010", "en");
    expect(index[0]!.cells[0]).toEqual({ period: makePeriod(2000, 1), value: "52.4448", locator: "Georgia!B4" });

    const yoy = readGeostatCpiFile(file("yoy", "en").content, "yoy", "en");
    expect(cell(yoy, "cpi.headline", "2004-01")).toEqual({ period: makePeriod(2004, 1), value: "5.1981", locator: "Georgia!D5" });
    expect(cell(yoy, "cpi.headline", "2026-08")?.value).toBe("5.6479");

    const mom = readGeostatCpiFile(file("mom", "en").content, "mom", "en");
    expect(cell(mom, "cpi.headline", "2026-08")?.value).toBe("0.4049");

    const avg12 = readGeostatCpiFile(file("avg12", "en").content, "avg12", "en");
    expect(avg12[0]!.cells[0]).toMatchObject({ period: makePeriod(2002, 1), value: "4.6715" });

    const coreYoy = readGeostatCpiFile(file("core_yoy", "en").content, "core_yoy", "en");
    expect(coreYoy.map((row) => [row.seriesId, row.measure])).toEqual([["cpi.core", "yoy_pct"], ["cpi.core_ex_tobacco", "yoy_pct"]]);
    expect(cell(coreYoy, "cpi.core", "2010-01")?.value).toBe("1.9499");
    expect(cell(coreYoy, "cpi.core_ex_tobacco", "2010-01")?.value).toBe("1.8143");
    expect(cell(coreYoy, "cpi.core", "2026-08")?.value).toBe("3.799");

    const coreMom = readGeostatCpiFile(file("core_mom", "en").content, "core_mom", "en");
    expect(cell(coreMom, "cpi.core", "2010-01")?.value).toBe("0.4282");
  });

  it("reads the Georgian files to exactly the English values", () => {
    for (const role of CPI_FILE_ROLES) {
      const pairs = (series: ParsedCpiSeries[]) => series.map((row) => row.cells.map((entry) => `${entry.period}=${entry.value}`));
      expect(pairs(readGeostatCpiFile(file(role, "ka").content, role, "ka")), role).toEqual(
        pairs(readGeostatCpiFile(file(role, "en").content, role, "en")),
      );
    }
  });
});

describe("layout guards", () => {
  function rewrite(content: Buffer, edit: (rows: unknown[][], names: string[]) => { rows: unknown[][]; name?: string }): Buffer {
    const book = XLSX.read(content, { type: "buffer" });
    const name = book.SheetNames[0]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name]!, { header: 1, raw: true, defval: null });
    const next = edit(rows, book.SheetNames);
    const out = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(next.rows), next.name ?? name);
    return XLSX.write(out, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }

  it("refuses a missing month header", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows: rows.map((row, index) => (index === 2 ? [] : row)) }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/month header/);
  });

  it("refuses a renamed national sheet", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows, name: "Tbilisi" }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/national sheet/);
  });

  it("refuses a value after a gap", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({
      rows: rows.map((row, index) => (index === 10 ? [row[0], null, ...row.slice(2)] : row)),
    }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/after a gap/);
  });

  it("refuses an English file whose title names a different table", () => {
    const broken = rewrite(file("index_2010", "en").content, (rows) => ({ rows: [["CONSUMER PRICE INDICES IN GEORGIA Previous month=100"], ...rows.slice(1)] }));
    expect(() => readGeostatCpiFile(broken, "index_2010", "en")).toThrow(/title/);
  });

  it("refuses tampered bytes", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cpi-vintage-"));
    try {
      await fs.cp(vintageDir, temp, { recursive: true });
      await fs.appendFile(path.join(temp, "en", "cpi-yoy.xlsx"), " ");
      await expect(readVerifiedCpiFiles(temp)).rejects.toThrow(/hash mismatch/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
```

The anchor values above were read from the 2026-09-10 exploratory download. If a value differs in your re-download, stop and report it: it is a Geostat revision to history, which the spec treats as a review event.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/data/inflation/readGeostatCpi.test.ts`
Expected: FAIL — cannot resolve `lib/data/inflation/periods`.

- [ ] **Step 3: Write `periods.ts`**

```ts
// Months are integers (year × 12 + month − 1) everywhere below the CSV, so the
// chart, range strip and table keep plain integer arithmetic: +1 is one month.

const PERIOD_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function makePeriod(year: number, month: number): number {
  return year * 12 + month - 1;
}

export function periodYear(period: number): number {
  return Math.floor(period / 12);
}

export function periodMonth(period: number): number {
  return (period % 12) + 1;
}

export function periodFromKey(key: string): number {
  const match = PERIOD_KEY.exec(key);
  if (!match) throw new Error(`Invalid period ${key}`);
  return makePeriod(Number(match[1]), Number(match[2]));
}

export function periodKey(period: number): string {
  return `${periodYear(period)}-${String(periodMonth(period)).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Write `types.ts`**

```ts
export const CPI_SERIES_IDS = ["cpi.headline", "cpi.core", "cpi.core_ex_tobacco"] as const;
export type CpiSeriesId = (typeof CPI_SERIES_IDS)[number];

export const CPI_MEASURES = ["index_2010", "yoy_pct", "mom_pct", "avg12_pct"] as const;
export type CpiMeasure = (typeof CPI_MEASURES)[number];

// What Geostat publishes for each series. Core has neither an index level nor a
// 12-month average, and none is derived here (spec §4.3).
export const CPI_SERIES_MEASURES: Readonly<Record<CpiSeriesId, readonly CpiMeasure[]>> = {
  "cpi.headline": ["index_2010", "yoy_pct", "mom_pct", "avg12_pct"],
  "cpi.core": ["yoy_pct", "mom_pct"],
  "cpi.core_ex_tobacco": ["yoy_pct", "mom_pct"],
};

/** One published monthly value. Percent measures hold percentage points (5.6 = 5.6%). */
export type CpiFact = {
  seriesId: CpiSeriesId;
  measure: CpiMeasure;
  period: string;
  value: string;
  status: "published";
  sourceId: string;
  sourceLocator: string;
  lastReviewedAt: string;
};

export type ServedCpiFact = Omit<CpiFact, "value"> & { value: number };

export type InflationTargetRow = {
  effectiveFrom: string;
  effectiveTo: string | null;
  targetPct: string;
  sourceId: string;
  lastReviewedAt: string;
};

export type ServedInflationTargetRow = Omit<InflationTargetRow, "targetPct"> & { targetPct: number };
```

- [ ] **Step 5: Write `readGeostatCpi.ts`**

```ts
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { makePeriod } from "./periods";
import type { CpiMeasure, CpiSeriesId } from "./types";

// Reads the national table of one Geostat CPI workbook. Rows and columns are
// located by content — the I–XII month header, the year labels, the Total / სულ
// row, the two core rows — and anything unexpected throws: a changed Geostat
// layout must stop the refresh, never shift a column silently (spec §4.4).

export const CPI_FILE_ROLES = ["index_2010", "yoy", "mom", "avg12", "core_yoy", "core_mom"] as const;
export type CpiFileRole = (typeof CPI_FILE_ROLES)[number];
export type CpiLanguage = "en" | "ka";
export type ParsedCpiCell = { period: number; value: string; locator: string };
export type ParsedCpiSeries = { seriesId: CpiSeriesId; measure: CpiMeasure; cells: ParsedCpiCell[] };

type Rows = unknown[][];
type Layout = "yearRows" | "total" | "core";

const MONTHS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
const NATIONAL_SHEET: Record<CpiLanguage, string> = { en: "Georgia", ka: "საქართველო" };
const TOTAL_LABEL: Record<CpiLanguage, string> = { en: "Total", ka: "სულ" };
const EN_CORE_LABELS = ["Core Inflation*", "Core Inflation without tobacco**"];

// Title fragments that prove an English file is the table the manifest names.
// Georgian files are proven by value parity with their English twin instead.
const EN_TITLES: Record<CpiFileRole, string> = {
  index_2010: "2010 average=100",
  yoy: "Same month of the previous year=100",
  mom: "Previous month=100",
  avg12: "12 month average over the previous 12 month average",
  core_yoy: "compared to the same month of the previous year",
  core_mom: "compared to the previous month",
};

// "=100" files publish an index against the comparison period. The canonical CSV
// stores percentage change, which is exactly the published index minus 100.
const ROLES: Record<CpiFileRole, { layout: Layout; rebase: boolean; series: Array<[CpiSeriesId, CpiMeasure]> }> = {
  index_2010: { layout: "yearRows", rebase: false, series: [["cpi.headline", "index_2010"]] },
  avg12: { layout: "yearRows", rebase: true, series: [["cpi.headline", "avg12_pct"]] },
  yoy: { layout: "total", rebase: true, series: [["cpi.headline", "yoy_pct"]] },
  mom: { layout: "total", rebase: true, series: [["cpi.headline", "mom_pct"]] },
  core_yoy: { layout: "core", rebase: false, series: [["cpi.core", "yoy_pct"], ["cpi.core_ex_tobacco", "yoy_pct"]] },
  core_mom: { layout: "core", rebase: false, series: [["cpi.core", "mom_pct"], ["cpi.core_ex_tobacco", "mom_pct"]] },
};

function numeric(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw).replace(/\s+/g, " ").trim();
}

function toValue(raw: number, rebase: boolean): string {
  const value = new Decimal(String(raw));
  return (rebase ? value.minus(100) : value).toFixed();
}

function locator(sheet: string, row: number, column: number): string {
  return `${sheet}!${XLSX.utils.encode_cell({ r: row, c: column })}`;
}

function findMonthHeader(rows: Rows): { row: number; col: number } {
  for (let row = 0; row < rows.length; row += 1) {
    const cells = rows[row] ?? [];
    for (let col = 0; col + MONTHS.length <= cells.length; col += 1) {
      if (MONTHS.every((label, offset) => text(cells[col + offset]) === label)) return { row, col };
    }
  }
  throw new Error("CPI layout: month header row (I–XII) not found");
}

// index_2010 and avg12: one row per year, January–December in columns B–M.
function readYearRows(rows: Rows, sheet: string, rebase: boolean): ParsedCpiCell[] {
  const header = findMonthHeader(rows);
  if (header.col !== 1) throw new Error("CPI layout: year-row table must start its months in column B");
  const cells: ParsedCpiCell[] = [];
  let ended = false;
  for (let row = header.row + 1; row < rows.length; row += 1) {
    const values = rows[row] ?? [];
    const year = numeric(values[0]);
    if (year === null) {
      if (values.slice(1, 13).some((value) => numeric(value) !== null)) throw new Error(`CPI layout: numeric row ${row + 1} has no year`);
      continue;
    }
    if (!Number.isInteger(year) || year < 1990 || year > 2100) throw new Error(`CPI layout: invalid year ${year} at row ${row + 1}`);
    for (let month = 1; month <= 12; month += 1) {
      const raw = numeric(values[month]);
      if (raw === null) {
        ended = true;
        continue;
      }
      if (ended) throw new Error(`CPI layout: value after a gap at ${locator(sheet, row, month)}`);
      cells.push({ period: makePeriod(year, month), value: toValue(raw, rebase), locator: locator(sheet, row, month) });
    }
  }
  return cells;
}

// yoy, mom and core: years across a header row, I–XII beneath, one data row.
function readYearColumns(rows: Rows, sheet: string, header: { row: number; col: number }, dataRow: number, rebase: boolean): ParsedCpiCell[] {
  const years = rows[header.row - 1] ?? [];
  const months = rows[header.row] ?? [];
  const values = rows[dataRow] ?? [];
  const cells: ParsedCpiCell[] = [];
  let ended = false;
  for (let col = header.col; col < months.length; col += 1) {
    const label = text(months[col]);
    if (label === "") break;
    const offset = col - header.col;
    if (label !== MONTHS[offset % 12]) throw new Error(`CPI layout: unexpected month header "${label}" at ${locator(sheet, header.row, col)}`);
    const year = numeric(years[col - (offset % 12)]);
    if (year === null || !Number.isInteger(year)) throw new Error(`CPI layout: no year above ${locator(sheet, header.row, col)}`);
    const raw = numeric(values[col]);
    if (raw === null) {
      ended = true;
      continue;
    }
    if (ended) throw new Error(`CPI layout: value after a gap at ${locator(sheet, dataRow, col)}`);
    cells.push({ period: makePeriod(year, (offset % 12) + 1), value: toValue(raw, rebase), locator: locator(sheet, dataRow, col) });
  }
  return cells;
}

export function readGeostatCpiFile(content: Buffer, role: CpiFileRole, language: CpiLanguage): ParsedCpiSeries[] {
  const spec = ROLES[role];
  const book = XLSX.read(content, { type: "buffer" });
  let sheetName: string;
  if (spec.layout === "core") {
    if (book.SheetNames.length !== 1) throw new Error(`CPI layout: ${role} must have one sheet, found ${book.SheetNames.length}`);
    sheetName = book.SheetNames[0]!;
  } else {
    const found = book.SheetNames.find((name) => name.trim() === NATIONAL_SHEET[language]);
    if (!found) throw new Error(`CPI layout: national sheet "${NATIONAL_SHEET[language]}" not found in ${role}`);
    sheetName = found;
  }
  const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheetName]!, { header: 1, raw: true, defval: null });
  if (language === "en" && !text(rows[0]?.[0]).toLowerCase().includes(EN_TITLES[role].toLowerCase())) {
    throw new Error(`CPI layout: ${role} title does not contain "${EN_TITLES[role]}"`);
  }
  const sheet = sheetName.trim();

  if (spec.layout === "yearRows") {
    const [[seriesId, measure]] = spec.series as [[CpiSeriesId, CpiMeasure]];
    return [{ seriesId, measure, cells: readYearRows(rows, sheet, spec.rebase) }];
  }

  const header = findMonthHeader(rows);
  if (spec.layout === "total") {
    const totals = rows.flatMap((row, index) => (index > header.row && text(row[2]) === TOTAL_LABEL[language] ? [index] : []));
    if (totals.length !== 1) throw new Error(`CPI layout: expected one "${TOTAL_LABEL[language]}" row in ${role}, found ${totals.length}`);
    const [[seriesId, measure]] = spec.series as [[CpiSeriesId, CpiMeasure]];
    return [{ seriesId, measure, cells: readYearColumns(rows, sheet, header, totals[0]!, spec.rebase) }];
  }

  const dataRows = rows.flatMap((row, index) =>
    index > header.row && row.filter((value) => numeric(value) !== null).length >= 12 ? [index] : [],
  );
  if (dataRows.length !== 2) throw new Error(`CPI layout: expected two core indicator rows in ${role}, found ${dataRows.length}`);
  if (language === "en") {
    dataRows.forEach((row, index) => {
      if (text(rows[row]?.[0]) !== EN_CORE_LABELS[index]) throw new Error(`CPI layout: unexpected core label "${text(rows[row]?.[0])}"`);
    });
  }
  return spec.series.map(([seriesId, measure], index) => ({
    seriesId,
    measure,
    cells: readYearColumns(rows, sheet, header, dataRows[index]!, spec.rebase),
  }));
}
```

- [ ] **Step 6: Write `sourceFiles.ts`**

```ts
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { CPI_FILE_ROLES } from "./readGeostatCpi";

export const INFLATION_RAW_ROOT = path.resolve(process.cwd(), "../../docs/Raw Data/Inflation");

const manifestRowSchema = z.object({
  file_role: z.enum(CPI_FILE_ROLES),
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

export type CpiManifestRow = z.infer<typeof manifestRowSchema>;
export type VerifiedCpiFile = CpiManifestRow & { content: Buffer };

/** The newest vintage folder (named after the last month it covers). */
export async function latestCpiVintage(rawRoot = INFLATION_RAW_ROOT): Promise<string> {
  const entries = await fs.readdir(path.join(rawRoot, "geostat-cpi"), { withFileTypes: true });
  const vintages = entries
    .filter((entry) => entry.isDirectory() && /^\d{4}-(0[1-9]|1[0-2])$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const latest = vintages.at(-1);
  if (!latest) throw new Error("No Geostat CPI vintage folder under docs/Raw Data/Inflation/geostat-cpi");
  return latest;
}

export async function readVerifiedCpiFiles(vintageDir: string): Promise<VerifiedCpiFile[]> {
  const text = await fs.readFile(path.join(vintageDir, "source-manifest.csv"), "utf8");
  const records = parse(text, { bom: true, columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
  const rows = records.map((record) => manifestRowSchema.parse(record));
  for (const role of CPI_FILE_ROLES) {
    for (const language of ["en", "ka"] as const) {
      const count = rows.filter((row) => row.file_role === role && row.language === language).length;
      if (count !== 1) throw new Error(`CPI manifest must list exactly one ${language} ${role} file, found ${count}`);
    }
  }
  if (rows.length !== CPI_FILE_ROLES.length * 2) throw new Error(`CPI manifest lists ${rows.length} files, expected ${CPI_FILE_ROLES.length * 2}`);
  return Promise.all(
    rows.map(async (row) => {
      const content = await fs.readFile(path.join(vintageDir, row.local_file));
      const sha256 = createHash("sha256").update(content).digest("hex");
      if (content.length !== row.bytes || sha256 !== row.sha256) throw new Error(`CPI source hash mismatch: ${row.local_file}`);
      return { ...row, content };
    }),
  );
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run tests/data/inflation/readGeostatCpi.test.ts`
Expected: PASS (9 tests). If the Georgian parity test fails for a role, the Georgian download in Task 1 Step 3 paired the wrong file; fix the download and manifest, not the parser.

- [ ] **Step 8: Typecheck and commit**

Run: `npm run typecheck` — expected: no errors.

```bash
git add apps/web/lib/data/inflation apps/web/tests/data/inflation
git commit -m "feat(inflation): read Geostat CPI workbooks by content" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Validate, prepare and check the canonical CSV

**Files:**
- Create: `apps/web/lib/data/inflation/validateInflation.ts`
- Create: `apps/web/lib/data/inflation/importInflation.ts` (loaders only in this task; served data and parity in Task 4)
- Create: `apps/web/lib/data/inflation/prepareInflation.ts`
- Create: `apps/web/scripts/prepare-inflation.ts`
- Modify: `apps/web/package.json`
- Generate: `data/imports/cpi-national-monthly.csv`, `data/reports/inflation-cpi-validation.json`
- Test: `apps/web/tests/data/inflation/prepareInflation.test.ts`

**Interfaces:**
- Consumes: Task 2 (`readGeostatCpiFile`, `readVerifiedCpiFiles`, `latestCpiVintage`, `INFLATION_RAW_ROOT`, periods, types).
- Produces: `factKey(fact)`, `validateCpiFacts(facts) → { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> }`, `recomputeHeadline(facts) → { yoy: number; mom: number; avg12: number }` (max absolute error, pp), `assertLanguageParity(role, en, ka)`, `findRevisions(previous, next): string[]`, `assertNoRevisions(previous, next)`, `validateTargetRows(rows)`, `RECOMPUTE_TOLERANCE_PP = 0.2`.
- Produces: `loadCpiFacts(relativePath?)`, `loadInflationTargets(relativePath?)`, `CPI_FACTS_CSV`, `INFLATION_TARGETS_CSV`.
- Produces: `prepareInflation({ rawRoot?, previousFacts? }) → { facts: CpiFact[]; validation: InflationValidationReport }`, `serializeCpiFacts(facts): string`, `writeInflationArtifacts(mode: "write" | "check" | "public")`.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/data/inflation/prepareInflation.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { periodFromKey } from "../../../lib/data/inflation/periods";
import { prepareInflation, serializeCpiFacts } from "../../../lib/data/inflation/prepareInflation";
import { loadCpiFacts, loadInflationTargets } from "../../../lib/data/inflation/importInflation";
import { INFLATION_RAW_ROOT } from "../../../lib/data/inflation/sourceFiles";
import type { CpiFact } from "../../../lib/data/inflation/types";
import { assertNoRevisions, findRevisions, recomputeHeadline, validateCpiFacts, validateTargetRows } from "../../../lib/data/inflation/validateInflation";

let facts: CpiFact[];
let lastPeriod: string;

beforeAll(async () => {
  const result = await prepareInflation({ previousFacts: null });
  facts = result.facts;
  lastPeriod = result.validation.lastPeriod;
});

const months = (from: string, to: string) => periodFromKey(to) - periodFromKey(from) + 1;

describe("prepareInflation", () => {
  it("delivers every published series over its full contiguous coverage", async () => {
    const { validation } = await prepareInflation({ previousFacts: null });
    expect(validation.firstPeriods).toEqual({
      "cpi.headline:index_2010": "2000-01",
      "cpi.headline:yoy_pct": "2004-01",
      "cpi.headline:mom_pct": "2004-01",
      "cpi.headline:avg12_pct": "2002-01",
      "cpi.core:yoy_pct": "2010-01",
      "cpi.core:mom_pct": "2010-01",
      "cpi.core_ex_tobacco:yoy_pct": "2010-01",
      "cpi.core_ex_tobacco:mom_pct": "2010-01",
    });
    expect(validation.counts["cpi.headline:index_2010"]).toBe(months("2000-01", lastPeriod));
    expect(validation.counts["cpi.core:yoy_pct"]).toBe(months("2010-01", lastPeriod));
    expect(validation.languageParity).toBe("PASS");
    expect(validation.maxRecomputeErrorPp.yoy).toBeLessThanOrEqual(0.2);
    expect(validation.maxRecomputeErrorPp.mom).toBeLessThanOrEqual(0.2);
    expect(validation.maxRecomputeErrorPp.avg12).toBeLessThanOrEqual(0.2);
    expect(facts.every((fact) => fact.status === "published" && fact.sourceLocator.length > 0)).toBe(true);
    expect(facts.some((fact) => fact.seriesId === "cpi.core" && fact.measure === "index_2010")).toBe(false);
  });

  it("matches the committed canonical CSV byte for byte", async () => {
    const committed = await fs.readFile(path.resolve(process.cwd(), "../../data/imports/cpi-national-monthly.csv"), "utf8");
    expect(serializeCpiFacts(facts)).toBe(committed);
  });

  it("round-trips through the CSV loader", async () => {
    expect(await loadCpiFacts()).toEqual(facts);
  });
});

describe("validation rules", () => {
  it("rejects a gap, a duplicate, an unpublished measure and a series ending early", () => {
    const withoutOne = facts.filter((fact) => !(fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2015-06"));
    expect(() => validateCpiFacts(withoutOne)).toThrow(/gap/);
    expect(() => validateCpiFacts([...facts, facts[0]!])).toThrow(/Duplicate/);
    expect(() => validateCpiFacts([...facts, { ...facts[0]!, seriesId: "cpi.core", measure: "index_2010" }])).toThrow(/does not publish/);
    const lastCore = facts.filter((fact) => !(fact.seriesId === "cpi.core" && fact.measure === "mom_pct" && fact.period === lastPeriod));
    expect(() => validateCpiFacts(lastCore)).toThrow(/end in different months/);
  });

  it("rejects a headline rate that disagrees with the index", () => {
    const bent = facts.map((fact) =>
      fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && fact.period === "2020-03" ? { ...fact, value: "9.9" } : fact,
    );
    expect(() => recomputeHeadline(bent)).toThrow(/yoy differs/);
  });

  it("stops on any revision to published history and lists the month", () => {
    const revised = facts.map((fact) =>
      fact.seriesId === "cpi.headline" && fact.measure === "mom_pct" && fact.period === "2012-05" ? { ...fact, value: "0.1234" } : fact,
    );
    expect(findRevisions(facts, revised)).toEqual([`cpi.headline:mom_pct:2012-05 ${facts.find((f) => f.measure === "mom_pct" && f.period === "2012-05" && f.seriesId === "cpi.headline")!.value} → 0.1234`]);
    expect(() => assertNoRevisions(facts, revised)).toThrow(/revised published CPI history/);
    expect(() => assertNoRevisions(facts, facts.slice(1))).toThrow(/removed/);
    expect(() => assertNoRevisions(facts.slice(0, -5), facts)).not.toThrow();
  });

  it("fails prepare when the previous canonical CSV disagrees with the files", async () => {
    const revised = facts.map((fact, index) => (index === 100 ? { ...fact, value: "1" } : fact));
    await expect(prepareInflation({ previousFacts: revised })).rejects.toThrow(/revised published CPI history/);
  });

  it("accepts the reviewed target path and rejects broken ones", async () => {
    const targets = await loadInflationTargets();
    expect(targets.at(-1)).toMatchObject({ effectiveTo: null, targetPct: "3" });
    expect(() => validateTargetRows([{ ...targets[0]!, effectiveTo: null }, ...targets.slice(1)])).toThrow(/open-ended/);
    expect(() => validateTargetRows([targets[0]!, targets[2]!])).toThrow(/contiguous/);
    expect(() => validateTargetRows([{ ...targets[0]!, targetPct: "0" }])).toThrow(/target/);
  });

  it("refuses a vintage whose Georgian file carries different values", async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), "cpi-raw-"));
    try {
      await fs.cp(INFLATION_RAW_ROOT, temp, { recursive: true });
      const vintage = (await fs.readdir(path.join(temp, "geostat-cpi"))).sort().at(-1)!;
      const dir = path.join(temp, "geostat-cpi", vintage);
      // The Georgian y/y row now names the Georgian m/m file together with that
      // file's own hash and size: every hash still verifies, but the y/y role
      // no longer carries the English y/y values.
      const manifestPath = path.join(dir, "source-manifest.csv");
      const records = parse(await fs.readFile(manifestPath, "utf8"), { bom: true, columns: true }) as Record<string, string>[];
      const yoy = records.find((row) => row.file_role === "yoy" && row.language === "ka")!;
      const mom = records.find((row) => row.file_role === "mom" && row.language === "ka")!;
      for (const field of ["local_file", "sha256", "bytes"]) yoy[field] = mom[field]!;
      const header = Object.keys(records[0]!);
      await fs.writeFile(manifestPath, [header.join(","), ...records.map((row) => header.map((field) => csvEscape(row[field]!)).join(","))].join("\n"));
      await expect(prepareInflation({ rawRoot: temp, previousFacts: null })).rejects.toThrow(/English and Georgian yoy files differ/);
    } finally {
      await fs.rm(temp, { recursive: true, force: true });
    }
  });
});
```

Add these imports to the top of the test file:

```ts
import { parse } from "csv-parse/sync";
import { csvEscape } from "../../../lib/data/csvEscape";
```

The copy keeps the NBG folder and target CSV untouched, so only the Georgian y/y parity can fail.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/data/inflation/prepareInflation.test.ts`
Expected: FAIL — cannot resolve `lib/data/inflation/prepareInflation`.

- [ ] **Step 3: Write `validateInflation.ts`**

```ts
import Decimal from "decimal.js";
import type { ParsedCpiSeries } from "./readGeostatCpi";
import { periodFromKey, periodKey } from "./periods";
import { CPI_SERIES_IDS, CPI_SERIES_MEASURES, type CpiFact, type InflationTargetRow } from "./types";

const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The 2026-09-10 files agree with their own index within 0.15 pp across every
// month — rounding only. 0.2 leaves room for rounding, never for a wrong row.
export const RECOMPUTE_TOLERANCE_PP = 0.2;

export function factKey(fact: Pick<CpiFact, "seriesId" | "measure" | "period">): string {
  return `${fact.seriesId}:${fact.measure}:${fact.period}`;
}

export function validateCpiFacts(facts: CpiFact[]): { lastPeriod: string; counts: Record<string, number>; firstPeriods: Record<string, string> } {
  const seen = new Set<string>();
  const periodsByGroup = new Map<string, number[]>();
  for (const fact of facts) {
    if (!(CPI_SERIES_IDS as readonly string[]).includes(fact.seriesId)) throw new Error(`Unknown CPI series ${fact.seriesId}`);
    if (!CPI_SERIES_MEASURES[fact.seriesId].includes(fact.measure)) throw new Error(`CPI series ${fact.seriesId} does not publish ${fact.measure}`);
    if (!PERIOD.test(fact.period)) throw new Error(`Invalid CPI period ${fact.period}`);
    const key = factKey(fact);
    if (seen.has(key)) throw new Error(`Duplicate CPI observation ${key}`);
    seen.add(key);
    const value = new Decimal(fact.value);
    if (!value.isFinite()) throw new Error(`Non-finite CPI observation ${key}`);
    if (fact.measure === "index_2010" && value.lte(0)) throw new Error(`Non-positive CPI index ${key}`);
    if (fact.status !== "published") throw new Error(`Invalid CPI status ${key}`);
    if (!fact.sourceId || !fact.sourceLocator || !DATE.test(fact.lastReviewedAt)) throw new Error(`CPI provenance missing ${key}`);
    const group = `${fact.seriesId}:${fact.measure}`;
    const periods = periodsByGroup.get(group) ?? [];
    periods.push(periodFromKey(fact.period));
    periodsByGroup.set(group, periods);
  }

  const counts: Record<string, number> = {};
  const firstPeriods: Record<string, string> = {};
  let last: number | null = null;
  for (const seriesId of CPI_SERIES_IDS) {
    for (const measure of CPI_SERIES_MEASURES[seriesId]) {
      const group = `${seriesId}:${measure}`;
      const periods = (periodsByGroup.get(group) ?? []).sort((a, b) => a - b);
      if (periods.length === 0) throw new Error(`CPI coverage missing: ${group}`);
      for (let index = 1; index < periods.length; index += 1) {
        if (periods[index] !== periods[index - 1]! + 1) throw new Error(`CPI coverage gap: ${group} after ${periodKey(periods[index - 1]!)}`);
      }
      const end = periods.at(-1)!;
      if (last !== null && end !== last) {
        throw new Error(`CPI series end in different months: ${group} ends ${periodKey(end)}, others ${periodKey(last)}`);
      }
      last = end;
      counts[group] = periods.length;
      firstPeriods[group] = periodKey(periods[0]!);
    }
  }
  return { lastPeriod: periodKey(last!), counts, firstPeriods };
}

// Validation only: the published series are what the site serves.
export function recomputeHeadline(facts: CpiFact[]): { yoy: number; mom: number; avg12: number } {
  const series = (measure: CpiFact["measure"]) =>
    new Map(facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === measure).map((fact) => [periodFromKey(fact.period), Number(fact.value)]));
  const index = series("index_2010");
  const ratio = (period: number, lag: number) => {
    const current = index.get(period);
    const base = index.get(period - lag);
    return current === undefined || base === undefined ? null : (current / base - 1) * 100;
  };
  const mean = (from: number, to: number) => {
    let sum = 0;
    for (let period = from; period <= to; period += 1) {
      const value = index.get(period);
      if (value === undefined) return null;
      sum += value;
    }
    return sum / (to - from + 1);
  };
  const errors = { yoy: 0, mom: 0, avg12: 0 };
  const check = (name: keyof typeof errors, published: Map<number, number>, compute: (period: number) => number | null) => {
    for (const [period, value] of published) {
      const computed = compute(period);
      if (computed === null) throw new Error(`Cannot recompute headline ${name} for ${periodKey(period)}: index missing`);
      errors[name] = Math.max(errors[name], Math.abs(computed - value));
    }
  };
  check("yoy", series("yoy_pct"), (period) => ratio(period, 12));
  check("mom", series("mom_pct"), (period) => ratio(period, 1));
  check("avg12", series("avg12_pct"), (period) => {
    const current = mean(period - 11, period);
    const previous = mean(period - 23, period - 12);
    return current === null || previous === null ? null : (current / previous - 1) * 100;
  });
  for (const [name, error] of Object.entries(errors)) {
    if (error > RECOMPUTE_TOLERANCE_PP) throw new Error(`Headline ${name} differs from the recomputed index by ${error.toFixed(3)} pp (limit ${RECOMPUTE_TOLERANCE_PP})`);
  }
  return errors;
}

export function assertLanguageParity(role: string, english: ParsedCpiSeries[], georgian: ParsedCpiSeries[]): void {
  if (english.length !== georgian.length) throw new Error(`English and Georgian ${role} files differ in series count`);
  english.forEach((series, index) => {
    const other = georgian[index]!;
    const left = series.cells.map((cell) => `${cell.period}=${cell.value}`);
    const right = other.cells.map((cell) => `${cell.period}=${cell.value}`);
    const first = left.findIndex((value, position) => value !== right[position]);
    if (other.seriesId !== series.seriesId || left.length !== right.length || first !== -1) {
      const where = first === -1 ? "in length" : `at ${periodKey(series.cells[first]!.period)}`;
      throw new Error(`English and Georgian ${role} files differ for ${series.seriesId} ${where}`);
    }
  });
}

/** Every change to an already-published month, including a month that disappeared. */
export function findRevisions(previous: CpiFact[], next: CpiFact[]): string[] {
  const nextByKey = new Map(next.map((fact) => [factKey(fact), fact]));
  const problems: string[] = [];
  for (const fact of previous) {
    const current = nextByKey.get(factKey(fact));
    if (!current) problems.push(`${factKey(fact)} removed`);
    else if (!new Decimal(current.value).eq(fact.value)) problems.push(`${factKey(fact)} ${fact.value} → ${current.value}`);
  }
  return problems;
}

// Geostat's policy is no planned revisions, so one is a stop-and-review event,
// never a silent overwrite (spec §4.4).
export function assertNoRevisions(previous: CpiFact[], next: CpiFact[]): void {
  const revisions = findRevisions(previous, next);
  if (revisions.length > 0) {
    throw new Error(`Geostat revised published CPI history; review before accepting (${revisions.length}):\n${revisions.slice(0, 20).join("\n")}`);
  }
}

export function validateTargetRows(rows: InflationTargetRow[]): void {
  if (rows.length === 0) throw new Error("NBG inflation target file is empty");
  rows.forEach((row, index) => {
    if (!PERIOD.test(row.effectiveFrom) || (row.effectiveTo !== null && !PERIOD.test(row.effectiveTo))) {
      throw new Error(`Invalid NBG target period ${row.effectiveFrom}–${row.effectiveTo ?? ""}`);
    }
    const target = new Decimal(row.targetPct);
    if (!target.isFinite() || target.lte(0)) throw new Error(`Invalid NBG target value ${row.targetPct} from ${row.effectiveFrom}`);
    if (!row.sourceId || !DATE.test(row.lastReviewedAt)) throw new Error(`NBG target provenance missing from ${row.effectiveFrom}`);
    const from = periodFromKey(row.effectiveFrom);
    const to = row.effectiveTo === null ? null : periodFromKey(row.effectiveTo);
    if (to !== null && to < from) throw new Error(`NBG target row ends before it starts: ${row.effectiveFrom}`);
    const next = rows[index + 1];
    if (next) {
      if (to === null) throw new Error(`Only the last NBG target row may be open-ended (${row.effectiveFrom})`);
      if (periodFromKey(next.effectiveFrom) !== to + 1) throw new Error(`NBG target rows must be contiguous: ${row.effectiveTo} → ${next.effectiveFrom}`);
    }
  });
}
```

- [ ] **Step 4: Write the loaders in `importInflation.ts`**

```ts
import Decimal from "decimal.js";
import { readCsvRecords } from "../csv";
import { CPI_MEASURES, CPI_SERIES_IDS, type CpiFact, type InflationTargetRow } from "./types";
import { validateCpiFacts, validateTargetRows } from "./validateInflation";

// Relative to apps/web, like every served CSV path (lib/data/servedData.ts).
export const CPI_FACTS_CSV = "../../data/imports/cpi-national-monthly.csv";
export const INFLATION_TARGETS_CSV = "../../data/imports/nbg-inflation-target.csv";

export async function loadCpiFacts(relativePath = CPI_FACTS_CSV): Promise<CpiFact[]> {
  const rows = await readCsvRecords(relativePath);
  const facts = rows.map((row): CpiFact => {
    if (!(CPI_SERIES_IDS as readonly string[]).includes(row.series_id)) throw new Error(`Unknown CPI series ${row.series_id}`);
    if (!(CPI_MEASURES as readonly string[]).includes(row.measure)) throw new Error(`Unknown CPI measure ${row.measure}`);
    return {
      seriesId: row.series_id as CpiFact["seriesId"],
      measure: row.measure as CpiFact["measure"],
      period: row.period,
      value: new Decimal(row.value).toFixed(),
      status: row.status as CpiFact["status"],
      sourceId: row.source_id,
      sourceLocator: row.source_locator,
      lastReviewedAt: row.last_reviewed_at,
    };
  });
  validateCpiFacts(facts);
  return facts;
}

export async function loadInflationTargets(relativePath = INFLATION_TARGETS_CSV): Promise<InflationTargetRow[]> {
  const rows = await readCsvRecords(relativePath);
  const targets = rows.map((row): InflationTargetRow => ({
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to === "" ? null : row.effective_to,
    targetPct: new Decimal(row.target_pct).toFixed(),
    sourceId: row.source_id,
    lastReviewedAt: row.last_reviewed_at,
  }));
  validateTargetRows(targets);
  return targets;
}
```

- [ ] **Step 5: Write `prepareInflation.ts`**

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { csvEscape } from "../csvEscape";
import { readCsvRecords } from "../csv";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { loadCpiFacts, loadInflationTargets } from "./importInflation";
import { periodKey } from "./periods";
import { CPI_FILE_ROLES, readGeostatCpiFile } from "./readGeostatCpi";
import { INFLATION_RAW_ROOT, latestCpiVintage, readVerifiedCpiFiles } from "./sourceFiles";
import type { CpiFact } from "./types";
import { assertLanguageParity, assertNoRevisions, recomputeHeadline, validateCpiFacts } from "./validateInflation";

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const CPI_FACTS_FILE = path.join(REPO_ROOT, "data/imports/cpi-national-monthly.csv");
const REPORT_FILE = path.join(REPO_ROOT, "data/reports/inflation-cpi-validation.json");
const PUBLIC_FILE = path.resolve(process.cwd(), "public/downloads/data/inflation-cpi-national.csv");
const CPI_HEADERS = ["series_id", "measure", "period", "value", "status", "source_id", "source_locator", "last_reviewed_at"];
// Leading byte-order mark, as on the GDP overview CSV, so Excel opens the file as UTF-8.
const BOM = String.fromCharCode(0xfeff);

export type InflationValidationReport = {
  status: "PASS";
  vintage: string;
  lastPeriod: string;
  counts: Record<string, number>;
  firstPeriods: Record<string, string>;
  maxRecomputeErrorPp: { yoy: number; mom: number; avg12: number };
  languageParity: "PASS";
  sourceHashes: Record<string, string>;
};

async function loadPreviousFacts(): Promise<CpiFact[] | null> {
  try {
    return await loadCpiFacts();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function registeredSourceIds(): Promise<Set<string>> {
  return new Set((await readCsvRecords("../../data/sources/source-documents.csv")).map((row) => row.source_id));
}

/**
 * previousFacts: the canonical CSV to guard against revisions. Omit to read the
 * committed file; pass null for a first build.
 */
export async function prepareInflation(options: { rawRoot?: string; previousFacts?: CpiFact[] | null } = {}) {
  const rawRoot = options.rawRoot ?? INFLATION_RAW_ROOT;
  const vintage = await latestCpiVintage(rawRoot);
  const files = await readVerifiedCpiFiles(path.join(rawRoot, "geostat-cpi", vintage));

  const facts: CpiFact[] = [];
  for (const role of CPI_FILE_ROLES) {
    const english = files.find((file) => file.file_role === role && file.language === "en")!;
    const georgian = files.find((file) => file.file_role === role && file.language === "ka")!;
    const parsed = readGeostatCpiFile(english.content, role, "en");
    assertLanguageParity(role, parsed, readGeostatCpiFile(georgian.content, role, "ka"));
    for (const series of parsed) {
      for (const cell of series.cells) {
        facts.push({
          seriesId: series.seriesId,
          measure: series.measure,
          period: periodKey(cell.period),
          value: cell.value,
          status: "published",
          sourceId: english.source_id,
          sourceLocator: cell.locator,
          lastReviewedAt: english.retrieved_at,
        });
      }
    }
  }
  facts.sort((a, b) => a.seriesId.localeCompare(b.seriesId) || a.measure.localeCompare(b.measure) || a.period.localeCompare(b.period));

  const coverage = validateCpiFacts(facts);
  const errors = recomputeHeadline(facts);
  const previous = options.previousFacts === undefined ? await loadPreviousFacts() : options.previousFacts;
  if (previous) assertNoRevisions(previous, facts);

  const sourceIds = await registeredSourceIds();
  const targets = await loadInflationTargets();
  for (const id of new Set([...facts, ...targets].map((row) => row.sourceId))) {
    if (!sourceIds.has(id)) throw new Error(`Inflation source ${id} is missing from data/sources/source-documents.csv`);
  }

  const round = (value: number) => Number(value.toFixed(4));
  const validation: InflationValidationReport = {
    status: "PASS",
    vintage,
    ...coverage,
    maxRecomputeErrorPp: { yoy: round(errors.yoy), mom: round(errors.mom), avg12: round(errors.avg12) },
    languageParity: "PASS",
    sourceHashes: Object.fromEntries(files.map((file) => [file.local_file, file.sha256])),
  };
  return { facts, validation };
}

export function serializeCpiFacts(facts: CpiFact[]): string {
  const lines = facts.map((fact) =>
    [fact.seriesId, fact.measure, fact.period, fact.value, fact.status, fact.sourceId, fact.sourceLocator, fact.lastReviewedAt].map(csvEscape).join(","),
  );
  return BOM + [CPI_HEADERS.join(","), ...lines].join("\n") + "\n";
}

export async function writeInflationArtifacts(mode: "write" | "check" | "public") {
  if (mode === "public") {
    // The processed-data download is the reviewed CSV itself (validated on load).
    await loadCpiFacts();
    await fs.mkdir(path.dirname(PUBLIC_FILE), { recursive: true });
    await fs.copyFile(CPI_FACTS_FILE, PUBLIC_FILE);
    return null;
  }
  const { facts, validation } = await prepareInflation();
  const outputs: Array<[string, string]> = [
    [CPI_FACTS_FILE, serializeCpiFacts(facts)],
    [REPORT_FILE, `${JSON.stringify(validation, null, 2)}\n`],
  ];
  for (const [file, content] of outputs) {
    if (mode === "write") {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, content);
    } else {
      await assertGeneratedArtifactMatches("inflation CPI", file, content);
    }
  }
  return validation;
}
```

Note the `write` path: the revision guard reads the committed CSV before overwriting it, so a refresh that changes history throws before anything is written.

- [ ] **Step 6: Write the CLI and wire the scripts**

`apps/web/scripts/prepare-inflation.ts`:

```ts
import { writeInflationArtifacts } from "../lib/data/inflation/prepareInflation";

const modes = (["--write", "--check", "--public"] as const).filter((flag) => process.argv.includes(flag));
if (modes.length !== 1) throw new Error("Pass exactly one of --write, --check or --public");
const mode = modes[0].slice(2) as "write" | "check" | "public";

writeInflationArtifacts(mode)
  .then((validation) => console.log(validation ? JSON.stringify(validation, null, 2) : "Inflation public CSV written"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
```

`apps/web/package.json` scripts: add

```json
"data:prepare-inflation": "tsx scripts/prepare-inflation.ts --write",
"data:check-inflation": "tsx scripts/prepare-inflation.ts --check",
"data:prepare-inflation-public": "tsx scripts/prepare-inflation.ts --public",
```

append ` && npm run data:check-inflation` to the end of `data:validate`, and append ` && npm run data:prepare-inflation-public` to the end of both `predev` and `prebuild`.

- [ ] **Step 7: Generate the canonical CSV**

Run: `npm run data:prepare-inflation`
Expected: the validation JSON printed with `"status": "PASS"` and every `maxRecomputeErrorPp` ≤ 0.2. If avg12 exceeds 0.2, stop and report the maximum and its month; do not raise the tolerance without the user.

Then: `npm run data:check-inflation` — expected: the same JSON, exit code 0. `git status` shows only the new CSV and report as generated files.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/data/inflation/prepareInflation.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/data/inflation apps/web/scripts/prepare-inflation.ts apps/web/package.json apps/web/tests/data/inflation data/imports/cpi-national-monthly.csv data/reports/inflation-cpi-validation.json
git commit -m "feat(inflation): validated canonical CPI CSV with revision guard" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Serve the data and mirror it to the database

**Files:**
- Modify: `apps/web/lib/data/inflation/importInflation.ts`
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/20260912000000_inflation_cpi/migration.sql`
- Modify: `apps/web/lib/db/mirrorRows.ts`, `apps/web/lib/db/servedDataDb.ts`, `apps/web/lib/data/servedData.ts`, `apps/web/scripts/import-budget-facts.ts`
- Modify: `docs/data-methodology/database-import.md`
- Test: `apps/web/tests/data/inflation/importInflation.test.ts`

**Interfaces:**
- Consumes: Task 3 loaders and validators.
- Produces: `assertInflationParity(csv: { facts: CpiFact[]; targets: InflationTargetRow[] }, db: same)`, `loadServedInflationData(): Promise<{ facts: ServedCpiFact[]; targets: ServedInflationTargetRow[] }>`, `loadInflationCpiFactsFromMirror(db)`, `loadInflationTargetsFromMirror(db)`, `loadInflationDataFromDb()`, `SERVED_DATA_FILES.inflationCpiFacts`, `SERVED_DATA_FILES.inflationTargets`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/data/inflation/importInflation.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertInflationParity, loadCpiFacts, loadInflationTargets, loadServedInflationData } from "../../../lib/data/inflation/importInflation";

describe("inflation serving", () => {
  it("rejects a changed value, locator or target in the mirror", async () => {
    const csv = { facts: await loadCpiFacts(), targets: await loadInflationTargets() };
    expect(() => assertInflationParity(csv, csv)).not.toThrow();
    expect(() => assertInflationParity(csv, { ...csv, facts: [{ ...csv.facts[0]!, value: "1" }, ...csv.facts.slice(1)] })).toThrow(/differs/);
    expect(() => assertInflationParity(csv, { ...csv, facts: [{ ...csv.facts[0]!, sourceLocator: "wrong" }, ...csv.facts.slice(1)] })).toThrow(/differs/);
    expect(() => assertInflationParity(csv, { ...csv, targets: [{ ...csv.targets[0]!, targetPct: "6" }, ...csv.targets.slice(1)] })).toThrow(/differs/);
  });

  it("serves numbers and refuses an unknown series", async () => {
    const { facts, targets } = await loadServedInflationData();
    expect(typeof facts[0]!.value).toBe("number");
    expect(targets.at(-1)!.targetPct).toBe(3);
    const temp = path.join(await fs.mkdtemp(path.join(os.tmpdir(), "cpi-csv-")), "bad.csv");
    await fs.writeFile(temp, "series_id,measure,period,value,status,source_id,source_locator,last_reviewed_at\ncpi.food,yoy_pct,2020-01,1,published,source.geostat_cpi_yoy,Georgia!D5,2026-09-12\n");
    await expect(loadCpiFacts(temp)).rejects.toThrow(/Unknown CPI series/);
  });
});
```

`readCsvRecords` resolves paths against `process.cwd()`; `path.resolve` keeps an absolute temp path absolute, so the temp file works.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/data/inflation/importInflation.test.ts`
Expected: FAIL — `assertInflationParity` is not exported.

- [ ] **Step 3: Add parity and served data to `importInflation.ts`**

Append (and add the imports `assertSameServedRows` from `../servedDataParity`, `factKey` from `./validateInflation`, and the `Served…` types):

```ts
const SOURCE_DOCUMENTS_CSV = "../../data/sources/source-documents.csv";

export function assertInflationParity(
  csv: { facts: CpiFact[]; targets: InflationTargetRow[] },
  db: { facts: CpiFact[]; targets: InflationTargetRow[] },
): void {
  validateCpiFacts(db.facts);
  validateTargetRows(db.targets);
  assertSameServedRows("Inflation CPI", csv.facts, db.facts, factKey);
  assertSameServedRows("NBG inflation target", csv.targets, db.targets, (row) => row.effectiveFrom);
}

export async function loadServedInflationData(): Promise<{ facts: ServedCpiFact[]; targets: ServedInflationTargetRow[] }> {
  const mode = (process.env.GEODATA_DATA_SOURCE ?? "csv").trim().toLowerCase();
  if (mode !== "csv" && mode !== "" && mode !== "db") throw new Error("Invalid GEODATA_DATA_SOURCE");
  let facts = await loadCpiFacts();
  let targets = await loadInflationTargets();
  const registered = new Set((await readCsvRecords(SOURCE_DOCUMENTS_CSV)).map((row) => row.source_id));
  for (const id of new Set([...facts, ...targets].map((row) => row.sourceId))) {
    if (!registered.has(id)) throw new Error(`Inflation source ${id} is not registered in data/sources/source-documents.csv`);
  }
  if (mode === "db") {
    const { loadInflationDataFromDb } = await import("../../db/servedDataDb");
    const db = await loadInflationDataFromDb();
    assertInflationParity({ facts, targets }, db);
    facts = db.facts;
    targets = db.targets;
  }
  return {
    facts: facts.map((fact) => ({ ...fact, value: Number(fact.value) })),
    targets: targets.map((row) => ({ ...row, targetPct: Number(row.targetPct) })),
  };
}
```

The environment handling copies `loadServedGdpOverviewData` on purpose; if the merged GDP code has moved it into a shared helper, call that helper instead.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/data/inflation/importInflation.test.ts`
Expected: PASS (2 tests). The mirror functions are not needed yet because the test runs in CSV mode.

- [ ] **Step 5: Add the Prisma models**

In `apps/web/prisma/schema.prisma`, add to `model SourceDocument` and to `model ImportRun`:

```prisma
  inflationCpiFacts InflationCpiFact[]
  inflationTargets  InflationTarget[]
```

and append:

```prisma
model InflationCpiFact {
  seriesId         String
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

  @@id([seriesId, measure, period])
}

model InflationTarget {
  effectiveFrom    String         @id
  effectiveTo      String?
  targetPct        Decimal        @db.Decimal(6, 3)
  sourceDocumentId String
  sourceDocument   SourceDocument @relation(fields: [sourceDocumentId], references: [id])
  lastReviewedAt   DateTime       @db.Date
  importRunId      String?
  importRun        ImportRun?     @relation(fields: [importRunId], references: [id])
}
```

Run: `npm run prisma:generate` — expected: client generated, no errors.

- [ ] **Step 6: Hand-write the migration**

`prisma migrate dev` does not work on this project (P3006; `docs/data-methodology/database-import.md`, "Creating a migration"). Generate the SQL with the documented diff command when a database URL is configured, or write it by hand. The file must match the schema exactly:

`apps/web/prisma/migrations/20260912000000_inflation_cpi/migration.sql`:

```sql
CREATE TABLE "InflationCpiFact" (
  "seriesId" TEXT NOT NULL,
  "measure" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "value" DECIMAL(20,6) NOT NULL,
  "status" TEXT NOT NULL,
  "sourceLocator" TEXT NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationCpiFact_pkey" PRIMARY KEY ("seriesId", "measure", "period"),
  CONSTRAINT "InflationCpiFact_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationCpiFact_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "InflationTarget" (
  "effectiveFrom" TEXT NOT NULL,
  "effectiveTo" TEXT,
  "targetPct" DECIMAL(6,3) NOT NULL,
  "sourceDocumentId" TEXT NOT NULL,
  "lastReviewedAt" DATE NOT NULL,
  "importRunId" TEXT,
  CONSTRAINT "InflationTarget_pkey" PRIMARY KEY ("effectiveFrom"),
  CONSTRAINT "InflationTarget_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InflationTarget_importRunId_fkey" FOREIGN KEY ("importRunId") REFERENCES "ImportRun"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "InflationCpiFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InflationTarget" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "InflationCpiFact" FROM anon, authenticated;
REVOKE ALL ON TABLE "InflationTarget" FROM anon, authenticated;
```

If the merged GDP migration folder is dated later than `20260912000000`, rename this folder to sort after it.

- [ ] **Step 7: Mirror read-back**

`apps/web/lib/db/mirrorRows.ts` — append:

```ts
export async function loadInflationCpiFactsFromMirror(db: MirrorClient): Promise<CpiFact[]> {
  const rows = await db.inflationCpiFact.findMany({ orderBy: [{ seriesId: "asc" }, { measure: "asc" }, { period: "asc" }] });
  return rows.map((row) => ({
    seriesId: row.seriesId as CpiFact["seriesId"],
    measure: row.measure as CpiFact["measure"],
    period: row.period,
    value: row.value.toFixed(),
    status: row.status as CpiFact["status"],
    sourceId: row.sourceDocumentId,
    sourceLocator: row.sourceLocator,
    lastReviewedAt: row.lastReviewedAt.toISOString().slice(0, 10),
  }));
}

export async function loadInflationTargetsFromMirror(db: MirrorClient): Promise<InflationTargetRow[]> {
  const rows = await db.inflationTarget.findMany({ orderBy: { effectiveFrom: "asc" } });
  return rows.map((row) => ({
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    targetPct: row.targetPct.toFixed(),
    sourceId: row.sourceDocumentId,
    lastReviewedAt: row.lastReviewedAt.toISOString().slice(0, 10),
  }));
}
```

with `import type { CpiFact, InflationTargetRow } from "../data/inflation/types";` at the top. `Decimal#toFixed()` with no argument drops the database's trailing zeros (`5.198100` → `5.1981`), which is what the CSV loader produces, so parity compares like with like.

`apps/web/lib/db/servedDataDb.ts` — import both functions and append:

```ts
export async function loadInflationDataFromDb() {
  const [facts, targets] = await Promise.all([loadInflationCpiFactsFromMirror(prisma), loadInflationTargetsFromMirror(prisma)]);
  return { facts, targets };
}
```

`apps/web/lib/data/servedData.ts` — add to `SERVED_DATA_FILES`:

```ts
  inflationCpiFacts: "../../data/imports/cpi-national-monthly.csv",
  inflationTargets: "../../data/imports/nbg-inflation-target.csv",
```

- [ ] **Step 8: Import with parity**

In `apps/web/scripts/import-budget-facts.ts`, following the GDP overview block at each of its four places:

1. Imports: `loadCpiFacts`, `loadInflationTargets`, `assertInflationParity` from `../lib/data/inflation/importInflation`; `loadInflationCpiFactsFromMirror`, `loadInflationTargetsFromMirror` from `../lib/db/mirrorRows`.
2. After the GDP facts load:

```ts
  const inflationCpiFacts = await loadCpiFacts(SERVED_DATA_FILES.inflationCpiFacts);
  const inflationTargets = await loadInflationTargets(SERVED_DATA_FILES.inflationTargets);
  assertSubset("Inflation source IDs", [...inflationCpiFacts, ...inflationTargets].map((row) => row.sourceId), sourceIds);
```

3. In the transaction's delete block, beside `await tx.gdpOverviewFact.deleteMany();`:

```ts
        await tx.inflationCpiFact.deleteMany();
        await tx.inflationTarget.deleteMany();
```

4. Beside the GDP `createMany` and parity:

```ts
        await tx.inflationCpiFact.createMany({
          data: inflationCpiFacts.map(({ sourceId, lastReviewedAt, ...fact }) => ({
            ...fact,
            sourceDocumentId: sourceId,
            lastReviewedAt: new Date(`${lastReviewedAt}T00:00:00.000Z`),
            importRunId: run.id,
          })),
        });
        await tx.inflationTarget.createMany({
          data: inflationTargets.map(({ sourceId, lastReviewedAt, ...row }) => ({
            ...row,
            sourceDocumentId: sourceId,
            lastReviewedAt: new Date(`${lastReviewedAt}T00:00:00.000Z`),
            importRunId: run.id,
          })),
        });
        const mirrorInflation = {
          facts: await loadInflationCpiFactsFromMirror(tx),
          targets: await loadInflationTargetsFromMirror(tx),
        };
        assertInflationParity({ facts: inflationCpiFacts, targets: inflationTargets }, mirrorInflation);
```

5. In the report's table list:

```ts
            { table: "InflationCpiFact", csvRows: inflationCpiFacts.length, dbRows: mirrorInflation.facts.length },
            { table: "InflationTarget", csvRows: inflationTargets.length, dbRows: mirrorInflation.targets.length },
```

Do not run `npm run data:import` — it writes the production mirror and runs only through the Actions pipeline after merge (`docs/deployment.md`).

- [ ] **Step 9: Document the tables**

In `docs/data-methodology/database-import.md`, add to the table→CSV list after the `GdpOverviewFact` row:

```markdown
| `InflationCpiFact` | `data/imports/cpi-national-monthly.csv` (Geostat national CPI: headline index, y/y, m/m, 12-month average; core and core excluding tobacco y/y and m/m; generated by `npm run data:prepare-inflation`) |
| `InflationTarget` | `data/imports/nbg-inflation-target.csv` (hand-reviewed NBG inflation target path) |
```

and name migration `20260912000000_inflation_cpi` wherever that document lists the pending migrations of a release.

- [ ] **Step 10: Typecheck, test, commit**

Run: `npm run typecheck` and `npx vitest run tests/data/inflation` — expected: no errors; all inflation data tests pass.

```bash
git add apps/web/lib apps/web/prisma apps/web/scripts/import-budget-facts.ts apps/web/tests/data/inflation docs/data-methodology/database-import.md
git commit -m "feat(inflation): serve CPI data and mirror it with parity" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Monthly axis for the line chart

**Files:**
- Modify: `apps/web/lib/explorer/dotLattice.ts`
- Create: `apps/web/lib/explorer/periodAxis.ts`
- Modify: `apps/web/components/main-explorer/editorial-line-chart.tsx`
- Test: `apps/web/tests/explorer/dotLattice.test.ts` (append), `apps/web/tests/explorer/periodAxis.test.ts` (new), `apps/web/tests/explorer/editorialLineChart.test.ts` (append)

**Interfaces:**
- Produces: `buildDotLattice({ plotWidth, plotHeight, yearCount, gridStepCount, periodsPerYear?, firstPeriod? }) → { colPitch; rowPitch; colOffset } | null` (`colOffset` is 0 for years).
- Produces: `periodLabelIndices(periods: readonly number[], periodsPerYear?: number): number[]`.
- Produces: `EditorialLineChart` props `periodsPerYear?: number`, `formatPeriod?: (period: number, kind: "axis" | "tooltip") => string`; `ChartSeries.dashed?: boolean`.

Existing callers pass none of the new props and must render byte-identical markup; the existing tests in these three files must pass untouched.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/explorer/dotLattice.test.ts`:

```ts
describe("buildDotLattice for monthly axes", () => {
  it("keeps year axes unchanged, with no column offset", () => {
    expect(buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 21, gridStepCount: 4 })?.colOffset).toBe(0);
  });

  it("groups months into half-year columns when single months are too dense", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 272, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2004 * 12 });
    const monthPitch = 816 / 271;
    // 1 and 3 months fall under the 12px floor; 6 months (≈18px) clears it.
    expect(lattice?.colPitch).toBeCloseTo(monthPitch * 6, 5);
    expect(lattice?.colOffset).toBe(0);
  });

  it("aligns columns to calendar boundaries when the range starts mid-year", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 272, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2004 * 12 + 2 });
    // March start: the first half-year boundary (July) is four months in.
    expect(lattice?.colOffset).toBeCloseTo((816 / 271) * 4, 5);
  });

  it("uses single-month columns on a short range", () => {
    const lattice = buildDotLattice({ plotWidth: 816, plotHeight: 278, yearCount: 13, gridStepCount: 4, periodsPerYear: 12, firstPeriod: 2025 * 12 });
    expect(lattice?.colPitch).toBeCloseTo(816 / 12, 5);
  });
});
```

`apps/web/tests/explorer/periodAxis.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { periodLabelIndices } from "../../lib/explorer/periodAxis";

describe("periodLabelIndices", () => {
  it("keeps the year rule: every ceil(n/12)-th year plus the last, never crowding it", () => {
    const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
    // n = 22 → step 2; index 20 is dropped because it sits one step from the last.
    expect(periodLabelIndices(years)).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 21]);
  });

  it("labels calendar-year starts on a monthly axis, thinned to twelve", () => {
    const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
    const indices = periodLabelIndices(months, 12);
    expect(indices.map((index) => Math.floor(months[index]! / 12))).toEqual([2004, 2006, 2008, 2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]);
  });

  it("falls back to evenly spaced months under two calendar years", () => {
    const months = Array.from({ length: 14 }, (_, index) => 2025 * 12 + 3 + index);
    expect(periodLabelIndices(months, 12)).toEqual([0, 3, 6, 9, 13]);
  });
});
```

Append to `apps/web/tests/explorer/editorialLineChart.test.ts`:

```ts
describe("EditorialLineChart monthly periods", () => {
  const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
  const series: ChartSeries[] = [
    { id: "cpi", label: "CPI", color: "#1E1B16", vals: months.map((_, index) => (index % 24) - 3), planned: months.map(() => false) },
    { id: "target", label: "Target", color: "#B3402A", vals: months.map(() => 3), planned: months.map(() => false), dashed: true },
  ];
  const markup = renderGeorgianMarkup(
    createElement(EditorialLineChart, {
      years: months,
      series,
      share: true,
      unit: UNIT_BN,
      shareLabel: "%",
      periodsPerYear: 12,
      formatPeriod: (period: number, kind: "axis" | "tooltip") => (kind === "axis" ? String(Math.floor(period / 12)) : `m${period}`),
    }),
  );

  it("prints formatted calendar-year labels", () => {
    const labels = [...markup.matchAll(/<text\b[^>]*>(\d{4})<\/text>/g)].map((match) => match[1]);
    expect(labels).toEqual(["2004", "2006", "2008", "2010", "2012", "2014", "2016", "2018", "2020", "2022", "2024", "2026"]);
  });

  it("dashes a reference series and leaves ordinary series solid", () => {
    expect(markup).toMatch(/data-testid="chart-series-target-dashed"[^>]*stroke-dasharray="6 5"/);
    expect(markup).not.toContain("chart-series-cpi-dashed");
  });

  it("spaces lattice columns by half-years", () => {
    const width = Number(/<pattern[^>]*\swidth="([\d.]+)"/.exec(markup)?.[1]);
    expect(width).toBeCloseTo((816 / 271) * 6, 3);
  });
});
```

(816 = the chart's `W − PAD_L − PAD_R` = 920 − 74 − 30.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/explorer/dotLattice.test.ts tests/explorer/periodAxis.test.ts tests/explorer/editorialLineChart.test.ts`
Expected: FAIL — `colOffset` undefined, `periodAxis` missing, monthly labels wrong.

- [ ] **Step 3: Extend `dotLattice.ts`**

Replace the file body below the header comment with:

```ts
export type DotLattice = { colPitch: number; rowPitch: number; colOffset: number };

const MIN_PITCH = 12;
const COLS_PER_YEAR = 2;
const ROWS_PER_STEP = 3;
// Sub-annual axes group periods into columns at calendar boundaries: the
// shortest span, from one month to a decade, whose pitch clears the floor.
const MONTH_SPANS = [1, 3, 6, 12, 24, 60, 120];

export function buildDotLattice(input: {
  plotWidth: number;
  plotHeight: number;
  yearCount: number;
  gridStepCount: number;
  /** Periods per calendar year on the x axis; 1 (years) unless monthly. */
  periodsPerYear?: number;
  /** The first plotted period, so month columns land on calendar boundaries. */
  firstPeriod?: number;
}): DotLattice | null {
  const { plotWidth, plotHeight, yearCount, gridStepCount, periodsPerYear = 1, firstPeriod = 0 } = input;
  if (plotWidth <= 0 || plotHeight <= 0 || yearCount <= 1 || gridStepCount <= 0) return null;

  const yearPitch = plotWidth / (yearCount - 1);
  const stepPitch = plotHeight / gridStepCount;

  // A dense domain (many gridline steps, or a long year axis) would turn the
  // subdivided lattice into a flat tone — fall back to one dot per interval.
  const rowPitch = stepPitch / ROWS_PER_STEP >= MIN_PITCH ? stepPitch / ROWS_PER_STEP : stepPitch;
  if (periodsPerYear === 1) {
    const colPitch = yearPitch / COLS_PER_YEAR >= MIN_PITCH ? yearPitch / COLS_PER_YEAR : yearPitch;
    return { colPitch, rowPitch, colOffset: 0 };
  }

  // On a sub-annual axis `yearCount` counts periods, so yearPitch is one period.
  const span = MONTH_SPANS.find((count) => yearPitch * count >= MIN_PITCH) ?? MONTH_SPANS.at(-1)!;
  const lead = (span - (((firstPeriod % span) + span) % span)) % span;
  return { colPitch: yearPitch * span, rowPitch, colOffset: lead * yearPitch };
}
```

Update the header comment's last sentence to: "…every third row sits on a labelled value and every second column on a year (or, on a monthly axis, on a calendar boundary)."

- [ ] **Step 4: Write `periodAxis.ts`**

```ts
// Which x-axis positions carry a label (DESIGN.md §8.3). Years keep the original
// rule: every ceil(n/12)-th year plus the last, dropping a regular label that
// would crowd the last one. Monthly axes label calendar-year starts, thinned to
// at most twelve; a view shorter than two calendar years labels evenly spaced
// months instead, because it has at most one January to stand on.
export function periodLabelIndices(periods: readonly number[], periodsPerYear = 1): number[] {
  const n = periods.length;
  const all = Array.from({ length: n }, (_, index) => index);
  const spaced = (step: number) => all.filter((index) => index === n - 1 || (index % step === 0 && n - 1 - index >= step));
  if (periodsPerYear === 1) return spaced(Math.max(1, Math.ceil(n / 12)));

  const yearStarts = all.filter((index) => periods[index]! % periodsPerYear === 0);
  if (yearStarts.length >= 2) {
    const step = Math.max(1, Math.ceil(yearStarts.length / 12));
    return yearStarts.filter((_, position) => position % step === 0);
  }
  return spaced(Math.max(1, Math.ceil(n / 6)));
}
```

Check the fallback expectation: n = 14 → step 3 → indices 0, 3, 6, 9 (12 is dropped: 13 − 12 = 1 < 3) and 13 → `[0, 3, 6, 9, 13]`. ✓

- [ ] **Step 5: Extend `EditorialLineChart`**

In `editorial-line-chart.tsx`:

1. `ChartSeries` gains, after `forecastFromYear?`:

```ts
  /** Reference lines (the NBG target) draw dashed and without an end dot. */
  dashed?: boolean;
```

2. Props type gains:

```ts
  /** Periods per calendar year on the x axis. Omit for years. */
  periodsPerYear?: number;
  /** Axis label or tooltip header for a period value. Omit to print the value. */
  formatPeriod?: (period: number, kind: "axis" | "tooltip") => string;
```

and the signature destructures `periodsPerYear = 1, formatPeriod`.

3. Import `periodLabelIndices` from `../../lib/explorer/periodAxis`. Replace `const labelStep = Math.max(1, Math.ceil(n / 12));` with:

```ts
  const labelIndices = new Set(periodLabelIndices(years, periodsPerYear));
```

4. `buildDotLattice({ … })` gains `periodsPerYear, firstPeriod: years[0]`; the pattern's `x` becomes `axisLeftPadding + lattice.colOffset - lattice.colPitch / 2`.

5. The axis-label loop becomes:

```tsx
        {years.map((year, index) => {
          if (!labelIndices.has(index)) return null;
          const isLast = index === n - 1;
          const anchor = index === 0 ? "start" : isLast ? "end" : "middle";
          const tx = index === 0 ? x(index) - 4 : isLast ? x(index) + 4 : x(index);

          return (
            <text key={`year-${year}`} x={tx} y={H - 8} fontSize={11} fill="#6A6050" textAnchor={anchor} style={{ fontFamily: "var(--font-numeric)" }}>
              {formatPeriod ? formatPeriod(year, "axis") : year}
            </text>
          );
        })}
```

6. The actual-path element: replace its `data-testid` spread and add the dash:

```tsx
                <path
                  {...(line.forecastFromYear !== undefined
                    ? { "data-testid": `chart-series-${line.id}-actual` }
                    : line.dashed
                      ? { "data-testid": `chart-series-${line.id}-dashed` }
                      : {})}
                  d={actualPath}
                  fill="none"
                  stroke={line.color}
                  strokeWidth={2.2}
                  strokeDasharray={line.dashed ? "6 5" : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
```

7. The end dot: `{line.dashed ? null : <circle cx={last[0]} cy={last[1]} r={3.5} fill={line.color} />}`.

8. Tooltip header: `<span>{formatPeriod ? formatPeriod(years[hover]!, "tooltip") : years[hover]}</span>`.

React omits `strokeDasharray={undefined}`, and `x(…) + 0` prints the same number, so year charts render unchanged.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/dotLattice.test.ts tests/explorer/periodAxis.test.ts tests/explorer/editorialLineChart.test.ts`
Expected: PASS, including every pre-existing test in these files.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/explorer/dotLattice.ts apps/web/lib/explorer/periodAxis.ts apps/web/components/main-explorer/editorial-line-chart.tsx apps/web/tests/explorer
git commit -m "feat(explorer): monthly period axis and dashed reference lines in the line chart" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Monthly range strip

**Files:**
- Modify: `apps/web/components/main-explorer/range-strip.tsx`
- Modify: `apps/web/lib/i18n/messages/ka/controls.json`, `apps/web/lib/i18n/messages/en/controls.json`
- Test: `apps/web/tests/explorer/rangeStrip.test.ts` (append)

**Interfaces:**
- Produces: `RangeStrip` props `periodsPerYear?: number`, `formatPeriod?: (period: number) => string`.
- Produces: `rangeChips(years: number[], min: number, periodsPerYear?: number): RangeChip[]` with `RangeChip = { key: "oneYear" | "fiveYears" | "tenYears" | "allYears"; start: number }`.
- Produces: `stepRangeHandle(key: string, handle: "start" | "end", range: ResolvedRange, periodsPerYear?: number): number | null`.
- Messages: `controls.oneYear`, `controls.monthRange`, `controls.startMonth`, `controls.endMonth`.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/tests/explorer/rangeStrip.test.ts` (add `rangeChips, stepRangeHandle` to the existing import):

```ts
describe("range strip monthly periods", () => {
  const months = Array.from({ length: 272 }, (_, index) => 2004 * 12 + index);
  const label = (period: number) => `${Math.floor(period / 12)}-${String((period % 12) + 1).padStart(2, "0")}`;

  it("keeps the year chips exactly as before", () => {
    const years = Array.from({ length: 22 }, (_, index) => 2004 + index);
    expect(rangeChips(years, 2004)).toEqual([
      { key: "fiveYears", start: 2021 },
      { key: "tenYears", start: 2016 },
      { key: "allYears", start: 2004 },
    ]);
  });

  it("counts the monthly chips in months, including a one-year chip", () => {
    expect(rangeChips(months, months[0]!, 12).map((chip) => [chip.key, label(chip.start)])).toEqual([
      ["oneYear", "2025-09"],
      ["fiveYears", "2021-09"],
      ["tenYears", "2016-09"],
      ["allYears", "2004-01"],
    ]);
  });

  it("steps a month with arrows and a year with Page keys, monthly only", () => {
    const range = { start: months[100]!, end: months[200]!, min: months[0]!, max: months.at(-1)! };
    expect(stepRangeHandle("ArrowLeft", "start", range, 12)).toBe(months[99]);
    expect(stepRangeHandle("ArrowUp", "end", range, 12)).toBe(months[201]);
    expect(stepRangeHandle("PageUp", "end", range, 12)).toBe(months[212]);
    expect(stepRangeHandle("PageDown", "start", range, 12)).toBe(months[88]);
    expect(stepRangeHandle("Home", "end", range, 12)).toBe(range.start);
    expect(stepRangeHandle("PageUp", "start", { start: 2010, end: 2020, min: 2004, max: 2025 })).toBeNull();
    expect(stepRangeHandle("ArrowRight", "start", { start: 2010, end: 2010, min: 2004, max: 2025 })).toBe(2010);
  });

  it("prints formatted periods in the readout, the ends and the slider values", () => {
    const markup = renderGeorgianMarkup(
      createElement(RangeStrip, {
        years: months,
        range: { start: months[0]!, end: months.at(-1)!, min: months[0]!, max: months.at(-1)! },
        onChange: () => {},
        periodsPerYear: 12,
        formatPeriod: label,
      }),
      { "controls.oneYear": "1წ", "controls.startMonth": "საწყისი თვე", "controls.endMonth": "საბოლოო თვე", "controls.monthRange": "თვეების დიაპაზონი" },
    );
    expect(markup).toContain("2004-01–2026-08");
    expect(markup).toContain('aria-valuetext="2026-08"');
    expect(markup).toContain('aria-label="საწყისი თვე"');
    expect(markup).toContain(">1წ<");
  });
});
```

The helper `renderGeorgianMarkup` loads the committed `controls.json`, so once Step 4 adds the keys the extra-messages argument is redundant but harmless.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/explorer/rangeStrip.test.ts`
Expected: FAIL — `rangeChips` is not exported.

- [ ] **Step 3: Extend `range-strip.tsx`**

Add, above the component:

```ts
export type RangeChip = { key: "oneYear" | "fiveYears" | "tenYears" | "allYears"; start: number };

// Year strips keep 5წ/10წ/ყველა: every budget indicator is a start-to-end delta,
// so a one-year range zeroes them. Monthly strips add 1წ — twelve months is the
// natural inflation window and nothing on that page is a range delta.
export function rangeChips(years: number[], min: number, periodsPerYear = 1): RangeChip[] {
  const back = (count: number) => years[Math.max(years.length - count, 0)] ?? min;
  const spans: Array<[RangeChip["key"], number]> =
    periodsPerYear === 1 ? [["fiveYears", 5], ["tenYears", 10]] : [["oneYear", 12], ["fiveYears", 60], ["tenYears", 120]];
  return [
    ...spans.filter(([, count]) => years.length > count).map(([key, count]) => ({ key, start: back(count) })),
    { key: "allYears", start: min },
  ];
}

export function stepRangeHandle(key: string, handle: Handle, range: ResolvedRange, periodsPerYear = 1): number | null {
  let delta: number | "home" | "end";
  if (key === "ArrowLeft" || key === "ArrowDown") delta = -1;
  else if (key === "ArrowRight" || key === "ArrowUp") delta = 1;
  else if (key === "PageDown" && periodsPerYear > 1) delta = -periodsPerYear;
  else if (key === "PageUp" && periodsPerYear > 1) delta = periodsPerYear;
  else if (key === "Home") delta = "home";
  else if (key === "End") delta = "end";
  else return null;

  const { start, end, min, max } = range;
  const clamp = (value: number, lo: number, hi: number) => Math.min(Math.max(value, lo), hi);
  if (handle === "start") return delta === "home" ? min : delta === "end" ? end : clamp(start + delta, min, end);
  return delta === "home" ? start : delta === "end" ? max : clamp(end + delta, start, max);
}
```

Move `type Handle = "start" | "end";` above these helpers. Then in the component:

- Props: add `periodsPerYear?: number;` and `formatPeriod?: (period: number) => string;`; destructure `periodsPerYear = 1, formatPeriod`; add `const format = formatPeriod ?? String;` and `const monthly = periodsPerYear > 1;`.
- Replace the `chips` constant with:

```ts
  const chips = rangeChips(years, min, periodsPerYear).map((chip) => ({ label: message(messages, `controls.${chip.key}`), start: chip.start }));
```

- Replace `handleKey`'s body with:

```ts
    const next = stepRangeHandle(event.key, handle, range, periodsPerYear);
    if (next === null) return;
    event.preventDefault();
    onChange(handle === "start" ? { start: next } : { end: next });
```

- Readout: `{format(start)}–{format(end)}`; end labels `{format(min)}` and `{format(max)}`; `aria-valuetext={format(start)}` and `aria-valuetext={format(end)}`.
- Labels: rail `aria-label={message(messages, monthly ? "controls.monthRange" : "controls.yearRange")}`; handles `controls.startMonth` / `controls.endMonth` when `monthly`, otherwise the existing year keys.

Update the component's header comment to mention the monthly chips.

- [ ] **Step 4: Add the messages**

`lib/i18n/messages/ka/controls.json`: `"controls.oneYear": "1წ"`, `"controls.monthRange": "თვეების დიაპაზონი"`, `"controls.startMonth": "საწყისი თვე"`, `"controls.endMonth": "საბოლოო თვე"`.
`lib/i18n/messages/en/controls.json`: `"controls.oneYear": "1y"`, `"controls.monthRange": "Month range"`, `"controls.startMonth": "Start month"`, `"controls.endMonth": "End month"`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/rangeStrip.test.ts`
Expected: PASS, including the existing chip and marker tests. Then `npm run i18n:check` — expected: valid.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/main-explorer/range-strip.tsx apps/web/lib/i18n/messages apps/web/tests/explorer/rangeStrip.test.ts
git commit -m "feat(explorer): monthly range strip with 1y chip and year steps" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Dashed swatch and shared KPI blocks

**Files:**
- Modify: `apps/web/components/main-explorer/series-selector.tsx`
- Create: `apps/web/components/main-explorer/kpi-blocks.tsx`
- Modify: `apps/web/components/main-explorer/indicators.tsx`
- Test: `apps/web/tests/explorer/seriesSelector.test.ts` (append), `apps/web/tests/explorer/kpiBlocks.test.tsx` (new)

**Interfaces:**
- Produces: `SeriesSelectorRow` prop `swatch?: "solid" | "dashed"` (default `"solid"`).
- Produces: `HeroKpi({ label: string; value: string; valueColor?: string; children: ReactNode })`, `SideKpi = { label: string; value: string; unit: string; color: string; detail: string; spark: { values: (number | null)[]; color: string } | null }`, `SideKpiList({ kpis: SideKpi[] })`.

- [ ] **Step 1: Capture the budget Indicators markup before refactoring**

Create a throwaway guard (deleted in Step 7) `apps/web/tests/explorer/indicators-refactor-guard.test.tsx`:

```tsx
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { Indicators } from "../../components/main-explorer/indicators";
import type { ExplorerModel } from "../../lib/explorer/explorerData";
import type { ExplorerTableRow } from "../../lib/explorer/types";
import main from "../../lib/i18n/messages/ka/main.json";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const row = (itemId: string, values: Record<number, number>, change: number): ExplorerTableRow => ({
  itemId, parentItemId: null, level: "public_field", kaLabel: itemId, enLabel: itemId, color: "#B3402A",
  basisByYear: {}, valuesByYear: values, shareByYear: { 2020: 0.1, 2025: 0.12 }, change,
});
const rows = [row("spending.health", { 2020: 100, 2025: 180 }, 0.8), row("spending.education", { 2020: 200, 2025: 210 }, 0.05)];
const model = { years: [2020, 2021, 2022, 2023, 2024, 2025], totalRow: row("expenditure.total", { 2020: 300, 2025: 390 }, 0.3), comparisonRows: rows, topGrowth: rows, bottomGrowth: [...rows].reverse() } as unknown as ExplorerModel;
const file = path.join(os.tmpdir(), "indicators-before.html");

it("budget Indicators markup is unchanged by the extraction", () => {
  const markup = renderGeorgianMarkup(<Indicators model={model} scope="fields" />, main);
  if (process.env.CAPTURE === "1") fs.writeFileSync(file, markup);
  else expect(markup).toBe(fs.readFileSync(file, "utf8"));
});
```

Run: `CAPTURE=1 npx vitest run tests/explorer/indicators-refactor-guard.test.tsx` — expected: PASS and the file written.

- [ ] **Step 2: Write the failing tests**

Append to `apps/web/tests/explorer/seriesSelector.test.ts`:

```ts
describe("series selector reference rows", () => {
  const render = (swatch?: "solid" | "dashed") =>
    renderGeorgianMarkup(createElement(SeriesSelectorRow, { id: "target", label: "მიზნობრივი მაჩვენებელი", color: "#B3402A", value: "3.0%", selected: true, swatch, onToggle: () => {} }));

  it("draws a dashed swatch for a reference row", () => {
    expect(render("dashed")).toMatch(/data-testid="series-swatch"[^]*stroke-dasharray="4 2"/);
  });

  it("keeps the solid swatch by default", () => {
    expect(render()).not.toContain("stroke-dasharray");
  });
});
```

`apps/web/tests/explorer/kpiBlocks.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { HeroKpi, SideKpiList } from "../../components/main-explorer/kpi-blocks";
import { renderGeorgianMarkup } from "../helpers/render-localized";

describe("KPI blocks", () => {
  it("renders the hero label, value and caller-owned body", () => {
    const markup = renderGeorgianMarkup(<HeroKpi label="წლიური ინფლაცია" value="5.6%"><p>body</p></HeroKpi>);
    expect(markup).toContain("წლიური ინფლაცია");
    expect(markup).toContain(">5.6%<");
    expect(markup).toContain("<p>body</p>");
  });

  it("renders one side KPI per entry with an optional sparkline", () => {
    const markup = renderGeorgianMarkup(
      <SideKpiList kpis={[
        { label: "საბაზო", value: "3.8%", unit: "", color: "var(--ink)", detail: "წლიური", spark: { values: [1, 2, 3], color: "#3D5A98" } },
        { label: "თვიური", value: "+0.4%", unit: "", color: "var(--ink)", detail: "ივლისთან", spark: null },
      ]} />,
    );
    expect(markup.match(/data-testid="side-kpi"/g)).toHaveLength(2);
    expect(markup.match(/<svg/g)).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run tests/explorer/seriesSelector.test.ts tests/explorer/kpiBlocks.test.tsx`
Expected: FAIL — no `stroke-dasharray`; `kpi-blocks` missing.

- [ ] **Step 4: Add the dashed swatch**

In `series-selector.tsx`, add `swatch?: "solid" | "dashed";` to `SeriesSelectorRowProps`, destructure `swatch = "solid"`, and replace the swatch span's child:

```tsx
          <span data-testid="series-swatch" className="mt-[7px] flex-none">
            {swatch === "dashed" ? <DashedSwatch color={color} /> : <SwatchBar color={color} />}
          </span>
```

with, below the component:

```tsx
// Reference rows (a target, not a series) match their dashed chart line.
function DashedSwatch({ color }: { color: string }) {
  return (
    <svg aria-hidden width={14} height={3} className="block flex-none">
      <line x1={0} y1={1.5} x2={14} y2={1.5} stroke={color} strokeWidth={3} strokeDasharray="4 2" />
    </svg>
  );
}
```

- [ ] **Step 5: Extract the KPI blocks**

`apps/web/components/main-explorer/kpi-blocks.tsx` — the markup is moved verbatim from `indicators.tsx`:

```tsx
import type { ReactNode } from "react";
import { Overline } from "../ui/editorial";
import { Sparkline } from "../ui/sparkline";

// The two presentational halves of ძირითადი ინდიკატორები (DESIGN.md §8.5),
// shared by the budget Indicators and the inflation overview. Callers own the
// figures, the gauge and the sentence; these own the anatomy.

export function HeroKpi({ label, value, valueColor = "var(--ink)", children }: { label: string; value: string; valueColor?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 @min-[1100px]:pr-11">
      <Overline>{label}</Overline>
      <p
        className="mt-3.5 whitespace-nowrap font-[family-name:var(--font-display)] text-[44px] font-semibold leading-none tracking-[-0.02em] min-[768px]:text-[62px]"
        style={{ color: valueColor }}
      >
        {value}
      </p>
      <div className="mt-7 max-w-[480px]">{children}</div>
    </div>
  );
}

export type SideKpi = {
  label: string;
  value: string;
  unit: string;
  color: string;
  detail: string;
  spark: { values: (number | null)[]; color: string } | null;
};

export function SideKpiList({ kpis }: { kpis: SideKpi[] }) {
  return (
    <div className="mt-[26px] flex min-w-0 flex-col border-t border-[var(--hairline)] pt-[18px] @min-[1100px]:mt-0 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:pt-0 @min-[1100px]:pl-9">
      {kpis.map((kpi, index) => (
        <div
          key={kpi.label}
          data-testid="side-kpi"
          className={index === 0 ? "pt-0.5 pb-3.5" : index === kpis.length - 1 ? "border-t border-[var(--hairline-soft)] pt-3.5" : "border-t border-[var(--hairline-soft)] py-3.5"}
        >
          <Overline>{kpi.label}</Overline>
          <div className="mt-[7px] flex items-baseline justify-between gap-4">
            <p
              className="whitespace-nowrap font-[family-name:var(--font-display)] text-2xl font-semibold leading-[1.1] tracking-[-0.02em]"
              style={{ color: kpi.color }}
            >
              {kpi.value}
              {kpi.unit ? (
                <span className="ml-1.5 font-[family-name:var(--font-numeric)] text-xs font-medium tracking-normal text-[var(--body)]">
                  {kpi.unit}
                </span>
              ) : null}
            </p>
            <p title={kpi.detail} className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-right text-xs text-[var(--muted)]">
              {kpi.detail}
            </p>
          </div>
          {kpi.spark ? <Sparkline values={kpi.spark.values} color={kpi.spark.color} /> : null}
        </div>
      ))}
    </div>
  );
}
```

In `indicators.tsx`: import `HeroKpi, SideKpiList` from `./kpi-blocks`; replace the non-single-year hero `<div className="min-w-0 @min-[1100px]:pr-11">…</div>` with

```tsx
        <HeroKpi
          label={message(messages, "main.periodChange")}
          value={formatShare(totalChange, true)}
          valueColor={totalChange !== null && totalChange < 0 ? NEGATIVE : "var(--ink)"}
        >
          {/* the gauge bar, its two year labels and the sentence, moved unchanged
              from the old <div className="mt-7 max-w-[480px]"> */}
        </HeroKpi>
```

(the children are exactly the three blocks that were inside `mt-7 max-w-[480px]`), and replace the side-KPI column `<div className="mt-[26px] flex min-w-0 …">…</div>` with `<SideKpiList kpis={sideKpis} />`. Remove the now-unused `Sparkline` and `Overline` imports (keep `SectionTitle`, `SwatchBar`). Leave the single-year note, movers and comparison untouched.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/indicators-refactor-guard.test.tsx tests/explorer/kpiBlocks.test.tsx tests/explorer/seriesSelector.test.ts tests/explorer/indicators.test.ts`
Expected: PASS — the guard proves the budget markup is byte-identical.

- [ ] **Step 7: Delete the guard and commit**

```bash
rm apps/web/tests/explorer/indicators-refactor-guard.test.tsx
git add apps/web/components/main-explorer apps/web/tests/explorer
git commit -m "refactor(explorer): share hero and side KPI blocks; dashed reference swatch" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Inflation page model, labels and messages

**Files:**
- Create: `apps/web/lib/explorer/inflationOverview.ts`
- Create: `apps/web/lib/explorer/inflationLabels.ts`
- Create: `apps/web/lib/i18n/messages/ka/inflation.json`, `apps/web/lib/i18n/messages/en/inflation.json`
- Modify: `apps/web/lib/i18n/types.ts`, `apps/web/lib/i18n/messages.server.ts`
- Test: `apps/web/tests/explorer/inflationOverview.test.ts`

**Interfaces:**
- Consumes: `loadServedInflationData` (Task 4), periods (Task 2).
- Produces (all in `inflationOverview.ts`):
  - `INFLATION_TABS = ["yoy", "mom", "index"]`, `InflationTab`; `INFLATION_SERIES = ["cpi", "core", "core_ex_tobacco"]`, `InflationSeriesKey`; `InflationSelectionKey = InflationSeriesKey | "target"`; `SELECTION_ORDER: InflationSelectionKey[]`; `INFLATION_COLORS: Record<InflationSelectionKey, string>`.
  - `InflationState = { tab: InflationTab; mode: "line" | "table"; range: { kind: "all" } | { kind: "manual"; start: number; end: number }; selected: InflationSelectionKey[]; tableSeries: InflationSeriesKey | null }`, `DEFAULT_INFLATION_STATE`.
  - `InflationIndex = { values: Map<string, Map<number, number>>; sourceIds: Map<string, string> }`, `indexInflationFacts(facts)`, `seriesGroup(key, tab)`, `seriesValues(index, key, tab)`.
  - `ResolvedPeriodRange = { min; max; start; end }`, `tabCoverage(index, tab)`, `overallCoverage(index)`, `resolveInflationRange(state, index)`, `changeInflationTab(state, tab, index)`, `rangeFromPatch(range, patch)`.
  - `targetForPeriod(targets, period): number | null`.
  - `buildInflationLines(index, targets, state, range) → { periods: number[]; lines: Array<{ key: InflationSelectionKey; values: (number | null)[] }> }`.
  - `headlinePoint(index, state, range) → { period; value } | null`, `panelValue(index, targets, key, state, range): number | null`.
  - `toggleSelection(state, key)`, `tableSeriesOptions(index, state)`, `effectiveTableSeries(index, state)`.
  - `latestIndicators(index, targets) → { period; yoy; coreYoy; mom; avg12; target; sparks: { coreYoy; mom; avg12 } } | null`.
  - `parseInflationHash(hash)`, `serializeInflationHash(state)`.
- Produces (`inflationLabels.ts`): `MONTH_NUMBERS`, `periodLabel(messages, period, "long" | "short")`, `seriesLabel(messages, key, tab)`, `formatInflationValue(value, tab)`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/inflationOverview.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { makePeriod, periodFromKey } from "../../lib/data/inflation/periods";
import type { ServedCpiFact, ServedInflationTargetRow } from "../../lib/data/inflation/types";
import {
  DEFAULT_INFLATION_STATE, buildInflationLines, changeInflationTab, effectiveTableSeries, headlinePoint, indexInflationFacts,
  latestIndicators, panelValue, parseInflationHash, resolveInflationRange, serializeInflationHash, targetForPeriod, toggleSelection,
  type InflationIndex, type InflationState,
} from "../../lib/explorer/inflationOverview";
import { formatInflationValue, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import { getMessages } from "../../lib/i18n/messages.server";

let facts: ServedCpiFact[];
let targets: ServedInflationTargetRow[];
let index: InflationIndex;
let last: number;

beforeAll(async () => {
  ({ facts, targets } = await loadServedInflationData());
  index = indexInflationFacts(facts);
  last = Math.max(...facts.map((fact) => periodFromKey(fact.period)));
});

const manual = (start: string, end: string): InflationState["range"] => ({ kind: "manual", start: periodFromKey(start), end: periodFromKey(end) });

describe("inflation overview state", () => {
  it("defaults to annual inflation over its full coverage with headline and target", () => {
    const range = resolveInflationRange(DEFAULT_INFLATION_STATE, index);
    expect(range).toEqual({ min: makePeriod(2004, 1), max: last, start: makePeriod(2004, 1), end: last });
    expect(DEFAULT_INFLATION_STATE.selected).toEqual(["cpi", "target"]);
    expect(resolveInflationRange({ ...DEFAULT_INFLATION_STATE, tab: "index" }, index).min).toBe(makePeriod(2000, 1));
  });

  it("keeps All, intersects a manual range and falls back when nothing overlaps", () => {
    expect(changeInflationTab(DEFAULT_INFLATION_STATE, "index", index).range).toEqual({ kind: "all" });
    const onIndex = { ...DEFAULT_INFLATION_STATE, tab: "index" as const, range: manual("2001-01", "2005-12") };
    expect(changeInflationTab(onIndex, "yoy", index).range).toEqual(manual("2004-01", "2005-12"));
    expect(changeInflationTab({ ...onIndex, range: manual("2000-01", "2002-12") }, "yoy", index).range).toEqual({ kind: "all" });
  });

  it("draws the target only on annual inflation and never draws core on the index", () => {
    const yoy = buildInflationLines(index, targets, { ...DEFAULT_INFLATION_STATE, selected: ["cpi", "core", "target"] }, resolveInflationRange(DEFAULT_INFLATION_STATE, index));
    expect(yoy.lines.map((line) => line.key)).toEqual(["cpi", "core", "target"]);
    const target = yoy.lines.find((line) => line.key === "target")!;
    expect(target.values[yoy.periods.indexOf(makePeriod(2014, 12))]).toBeNull();
    expect(target.values[yoy.periods.indexOf(makePeriod(2016, 6))]).toBe(5);
    expect(target.values.at(-1)).toBe(3);

    const indexState = { ...DEFAULT_INFLATION_STATE, tab: "index" as const, selected: ["cpi", "core", "target"] as InflationState["selected"] };
    expect(buildInflationLines(index, targets, indexState, resolveInflationRange(indexState, index)).lines.map((line) => line.key)).toEqual(["cpi"]);
    expect(panelValue(index, targets, "core", indexState, resolveInflationRange(indexState, index))).toBeNull();
  });

  it("reads the headline line at the last month of the active range", () => {
    const all = resolveInflationRange(DEFAULT_INFLATION_STATE, index);
    const yoyLast = facts.find((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct" && periodFromKey(fact.period) === last)!;
    expect(headlinePoint(index, DEFAULT_INFLATION_STATE, all)).toEqual({ period: last, value: yoyLast.value });
    const to2025 = { ...DEFAULT_INFLATION_STATE, range: manual("2020-01", "2025-12") };
    expect(headlinePoint(index, to2025, resolveInflationRange(to2025, index))?.period).toBe(makePeriod(2025, 12));
  });

  it("toggles selection, keeps the table series among selected series, and round-trips the hash", () => {
    const withCore = toggleSelection(DEFAULT_INFLATION_STATE, "core");
    expect(withCore.selected).toEqual(["cpi", "core", "target"]);
    expect(toggleSelection(withCore, "cpi").selected).toEqual(["core", "target"]);
    expect(effectiveTableSeries(index, withCore)).toBe("cpi");
    expect(effectiveTableSeries(index, { ...withCore, tableSeries: "core" })).toBe("core");
    expect(effectiveTableSeries(index, { ...withCore, tab: "index", tableSeries: "core" })).toBe("cpi");

    const state: InflationState = { tab: "mom", mode: "table", range: manual("2015-03", "2019-10"), selected: ["core", "target"], tableSeries: "core" };
    expect(serializeInflationHash(state)).toBe("i=mom&m=table&r=2015-03-2019-10&sel=core%2Ctarget&t=core");
    expect(parseInflationHash(`#${serializeInflationHash(state)}`)).toEqual(state);
    expect(parseInflationHash("#i=bad&m=x&r=nope&sel=cpi,cpi,junk")).toEqual({ ...DEFAULT_INFLATION_STATE, selected: ["cpi"] });
    expect(parseInflationHash("#sel=").selected).toEqual([]);
    expect(parseInflationHash("#r=2019-10-2015-03").range).toEqual(manual("2015-03", "2019-10"));
  });

  it("reports the latest published month for the indicators, with the target in force", () => {
    const latest = latestIndicators(index, targets)!;
    expect(latest.period).toBe(last);
    expect(latest.target).toBe(targetForPeriod(targets, last));
    expect(latest.sparks.mom).toHaveLength(36);
    expect(latest.sparks.coreYoy.at(-1)).toBe(latest.coreYoy);
    expect(targetForPeriod(targets, makePeriod(2014, 12))).toBeNull();
    expect(targetForPeriod(targets, makePeriod(2017, 6))).toBe(4);
  });
});

describe("inflation labels", () => {
  it("names months, series and values in both languages", async () => {
    const ka = await getMessages("ka", ["inflation"]);
    const en = await getMessages("en", ["inflation"]);
    expect(periodLabel(ka, makePeriod(2026, 8), "long")).toBe("აგვისტო 2026");
    expect(periodLabel(en, makePeriod(2026, 8), "short")).toBe("Aug 2026");
    expect(seriesLabel(ka, "cpi", "yoy")).toBe("საერთო ინფლაცია");
    expect(seriesLabel(ka, "cpi", "index")).toBe("სამომხმარებლო ფასების ინდექსი");
    expect(seriesLabel(en, "core_ex_tobacco", "mom")).toBe("Core excluding tobacco");
    expect(formatInflationValue(5.6479, "yoy")).toBe("5.6%");
    expect(formatInflationValue(0.4049, "mom")).toBe("+0.4%");
    expect(formatInflationValue(-0.31, "mom")).toBe("−0.3%");
    expect(formatInflationValue(196.1968, "index")).toBe("196.2");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/explorer/inflationOverview.test.ts`
Expected: FAIL — module `inflationOverview` missing.

- [ ] **Step 3: Register the message scope and write the messages**

`lib/i18n/types.ts`: add `"inflation"` to `MESSAGE_SCOPES`. `lib/i18n/messages.server.ts`: add `inflation: () => import("./messages/ka/inflation.json"),` to `ka` and the `en` equivalent.

`lib/i18n/messages/ka/inflation.json`:

```json
{
  "inflation.heading": "ინფლაციის მიმოხილვა",
  "inflation.hubHeading": "ინფლაცია საქართველოში",
  "inflation.hubDescription": "სამომხმარებლო ფასების ცვლილება საქართველოში — საქსტატის ყოველთვიური მონაცემები და ეროვნული ბანკის მიზნობრივი მაჩვენებელი.",
  "inflation.description": "წლიური და თვიური ინფლაცია და ფასების ინდექსი — საერთო და საბაზო ინფლაცია ეროვნული ბანკის მიზნობრივ მაჩვენებელთან შედარებით.",
  "inflation.hubMetaTitle": "ინფლაცია საქართველოში | Fiscal.ge",
  "inflation.metaTitle": "ინფლაციის მიმოხილვა {first}–{last} | Fiscal.ge",
  "inflation.tab.yoy": "წლიური ინფლაცია",
  "inflation.tab.mom": "თვიური ინფლაცია",
  "inflation.tab.index": "ფასების ინდექსი",
  "inflation.tabs": "მაჩვენებელი",
  "inflation.unit.yoy": "პროცენტი · წინა წლის შესაბამის თვესთან შედარებით",
  "inflation.unit.mom": "პროცენტი · წინა თვესთან შედარებით",
  "inflation.unit.index": "ინდექსი · 2010 წლის საშუალო = 100",
  "inflation.workbookUnit.yoy": "% · წინა წლის შესაბამის თვესთან შედარებით",
  "inflation.workbookUnit.mom": "% · წინა თვესთან შედარებით",
  "inflation.workbookUnit.index": "ინდექსი, 2010 წლის საშუალო = 100",
  "inflation.series.cpi": "საერთო ინფლაცია",
  "inflation.series.cpiIndex": "სამომხმარებლო ფასების ინდექსი",
  "inflation.series.core": "საბაზო ინფლაცია",
  "inflation.series.core_ex_tobacco": "საბაზო, თამბაქოს გარეშე",
  "inflation.series.target": "მიზნობრივი მაჩვენებელი",
  "inflation.gaugeTarget": "მიზანი {target}",
  "inflation.heroRise": "{monthIn} ფასები წინა წლის {monthWith} შედარებით {value}-ით გაიზარდა.",
  "inflation.heroFall": "{monthIn} სამომხმარებლო კალათა წინა წლის {monthWith} შედარებით {value}-ით გაიაფდა.",
  "inflation.targetAbove": "ეს ეროვნული ბანკის {target}-იან მიზნობრივ მაჩვენებელზე {delta}-ით მეტია.",
  "inflation.targetBelow": "ეს ეროვნული ბანკის {target}-იან მიზნობრივ მაჩვენებელზე {delta}-ით ნაკლებია.",
  "inflation.targetAt": "ეს ეროვნული ბანკის {target}-იანი მიზნობრივი მაჩვენებლის ტოლია.",
  "inflation.coreSentence": "საბაზო ინფლაცია {core}-ია.",
  "inflation.kpiCore": "საბაზო ინფლაცია",
  "inflation.kpiCoreDetail": "წლიური",
  "inflation.kpiMonthly": "თვიური ინფლაცია",
  "inflation.kpiMonthlyDetail": "{monthWith} შედარებით",
  "inflation.kpiAvg12": "12-თვის საშუალო",
  "inflation.kpiAvg12Detail": "ბოლო 12 თვე წინა 12 თვესთან",
  "inflation.pp": "პპ",
  "inflation.year": "წელი",
  "inflation.month": "თვე",
  "inflation.seriesYear": "სერია — წელი",
  "inflation.seriesColumn": "სერია",
  "inflation.value": "მნიშვნელობა",
  "inflation.unitColumn": "ერთეული",
  "inflation.status": "სტატუსი",
  "inflation.published": "გამოქვეყნებული",
  "inflation.annualAverage": "წლის საშუალო",
  "inflation.tableCaption": "{series} · {tab} · {unit}, {start} – {end}",
  "inflation.tableSeries": "ცხრილის სერია",
  "inflation.legend": "ფერის სკალა",
  "inflation.rangeChanged": "პერიოდი: {start} – {end}",
  "inflation.source": "მონაცემები: საქართველოს სტატისტიკის ეროვნული სამსახური (საქსტატი), სამომხმარებლო ფასების ინდექსი; მიზნობრივი მაჩვენებელი — საქართველოს ეროვნული ბანკი.",
  "inflation.methodology": "მეთოდოლოგია და წყაროები",
  "inflation.cardCategories": "კატეგორიები",
  "inflation.cardCategoriesDescription": "ფასების ცვლილება საქონლისა და მომსახურების ჯგუფების მიხედვით.",
  "inflation.cardBasket": "სამომხმარებლო კალათა",
  "inflation.cardBasketDescription": "კალათის შემადგენლობა და წონები.",
  "inflation.cardCities": "ქალაქები",
  "inflation.cardCitiesDescription": "ინფლაცია საქართველოს ქალაქებში.",
  "inflation.cardProducts": "პროდუქტები",
  "inflation.cardProductsDescription": "ცალკეული პროდუქტების ფასების ცვლილება.",
  "inflation.month.1": "იანვარი", "inflation.month.2": "თებერვალი", "inflation.month.3": "მარტი", "inflation.month.4": "აპრილი",
  "inflation.month.5": "მაისი", "inflation.month.6": "ივნისი", "inflation.month.7": "ივლისი", "inflation.month.8": "აგვისტო",
  "inflation.month.9": "სექტემბერი", "inflation.month.10": "ოქტომბერი", "inflation.month.11": "ნოემბერი", "inflation.month.12": "დეკემბერი",
  "inflation.monthShort.1": "იან", "inflation.monthShort.2": "თებ", "inflation.monthShort.3": "მარ", "inflation.monthShort.4": "აპრ",
  "inflation.monthShort.5": "მაი", "inflation.monthShort.6": "ივნ", "inflation.monthShort.7": "ივლ", "inflation.monthShort.8": "აგვ",
  "inflation.monthShort.9": "სექ", "inflation.monthShort.10": "ოქტ", "inflation.monthShort.11": "ნოე", "inflation.monthShort.12": "დეკ",
  "inflation.monthIn.1": "იანვარში", "inflation.monthIn.2": "თებერვალში", "inflation.monthIn.3": "მარტში", "inflation.monthIn.4": "აპრილში",
  "inflation.monthIn.5": "მაისში", "inflation.monthIn.6": "ივნისში", "inflation.monthIn.7": "ივლისში", "inflation.monthIn.8": "აგვისტოში",
  "inflation.monthIn.9": "სექტემბერში", "inflation.monthIn.10": "ოქტომბერში", "inflation.monthIn.11": "ნოემბერში", "inflation.monthIn.12": "დეკემბერში",
  "inflation.monthWith.1": "იანვართან", "inflation.monthWith.2": "თებერვალთან", "inflation.monthWith.3": "მარტთან", "inflation.monthWith.4": "აპრილთან",
  "inflation.monthWith.5": "მაისთან", "inflation.monthWith.6": "ივნისთან", "inflation.monthWith.7": "ივლისთან", "inflation.monthWith.8": "აგვისტოსთან",
  "inflation.monthWith.9": "სექტემბერთან", "inflation.monthWith.10": "ოქტომბერთან", "inflation.monthWith.11": "ნოემბერთან", "inflation.monthWith.12": "დეკემბერთან"
}
```

`lib/i18n/messages/en/inflation.json` — the same keys:

```json
{
  "inflation.heading": "Inflation overview",
  "inflation.hubHeading": "Inflation in Georgia",
  "inflation.hubDescription": "How consumer prices change in Georgia — Geostat's monthly figures and the National Bank of Georgia's inflation target.",
  "inflation.description": "Annual and monthly inflation and the price index — headline and core inflation against the National Bank of Georgia's target.",
  "inflation.hubMetaTitle": "Inflation in Georgia | Fiscal.ge",
  "inflation.metaTitle": "Inflation overview {first}–{last} | Fiscal.ge",
  "inflation.tab.yoy": "Annual inflation",
  "inflation.tab.mom": "Monthly inflation",
  "inflation.tab.index": "Price index",
  "inflation.tabs": "Indicator",
  "inflation.unit.yoy": "Percent · change on the same month of the previous year",
  "inflation.unit.mom": "Percent · change on the previous month",
  "inflation.unit.index": "Index · 2010 average = 100",
  "inflation.workbookUnit.yoy": "% · change on the same month of the previous year",
  "inflation.workbookUnit.mom": "% · change on the previous month",
  "inflation.workbookUnit.index": "Index, 2010 average = 100",
  "inflation.series.cpi": "Headline inflation",
  "inflation.series.cpiIndex": "Consumer price index",
  "inflation.series.core": "Core inflation",
  "inflation.series.core_ex_tobacco": "Core excluding tobacco",
  "inflation.series.target": "Inflation target",
  "inflation.gaugeTarget": "Target {target}",
  "inflation.heroRise": "In {monthIn}, prices were {value} higher than a year earlier.",
  "inflation.heroFall": "In {monthIn}, the consumer basket was {value} cheaper than a year earlier.",
  "inflation.targetAbove": "That is {delta} above the National Bank of Georgia's {target} target.",
  "inflation.targetBelow": "That is {delta} below the National Bank of Georgia's {target} target.",
  "inflation.targetAt": "That equals the National Bank of Georgia's {target} target.",
  "inflation.coreSentence": "Core inflation was {core}.",
  "inflation.kpiCore": "Core inflation",
  "inflation.kpiCoreDetail": "annual",
  "inflation.kpiMonthly": "Monthly inflation",
  "inflation.kpiMonthlyDetail": "vs {monthWith}",
  "inflation.kpiAvg12": "12-month average",
  "inflation.kpiAvg12Detail": "last 12 months vs previous 12",
  "inflation.pp": "pp",
  "inflation.year": "Year",
  "inflation.month": "Month",
  "inflation.seriesYear": "Series — year",
  "inflation.seriesColumn": "Series",
  "inflation.value": "Value",
  "inflation.unitColumn": "Unit",
  "inflation.status": "Status",
  "inflation.published": "Published",
  "inflation.annualAverage": "Annual average",
  "inflation.tableCaption": "{series} · {tab} · {unit}, {start} – {end}",
  "inflation.tableSeries": "Table series",
  "inflation.legend": "Colour scale",
  "inflation.rangeChanged": "Period: {start} – {end}",
  "inflation.source": "Data: National Statistics Office of Georgia (Geostat), consumer price index; inflation target — National Bank of Georgia.",
  "inflation.methodology": "Methodology and sources",
  "inflation.cardCategories": "Categories",
  "inflation.cardCategoriesDescription": "Price change by group of goods and services.",
  "inflation.cardBasket": "Consumer basket",
  "inflation.cardBasketDescription": "What the basket contains and how it is weighted.",
  "inflation.cardCities": "Cities",
  "inflation.cardCitiesDescription": "Inflation in Georgia's cities.",
  "inflation.cardProducts": "Products",
  "inflation.cardProductsDescription": "Price change for individual products.",
  "inflation.month.1": "January", "inflation.month.2": "February", "inflation.month.3": "March", "inflation.month.4": "April",
  "inflation.month.5": "May", "inflation.month.6": "June", "inflation.month.7": "July", "inflation.month.8": "August",
  "inflation.month.9": "September", "inflation.month.10": "October", "inflation.month.11": "November", "inflation.month.12": "December",
  "inflation.monthShort.1": "Jan", "inflation.monthShort.2": "Feb", "inflation.monthShort.3": "Mar", "inflation.monthShort.4": "Apr",
  "inflation.monthShort.5": "May", "inflation.monthShort.6": "Jun", "inflation.monthShort.7": "Jul", "inflation.monthShort.8": "Aug",
  "inflation.monthShort.9": "Sep", "inflation.monthShort.10": "Oct", "inflation.monthShort.11": "Nov", "inflation.monthShort.12": "Dec",
  "inflation.monthIn.1": "January", "inflation.monthIn.2": "February", "inflation.monthIn.3": "March", "inflation.monthIn.4": "April",
  "inflation.monthIn.5": "May", "inflation.monthIn.6": "June", "inflation.monthIn.7": "July", "inflation.monthIn.8": "August",
  "inflation.monthIn.9": "September", "inflation.monthIn.10": "October", "inflation.monthIn.11": "November", "inflation.monthIn.12": "December",
  "inflation.monthWith.1": "January", "inflation.monthWith.2": "February", "inflation.monthWith.3": "March", "inflation.monthWith.4": "April",
  "inflation.monthWith.5": "May", "inflation.monthWith.6": "June", "inflation.monthWith.7": "July", "inflation.monthWith.8": "August",
  "inflation.monthWith.9": "September", "inflation.monthWith.10": "October", "inflation.monthWith.11": "November", "inflation.monthWith.12": "December"
}
```

Format both files one key per line to match the repository's other message files (the grouped lines above are for plan brevity only).

- [ ] **Step 4: Write `inflationOverview.ts`**

```ts
import { periodFromKey, periodKey } from "../data/inflation/periods";
import type { CpiMeasure, CpiSeriesId, ServedCpiFact, ServedInflationTargetRow } from "../data/inflation/types";
import { ACCENT, INK } from "./colors";

// Pure state and data selection for the inflation overview. Components compose
// these; nothing here renders or reads the DOM.

export const INFLATION_TABS = ["yoy", "mom", "index"] as const;
export type InflationTab = (typeof INFLATION_TABS)[number];
export const INFLATION_SERIES = ["cpi", "core", "core_ex_tobacco"] as const;
export type InflationSeriesKey = (typeof INFLATION_SERIES)[number];
export type InflationSelectionKey = InflationSeriesKey | "target";
export const SELECTION_ORDER: readonly InflationSelectionKey[] = ["cpi", "core", "core_ex_tobacco", "target"];

const TAB_MEASURE: Record<InflationTab, CpiMeasure> = { yoy: "yoy_pct", mom: "mom_pct", index: "index_2010" };
const SERIES_DATA_ID: Record<InflationSeriesKey, CpiSeriesId> = { cpi: "cpi.headline", core: "cpi.core", core_ex_tobacco: "cpi.core_ex_tobacco" };

// Headline is ink, like every total; core takes the editorial blue; the target
// is the accent, drawn dashed (DESIGN.md §4.2). Two blues would not separate.
export const INFLATION_COLORS: Record<InflationSelectionKey, string> = {
  cpi: INK,
  core: "#3D5A98",
  core_ex_tobacco: "#A5822B",
  target: ACCENT,
};

export type InflationRange = { kind: "all" } | { kind: "manual"; start: number; end: number };
export type InflationState = {
  tab: InflationTab;
  mode: "line" | "table";
  range: InflationRange;
  selected: InflationSelectionKey[];
  tableSeries: InflationSeriesKey | null;
};

// The target is a reference line, not a series, so "headline only" still holds.
export const DEFAULT_INFLATION_STATE: InflationState = { tab: "yoy", mode: "line", range: { kind: "all" }, selected: ["cpi", "target"], tableSeries: null };

export type InflationIndex = { values: Map<string, Map<number, number>>; sourceIds: Map<string, string> };
export type ResolvedPeriodRange = { min: number; max: number; start: number; end: number };

export function seriesGroup(key: InflationSeriesKey, tab: InflationTab): string {
  return `${SERIES_DATA_ID[key]}:${TAB_MEASURE[tab]}`;
}

export function indexInflationFacts(facts: ServedCpiFact[]): InflationIndex {
  const values = new Map<string, Map<number, number>>();
  const sourceIds = new Map<string, string>();
  for (const fact of facts) {
    const group = `${fact.seriesId}:${fact.measure}`;
    if (!values.has(group)) values.set(group, new Map());
    values.get(group)!.set(periodFromKey(fact.period), fact.value);
    sourceIds.set(group, fact.sourceId);
  }
  return { values, sourceIds };
}

export function seriesValues(index: InflationIndex, key: InflationSeriesKey, tab: InflationTab): Map<number, number> | undefined {
  return index.values.get(seriesGroup(key, tab));
}

function bounds(maps: Array<Map<number, number> | undefined>): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;
  for (const map of maps) {
    for (const period of map?.keys() ?? []) {
      if (period < min) min = period;
      if (period > max) max = period;
    }
  }
  if (min === Infinity) throw new Error("Inflation data has no periods");
  return { min, max };
}

export function tabCoverage(index: InflationIndex, tab: InflationTab): { min: number; max: number } {
  return bounds(INFLATION_SERIES.map((key) => seriesValues(index, key, tab)));
}

export function overallCoverage(index: InflationIndex): { min: number; max: number } {
  return bounds([...index.values.values()]);
}

export function resolveInflationRange(state: InflationState, index: InflationIndex): ResolvedPeriodRange {
  const { min, max } = tabCoverage(index, state.tab);
  if (state.range.kind === "all") return { min, max, start: min, end: max };
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  return start > end ? { min, max, start: min, end: max } : { min, max, start, end };
}

/** Spec §8: keep "all" as all, intersect a manual range, fall back when nothing overlaps. */
export function changeInflationTab(state: InflationState, tab: InflationTab, index: InflationIndex): InflationState {
  const next = { ...state, tab };
  if (state.range.kind === "all") return next;
  const { min, max } = tabCoverage(index, tab);
  const start = Math.max(min, state.range.start);
  const end = Math.min(max, state.range.end);
  if (start > end || (start === min && end === max)) return { ...next, range: { kind: "all" } };
  return { ...next, range: { kind: "manual", start, end } };
}

export function rangeFromPatch(range: ResolvedPeriodRange, patch: { start?: number; end?: number }): InflationRange {
  const start = patch.start ?? range.start;
  const end = patch.end ?? range.end;
  return start === range.min && end === range.max ? { kind: "all" } : { kind: "manual", start, end };
}

export function targetForPeriod(targets: ServedInflationTargetRow[], period: number): number | null {
  const row = targets.find((entry) => periodFromKey(entry.effectiveFrom) <= period && (entry.effectiveTo === null || period <= periodFromKey(entry.effectiveTo)));
  return row ? row.targetPct : null;
}

export function buildInflationLines(index: InflationIndex, targets: ServedInflationTargetRow[], state: InflationState, range: ResolvedPeriodRange) {
  const periods = Array.from({ length: range.end - range.start + 1 }, (_, offset) => range.start + offset);
  const lines = state.selected.flatMap((key) => {
    if (key === "target") return state.tab === "yoy" ? [{ key, values: periods.map((period) => targetForPeriod(targets, period)) }] : [];
    const values = seriesValues(index, key, state.tab);
    return values ? [{ key: key as InflationSelectionKey, values: periods.map((period) => values.get(period) ?? null) }] : [];
  });
  return { periods, lines };
}

function lastInRange(values: Map<number, number> | undefined, range: ResolvedPeriodRange): { period: number; value: number } | null {
  if (!values) return null;
  for (let period = range.end; period >= range.start; period -= 1) {
    const value = values.get(period);
    if (value !== undefined) return { period, value };
  }
  return null;
}

/** The headline line: headline series, active tab, last month in the active range. */
export function headlinePoint(index: InflationIndex, state: InflationState, range: ResolvedPeriodRange) {
  return lastInRange(seriesValues(index, "cpi", state.tab), range);
}

export function panelValue(index: InflationIndex, targets: ServedInflationTargetRow[], key: InflationSelectionKey, state: InflationState, range: ResolvedPeriodRange): number | null {
  if (key === "target") return state.tab === "yoy" ? targetForPeriod(targets, range.end) : null;
  return lastInRange(seriesValues(index, key, state.tab), range)?.value ?? null;
}

export function toggleSelection(state: InflationState, key: InflationSelectionKey): InflationState {
  const next = state.selected.includes(key) ? state.selected.filter((entry) => entry !== key) : [...state.selected, key];
  return { ...state, selected: SELECTION_ORDER.filter((entry) => next.includes(entry)) };
}

export function tableSeriesOptions(index: InflationIndex, state: InflationState): InflationSeriesKey[] {
  return state.selected.filter((key): key is InflationSeriesKey => key !== "target" && seriesValues(index, key, state.tab) !== undefined);
}

export function effectiveTableSeries(index: InflationIndex, state: InflationState): InflationSeriesKey | null {
  const options = tableSeriesOptions(index, state);
  return state.tableSeries !== null && options.includes(state.tableSeries) ? state.tableSeries : options[0] ?? null;
}

/** Spec §6: the indicators always describe the latest published month. */
export function latestIndicators(index: InflationIndex, targets: ServedInflationTargetRow[]) {
  const yoy = seriesValues(index, "cpi", "yoy");
  if (!yoy || yoy.size === 0) return null;
  const period = bounds([yoy]).max;
  const coreYoy = seriesValues(index, "core", "yoy");
  const mom = seriesValues(index, "cpi", "mom");
  const avg12 = index.values.get("cpi.headline:avg12_pct");
  const window = Array.from({ length: 36 }, (_, offset) => period - 35 + offset);
  const spark = (values: Map<number, number> | undefined) => window.map((entry) => values?.get(entry) ?? null);
  return {
    period,
    yoy: yoy.get(period)!,
    coreYoy: coreYoy?.get(period) ?? null,
    mom: mom?.get(period) ?? null,
    avg12: avg12?.get(period) ?? null,
    target: targetForPeriod(targets, period),
    sparks: { coreYoy: spark(coreYoy), mom: spark(mom), avg12: spark(avg12) },
  };
}

const RANGE_PARAM = /^(\d{4}-\d{2})-(\d{4}-\d{2})$/;

export function parseInflationHash(hash: string): InflationState {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const tab = INFLATION_TABS.find((entry) => entry === params.get("i")) ?? DEFAULT_INFLATION_STATE.tab;
  let range: InflationRange = { kind: "all" };
  const match = RANGE_PARAM.exec(params.get("r") ?? "");
  if (match) {
    try {
      const a = periodFromKey(match[1]!);
      const b = periodFromKey(match[2]!);
      range = { kind: "manual", start: Math.min(a, b), end: Math.max(a, b) };
    } catch {
      range = { kind: "all" };
    }
  }
  const requested = params.has("sel") ? (params.get("sel") ?? "").split(",") : DEFAULT_INFLATION_STATE.selected;
  const selected = SELECTION_ORDER.filter((key) => requested.includes(key));
  const tableSeries = INFLATION_SERIES.find((key) => key === params.get("t")) ?? null;
  return { tab, mode: params.get("m") === "table" ? "table" : "line", range, selected, tableSeries };
}

export function serializeInflationHash(state: InflationState): string {
  const params = new URLSearchParams({ i: state.tab, m: state.mode });
  if (state.range.kind === "manual") params.set("r", `${periodKey(state.range.start)}-${periodKey(state.range.end)}`);
  params.set("sel", state.selected.join(","));
  if (state.tableSeries !== null) params.set("t", state.tableSeries);
  return params.toString();
}
```

Two contract checks against the test: `parseInflationHash("#i=bad&m=x&r=nope&sel=cpi,cpi,junk")` gives `selected: ["cpi"]` (filtered and de-duplicated by `SELECTION_ORDER`); `toggleSelection` always returns canonical order, so a restored hash and a clicked selection serialize identically.

- [ ] **Step 5: Write `inflationLabels.ts`**

```ts
import { periodMonth, periodYear } from "../data/inflation/periods";
import { message } from "../i18n/messages";
import type { Messages } from "../i18n/types";
import { formatShare } from "./format";
import type { InflationSelectionKey, InflationTab } from "./inflationOverview";

export const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

export function periodLabel(messages: Messages, period: number, style: "long" | "short"): string {
  return `${message(messages, `inflation.${style === "long" ? "month" : "monthShort"}.${periodMonth(period)}`)} ${periodYear(period)}`;
}

export function seriesLabel(messages: Messages, key: InflationSelectionKey, tab: InflationTab): string {
  return message(messages, key === "cpi" && tab === "index" ? "inflation.series.cpiIndex" : `inflation.series.${key}`);
}

/** Percent tabs hold percentage points; monthly change is signed. The index is a level. */
export function formatInflationValue(value: number, tab: InflationTab): string {
  return tab === "index" ? value.toFixed(1) : formatShare(value / 100, tab === "mom");
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run tests/explorer/inflationOverview.test.ts`
Expected: PASS (7 tests). Then `npm run i18n:check` — expected: valid (same keys in both languages).

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/explorer/inflationOverview.ts apps/web/lib/explorer/inflationLabels.ts apps/web/lib/i18n apps/web/tests/explorer/inflationOverview.test.ts
git commit -m "feat(inflation): overview state, hash, ranges and bilingual labels" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: The monthly table (`ცხრილი`)

**Files:**
- Create: `apps/web/lib/explorer/inflationGrid.ts`
- Create: `apps/web/components/main-explorer/month-grid-table.tsx`
- Test: `apps/web/tests/explorer/inflationGrid.test.ts`, `apps/web/tests/explorer/monthGridTable.test.tsx`

**Interfaces:**
- Produces (`inflationGrid.ts`): `GridCell = { kind: "empty" } | { kind: "missing" } | { kind: "value"; value: number; bin: number | null }`, `GridRow = { year: number; cells: GridCell[]; summary: GridCell | null }`, `YOY_BINS = [0, 3, 6, 10]`, `MOM_BINS = [0, 0.5, 1, 2]`, `GRID_TINTS: ReadonlyArray<{ background: string; text: string }>` (5), `binFor(value, edges)`, `legendLabels(edges): string[]`, `contrastRatio(foreground, background)`, `decemberAverages(avg12: Map<number, number> | undefined): Map<number, number>`, `buildMonthGrid({ values, range, edges, summaryByYear? }): GridRow[]`.
- Produces (`month-grid-table.tsx`): `MonthGridTable({ caption, yearLabel, monthLabels, monthNames, summaryLabel?, rows, formatValue, legend, legendLabel, picker? })`.

- [ ] **Step 1: Write the failing tests**

`apps/web/tests/explorer/inflationGrid.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makePeriod } from "../../lib/data/inflation/periods";
import { GRID_TINTS, MOM_BINS, YOY_BINS, binFor, buildMonthGrid, contrastRatio, decemberAverages, legendLabels } from "../../lib/explorer/inflationGrid";

const series = new Map<number, number>();
for (let period = makePeriod(2024, 3); period <= makePeriod(2026, 8); period += 1) series.set(period, (period % 13) - 2);

describe("month grid", () => {
  it("bins on the spec's five-step scales", () => {
    expect([-0.1, 0, 2.99, 3, 6, 9.99, 10].map((value) => binFor(value, YOY_BINS))).toEqual([0, 1, 1, 2, 3, 3, 4]);
    expect([-0.01, 0, 0.5, 1, 2].map((value) => binFor(value, MOM_BINS))).toEqual([0, 1, 2, 3, 4]);
    expect(legendLabels(YOY_BINS)).toEqual(["< 0%", "0–3%", "3–6%", "6–10%", "≥ 10%"]);
    expect(legendLabels(MOM_BINS)).toEqual(["< 0%", "0–0.5%", "0.5–1%", "1–2%", "≥ 2%"]);
  });

  it("passes WCAG AA for every tint and its text", () => {
    for (const tint of GRID_TINTS) expect(contrastRatio(tint.text, tint.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("lists years newest first and separates empty from missing cells", () => {
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2024, 1), end: makePeriod(2026, 8) }, edges: YOY_BINS });
    expect(rows.map((row) => row.year)).toEqual([2026, 2025, 2024]);
    expect(rows[0]!.cells[8]).toEqual({ kind: "empty" }); // September 2026: not yet published
    expect(rows[2]!.cells[0]).toEqual({ kind: "missing" }); // January 2024: in range, before the series starts
    expect(rows[2]!.cells[2]).toMatchObject({ kind: "value", value: series.get(makePeriod(2024, 3)) });
    expect(rows.every((row) => row.summary === null)).toBe(true);
  });

  it("blanks months outside a manual range and prints plain values without edges", () => {
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2025, 4), end: makePeriod(2025, 9) }, edges: null });
    expect(rows.map((row) => row.year)).toEqual([2025]);
    expect(rows[0]!.cells[2]).toEqual({ kind: "empty" });
    expect(rows[0]!.cells[3]).toMatchObject({ kind: "value", bin: null });
    expect(rows[0]!.cells[9]).toEqual({ kind: "empty" });
  });

  it("adds the December 12-month average for complete years only", () => {
    const avg12 = new Map([[makePeriod(2024, 12), 1.1], [makePeriod(2025, 12), 3.9], [makePeriod(2026, 8), 5.1]]);
    const summary = decemberAverages(avg12);
    expect([...summary]).toEqual([[2024, 1.1], [2025, 3.9]]);
    const rows = buildMonthGrid({ values: series, range: { start: makePeriod(2024, 1), end: makePeriod(2026, 8) }, edges: YOY_BINS, summaryByYear: summary });
    expect(rows[0]!.summary).toEqual({ kind: "empty" });
    expect(rows[1]!.summary).toEqual({ kind: "value", value: 3.9, bin: null });
  });
});
```

`apps/web/tests/explorer/monthGridTable.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { MonthGridTable } from "../../components/main-explorer/month-grid-table";
import { makePeriod } from "../../lib/data/inflation/periods";
import { GRID_TINTS, YOY_BINS, buildMonthGrid, legendLabels } from "../../lib/explorer/inflationGrid";
import { renderGeorgianMarkup } from "../helpers/render-localized";

const values = new Map([[makePeriod(2026, 7), 12.4], [makePeriod(2026, 8), 5.6479]]);
const rows = buildMonthGrid({ values, range: { start: makePeriod(2026, 7), end: makePeriod(2026, 8) }, edges: YOY_BINS, summaryByYear: new Map() });
const short = ["იან", "თებ", "მარ", "აპრ", "მაი", "ივნ", "ივლ", "აგვ", "სექ", "ოქტ", "ნოე", "დეკ"];
const long = ["იანვარი", "თებერვალი", "მარტი", "აპრილი", "მაისი", "ივნისი", "ივლისი", "აგვისტო", "სექტემბერი", "ოქტომბერი", "ნოემბერი", "დეკემბერი"];
const markup = renderGeorgianMarkup(
  <MonthGridTable
    caption="საერთო ინფლაცია · წლიური ინფლაცია"
    yearLabel="წელი"
    monthLabels={short}
    monthNames={long}
    summaryLabel="წლის საშუალო"
    rows={rows}
    formatValue={(value) => `${value.toFixed(1)}%`}
    legend={legendLabels(YOY_BINS).map((label, tint) => ({ label, tint }))}
    legendLabel="ფერის სკალა"
  />,
);

describe("MonthGridTable", () => {
  it("is a captioned table with a month header and the summary column", () => {
    expect(markup).toContain("<table");
    expect(markup).toContain("<caption");
    expect(markup).toContain("საერთო ინფლაცია · წლიური ინფლაცია");
    expect(markup).toContain(">აგვ<");
    expect(markup).toContain(">წლის საშუალო<");
  });

  it("always prints the value, titles the cell, and switches to paper text on the top tint", () => {
    expect(markup).toContain('title="აგვისტო 2026: 5.6%"');
    expect(markup).toContain(">5.6%<");
    expect(markup).toMatch(new RegExp(`data-bin="4"[^>]*style="background-color:${GRID_TINTS[4]!.background};color:${GRID_TINTS[4]!.text}"`));
  });

  it("renders a five-step legend", () => {
    expect(markup.match(/data-testid="month-grid-legend-step"/g)).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/explorer/inflationGrid.test.ts tests/explorer/monthGridTable.test.tsx`
Expected: FAIL — modules missing.

- [ ] **Step 3: Write `inflationGrid.ts`**

```ts
import { makePeriod, periodMonth, periodYear } from "../data/inflation/periods";

// The year × month grid behind ცხრილი (spec §7.1). Colour is never the only cue:
// every cell prints its value, and a legend names the bins.

export type GridCell = { kind: "empty" } | { kind: "missing" } | { kind: "value"; value: number; bin: number | null };
export type GridRow = { year: number; cells: GridCell[]; summary: GridCell | null };

export const YOY_BINS = [0, 3, 6, 10] as const;
export const MOM_BINS = [0, 0.5, 1, 2] as const;

// Deflation, then four warm steps to the accent. Each pair is checked ≥ 4.5:1
// in tests; the accent step carries paper text.
export const GRID_TINTS = [
  { background: "#DCE4F2", text: "#1E1B16" },
  { background: "#F1EADC", text: "#1E1B16" },
  { background: "#EBCDBB", text: "#1E1B16" },
  { background: "#D9967C", text: "#1E1B16" },
  { background: "#B3402A", text: "#F7F2E9" },
] as const;

export function binFor(value: number, edges: readonly number[]): number {
  const index = edges.findIndex((edge) => value < edge);
  return index === -1 ? edges.length : index;
}

export function legendLabels(edges: readonly number[]): string[] {
  return [`< ${edges[0]}%`, ...edges.slice(0, -1).map((edge, index) => `${edge}–${edges[index + 1]}%`), `≥ ${edges.at(-1)}%`];
}

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

/** Geostat's December 12-month average is the calendar-year average inflation. */
export function decemberAverages(avg12: Map<number, number> | undefined): Map<number, number> {
  const result = new Map<number, number>();
  for (const [period, value] of avg12 ?? []) if (periodMonth(period) === 12) result.set(periodYear(period), value);
  return new Map([...result].sort((a, b) => a[0] - b[0]));
}

export function buildMonthGrid(input: {
  values: Map<number, number>;
  range: { start: number; end: number };
  edges: readonly number[] | null;
  summaryByYear?: Map<number, number>;
}): GridRow[] {
  const { values, range, edges, summaryByYear } = input;
  const periods = [...values.keys()];
  if (periods.length === 0) return [];
  const first = Math.min(...periods);
  const last = Math.max(...periods);
  const topYear = Math.min(periodYear(range.end), periodYear(last));
  const bottomYear = Math.max(periodYear(range.start), periodYear(first));
  const valueCell = (value: number, tinted: boolean): GridCell => ({ kind: "value", value, bin: tinted && edges ? binFor(value, edges) : null });

  const rows: GridRow[] = [];
  for (let year = topYear; year >= bottomYear; year -= 1) {
    const cells = Array.from({ length: 12 }, (_, offset): GridCell => {
      const period = makePeriod(year, offset + 1);
      if (period < range.start || period > range.end || period > last) return { kind: "empty" };
      const value = values.get(period);
      return value === undefined ? { kind: "missing" } : valueCell(value, true);
    });
    const summaryValue = summaryByYear?.get(year);
    const summary = summaryByYear === undefined ? null : summaryValue === undefined ? { kind: "empty" as const } : valueCell(summaryValue, false);
    rows.push({ year, cells, summary });
  }
  return rows;
}
```

- [ ] **Step 4: Write `month-grid-table.tsx`**

```tsx
"use client";

import type { ReactNode } from "react";
import { useI18n } from "../../lib/i18n/provider";
import { message } from "../../lib/i18n/messages";
import { MISSING } from "../../lib/explorer/format";
import { GRID_TINTS, type GridCell, type GridRow } from "../../lib/explorer/inflationGrid";
import { HorizontalScrollHint } from "../ui/horizontal-scroll-hint";

// The ცხრილი view for monthly data (spec §7.1). ExplorerTable's anatomy — 2px ink
// header rule, hairline rows, mono right-aligned numerals, sticky first column,
// horizontal scroll — on a years × months grid.

type MonthGridTableProps = {
  caption: string;
  yearLabel: string;
  monthLabels: readonly string[];
  monthNames: readonly string[];
  summaryLabel?: string;
  rows: GridRow[];
  formatValue: (value: number) => string;
  legend: Array<{ label: string; tint: number }> | null;
  legendLabel: string;
  picker?: ReactNode;
};

const headCell = "border-b-2 border-[var(--ink)] px-2 pt-1.5 pb-[9px] text-right text-[11px] font-semibold text-[var(--muted)] whitespace-nowrap";
const numericCell = "px-2 py-[9px] text-right font-[family-name:var(--font-numeric)] text-[12.5px] whitespace-nowrap";

export function MonthGridTable({ caption, yearLabel, monthLabels, monthNames, summaryLabel, rows, formatValue, legend, legendLabel, picker }: MonthGridTableProps) {
  const { messages } = useI18n();
  const hasSummary = rows.some((row) => row.summary !== null);

  const cell = (entry: GridCell, key: string, title: (formatted: string) => string) => {
    if (entry.kind === "empty") return <td key={key} className={numericCell} />;
    if (entry.kind === "missing") return <td key={key} className={`${numericCell} text-[var(--faint)]`}>{MISSING}</td>;
    const formatted = formatValue(entry.value);
    const tint = entry.bin === null ? null : GRID_TINTS[entry.bin]!;
    return (
      <td
        key={key}
        data-testid="month-grid-cell"
        data-bin={entry.bin ?? undefined}
        title={title(formatted)}
        className={numericCell}
        style={tint ? { backgroundColor: tint.background, color: tint.text } : { color: "var(--body)" }}
      >
        {formatted}
      </td>
    );
  };

  return (
    <div className="mt-[18px]">
      {picker ? <div className="mb-4">{picker}</div> : null}
      <HorizontalScrollHint testId="table-scroll-hint" />
      <div
        data-testid="month-grid"
        role="region"
        tabIndex={0}
        aria-label={message(messages, "controls.tableScrollable")}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      >
        <table className="w-full border-collapse" style={{ minWidth: 88 + 12 * 64 + (hasSummary ? 96 : 0) }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[2] border-b-2 border-[var(--ink)] bg-[var(--paper)] pr-3 pt-1.5 pb-[9px] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] shadow-[1px_0_0_var(--hairline-soft)]">
                {yearLabel}
              </th>
              {monthLabels.map((label) => (
                <th key={label} scope="col" className={headCell}>{label}</th>
              ))}
              {hasSummary ? <th scope="col" className={`${headCell} uppercase tracking-[0.06em]`}>{summaryLabel}</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.year} data-testid="month-grid-row" data-year={row.year} className="border-b border-[var(--hairline-soft)]">
                <th scope="row" className="sticky left-0 z-[1] bg-[var(--paper)] pr-3 text-left font-[family-name:var(--font-numeric)] text-[12.5px] font-semibold text-[var(--ink)] shadow-[1px_0_0_var(--hairline-soft)]">
                  {row.year}
                </th>
                {row.cells.map((entry, index) => cell(entry, String(index), (formatted) => `${monthNames[index]} ${row.year}: ${formatted}`))}
                {hasSummary ? cell(row.summary ?? { kind: "empty" }, "summary", (formatted) => `${summaryLabel} ${row.year}: ${formatted}`) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {legend ? (
        <div data-testid="month-grid-legend" aria-label={legendLabel} role="group" className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--muted)]">
          {legend.map((step) => (
            <span key={step.label} data-testid="month-grid-legend-step" className="inline-flex items-center gap-1.5 font-[family-name:var(--font-numeric)]">
              <span aria-hidden className="inline-block size-3" style={{ backgroundColor: GRID_TINTS[step.tint]!.background }} />
              {step.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

The summary cell is never tinted (`bin: null`), matching the spec: only month cells carry the scale.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/explorer/inflationGrid.test.ts tests/explorer/monthGridTable.test.tsx`
Expected: PASS (8 tests). If the style regex fails only on attribute spelling, print the markup and correct the regex to React's serialization (`background-color:#B3402A;color:#F7F2E9`) — do not change the component.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/explorer/inflationGrid.ts apps/web/components/main-explorer/month-grid-table.tsx apps/web/tests/explorer/inflationGrid.test.ts apps/web/tests/explorer/monthGridTable.test.tsx
git commit -m "feat(explorer): year-by-month grid table with accessible tint scale" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: The Excel workbook

**Files:**
- Modify: `apps/web/lib/explorer/workbookModel.ts`, `apps/web/lib/explorer/workbookWriter.client.ts`
- Create: `apps/web/lib/explorer/inflationWorkbook.ts`
- Test: `apps/web/tests/explorer/inflationWorkbook.test.ts`

**Interfaces:**
- Produces: `WorkbookExportModel.readable.headerLabels?: { category: string; columns: string[] }`, `WorkbookExportModel.sourceYears?: number[]`.
- Produces: `InflationWorkbookSource = WorkbookPublicSource & { sourceId: string; language: Locale }`, `buildInflationWorkbookExportModel({ index, targets, state, range, presentation, sources, siteOrigin }): WorkbookExportModel`, `SUMMARY_COLUMN = 13`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/inflationWorkbook.test.ts`:

```ts
import ExcelJS from "exceljs";
import { beforeAll, describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { makePeriod } from "../../lib/data/inflation/periods";
import type { ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { DEFAULT_INFLATION_STATE, indexInflationFacts, resolveInflationRange, type InflationIndex, type InflationState } from "../../lib/explorer/inflationOverview";
import { buildInflationWorkbookExportModel, type InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { createWorkbookBuffer } from "../../lib/explorer/workbookWriter.client";
import { getMessages } from "../../lib/i18n/messages.server";

let index: InflationIndex;
let targets: ServedInflationTargetRow[];
const source = (sourceId: string, language: "ka" | "en"): InflationWorkbookSource => ({
  sourceId, language, years: Array.from({ length: 27 }, (_, offset) => 2000 + offset),
  title: `${sourceId} ${language}`, organization: "Geostat", downloadHref: `/downloads/methodology/inflation/files/${language}/${sourceId}.xlsx`, retrievedAt: "2026-09-12",
});
const sources = ["source.geostat_cpi_yoy", "source.geostat_cpi_avg12", "source.geostat_core_yoy", "source.nbg_inflation_target", "source.geostat_cpi_index_2010"].flatMap((id) => [source(id, "ka"), source(id, "en")]);

beforeAll(async () => {
  const data = await loadServedInflationData();
  index = indexInflationFacts(data.facts);
  targets = data.targets;
});

async function build(locale: "ka" | "en", state: InflationState) {
  const presentation = { locale, messages: await getMessages(locale, ["inflation"]), englishLabels: {} };
  return buildInflationWorkbookExportModel({ index, targets, state, range: resolveInflationRange(state, index), presentation, sources, siteOrigin: "https://fiscal.ge" });
}

const year2025: InflationState["range"] = { kind: "manual", start: makePeriod(2025, 1), end: makePeriod(2025, 12) };

describe("inflation workbook", () => {
  it("mirrors the grid: series — year rows, month columns, annual average, fractions", async () => {
    const model = await build("ka", { ...DEFAULT_INFLATION_STATE, range: year2025 });
    expect(model.filename).toBe("fiscal-inflation-yoy-2025-01-2025-12.xlsx");
    expect(model.readable.showChangeColumn).toBe(false);
    expect(model.readable.years).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(model.readable.headerLabels?.columns[0]).toBe("იანვარი");
    expect(model.readable.headerLabels?.columns[12]).toBe("წლის საშუალო");
    expect(model.readable.rows.map((row) => `${row.parentLabel} — ${row.label}`)).toEqual(["საერთო ინფლაცია — 2025", "მიზნობრივი მაჩვენებელი — 2025"]);
    const dec = index.values.get("cpi.headline:yoy_pct")!.get(makePeriod(2025, 12))!;
    expect(model.readable.rows[0]!.valuesByYear[12]).toBeCloseTo(dec / 100, 10);
    expect(model.readable.rows[0]!.valuesByYear[13]).toBeCloseTo(index.values.get("cpi.headline:avg12_pct")!.get(makePeriod(2025, 12))! / 100, 10);
    expect(model.readable.rows[1]!.valuesByYear[6]).toBe(0.03);
    expect(model.readable.rows[1]!.valuesByYear[13]).toBeNull();
    expect(model.sourceYears).toEqual([2025]);
    expect(model.analysis.rows).toHaveLength(24);
    expect(model.analysis.numericFormats).toEqual({ 4: "0.00%" });
    expect(model.sources.map((row) => row.title).sort()).toEqual(["source.geostat_cpi_avg12 ka", "source.geostat_cpi_yoy ka", "source.nbg_inflation_target ka"]);
  });

  it("exports the index as levels with English labels and no summary", async () => {
    const model = await build("en", { ...DEFAULT_INFLATION_STATE, tab: "index", range: year2025, selected: ["cpi", "core", "target"] });
    expect(model.filename).toBe("fiscal-inflation-index-2025-01-2025-12-en.xlsx");
    expect(model.readable.years).toHaveLength(12);
    expect(model.readable.rows.map((row) => row.parentLabel)).toEqual(["Consumer price index"]);
    expect(model.readable.rows[0]!.valuesByYear[1]).toBe(index.values.get("cpi.headline:index_2010")!.get(makePeriod(2025, 1)));
    expect(model.analysis.numericFormats).toEqual({ 4: "#,##0.00" });
    expect(model.sources.map((row) => row.title)).toEqual(["source.geostat_cpi_index_2010 en"]);
  });

  it("writes month headers and calendar-year source coverage", async () => {
    const model = await build("ka", { ...DEFAULT_INFLATION_STATE, range: year2025 });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await createWorkbookBuffer(model));
    const [readable, analysis, sheetSources] = workbook.worksheets;
    expect(readable!.getCell("A3").value).toBe("სერია — წელი");
    expect(readable!.getCell("B3").value).toBe("იანვარი");
    expect(readable!.getCell("N3").value).toBe("წლის საშუალო");
    expect(readable!.getCell("O3").value).toBeNull();
    expect(readable!.getCell("A4").value).toBe("საერთო ინფლაცია — 2025");
    expect(String(readable!.getCell("B4").numFmt)).toContain("%");
    expect(analysis!.getCell("D2").numFmt).toBe("0.00%");
    expect(String(sheetSources!.getCell("A2").value)).toContain("2025");
    expect(String(sheetSources!.getCell("A2").value)).not.toContain("1–13");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/explorer/inflationWorkbook.test.ts`
Expected: FAIL — `inflationWorkbook` missing.

- [ ] **Step 3: Extend the workbook model and writer**

`lib/explorer/workbookModel.ts`, inside `WorkbookExportModel`:

```ts
  readable: {
    …existing fields…
    /** Header text when the readable columns are not calendar years (e.g. months). */
    headerLabels?: { category: string; columns: string[] };
  };
  …
  /** Calendar years the sources sheet describes when the readable columns are not years. */
  sourceYears?: number[];
```

`lib/explorer/workbookWriter.client.ts`, in `writeReadableSheet`, replace the `headers` constant with:

```ts
  const leading = readable.headerLabels
    ? [readable.headerLabels.category, ...readable.headerLabels.columns]
    : [workbookMessage(locale, "workbook.category"), ...readable.years];
  const headers = [...leading, ...(readable.showChangeColumn === false ? [] : [changeHeader])];
```

and in `createWorkbookBuffer`: `writeSourcesSheet(sources, model.sources, model.sourceYears ?? model.readable.years, model.locale);`.

Run: `npx vitest run tests/explorer/workbookWriter.test.ts tests/explorer/debtWorkbook.test.ts tests/explorer/deficitWorkbook.test.ts` — expected: PASS unchanged (and the GDP workbook test if the merged branch has one).

- [ ] **Step 4: Write `inflationWorkbook.ts`**

```ts
import { makePeriod, periodKey, periodMonth, periodYear } from "../data/inflation/periods";
import type { ServedInflationTargetRow } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Locale, Presentation } from "../i18n/types";
import { decemberAverages } from "./inflationGrid";
import { MONTH_NUMBERS, periodLabel, seriesLabel } from "./inflationLabels";
import { buildInflationLines, seriesGroup, type InflationIndex, type InflationState, type ResolvedPeriodRange } from "./inflationOverview";
import { SHEET_NAMES, absoluteWorkbookSourceUrl, type WorkbookBasis, type WorkbookExportModel, type WorkbookPublicSource, type WorkbookReadableRow } from "./workbookModel";

export type InflationWorkbookSource = WorkbookPublicSource & { sourceId: string; language: Locale };

/** Readable-sheet column key for the annual average, after months 1–12. */
export const SUMMARY_COLUMN = 13;

// Spec §9: the readable sheet mirrors ცხრილი — one row per selected series and
// year, months across — and percentages leave as fractions under Excel's % format.
export function buildInflationWorkbookExportModel(input: {
  index: InflationIndex;
  targets: ServedInflationTargetRow[];
  state: InflationState;
  range: ResolvedPeriodRange;
  presentation: Presentation;
  sources: InflationWorkbookSource[];
  siteOrigin: string;
}): WorkbookExportModel {
  const { index, targets, state, range, presentation, sources, siteOrigin } = input;
  const { messages, locale } = presentation;
  const t = (key: string) => message(messages, `inflation.${key}`);
  const percent = state.tab !== "index";
  const scale = (value: number) => (percent ? value / 100 : value);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const summary = state.tab === "yoy" && lines.some((line) => line.key === "cpi") ? decemberAverages(index.values.get("cpi.headline:avg12_pct")) : null;
  const columns: number[] = [...MONTH_NUMBERS, ...(summary ? [SUMMARY_COLUMN] : [])];
  const firstYear = periodYear(range.start);
  const lastYear = periodYear(range.end);
  const calendarYears = Array.from({ length: lastYear - firstYear + 1 }, (_, offset) => firstYear + offset);

  const rows: WorkbookReadableRow[] = lines.flatMap((line) => {
    const label = seriesLabel(messages, line.key, state.tab);
    const byPeriod = new Map(periods.map((period, position) => [period, line.values[position] ?? null]));
    return [...calendarYears].reverse().flatMap((year) => {
      const valuesByYear: Record<number, number | null> = {};
      const basisByYear: Record<number, WorkbookBasis | null> = {};
      for (const month of MONTH_NUMBERS) {
        const value = byPeriod.get(makePeriod(year, month)) ?? null;
        valuesByYear[month] = value === null ? null : scale(value);
        basisByYear[month] = value === null ? null : "published";
      }
      if (summary) {
        const value = line.key === "cpi" ? summary.get(year) ?? null : null;
        valuesByYear[SUMMARY_COLUMN] = value === null ? null : scale(value);
        basisByYear[SUMMARY_COLUMN] = value === null ? null : "published";
      }
      if (MONTH_NUMBERS.every((month) => valuesByYear[month] === null)) return [];
      return [{ kind: "item" as const, parentLabel: label, label: String(year), valuesByYear, basisByYear, change: null }];
    });
  });

  const unit = percent ? "%" : "2010=100";
  const analysisRows = periods.flatMap((period, position) =>
    lines.flatMap((line) => {
      const value = line.values[position];
      return value === null || value === undefined
        ? []
        : [[periodYear(period), periodMonth(period), seriesLabel(messages, line.key, state.tab), scale(value), unit, t("published")]];
    }),
  );

  const usedSourceIds = new Set<string>();
  for (const line of lines) {
    if (line.key === "target") {
      for (const row of targets) usedSourceIds.add(row.sourceId);
    } else {
      const id = index.sourceIds.get(seriesGroup(line.key, state.tab));
      if (id) usedSourceIds.add(id);
    }
  }
  if (summary) {
    const id = index.sourceIds.get("cpi.headline:avg12_pct");
    if (id) usedSourceIds.add(id);
  }
  // Link the archive copy in the reader's language when one exists.
  const chosen = [...usedSourceIds].flatMap((id) => {
    const candidates = sources.filter((row) => row.sourceId === id);
    const row = candidates.find((entry) => entry.language === locale) ?? candidates.find((entry) => entry.language === "en");
    return row ? [row] : [];
  });

  return {
    locale,
    filename: `fiscal-inflation-${state.tab}-${periodKey(range.start)}-${periodKey(range.end)}${locale === "en" ? "-en" : ""}.xlsx`,
    sheetNames: SHEET_NAMES[locale],
    readable: {
      title: t(`tab.${state.tab}`),
      subtitle: `${periodLabel(messages, range.start, "long")} – ${periodLabel(messages, range.end, "long")} · ${t(`unit.${state.tab}`)}`,
      unitLabel: t(`workbookUnit.${state.tab}`),
      showChangeColumn: false,
      years: columns,
      headerLabels: {
        category: t("seriesYear"),
        columns: columns.map((column) => (column === SUMMARY_COLUMN ? t("annualAverage") : message(messages, `inflation.month.${column}`))),
      },
      rows,
    },
    analysis: {
      headers: [t("year"), t("month"), t("seriesColumn"), t("value"), t("unitColumn"), t("status")],
      rows: analysisRows,
      numericFormats: { 4: percent ? "0.00%" : "#,##0.00" },
    },
    sources: chosen
      .map((row) => ({ ...row, years: row.years.filter((year) => calendarYears.includes(year)), absoluteUrl: absoluteWorkbookSourceUrl(siteOrigin, row.downloadHref) }))
      .filter((row) => row.years.length > 0),
    sourceYears: calendarYears,
  };
}
```

The readable writer treats a unit label containing `%` as a percentage sheet, which is why the percent `workbookUnit` messages start with `%`. The target rows are included when the target is selected on the y/y tab (spec §9 exports the selection).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/explorer/inflationWorkbook.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/explorer/workbookModel.ts apps/web/lib/explorer/workbookWriter.client.ts apps/web/lib/explorer/inflationWorkbook.ts apps/web/tests/explorer/inflationWorkbook.test.ts
git commit -m "feat(inflation): grid-shaped Excel workbook with month headers" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: The overview page components

**Files:**
- Create: `apps/web/components/inflation/inflation-overview.tsx`
- Create: `apps/web/components/inflation/inflation-series-panel.tsx`
- Create: `apps/web/components/inflation/inflation-table.tsx`
- Create: `apps/web/components/inflation/inflation-indicators.tsx`
- Test: `apps/web/tests/explorer/inflationOverviewRender.test.tsx`

**Interfaces:**
- Consumes: Tasks 5–10.
- Produces: `InflationOverview({ facts: ServedCpiFact[]; targets: ServedInflationTargetRow[]; sources: InflationWorkbookSource[]; siteOrigin: string })`.
- Test IDs used by Task 15: `inflation-overview`, `inflation-headline`, `inflation-unit`, `inflation-tabs`, `inflation-tab-{yoy|mom|index}`, `chart-panel` (`data-tab`, `data-mode`), `chart-mode-line`, `chart-mode-table`, `inflation-table-series`, `inflation-table-series-{key}`, `month-grid`, `inflation-download`, `inflation-indicators`, `inflation-gauge`, `source-label`, `series-row` (`data-series-id`).

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/inflationOverviewRender.test.tsx`:

```tsx
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { InflationOverview } from "../../components/inflation/inflation-overview";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";

let html: string;
let heading: string;

beforeAll(async () => {
  const { facts, targets } = await loadServedInflationData();
  const messages = await getMessages("en", ["inflation", "common", "controls", "format", "main"]);
  const last = Math.max(...facts.map((fact) => periodFromKey(fact.period)));
  heading = `${periodLabel(messages, last, "long")}: Annual inflation · `;
  html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <InflationOverview facts={facts} targets={targets} sources={[]} siteOrigin="https://fiscal.ge" />
    </I18nProvider>,
  );
});

describe("inflation overview (server render = default state)", () => {
  it("centres three indicator tabs with annual inflation active", () => {
    expect(html).toContain('data-testid="inflation-tabs"');
    expect(html).toMatch(/data-testid="inflation-tab-yoy" aria-pressed="true"/);
    expect(html).toContain(">Monthly inflation<");
    expect(html).toContain(">Price index<");
  });

  it("states the latest month, the value and the unit under the heading", () => {
    expect(html).toContain(heading);
    expect(html).toContain("Percent · change on the same month of the previous year");
  });

  it("selects the headline and the target, with the target drawn dashed", () => {
    expect(html.match(/data-testid="series-row"/g)).toHaveLength(4);
    expect(html).toMatch(/data-series-id="cpi"[^]*?aria-pressed="true"/);
    expect(html).toMatch(/data-series-id="core"[^]*?aria-pressed="false"/);
    expect(html).toContain('data-testid="chart-series-target-dashed"');
  });

  it("shows the indicators without a movers board", () => {
    expect(html).toContain('data-testid="inflation-indicators"');
    expect(html).toContain('data-testid="inflation-gauge"');
    expect(html).toContain(">Core inflation<");
    expect(html).not.toContain("period-movers");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/explorer/inflationOverviewRender.test.tsx`
Expected: FAIL — component missing.

- [ ] **Step 3: Write `inflation-series-panel.tsx`**

```tsx
"use client";

import { useState, type ReactNode } from "react";
import type { ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { MISSING } from "../../lib/explorer/format";
import { formatInflationValue, seriesLabel } from "../../lib/explorer/inflationLabels";
import { INFLATION_COLORS, SELECTION_ORDER, panelValue, type InflationIndex, type InflationSelectionKey, type InflationState, type ResolvedPeriodRange } from "../../lib/explorer/inflationOverview";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import { SeriesSelector, SeriesSelectorRow } from "../main-explorer/series-selector";

// A thin composition of the shared selector, as DebtSeriesPanel is. The target
// is a reference row with a dashed swatch; values follow the active tab and range.

type InflationSeriesPanelProps = {
  index: InflationIndex;
  targets: ServedInflationTargetRow[];
  state: InflationState;
  range: ResolvedPeriodRange;
  onToggle: (key: InflationSelectionKey) => void;
  onClear: () => void;
  downloadAction: ReactNode;
};

export function InflationSeriesPanel({ index, targets, state, range, onToggle, onClear, downloadAction }: InflationSeriesPanelProps) {
  const { messages } = useI18n();
  const [query, setQuery] = useState("");
  const rows = SELECTION_ORDER.map((key) => ({ key, label: seriesLabel(messages, key, state.tab), value: panelValue(index, targets, key, state, range) }));
  const visible = rows.filter((row) => matchesLabelQuery(query, [row.label, row.key]));

  return (
    <aside
      aria-label={message(messages, "controls.series")}
      className="min-w-0 max-w-full border-t-2 border-[var(--ink)] pt-[22px] @min-[1100px]:sticky @min-[1100px]:top-5 @min-[1100px]:border-t-0 @min-[1100px]:border-l @min-[1100px]:border-[var(--hairline)] @min-[1100px]:pt-0 @min-[1100px]:pl-[26px]"
    >
      <SeriesSelector
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={message(messages, "controls.search")}
        selectedCount={state.selected.length}
        totalCount={rows.length}
        hasSelection={state.selected.length > 0}
        allSelected={false}
        onToggleAll={onClear}
        allowSelectAll={false}
        hasVisibleMatches={visible.length > 0}
      >
        {visible.map((row) => (
          <SeriesSelectorRow
            key={row.key}
            id={row.key}
            label={row.label}
            color={INFLATION_COLORS[row.key]}
            value={row.value === null ? MISSING : formatInflationValue(row.value, state.tab)}
            selected={state.selected.includes(row.key)}
            swatch={row.key === "target" ? "dashed" : "solid"}
            onToggle={() => onToggle(row.key)}
          />
        ))}
      </SeriesSelector>
      {downloadAction}
    </aside>
  );
}
```

- [ ] **Step 4: Write `inflation-table.tsx`**

```tsx
"use client";

import { formatInflationValue, MONTH_NUMBERS, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import { MOM_BINS, YOY_BINS, buildMonthGrid, decemberAverages, legendLabels } from "../../lib/explorer/inflationGrid";
import { effectiveTableSeries, seriesValues, tableSeriesOptions, type InflationIndex, type InflationSeriesKey, type InflationState, type ResolvedPeriodRange } from "../../lib/explorer/inflationOverview";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { MonthGridTable } from "../main-explorer/month-grid-table";
import { TextTab } from "../ui/editorial";

// ცხრილი: one series at a time (spec §7.1); several selected series get a picker.
export function InflationTable({ index, state, range, onTableSeriesChange }: {
  index: InflationIndex;
  state: InflationState;
  range: ResolvedPeriodRange;
  onTableSeriesChange: (key: InflationSeriesKey) => void;
}) {
  const { messages } = useI18n();
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const active = effectiveTableSeries(index, state);
  if (active === null) return null;
  const options = tableSeriesOptions(index, state);
  const edges = state.tab === "yoy" ? YOY_BINS : state.tab === "mom" ? MOM_BINS : null;
  const summaryByYear = state.tab === "yoy" && active === "cpi" ? decemberAverages(index.values.get("cpi.headline:avg12_pct")) : undefined;
  const rows = buildMonthGrid({ values: seriesValues(index, active, state.tab)!, range, edges, summaryByYear });

  return (
    <MonthGridTable
      caption={t("tableCaption", {
        series: seriesLabel(messages, active, state.tab),
        tab: t(`tab.${state.tab}`),
        unit: t(`unit.${state.tab}`),
        start: periodLabel(messages, range.start, "short"),
        end: periodLabel(messages, range.end, "short"),
      })}
      yearLabel={t("year")}
      monthLabels={MONTH_NUMBERS.map((month) => message(messages, `inflation.monthShort.${month}`))}
      monthNames={MONTH_NUMBERS.map((month) => message(messages, `inflation.month.${month}`))}
      summaryLabel={summaryByYear ? t("annualAverage") : undefined}
      rows={rows}
      formatValue={(value) => formatInflationValue(value, state.tab)}
      legend={edges ? legendLabels(edges).map((label, tint) => ({ label, tint })) : null}
      legendLabel={t("legend")}
      picker={options.length > 1 ? (
        <div role="group" aria-label={t("tableSeries")} data-testid="inflation-table-series" className="flex flex-wrap gap-5">
          {options.map((key) => (
            <TextTab key={key} testId={`inflation-table-series-${key}`} label={seriesLabel(messages, key, state.tab)} active={key === active} onClick={() => onTableSeriesChange(key)} />
          ))}
        </div>
      ) : null}
    />
  );
}
```

- [ ] **Step 5: Write `inflation-indicators.tsx`**

```tsx
"use client";

import type { ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { periodMonth } from "../../lib/data/inflation/periods";
import { formatShare } from "../../lib/explorer/format";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { INFLATION_COLORS, latestIndicators, type InflationIndex } from "../../lib/explorer/inflationOverview";
import { Message } from "../../lib/i18n/message";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { HeroKpi, SideKpiList, type SideKpi } from "../main-explorer/kpi-blocks";
import { SectionTitle } from "../ui/editorial";

// ძირითადი ინდიკატორები for inflation: always the latest published month,
// regardless of tab or range (spec §6). No movers, no period comparison, and
// no good/bad colour — the gauge measures against the target in force.

const GAUGE_MAX = 15;
const pct = (value: number | null, signed = false) => formatShare(value === null ? null : value / 100, signed);
const mono = (text: string) => <span className="font-[family-name:var(--font-numeric)] text-xs">{text}</span>;

function TargetGauge({ value, target }: { value: number; target: number | null }) {
  const { messages } = useI18n();
  const position = (level: number) => Math.max(0, Math.min(100, (level / GAUGE_MAX) * 100));
  const inkWidth = target === null ? position(value) : position(Math.min(value, target));
  const accentWidth = target === null ? 0 : Math.max(0, position(value) - position(target));
  return (
    <div data-testid="inflation-gauge">
      <div className="relative flex h-[3px] bg-[var(--hairline-soft)]">
        <div className="h-[3px] bg-[var(--ink)]" style={{ width: `${inkWidth.toFixed(1)}%` }} />
        <div className="h-[3px] bg-[var(--accent)]" style={{ width: `${accentWidth.toFixed(1)}%` }} />
        {target !== null ? (
          <span aria-hidden className="absolute -top-1.5 h-[15px] border-l border-dashed border-[var(--accent)]" style={{ left: `${position(target).toFixed(1)}%` }} />
        ) : null}
      </div>
      <div className="relative mt-2 h-4 font-[family-name:var(--font-numeric)] text-[11px] text-[var(--muted)]">
        <span className="absolute left-0">0%</span>
        {target !== null ? (
          <span className="absolute -translate-x-1/2 whitespace-nowrap text-[var(--accent)]" style={{ left: `${position(target).toFixed(1)}%` }}>
            {message(messages, "inflation.gaugeTarget", { target: formatShare(target / 100, false, 0) })}
          </span>
        ) : null}
        <span className="absolute right-0">{GAUGE_MAX}%</span>
      </div>
    </div>
  );
}

export function InflationIndicators({ index, targets }: { index: InflationIndex; targets: ServedInflationTargetRow[] }) {
  const { messages } = useI18n();
  const latest = latestIndicators(index, targets);
  if (!latest) return null;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const month = periodMonth(latest.period);
  const previousMonth = periodMonth(latest.period - 1);
  const delta = latest.target === null ? null : latest.yoy - latest.target;

  const sideKpis: SideKpi[] = [
    { label: t("kpiCore"), value: pct(latest.coreYoy), unit: "", color: "var(--ink)", detail: t("kpiCoreDetail"), spark: { values: latest.sparks.coreYoy, color: INFLATION_COLORS.core } },
    {
      label: t("kpiMonthly"),
      value: pct(latest.mom, true),
      unit: "",
      color: "var(--ink)",
      detail: t("kpiMonthlyDetail", { monthWith: message(messages, `inflation.monthWith.${previousMonth}`) }),
      spark: { values: latest.sparks.mom, color: INFLATION_COLORS.cpi },
    },
    { label: t("kpiAvg12"), value: pct(latest.avg12), unit: "", color: "var(--ink)", detail: t("kpiAvg12Detail"), spark: { values: latest.sparks.avg12, color: INFLATION_COLORS.cpi } },
  ];

  return (
    <section data-testid="inflation-indicators" className="mt-12 border-t-2 border-[var(--ink)] pt-[22px]">
      <SectionTitle>{message(messages, "main.indicators")}</SectionTitle>
      <div data-testid="period-kpi-cards" className="mt-[26px] grid @min-[1100px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <HeroKpi label={`${t("tab.yoy")} · ${periodLabel(messages, latest.period, "long")}`} value={pct(latest.yoy)}>
          <TargetGauge value={latest.yoy} target={latest.target} />
          <p className="mt-4 text-[12.5px] leading-relaxed text-[var(--body)]">
            <Message
              messages={messages}
              id={latest.yoy >= 0 ? "inflation.heroRise" : "inflation.heroFall"}
              values={{ monthIn: message(messages, `inflation.monthIn.${month}`), monthWith: message(messages, `inflation.monthWith.${month}`), value: mono(pct(Math.abs(latest.yoy))) }}
            />
            {delta !== null ? (
              <>
                {" "}
                <Message
                  messages={messages}
                  id={Math.abs(delta) < 0.05 ? "inflation.targetAt" : delta > 0 ? "inflation.targetAbove" : "inflation.targetBelow"}
                  values={{ target: mono(formatShare(latest.target! / 100, false, 0)), delta: mono(`${Math.abs(delta).toFixed(1)} ${t("pp")}`) }}
                />
              </>
            ) : null}
            {latest.coreYoy !== null ? (
              <>
                {" "}
                <Message messages={messages} id="inflation.coreSentence" values={{ core: mono(pct(latest.coreYoy)) }} />
              </>
            ) : null}
          </p>
        </HeroKpi>
        <SideKpiList kpis={sideKpis} />
      </div>
    </section>
  );
}
```

`message()` throws only on a placeholder with no value, never on an unused value, so passing `delta` to `targetAt` is safe.

- [ ] **Step 6: Write `inflation-overview.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { periodMonth, periodYear } from "../../lib/data/inflation/periods";
import type { ServedCpiFact, ServedInflationTargetRow } from "../../lib/data/inflation/types";
import { formatDisplayDate } from "../../lib/explorer/format";
import { formatInflationValue, periodLabel, seriesLabel } from "../../lib/explorer/inflationLabels";
import {
  DEFAULT_INFLATION_STATE, INFLATION_COLORS, INFLATION_TABS, buildInflationLines, changeInflationTab, headlinePoint, indexInflationFacts,
  overallCoverage, parseInflationHash, rangeFromPatch, resolveInflationRange, serializeInflationHash, toggleSelection,
  type InflationState, type InflationTab,
} from "../../lib/explorer/inflationOverview";
import { buildInflationWorkbookExportModel, type InflationWorkbookSource } from "../../lib/explorer/inflationWorkbook";
import { downloadWorkbook } from "../../lib/explorer/workbookWriter.client";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { pageHref } from "../../lib/i18n/routes";
import { ExcelDownloadButton } from "../explorer/excel-download-button";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { RangeStrip } from "../main-explorer/range-strip";
import { PageHeader } from "../shell/page-header";
import { Callout, SegmentedTabs, SourceNote, TextTab } from "../ui/editorial";
import { InflationIndicators } from "./inflation-indicators";
import { InflationSeriesPanel } from "./inflation-series-panel";
import { InflationTable } from "./inflation-table";

// Inflation overview (spec §6): the GDP overview's centred tabs over the Budget
// explorers' workspace — chart or monthly table, range strip and series panel.

const INDEX_UNIT = { divisor: 1, label: "", decimals: 1 };

export type InflationOverviewProps = {
  facts: ServedCpiFact[];
  targets: ServedInflationTargetRow[];
  sources: InflationWorkbookSource[];
  siteOrigin: string;
};

export function InflationOverview({ facts, targets, sources, siteOrigin }: InflationOverviewProps) {
  const presentation = useI18n();
  const { messages, locale } = presentation;
  const t = (key: string, values?: Record<string, string>) => message(messages, `inflation.${key}`, values);
  const index = useMemo(() => indexInflationFacts(facts), [facts]);
  const [state, setState] = useState<InflationState>(DEFAULT_INFLATION_STATE);
  const [ready, setReady] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const parsed = parseInflationHash(window.location.hash);
    // The hash is read after hydration so the server render stays the stable default view.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(changeInflationTab(parsed, parsed.tab, index));
    setReady(true);
    document.body.dataset.appReady = "true";
    return () => {
      delete document.body.dataset.appReady;
    };
  }, [index]);

  useEffect(() => {
    if (ready) history.replaceState(null, "", `#${serializeInflationHash(state)}`);
  }, [ready, state]);

  const range = resolveInflationRange(state, index);
  const { periods, lines } = buildInflationLines(index, targets, state, range);
  const tabPeriods = Array.from({ length: range.max - range.min + 1 }, (_, offset) => range.min + offset);
  const headline = headlinePoint(index, state, range);
  const coverage = overallCoverage(index);
  const lastReviewedAt = facts.map((fact) => fact.lastReviewedAt).sort().at(-1) ?? "";
  const displayDate = locale === "en" ? formatDisplayDate(lastReviewedAt, locale) : lastReviewedAt;
  const hasSeries = lines.some((line) => line.key !== "target");
  const chartSeries: ChartSeries[] = lines.map((line) => ({
    id: line.key,
    label: seriesLabel(messages, line.key, state.tab),
    color: INFLATION_COLORS[line.key],
    vals: line.values,
    planned: line.values.map(() => false),
    dashed: line.key === "target",
  }));

  function selectTab(tab: InflationTab) {
    const next = changeInflationTab(state, tab, index);
    const nextRange = resolveInflationRange(next, index);
    setState(next);
    setAnnouncement(t("rangeChanged", { start: periodLabel(messages, nextRange.start, "short"), end: periodLabel(messages, nextRange.end, "short") }));
  }

  return (
    <main data-testid="inflation-overview" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: message(messages, "common.home"), href: pageHref("/", locale) },
            { label: message(messages, "common.data") },
            { label: message(messages, "common.inflation"), href: pageHref("/explorer/inflation", locale) },
            { label: t("heading") },
          ]}
          coverage={`${periodLabel(messages, coverage.min, "short")} – ${periodLabel(messages, coverage.max, "short")} · ${message(messages, "main.updated", { date: displayDate })}`}
        />
        <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
          {t("heading")}
        </h1>
        <p data-testid="inflation-headline" className="mb-2 min-h-[18px] text-[13px] text-[var(--body)]">
          {headline ? (
            <>
              {periodLabel(messages, headline.period, "long")}: {t(`tab.${state.tab}`)} ·{" "}
              <span className="font-[family-name:var(--font-numeric)] font-medium text-[var(--ink)]">{formatInflationValue(headline.value, state.tab)}</span>
            </>
          ) : null}
        </p>
        <p data-testid="inflation-unit" className="mb-[30px] text-[13px] text-[var(--muted)]">{t(`unit.${state.tab}`)}</p>

        <div
          data-testid="inflation-tabs"
          role="group"
          aria-label={t("tabs")}
          className="mb-7 overflow-x-auto py-2"
          onFocusCapture={(event) => event.target.scrollIntoView({ block: "nearest", inline: "nearest" })}
        >
          <div className="mx-auto flex w-max gap-7 px-1">
            {INFLATION_TABS.map((tab) => (
              <TextTab key={tab} testId={`inflation-tab-${tab}`} label={t(`tab.${tab}`)} active={state.tab === tab} onClick={() => selectTab(tab)} />
            ))}
          </div>
        </div>
        <p role="status" className="sr-only">{announcement}</p>

        <div data-testid="explorer-workspace" className="grid items-start gap-8 @min-[1100px]:grid-cols-[minmax(0,1fr)_292px] @min-[1100px]:gap-10">
          <div className="flex min-w-0 flex-col">
            <section data-testid="chart-panel" data-mode={state.mode} data-tab={state.tab} className="border-t border-[var(--ink)] pt-4">
              <SegmentedTabs<InflationState["mode"]>
                ariaLabel={message(messages, "controls.viewMode")}
                value={state.mode}
                onChange={(mode) => setState((current) => ({ ...current, mode }))}
                options={[
                  { value: "line", label: message(messages, "controls.chart"), testId: "chart-mode-line" },
                  { value: "table", label: message(messages, "controls.table"), testId: "chart-mode-table" },
                ]}
              />
              {!hasSeries ? (
                <div className="mt-5">
                  <Callout testId="no-selection-callout">{message(messages, "main.noSelection")}</Callout>
                </div>
              ) : state.mode === "table" ? (
                <InflationTable index={index} state={state} range={range} onTableSeriesChange={(key) => setState((current) => ({ ...current, tableSeries: key }))} />
              ) : (
                <div className="mt-5">
                  <EditorialLineChart
                    years={periods}
                    series={chartSeries}
                    share={state.tab !== "index"}
                    unit={INDEX_UNIT}
                    shareLabel={t(`tab.${state.tab}`)}
                    periodsPerYear={12}
                    formatPeriod={(period, kind) =>
                      kind === "axis" && periodMonth(period) === 1 ? String(periodYear(period)) : periodLabel(messages, period, kind === "axis" ? "short" : "long")
                    }
                  />
                </div>
              )}
              <RangeStrip
                years={tabPeriods}
                range={range}
                periodsPerYear={12}
                formatPeriod={(period) => periodLabel(messages, period, "short")}
                onChange={(patch) => setState((current) => ({ ...current, range: rangeFromPatch(range, patch) }))}
              />
            </section>
            <div className="mt-[18px] space-y-2">
              <SourceNote testId="source-label">
                {t("source")} {message(messages, "main.lastUpdated", { date: displayDate })}
              </SourceNote>
              <Link href={pageHref("/methodology/inflation", locale)} className="text-xs text-[var(--muted)] underline underline-offset-4">
                {t("methodology")}
              </Link>
            </div>
          </div>

          <InflationSeriesPanel
            index={index}
            targets={targets}
            state={state}
            range={range}
            onToggle={(key) => setState((current) => toggleSelection(current, key))}
            onClear={() => setState((current) => ({ ...current, selected: [] }))}
            downloadAction={
              <ExcelDownloadButton
                testId="inflation-download"
                disabled={!hasSeries}
                onDownload={() => downloadWorkbook(buildInflationWorkbookExportModel({ index, targets, state, range, presentation, sources, siteOrigin }))}
              />
            }
          />
        </div>

        <InflationIndicators index={index} targets={targets} />
      </div>
    </main>
  );
}
```

Check `SegmentedTabs`' generic signature and `ExcelDownloadButton`'s props against the merged files; the calls above match `main` at `e3f2723cf` plus GDP's optional `ariaLabel` field.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/explorer/inflationOverviewRender.test.tsx`
Expected: PASS (4 tests). Then `npm run typecheck` and `npm run lint` — expected: clean (the one `eslint-disable-next-line` mirrors the GDP overview's hash effect).

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/inflation apps/web/tests/explorer/inflationOverviewRender.test.tsx
git commit -m "feat(inflation): overview page with tabs, chart, table, panel and indicators" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: Routes, hub, sidebar and SEO

**Files:**
- Create: `apps/web/lib/explorer/inflationHubCards.ts`
- Create: `apps/web/lib/pages/inflation.tsx`
- Create: `apps/web/app/(ka)/explorer/inflation/page.tsx`, `apps/web/app/(ka)/explorer/inflation/overview/page.tsx`
- Create: `apps/web/app/(en)/en/explorer/inflation/page.tsx`, `apps/web/app/(en)/en/explorer/inflation/overview/page.tsx`
- Modify: `apps/web/components/shell/data-sidebar.tsx`, `apps/web/components/shell/explorer-footer.tsx`
- Modify: `apps/web/lib/i18n/messages/{ka,en}/common.json`
- Modify: `apps/web/lib/i18n/inventory.server.ts`, `apps/web/lib/seo/sitemap.ts`, `data/localization/en/page-revisions.json`
- Modify: `apps/web/tests/seo/routes.test.ts` (count)
- Test: `apps/web/tests/explorer/inflationHub.test.ts`

**Interfaces:**
- Consumes: Tasks 4, 8, 10, 11.
- Produces: `buildInflationHubCards(facts: ServedCpiFact[], presentation: Presentation): HubCardModel[]`; `inflationHubMetadata`, `renderInflationHub`, `inflationOverviewMetadata`, `renderInflationOverview` (each `(locale: Locale)`); messages `common.inflationOverview`, `common.dataInflation`, `common.inflationSourceNote`; sidebar test IDs `inflation-link`, `inflation-overview-link`.

- [ ] **Step 1: Write the failing test**

`apps/web/tests/explorer/inflationHub.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { periodFromKey } from "../../lib/data/inflation/periods";
import { buildInflationHubCards } from "../../lib/explorer/inflationHubCards";
import { periodLabel } from "../../lib/explorer/inflationLabels";
import { getMessages } from "../../lib/i18n/messages.server";

describe("inflation hub", () => {
  it("links only the delivered overview and marks the rest as coming soon", async () => {
    const { facts } = await loadServedInflationData();
    const messages = await getMessages("en", ["inflation"]);
    const cards = buildInflationHubCards(facts, { locale: "en", messages, englishLabels: {} });
    expect(cards.map((card) => card.href)).toEqual(["/explorer/inflation/overview", null, null, null, null]);
    expect(cards.map((card) => card.title)).toEqual(["Inflation overview", "Categories", "Consumer basket", "Cities", "Products"]);
    expect(cards.slice(1).every((card) => card.comingSoon && card.series === null && card.footer === null)).toBe(true);
    const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct");
    const last = yoy.reduce((latest, fact) => (fact.period > latest.period ? fact : latest));
    expect(cards[0]!.footer).toBe(`${periodLabel(messages, periodFromKey(last.period), "long")} · ${(last.value).toFixed(1)}%`);
    expect(cards[0]!.series).toHaveLength(yoy.length);
  });
});
```

(`toFixed(1)` equals `formatShare` for the positive values in these files; if the latest y/y is ever negative, compare against `formatShare(last.value / 100)` instead.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/explorer/inflationHub.test.ts`
Expected: FAIL — `inflationHubCards` missing.

- [ ] **Step 3: Write `inflationHubCards.ts`**

```ts
import { periodFromKey } from "../data/inflation/periods";
import type { ServedCpiFact } from "../data/inflation/types";
import { message } from "../i18n/messages";
import type { Presentation } from "../i18n/types";
import { INK } from "./colors";
import { formatShare } from "./format";
import type { HubCardModel } from "./hubCards";
import { periodLabel } from "./inflationLabels";

// Inflation hub cards reuse the budget card anatomy (DESIGN.md §6.6). Only the
// overview is delivered; the other four sections are coming-soon markers with
// no routes, as on the Economy hub. Figures come from served facts at build time.

const COMING_SOON = ["Categories", "Basket", "Cities", "Products"] as const;

export function buildInflationHubCards(facts: ServedCpiFact[], presentation: Presentation): HubCardModel[] {
  const t = (key: string) => message(presentation.messages, `inflation.${key}`);
  const yoy = facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct").sort((a, b) => a.period.localeCompare(b.period));
  const last = yoy.at(-1);
  return [
    {
      index: "01",
      title: t("heading"),
      description: t("description"),
      href: "/explorer/inflation/overview",
      comingSoon: false,
      series: yoy.map((fact) => fact.value),
      seriesColor: INK,
      footer: last ? `${periodLabel(presentation.messages, periodFromKey(last.period), "long")} · ${formatShare(last.value / 100)}` : null,
    },
    ...COMING_SOON.map((name, offset) => ({
      index: `0${offset + 2}`,
      title: t(`card${name}`),
      description: t(`card${name}Description`),
      href: null,
      comingSoon: true,
      series: null,
      seriesColor: null,
      footer: null,
    })),
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/explorer/inflationHub.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the page renderers**

`apps/web/lib/pages/inflation.tsx`:

```tsx
import path from "node:path";
import { BudgetHub } from "../../components/hub/budget-hub";
import { InflationOverview } from "../../components/inflation/inflation-overview";
import { BreadcrumbJsonLd } from "../../components/seo/breadcrumb-json-ld";
import { PageHeader } from "../../components/shell/page-header";
import { loadServedInflationData } from "../data/inflation/importInflation";
import { periodFromKey, periodYear } from "../data/inflation/periods";
import { buildInflationHubCards } from "../explorer/inflationHubCards";
import type { InflationWorkbookSource } from "../explorer/inflationWorkbook";
import { loadEnglishCatalogue } from "../i18n/catalogue.server";
import { getMessages } from "../i18n/messages.server";
import { message } from "../i18n/messages";
import { getPresentation } from "../i18n/presentation.server";
import { I18nProvider } from "../i18n/provider";
import { pageHref } from "../i18n/routes";
import type { Locale } from "../i18n/types";
import { projectPublicSources } from "../methodology/publicSources";
import { loadReviewedSourceManifest } from "../methodology/sourceManifest";
import { fiscalMetadata } from "../seo/metadata";
import { resolveSiteUrl } from "../siteUrl";

const HUB_PATH = "/explorer/inflation";
const OVERVIEW_PATH = "/explorer/inflation/overview";
const repositoryRoot = () => path.resolve(/* turbopackIgnore: true */ process.cwd(), "../..");

export async function inflationHubMetadata(locale: Locale) {
  const messages = await getMessages(locale, ["inflation"]);
  return fiscalMetadata({ locale, path: HUB_PATH, title: message(messages, "inflation.hubMetaTitle"), description: message(messages, "inflation.hubDescription") });
}

export async function renderInflationHub(locale: Locale) {
  const [{ facts }, presentation] = await Promise.all([loadServedInflationData(), getPresentation(locale, ["inflation", "common"], [])]);
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd items={[{ name: t("common.home"), path: pageHref("/", locale) }, { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) }]} />
      <main className="px-5 pb-16 min-[768px]:px-[34px]">
        <div className="mx-auto max-w-[1180px]">
          <PageHeader crumbs={[{ label: t("common.home"), href: pageHref("/", locale) }, { label: t("common.data") }, { label: t("common.inflation") }]} coverage="" />
          <h1 className="mt-[34px] mb-3 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[40px]">
            {t("inflation.hubHeading")}
          </h1>
          <p className="mb-[30px] max-w-[640px] text-[13px] text-[var(--body)]">{t("inflation.hubDescription")}</p>
          <BudgetHub cards={buildInflationHubCards(facts, presentation)} locale={locale} testId="inflation-hub" />
        </div>
      </main>
    </I18nProvider>
  );
}

export async function inflationOverviewMetadata(locale: Locale) {
  const [{ facts }, messages] = await Promise.all([loadServedInflationData(), getMessages(locale, ["inflation"])]);
  const years = facts.map((fact) => periodYear(periodFromKey(fact.period)));
  return fiscalMetadata({
    locale,
    path: OVERVIEW_PATH,
    title: message(messages, "inflation.metaTitle", { first: Math.min(...years), last: Math.max(...years) }),
    description: message(messages, "inflation.description"),
  });
}

export async function renderInflationOverview(locale: Locale) {
  const root = repositoryRoot();
  const [{ facts, targets }, presentation, manifest, catalogue] = await Promise.all([
    loadServedInflationData(),
    getPresentation(locale, ["inflation", "common", "controls", "format", "main"], []),
    loadReviewedSourceManifest(root, "inflation"),
    loadEnglishCatalogue(root),
  ]);
  const projected = projectPublicSources(manifest, locale, catalogue.documents);
  // Archive rows ending in "_ka" are the Georgian twins of the English source files.
  const sources: InflationWorkbookSource[] = manifest.map((row) => {
    const shown = projected.find((entry) => entry.source_id === row.source_id)!;
    return {
      sourceId: row.source_id.replace(/_ka$/, ""),
      language: row.source_id.endsWith("_ka") ? "ka" : "en",
      years: row.years,
      title: shown.title,
      organization: shown.publisher,
      downloadHref: row.downloadHref,
      retrievedAt: row.retrieved_at,
    };
  });
  const t = (key: string) => message(presentation.messages, key);
  return (
    <I18nProvider {...presentation}>
      <BreadcrumbJsonLd
        items={[
          { name: t("common.home"), path: pageHref("/", locale) },
          { name: t("common.inflation"), path: pageHref(HUB_PATH, locale) },
          { name: t("inflation.heading"), path: pageHref(OVERVIEW_PATH, locale) },
        ]}
      />
      <InflationOverview facts={facts} targets={targets} sources={sources} siteOrigin={resolveSiteUrl()} />
    </I18nProvider>
  );
}
```

`loadReviewedSourceManifest(root, "inflation")` needs Task 13's archive CSV and `LIVE_METHODOLOGY_IDS` entry; until Task 13, the overview route fails to build. Tasks 12 and 13 are therefore committed separately but built together in Task 13, Step 10.

- [ ] **Step 6: Add the four routes**

`apps/web/app/(ka)/explorer/inflation/page.tsx`:

```tsx
import { inflationHubMetadata, renderInflationHub } from "../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationHubMetadata("ka");
}

export default function Page() {
  return renderInflationHub("ka");
}
```

`apps/web/app/(ka)/explorer/inflation/overview/page.tsx`: the same with `inflationOverviewMetadata` / `renderInflationOverview` and one more `../`. The two English files under `app/(en)/en/explorer/inflation/` pass `"en"` and have one more `../` again. Copy the relative depth from the merged `economy` and `economy/gdp` routes.

- [ ] **Step 7: Sidebar, rail label and footer**

`lib/i18n/messages/ka/common.json`: `"common.inflationOverview": "ინფლაციის მიმოხილვა"`, `"common.dataInflation": "მონაცემები · ინფლაცია"`, `"common.inflationSourceNote": "მონაცემები: საქსტატი და საქართველოს ეროვნული ბანკი. ბოლო განახლება: {updatedAt}."`.
`lib/i18n/messages/en/common.json`: `"common.inflationOverview": "Inflation overview"`, `"common.dataInflation": "Data · Inflation"`, `"common.inflationSourceNote": "Data: Geostat and the National Bank of Georgia. Last updated: {updatedAt}."`.

`components/shell/data-sidebar.tsx` (written against the GDP branch; keep the merged file's structure):

- `const TEASERS = ["unemployment", "demography"];`
- Beside `economyActive`: `const inflationActive = pathname.includes("/explorer/inflation");` and `const budgetActive = !economyActive && !inflationActive;`
- Rail label: `message(messages, inflationActive ? "common.dataInflation" : economyActive ? "common.dataEconomy" : "common.dataBudget")`.
- Budget link: its active/inactive class switch keys on `budgetActive` instead of `!economyActive`; `{budgetActive ? <SectionNav /> : null}`.
- After the Economy link and its GDP sub-link, add:

```tsx
            <Link
              href={pageHref("/explorer/inflation", locale)}
              data-testid="inflation-link"
              aria-current={pathname.endsWith("/explorer/inflation") ? "page" : undefined}
              className={`flex items-baseline gap-2 border-l-2 px-2.5 py-2 text-[12.5px] font-semibold no-underline ${inflationActive ? "border-[var(--accent)] bg-[rgba(247,242,233,0.07)] text-[var(--paper)]" : "border-transparent text-[var(--ink-fg-muted)]"}`}
            >
              {message(messages, "common.inflation")}
            </Link>
            {inflationActive ? (
              <Link
                href={pageHref("/explorer/inflation/overview", locale)}
                data-testid="inflation-overview-link"
                aria-current={pathname.endsWith("/explorer/inflation/overview") ? "page" : undefined}
                className="ml-[18px] py-[5px] pl-2 text-[12px] text-[var(--paper)] no-underline"
              >
                {message(messages, "common.inflationOverview")}
              </Link>
            ) : null}
```

Match the Economy rows' classes exactly as merged (if GDP's final sub-link gained `SectionNav`-style active styling, use the same). The collapse, keyboard and mobile sheet behaviour are the sidebar's own and need no change.

`components/shell/explorer-footer.tsx`: add `const inflation = pathname === "/explorer/inflation" || pathname.startsWith("/explorer/inflation/");` and pass `sourceNote` as `common.inflationSourceNote` when `inflation`, else the existing economy/undefined logic.

- [ ] **Step 8: Inventory, sitemap, revisions**

`lib/i18n/inventory.server.ts` `listPublicPagePaths`: add `"/explorer/inflation", "/explorer/inflation/overview"` after the economy paths.

`lib/seo/sitemap.ts`: load `const { facts: inflationFacts } = await loadServedInflationData();` with the other loads, `const inflationModified = new Date(inflationFacts.map((fact) => fact.lastReviewedAt).sort().at(-1)!);`, and add after the economy entries:

```ts
    { url: `${siteUrl}/explorer/inflation`, lastModified: inflationModified },
    { url: `${siteUrl}/explorer/inflation/overview`, lastModified: inflationModified },
```

`data/localization/en/page-revisions.json`: `"/explorer/inflation": "<YYYY-MM-DD>"`, `"/explorer/inflation/overview": "<YYYY-MM-DD>"` (today).

`tests/seo/routes.test.ts`: raise the sitemap URL count by 4 (two pages × two languages; 188 → 192 on top of GDP).

- [ ] **Step 9: Verify**

Run: `npx vitest run tests/explorer/inflationHub.test.ts tests/seo/routes.test.ts` and `npm run i18n:check` and `npm run typecheck`.
Expected: PASS / valid / clean. (The routes test only enumerates the sitemap; the overview route's archive dependency is exercised in Task 13.)

- [ ] **Step 10: Commit**

```bash
git add apps/web/app apps/web/lib apps/web/components/shell apps/web/tests data/localization/en/page-revisions.json
git commit -m "feat(inflation): hub, overview routes, sidebar dataset and sitemap" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 13: Methodology page, source archive and internal doc

**Files:**
- Create: `data/methodology/source-archives/inflation.csv`
- Create: `apps/web/lib/methodology/content/inflation.ts`, `apps/web/lib/methodology/content/en/inflation.ts`
- Modify: `apps/web/lib/methodology/types.ts`, `catalog.ts`, `sourceInventory.ts`, `content/en/revisions.ts`
- Modify: `apps/web/components/methodology/methodology-hub.tsx`, `apps/web/lib/pages/methodology-article.tsx`
- Modify: `data/localization/en/documents.json`, `data/localization/{ka,en}/service-messages.json`, `data/localization/en/page-revisions.json`
- Modify: `apps/web/tests/methodology/catalog.test.ts`, `apps/web/tests/methodology/prepareArchives.test.ts`, `apps/web/tests/seo/routes.test.ts`
- Create: `docs/data-methodology/inflation-cpi-national.md`

**Interfaces:**
- Consumes: Task 1 archive files; the GDP branch's `coverageSource: { kind: "archive" }`.
- Produces: `LIVE_METHODOLOGY_IDS` includes `"inflation"`; `/methodology/inflation` and `/en/methodology/inflation`; `/downloads/data/inflation-cpi-national.csv` linked as processed data.

- [ ] **Step 1: Update the catalog tests first (failing)**

In `tests/methodology/catalog.test.ts`, following GDP's edits: `LIVE_METHODOLOGY_IDS` expectation gains `"inflation"` (last); `FUTURE_METHODOLOGY_DATASETS` expectation loses the `ინფლაცია` entry; both archive-summary fixtures gain `inflation: { fileCount: 14, totalBytes: 100, latestRetrievedAt: "<YYYY-MM-DD>", validated: true, minYear: 2000, maxYear: 2026 }`; the hub-entries expectation gains `{ id: "inflation", title: METHODOLOGY_CONTENT.inflation.title, summary: METHODOLOGY_CONTENT.inflation.summary, href: "/methodology/inflation", coverage: { firstYear: 2000, lastYear: 2026 }, originalFileCount: 14, reviewedAt: METHODOLOGY_CONTENT.inflation.reviewedAt }`; add `expect(METHODOLOGY_CONTENT.inflation.slug).toBe("inflation");`.

In `tests/methodology/prepareArchives.test.ts`, the fixture repository gains
`inflation: [await writeReviewedSource(repositoryRoot, "inflation", "2000-2026", "docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-index-2010.xlsx", "downloads/methodology/inflation/files/2026-08/en/cpi-index-2010.xlsx", "inflation-index")],`.

In `tests/seo/routes.test.ts`, raise the sitemap count by 2 more (192 → 194).

Run: `npx vitest run tests/methodology/catalog.test.ts tests/methodology/prepareArchives.test.ts`
Expected: FAIL — `inflation` is not a live methodology id.

- [ ] **Step 2: Write the archive manifest**

`data/methodology/source-archives/inflation.csv` (UTF-8 with BOM, same header as `gdp.csv`). Fourteen rows — the twelve Geostat files and the two NBG files — built from the Task 1 manifests. Row shape:

```csv
source_id,dataset_id,year,source_organization,display_title_ka,official_filename,official_url_or_archive_url,repository_source_path,public_download_path,media_type,byte_size,sha256,retrieved_at,retrieved_at_basis,license_id,attribution_text,redistribution_status,notes
source.geostat_cpi_index_2010,inflation,2000-2026,საქსტატი,"სამომხმარებლო ფასების ინდექსი, 2010 წლის საშუალო = 100 (ინგლისური)",consumer-price-index-2010=100.xlsx,<retrieved_file_url>,docs/Raw Data/Inflation/geostat-cpi/2026-08/en/cpi-index-2010.xlsx,downloads/methodology/inflation/files/2026-08/en/cpi-index-2010.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,<bytes>,<sha256>,<retrieved_at>,source_manifest,official-public-document-no-explicit-license,Geostat,repository_owner_approved,National CPI overview original source; vintage 2026-08.
```

- `year`: index `2000-2026`; y/y and m/m `2004-2026`; avg12 `2002-2026`; both core files `2010-2026`; NBG `2015-2026` (or the earliest verified target year).
- Georgian rows: `source_id` with `_ka`, `display_title_ka` ending `(ქართული)`, public path under `…/2026-08/ka/`.
- NBG rows: `source_organization` `საქართველოს ეროვნული ბანკი`, `attribution_text` `National Bank of Georgia`, `media_type` `text/html` (or `application/pdf`), public path `downloads/methodology/inflation/files/nbg/<file>`.
- `official_filename`: Geostat's original filename from Task 1 Step 1 (decoded), not the stable local name.

- [ ] **Step 3: Register the dataset**

- `lib/methodology/types.ts`: append `"inflation"` to `LIVE_METHODOLOGY_IDS`.
- `lib/methodology/sourceInventory.ts` `inventoryRules`: `inflation: [{ root: "docs/Raw Data/Inflation", include: (candidatePath: string) => [".xlsx", ".html", ".pdf"].includes(path.posix.extname(candidatePath).toLowerCase()) }],`.
- `lib/methodology/catalog.ts`: import both content files; add `inflation` to `METHODOLOGY_CONTENT` and `ENGLISH_METHODOLOGY_CONTENT`; remove `{ title: "ინფლაცია", href: null, state: "future" }` from `FUTURE_METHODOLOGY_DATASETS`.
- `lib/methodology/content/en/revisions.ts`: `inflation: "<YYYY-MM-DD>",`.
- `components/methodology/methodology-hub.tsx`: drop `"inflation"` from the future-row key list.

- [ ] **Step 4: Write the Georgian methodology content**

`apps/web/lib/methodology/content/inflation.ts`:

```ts
import type { MethodologyContent } from "../types";

export const INFLATION_METHODOLOGY_CONTENT: MethodologyContent = {
  id: "inflation",
  slug: "inflation",
  title: "ინფლაცია",
  summary: "საქართველოს სამომხმარებლო ფასების ინდექსი: წლიური და თვიური ინფლაცია, ფასების ინდექსი და საბაზო ინფლაცია, ეროვნული ბანკის მიზნობრივ მაჩვენებელთან ერთად.",
  reviewedAt: "<YYYY-MM-DD>",
  archiveManifestId: "inflation",
  coverageSource: { kind: "archive" },
  canonicalDocuments: ["docs/data-methodology/inflation-cpi-national.md"],
  disclosure: "მონაცემები საქსტატის გამოქვეყნებული მნიშვნელობებია; Fiscal.ge არ ითვლის და არ ასწორებს ინფლაციის მაჩვენებლებს.",
  keyFacts: [
    { label: "მოცვა", valueKind: "coverage" },
    { label: "სიხშირე", valueKind: "frequency", value: "თვიური" },
    { label: "ერთეული", valueKind: "unit", value: "% / ინდექსი, 2010 = 100" },
  ],
  sections: [
    {
      id: "scope",
      kind: "scope",
      title: "მოცვა და მაჩვენებლები",
      paragraphs: [
        "ფასების ინდექსი (2010 წლის საშუალო = 100) 2000 წლის იანვრიდან; წლიური და თვიური ინფლაცია 2004 წლის იანვრიდან; 12 თვის საშუალო ინფლაცია 2002 წლის იანვრიდან; საბაზო ინფლაცია და საბაზო ინფლაცია თამბაქოს გარეშე 2010 წლის იანვრიდან. ბოლო თვე განისაზღვრება გამოქვეყნებული ფაილებით.",
        "წლიური ინფლაცია ადარებს თვის ფასებს წინა წლის იმავე თვეს; თვიური — წინა თვეს. 12 თვის საშუალო ადარებს ბოლო 12 თვის საშუალო დონეს წინა 12 თვის საშუალოს; დეკემბრის მნიშვნელობა არის წლის საშუალო ინფლაცია.",
        "საბაზო ინფლაცია არ მოიცავს სურსათს და უალკოჰოლო სასმელებს, ენერგიას, რეგულირებად ტარიფებს და ტრანსპორტის სპეციფიკურ ტარიფებს; მეორე ვარიანტი ასევე არ მოიცავს თამბაქოს (საქსტატის განმარტება).",
      ],
    },
    {
      id: "sources",
      kind: "sources",
      title: "წყაროები",
      paragraphs: [
        "საქსტატის სამომხმარებლო ფასების ინდექსის ექვსი ფაილი, მხოლოდ ეროვნული ფურცელი (საქართველო). ინგლისური ფაილები კანონიკურია; ქართული ფაილები ამოწმებს, რომ მნიშვნელობები იდენტურია.",
        "საქსტატი წლიურ, თვიურ და 12 თვის საშუალო ცვლილებას აქვეყნებს ინდექსის სახით (შესადარებელი პერიოდი = 100); Fiscal.ge ინახავს პროცენტულ ცვლილებას, რომელიც ზუსტად უდრის გამოქვეყნებულ ინდექსს გამოკლებული 100.",
        "მიზნობრივი მაჩვენებელი: საქართველოს ეროვნული ბანკი — 5% (2015–2016), 4% (2017), 3% (2018 წლიდან).",
      ],
    },
    {
      id: "validation",
      kind: "validation",
      title: "გადამოწმება და განახლება",
      paragraphs: [
        "ყოველი ფაილის ზომა და SHA-256 მოწმდება; სერიები უწყვეტი თვიურია; ყველა ფაილი ერთსა და იმავე თვეზე მთავრდება; წლიური, თვიური და 12 თვის საშუალო ცვლილება ხელახლა გამოითვლება ფასების ინდექსიდან და 0.2 პროცენტულ პუნქტამდე სიზუსტით ემთხვევა.",
        "საქსტატის პოლიტიკით დაგეგმილი გადასინჯვა არ ხდება. განახლებისას უკვე გამოქვეყნებული ნებისმიერი თვის ცვლილება აჩერებს განახლებას და საჭიროებს განხილვას. განახლება ყოველთვიურია და ხელით მოწმდება.",
      ],
    },
    {
      id: "limitations",
      kind: "limitations",
      title: "შეზღუდვები",
      paragraphs: [
        "ეროვნული ინდექსი ქალაქების ინდექსების შეწონილი საშუალოა. საბაზო ინფლაციისთვის ინდექსის დონე არ ქვეყნდება, ამიტომ ფასების ინდექსის ჩანართზე საბაზო სერიები არ ჩანს. 2004 წელს შეიცვალა COICOP-ის კლასიფიკაცია; ეროვნული ინდექსი 2000 წლიდან შედარებადია.",
        "<pre-2015 target status from Task 1 Step 7, in Georgian>",
      ],
    },
    {
      id: "archive",
      kind: "archive",
      title: "ორიგინალი წყაროები",
      paragraphs: ["ქვემოთ ხელმისაწვდომია საქსტატის Excel ფაილები (ინგლისური და ქართული) და ეროვნული ბანკის წყარო."],
    },
  ],
  decisions: [],
  technicalAppendix: [],
  showTechnicalAppendix: false,
};
```

Replace the `<pre-2015 …>` paragraph with the Task 1 Step 7 outcome, e.g. "2015 წლამდე რიცხობრივი მიზნობრივი მაჩვენებლის არსებობა ჯერ არ არის გადამოწმებული; ამიტომ მიზნობრივი ხაზი 2015 წლიდან იწყება." Do not state that no earlier target existed.

- [ ] **Step 5: Write the English methodology content**

`apps/web/lib/methodology/content/en/inflation.ts`: the same object shape exported as `INFLATION_METHODOLOGY_CONTENT` with English text:

- title `Inflation`; summary `Georgia's consumer price index: annual and monthly inflation, the price index and core inflation, alongside the National Bank of Georgia's inflation target.`
- disclosure `Figures are Geostat's published values; Fiscal.ge does not compute or adjust inflation.`
- keyFacts labels `Coverage`, `Frequency` (`Monthly`), `Unit` (`% / index, 2010 = 100`).
- Sections `Coverage and indicators`, `Sources`, `Validation and updates`, `Limitations`, `Original sources`, each a faithful translation of the Georgian paragraphs above (including the pre-2015 status).

Mirror the English GDP content file's structure. `npm run i18n:check` validates that the two share section ids and counts.

- [ ] **Step 6: Link processed data and the Dataset node**

In `lib/pages/methodology-article.tsx`:

- `DATASET_DOWNLOADS`: `inflation: "/downloads/data/inflation-cpi-national.csv",`
- `DATASET_JSON_DOWNLOADS` and `DATASET_JSON_DISTRIBUTIONS`: `inflation: [],`
- The `dataset === "gdp" ? {…} : datasetJsonLd(…)` branch becomes `dataset === "gdp" || dataset === "inflation" ? {…} : datasetJsonLd(…)`, with the hand-built node's two hardcoded GDP strings generalized: `url: \`${resolveSiteUrl()}${pageHref(\`/methodology/${dataset}\`, locale)}\`` and `contentUrl: \`${resolveSiteUrl()}${DATASET_DOWNLOADS[dataset]}\``. If the merged GDP code already builds this node differently, add `inflation` to whatever mechanism it uses.

- [ ] **Step 7: Localize the archive documents**

For each of the 14 archive `source_id`s, add to `data/localization/en/documents.json` an entry shaped like the GDP ones (`title` = the English Geostat title, or `National Bank of Georgia inflation target`; `publisher` = `Geostat` or `National Bank of Georgia`; `attribution` likewise; `documentLanguage` `en` for English files, `ka` for Georgian files), and to both `service-messages.json` files the matching `documents.<id>.title|publisher|attribution` keys (Georgian values: the `display_title_ka`, `საქსტატი` / `საქართველოს ეროვნული ბანკი`). Add `"/methodology/inflation": "<YYYY-MM-DD>"` to `data/localization/en/page-revisions.json`.

- [ ] **Step 8: Write the internal methodology doc**

`docs/data-methodology/inflation-cpi-national.md`:

```markdown
# Inflation: national CPI (overview)

Owner of: `data/imports/cpi-national-monthly.csv`, `data/imports/nbg-inflation-target.csv`, `docs/Raw Data/Inflation/`, `apps/web/lib/data/inflation/`, `npm run data:prepare-inflation` / `data:check-inflation` / `data:prepare-inflation-public`. Spec: `docs/superpowers/specs/2026-09-11-inflation-overview-design.md`.

## Sources and vintages

Six Geostat CPI workbooks (national sheet only), English canonical and Georgian for value parity, archived per vintage under `docs/Raw Data/Inflation/geostat-cpi/<YYYY-MM>/` (folder = last month covered) with `source-manifest.csv` (URL, date, bytes, SHA-256). NBG target source under `docs/Raw Data/Inflation/nbg-inflation-target/`.

| Series · measure | Geostat file | Stored as | First month |
| --- | --- | --- | --- |
| headline · index_2010 | 2010 average = 100 | level | 2000-01 |
| headline · yoy_pct | same month of previous year = 100 | index − 100 | 2004-01 |
| headline · mom_pct | previous month = 100 | index − 100 | 2004-01 |
| headline · avg12_pct | 12-month average over previous 12-month average | index − 100 | 2002-01 |
| core, core ex tobacco · yoy_pct | core inflation, same month of previous year | as published | 2010-01 |
| core, core ex tobacco · mom_pct | core inflation, previous month | as published | 2010-01 |

Subtracting 100 is exact decimal arithmetic on the published value. Nothing else is derived: no y/y for 2001–2003, no index level for core.

## Definitions

Quote Geostat's core definitions (from the core files' footnotes): core excludes food and non-alcoholic beverages, energy, regulated tariffs and transport (specific tariffs); the second variant also excludes tobacco. The December 12-month average is the calendar-year average inflation shown as the table's `წლის საშუალო`.

## Validation (`prepare-inflation`)

- manifest byte count and SHA-256 for all twelve files;
- content-located parsing (month header, year labels, `Total`/`სულ`, two core rows); English titles checked; layout changes throw;
- contiguous monthly series, unique periods, finite values, one common last month;
- headline y/y, m/m and 12-month average recomputed from the index, max error ≤ 0.2 pp (recorded in `data/reports/inflation-cpi-validation.json`);
- English and Georgian files identical, value by value;
- revision guard: any change to an already-published month (or a removed month) fails and lists the months;
- target rows contiguous, only the last open-ended, source IDs registered.

## NBG target

5% (2015–2016), 4% (2017), 3% (from 2018). Pre-2015 status: <Task 1 Step 7 outcome, with the documents searched>.

## Monthly refresh

Geostat publishes on the 2nd–5th. 1) Download the twelve files into a new vintage folder and write its manifest (Task 1 steps). 2) Update the seven `source-documents.csv` paths and the methodology archive CSV. 3) `npm run data:prepare-inflation`. 4) Review the diff: exactly one new month per series; a revision error is a stop-and-review event. 5) Commit; the standard pipeline imports and deploys. No automated fetching. Retention of old vintages (~3.4 MB each) is an open decision.

## Known limitations

The national index is a weighted mean of city indices. Core has no published index level. The 2004 COICOP break matters for the later category section, not for the national series.

## Serving

`InflationCpiFact` and `InflationTarget` mirror the two CSVs with exact parity in `npm run data:import` (`docs/data-methodology/database-import.md`). The processed-data download `/downloads/data/inflation-cpi-national.csv` is a copy of the canonical CSV made at build time.
```

Fill both `<…>` placeholders from Task 1 Step 7.

- [ ] **Step 9: Regenerate archives and run the tests**

Run: `npm run data:prepare-methodology-archives` then `npx vitest run tests/methodology tests/seo/routes.test.ts` then `npm run i18n:check` and `npm run data:check-methodology-archives`.
Expected: PASS / valid. If `sourceInventory` reports a file-set mismatch, the archive CSV and the files under `docs/Raw Data/Inflation` disagree — fix the CSV.

- [ ] **Step 10: Build once to prove the new routes render**

Run: `npm run build`
Expected: success; the route list includes `/explorer/inflation`, `/explorer/inflation/overview`, `/methodology/inflation` and their `/en` twins, all static.

- [ ] **Step 11: Commit**

```bash
git add data/methodology/source-archives/inflation.csv apps/web/lib/methodology apps/web/components/methodology apps/web/lib/pages/methodology-article.tsx data/localization apps/web/tests docs/data-methodology/inflation-cpi-national.md
git commit -m "feat(inflation): live methodology page, source archive and data doc" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 14: Scope and design records

**Files:**
- Modify: `Project_Definition.md`, `DESIGN.md`

- [ ] **Step 1: Amend the scope (spec §2)**

In `Project_Definition.md`, after section `2B. Approved bilingual extension`, add:

```markdown
## 2C. Approved inflation extension

Approved 2026-09-11 (`docs/superpowers/specs/2026-09-11-inflation-overview-design.md`). For this dataset only, the "data behind the sidebar indicator markers" and "quarterly or monthly data" exclusions are lifted:

- Inflation hub at `/explorer/inflation` and Inflation overview at `/explorer/inflation/overview`: monthly national CPI from Geostat — headline index (2010 = 100), annual and monthly inflation, the 12-month average, core inflation and core excluding tobacco — with the National Bank of Georgia inflation target as a reference line; year × month table; Excel download; Georgian and English.
- Methodology page `/methodology/inflation` with the archived Geostat and NBG source files.

Still excluded: inflation categories, basket weights, city indices, product-level indices, the price calculator, every other price index (producer, import, construction, property, agricultural), HICP, and monthly or quarterly data for any other dataset. Each needs its own approved spec.
```

In the `Excluded From V1` list, leave the two bullets and append to the monitored-markers bullet: `(inflation: see 2C)`.

- [ ] **Step 2: Record the surfaces (spec §2, §7)**

In `DESIGN.md`, after `## 24. Connection Page (/connect)` and any GDP section, add:

```markdown
## 25. Inflation Surfaces

Inflation is the third dataset in the explorer sidebar (Budget, Economy, Inflation), with the same active-row, nested-section, collapse, keyboard and mobile behaviour. Its hub reuses the budget hub cards: only `ინფლაციის მიმოხილვა` is live; categories, basket, cities and products are non-clickable coming-soon cards. The collapsed rail reads `მონაცემები · ინფლაცია`.

The overview follows the GDP overview's header — headline line and unit line under the H1, `TextTab` indicator tabs centred above the workspace (`წლიური ინფლაცია`, `თვიური ინფლაცია`, `ფასების ინდექსი`) — over the Budget explorers' workspace: `ხაზი / ცხრილი`, chart or table, range strip, series panel with the download at its foot, source note. The series panel adds a reference row (the NBG target) with a dashed swatch; its chart line is dashed accent. Inflation values are never coloured good/bad; rate changes are in percentage points.

Monthly axes: the line chart and range strip take a periods-per-year hint. Axis labels fall on calendar years (thinned to twelve); lattice columns group months at calendar boundaries under the 12px floor (§8.3); range chips are `1წ / 5წ / 10წ / ყველა`; arrows step a month, PageUp/PageDown a year.

`ცხრილი` for monthly data is a years (newest first) × months grid with ExplorerTable's anatomy (§8.4), one series at a time (a `TextTab` picker when several are selected). Percentage tabs tint cells on a five-step scale — deflation blue `#DCE4F2`, then `#F1EADC`, `#EBCDBB`, `#D9967C`, and accent `#B3402A` with paper text — every pair ≥ 4.5:1; values are always printed and a legend names the bins. The index tab is untinted. Annual inflation adds a `წლის საშუალო` column (December 12-month average).

`ძირითადი ინდიკატორები` on this page shows the latest published month: the §8.5 hero (value, 3px gauge on a 0–15% scale against the target in force, dashed target mark, one sentence) and three side KPIs with sparklines. No movers board and no period comparison.
```

- [ ] **Step 3: Commit**

```bash
git add Project_Definition.md DESIGN.md
git commit -m "docs: approve inflation extension scope and record its surfaces" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 15: Browser tests

**Files:**
- Create: `apps/web/tests/browser/inflation-overview.spec.ts`
- Modify (counts only): `apps/web/tests/browser/bilingual-complete.spec.ts`, `bilingual-controls.spec.ts`, `bilingual-methodology.spec.ts`, `methodology.spec.ts`, `seo.spec.ts`

- [ ] **Step 1: Write the inflation spec**

`apps/web/tests/browser/inflation-overview.spec.ts`:

```ts
import { expect, test, type Page } from "@playwright/test";

const ready = (page: Page) => expect(page.locator("body")).toHaveAttribute("data-app-ready", "true");

for (const locale of ["ka", "en"] as const) {
  for (const width of [390, 768, 1440]) {
    test(`inflation overview layout ${locale} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/overview`);
      await ready(page);
      await expect(page.getByTestId("inflation-tabs").getByRole("button")).toHaveCount(3);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`inflation-${locale}-${width}.png`), fullPage: true });
      await page.getByTestId("chart-mode-table").click();
      await expect(page.getByTestId("month-grid")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`inflation-table-${locale}-${width}.png`), fullPage: true });
    });
  }
}

test("tabs switch units, series and the target together", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await expect(page.getByTestId("inflation-tab-yoy")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("inflation-unit")).toHaveText("Percent · change on the same month of the previous year");
  await expect(page.getByTestId("chart-series-target-dashed")).toHaveCount(1);
  await expect(page.getByTestId("inflation-headline")).toContainText("Annual inflation ·");

  await page.getByTestId("inflation-tab-index").click();
  await expect(page.getByTestId("inflation-unit")).toHaveText("Index · 2010 average = 100");
  await expect(page.getByTestId("chart-series-target-dashed")).toHaveCount(0);
  await expect(page.locator('[data-series-id="core"]')).toContainText("—");
  await expect(page.locator('[data-series-id="cpi"]')).toContainText("Consumer price index");
  await expect(page.getByRole("slider", { name: "Start month" })).toHaveAttribute("aria-valuetext", "Jan 2000");

  await page.getByTestId("inflation-tab-mom").click();
  await expect(page.getByTestId("inflation-headline")).toContainText(/Monthly inflation · [+−]?\d/);
});

test("range chips, keyboard steps and tab switches keep a consistent period", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await page.getByRole("button", { name: "1y", exact: true }).click();
  await expect(page).toHaveURL(/r=\d{4}-\d{2}-\d{4}-\d{2}/);
  const start = page.getByRole("slider", { name: "Start month" });
  const before = await start.getAttribute("aria-valuenow");
  await start.focus();
  await page.keyboard.press("PageDown");
  expect(Number(await start.getAttribute("aria-valuenow"))).toBe(Number(before) - 12);
  await page.keyboard.press("ArrowRight");
  expect(Number(await start.getAttribute("aria-valuenow"))).toBe(Number(before) - 11);

  await page.getByTestId("inflation-tab-index").click();
  await expect(page).toHaveURL(/r=/);
  await page.getByRole("button", { name: "All", exact: true }).click();
  await expect(page).not.toHaveURL(/r=/);
  await page.getByTestId("inflation-tab-yoy").click();
  await expect(start).toHaveAttribute("aria-valuetext", "Jan 2004");
});

test("the table picks one series, restores from the hash and downloads", async ({ page }) => {
  await page.goto("/en/explorer/inflation/overview");
  await ready(page);
  await page.locator('[data-series-id="core"]').getByTestId("series-row-toggle").click();
  await page.getByTestId("chart-mode-table").click();
  await expect(page.getByTestId("month-grid-legend-step")).toHaveCount(5);
  await expect(page.getByTestId("month-grid")).toContainText("Annual average");
  await page.getByTestId("inflation-table-series-core").click();
  await expect(page).toHaveURL(/t=core/);
  await expect(page.getByTestId("month-grid")).not.toContainText("Annual average");

  await page.reload();
  await ready(page);
  await expect(page.getByTestId("inflation-table-series-core")).toHaveAttribute("aria-pressed", "true");
  const download = page.waitForEvent("download");
  await page.getByTestId("inflation-download").click();
  expect((await download).suggestedFilename()).toMatch(/^fiscal-inflation-yoy-\d{4}-\d{2}-\d{4}-\d{2}-en\.xlsx$/);
});

test("clearing the selection disables the chart and the download", async ({ page }) => {
  await page.goto("/explorer/inflation/overview");
  await ready(page);
  await page.getByTestId("series-toggle-all").click();
  await expect(page.getByTestId("no-selection-callout")).toBeVisible();
  await expect(page.getByTestId("inflation-download")).toBeDisabled();
});

test("language switch keeps the state", async ({ page }) => {
  await page.goto("/explorer/inflation/overview#i=mom&m=table&sel=cpi");
  await ready(page);
  await page.getByTestId("language-switch").first().getByRole("link", { name: "English", exact: true }).click();
  await ready(page);
  await expect(page).toHaveURL(/\/en\/explorer\/inflation\/overview#.*i=mom/);
  await expect(page.getByTestId("inflation-tab-mom")).toHaveAttribute("aria-pressed", "true");
});

test("the sidebar lists three datasets and the hub links only the overview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/explorer/inflation");
  await expect(page.getByTestId("inflation-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("inflation-hub").getByTestId("hub-card")).toHaveCount(5);
  await expect(page.getByTestId("inflation-hub").locator("a")).toHaveCount(1);
  await page.getByTestId("inflation-hub").getByRole("link").click();
  await ready(page);
  await expect(page.getByTestId("inflation-overview-link")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("data-sidebar").getByText("მალე", { exact: true })).toHaveCount(2);
});

for (const locale of ["ka", "en"] as const) {
  test(`chart axis labels stay inside the frame in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${locale === "en" ? "/en" : ""}/explorer/inflation/overview`);
    await ready(page);
    await page.evaluate(() => document.fonts.ready);
    for (const label of await page.getByTestId("chart-panel").locator("svg text").all()) {
      expect(await label.evaluate((element) => (element as SVGGraphicsElement).getBBox().x)).toBeGreaterThanOrEqual(0);
    }
  });
}
```

The language-switch and `series-row-toggle` selectors are the ones the existing bilingual and explorer specs use on `main`. `switchLanguageHref` carries `location.hash`, and `LanguageSwitch` re-reads it on mount and on `hashchange`. `history.replaceState` fires no `hashchange`, so the link may lag a later in-page change; this test covers a restored hash. If a manual check shows the link dropping state after a tab click, report it to the user as a shared-component issue rather than changing `LanguageSwitch` in this milestone.

- [ ] **Step 2: Update the existing counts (only these numbers change)**

Relative to the merged GDP state:

| File | Change |
| --- | --- |
| `bilingual-complete.spec.ts` | public page paths +3 (94 → 97) |
| `bilingual-controls.spec.ts` | sidebar "Coming soon" 3 → 2 |
| `bilingual-methodology.spec.ts` | live rows 5 → 6, ordered list gains `"inflation"` last; future "Coming soon" 3 → 2 |
| `methodology.spec.ts` | future badges 3 → 2 (hub and sidebar); live rows 5 → 6; future rows 3 → 2; sitemap methodology list gains `"/methodology/inflation"`; the 404 slug list and the future-label list drop `inflation` / `ინფლაცია` |
| `seo.spec.ts` | sitemap `<loc>` count and `.sitemap-row` count +6 (188 → 194) |

If the merged numbers differ from 94/3/5/188, apply the same deltas (+3, −1, +1, −1, +6).

- [ ] **Step 3: Run the new spec against a production build**

From `apps/web` (see `CLAUDE.md`, "Test loop"):

```bash
npm run build && npm run start -- --port 3100
```

in the background, then:

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test tests/browser/inflation-overview.spec.ts
```

Expected: all pass. Open the screenshots in the test output folder and compare them with the Budget and GDP pages at the same widths: no clipped axis labels, no horizontal page overflow, tabs centred, table scrolls inside its frame at 390px. Fix layout in the components, not in the tests.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/browser
git commit -m "test(inflation): browser coverage for the overview, hub and sidebar" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 16: Done-check

**Files:** none new.

- [ ] **Step 1: Gates, once**

From `apps/web`, with the production server from Task 15 stopped and rebuilt only if code changed since:

```bash
npm run check
```

Expected: lint, typecheck, unit tests, `data:validate` (now including `data:check-inflation`) and `i18n:check` all pass.

```bash
npm run build
```

Expected: success.

```bash
npm run start -- --port 3100
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: the whole browser suite passes. A lone timeout in `municipal-entity.spec.ts` "sourced percentage workbook" is a known load flake — re-run it in isolation before treating it as a regression.

- [ ] **Step 2: Walk the spec's acceptance list (§12)**

Confirm, with the test or command that proves each: archive hash parity (Task 2); extraction anchors and English/Georgian parity (Tasks 2–3); coverage and contiguity; recomputation ≤ 0.2 pp; revision guard (Task 3); mirror parity (Task 4); tabs, units, headline, index without core, target on y/y only (Tasks 8, 11, 15); grid bins, summary column, empty and missing cells (Task 9); chips, single-month range via handles, keyboard steps (Tasks 6, 15); hash restore and language switch (Task 15); workbook tab/range/selection/language (Task 10); existing Budget, Debt, Deficit and GDP tests unmodified (only the Task 15 count table changed).

- [ ] **Step 3: Report**

Tell the user what shipped, the six plan-level decisions listed at the top, the pre-2015 target outcome, and the open vintage-retention question. Do not push, open a PR or run `npm run data:import`; publishing follows `codex/*` branch → PR → CI → merge only when the user authorizes it (AGENTS.md).
