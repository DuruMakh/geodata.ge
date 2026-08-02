# Municipal Data Serving Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the finalized 2015-2025 municipal research package into a served dataset — reviewed CSVs in `data/imports/`, a Prisma mirror, parity-checked import, and validation — with no UI.

**Architecture:** Follow the ministries (`adminSpending`) dataset end to end; it is the most recent dataset added to this pipeline and every layer already has a slot for a second dataset. A generator reads the raw package and writes two reviewed CSVs. Loaders parse them with zod. `servedData.ts` gains a *separate* `loadServedMunicipalData()` rather than extending `ExplorerData`, so existing pages do not pay for 8,349 rows they never read. The db path mirrors the CSVs and is verified row-by-row inside the import transaction.

**Tech Stack:** TypeScript (strict), zod v4, Prisma 7 + `@prisma/adapter-pg`, vitest, tsx, csv-parse.

## Global Constraints

- Every command runs from `apps/web`. Paths in `SERVED_DATA_FILES` are relative to that cwd (`../../data/...`).
- Category IDs: `municipal.<snake_case>`. Region IDs: `region.<snake_case>`. Both must satisfy `stableIdSchema` in `lib/data/validation.ts`: `/^[a-z]+(\.[a-z0-9_]+)+$/`.
- `data/imports/` CSVs are UTF-8 **without** BOM. Do not add one — `readCsvRecords` passes `bom: true` so it tolerates either, but the existing files have none.
- Amounts are nominal GEL, `basis = actual`, `Decimal(18,2)` in Postgres.
- Never edit the database directly. Never modify anything under `docs/Raw Data/` — its SHA-256 hashes are recorded.
- Zod v4 syntax (`z.iso.date()`, not `z.string().date()`).
- Georgian labels are display data, never identifiers.
- No UI in this plan. `apps/web/lib/explorer/sections.ts` keeps `municipalities: { href: null }`.

## Source of truth

Spec: `docs/superpowers/specs/2026-08-02-municipal-data-serving-layer-design.md`
Methodology: `docs/data-methodology/municipal-functional-annual-2015-2025.md`

Raw inputs (read-only):
- `docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-functional-main-annual-2015-2025.csv` — 7,590 rows
- `docs/Raw Data/Municipalities/combined-annual-2015-2025/municipal-total-payments-annual-2015-2025.csv` — 759 rows

## File Structure

**Create — data (repo root):**
- `data/taxonomy/municipal-functions.json` — 10 functions
- `data/taxonomy/municipal-regions.json` — 11 regions
- `data/imports/municipalities.csv` — 69-row registry
- `data/imports/municipal-function-facts-2015-2025.csv` — 7,590 rows (generated)
- `data/imports/municipal-total-facts-2015-2025.csv` — 759 rows (generated)

**Create — `apps/web/lib/data/municipal/`:**
- `types.ts` — every municipal row type; no logic
- `functionMapping.ts` — `functional_code` → `category_id`, the one mapping table
- `taxonomyFiles.ts` — loaders for the two taxonomy JSONs
- `municipalitiesFile.ts` — loader for the registry CSV
- `importMunicipalFacts.ts` — loaders for the two fact CSVs
- `generateMunicipalFacts.ts` — raw package → the two `data/imports` CSVs

**Create — other:**
- `apps/web/scripts/generate-municipal-facts.ts` — thin CLI over the generator
- `apps/web/tests/data/municipal/*.test.ts`

**Modify:**
- `apps/web/prisma/schema.prisma` — 4 models, 1 enum
- `apps/web/lib/data/coverage.ts` — `MUNICIPAL_YEARS`
- `apps/web/lib/data/servedData.ts` — files, types, loader, parity
- `apps/web/lib/data/servedDataParity.ts` — 3 parity keys
- `apps/web/lib/db/mirrorRows.ts` — 4 mirror readers
- `apps/web/lib/db/servedDataDb.ts` — `loadMunicipalDataFromDb`
- `apps/web/scripts/import-budget-facts.ts` — municipal tables in the transaction
- `apps/web/scripts/validate-data-files.ts` — municipal gate
- `apps/web/package.json` — `data:generate-municipal-facts`
- `data/sources/source-documents.csv` — 2 municipal source rows

---

### Task 1: Municipal taxonomy files and loaders

**Files:**
- Create: `data/taxonomy/municipal-functions.json`
- Create: `data/taxonomy/municipal-regions.json`
- Create: `apps/web/lib/data/municipal/types.ts`
- Create: `apps/web/lib/data/municipal/taxonomyFiles.ts`
- Test: `apps/web/tests/data/municipal/taxonomyFiles.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MunicipalFunction { id: string; kaLabel: string; functionalCode: string; sortOrder: number }`, `MunicipalRegion { id: string; kaLabel: string; sortOrder: number }`, `loadMunicipalFunctionsFile(relativePath: string): Promise<MunicipalFunction[]>`, `loadMunicipalRegionsFile(relativePath: string): Promise<MunicipalRegion[]>`.

Note: no `enLabel`. The ministries taxonomy carries one because the glossary contract requires it for `BudgetItem`; municipal categories have no glossary rows and the project is Georgian-first, so an English label would be unreviewed filler.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/taxonomyFiles.test.ts
import { describe, expect, it } from "vitest";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../../../lib/data/municipal/taxonomyFiles";

const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";
const REGIONS = "../../data/taxonomy/municipal-regions.json";

describe("municipal taxonomy files", () => {
  it("loads exactly ten main functions", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    expect(functions).toHaveLength(10);
  });

  it("uses stable municipal.* ids and official functional codes", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const byCode = new Map(functions.map((entry) => [entry.functionalCode, entry.id]));

    expect(byCode.get("7.1")).toBe("municipal.general_public_services");
    expect(byCode.get("7.6")).toBe("municipal.housing_communal");
    expect(byCode.get("7.10")).toBe("municipal.social_protection");
    for (const entry of functions) {
      expect(entry.id).toMatch(/^municipal\.[a-z0-9_]+$/);
      expect(entry.kaLabel.length).toBeGreaterThan(0);
    }
  });

  it("orders functions by official code, not lexically", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const codes = [...functions]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((entry) => entry.functionalCode);

    expect(codes).toEqual(["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"]);
  });

  it("loads exactly eleven regions with stable ids", async () => {
    const regions = await loadMunicipalRegionsFile(REGIONS);
    expect(regions).toHaveLength(11);
    expect(regions.map((region) => region.id)).toContain("region.tbilisi");
    expect(regions.map((region) => region.id)).toContain("region.adjara");
    for (const region of regions) {
      expect(region.id).toMatch(/^region\.[a-z0-9_]+$/);
    }
  });

  it("has no duplicate ids in either file", async () => {
    const functions = await loadMunicipalFunctionsFile(FUNCTIONS);
    const regions = await loadMunicipalRegionsFile(REGIONS);

    expect(new Set(functions.map((entry) => entry.id)).size).toBe(functions.length);
    expect(new Set(regions.map((region) => region.id)).size).toBe(regions.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/taxonomyFiles.test.ts`
Expected: FAIL — `Failed to resolve import ".../lib/data/municipal/taxonomyFiles"`.

- [ ] **Step 3: Create the types module**

```typescript
// apps/web/lib/data/municipal/types.ts

// Row shapes for the municipal dataset. No logic here — every loader in
// lib/data/municipal/ returns one of these, and lib/db/mirrorRows.ts returns
// the identical shapes so parity compares like with like.

export type MunicipalFunction = {
  id: string;
  kaLabel: string;
  functionalCode: string;
  sortOrder: number;
};

export type MunicipalRegion = {
  id: string;
  kaLabel: string;
  sortOrder: number;
};
```

- [ ] **Step 4: Create the loader**

```typescript
// apps/web/lib/data/municipal/taxonomyFiles.ts
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { MunicipalFunction, MunicipalRegion } from "./types";

const municipalFunctionSchema = z.object({
  id: z.string().regex(/^municipal\.[a-z0-9_]+$/, "municipal function IDs use municipal.*"),
  kaLabel: z.string().min(1),
  functionalCode: z.string().regex(/^7\.\d+$/, "functional codes are 7.1 through 7.10"),
  sortOrder: z.number().int().positive(),
});

const municipalRegionSchema = z.object({
  id: z.string().regex(/^region\.[a-z0-9_]+$/, "region IDs use region.*"),
  kaLabel: z.string().min(1),
  sortOrder: z.number().int().positive(),
});

async function readJsonFile(relativePath: string): Promise<unknown> {
  const filePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

export async function loadMunicipalFunctionsFile(
  relativePath: string,
): Promise<MunicipalFunction[]> {
  return z.array(municipalFunctionSchema).parse(await readJsonFile(relativePath));
}

export async function loadMunicipalRegionsFile(relativePath: string): Promise<MunicipalRegion[]> {
  return z.array(municipalRegionSchema).parse(await readJsonFile(relativePath));
}
```

- [ ] **Step 5: Create the functions taxonomy file**

`sortOrder` follows `functional_sort_id` from the raw package, so 7.10 sorts last rather than second. Labels are copied verbatim from `functional_name_ka`.

```json
[
  { "id": "municipal.general_public_services", "kaLabel": "საერთო დანიშნულების სახელმწიფო მომსახურება", "functionalCode": "7.1", "sortOrder": 1 },
  { "id": "municipal.defence", "kaLabel": "თავდაცვა", "functionalCode": "7.2", "sortOrder": 2 },
  { "id": "municipal.public_order_safety", "kaLabel": "საზოგადოებრივი წესრიგი და უსაფრთხოება", "functionalCode": "7.3", "sortOrder": 3 },
  { "id": "municipal.economic_affairs", "kaLabel": "ეკონომიკური საქმიანობა", "functionalCode": "7.4", "sortOrder": 4 },
  { "id": "municipal.environment", "kaLabel": "გარემოს დაცვა", "functionalCode": "7.5", "sortOrder": 5 },
  { "id": "municipal.housing_communal", "kaLabel": "საბინაო-კომუნალური მეურნეობა", "functionalCode": "7.6", "sortOrder": 6 },
  { "id": "municipal.health", "kaLabel": "ჯანმრთელობის დაცვა", "functionalCode": "7.7", "sortOrder": 7 },
  { "id": "municipal.recreation_culture", "kaLabel": "დასვენება, კულტურა და რელიგია", "functionalCode": "7.8", "sortOrder": 8 },
  { "id": "municipal.education", "kaLabel": "განათლება", "functionalCode": "7.9", "sortOrder": 9 },
  { "id": "municipal.social_protection", "kaLabel": "სოციალური დაცვა", "functionalCode": "7.10", "sortOrder": 10 }
]
```

- [ ] **Step 6: Create the regions taxonomy file**

```json
[
  { "id": "region.tbilisi", "kaLabel": "თბილისი", "sortOrder": 1 },
  { "id": "region.adjara", "kaLabel": "აჭარა", "sortOrder": 2 },
  { "id": "region.guria", "kaLabel": "გურია", "sortOrder": 3 },
  { "id": "region.imereti", "kaLabel": "იმერეთი", "sortOrder": 4 },
  { "id": "region.kakheti", "kaLabel": "კახეთი", "sortOrder": 5 },
  { "id": "region.mtskheta_mtianeti", "kaLabel": "მცხეთა-მთიანეთი", "sortOrder": 6 },
  { "id": "region.racha_lechkhumi_kvemo_svaneti", "kaLabel": "რაჭა-ლეჩხუმი და ქვემო სვანეთი", "sortOrder": 7 },
  { "id": "region.samegrelo_zemo_svaneti", "kaLabel": "სამეგრელო-ზემო სვანეთი", "sortOrder": 8 },
  { "id": "region.samtskhe_javakheti", "kaLabel": "სამცხე-ჯავახეთი", "sortOrder": 9 },
  { "id": "region.kvemo_kartli", "kaLabel": "ქვემო ქართლი", "sortOrder": 10 },
  { "id": "region.shida_kartli", "kaLabel": "შიდა ქართლი", "sortOrder": 11 }
]
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/taxonomyFiles.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 8: Commit**

```bash
git add data/taxonomy/municipal-functions.json data/taxonomy/municipal-regions.json apps/web/lib/data/municipal apps/web/tests/data/municipal
git commit -m "feat(data): add municipal function and region taxonomies"
```

---

### Task 2: Municipality registry

**Files:**
- Create: `data/imports/municipalities.csv`
- Create: `apps/web/lib/data/municipal/municipalitiesFile.ts`
- Modify: `apps/web/lib/data/municipal/types.ts`
- Test: `apps/web/tests/data/municipal/municipalitiesFile.test.ts`

**Interfaces:**
- Consumes: `MunicipalRegion` from Task 1.
- Produces: `Municipality { code: string; sortId: number; nameKa: string; displayNameKa: string; regionId: string; isSelfGoverningCity: boolean }`, `loadMunicipalitiesFile(relativePath: string): Promise<Municipality[]>`.

The 69 codes, sort ids and official names were extracted from the raw package on 2026-08-02 and are listed in Step 5. Regenerate them with:

```bash
cd "docs/Raw Data/Municipalities/combined-annual-2015-2025" && node -e "const fs=require('fs');const t=fs.readFileSync('municipal-total-payments-annual-2015-2025.csv','utf8').replace(/^﻿/,'');const l=t.split(/\r?\n/).filter(Boolean);const s=new Map();for(let i=1;i<l.length;i++){const c=l[i].split(',');if(!s.has(c[1]))s.set(c[1],[Number(c[2]),c[3]]);}[...s.entries()].sort((a,b)=>a[1][0]-b[1][0]).forEach(([k,v])=>console.log(k+','+v[0]+','+v[1]));"
```

**`municipality_sort_id` runs 12408-12476 in unbroken region blocks**, which is where the region assignment in Step 5 comes from — it is read off the official ordering, not guessed. Verify the block boundaries before committing; they are the only thing standing between a correct region column and a plausible-looking wrong one.

`display_name_ka` drops the `ქალაქ …ის მუნიციპალიტეტი` / `…ის მუნიციპალიტეტი` wrapper into the bare place name in the nominative. Do not derive it with a regex — Georgian genitive stems do not reverse mechanically (`ხონის` → `ხონი`, but `დედოფლისწყაროს` → `დედოფლისწყარო` and `ჩხოროწყუს` → `ჩხოროწყუ`), and a wrong short name is what users read on every row.

`is_self_governing_city` is true for exactly five: თბილისი (04), ბათუმი (06), ქუთაისი (20), ფოთი (32), რუსთავი (48).

**Finding that affects Spec 2 — five occupied-territory municipalities carry data.** The 69 include `05 აჟარის`, `42 ერედვის`, `43 ქურთის`, `46 თიღვის` and `64 ახალგორის` — administrations for territory Georgia does not control, which still appear in the official budget series. The design file assumes occupied territory has no data and legends it as `ოკუპირებული ტერიტორია — მონაცემები არ არის`. That legend is wrong as written. Nothing in this task changes: all 69 are registered and served. Record it for the UI spec.

**One assignment needs verification, not assumption:** `05 აჟარის` sits inside the Adjara sort block, but Adjara AR has six municipalities (06-11) and Azhara/Kodori is Abkhazian territory. Step 5 assigns it `region.adjara` on the strength of its block position. Confirm against the official administrative division before committing; if it belongs to Abkhazia, a twelfth region ID is needed in `data/taxonomy/municipal-regions.json` and Task 1's eleven-region test changes with it.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/municipalitiesFile.test.ts
import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import { loadMunicipalRegionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const REGIONS = "../../data/taxonomy/municipal-regions.json";

describe("municipality registry", () => {
  it("holds all 69 municipalities with unique codes", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);

    expect(municipalities).toHaveLength(69);
    expect(new Set(municipalities.map((row) => row.code)).size).toBe(69);
  });

  it("assigns every municipality to a known region", async () => {
    const [municipalities, regions] = await Promise.all([
      loadMunicipalitiesFile(MUNICIPALITIES),
      loadMunicipalRegionsFile(REGIONS),
    ]);
    const regionIds = new Set(regions.map((region) => region.id));

    for (const row of municipalities) {
      expect(regionIds.has(row.regionId), `${row.displayNameKa} has unknown region ${row.regionId}`).toBe(true);
    }
  });

  it("uses every region at least once", async () => {
    const [municipalities, regions] = await Promise.all([
      loadMunicipalitiesFile(MUNICIPALITIES),
      loadMunicipalRegionsFile(REGIONS),
    ]);
    const used = new Set(municipalities.map((row) => row.regionId));

    expect([...regions.map((region) => region.id)].filter((id) => !used.has(id))).toEqual([]);
  });

  it("marks exactly the five self-governing cities", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);
    const cities = municipalities.filter((row) => row.isSelfGoverningCity).map((row) => row.displayNameKa);

    expect(cities.sort()).toEqual(["ბათუმი", "თბილისი", "ქუთაისი", "რუსთავი", "ფოთი"].sort());
  });

  it("gives every municipality a distinct short display name", async () => {
    const municipalities = await loadMunicipalitiesFile(MUNICIPALITIES);
    const names = municipalities.map((row) => row.displayNameKa);

    expect(new Set(names).size).toBe(69);
    for (const name of names) {
      expect(name).not.toContain("მუნიციპალიტეტი");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/municipalitiesFile.test.ts`
Expected: FAIL — cannot resolve `municipalitiesFile`.

- [ ] **Step 3: Append the Municipality type**

Append to `apps/web/lib/data/municipal/types.ts`:

```typescript
export type Municipality = {
  code: string;
  sortId: number;
  nameKa: string;
  displayNameKa: string;
  regionId: string;
  isSelfGoverningCity: boolean;
};
```

- [ ] **Step 4: Create the loader**

```typescript
// apps/web/lib/data/municipal/municipalitiesFile.ts
import { z } from "zod";
import { readCsvRecords } from "../csv";
import type { Municipality } from "./types";

// municipality_code is text, never a number: the official codes carry leading
// zeros ("04") that an integer parse would destroy.
const municipalityRowSchema = z.object({
  municipality_code: z.string().min(1),
  municipality_sort_id: z.coerce.number().int().positive(),
  name_ka: z.string().min(1),
  display_name_ka: z.string().min(1),
  region_id: z.string().regex(/^region\.[a-z0-9_]+$/, "region IDs use region.*"),
  is_self_governing_city: z.enum(["true", "false"]),
});

export async function loadMunicipalitiesFile(relativePath: string): Promise<Municipality[]> {
  const records = await readCsvRecords(relativePath);
  const codes = new Set<string>();

  return records.map((record) => {
    const row = municipalityRowSchema.parse(record);

    if (codes.has(row.municipality_code)) {
      throw new Error(`Duplicate municipality code: ${row.municipality_code}`);
    }

    codes.add(row.municipality_code);

    return {
      code: row.municipality_code,
      sortId: row.municipality_sort_id,
      nameKa: row.name_ka,
      displayNameKa: row.display_name_ka,
      regionId: row.region_id,
      isSelfGoverningCity: row.is_self_governing_city === "true",
    };
  });
}
```

- [ ] **Step 5: Create the registry CSV**

No BOM. LF line endings. `display_name_ka` values below are proposed nominative forms — check each against the official name before committing.

```csv
municipality_code,municipality_sort_id,name_ka,display_name_ka,region_id,is_self_governing_city
04,12408,ქალაქ თბილისის მუნიციპალიტეტი,თბილისი,region.tbilisi,true
05,12409,აჟარის მუნიციპალიტეტი,აჟარა,region.adjara,false
06,12410,ქალაქ ბათუმის მუნიციპალიტეტი,ბათუმი,region.adjara,true
07,12411,ქობულეთის მუნიციპალიტეტი,ქობულეთი,region.adjara,false
08,12412,ხელვაჩაურის მუნიციპალიტეტი,ხელვაჩაური,region.adjara,false
09,12413,ქედის მუნიციპალიტეტი,ქედა,region.adjara,false
10,12414,შუახევის მუნიციპალიტეტი,შუახევი,region.adjara,false
11,12415,ხულოს მუნიციპალიტეტი,ხულო,region.adjara,false
12,12416,ახმეტის მუნიციპალიტეტი,ახმეტა,region.kakheti,false
13,12417,გურჯაანის მუნიციპალიტეტი,გურჯაანი,region.kakheti,false
14,12418,დედოფლისწყაროს მუნიციპალიტეტი,დედოფლისწყარო,region.kakheti,false
15,12419,თელავის მუნიციპალიტეტი,თელავი,region.kakheti,false
16,12420,ლაგოდეხის მუნიციპალიტეტი,ლაგოდეხი,region.kakheti,false
17,12421,საგარეჯოს მუნიციპალიტეტი,საგარეჯო,region.kakheti,false
18,12422,სიღნაღის მუნიციპალიტეტი,სიღნაღი,region.kakheti,false
19,12423,ყვარელის მუნიციპალიტეტი,ყვარელი,region.kakheti,false
20,12424,ქალაქ ქუთაისის მუნიციპალიტეტი,ქუთაისი,region.imereti,true
21,12425,ჭიათურის მუნიციპალიტეტი,ჭიათურა,region.imereti,false
22,12426,ტყიბულის მუნიციპალიტეტი,ტყიბული,region.imereti,false
23,12427,წყალტუბოს მუნიციპალიტეტი,წყალტუბო,region.imereti,false
24,12428,ბაღდათის მუნიციპალიტეტი,ბაღდათი,region.imereti,false
25,12429,ვანის მუნიციპალიტეტი,ვანი,region.imereti,false
26,12430,ზესტაფონის მუნიციპალიტეტი,ზესტაფონი,region.imereti,false
27,12431,თერჯოლის მუნიციპალიტეტი,თერჯოლა,region.imereti,false
28,12432,სამტრედიის მუნიციპალიტეტი,სამტრედია,region.imereti,false
29,12433,საჩხერის მუნიციპალიტეტი,საჩხერე,region.imereti,false
30,12434,ხარაგაულის მუნიციპალიტეტი,ხარაგაული,region.imereti,false
31,12435,ხონის მუნიციპალიტეტი,ხონი,region.imereti,false
32,12436,ქალაქ ფოთის მუნიციპალიტეტი,ფოთი,region.samegrelo_zemo_svaneti,true
33,12437,ზუგდიდის მუნიციპალიტეტი,ზუგდიდი,region.samegrelo_zemo_svaneti,false
34,12438,აბაშის მუნიციპალიტეტი,აბაშა,region.samegrelo_zemo_svaneti,false
35,12439,მარტვილის მუნიციპალიტეტი,მარტვილი,region.samegrelo_zemo_svaneti,false
36,12440,მესტიის მუნიციპალიტეტი,მესტია,region.samegrelo_zemo_svaneti,false
37,12441,სენაკის მუნიციპალიტეტი,სენაკი,region.samegrelo_zemo_svaneti,false
38,12442,ჩხოროწყუს მუნიციპალიტეტი,ჩხოროწყუ,region.samegrelo_zemo_svaneti,false
39,12443,წალენჯიხის მუნიციპალიტეტი,წალენჯიხა,region.samegrelo_zemo_svaneti,false
40,12444,ხობის მუნიციპალიტეტი,ხობი,region.samegrelo_zemo_svaneti,false
41,12445,გორის მუნიციპალიტეტი,გორი,region.shida_kartli,false
42,12446,ერედვის მუნიციპალიტეტი,ერედვი,region.shida_kartli,false
43,12447,ქურთის მუნიციპალიტეტი,ქურთა,region.shida_kartli,false
44,12448,ქარელის მუნიციპალიტეტი,ქარელი,region.shida_kartli,false
45,12449,კასპის მუნიციპალიტეტი,კასპი,region.shida_kartli,false
46,12450,თიღვის მუნიციპალიტეტი,თიღვა,region.shida_kartli,false
47,12451,ხაშურის მუნიციპალიტეტი,ხაშური,region.shida_kartli,false
48,12452,ქალაქ რუსთავის მუნიციპალიტეტი,რუსთავი,region.kvemo_kartli,true
49,12453,ბოლნისის მუნიციპალიტეტი,ბოლნისი,region.kvemo_kartli,false
50,12454,გარდაბნის მუნიციპალიტეტი,გარდაბანი,region.kvemo_kartli,false
51,12455,დმანისის მუნიციპალიტეტი,დმანისი,region.kvemo_kartli,false
52,12456,თეთრიწყაროს მუნიციპალიტეტი,თეთრიწყარო,region.kvemo_kartli,false
53,12457,მარნეულის მუნიციპალიტეტი,მარნეული,region.kvemo_kartli,false
54,12458,წალკის მუნიციპალიტეტი,წალკა,region.kvemo_kartli,false
55,12459,ლანჩხუთის მუნიციპალიტეტი,ლანჩხუთი,region.guria,false
56,12460,ოზურგეთის მუნიციპალიტეტი,ოზურგეთი,region.guria,false
57,12461,ჩოხატაურის მუნიციპალიტეტი,ჩოხატაური,region.guria,false
58,12462,ბორჯომის მუნიციპალიტეტი,ბორჯომი,region.samtskhe_javakheti,false
59,12463,ადიგენის მუნიციპალიტეტი,ადიგენი,region.samtskhe_javakheti,false
60,12464,ასპინძის მუნიციპალიტეტი,ასპინძა,region.samtskhe_javakheti,false
61,12465,ახალქალაქის მუნიციპალიტეტი,ახალქალაქი,region.samtskhe_javakheti,false
62,12466,ახალციხის მუნიციპალიტეტი,ახალციხე,region.samtskhe_javakheti,false
63,12467,ნინოწმინდის მუნიციპალიტეტი,ნინოწმინდა,region.samtskhe_javakheti,false
64,12468,ახალგორის მუნიციპალიტეტი,ახალგორი,region.mtskheta_mtianeti,false
65,12469,დუშეთის მუნიციპალიტეტი,დუშეთი,region.mtskheta_mtianeti,false
66,12470,თიანეთის მუნიციპალიტეტი,თიანეთი,region.mtskheta_mtianeti,false
67,12471,მცხეთის მუნიციპალიტეტი,მცხეთა,region.mtskheta_mtianeti,false
68,12472,ყაზბეგის მუნიციპალიტეტი,ყაზბეგი,region.mtskheta_mtianeti,false
69,12473,ამბროლაურის მუნიციპალიტეტი,ამბროლაური,region.racha_lechkhumi_kvemo_svaneti,false
70,12474,ლენტეხის მუნიციპალიტეტი,ლენტეხი,region.racha_lechkhumi_kvemo_svaneti,false
71,12475,ონის მუნიციპალიტეტი,ონი,region.racha_lechkhumi_kvemo_svaneti,false
72,12476,ცაგერის მუნიციპალიტეტი,ცაგერი,region.racha_lechkhumi_kvemo_svaneti,false
```

Region counts implied by the blocks, for a quick sanity check: Tbilisi 1, Adjara 7, Kakheti 8, Imereti 12, Samegrelo-Zemo Svaneti 9, Shida Kartli 7, Kvemo Kartli 7, Guria 3, Samtskhe-Javakheti 6, Mtskheta-Mtianeti 5, Racha-Lechkhumi and Kvemo Svaneti 4 — 69 total.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/municipalitiesFile.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add data/imports/municipalities.csv apps/web/lib/data/municipal apps/web/tests/data/municipal
git commit -m "feat(data): add the reviewed 69-municipality registry with region assignments"
```

---

### Task 3: Function-code mapping

**Files:**
- Create: `apps/web/lib/data/municipal/functionMapping.ts`
- Test: `apps/web/tests/data/municipal/functionMapping.test.ts`

**Interfaces:**
- Consumes: `MunicipalFunction` from Task 1.
- Produces: `municipalCategoryIdForCode(functionalCode: string): string` (throws on unknown code), `MUNICIPAL_FUNCTION_CODES: readonly string[]`.

This is the one place the `7.x` → `municipal.*` rename lives, so the generator and the validator cannot disagree.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/functionMapping.test.ts
import { describe, expect, it } from "vitest";
import {
  MUNICIPAL_FUNCTION_CODES,
  municipalCategoryIdForCode,
} from "../../../lib/data/municipal/functionMapping";
import { loadMunicipalFunctionsFile } from "../../../lib/data/municipal/taxonomyFiles";

describe("municipal function mapping", () => {
  it("maps every official code to its semantic id", () => {
    expect(municipalCategoryIdForCode("7.1")).toBe("municipal.general_public_services");
    expect(municipalCategoryIdForCode("7.8")).toBe("municipal.recreation_culture");
    expect(municipalCategoryIdForCode("7.10")).toBe("municipal.social_protection");
  });

  it("throws on an unknown code rather than inventing an id", () => {
    expect(() => municipalCategoryIdForCode("7.11")).toThrow(/7\.11/);
    expect(() => municipalCategoryIdForCode("7.1.1")).toThrow(/7\.1\.1/);
  });

  it("covers exactly the ten codes in the taxonomy file", async () => {
    const functions = await loadMunicipalFunctionsFile("../../data/taxonomy/municipal-functions.json");

    expect([...MUNICIPAL_FUNCTION_CODES].sort()).toEqual(
      functions.map((entry) => entry.functionalCode).sort(),
    );
    for (const entry of functions) {
      expect(municipalCategoryIdForCode(entry.functionalCode)).toBe(entry.id);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/functionMapping.test.ts`
Expected: FAIL — cannot resolve `functionMapping`.

- [ ] **Step 3: Write the mapping**

```typescript
// apps/web/lib/data/municipal/functionMapping.ts

// The one definition of the official-code → semantic-id rename (spec §3).
// The generator and the validation gate both read it, so they cannot drift.
// Selected-detail codes (7.1.1, 7.4.5.1, 7.5.1, 7.8.1, 7.8.2, 7.9.1) are
// deliberately absent: only the ten main functions are served, and an unknown
// code must fail loudly rather than resolve to something plausible.
const CATEGORY_ID_BY_CODE: Record<string, string> = {
  "7.1": "municipal.general_public_services",
  "7.2": "municipal.defence",
  "7.3": "municipal.public_order_safety",
  "7.4": "municipal.economic_affairs",
  "7.5": "municipal.environment",
  "7.6": "municipal.housing_communal",
  "7.7": "municipal.health",
  "7.8": "municipal.recreation_culture",
  "7.9": "municipal.education",
  "7.10": "municipal.social_protection",
};

export const MUNICIPAL_FUNCTION_CODES: readonly string[] = Object.keys(CATEGORY_ID_BY_CODE);

export function municipalCategoryIdForCode(functionalCode: string): string {
  const categoryId = CATEGORY_ID_BY_CODE[functionalCode];

  if (categoryId === undefined) {
    throw new Error(
      `Unknown municipal functional code "${functionalCode}". Only the ten main functions ` +
        `(${MUNICIPAL_FUNCTION_CODES.join(", ")}) are served; selected details are not imported.`,
    );
  }

  return categoryId;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/functionMapping.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/data/municipal/functionMapping.ts apps/web/tests/data/municipal/functionMapping.test.ts
git commit -m "feat(data): add the municipal functional-code to category-id mapping"
```

---

### Task 4: Fact CSV loaders

**Files:**
- Create: `apps/web/lib/data/municipal/importMunicipalFacts.ts`
- Modify: `apps/web/lib/data/municipal/types.ts`
- Test: `apps/web/tests/data/municipal/importMunicipalFacts.test.ts`

**Interfaces:**
- Consumes: nothing at runtime.
- Produces:
  - `MunicipalFunctionFact { year: number; municipalityCode: string; categoryId: string; functionalCode: string; amountGel: number; basis: "actual"; sourceId: string }`
  - `MunicipalTotalFact { year: number; municipalityCode: string; publicTotalGel: number; publicTotalMeasure: string; totalPaymentsGel: number | null; expensesGel: number | null; nonfinancialAssetGrowthGel: number | null; financialAssetGrowthGel: number | null; liabilityDecreaseGel: number | null; functionalSumGel: number; reconciliationDifferenceGel: number | null; warningAmountGel: number | null; showWarning: boolean; warningType: string; basis: "actual"; sourceId: string }`
  - `loadMunicipalFunctionFacts(relativePath: string): Promise<MunicipalFunctionFact[]>`
  - `loadMunicipalTotalFacts(relativePath: string): Promise<MunicipalTotalFact[]>`

The loaders are written before the CSVs exist; Task 5 generates files that satisfy them. Test against a fixture so this task is independently testable.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/importMunicipalFacts.test.ts
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../../../lib/data/municipal/importMunicipalFacts";

// readCsvRecords resolves against process.cwd(); write fixtures under it and
// pass a relative path, the same contract the real loaders use.
async function fixture(name: string, content: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "municipal-"));
  const filePath = path.join(dir, name);
  await writeFile(filePath, content, "utf8");
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

const FUNCTION_HEADER =
  "year,municipality_code,category_id,functional_code,amount_gel,basis,source_id";
const TOTAL_HEADER =
  "year,municipality_code,public_total_gel,public_total_measure,total_payments_gel,expenses_gel," +
  "nonfinancial_asset_growth_gel,financial_asset_growth_gel,liability_decrease_gel,functional_sum_gel," +
  "reconciliation_difference_gel,warning_amount_gel,show_warning,warning_type,basis,source_id";

describe("municipal fact loaders", () => {
  it("parses a function fact row", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.general_public_services,7.1,81492992.43,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).resolves.toEqual([
      {
        year: 2015,
        municipalityCode: "04",
        categoryId: "municipal.general_public_services",
        functionalCode: "7.1",
        amountGel: 81492992.43,
        basis: "actual",
        sourceId: "source.municipal_portal_archive",
      },
    ]);
  });

  it("keeps the leading zero in municipality_code", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.health,7.7,1.00,actual,source.municipal_portal_archive\n`,
    );
    const [fact] = await loadMunicipalFunctionFacts(file);

    expect(fact.municipalityCode).toBe("04");
  });

  it("rejects a non-main functional code", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.preschool,7.9.1,1.00,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).rejects.toThrow();
  });

  it("rejects a negative amount", async () => {
    const file = await fixture(
      "functions.csv",
      `${FUNCTION_HEADER}\n2015,04,municipal.health,7.7,-1.00,actual,source.municipal_portal_archive\n`,
    );

    await expect(loadMunicipalFunctionFacts(file)).rejects.toThrow(/nonnegative/);
  });

  it("parses a total row with empty optional components as null", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2015,04,958433318.62,portal_functional_total_fallback,,,,,,958433318.62,,,false,none,actual,source.municipal_portal_archive\n`,
    );
    const [total] = await loadMunicipalTotalFacts(file);

    expect(total.publicTotalGel).toBe(958433318.62);
    expect(total.publicTotalMeasure).toBe("portal_functional_total_fallback");
    expect(total.totalPaymentsGel).toBeNull();
    expect(total.expensesGel).toBeNull();
    expect(total.showWarning).toBe(false);
    expect(total.warningType).toBe("none");
  });

  it("parses a warning row", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2020,04,100.00,total_payments,100.00,60.00,20.00,15.00,5.00,80.00,20.00,20.00,true,financing_outside_functional,actual,source.municipal_history_workbooks\n`,
    );
    const [total] = await loadMunicipalTotalFacts(file);

    expect(total.showWarning).toBe(true);
    expect(total.warningType).toBe("financing_outside_functional");
    expect(total.warningAmountGel).toBe(20);
    expect(total.financialAssetGrowthGel).toBe(15);
  });

  it("rejects an unknown warning_type", async () => {
    const file = await fixture(
      "totals.csv",
      `${TOTAL_HEADER}\n2020,04,100.00,total_payments,100.00,60.00,20.00,15.00,5.00,80.00,20.00,20.00,true,mystery,actual,source.municipal_history_workbooks\n`,
    );

    await expect(loadMunicipalTotalFacts(file)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/importMunicipalFacts.test.ts`
Expected: FAIL — cannot resolve `importMunicipalFacts`.

- [ ] **Step 3: Append the fact types**

Append to `apps/web/lib/data/municipal/types.ts`:

```typescript
export type MunicipalFunctionFact = {
  year: number;
  municipalityCode: string;
  categoryId: string;
  functionalCode: string;
  amountGel: number;
  basis: "actual";
  sourceId: string;
};

// warning_type mirrors the methodology's four states. "none" is the explicit
// no-warning value; source_actual_missing is a state, not a warning (it never
// trips the GEL 1M rule because there is no official total to compare against).
export type MunicipalWarningType =
  | "none"
  | "source_version_difference"
  | "financing_outside_functional"
  | "reconciliation_review_required"
  | "source_actual_missing";

export type MunicipalTotalFact = {
  year: number;
  municipalityCode: string;
  publicTotalGel: number;
  publicTotalMeasure: string;
  totalPaymentsGel: number | null;
  expensesGel: number | null;
  nonfinancialAssetGrowthGel: number | null;
  financialAssetGrowthGel: number | null;
  liabilityDecreaseGel: number | null;
  functionalSumGel: number;
  reconciliationDifferenceGel: number | null;
  warningAmountGel: number | null;
  showWarning: boolean;
  warningType: MunicipalWarningType;
  basis: "actual";
  sourceId: string;
};
```

- [ ] **Step 4: Write the loaders**

```typescript
// apps/web/lib/data/municipal/importMunicipalFacts.ts
import { z } from "zod";
import { readCsvRecords } from "../csv";
import { MUNICIPAL_FUNCTION_CODES } from "./functionMapping";
import type { MunicipalFunctionFact, MunicipalTotalFact } from "./types";

const nonnegativeAmountSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) {
    ctx.addIssue({ code: "custom", message: "amount is required" });
    return z.NEVER;
  }

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: "custom", message: "amount must be finite" });
    return z.NEVER;
  }

  if (amount < 0) {
    ctx.addIssue({ code: "custom", message: "amount must be nonnegative" });
    return z.NEVER;
  }

  return amount;
});

// Reconciliation differences are genuinely signed, so these allow negatives.
// Empty means "the official source does not publish this value" — null, not 0.
const optionalSignedAmountSchema = z.string().transform((value, ctx) => {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const amount = Number(trimmed);

  if (!Number.isFinite(amount)) {
    ctx.addIssue({ code: "custom", message: "amount must be finite" });
    return z.NEVER;
  }

  return amount;
});

const functionalCodeSchema = z
  .string()
  .refine((code) => MUNICIPAL_FUNCTION_CODES.includes(code), {
    message: `functional_code must be one of ${MUNICIPAL_FUNCTION_CODES.join(", ")}`,
  });

const municipalFunctionFactRowSchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  municipality_code: z.string().min(1),
  category_id: z.string().regex(/^municipal\.[a-z0-9_]+$/),
  functional_code: functionalCodeSchema,
  amount_gel: nonnegativeAmountSchema,
  basis: z.literal("actual"),
  source_id: z.string().min(1),
});

const warningTypeSchema = z.enum([
  "none",
  "source_version_difference",
  "financing_outside_functional",
  "reconciliation_review_required",
  "source_actual_missing",
]);

const municipalTotalFactRowSchema = z.object({
  year: z.coerce.number().int().min(2015).max(2100),
  municipality_code: z.string().min(1),
  public_total_gel: nonnegativeAmountSchema,
  public_total_measure: z.string().min(1),
  total_payments_gel: optionalSignedAmountSchema,
  expenses_gel: optionalSignedAmountSchema,
  nonfinancial_asset_growth_gel: optionalSignedAmountSchema,
  financial_asset_growth_gel: optionalSignedAmountSchema,
  liability_decrease_gel: optionalSignedAmountSchema,
  functional_sum_gel: nonnegativeAmountSchema,
  reconciliation_difference_gel: optionalSignedAmountSchema,
  warning_amount_gel: optionalSignedAmountSchema,
  show_warning: z.enum(["true", "false"]),
  warning_type: warningTypeSchema,
  basis: z.literal("actual"),
  source_id: z.string().min(1),
});

export async function loadMunicipalFunctionFacts(
  relativePath: string,
): Promise<MunicipalFunctionFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalFunctionFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.municipality_code,
      categoryId: row.category_id,
      functionalCode: row.functional_code,
      amountGel: row.amount_gel,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}

export async function loadMunicipalTotalFacts(
  relativePath: string,
): Promise<MunicipalTotalFact[]> {
  const records = await readCsvRecords(relativePath);

  return records.map((record) => {
    const row = municipalTotalFactRowSchema.parse(record);

    return {
      year: row.year,
      municipalityCode: row.municipality_code,
      publicTotalGel: row.public_total_gel,
      publicTotalMeasure: row.public_total_measure,
      totalPaymentsGel: row.total_payments_gel,
      expensesGel: row.expenses_gel,
      nonfinancialAssetGrowthGel: row.nonfinancial_asset_growth_gel,
      financialAssetGrowthGel: row.financial_asset_growth_gel,
      liabilityDecreaseGel: row.liability_decrease_gel,
      functionalSumGel: row.functional_sum_gel,
      reconciliationDifferenceGel: row.reconciliation_difference_gel,
      warningAmountGel: row.warning_amount_gel,
      showWarning: row.show_warning === "true",
      warningType: row.warning_type,
      basis: row.basis,
      sourceId: row.source_id,
    };
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/importMunicipalFacts.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/data/municipal apps/web/tests/data/municipal
git commit -m "feat(data): add municipal function and total fact loaders"
```

---

### Task 5: Fact generator and source rows

**Files:**
- Create: `apps/web/lib/data/municipal/generateMunicipalFacts.ts`
- Create: `apps/web/scripts/generate-municipal-facts.ts`
- Create: `data/imports/municipal-function-facts-2015-2025.csv` (generated)
- Create: `data/imports/municipal-total-facts-2015-2025.csv` (generated)
- Modify: `data/sources/source-documents.csv`
- Modify: `apps/web/package.json`
- Test: `apps/web/tests/data/municipal/generateMunicipalFacts.test.ts`

**Interfaces:**
- Consumes: `municipalCategoryIdForCode` (Task 3), `loadMunicipalFunctionFacts` / `loadMunicipalTotalFacts` (Task 4), `loadMunicipalitiesFile` (Task 2).
- Produces: `generateMunicipalFactCsvs(): Promise<{ functionRows: number; totalRows: number }>` which writes both `data/imports` files.

Add these two rows to `data/sources/source-documents.csv` (keep the file's existing BOM and column order):

```csv
source.municipal_portal_archive,Archived Municipalities Analytical Portal open-data exports (2015-2019 functional actuals),docs/Raw Data/Municipalities/municipalities.mof.ge-archive-2022/functionals/functionals.csv,2026-07-26
source.municipal_mof_annual_and_history_workbooks,MoF annual functional-classification workbooks (2020-2025) and municipality budget-history workbooks (2016-2025 total payments),docs/Raw Data/Municipalities/mof-functional-classification + docs/Raw Data/Municipalities/mof-municipality-budget-history-2016-2025,2026-07-26
```

Pick the `source_id` per row from `source_family` in the raw package: `municipalities_mof_ge_portal_archive` → `source.municipal_portal_archive`, anything else → `source.municipal_mof_annual_and_history_workbooks`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/generateMunicipalFacts.test.ts
import { describe, expect, it } from "vitest";
import { loadMunicipalitiesFile } from "../../../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../../../lib/data/municipal/importMunicipalFacts";
import { loadMunicipalFunctionsFile } from "../../../lib/data/municipal/taxonomyFiles";

const FUNCTION_FACTS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const TOTAL_FACTS = "../../data/imports/municipal-total-facts-2015-2025.csv";
const MUNICIPALITIES = "../../data/imports/municipalities.csv";
const FUNCTIONS = "../../data/taxonomy/municipal-functions.json";

const YEARS = Array.from({ length: 11 }, (_, index) => 2015 + index);

describe("generated municipal fact files", () => {
  it("is dense: 10 functions x 69 municipalities x 11 years", async () => {
    const facts = await loadMunicipalFunctionFacts(FUNCTION_FACTS);

    expect(facts).toHaveLength(7590);
    expect(new Set(facts.map((fact) => fact.year))).toEqual(new Set(YEARS));
  });

  it("has one total row per municipality-year", async () => {
    const totals = await loadMunicipalTotalFacts(TOTAL_FACTS);
    const keys = totals.map((total) => `${total.year}:${total.municipalityCode}`);

    expect(totals).toHaveLength(759);
    expect(new Set(keys).size).toBe(759);
  });

  it("references only registered municipalities", async () => {
    const [facts, totals, municipalities] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalTotalFacts(TOTAL_FACTS),
      loadMunicipalitiesFile(MUNICIPALITIES),
    ]);
    const codes = new Set(municipalities.map((row) => row.code));

    expect(facts.filter((fact) => !codes.has(fact.municipalityCode))).toEqual([]);
    expect(totals.filter((total) => !codes.has(total.municipalityCode))).toEqual([]);
  });

  it("uses the semantic id matching each functional code", async () => {
    const [facts, functions] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalFunctionsFile(FUNCTIONS),
    ]);
    const idByCode = new Map(functions.map((entry) => [entry.functionalCode, entry.id]));

    for (const fact of facts) {
      expect(fact.categoryId).toBe(idByCode.get(fact.functionalCode));
    }
  });

  it("sums the ten functions to functional_sum_gel for every municipality-year", async () => {
    const [facts, totals] = await Promise.all([
      loadMunicipalFunctionFacts(FUNCTION_FACTS),
      loadMunicipalTotalFacts(TOTAL_FACTS),
    ]);
    const sums = new Map<string, number>();

    for (const fact of facts) {
      const key = `${fact.year}:${fact.municipalityCode}`;
      sums.set(key, (sums.get(key) ?? 0) + fact.amountGel);
    }

    for (const total of totals) {
      const key = `${total.year}:${total.municipalityCode}`;
      // Tolerance absorbs float addition over ten Decimal(18,2) values only.
      expect(Math.abs((sums.get(key) ?? 0) - total.functionalSumGel), key).toBeLessThan(0.01);
    }
  });

  it("carries the methodology's warning counts unchanged", async () => {
    const totals = await loadMunicipalTotalFacts(TOTAL_FACTS);
    const counts = new Map<string, number>();

    for (const total of totals) {
      counts.set(total.warningType, (counts.get(total.warningType) ?? 0) + 1);
    }

    expect(counts.get("source_version_difference")).toBe(24);
    expect(counts.get("financing_outside_functional")).toBe(21);
    expect(counts.get("source_actual_missing")).toBe(1);
    expect(totals.filter((total) => total.showWarning)).toHaveLength(45);
  });

  it("ships without a BOM, matching the other data/imports files", async () => {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");

    for (const file of [FUNCTION_FACTS, TOTAL_FACTS]) {
      const buffer = await readFile(path.resolve(process.cwd(), file));
      expect(buffer.subarray(0, 3).toString("hex"), file).not.toBe("efbbbf");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/generateMunicipalFacts.test.ts`
Expected: FAIL — `ENOENT` on `municipal-function-facts-2015-2025.csv`.

- [ ] **Step 3: Write the generator**

```typescript
// apps/web/lib/data/municipal/generateMunicipalFacts.ts
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readCsvRecords } from "../csv";
import { csvEscape } from "../csvEscape";
import { municipalCategoryIdForCode } from "./functionMapping";

const RAW_DIR = "../../docs/Raw Data/Municipalities/combined-annual-2015-2025";
const RAW_FUNCTIONS = `${RAW_DIR}/municipal-functional-main-annual-2015-2025.csv`;
const RAW_TOTALS = `${RAW_DIR}/municipal-total-payments-annual-2015-2025.csv`;

const OUT_FUNCTIONS = "../../data/imports/municipal-function-facts-2015-2025.csv";
const OUT_TOTALS = "../../data/imports/municipal-total-facts-2015-2025.csv";

const PORTAL_SOURCE = "source.municipal_portal_archive";
const WORKBOOK_SOURCE = "source.municipal_mof_annual_and_history_workbooks";

const FUNCTION_HEADER = [
  "year",
  "municipality_code",
  "category_id",
  "functional_code",
  "amount_gel",
  "basis",
  "source_id",
];

const TOTAL_HEADER = [
  "year",
  "municipality_code",
  "public_total_gel",
  "public_total_measure",
  "total_payments_gel",
  "expenses_gel",
  "nonfinancial_asset_growth_gel",
  "financial_asset_growth_gel",
  "liability_decrease_gel",
  "functional_sum_gel",
  "reconciliation_difference_gel",
  "warning_amount_gel",
  "show_warning",
  "warning_type",
  "basis",
  "source_id",
];

function sourceIdFor(sourceFamily: string): string {
  return sourceFamily === "municipalities_mof_ge_portal_archive" ? PORTAL_SOURCE : WORKBOOK_SOURCE;
}

// Amounts stay at two decimals so the CSV, the Decimal(18,2) column and the
// parity comparison all describe the same number.
function money(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "" : Number(trimmed).toFixed(2);
}

function boolText(value: string): string {
  return value.trim().toLowerCase() === "true" ? "true" : "false";
}

function warningType(value: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? "none" : trimmed;
}

function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

async function writeRelative(relativePath: string, content: string): Promise<void> {
  // utf8 with no BOM, matching the other data/imports files.
  await writeFile(path.resolve(process.cwd(), relativePath), content, "utf8");
}

export async function generateMunicipalFactCsvs(): Promise<{
  functionRows: number;
  totalRows: number;
}> {
  const [rawFunctions, rawTotals] = await Promise.all([
    readCsvRecords(RAW_FUNCTIONS),
    readCsvRecords(RAW_TOTALS),
  ]);

  const functionRows = rawFunctions
    .map((record) => ({
      year: Number(record.year),
      code: record.municipality_code,
      functionalCode: record.functional_code,
      record,
    }))
    .sort(
      (left, right) =>
        left.year - right.year ||
        left.code.localeCompare(right.code) ||
        Number(left.functionalCode.slice(2)) - Number(right.functionalCode.slice(2)),
    )
    .map(({ record }) => [
      record.year,
      record.municipality_code,
      municipalCategoryIdForCode(record.functional_code),
      record.functional_code,
      money(record.amount_gel),
      "actual",
      sourceIdFor(record.source_family),
    ]);

  const totalRows = rawTotals
    .map((record) => ({ year: Number(record.year), code: record.municipality_code, record }))
    .sort((left, right) => left.year - right.year || left.code.localeCompare(right.code))
    .map(({ record }) => [
      record.year,
      record.municipality_code,
      money(record.public_total_gel),
      record.public_total_measure,
      money(record.total_payments_gel),
      money(record.expenses_gel),
      money(record.nonfinancial_asset_growth_gel),
      money(record.financial_asset_growth_gel),
      money(record.liability_decrease_gel),
      money(record.functional_sum_gel),
      money(record.reconciliation_difference_gel),
      money(record.warning_amount_gel),
      boolText(record.show_warning),
      warningType(record.warning_type),
      "actual",
      sourceIdFor(record.source_family),
    ]);

  await Promise.all([
    writeRelative(OUT_FUNCTIONS, toCsv(FUNCTION_HEADER, functionRows)),
    writeRelative(OUT_TOTALS, toCsv(TOTAL_HEADER, totalRows)),
  ]);

  return { functionRows: functionRows.length, totalRows: totalRows.length };
}
```

- [ ] **Step 4: Write the CLI script**

```typescript
// apps/web/scripts/generate-municipal-facts.ts
import { generateMunicipalFactCsvs } from "../lib/data/municipal/generateMunicipalFacts";

async function main() {
  const { functionRows, totalRows } = await generateMunicipalFactCsvs();
  console.log(`Wrote municipal function facts: ${functionRows}`);
  console.log(`Wrote municipal total facts: ${totalRows}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 5: Register the script**

In `apps/web/package.json`, add alongside the other `data:` scripts:

```json
"data:generate-municipal-facts": "tsx scripts/generate-municipal-facts.ts",
```

- [ ] **Step 6: Add the two source rows**

Append the two `source.municipal_*` rows from the Interfaces block to `data/sources/source-documents.csv`.

- [ ] **Step 7: Generate the files**

Run: `npm run data:generate-municipal-facts`
Expected: `Wrote municipal function facts: 7590` and `Wrote municipal total facts: 759`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/generateMunicipalFacts.test.ts`
Expected: PASS, 7 tests.

If the warning-count test fails, do **not** edit the generated CSV. The counts come from the raw package; a mismatch means the mapping dropped or duplicated rows.

- [ ] **Step 9: Commit**

```bash
git add data/imports/municipal-function-facts-2015-2025.csv data/imports/municipal-total-facts-2015-2025.csv data/sources/source-documents.csv apps/web/lib/data/municipal apps/web/scripts/generate-municipal-facts.ts apps/web/package.json apps/web/tests/data/municipal
git commit -m "feat(data): generate the reviewed municipal fact CSVs from the raw package"
```

---

### Task 6: Coverage constants and the validation gate

**Files:**
- Modify: `apps/web/lib/data/coverage.ts`
- Modify: `apps/web/scripts/validate-data-files.ts`
- Test: `apps/web/tests/data/municipal/coverage.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1-5.
- Produces: `MUNICIPAL_START_YEAR`, `MUNICIPAL_YEARS` from `lib/data/coverage`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/coverage.test.ts
import { describe, expect, it } from "vitest";
import { MUNICIPAL_YEARS } from "../../../lib/data/coverage";
import { loadMunicipalFunctionFacts } from "../../../lib/data/municipal/importMunicipalFacts";

describe("municipal coverage", () => {
  it("declares 2015-2025", () => {
    expect(MUNICIPAL_YEARS[0]).toBe(2015);
    expect(MUNICIPAL_YEARS.at(-1)).toBe(2025);
    expect(MUNICIPAL_YEARS).toHaveLength(11);
  });

  it("matches the years actually present in the served facts", async () => {
    const facts = await loadMunicipalFunctionFacts(
      "../../data/imports/municipal-function-facts-2015-2025.csv",
    );
    const years = [...new Set(facts.map((fact) => fact.year))].sort((a, b) => a - b);

    expect(years).toEqual([...MUNICIPAL_YEARS]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/coverage.test.ts`
Expected: FAIL — `MUNICIPAL_YEARS` is not exported.

- [ ] **Step 3: Add the coverage constants**

Append to `apps/web/lib/data/coverage.ts`:

```typescript
// Municipal coverage. 2015 is the first year the archived portal publishes a
// complete twelve-month functional series for all 69 municipalities; 2014 and
// earlier have no comparable source. See
// docs/data-methodology/municipal-functional-annual-2015-2025.md.
export const MUNICIPAL_START_YEAR = 2015;
export const MUNICIPAL_YEARS = inclusiveYears(MUNICIPAL_START_YEAR, APP_END_YEAR);
```

- [ ] **Step 4: Extend the validation script**

In `apps/web/scripts/validate-data-files.ts`, add these imports:

```typescript
import { MUNICIPAL_YEARS } from "../lib/data/coverage";
import { loadMunicipalitiesFile } from "../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../lib/data/municipal/importMunicipalFacts";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../lib/data/municipal/taxonomyFiles";
```

Inside `main()`, after the `adminSpendingFacts` load, add:

```typescript
  const municipalFunctions = await loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions);
  const municipalRegions = await loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions);
  const municipalities = await loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities);
  const municipalFunctionFacts = await loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts);
  const municipalTotalFacts = await loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts);
```

After the existing `assertYears` calls, add:

```typescript
  assertYears("Municipal", sortedYears(municipalFunctionFacts.map((row) => row.year)), MUNICIPAL_YEARS);

  const municipalCodes = new Set(municipalities.map((row) => row.code));
  const regionIds = new Set(municipalRegions.map((region) => region.id));
  const municipalCategoryIds = new Set(municipalFunctions.map((entry) => entry.id));

  const unknownRegions = municipalities.filter((row) => !regionIds.has(row.regionId));
  if (unknownRegions.length > 0) {
    throw new Error(
      `Municipalities reference unknown regions: ${unknownRegions.map((row) => `${row.code}→${row.regionId}`).join(", ")}`,
    );
  }

  const unknownCategories = Array.from(
    new Set(municipalFunctionFacts.filter((fact) => !municipalCategoryIds.has(fact.categoryId)).map((fact) => fact.categoryId)),
  ).sort();
  if (unknownCategories.length > 0) {
    throw new Error(`Municipal facts reference unknown categories: ${unknownCategories.join(", ")}`);
  }

  const unknownMunicipalities = Array.from(
    new Set(
      [...municipalFunctionFacts, ...municipalTotalFacts]
        .filter((fact) => !municipalCodes.has(fact.municipalityCode))
        .map((fact) => fact.municipalityCode),
    ),
  ).sort();
  if (unknownMunicipalities.length > 0) {
    throw new Error(`Municipal facts reference unregistered municipalities: ${unknownMunicipalities.join(", ")}`);
  }

  const unresolvedMunicipalSourceIds = Array.from(
    new Set(
      [...municipalFunctionFacts, ...municipalTotalFacts]
        .map((fact) => fact.sourceId)
        .filter((sourceId) => !registeredSourceIds.has(sourceId)),
    ),
  ).sort();
  if (unresolvedMunicipalSourceIds.length > 0) {
    throw new Error(`Municipal facts reference unknown source documents: ${unresolvedMunicipalSourceIds.join(", ")}`);
  }

  const expectedFunctionRows = municipalFunctions.length * municipalities.length * MUNICIPAL_YEARS.length;
  if (municipalFunctionFacts.length !== expectedFunctionRows) {
    throw new Error(
      `Municipal function facts must be dense: expected ${expectedFunctionRows} rows, got ${municipalFunctionFacts.length}. ` +
        "Re-run npm run data:generate-municipal-facts.",
    );
  }

  const expectedTotalRows = municipalities.length * MUNICIPAL_YEARS.length;
  if (municipalTotalFacts.length !== expectedTotalRows) {
    throw new Error(
      `Municipal total facts must be dense: expected ${expectedTotalRows} rows, got ${municipalTotalFacts.length}.`,
    );
  }

  // Density alone does not prove uniqueness — 7,590 rows could still contain a
  // duplicate and a hole. The import asserts this too, but the import needs a
  // database and CI runs this gate without one.
  const functionKeys = municipalFunctionFacts.map(
    (fact) => `${fact.year}:${fact.municipalityCode}:${fact.categoryId}`,
  );
  if (new Set(functionKeys).size !== functionKeys.length) {
    throw new Error("Municipal function facts contain duplicate (year, municipality, category) keys.");
  }

  const totalKeys = municipalTotalFacts.map((total) => `${total.year}:${total.municipalityCode}`);
  if (new Set(totalKeys).size !== totalKeys.length) {
    throw new Error("Municipal total facts contain duplicate (year, municipality) keys.");
  }

  const unusedRegions = municipalRegions
    .filter((region) => !municipalities.some((row) => row.regionId === region.id))
    .map((region) => region.id);
  if (unusedRegions.length > 0) {
    throw new Error(`Regions with no municipalities: ${unusedRegions.join(", ")}`);
  }
```

Before the final `console.log` block, add:

```typescript
  console.log(`Validated municipal function rows: ${municipalFunctionFacts.length}`);
  console.log(`Validated municipal total rows: ${municipalTotalFacts.length}`);
  console.log(`Validated municipalities: ${municipalities.length}`);
```

Note: `SERVED_DATA_FILES` gains its municipal keys in Task 7. Do Task 7 before running the gate, or the script will not typecheck.

- [ ] **Step 5: Run the coverage test**

Run: `npm test -- tests/data/municipal/coverage.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/data/coverage.ts apps/web/scripts/validate-data-files.ts apps/web/tests/data/municipal/coverage.test.ts
git commit -m "feat(data): add municipal coverage constants and validation gate"
```

---

### Task 7: Served-data wiring (CSV path)

**Files:**
- Modify: `apps/web/lib/data/servedData.ts`
- Modify: `apps/web/lib/data/servedDataParity.ts`
- Test: `apps/web/tests/data/municipal/servedMunicipalData.test.ts`

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces:
  - `SERVED_DATA_FILES.municipalFunctions | municipalRegions | municipalities | municipalFunctionFacts | municipalTotalFacts`
  - `MunicipalData { functions: MunicipalFunction[]; regions: MunicipalRegion[]; municipalities: Municipality[]; functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[] }`
  - `loadServedMunicipalData(): Promise<MunicipalData>`
  - `municipalFunctionFactParityKey(row)`, `municipalTotalFactParityKey(row)`

`MunicipalData` is deliberately **not** folded into `ExplorerData`. The expenditure, revenue and analysis routes would then load 8,349 rows they never read, on every build, and in db mode parity-check them too.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/tests/data/municipal/servedMunicipalData.test.ts
import { afterEach, describe, expect, it } from "vitest";
import {
  loadServedMunicipalData,
  resetServedDataCacheForTests,
} from "../../../lib/data/servedData";

afterEach(() => {
  resetServedDataCacheForTests();
});

describe("loadServedMunicipalData", () => {
  it("loads the whole municipal dataset from the reviewed CSVs", async () => {
    const data = await loadServedMunicipalData();

    expect(data.functions).toHaveLength(10);
    expect(data.regions).toHaveLength(11);
    expect(data.municipalities).toHaveLength(69);
    expect(data.functionFacts).toHaveLength(7590);
    expect(data.totalFacts).toHaveLength(759);
  });

  it("returns facts in year-ascending order", async () => {
    const data = await loadServedMunicipalData();
    const years = data.functionFacts.map((fact) => fact.year);

    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("memoises within a process", async () => {
    const first = await loadServedMunicipalData();
    const second = await loadServedMunicipalData();

    expect(second).toBe(first);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/data/municipal/servedMunicipalData.test.ts`
Expected: FAIL — `loadServedMunicipalData` is not exported.

- [ ] **Step 3: Add the parity keys**

Append to `apps/web/lib/data/servedDataParity.ts`:

```typescript
export function municipalFunctionFactParityKey(row: {
  year: number;
  municipalityCode: string;
  categoryId: string;
}): string {
  return [row.year, row.municipalityCode, row.categoryId].join(":");
}

export function municipalTotalFactParityKey(row: {
  year: number;
  municipalityCode: string;
}): string {
  return [row.year, row.municipalityCode].join(":");
}
```

- [ ] **Step 4: Extend servedData.ts**

Add to the imports:

```typescript
import type {
  Municipality,
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalRegion,
  MunicipalTotalFact,
} from "./municipal/types";
import { loadMunicipalitiesFile } from "./municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "./municipal/importMunicipalFacts";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "./municipal/taxonomyFiles";
import {
  municipalFunctionFactParityKey,
  municipalTotalFactParityKey,
} from "./servedDataParity";
```

Extend `SERVED_DATA_FILES` with:

```typescript
  municipalFunctions: "../../data/taxonomy/municipal-functions.json",
  municipalRegions: "../../data/taxonomy/municipal-regions.json",
  municipalities: "../../data/imports/municipalities.csv",
  municipalFunctionFacts: "../../data/imports/municipal-function-facts-2015-2025.csv",
  municipalTotalFacts: "../../data/imports/municipal-total-facts-2015-2025.csv",
```

Add after the `ExplorerData` type:

```typescript
// Municipal data is its own load, not part of ExplorerData: only the
// municipalities routes read it, and folding 8,349 rows into the explorer
// payload would make every other route pay for them on every build — and, in
// db mode, parity-check them too.
export type MunicipalData = {
  functions: MunicipalFunction[];
  regions: MunicipalRegion[];
  municipalities: Municipality[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
};
```

Add the loader, memo and parity assert:

```typescript
async function loadMunicipalDataFromCsv(): Promise<MunicipalData> {
  const [functions, regions, municipalities, functionFacts, totalFacts] = await Promise.all([
    loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions),
    loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions),
    loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities),
    loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts),
    loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts),
  ]);

  return {
    functions,
    regions,
    municipalities,
    functionFacts: byYearAscending(functionFacts),
    totalFacts: byYearAscending(totalFacts),
  };
}

function assertMunicipalParity(db: MunicipalData, csv: MunicipalData): void {
  assertSameServedRows("municipal functions", csv.functions, db.functions, (row) => row.id);
  assertSameServedRows("municipal regions", csv.regions, db.regions, (row) => row.id);
  assertSameServedRows("municipalities", csv.municipalities, db.municipalities, (row) => row.code);
  assertSameServedRows(
    "municipal function facts",
    csv.functionFacts,
    db.functionFacts,
    municipalFunctionFactParityKey,
  );
  assertSameServedRows(
    "municipal total facts",
    csv.totalFacts,
    db.totalFacts,
    municipalTotalFactParityKey,
  );
}

async function loadServedMunicipalDataUncached(): Promise<MunicipalData> {
  if (resolveServedDataSource() === "db") {
    const { loadMunicipalDataFromDb } = await import("../db/servedDataDb");
    const [db, csv] = await Promise.all([loadMunicipalDataFromDb(), loadMunicipalDataFromCsv()]);
    assertMunicipalParity(db, csv);
    return db;
  }

  return loadMunicipalDataFromCsv();
}

let municipalDataPromise: Promise<MunicipalData> | null = null;

export function loadServedMunicipalData(): Promise<MunicipalData> {
  municipalDataPromise ??= loadServedMunicipalDataUncached();
  return municipalDataPromise;
}
```

Add to `resetServedDataCacheForTests`:

```typescript
  municipalDataPromise = null;
```

Note: `loadMunicipalDataFromDb` does not exist until Task 9. The dynamic `import()` is inside a branch that only runs in db mode, so the CSV tests pass now, but **typecheck will fail** until Task 9 lands. Run Task 9 before `npm run check`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/data/municipal/servedMunicipalData.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Run the validation gate**

Run: `npm run data:validate`
Expected: exit 0, including `Validated municipal function rows: 7590`.

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/data/servedData.ts apps/web/lib/data/servedDataParity.ts apps/web/tests/data/municipal
git commit -m "feat(data): serve the municipal dataset from the reviewed CSVs"
```

---

### Task 8: Prisma models and migration

**Files:**
- Modify: `apps/web/prisma/schema.prisma`
- Create: `apps/web/prisma/migrations/<timestamp>_municipal_dataset/migration.sql` (generated)

**Interfaces:**
- Consumes: nothing at runtime.
- Produces: Prisma models `MunicipalFunctionCategory`, `MunicipalRegion`, `Municipality`, `MunicipalFunctionFact`, `MunicipalTotalFact`, and enum `MunicipalWarningType`.

- [ ] **Step 1: Add the models**

Append to `apps/web/prisma/schema.prisma`:

```prisma
enum MunicipalWarningType {
  none
  source_version_difference
  financing_outside_functional
  reconciliation_review_required
  source_actual_missing
}

// Mirror of data/taxonomy/municipal-functions.json.
model MunicipalFunctionCategory {
  id             String                 @id
  kaLabel        String
  functionalCode String                 @unique
  sortOrder      Int
  facts          MunicipalFunctionFact[]
}

// Mirror of data/taxonomy/municipal-regions.json.
model MunicipalRegion {
  id             String          @id
  kaLabel        String
  sortOrder      Int
  municipalities Municipality[]
}

// Mirror of data/imports/municipalities.csv.
// code is the official municipality code and stays text: leading zeros ("04")
// are part of the identifier.
model Municipality {
  code                String                  @id
  sortId              Int
  nameKa              String
  displayNameKa       String
  regionId            String
  region              MunicipalRegion         @relation(fields: [regionId], references: [id])
  isSelfGoverningCity Boolean
  functionFacts       MunicipalFunctionFact[]
  totalFacts          MunicipalTotalFact[]

  @@index([regionId])
}

// Mirror of data/imports/municipal-function-facts-2015-2025.csv.
// id is deterministic: `${year}:${municipalityCode}:${categoryId}`.
model MunicipalFunctionFact {
  id               String                    @id
  year             Int
  municipalityCode String
  municipality     Municipality              @relation(fields: [municipalityCode], references: [code])
  categoryId       String
  category         MunicipalFunctionCategory @relation(fields: [categoryId], references: [id])
  functionalCode   String
  amountGel        Decimal                   @db.Decimal(18, 2)
  basis            BudgetBasis
  sourceId         String

  @@unique([year, municipalityCode, categoryId])
  @@index([year])
  @@index([municipalityCode])
}

// Mirror of data/imports/municipal-total-facts-2015-2025.csv.
// id is deterministic: `${year}:${municipalityCode}`.
// The nullable component columns are null where the official source does not
// publish the value — never coerced to zero, which would read as "spent none".
model MunicipalTotalFact {
  id                          String               @id
  year                        Int
  municipalityCode            String
  municipality                Municipality         @relation(fields: [municipalityCode], references: [code])
  publicTotalGel              Decimal              @db.Decimal(18, 2)
  publicTotalMeasure          String
  totalPaymentsGel            Decimal?             @db.Decimal(18, 2)
  expensesGel                 Decimal?             @db.Decimal(18, 2)
  nonfinancialAssetGrowthGel  Decimal?             @db.Decimal(18, 2)
  financialAssetGrowthGel     Decimal?             @db.Decimal(18, 2)
  liabilityDecreaseGel        Decimal?             @db.Decimal(18, 2)
  functionalSumGel            Decimal              @db.Decimal(18, 2)
  reconciliationDifferenceGel Decimal?             @db.Decimal(18, 2)
  warningAmountGel            Decimal?             @db.Decimal(18, 2)
  showWarning                 Boolean
  warningType                 MunicipalWarningType
  basis                       BudgetBasis
  sourceId                    String

  @@unique([year, municipalityCode])
  @@index([year])
}
```

- [ ] **Step 2: Create the migration**

Run: `npm run prisma:migrate -- --name municipal_dataset`
Expected: a new folder under `prisma/migrations/` and `Your database is now in sync with your schema.`

If no database is reachable, generate SQL only:
`npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$SHADOW_DATABASE_URL" --script > migration.sql`

- [ ] **Step 3: Enable row level security**

The existing mirror tables all have RLS (`prisma/migrations/20260713220000_enable_row_level_security`). Append to the new migration's `migration.sql`:

```sql
ALTER TABLE "MunicipalFunctionCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalRegion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Municipality" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalFunctionFact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MunicipalTotalFact" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 4: Regenerate the client**

Run: `npm run prisma:generate`
Expected: `Generated Prisma Client`.

- [ ] **Step 5: Verify the client typechecks**

Run: `npm run typecheck`
Expected: FAIL only on `loadMunicipalDataFromDb` missing from `lib/db/servedDataDb` (Task 7's forward reference). No errors inside `lib/generated/prisma`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/prisma apps/web/lib/generated/prisma
git commit -m "feat(db): add municipal dataset models and migration"
```

---

### Task 9: Mirror readers and the db serving path

**Files:**
- Modify: `apps/web/lib/db/mirrorRows.ts`
- Modify: `apps/web/lib/db/servedDataDb.ts`

**Interfaces:**
- Consumes: Prisma models (Task 8), the row types (Tasks 1, 2, 4).
- Produces: `loadMunicipalFunctionsFromMirror`, `loadMunicipalRegionsFromMirror`, `loadMunicipalitiesFromMirror`, `loadMunicipalFunctionFactsFromMirror`, `loadMunicipalTotalFactsFromMirror`, all `(db: MirrorClient) => Promise<...>`; and `loadMunicipalDataFromDb(): Promise<MunicipalData>`.

Every reader must return exactly the shape the CSV loader returns, or parity fails on every db build. `Decimal` becomes `number`; nullable Decimals become `number | null`.

- [ ] **Step 1: Add the mirror readers**

Append to `apps/web/lib/db/mirrorRows.ts` (and extend its type imports with the five municipal types from `../data/municipal/types`):

```typescript
function decimalOrNull(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value);
}

export async function loadMunicipalFunctionsFromMirror(
  db: MirrorClient,
): Promise<MunicipalFunction[]> {
  const rows = await db.municipalFunctionCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    kaLabel: row.kaLabel,
    functionalCode: row.functionalCode,
    sortOrder: row.sortOrder,
  }));
}

export async function loadMunicipalRegionsFromMirror(
  db: MirrorClient,
): Promise<MunicipalRegion[]> {
  const rows = await db.municipalRegion.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({ id: row.id, kaLabel: row.kaLabel, sortOrder: row.sortOrder }));
}

export async function loadMunicipalitiesFromMirror(db: MirrorClient): Promise<Municipality[]> {
  const rows = await db.municipality.findMany({ orderBy: [{ sortId: "asc" }, { code: "asc" }] });

  return rows.map((row) => ({
    code: row.code,
    sortId: row.sortId,
    nameKa: row.nameKa,
    displayNameKa: row.displayNameKa,
    regionId: row.regionId,
    isSelfGoverningCity: row.isSelfGoverningCity,
  }));
}

export async function loadMunicipalFunctionFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalFunctionFact[]> {
  const rows = await db.municipalFunctionFact.findMany({
    orderBy: [{ year: "asc" }, { municipalityCode: "asc" }, { categoryId: "asc" }],
  });

  if (rows.length === 0) {
    throw new Error(
      "The database has no municipal function facts. Run `npm run data:import` first, " +
        "or build with GEODATA_DATA_SOURCE=csv. If the import has already succeeded, " +
        "check the role in DATABASE_URL: the mirror tables use row level security, " +
        "which hides all rows from non-owner roles.",
    );
  }

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(`Municipal function fact ${row.id} must have basis=actual, got ${row.basis}`);
    }

    return {
      year: row.year,
      municipalityCode: row.municipalityCode,
      categoryId: row.categoryId,
      functionalCode: row.functionalCode,
      amountGel: Number(row.amountGel),
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}

export async function loadMunicipalTotalFactsFromMirror(
  db: MirrorClient,
): Promise<MunicipalTotalFact[]> {
  const rows = await db.municipalTotalFact.findMany({
    orderBy: [{ year: "asc" }, { municipalityCode: "asc" }],
  });

  return rows.map((row) => {
    if (row.basis !== "actual") {
      throw new Error(`Municipal total fact ${row.id} must have basis=actual, got ${row.basis}`);
    }

    return {
      year: row.year,
      municipalityCode: row.municipalityCode,
      publicTotalGel: Number(row.publicTotalGel),
      publicTotalMeasure: row.publicTotalMeasure,
      totalPaymentsGel: decimalOrNull(row.totalPaymentsGel),
      expensesGel: decimalOrNull(row.expensesGel),
      nonfinancialAssetGrowthGel: decimalOrNull(row.nonfinancialAssetGrowthGel),
      financialAssetGrowthGel: decimalOrNull(row.financialAssetGrowthGel),
      liabilityDecreaseGel: decimalOrNull(row.liabilityDecreaseGel),
      functionalSumGel: Number(row.functionalSumGel),
      reconciliationDifferenceGel: decimalOrNull(row.reconciliationDifferenceGel),
      warningAmountGel: decimalOrNull(row.warningAmountGel),
      showWarning: row.showWarning,
      warningType: row.warningType,
      basis: "actual" as const,
      sourceId: row.sourceId,
    };
  });
}
```

- [ ] **Step 2: Add the db loader**

Append to `apps/web/lib/db/servedDataDb.ts` (extending its imports):

```typescript
export async function loadMunicipalDataFromDb(): Promise<MunicipalData> {
  const [functions, regions, municipalities, functionFacts, totalFacts] = await Promise.all([
    loadMunicipalFunctionsFromMirror(prisma),
    loadMunicipalRegionsFromMirror(prisma),
    loadMunicipalitiesFromMirror(prisma),
    loadMunicipalFunctionFactsFromMirror(prisma),
    loadMunicipalTotalFactsFromMirror(prisma),
  ]);

  return { functions, regions, municipalities, functionFacts, totalFacts };
}
```

- [ ] **Step 3: Verify typecheck now passes**

Run: `npm run typecheck`
Expected: exit 0, no errors.

- [ ] **Step 4: Verify the CSV path still works**

Run: `npm test -- tests/data/municipal`
Expected: PASS, all municipal tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/db
git commit -m "feat(db): read the municipal mirror on the db serving path"
```

---

### Task 10: Import script wiring

**Files:**
- Modify: `apps/web/scripts/import-budget-facts.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: no new exports; the import now populates and verifies the five municipal tables.

Deletion order matters: children before parents. `MunicipalFunctionFact` and `MunicipalTotalFact` reference `Municipality`, which references `MunicipalRegion`.

- [ ] **Step 1: Add the loads**

Add to the imports at the top of `scripts/import-budget-facts.ts`:

```typescript
import { loadMunicipalitiesFile } from "../lib/data/municipal/municipalitiesFile";
import {
  loadMunicipalFunctionFacts,
  loadMunicipalTotalFacts,
} from "../lib/data/municipal/importMunicipalFacts";
import {
  loadMunicipalFunctionsFile,
  loadMunicipalRegionsFile,
} from "../lib/data/municipal/taxonomyFiles";
```

In `main()`, replace the existing seven-element destructure with:

```typescript
  const [
    taxonomy,
    glossary,
    adminCategories,
    sourceDocuments,
    mappings,
    budgetFacts,
    adminFacts,
    municipalFunctions,
    municipalRegions,
    municipalities,
    municipalFunctionFacts,
    municipalTotalFacts,
  ] = await Promise.all([
    loadTaxonomyFiles(TAXONOMY_DIR),
    loadGlossary(SERVED_DATA_FILES.glossary),
    loadAdminSpendingCategoriesFile(SERVED_DATA_FILES.adminSpendingCategories),
    loadSourceDocuments(SERVED_DATA_FILES.sourceDocuments),
    loadSpendingMappings(MAPPINGS_FILE),
    loadBudgetFactRows(SERVED_DATA_FILES.budgetFacts),
    loadAdminSpendingFacts(SERVED_DATA_FILES.adminSpendingFacts),
    loadMunicipalFunctionsFile(SERVED_DATA_FILES.municipalFunctions),
    loadMunicipalRegionsFile(SERVED_DATA_FILES.municipalRegions),
    loadMunicipalitiesFile(SERVED_DATA_FILES.municipalities),
    loadMunicipalFunctionFacts(SERVED_DATA_FILES.municipalFunctionFacts),
    loadMunicipalTotalFacts(SERVED_DATA_FILES.municipalTotalFacts),
  ]);
```

- [ ] **Step 2: Add the pre-flight assertions**

After the existing `assertSubset` calls:

```typescript
  const municipalRegionIds = new Set(municipalRegions.map((region) => region.id));
  const municipalCategoryIds = new Set(municipalFunctions.map((entry) => entry.id));
  const municipalityCodes = new Set(municipalities.map((row) => row.code));

  assertSubset("Municipality region IDs", municipalities.map((row) => row.regionId), municipalRegionIds);
  assertSubset("Municipal fact category IDs", municipalFunctionFacts.map((fact) => fact.categoryId), municipalCategoryIds);
  assertSubset(
    "Municipal fact municipality codes",
    [...municipalFunctionFacts, ...municipalTotalFacts].map((fact) => fact.municipalityCode),
    municipalityCodes,
  );
  assertSubset(
    "Municipal fact source IDs",
    [...municipalFunctionFacts, ...municipalTotalFacts].map((fact) => fact.sourceId),
    sourceIds,
  );
  assertUnique("municipal function fact natural key", municipalFunctionFacts.map(municipalFunctionFactParityKey));
  assertUnique("municipal total fact natural key", municipalTotalFacts.map(municipalTotalFactParityKey));
  assertAmountPrecision("Municipal function fact", municipalFunctionFacts);
```

- [ ] **Step 3: Extend the transaction**

Add to the `deleteMany` block, **before** `tx.sourceDocument.deleteMany()`:

```typescript
        await tx.municipalFunctionFact.deleteMany();
        await tx.municipalTotalFact.deleteMany();
        await tx.municipality.deleteMany();
        await tx.municipalRegion.deleteMany();
        await tx.municipalFunctionCategory.deleteMany();
```

Add the writes after `tx.adminSpendingCategory.createMany`:

```typescript
        await tx.municipalRegion.createMany({
          data: municipalRegions.map((region) => ({
            id: region.id,
            kaLabel: region.kaLabel,
            sortOrder: region.sortOrder,
          })),
        });

        await tx.municipalFunctionCategory.createMany({
          data: municipalFunctions.map((entry) => ({
            id: entry.id,
            kaLabel: entry.kaLabel,
            functionalCode: entry.functionalCode,
            sortOrder: entry.sortOrder,
          })),
        });

        await tx.municipality.createMany({
          data: municipalities.map((row) => ({
            code: row.code,
            sortId: row.sortId,
            nameKa: row.nameKa,
            displayNameKa: row.displayNameKa,
            regionId: row.regionId,
            isSelfGoverningCity: row.isSelfGoverningCity,
          })),
        });

        await tx.municipalFunctionFact.createMany({
          data: municipalFunctionFacts.map((fact) => ({
            id: municipalFunctionFactParityKey(fact),
            year: fact.year,
            municipalityCode: fact.municipalityCode,
            categoryId: fact.categoryId,
            functionalCode: fact.functionalCode,
            amountGel: fact.amountGel,
            basis: fact.basis,
            sourceId: fact.sourceId,
          })),
        });

        await tx.municipalTotalFact.createMany({
          data: municipalTotalFacts.map((total) => ({
            id: municipalTotalFactParityKey(total),
            year: total.year,
            municipalityCode: total.municipalityCode,
            publicTotalGel: total.publicTotalGel,
            publicTotalMeasure: total.publicTotalMeasure,
            totalPaymentsGel: total.totalPaymentsGel,
            expensesGel: total.expensesGel,
            nonfinancialAssetGrowthGel: total.nonfinancialAssetGrowthGel,
            financialAssetGrowthGel: total.financialAssetGrowthGel,
            liabilityDecreaseGel: total.liabilityDecreaseGel,
            functionalSumGel: total.functionalSumGel,
            reconciliationDifferenceGel: total.reconciliationDifferenceGel,
            warningAmountGel: total.warningAmountGel,
            showWarning: total.showWarning,
            warningType: total.warningType,
            basis: total.basis,
            sourceId: total.sourceId,
          })),
        });
```

- [ ] **Step 4: Verify parity inside the transaction**

The existing block sits after `tx.budgetMapping.createMany` under the comment beginning `// Row-level verification INSIDE the transaction`. Extend its `Promise.all` with the five municipal readers:

```typescript
        const [
          mirrorMunicipalFunctions,
          mirrorMunicipalRegions,
          mirrorMunicipalities,
          mirrorMunicipalFunctionFacts,
          mirrorMunicipalTotalFacts,
        ] = await Promise.all([
          loadMunicipalFunctionsFromMirror(tx),
          loadMunicipalRegionsFromMirror(tx),
          loadMunicipalitiesFromMirror(tx),
          loadMunicipalFunctionFactsFromMirror(tx),
          loadMunicipalTotalFactsFromMirror(tx),
        ]);
```

Then add these five assertions immediately after the `admin spending categories` one:

```typescript
        assertSameServedRows(
          "municipal functions",
          municipalFunctions,
          mirrorMunicipalFunctions,
          (row) => row.id,
        );
        assertSameServedRows(
          "municipal regions",
          municipalRegions,
          mirrorMunicipalRegions,
          (row) => row.id,
        );
        assertSameServedRows(
          "municipalities",
          municipalities,
          mirrorMunicipalities,
          (row) => row.code,
        );
        assertSameServedRows(
          "municipal function facts",
          municipalFunctionFacts,
          mirrorMunicipalFunctionFacts,
          municipalFunctionFactParityKey,
        );
        assertSameServedRows(
          "municipal total facts",
          municipalTotalFacts,
          mirrorMunicipalTotalFacts,
          municipalTotalFactParityKey,
        );
```

Import the five readers from `../lib/db/mirrorRows` and the two parity keys from `../lib/data/servedDataParity` at the top of the file.

The CSV-side arrays here are the loader outputs, unsorted. `assertSameServedRows` matches by key rather than by position, so ordering does not matter — but the field-by-field comparison does, which is why Task 9's readers must return `number` for every Decimal and `null` (never `0`) for every absent component.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: exit 0.

- [ ] **Step 6: Run the import**

Requires `apps/web/.env` with `DATABASE_URL` and `DIRECT_URL`.

Run: `npm run data:import`
Expected: parity `PASSED`, and `data/reports/db-import-parity.json` regenerated.

If no database is available, stop here and note it — the remaining verification in Task 11 covers CSV mode.

- [ ] **Step 7: Commit**

```bash
git add apps/web/scripts/import-budget-facts.ts
git commit -m "feat(data): mirror the municipal dataset in the parity-checked import"
```

---

### Task 11: Documentation and full verification

**Files:**
- Modify: `docs/data-methodology/municipal-functional-annual-2015-2025.md`
- Modify: `Project_Definition.md`
- Modify: `DESIGN.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update the methodology doc**

In `## Status and scope`, replace:

> The package is not imported into the GeoData.ge application or serving database.

with a short section recording: the package is now served (2026-08-02); only the ten main functions are imported and the six selected details are deliberately not; the semantic `municipal.*` IDs and their code mapping; the reviewed region assignment and the autonomous-republic caveat; and that population is present in the portal archive for 2015-2021 but is not imported (spec §8).

- [ ] **Step 2: Update Project_Definition.md §2**

Move `Municipal budgets explorer, and any municipal data or route` out of Excluded. Under Included, add: municipal annual expenditure data for 2015-2025, ten functional categories, 69 municipalities, served but with no route until the UI spec ships.

- [ ] **Step 3: Update DESIGN.md**

In §2, replace the sentence beginning `Municipal budgets are a named future section` with wording that says the data now ships while the section route does not, and that the sidebar and hub keep the `მალე` marker until the UI spec lands. In §2.1, add: `Municipal expenditure by functional category: **2015–2025** (10 functions, 69 municipalities).`

- [ ] **Step 4: Update AGENTS.md**

In `Current Project State`, add municipalities to the data rollout paragraph: served 2015-2025, ten functions, 69 municipalities, no route yet.

- [ ] **Step 5: Full verification**

Run: `npm run check`
Expected: exit 0 — lint, typecheck, unit tests, data validation.

Run: `npm run build`
Expected: exit 0. CSV mode; no new routes.

Run: `npm run test:browser`
Expected: PASS, unchanged — this plan adds no UI, and the `მუნიციპალიტეტები`-is-not-a-link assertions in `tests/browser/main-explorer.spec.ts:160-162` must still hold.

- [ ] **Step 6: Verify db mode**

Only if Task 10 Step 6 ran.

Run: `GEODATA_DATA_SOURCE=db npm run build`
Expected: exit 0, with the municipal parity check passing during the build.

- [ ] **Step 7: Commit**

```bash
git add docs/data-methodology/municipal-functional-annual-2015-2025.md Project_Definition.md DESIGN.md AGENTS.md
git commit -m "docs: record the municipal dataset as served"
```

---

## Spec coverage check

| Spec section | Task |
|---|---|
| §2 what ships / not shipping | 5 (generator filters to main), 6 (density gate) |
| §3 function mapping | 1, 3 |
| §4 registry, regions | 2 |
| §4.3 map join deferred | none — Spec 2 by design |
| §5 fact files, two totals | 4, 5 |
| §6 Prisma + parity import | 8, 9, 10 |
| §7 validation | 5 (tests), 6 (gate) |
| §8 population excluded | 11 (documented) |
| §9 doc updates | 11 |
| §11 definition of done | 11 |

## Known sequencing constraint

Task 7 forward-references `loadMunicipalDataFromDb`, which Task 9 creates. Tests pass in between; `npm run typecheck` does not. Run Tasks 7 → 8 → 9 without stopping for a full `npm run check` in between, or reorder 8 and 9 before 7 if the executing agent gates every task on typecheck.
