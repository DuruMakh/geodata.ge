# Data-Refresh Safeguards B: Pipelines and the Preliminary Basis — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No pipeline, validator or disclosure says "2025" or "April 2026" as a literal; each reads its vintage from the reviewed manifest or derives it from the data, and one check ties the three nominal-GDP artifacts together.

**Architecture:** Four layers, in order:
1. A new consistency check makes the three nominal-GDP artifacts one fact with three renderings.
2. Prepare-time code reads preliminary years and coverage from its own manifest; the literals that genuinely pin a source edition stay, with a comment saying which refresh step retires them.
3. Runtime validators stop naming a year and assert the invariant instead: Geostat's preliminary years are the newest years, and every series from one publisher ends in the same year.
4. The World Bank's 2025 real values get a registered caveat and a page note disclosing that they rest on preliminary Geostat accounts.

**Tech Stack:** TypeScript, Vitest 4, Decimal.js, zod, csv-parse, xlsx, Next.js 16.

**Spec:** `docs/superpowers/specs/2026-09-17-data-refresh-safeguards-design.md` (§3.4, §4, §5, §8). Its §2, §3.1–§3.3 and §6 are planned in `2026-09-17-data-refresh-safeguards-a-copy-and-downloads.md`.

## Global Constraints

- **Branch and paths:** work on `codex/data-refresh-safeguards-pipelines`, created from `main`. Never commit to `main`. Commands run from `apps/web`; repository paths are written `../../…`.
- **No value changes.** Not one CSV value, rounding or served figure moves. National GDP keeps its 0.1 mln GEL rounding (spec §1.2): it is the budget and debt denominator.
- **Statuses stay publisher-faithful** (spec §1.2). The World Bank marks nothing preliminary; its rows keep `published` and the basis is disclosed instead.
- **Query-service rule:** this plan changes `lib/factQuery/`, so `npx vitest run tests/factQuery/reference.test.ts` must pass. Task 5 Step 7 states what the fixture may and may not do; a disagreement outside that is a stop condition — report it, do not edit the expectation (`CLAUDE.md`, definition of done 4).
- **Runtime code does not read `docs/Raw Data/`.** Manifests are a prepare-time and `data:validate` input. The served loaders (`importGdpOverview.ts`, `importEconomicSectors.ts`, `importGeneralGovernmentBalance.ts`) run in both CSV and db mode and feed `/mcp`'s bundled snapshot, so they derive their rules from the rows they were handed. This is how §4.3 and §3.4 of the spec are satisfied without adding a repository-path dependency to the app.
- **Sequencing:** plan A also edits `components/gdp/gdp-summary.tsx` and `docs/data-methodology/gdp-overview.md`. If plan A merged first, rebase before Task 5 and Task 6; if not, expect a small conflict in those two files when A lands.
- **Test loop:** targeted tests while editing; the full gates run once, in Task 7.

---

### Task 1: One check ties the three nominal-GDP artifacts together

**Files:**
- Create: `apps/web/lib/data/nominalGdpConsistency.ts`
- Create: `apps/web/scripts/check-nominal-gdp-consistency.ts`
- Create: `apps/web/tests/data/nominalGdpConsistency.test.ts`
- Modify: `apps/web/package.json` (`data:validate`, line 26; a new script entry beside the other `data:check-*` entries)

**Interfaces:**
- Produces: `checkNominalGdpConsistency(repositoryRoot: string): Promise<{ years: number[]; comparisons: number }>`. It throws an `Error` whose message lists every disagreement, one per line; it returns the covered years and the number of comparisons made.
- Consumes: `data/imports/gdp-overview-annual.csv`, `data/imports/economic-sectors-annual.csv`, `data/imports/national-gdp-annual-1996-2025.csv`, `docs/Raw Data/Economy/gdp-overview/source-manifest.json`, `docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv`.

- [x] **Step 1: Write the failing test**

Create `apps/web/tests/data/nominalGdpConsistency.test.ts`:

```ts
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkNominalGdpConsistency } from "../../lib/data/nominalGdpConsistency";

const roots: string[] = [];
afterAll(async () => { for (const root of roots) await rm(root, { recursive: true, force: true }); });

type Overrides = {
  sectorGdp?: string;
  nationalMillions?: string;
  nationalSha?: string;
};

async function fixtureRoot(overrides: Overrides = {}): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "nominal-gdp-"));
  roots.push(root);
  const write = async (relative: string, body: string) => {
    await mkdir(path.join(root, path.dirname(relative)), { recursive: true });
    await writeFile(path.join(root, relative), body, "utf8");
  };

  await write("data/imports/gdp-overview-annual.csv",
    "series_id,year,value\nnominal_gel,2024,93022275315.70538\nnominal_gel,2025,104598139883.332\n");
  await write("data/imports/economic-sectors-annual.csv",
    "series_id,year,measure,value\n" +
    "economy.gdp_total,2024,nominal,93022275315.70538\n" +
    `economy.gdp_total,2025,nominal,${overrides.sectorGdp ?? "104598139883.332"}\n` +
    "sector.a,2025,nominal,7000000000\n");
  await write("data/imports/national-gdp-annual-1996-2025.csv",
    "year,gdp_current_prices_million_gel\n2024,93022.3\n" +
    `2025,${overrides.nationalMillions ?? "104598.1"}\n`);
  await write("docs/Raw Data/Economy/gdp-overview/source-manifest.json", JSON.stringify({
    files: [{ file: "sources/geostat_nominal_current.xlsx", sha256: "21a576c9", bytes: 50098 }],
  }));
  await write("docs/Raw Data/GDP/national-nominal-gdp/source-manifest.csv",
    "source_id,local_file,sha256,bytes\n" +
    `source.geostat_national_gdp_sna_2008,official/03_GDP-at-Current-Prices.xlsx,${overrides.nationalSha ?? "21A576C9"},50098\n`);
  return root;
}

describe("nominal GDP consistency", () => {
  it("accepts artifacts that agree", async () => {
    const report = await checkNominalGdpConsistency(await fixtureRoot());
    expect(report.years).toEqual([2024, 2025]);
    expect(report.comparisons).toBeGreaterThan(0);
  });

  it("rejects a sector GDP total that differs by one unit", async () => {
    const root = await fixtureRoot({ sectorGdp: "104598139883.333" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/economy\.gdp_total 2025/);
  });

  it("rejects a budget denominator that differs by 0.1 mln GEL", async () => {
    const root = await fixtureRoot({ nationalMillions: "104598.2" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/national GDP 2025/);
  });

  it("rejects two archived copies of the workbook with different hashes", async () => {
    const root = await fixtureRoot({ nationalSha: "DEADBEEF" });
    await expect(checkNominalGdpConsistency(root)).rejects.toThrow(/archived copies/);
  });
});
```

Run: `npx vitest run tests/data/nominalGdpConsistency.test.ts`
Expected: FAIL — the module does not exist.

- [x] **Step 2: Implement the check**

Create `apps/web/lib/data/nominalGdpConsistency.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { parse } from "csv-parse/sync";

type Row = Record<string, string>;

const readCsv = async (file: string): Promise<Row[]> =>
  parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true, trim: true }) as Row[];

/**
 * The same nominal GDP is published three times: as the budget denominator
 * (rounded to 0.1 mln GEL), as the overview's `nominal_gel`, and as the sector
 * table's `economy.gdp_total`. Each rounding is a reviewed contract, so they are
 * not merged; this check makes a refresh that moves only one of them fail loudly.
 */
export async function checkNominalGdpConsistency(
  repositoryRoot: string,
): Promise<{ years: number[]; comparisons: number }> {
  const at = (...segments: string[]) => path.join(repositoryRoot, ...segments);
  const [overview, sectors, national, nationalManifest] = await Promise.all([
    readCsv(at("data", "imports", "gdp-overview-annual.csv")),
    readCsv(at("data", "imports", "economic-sectors-annual.csv")),
    readCsv(at("data", "imports", "national-gdp-annual-1996-2025.csv")),
    readCsv(at("docs", "Raw Data", "GDP", "national-nominal-gdp", "source-manifest.csv")),
  ]);
  const overviewManifest = JSON.parse(
    await readFile(at("docs", "Raw Data", "Economy", "gdp-overview", "source-manifest.json"), "utf8"),
  ) as { files: { file: string; sha256: string; bytes: number }[] };

  const problems: string[] = [];
  let comparisons = 0;

  const nominal = new Map<number, Decimal>();
  for (const row of overview) {
    if (row.series_id !== "nominal_gel") continue;
    nominal.set(Number(row.year), new Decimal(row.value!));
  }
  if (nominal.size === 0) problems.push("The GDP overview CSV has no nominal_gel rows");

  // 1. The sector table's GDP total is the same series, digit for digit.
  for (const row of sectors) {
    if (row.series_id !== "economy.gdp_total" || row.measure !== "nominal") continue;
    const year = Number(row.year);
    const reference = nominal.get(year);
    comparisons += 1;
    if (!reference) { problems.push(`economy.gdp_total ${year} has no nominal_gel counterpart`); continue; }
    if (!new Decimal(row.value!).eq(reference))
      problems.push(`economy.gdp_total ${year} is ${row.value}, nominal_gel is ${reference.toFixed()}`);
  }

  // 2. The budget denominator is the same series rounded to 0.1 mln GEL.
  for (const row of national) {
    const year = Number(row.year);
    const reference = nominal.get(year);
    comparisons += 1;
    if (!reference) { problems.push(`national GDP ${year} has no nominal_gel counterpart`); continue; }
    const rounded = reference.div(1_000_000).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    if (!rounded.eq(new Decimal(row.gdp_current_prices_million_gel!)))
      problems.push(
        `national GDP ${year} is ${row.gdp_current_prices_million_gel} mln GEL, nominal_gel rounds to ${rounded.toFixed(1)}`,
      );
  }

  // 3. The one Geostat workbook is archived twice; both copies must be identical.
  const overviewCopy = overviewManifest.files.find((entry) => entry.file.endsWith("geostat_nominal_current.xlsx"));
  const nationalCopy = nationalManifest.find((row) => row.local_file?.endsWith("03_GDP-at-Current-Prices.xlsx"));
  comparisons += 1;
  if (!overviewCopy || !nationalCopy) {
    problems.push("Cannot find both archived copies of 03_GDP-at-Current-Prices.xlsx");
  } else if (
    overviewCopy.sha256.toLowerCase() !== nationalCopy.sha256!.toLowerCase() ||
    String(overviewCopy.bytes) !== nationalCopy.bytes
  ) {
    problems.push(
      `The two archived copies of 03_GDP-at-Current-Prices.xlsx differ: ${overviewCopy.sha256}/${overviewCopy.bytes} and ${nationalCopy.sha256}/${nationalCopy.bytes}`,
    );
  }

  if (problems.length > 0) throw new Error(`Nominal GDP artifacts disagree:\n${problems.join("\n")}`);
  return { years: [...nominal.keys()].sort((left, right) => left - right), comparisons };
}
```

Create `apps/web/scripts/check-nominal-gdp-consistency.ts`, following the runner shape of the neighbouring scripts:

```ts
import path from "node:path";
import { checkNominalGdpConsistency } from "../lib/data/nominalGdpConsistency";

async function main(): Promise<void> {
  const report = await checkNominalGdpConsistency(path.resolve(process.cwd(), "../.."));
  console.log(
    `Nominal GDP artifacts agree for ${report.years[0]}–${report.years.at(-1)} (${report.comparisons} comparisons).`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

- [x] **Step 3: Run the test**

Run: `npx vitest run tests/data/nominalGdpConsistency.test.ts`
Expected: PASS, all four cases.

- [x] **Step 4: Put it in the data gate**

In `apps/web/package.json`, add beside the other `data:check-*` entries:

```json
    "data:check-nominal-gdp-consistency": "tsx scripts/check-nominal-gdp-consistency.ts",
```

and add `npm run data:check-nominal-gdp-consistency && ` to the `data:validate` chain (line 26), before `data:validate-public-dataset-inputs` (or before `data:check-public-datasets` if plan A has not merged).

Run: `npm run data:check-nominal-gdp-consistency`
Expected: exit 0, printing `Nominal GDP artifacts agree for 1996–2025 (…)`.

- [x] **Step 5: Prove it bites on the real data**

Run:

```bash
node -e "const fs=require('fs');const p='../../data/imports/economic-sectors-annual.csv';const original=fs.readFileSync(p,'utf8');fs.writeFileSync(p,original.replace('economy.gdp_total,2025,nominal,104598139883.332','economy.gdp_total,2025,nominal,104598139883.333'));process.on('exit',()=>fs.writeFileSync(p,original));"
```

Then `npm run data:check-nominal-gdp-consistency` and confirm it fails naming `economy.gdp_total 2025`. Restore the file with `git checkout -- ../../data/imports/economic-sectors-annual.csv` and re-run the check to confirm it passes again.

- [x] **Step 6: Commit**

```bash
git add lib/data/nominalGdpConsistency.ts scripts/check-nominal-gdp-consistency.ts tests/data/nominalGdpConsistency.test.ts package.json
git commit -m "feat(data): tie the three nominal GDP artifacts together with one check"
```

---

### Task 2: Preliminary years and coverage come from the manifests

**Files:**
- Modify: `docs/Raw Data/Economy/gdp-overview/source-manifest.json`
- Modify: `apps/web/lib/data/gdpOverview/prepareGdpOverview.ts` (lines 19–22, 40–52, 100–103)
- Modify: `apps/web/lib/data/economicSectors/prepareEconomicSectors.ts` (lines 26, 55–62, 91)
- Modify: `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts` (lines 57–62, 196)
- Test: `apps/web/tests/data/gdpOverview/prepareGdpOverview.test.ts`

**Interfaces:**
- Produces: `geostatPreliminaryYears(manifest): Set<number>`, exported from `prepareGdpOverview.ts`. It returns every year listed in `preliminary_years` across the manifest's Geostat entries.
- The manifest entry type becomes `{ file: string; sha256: string; bytes: number; preliminary_years?: number[] }`.

- [x] **Step 1: Write the failing test**

Append to `apps/web/tests/data/gdpOverview/prepareGdpOverview.test.ts`:

```ts
  it("reads the preliminary years from the manifest, not from a literal year", async () => {
    const { geostatPreliminaryYears } = await import("../../../lib/data/gdpOverview/prepareGdpOverview");

    expect([...geostatPreliminaryYears({ files: [
      { file: "sources/geostat_nominal_current.xlsx", sha256: "x", bytes: 1, preliminary_years: [2026] },
      { file: "sources/geostat_nominal_legacy.xlsx", sha256: "y", bytes: 1, preliminary_years: [] },
      { file: "sources/NY.GDP.MKTP.KD.json", sha256: "z", bytes: 1 },
    ] })]).toEqual([2026]);

    const { facts } = await prepareGdpOverview();
    const preliminary = [...new Set(facts.filter((f) => f.status === "preliminary").map((f) => f.year))];
    expect(preliminary).toEqual([2025]);
    expect(facts.filter((f) => f.status === "preliminary")).toHaveLength(4);
  });
```

Run: `npx vitest run tests/data/gdpOverview/prepareGdpOverview.test.ts`
Expected: FAIL — `geostatPreliminaryYears` is not exported.

- [x] **Step 2: Add the field to the manifest**

In `docs/Raw Data/Economy/gdp-overview/source-manifest.json`, add `"preliminary_years"` to the two Geostat entries and leave the World Bank entries untouched:

```json
    {
      "file": "sources/geostat_nominal_current.xlsx",
      "url": "https://geostat.ge/media/81052/03_GDP-at-Current-Prices.xlsx",
      "sha256": "21a576c9c20434a87bcb32047cd143eef2b8d3f3ff360442b420c76b0da27d34",
      "bytes": 50098,
      "preliminary_years": [2025]
    },
    {
      "file": "sources/geostat_nominal_legacy.xlsx",
      "url": "https://geostat.ge/media/27798/GDP-at-current-prices.xlsx",
      "sha256": "1f9befdca89f3a635f66abb14892386a9947bf7294045e4442832aa53e63dc8e",
      "bytes": 94214,
      "preliminary_years": []
    },
```

- [x] **Step 3: Read it in the overview prepare script**

In `apps/web/lib/data/gdpOverview/prepareGdpOverview.ts`:

1. Widen the manifest type (line 21–22):
   ```ts
   ) as { files: { file: string; sha256: string; bytes: number; preliminary_years?: number[] }[] };
   ```
2. Add above `prepareGdpOverview`:
   ```ts
   type GdpSourceManifest = { files: { file: string; preliminary_years?: number[] }[] };

   /**
    * Which Geostat years are still preliminary is a property of the archived
    * edition, so it is declared in the manifest beside the hash rather than
    * written into this script as a year.
    */
   export function geostatPreliminaryYears(manifest: GdpSourceManifest): Set<number> {
     return new Set(manifest.files.flatMap((entry) => entry.preliminary_years ?? []));
   }
   ```
3. After the hash loop, add `const preliminary = geostatPreliminaryYears(manifest);`
4. In `add` (line 47), replace the status expression with:
   ```ts
       status: accountingStandard && preliminary.has(year) ? "preliminary" : "published",
   ```
5. Replace the header-asterisk check (line 100–101):
   ```ts
         if (preliminary.has(year) !== Boolean(match[2]))
           throw new Error("Geostat preliminary header mismatch");
   ```

- [x] **Step 4: Derive the sector coverage and preliminary years from its manifest**

In `apps/web/lib/data/economicSectors/prepareEconomicSectors.ts`:

1. Replace the `years` helper (line 26):
   ```ts
   const years = (first: number, last: number) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
   ```
2. After the role check (line 39), add:
   ```ts
   // Coverage and preliminary years belong to the archived edition. The check is
   // that the three sources agree with each other and end together, not that they
   // end in a year this file names.
   const lastAnnualYear = Math.max(...manifest.files.flatMap((source) => source.annualYears));
   const preliminaryYears = [...new Set(manifest.files.flatMap((source) => source.preliminaryYears))].sort((a, b) => a - b);
   if (preliminaryYears.some((year) => year > lastAnnualYear || year <= lastAnnualYear - manifest.files.length))
     throw new Error("Sector preliminary years must be the newest annual years");
   ```
3. In the per-source check (lines 57–62), replace the two literal comparisons:
   ```ts
       if (source.unit !== expectedUnit || source.headerRow !== 2 || !same(source.activityRows, [3, 22]) || source.gdpRow !== 26 ||
           !same(source.annualYears, years(source.role === "growth" ? 2011 : 2010, lastAnnualYear)) ||
           !same(source.preliminaryYears, preliminaryYears) ||
           // Edition guard: bump with the Geostat release named in the refresh
           // step of docs/data-methodology/economic-sectors.md.
           source.releasedAt !== "2026-06-19" || source.sourceId !== expectedSourceId ||
   ```
4. Above the note check (line 91), add the edition-guard comment:
   ```ts
       // Edition guard: these two notes identify the archived release. The refresh
       // step in docs/data-methodology/economic-sectors.md updates both strings.
   ```

- [x] **Step 5: Mark the national GDP literals as edition guards**

In `apps/web/lib/data/nationalGdp/prepareNationalGdp.ts`, add above `EXPECTED_SOURCE_YEARS` (line 57):

```ts
// Edition guards, not coverage: these three literals pin the two archived Geostat
// workbooks and the reviewed canonical span. The refresh step in
// docs/data-methodology/national-nominal-gdp.md updates them together with the
// manifest hashes; nothing else in the pipeline may widen them silently.
```

and above the status rule (line 196):

```ts
    // Geostat publishes the newest year with an asterisk. The same refresh step
    // moves this year and the manifest note that documents it.
```

- [x] **Step 6: Run the prepare tests**

Run: `npx vitest run tests/data/gdpOverview/prepareGdpOverview.test.ts tests/data/economicSectors`
Expected: PASS. The 2025 status and the four preliminary facts are unchanged; they now come from the manifests.

Run: `npm run data:validate`
Expected: exit 0.

- [x] **Step 7: Commit**

```bash
git add "../../docs/Raw Data/Economy/gdp-overview/source-manifest.json" lib/data/gdpOverview/prepareGdpOverview.ts lib/data/economicSectors/prepareEconomicSectors.ts lib/data/nationalGdp/prepareNationalGdp.ts tests/data/gdpOverview/prepareGdpOverview.test.ts
git commit -m "fix(data): read preliminary years and sector coverage from the manifests"
```

---

### Task 3: Runtime validators assert the invariant instead of the year

**Files:**
- Modify: `apps/web/lib/data/gdpOverview/types.ts` (lines 1–8)
- Modify: `apps/web/lib/data/gdpOverview/validation.ts` (whole function)
- Modify: `apps/web/lib/data/economicSectors/validation.ts:39`
- Create: `apps/web/tests/data/gdpOverview/validation.test.ts`

**Interfaces:**
- `GDP_SERIES` entries lose `last` and keep `{ unit, first }`. Nothing outside `validation.ts` read `last` (`importGdpOverview.ts:27` and `prepareGdpOverview.ts:46,164` use the key set and `unit` only).
- `validateGdpObservations(facts: GdpObservation[]): void` keeps its signature and its `coverage`, `duplicate`, `unit` and `finite` message wording, which existing tests match.

- [x] **Step 1: Write the failing test**

Create `apps/web/tests/data/gdpOverview/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadGdpOverviewFacts } from "../../../lib/data/gdpOverview/importGdpOverview";
import { validateGdpObservations } from "../../../lib/data/gdpOverview/validation";
import type { GdpObservation } from "../../../lib/data/gdpOverview/types";

const facts = await loadGdpOverviewFacts();
const edit = (match: (fact: GdpObservation) => boolean, patch: Partial<GdpObservation>): GdpObservation[] =>
  facts.map((fact) => (match(fact) ? { ...fact, ...patch } : fact));

describe("GDP observation invariants", () => {
  it("accepts the canonical file", () => {
    expect(() => validateGdpObservations(facts)).not.toThrow();
  });

  it("rejects a preliminary year that is not the newest", () => {
    const rows = edit((f) => !f.seriesId.startsWith("real_") && f.year === 2020, { status: "preliminary" });
    expect(() => validateGdpObservations(rows)).toThrow(/newest/i);
  });

  it("rejects Geostat series that disagree about which years are preliminary", () => {
    const rows = edit((f) => f.seriesId === "nominal_usd" && f.year === 2025, { status: "published" });
    expect(() => validateGdpObservations(rows)).toThrow(/preliminary years differ/i);
  });

  it("rejects a preliminary World Bank observation", () => {
    const rows = edit((f) => f.seriesId === "real_growth_percent" && f.year === 2025, { status: "preliminary" });
    expect(() => validateGdpObservations(rows)).toThrow(/status/i);
  });

  it("rejects a Geostat series that ends a year after its siblings", () => {
    const last = facts.filter((f) => f.seriesId === "nominal_gel").at(-1)!;
    expect(() => validateGdpObservations([...facts, { ...last, year: last.year + 1 }])).toThrow(/coverage/i);
  });
});
```

Run: `npx vitest run tests/data/gdpOverview/validation.test.ts`
Expected: FAIL — the current validator accepts a 2020 preliminary row and rejects nothing about series ending apart.

- [x] **Step 2: Drop the pinned last year**

In `apps/web/lib/data/gdpOverview/types.ts`, replace lines 1–8:

```ts
// `first` is the publisher's first year and does not move. The last year comes
// from the data: pinning it here made every refresh a code change.
export const GDP_SERIES = {
  real_usd_2015: { unit: "usd_2015", first: 1960 },
  real_growth_percent: { unit: "percent", first: 1961 },
  nominal_gel: { unit: "gel", first: 1996 },
  nominal_usd: { unit: "usd", first: 1996 },
  per_capita_gel: { unit: "gel_per_person", first: 1996 },
  per_capita_usd: { unit: "usd_per_person", first: 1996 },
} as const;
```

- [x] **Step 3: Rewrite the validator's status and coverage rules**

In `apps/web/lib/data/gdpOverview/validation.ts`, replace the status check inside the loop:

```ts
    const geostat = !f.seriesId.startsWith("real_");
    if (f.status !== "published" && f.status !== "preliminary")
      throw new Error(`Invalid GDP status ${key}`);
    // The World Bank marks nothing preliminary; Geostat marks its newest years.
    if (!geostat && f.status !== "published")
      throw new Error(`Invalid GDP status ${key}`);
```

and replace the coverage loop at the end of the function:

```ts
  // Statuses are a publisher property, not a year literal. Geostat's preliminary
  // years are the newest ones, and its four series must agree on which they are.
  const geostatFacts = facts.filter((f) => !f.seriesId.startsWith("real_"));
  const preliminary = [...new Set(geostatFacts.filter((f) => f.status === "preliminary").map((f) => f.year))].sort(
    (a, b) => a - b,
  );
  const published = geostatFacts.filter((f) => f.status === "published").map((f) => f.year);
  if (preliminary.length > 0 && published.length > 0 && preliminary[0]! <= Math.max(...published))
    throw new Error("Preliminary GDP years must be the newest years");
  for (const id of new Set(geostatFacts.map((f) => f.seriesId))) {
    const own = geostatFacts
      .filter((f) => f.seriesId === id && f.status === "preliminary")
      .map((f) => f.year)
      .sort((a, b) => a - b);
    if (JSON.stringify(own) !== JSON.stringify(preliminary))
      throw new Error(`GDP preliminary years differ between Geostat series: ${id}`);
  }

  // Coverage: contiguous from each series' first year, and series from one
  // publisher end together. A truncated refresh fails here instead of silently
  // shortening a chart.
  const lastYear = new Map<string, number>();
  for (const [id, { first }] of Object.entries(GDP_SERIES)) {
    const years = facts
      .filter((f) => f.seriesId === id)
      .map((f) => f.year)
      .sort((a, b) => a - b);
    const last = years.at(-1);
    if (
      last === undefined ||
      JSON.stringify(years) !== JSON.stringify(Array.from({ length: last - first + 1 }, (_, i) => first + i))
    )
      throw new Error(`GDP coverage mismatch: ${id}`);
    lastYear.set(id, last);
  }
  const endsOf = (publisherGeostat: boolean) =>
    new Set(
      Object.keys(GDP_SERIES)
        .filter((id) => !id.startsWith("real_") === publisherGeostat)
        .map((id) => lastYear.get(id)!),
    );
  const geostatEnds = endsOf(true);
  const worldBankEnds = endsOf(false);
  if (geostatEnds.size !== 1 || worldBankEnds.size !== 1)
    throw new Error("GDP coverage mismatch: series from one publisher end in different years");
  if (Math.abs([...geostatEnds][0]! - [...worldBankEnds][0]!) > 1)
    throw new Error("GDP coverage mismatch: Geostat and World Bank coverage are more than a year apart");
```

- [x] **Step 4: Remove the sector year ceiling**

In `apps/web/lib/data/economicSectors/validation.ts`, replace line 39:

```ts
    // The floor is the reviewed start of the SNA 2008 sector table; the ceiling
    // is only a sanity bound, because annual data cannot describe a future year.
    if (!Number.isInteger(f.year) || f.year < 2010 || f.year > new Date().getUTCFullYear())
      throw new Error(`Invalid annual sector year ${f.year}`);
```

- [x] **Step 5: Run the tests**

Run: `npx vitest run tests/data/gdpOverview tests/data/economicSectors`
Expected: PASS, including `prepareGdpOverview.test.ts`'s `/coverage/i`, `/duplicate/i`, `/unit/i` and `/finite/i` expectations.

Run: `npm run typecheck`
Expected: exit 0. If any call site read `GDP_SERIES[...].last`, it appears here — fix it by deriving the year from the facts, never by re-adding the field.

- [x] **Step 6: Commit**

```bash
git add lib/data/gdpOverview/types.ts lib/data/gdpOverview/validation.ts lib/data/economicSectors/validation.ts tests/data/gdpOverview/validation.test.ts
git commit -m "fix(data): validate GDP and sector vintages as invariants, not as 2025"
```

---

### Task 4: The deficit pipeline reads its edition; the loader stops pinning one

**Files:**
- Modify: `apps/web/lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts` (lines 21–80, 143–145)
- Modify: `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts` (lines 13–36, 62)
- Test: `apps/web/tests/data/generalGovernmentBalance/*` (the existing prepare and loader tests)

**Interfaces:**
- `validateGeneralGovernmentBalanceManifest(record)` keeps its name and return type; its schema validates shapes and cross-field consistency instead of one edition's values.
- `loadGeneralGovernmentBalanceFacts(relativePath)` keeps its signature. It now requires one edition per file and an actual-then-projection ordering, and it no longer names April 2026 or 2031.

- [x] **Step 1: Write the failing test**

Append to the existing loader test file (`apps/web/tests/data/generalGovernmentBalance/importGeneralGovernmentBalance.test.ts`, or create it beside the prepare test if it does not exist):

```ts
  it("accepts a later WEO edition and rejects a mixed or mis-ordered file", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "weo-"));
    const header = "year,general_government_balance_pct_gdp,general_government_balance_gel,status,source_id,source_dataset,source_vintage,source_sheet,source_country_id,source_percent_series_code,source_nominal_series_code,source_unit,transformation,last_reviewed_at\n";
    const row = (year: number, status: string, vintage = "2026-10", sourceId = "source.imf_weo_october_2026_general_government_balance") =>
      `${year},-2.5,-1000000000,${status},${sourceId},IMF.RES:WEO(9.0.0),${vintage},Countries,GEO,GEO.GGXCNL_NGDP.A,GEO.GGXCNL.A,billion GEL,"IMF billion GEL multiplied by 1,000,000,000; signed value preserved.",2026-11-02\n`;

    const write = async (name: string, body: string) => {
      await writeFile(path.join(root, name), header + body, "utf8");
      return path.relative(process.cwd(), path.join(root, name));
    };

    const good = await write("good.csv", [2024, 2025, 2026, 2027].map((year) => row(year, year <= 2026 ? "actual" : "projection")).join(""));
    await expect(loadGeneralGovernmentBalanceFacts(good)).resolves.toHaveLength(4);

    const mixed = await write("mixed.csv",
      row(2024, "actual") + row(2025, "actual", "2026-04", "source.imf_weo_april_2026_general_government_balance") + row(2026, "projection"));
    await expect(loadGeneralGovernmentBalanceFacts(mixed)).rejects.toThrow(/one WEO edition/i);

    const misordered = await write("misordered.csv",
      row(2024, "projection") + row(2025, "actual") + row(2026, "projection"));
    await expect(loadGeneralGovernmentBalanceFacts(misordered)).rejects.toThrow(/actual years must come first/i);

    await rm(root, { recursive: true, force: true });
  });
```

Add the `node:fs/promises` and `node:os` imports the block uses.

Run: `npx vitest run tests/data/generalGovernmentBalance`
Expected: FAIL — the loader rejects the October 2026 rows outright, because `source_id`, `source_vintage`, `last_reviewed_at` and the 2031 ceiling are `z.literal` pins.

- [x] **Step 2: Make the loader edition-agnostic**

In `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts`:

1. Delete `const EXPECTED_YEARS = …` if the file's other checks no longer need it; otherwise leave it for the canonical-path assertion the file already makes.
2. Replace the pinned fields in `rowSchema`:
   ```ts
     year: z.coerce.number().int().min(1995).max(2100),
     …
     source_id: stableIdSchema.and(z.string().regex(/^source\.imf_weo_[a-z]+_\d{4}_general_government_balance$/)),
     source_dataset: z.string().regex(/^IMF\.RES:WEO\(\d+\.\d+\.\d+\)$/),
     source_vintage: z.string().regex(/^\d{4}-(?:04|10)$/),
     …
     last_reviewed_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
   ```
   `source_sheet`, `source_country_id`, the two series codes, `source_unit` and `transformation` stay `z.literal`: they describe the extraction, not the edition.
3. Replace the per-row status rule (line 62) with a whole-file rule after the map. Delete the `expectedStatus` lines inside the map and add before `return facts;`:
   ```ts
   // One edition per file, and the projection horizon follows the actual years.
   // Which year that boundary falls in is the edition's business, not this file's.
   const editions = new Set(facts.map((fact) => `${fact.sourceId}|${fact.sourceVintage}|${fact.lastReviewedAt}`));
   if (editions.size !== 1) throw new Error("A balance file must carry exactly one WEO edition");
   const ordered = [...facts].sort((left, right) => left.year - right.year);
   const firstProjection = ordered.findIndex((fact) => fact.status === "projection");
   if (firstProjection <= 0) throw new Error("A balance file needs actual years followed by projections");
   if (ordered.slice(0, firstProjection).some((fact) => fact.status !== "actual") ||
       ordered.slice(firstProjection).some((fact) => fact.status !== "projection"))
     throw new Error("General-government balance actual years must come first, then projections");
   if (ordered.some((fact, index) => index > 0 && fact.year !== ordered[index - 1]!.year + 1))
     throw new Error("General-government balance years must be contiguous");
   ```
   Use the fact field names the file already builds; if `sourceVintage` and `lastReviewedAt` are not on `GeneralGovernmentBalanceFact`, key the edition set on the parsed rows instead, inside the map's closure.

- [x] **Step 3: Make the prepare script read the manifest**

In `apps/web/lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts`:

1. Replace the edition constants (lines 26–31) with values taken from the manifest row. Keep `EXPECTED_COUNTRY_ID`, `EXPECTED_SHEET`, `TARGETS` and `RECONCILIATION_TOLERANCE_PP`, which describe the extraction.
2. Replace the pinned manifest fields with shape checks:
   ```ts
   const manifestSchema = z
     .object({
       source_id: z.string().regex(/^source\.imf_weo_[a-z]+_\d{4}_general_government_balance$/),
       publisher: z.literal("International Monetary Fund"),
       dataset: z.literal("World Economic Outlook"),
       dataset_version: z.string().regex(/^IMF\.RES:WEO\(\d+\.\d+\.\d+\)$/),
       publication_date: z.string().regex(/^\d{4}-(?:04|10)-\d{2}$/),
       source_page_url: z.literal("https://data.imf.org/Datasets/WEO"),
       retrieved_file_url: z.string().url().startsWith("https://data.imf.org/"),
       retrieved_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
       local_file: z.string().regex(/^official\/WEO[A-Za-z]{3}\d{4}all\.xlsx$/),
       sha256: z.string().regex(/^[0-9A-F]{64}$/),
       bytes: z.string().regex(/^\d+$/),
       country_id: z.literal(EXPECTED_COUNTRY_ID),
       source_sheet: z.literal(EXPECTED_SHEET),
       percent_series_code: z.literal(TARGETS.GGXCNL_NGDP.seriesCode),
       nominal_series_code: z.literal(TARGETS.GGXCNL.seriesCode),
       validation_gdp_series_code: z.literal(TARGETS.NGDP_FY.seriesCode),
       year_min: z.string().regex(/^\d{4}$/),
       year_max: z.string().regex(/^\d{4}$/),
       latest_actual_year: z.string().regex(/^\d{4}$/),
       methodology: z.literal("GFSM 2001"),
       valuation: z.literal("Cash"),
       general_government_composition: z.literal("Central Government; Local Government"),
     })
     .strict()
     .refine((row) => Number(row.year_min) < Number(row.latest_actual_year) && Number(row.latest_actual_year) < Number(row.year_max),
       "The manifest's actual year must fall inside its coverage")
     .refine((row) => row.retrieved_at >= row.publication_date, "The file cannot be retrieved before it is published");
   ```
3. Derive the run's expectations from the parsed row, near where the manifest is read:
   ```ts
   const expectedYears = Array.from(
     { length: Number(manifest.year_max) - Number(manifest.year_min) + 1 },
     (_, index) => Number(manifest.year_min) + index,
   );
   const latestActualYear = Number(manifest.latest_actual_year);
   ```
   Replace uses of `EXPECTED_YEARS`, `EXPECTED_LATEST_ACTUAL_YEAR`, `SOURCE_ID`, `EXPECTED_SOURCE_SHA256`, `EXPECTED_SOURCE_BYTES`, `EXPECTED_DATASET` and `REVIEWED_AT` with the manifest values, and change `expectedStatus` (line 143) to take the boundary:
   ```ts
   function expectedStatus(year: number, latestActualYear: number): GeneralGovernmentBalanceStatus {
     return year <= latestActualYear ? "actual" : "projection";
   }
   ```
   Pass `latestActualYear` at its call sites. The workbook's hash and byte length are still checked — now against the manifest's own values, which is what makes a swapped file fail.

- [x] **Step 4: Run the tests**

Run: `npx vitest run tests/data/generalGovernmentBalance tests/explorer/deficitRoute.test.tsx`
Expected: PASS.

Run: `npm run data:validate`
Expected: exit 0 — the canonical CSV still reproduces byte for byte from the April 2026 manifest.

- [x] **Step 5: Commit**

```bash
git add lib/data/generalGovernmentBalance/prepareGeneralGovernmentBalance.ts lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts tests/data/generalGovernmentBalance
git commit -m "fix(data): take the WEO edition from the manifest and the vintage rules from the file"
```

---

### Task 5: Disclose the preliminary basis of the World Bank's newest real values

**Files:**
- Modify: `apps/web/lib/factQuery/caveats/engine.ts` (the `CaveatRule` type and `evaluateCaveats`)
- Modify: `apps/web/lib/factQuery/caveats/rules.gdp.ts`
- Modify: `apps/web/lib/factQuery/localization.ts` (`SERVICE_MESSAGE_KEYS`)
- Modify: `data/localization/ka/service-messages.json` and `data/localization/en/service-messages.json`
- Modify: `docs/data-methodology/ai-grounding-and-caveats.md` (new section; the count on line 65)
- Modify: `apps/web/lib/i18n/messages/{ka,en}/gdp.json` (`gdp.geostatNote`, two new keys)
- Modify: `apps/web/components/gdp/gdp-overview.tsx` (the `SourceNote` block, lines 260–266)
- Test: `apps/web/tests/factQuery/caveats/` and `apps/web/tests/explorer/gdpRoute.test.tsx`

**Interfaces:**
- `CaveatRule.applies` and `.affects` become `(context: CaveatContext, snapshot: FactQuerySnapshot) => …`. Existing rules declare one parameter and keep compiling; only rules that need dataset metadata take the second.
- New caveat code `gdp_world_bank_preliminary_basis`, severity `note`, comparison effect `none`, message key `caveats.gdp_world_bank_preliminary_basis`, owner `gdp-overview.md`.
- New message keys `gdp.preliminaryNote` (`{years}`) and `gdp.wbPreliminaryBasisNote` (`{years}`).

- [x] **Step 1: Write the failing test**

Create `apps/web/tests/factQuery/caveats/gdpPreliminaryBasis.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../../lib/factQuery/buildSnapshot";
import { queryGdp } from "../../../lib/factQuery/queryGdp";
import type { FactQuerySnapshot } from "../../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;
const CODE = "gdp_world_bank_preliminary_basis";

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" });
});

const codes = (response: ReturnType<typeof queryGdp>) =>
  response.kind === "error" ? [] : response.meta.caveats.map((caveat) => caveat.code);

describe("World Bank preliminary basis", () => {
  it("fires on a real series year whose Geostat accounts are preliminary", () => {
    const response = queryGdp(snapshot, { seriesIds: ["real_growth_percent"], years: [2025] });
    expect(codes(response)).toContain(CODE);
    if (response.kind !== "error") {
      const caveat = response.meta.caveats.find((entry) => entry.code === CODE)!;
      expect(caveat.affects).toEqual(["real_growth_percent:2025"]);
      expect(caveat.severity).toBe("note");
    }
  });

  it("stays silent on a settled year and on Geostat series", () => {
    expect(codes(queryGdp(snapshot, { seriesIds: ["real_usd_2015"], years: [2019] }))).not.toContain(CODE);
    expect(codes(queryGdp(snapshot, { seriesIds: ["nominal_gel"], years: [2025] }))).not.toContain(CODE);
  });
});
```

Run: `npx vitest run tests/factQuery/caveats/gdpPreliminaryBasis.test.ts`
Expected: FAIL — the code is not registered.

- [x] **Step 2: Let a rule read dataset metadata**

In `apps/web/lib/factQuery/caveats/engine.ts`:

1. In the `CaveatRule` type, change the two function fields:
   ```ts
     /**
      * `context` is pre-scoped to the answered request; `snapshot` is the whole
      * dataset and must only be used for metadata that is NOT request-scoped —
      * for example which years a publisher still calls preliminary, which a
      * response containing only World Bank cells cannot show.
      */
     applies: (context: CaveatContext, snapshot: FactQuerySnapshot) => boolean;
     affects: (context: CaveatContext, snapshot: FactQuerySnapshot) => string[];
   ```
2. In `evaluateCaveats`, pass it: `if (!rule.applies(context, snapshot)) continue;` and `affects: rule.affects(context, snapshot),`.

- [x] **Step 3: Register the rule**

In `apps/web/lib/factQuery/caveats/rules.gdp.ts`, add above the exported array:

```ts
/**
 * Geostat marks its newest national accounts preliminary; the World Bank
 * republishes the same year without a marker, so `basis` on a real cell is
 * "published" and the request itself cannot reveal the difference.
 */
const geostatPreliminaryYears = (snapshot: FactQuerySnapshot) =>
  new Set(snapshot.gdpOverview.facts.filter((fact) => fact.status === "preliminary").map((fact) => fact.year));
```

with `import type { FactQuerySnapshot } from "../types";`, and add the rule to `GDP_CAVEAT_RULES`:

```ts
  {
    code: "gdp_world_bank_preliminary_basis",
    severity: "note",
    comparisonEffect: "none",
    messageKey: "caveats.gdp_world_bank_preliminary_basis",
    methodologyRef: "gdp-overview.md",
    methodologyRefEn: "/en/methodology/gdp",
    applies: (c, snapshot) =>
      c.datasetId === DATASET_ID && realCells(c).some((o) => geostatPreliminaryYears(snapshot).has(o.year)),
    affects: (c, snapshot) => {
      const preliminary = geostatPreliminaryYears(snapshot);
      return realCells(c).filter((o) => preliminary.has(o.year)).map((o) => `${o.seriesId}:${o.year}`);
    },
  },
```

- [x] **Step 4: Add the service message**

In `apps/web/lib/factQuery/localization.ts`, add `"caveats.gdp_world_bank_preliminary_basis",` to `SERVICE_MESSAGE_KEYS`, in its alphabetical place after `"caveats.gdp_world_bank_history"`.

In `data/localization/en/service-messages.json`, after line 33:

```json
  "caveats.gdp_world_bank_preliminary_basis": "The World Bank republishes Georgia's national accounts without a preliminary marker, so its newest real GDP values rest on Geostat figures that are still preliminary and will be revised.",
```

In `data/localization/ka/service-messages.json`, in the same position:

```json
  "caveats.gdp_world_bank_preliminary_basis": "მსოფლიო ბანკი საქართველოს ეროვნულ ანგარიშებს წინასწარის ნიშნის გარეშე აქვეყნებს, ამიტომ რეალური მშპ-ის უახლესი მაჩვენებლები ეყრდნობა საქსტატის ჯერ კიდევ წინასწარ მონაცემებს და გადაიხედება.",
```

- [x] **Step 5: Document it**

In `docs/data-methodology/ai-grounding-and-caveats.md`, change line 65 from `37 codes are registered.` to `38 codes are registered.`, and add a section after `### \`gdp_world_bank_history\``, matching the format of its neighbours:

```markdown
### `gdp_world_bank_preliminary_basis`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `gdp-overview.md`

**Trigger.** A returned `real_usd_2015` or `real_growth_percent` cell whose year Geostat still marks preliminary in the same dataset.

**Georgian.** მსოფლიო ბანკი საქართველოს ეროვნულ ანგარიშებს წინასწარის ნიშნის გარეშე აქვეყნებს, ამიტომ რეალური მშპ-ის უახლესი მაჩვენებლები ეყრდნობა საქსტატის ჯერ კიდევ წინასწარ მონაცემებს და გადაიხედება.

**English.** The World Bank republishes Georgia's national accounts without a preliminary marker, so its newest real GDP values rest on Geostat figures that are still preliminary and will be revised.

The statuses stay publisher-faithful: the World Bank marks nothing preliminary, so the cell keeps basis `published` and the disclosure carries the qualification. The scope follows Geostat's preliminary years, so it clears itself when Geostat finalises them — this is the one rule that reads dataset metadata rather than the request scope, because a response holding only World Bank cells cannot show it.
```

- [x] **Step 6: Say the same thing on the page**

In `apps/web/lib/i18n/messages/en/gdp.json`:

```json
  "gdp.geostatNote": "Geostat. SNA 1993 through 2009; SNA 2008 from 2010.",
  "gdp.preliminaryNote": "Preliminary and subject to revision: {years}.",
  "gdp.wbPreliminaryBasisNote": "The real series for {years} rest on Geostat national accounts that are still preliminary; the World Bank does not mark them as such.",
```

In `apps/web/lib/i18n/messages/ka/gdp.json`:

```json
  "gdp.geostatNote": "საქსტატი. 2009 წლის ჩათვლით SNA 1993; 2010 წლიდან SNA 2008.",
  "gdp.preliminaryNote": "წინასწარია და შეიძლება გადაიხედოს: {years}.",
  "gdp.wbPreliminaryBasisNote": "{years} წლის რეალური სერიები ეყრდნობა საქსტატის ჯერ კიდევ წინასწარ ეროვნულ ანგარიშებს; მსოფლიო ბანკი მათ წინასწარად არ ნიშნავს.",
```

In `apps/web/components/gdp/gdp-overview.tsx`, add beside the other derived values:

```tsx
  const preliminaryYears = [...new Set(facts.filter((fact) => fact.status === "preliminary").map((fact) => fact.year))]
    .sort((left, right) => left - right)
    .join(", ");
```

and replace the `SourceNote` body (lines 261–265):

```tsx
          <SourceNote>
            {state.indicator === "real" || state.indicator === "growth" ? (
              <>
                {t("wbNote")}{" "}
                {preliminaryYears ? message(messages, "gdp.wbPreliminaryBasisNote", { years: preliminaryYears }) : ""}
              </>
            ) : (
              <>
                {t("geostatNote")}{" "}
                {preliminaryYears ? message(messages, "gdp.preliminaryNote", { years: preliminaryYears }) : ""}{" "}
                {state.indicator === "per_capita" ? t("perCapitaNote") : ""}
              </>
            )}
          </SourceNote>
```

Append to `apps/web/tests/explorer/gdpRoute.test.tsx`:

```tsx
  it("discloses the preliminary basis on the real indicators", async () => {
    const html = renderToStaticMarkup(await renderGdpPage("en"));
    expect(html).toContain("rest on Geostat national accounts that are still preliminary");
    expect(html).toContain("Preliminary and subject to revision: 2025.");
  });
```

Match the file's existing render helper if it differs.

- [x] **Step 7: Run the query-service gates**

Run: `npx vitest run tests/factQuery/caveats tests/explorer/gdpRoute.test.tsx tests/i18n`
Expected: PASS, including `documented.test.ts`'s count, section, verbatim-message and comparison-effect checks.

Run: `npx vitest run tests/factQuery/reference.test.ts`
Expected: PASS **with no fixture edit**. Verified at the baseline: the only `query_gdp` intents are 25 and 26, both `nominal_gel`, and no intent requests `real_usd_2015` or `real_growth_percent`, so no expected caveat list changes. The spec's §5 allowance therefore costs nothing. If this test disagrees anyway, stop and report it (`CLAUDE.md` definition of done 4) — do not edit `tests/factQuery/fixtures/referenceIntents.ts`.

Run: `npm run data:prepare-fact-query-snapshot && npx vitest run tests/factQuery`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add lib/factQuery/caveats/engine.ts lib/factQuery/caveats/rules.gdp.ts lib/factQuery/localization.ts ../../data/localization/ka/service-messages.json ../../data/localization/en/service-messages.json ../../docs/data-methodology/ai-grounding-and-caveats.md lib/i18n/messages/ka/gdp.json lib/i18n/messages/en/gdp.json components/gdp/gdp-overview.tsx tests/factQuery/caveats/gdpPreliminaryBasis.test.ts tests/explorer/gdpRoute.test.tsx
git commit -m "feat(mcp): disclose that the newest World Bank real GDP rests on preliminary Geostat data"
```

---

### Task 6: State the refresh order once, in the methodology

**Files:**
- Modify: `docs/data-methodology/gdp-overview.md`
- Modify: `docs/data-methodology/national-nominal-gdp.md`
- Modify: `docs/data-methodology/economic-sectors.md`
- Modify: `docs/data-methodology/ai-reference-intents.md`

- [x] **Step 1: Write the shared order**

Add this section to each of the three GDP-family documents, under their refresh or reproduction heading, adjusting only the first sentence to name the document's own dataset:

```markdown
### Refresh order

The same Geostat nominal GDP feeds three artifacts, so they are refreshed together, in one change, in this order:

1. `data/imports/national-gdp-annual-1996-2025.csv` — the budget and debt denominator, rounded to 0.1 mln GEL.
2. `data/imports/gdp-overview-annual.csv` — the full-precision series behind the GDP page.
3. `data/imports/economic-sectors-annual.csv` — `economy.gdp_total`, which must equal the overview value digit for digit.

`npm run data:check-nominal-gdp-consistency` (part of `npm run data:validate`) is the gate: it compares the three artifacts and the two archived copies of `03_GDP-at-Current-Prices.xlsx`. A refresh that updates only one of them fails there.

Preliminary years are declared in the manifests — `preliminary_years` in the GDP overview manifest and `preliminaryYears` in the sector manifest — and the prepare scripts read them. The runtime validators assert only the invariant: preliminary years are the newest years, and every series from one publisher ends in the same year. The literals that remain in the prepare scripts are edition guards, each marked with a comment naming the refresh step that retires it.
```

In `gdp-overview.md`, add one more line under that section:

```markdown
When Geostat finalises a year, `query_gdp` and the GDP page stop showing `gdp_world_bank_preliminary_basis` automatically: its scope follows the manifest's preliminary years, not a written-in year.
```

- [x] **Step 2: Record the caveat's reach for the reference intents**

In `docs/data-methodology/ai-reference-intents.md`, add to the section that describes GDP intents:

```markdown
No reference intent requests a real GDP series, so `gdp_world_bank_preliminary_basis` does not appear in the 20-intent fixture. A future intent that asks for `real_usd_2015` or `real_growth_percent` in a Geostat-preliminary year must expect it.
```

- [x] **Step 3: Commit**

```bash
git add ../../docs/data-methodology/gdp-overview.md ../../docs/data-methodology/national-nominal-gdp.md ../../docs/data-methodology/economic-sectors.md ../../docs/data-methodology/ai-reference-intents.md
git commit -m "docs(methodology): state the nominal GDP refresh order and the new caveat's reach"
```

---

### Task 7: Done-check and acceptance

**Files:** none (verification only).

- [x] **Step 1: Full check**

Run: `npm run check`
Expected: exit 0, with `data:check-nominal-gdp-consistency` in the `data:validate` output.

- [x] **Step 2: Build both modes**

Run: `npm run build`
Expected: exit 0.

If a Supabase `.env` is available, also run `GEODATA_DATA_SOURCE=db npm run build` and expect exit 0: the parity path runs the rewritten validators against the mirror rows. If it is not available, say so in the PR rather than claiming the mode was verified.

- [x] **Step 3: Browser suite on the production build**

Run, in two terminals:

```bash
npm run start -- --port 3100
```

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge PLAYWRIGHT_BASE_URL=http://localhost:3100 npx playwright test
```

Expected: all tests pass, including `tests/browser/gdp.spec.ts` and `tests/browser/seo.spec.ts`.

- [x] **Step 4: Acceptance walk**

1. Change one digit of `economy.gdp_total` 2025, and `npm run data:validate` fails naming the year. Restore it.
2. Change `preliminary_years` in the GDP overview manifest to `[2024]`, and `npm run data:prepare-gdp-overview` (or the prepare test) fails on the header-asterisk mismatch. Restore it.
3. Mark a 2020 Geostat row preliminary in the CSV, and `npx vitest run tests/data/gdpOverview/validation.test.ts` fails with "newest years". Restore it.
4. `/explorer/economy/gdp` shows "Preliminary and subject to revision: 2025." on the nominal indicators and the World Bank basis sentence on the real ones, in both languages.
5. `query_gdp` for `real_growth_percent` 2025 returns `gdp_world_bank_preliminary_basis`; for 2019 it does not.
6. `npx vitest run tests/factQuery/reference.test.ts` passes with the fixture untouched.

- [ ] **Step 5: Hand off**

Push `codex/data-refresh-safeguards-pipelines` and open a draft PR. State in the description that the rendered figures are unchanged, that the new caveat is the one service-output change, and whether db-mode was verified. Merge only after CI is green.

---

## Observed, out of scope

`gdp.geostatNote` was the third place that named 2025; Task 5 fixes it. Two more remain, in the budget explorer's own copy: `main-explorer.spec.ts:132` and `tests/methodology/catalog.test.ts:151` both pin `"2025 წლის მშპ წინასწარია"`, which comes from the share-of-GDP disclosure rather than from this spec's datasets. It is not touched here.

## Execution record

- Branch: `codex/data-refresh-safeguards-pipelines`, based on `origin/main` at `248036d16` while Plan A remained unmerged.
- `npm run check`: 265 test files and 2,270 tests passed; lint, type checking, data validation, and localization passed. The new nominal-GDP gate reported 1996–2025 and 47 comparisons.
- CSV-mode `npm run build`: 235 static pages generated; all 19 publication hashes verified with data version `7545ee565484f2502e7a666871426412e48dfa32c804ad7790a581ae0abb213f`.
- Database-mode build was not run because this isolated worktree has no Supabase `.env`.
- Production-build browser suite: 570 tests passed. English and Georgian real and nominal GDP notes were also checked interactively, with no framework error overlay and working home navigation.
- Acceptance mutations were restored byte-for-byte: a 2025 sector-total digit change failed the full data gate naming `economy.gdp_total 2025`; a manifest change to `[2024]` failed the workbook-header check; four 2020 Geostat rows marked preliminary failed the runtime “newest years” invariant.
- `query_gdp` returns `gdp_world_bank_preliminary_basis` for 2025 real growth and omits it for settled 2019; the 34-intent fixture remained unchanged and its 45 assertions passed.

### Execution rulings

1. Current canonical sector GDP totals differ from the overview by up to 0.000001 GEL in nine years, while this plan forbids value changes. The consistency gate compares them at five decimal places of one GEL and still rejects the planned 0.001 GEL mutation. The cost is that drift below 0.00001 GEL can pass.
2. Runtime GDP validation runs coverage before per-series preliminary agreement and the newest-year rule, so invalid files receive the specific diagnostics the plan's tests require. The cost is only which error appears first when a file has multiple defects.
3. Edition-derived deficit fields and validation counts in `generalGovernmentBalance/types.ts` were widened from April-2026 literals to strings and numbers. The cost is removing compile-time knowledge of the current edition, which was the stale pin this task removes.
4. A deficit file beginning with a projection uses the same “actual years must come first” diagnostic as other ordering failures. The cost is wording only.
5. GDP page preliminary notes are intersected with the active chart years, satisfying the specification's range rule. The cost would be a missing note if that intersection were wrong; browser acceptance covers the current preliminary range.
6. Registry contract tests now enumerate 38 caveats and include `gdp_world_bank_preliminary_basis`. The cost is that a future addition must update both explicit lists and the documented catalogue.
7. The unrestricted query-suite run hit two existing 30-second setup timeouts under excessive worker concurrency; the complete suite passed 610 tests with the repository's standard four-worker limit.
8. Methodology text states the verified five-decimal comparison rather than the plan's false “digit for digit” claim, and names the current 34-intent fixture rather than the stale count of 20.
9. The runtime newest-year acceptance mutation changed all four Geostat 2020 series together, isolating that invariant instead of first triggering the cross-series disagreement check.
