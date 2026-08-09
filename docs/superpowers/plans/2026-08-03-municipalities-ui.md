# Municipalities UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the GeoData.ge municipalities section — an index with a region choropleth and a ranked list, 64 municipality pages and 11 region pages — reading the municipal dataset that Spec 1 already serves.

**Architecture:** A new pure model layer (`lib/explorer/municipalData.ts`, `municipalGeo.ts`) converts served municipal rows into the `ExplorerTableRow[]` / `ChartSeries[]` shapes the existing `EditorialLineChart`, `RangeStrip` and `ExplorerTable` already consume. The three shipped budget routes are not modified except for two prop decouplings that preserve their output byte-for-byte. All 76 pages are statically prerendered.

**Tech Stack:** Next.js 16 (App Router, RSC), TypeScript strict, Tailwind v4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-03-municipalities-ui-design.md`. Read it before Task 1.

## Global Constraints

- All work happens in `apps/web` unless a path says otherwise. Run every command from `apps/web`.
- **Read `node_modules/next/dist/docs/` before writing route code.** This Next.js version differs from training data (`apps/web/AGENTS.md`).
- Design tokens are CSS variables only: `--paper`, `--tint`, `--tile`, `--ink`, `--body`, `--muted`, `--faint`, `--hairline`, `--hairline-soft`, `--row-border`, `--control`, `--accent`, `--positive`, `--negative`. Never hardcode a hex in a component.
- Fonts via `var(--font-display)` (serif), `var(--font-ui)` (sans), `var(--font-numeric)` (mono).
- **No cards, no shadows, no gradients, radius 0–3px.** Exceptions already granted: hub cards, the `% წილი` pill and slider handles (`999px`), chart tooltip shadow. Do not add new exceptions.
- Minus sign is `−` (U+2212). Missing values are `—`. Both come from `lib/explorer/format.ts`; never hand-write them.
- Georgian is the only UI language. No English strings in rendered output.
- Never hardcode a year. Every range, count and coverage label derives from the served facts.
- `npm run check` must pass before any commit. It runs lint, typecheck, vitest and data validation.
- Commit after every task. Never use `--no-verify`.

---

## File Structure

**Created**

| Path | Responsibility |
|---|---|
| `apps/web/scripts/fetch-region-geometry.ts` | One-shot vendoring script: download geoBoundaries ADM1, simplify, emit rings |
| `apps/web/lib/explorer/municipalGeo.ts` | Projection, `shapeISO`→region join, `buildRegionShapes()` |
| `apps/web/lib/explorer/municipalLabels.ts` | Reviewed Georgian genitives + the ordinal helper |
| `apps/web/lib/explorer/municipalData.ts` | Entity model, index model, region roll-ups, KPIs, movers, comparison |
| `apps/web/components/municipalities/region-map.tsx` | Choropleth, tooltip, hover readout |
| `apps/web/components/municipalities/municipalities-index.tsx` | Level tabs, search, ranked list, shared hover |
| `apps/web/components/municipalities/entity-picker.tsx` | ⌘K grouped popover |
| `apps/web/components/municipalities/municipal-explorer.tsx` | Shared workspace for municipality + region pages |
| `apps/web/components/municipalities/municipal-indicators.tsx` | KPI row, movers board, comparison table |
| `apps/web/components/municipalities/use-municipal-state.ts` | Client state + hash sync for entity pages |
| `apps/web/app/explorer/municipalities/page.tsx` | Index route |
| `apps/web/app/explorer/municipalities/[code]/page.tsx` | 64 municipality routes |
| `apps/web/app/explorer/municipalities/region/[id]/page.tsx` | 11 region routes |
| `apps/web/tests/explorer/municipalGeo.test.ts` | Join totality, projection |
| `apps/web/tests/explorer/municipalData.test.ts` | Model correctness |
| `apps/web/tests/explorer/municipalLabels.test.ts` | Ordinals, genitive coverage |
| `apps/web/tests/browser/municipalities.spec.ts` | End-to-end |

**Modified**

| Path | Change |
|---|---|
| `apps/web/lib/landing/georgiaGeo.ts` | Region rings → geoBoundaries; `iso` field added; attribution header |
| `apps/web/lib/explorer/format.ts` | `ValueUnit`, `UNIT_BN`, `UNIT_MLN`, `formatInUnit` |
| `apps/web/components/main-explorer/explorer-table.tsx` | `scope` → `firstColumnLabel`; `unit` prop |
| `apps/web/components/main-explorer/editorial-line-chart.tsx` | `unit` prop |
| `apps/web/components/main-explorer/explorer-view.tsx` | Pass the two new props |
| `apps/web/lib/explorer/colors.ts` | Ten `municipal.*` tokens |
| `apps/web/lib/explorer/types.ts` | `ExplorerItemLevel` gains `"municipal_function"` |
| `apps/web/lib/explorer/urlState.ts` | `parseMunicipalHash` / `serializeMunicipalHash` |
| `apps/web/lib/explorer/sections.ts` | `municipalities.href` → `/explorer/municipalities` |
| `apps/web/lib/explorer/hubCards.ts` | Second parameter for the municipal total series |
| `apps/web/app/explorer/page.tsx` | Pass municipal totals to `buildHubCards` |
| `apps/web/app/sitemap.ts` | 76 municipal URLs |
| `apps/web/tests/explorer/hubCards.test.ts` | New `buildHubCards` signature |
| `DESIGN.md`, `AGENTS.md`, `docs/data-methodology/municipal-functional-annual-2015-2025.md` | Docs |

---

### Task 1: Swap region geometry to geoBoundaries ADM1

The rings currently in `georgiaGeo.ts` are GADM, which forbids redistribution. Replace them with geoBoundaries `gbOpen/GEO/ADM1` (CC BY 3.0 — redistribution allowed, attribution required) and add the `iso` field the map join needs.

**Files:**
- Create: `apps/web/scripts/fetch-region-geometry.ts`
- Modify: `apps/web/lib/landing/georgiaGeo.ts` (header comment; `GeoRegion` type; every `ring` and new `iso`)
- Test: `apps/web/tests/explorer/municipalGeo.test.ts` (created here, extended in Task 4)

**Interfaces:**
- Consumes: nothing.
- Produces: `GeoRegion` gains `iso: string` (values `GE-AB`, `GE-AJ`, `GE-GU`, `GE-IM`, `GE-KA`, `GE-KK`, `GE-MM`, `GE-RL`, `GE-SJ`, `GE-SK`, `GE-SZ`, `GE-TB`). `GEORGIA_GEO.regions` stays a 12-element array; `en`, `ka`, `capKa`, `cap`, `pop` keep their current values; only `ring` changes.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/municipalGeo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";

const EXPECTED_ISO = [
  "GE-AB", "GE-AJ", "GE-GU", "GE-IM", "GE-KA", "GE-KK",
  "GE-MM", "GE-RL", "GE-SJ", "GE-SK", "GE-SZ", "GE-TB",
].sort();

describe("region geometry", () => {
  it("carries all twelve ADM1 units, each with a stable ISO code", () => {
    expect(GEORGIA_GEO.regions).toHaveLength(12);
    expect(GEORGIA_GEO.regions.map((region) => region.iso).sort()).toEqual(EXPECTED_ISO);
  });

  it("keeps every ring inside Georgia's bounding box", () => {
    for (const region of GEORGIA_GEO.regions) {
      for (const [lon, lat] of region.ring) {
        expect(lon).toBeGreaterThanOrEqual(39.9);
        expect(lon).toBeLessThanOrEqual(46.8);
        expect(lat).toBeGreaterThanOrEqual(41.0);
        expect(lat).toBeLessThanOrEqual(43.7);
      }
    }
  });

  it("simplifies to a path budget the index page can inline", () => {
    const points = GEORGIA_GEO.regions.reduce((sum, region) => sum + region.ring.length, 0);
    // 3,720 raw points at source; Douglas-Peucker at 0.006° yields ~1,194.
    expect(points).toBeGreaterThan(600);
    expect(points).toBeLessThan(1600);
  });

  it("keeps every ring a usable polygon", () => {
    for (const region of GEORGIA_GEO.regions) {
      expect(region.ring.length).toBeGreaterThanOrEqual(20);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalGeo.test.ts`
Expected: FAIL — `region.iso` is undefined, so the ISO assertion gets `[undefined × 12]`.

- [ ] **Step 3: Write the vendoring script**

Create `apps/web/scripts/fetch-region-geometry.ts`:

```ts
// One-shot vendoring of Georgia's ADM1 region rings into lib/landing/georgiaGeo.ts.
//
// Source: geoBoundaries gbOpen GEO ADM1, release 9469f09.
// Licence: CC BY 3.0 (licenseSource commons.wikimedia.org). Redistribution is
// permitted with attribution — which is why this replaced GADM, whose terms
// forbid redistribution regardless of commercial intent.
//
// Run manually when the geometry needs refreshing; the output is committed.
//   npx tsx scripts/fetch-region-geometry.ts

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SOURCE_URL =
  "https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/GEO/ADM1/geoBoundaries-GEO-ADM1_simplified.geojson";

// 0.006° ≈ 1.25px of error at 1400px render width, and takes the 12 rings from
// 3,720 points to ~1,194 (~15 KB of inlined path data).
const TOLERANCE = 0.006;

type Point = [number, number];

function perpendicularDistance(point: Point, start: Point, end: Point): number {
  const [x, y] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
}

function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points;
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let index = 0;
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i]!, first, last);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  return simplify(points.slice(0, index + 1), tolerance)
    .slice(0, -1)
    .concat(simplify(points.slice(index), tolerance));
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) throw new Error(`geoBoundaries fetch failed: ${response.status}`);
  const geojson = (await response.json()) as {
    features: Array<{
      properties: { shapeISO: string; shapeName: string };
      geometry: { type: string; coordinates: unknown };
    }>;
  };

  if (geojson.features.length !== 12) {
    throw new Error(`expected 12 ADM1 features, got ${geojson.features.length}`);
  }

  // Join on shapeISO, never shapeName: geoBoundaries spells Samtskhe–Javakheti
  // with an en dash (U+2013) and names GE-RL "Racha-Lechkhumi and Kvemo Svaneti",
  // neither of which matches the strings already in georgiaGeo.ts.
  const ringByIso = new Map<string, Point[]>();
  for (const feature of geojson.features) {
    if (feature.geometry.type !== "Polygon") {
      throw new Error(`${feature.properties.shapeISO}: expected Polygon, got ${feature.geometry.type}`);
    }
    const [outer] = feature.geometry.coordinates as Point[][];
    if (!outer) throw new Error(`${feature.properties.shapeISO}: no outer ring`);
    const simplified = simplify(outer, TOLERANCE).map(
      ([lon, lat]) => [Number(lon.toFixed(3)), Number(lat.toFixed(3))] as Point,
    );
    ringByIso.set(feature.properties.shapeISO, simplified);
  }

  const total = Array.from(ringByIso.values()).reduce((sum, ring) => sum + ring.length, 0);
  console.log(`12 rings, ${total} points after simplification at ${TOLERANCE}°`);
  for (const [iso, ring] of ringByIso) console.log(`  ${iso}  ${ring.length}`);

  const target = path.resolve(process.cwd(), "lib/landing/georgiaGeo.ts");
  const current = await readFile(target, "utf8");
  console.log(`\nRings ready. Paste into ${target} (current size ${current.length} bytes).`);
  await writeFile(
    path.resolve(process.cwd(), "region-rings.generated.json"),
    JSON.stringify(Object.fromEntries(ringByIso), null, 0),
    "utf8",
  );
  console.log("Wrote region-rings.generated.json — delete it after pasting.");
}

void main();
```

- [ ] **Step 4: Run the script**

Run: `npx tsx scripts/fetch-region-geometry.ts`
Expected: `12 rings, ~1194 points after simplification at 0.006°`, then a per-ISO point count, then `Wrote region-rings.generated.json`.

If the fetch fails with a network error, the URL is an LFS-backed file — confirm you used `media.githubusercontent.com`, not `raw.githubusercontent.com`, which returns an LFS pointer instead of the data.

- [ ] **Step 5: Update `georgiaGeo.ts`**

Replace the file's header comment (lines 1–5) with:

```ts
// Georgia (country) geodata for the landing hero relief and the municipalities
// region map.
//
// outline + regions: geoBoundaries gbOpen GEO ADM0/ADM1, release 9469f09,
//   © geoBoundaries, CC BY 3.0 (source: commons.wikimedia.org).
//   Region rings are simplified with Douglas-Peucker at 0.006°.
//   `iso` is the geoBoundaries shapeISO and is the join key for the region map —
//   never join on `en`, whose spelling differs from geoBoundaries' shapeName.
// cityMarkers: top-20 cities + Gurjaani, pop in thousands, placement-validated,
//   sorted by pop desc. Coordinates are [lon, lat].
```

Add `iso` to the type:

```ts
export type GeoRegion = {
  iso: string;
  en: string;
  ka: string;
  capKa: string;
  cap: [number, number];
  pop: number;
  ring: Array<[number, number]>;
};
```

Then, for each of the 12 entries in `GEORGIA_GEO.regions`, add its `iso` and replace its `ring` with the matching array from `region-rings.generated.json`. Map by `en`:

| `en` in the file | `iso` to add |
|---|---|
| Abkhazia | `GE-AB` |
| Adjara | `GE-AJ` |
| Guria | `GE-GU` |
| Imereti | `GE-IM` |
| Kakheti | `GE-KA` |
| Kvemo Kartli | `GE-KK` |
| Mtskheta-Mtianeti | `GE-MM` |
| Racha-Lechkhumi | `GE-RL` |
| Samegrelo-Zemo Svaneti | `GE-SZ` |
| Samtskhe-Javakheti | `GE-SJ` |
| Shida Kartli | `GE-SK` |
| Tbilisi | `GE-TB` |

Do **not** change `en`, `ka`, `capKa`, `cap` or `pop` — they are editorial/derived values, not geoBoundaries data.

- [ ] **Step 6: Delete the scratch file**

```bash
rm apps/web/region-rings.generated.json
```

- [ ] **Step 7: Run tests**

Run: `npm test -- tests/explorer/municipalGeo.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Verify the landing hero still renders**

Run: `npm run test:browser -- tests/browser/landing.spec.ts`
Expected: PASS. The hero reads `GEORGIA_GEO.regions[].ring` to classify terrain dots; new rings must not break it.

- [ ] **Step 9: Full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/scripts/fetch-region-geometry.ts apps/web/lib/landing/georgiaGeo.ts apps/web/tests/explorer/municipalGeo.test.ts
git commit -m "feat: vendor region geometry from geoBoundaries with attribution"
```

---

### Task 2: Make the value unit a parameter

`formatBn` renders billions with two fixed decimals and is hardcoded in `ExplorerTable` and `EditorialLineChart`. At municipal magnitudes that is unusable — ლენტეხი's 16.9M total renders as `0.02` and each of its ten functions as `0.00`. Make the unit a parameter without changing any existing output.

**Files:**
- Modify: `apps/web/lib/explorer/format.ts`, `apps/web/components/main-explorer/explorer-table.tsx`, `apps/web/components/main-explorer/editorial-line-chart.tsx`, `apps/web/components/main-explorer/explorer-view.tsx`
- Test: `apps/web/tests/explorer/format.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ValueUnit = { divisor: number; label: string; decimals: number }`; `UNIT_BN`, `UNIT_MLN`; `formatInUnit(value: number | null | undefined, unit: ValueUnit): string`. `ExplorerTable` props become `{ rows, totalRow, years, firstColumnLabel: string, unit: ValueUnit, share }`. `EditorialLineChart` props become `{ years, series, share, unit: ValueUnit }`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/format.test.ts`:

```ts
import { formatBn, formatInUnit, UNIT_BN, UNIT_MLN } from "../../lib/explorer/format";

describe("formatInUnit", () => {
  it("reproduces formatBn exactly for the billions unit", () => {
    for (const value of [0, 1, 1_500_000, 2_034_000_000, 5_625_000_000, -3_200_000_000]) {
      expect(formatInUnit(value, UNIT_BN)).toBe(formatBn(value));
    }
  });

  it("renders municipal magnitudes legibly in millions", () => {
    // ლენტეხი's 2025 total: 0.02 in billions, which is why the unit is a parameter.
    expect(formatInUnit(16_900_000, UNIT_MLN)).toBe("16.9");
    expect(formatInUnit(2_108_000_000, UNIT_MLN)).toBe("2,108.0");
  });

  it("uses U+2212 for negatives and an em dash for missing values", () => {
    expect(formatInUnit(-16_900_000, UNIT_MLN)).toBe("−16.9");
    expect(formatInUnit(null, UNIT_MLN)).toBe("—");
    expect(formatInUnit(undefined, UNIT_BN)).toBe("—");
  });

  it("labels the units in Georgian", () => {
    expect(UNIT_BN.label).toBe("მლრდ");
    expect(UNIT_MLN.label).toBe("მლნ");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/format.test.ts`
Expected: FAIL — `formatInUnit`, `UNIT_BN`, `UNIT_MLN` are not exported.

- [ ] **Step 3: Add the unit to `format.ts`**

Append to `apps/web/lib/explorer/format.ts`:

```ts
/**
 * The scale a chart or table renders values in. Budget surfaces work in
 * billions; municipal budgets are two to three orders of magnitude smaller, so
 * billions would render a whole municipality as "0.02" and each of its
 * functions as "0.00".
 */
export type ValueUnit = { divisor: number; label: string; decimals: number };

export const UNIT_BN: ValueUnit = { divisor: BILLION, label: "მლრდ", decimals: 2 };
export const UNIT_MLN: ValueUnit = { divisor: MILLION, label: "მლნ", decimals: 1 };

/** Cell value in the given unit. UNIT_BN is byte-identical to formatBn. */
export function formatInUnit(value: number | null | undefined, unit: ValueUnit): string {
  if (value === null || value === undefined) return MISSING;
  return fixed(value / unit.divisor, unit.decimals).replace("-", "−");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Decouple `ExplorerTable`**

In `apps/web/components/main-explorer/explorer-table.tsx`:

Replace the imports on lines 1–2 with:

```ts
import type { ExplorerTableRow } from "../../lib/explorer/types";
import { formatInUnit, formatShare, MISSING, type ValueUnit } from "../../lib/explorer/format";
```

Replace the props type and delete the `FIRST_COL_LABEL` record (lines 9–21) with:

```ts
type ExplorerTableProps = {
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow | null;
  years: number[];
  firstColumnLabel: string;
  unit: ValueUnit;
  share: boolean;
};
```

Change the signature on line 32 to:

```ts
export function ExplorerTable({ rows, totalRow, years, firstColumnLabel, unit, share }: ExplorerTableProps) {
```

Line 40: `if (!share) return formatBn(amount);` becomes `if (!share) return formatInUnit(amount, unit);`

Line 54: `{FIRST_COL_LABEL[scope]}` becomes `{firstColumnLabel}`

Line 116: `{share ? "100.0%" : formatBn(totalRow.valuesByYear[year] ?? null)}` becomes `{share ? "100.0%" : formatInUnit(totalRow.valuesByYear[year] ?? null, unit)}`

- [ ] **Step 6: Parameterise the chart's unit**

In `apps/web/components/main-explorer/editorial-line-chart.tsx`:

Line 5 import becomes:

```ts
import { formatInUnit, formatShare, type ValueUnit } from "../../lib/explorer/format";
```

Add `unit: ValueUnit;` to `EditorialLineChartProps` (after `share: boolean;`), and change the signature on line 53 to:

```ts
export function EditorialLineChart({ years, series, share, unit }: EditorialLineChartProps) {
```

Replace lines 84–91 with:

```ts
  const shareDigits = decimalsFor(step, 2);
  const unitDigits = Math.max(1, decimalsFor(step / unit.divisor, 4));
  const formatAxis = (value: number) =>
    (share
      ? `${value.toFixed(shareDigits)}%`
      : `${(value / unit.divisor).toLocaleString("en-US", { maximumFractionDigits: unitDigits })} ${unit.label}`
    ).replace("-", "−");

  const formatValue = (value: number | null) =>
    share ? formatShare(value === null ? null : value / 100) : formatInUnit(value, unit);
```

- [ ] **Step 7: Update the one caller**

In `apps/web/components/main-explorer/explorer-view.tsx`:

Add to the imports:

```ts
import { UNIT_BN } from "../../lib/explorer/format";
```

Add this record next to the existing `COVERAGE_NOTE` / `CLASSIFICATION_NOTE` records:

```ts
// Moved out of ExplorerTable so the table takes a label rather than a scope.
const FIRST_COL_LABEL: Record<ExplorerScope, string> = {
  fields: "სფერო",
  ministries: "უწყება",
  revenue: "საბიუჯეტო მუხლი",
};
```

Line 150 becomes:

```tsx
<ExplorerTable
  rows={model.tableRows}
  totalRow={model.totalRow}
  years={model.years}
  firstColumnLabel={FIRST_COL_LABEL[scope]}
  unit={UNIT_BN}
  share={share}
/>
```

Find the `<EditorialLineChart` usage in the same file and add `unit={UNIT_BN}`.

- [ ] **Step 8: Verify budget output is unchanged**

Run: `npm run check`
Expected: PASS.

Run: `npm run test:browser -- tests/browser/main-explorer.spec.ts`
Expected: PASS. This is the regression gate — the budget explorer must render exactly as before.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/explorer/format.ts apps/web/components/main-explorer apps/web/tests/explorer/format.test.ts
git commit -m "refactor: make the chart and table value unit a parameter"
```

---

### Task 3: Municipal colour tokens and Georgian label helpers

**Files:**
- Modify: `apps/web/lib/explorer/colors.ts`, `apps/web/lib/explorer/types.ts`, `DESIGN.md` (§4.2)
- Create: `apps/web/lib/explorer/municipalLabels.ts`
- Test: `apps/web/tests/explorer/municipalLabels.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `SERIES_COLORS` gains ten `municipal.*` keys. `colors.ts` also exports `MAP_RAMP: string[]` (six steps), `MAP_NO_DATA_FILL: string` and `MAP_NO_DATA_STROKE: string` for the Task 9 choropleth. `ExplorerItemLevel` gains `"municipal_function"`. `municipalLabels.ts` exports `REGION_GENITIVE_KA: Record<string, string>` and `georgianOrdinal(rank: number): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/municipalLabels.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REGION_GENITIVE_KA, georgianOrdinal } from "../../lib/explorer/municipalLabels";
import { ACCENT, MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP, SERIES_COLORS } from "../../lib/explorer/colors";

const MUNICIPAL_FUNCTION_IDS = [
  "municipal.general_public_services",
  "municipal.defence",
  "municipal.public_order_safety",
  "municipal.economic_affairs",
  "municipal.environment",
  "municipal.housing_communal",
  "municipal.health",
  "municipal.recreation_culture",
  "municipal.education",
  "municipal.social_protection",
];

describe("georgianOrdinal", () => {
  it("uses პირველი for first place, not მე-1", () => {
    expect(georgianOrdinal(1)).toBe("პირველი");
  });

  it("uses the მე- prefix for every other rank", () => {
    expect(georgianOrdinal(2)).toBe("მე-2");
    expect(georgianOrdinal(11)).toBe("მე-11");
    expect(georgianOrdinal(64)).toBe("მე-64");
  });
});

describe("REGION_GENITIVE_KA", () => {
  it("covers every region in the served taxonomy", () => {
    const taxonomy = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "../../data/taxonomy/municipal-regions.json"), "utf8"),
    ) as Array<{ id: string }>;
    for (const region of taxonomy) {
      expect(REGION_GENITIVE_KA[region.id], `missing genitive for ${region.id}`).toBeTruthy();
    }
    expect(Object.keys(REGION_GENITIVE_KA)).toHaveLength(taxonomy.length);
  });
});

describe("municipal colour tokens", () => {
  it("gives every function a stable token", () => {
    for (const id of MUNICIPAL_FUNCTION_IDS) {
      expect(SERIES_COLORS[id], `missing colour for ${id}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("never gives two functions the same colour", () => {
    const used = MUNICIPAL_FUNCTION_IDS.map((id) => SERIES_COLORS[id]);
    expect(new Set(used).size).toBe(MUNICIPAL_FUNCTION_IDS.length);
  });
});

describe("map ramp tokens", () => {
  it("runs six distinct steps ending at the accent", () => {
    expect(MAP_RAMP).toHaveLength(6);
    expect(new Set(MAP_RAMP).size).toBe(6);
    expect(MAP_RAMP.at(-1)).toBe(ACCENT);
    for (const step of MAP_RAMP) {
      expect(step).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("gives no-data shapes a fill and stroke outside the ramp", () => {
    expect(MAP_NO_DATA_FILL).toMatch(/^#[0-9A-F]{6}$/);
    expect(MAP_NO_DATA_STROKE).toMatch(/^#[0-9A-F]{6}$/);
    expect(MAP_RAMP).not.toContain(MAP_NO_DATA_FILL);
    expect(MAP_RAMP).not.toContain(MAP_NO_DATA_STROKE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalLabels.test.ts`
Expected: FAIL — module `municipalLabels` not found.

- [ ] **Step 3: Add the colour tokens**

In `apps/web/lib/explorer/colors.ts`, insert before the closing `};` of `SERIES_COLORS`:

```ts
  // Municipal functions reuse the semantic colour of the same concept on the
  // budget side, so a category keeps one colour across the whole site
  // (DESIGN.md §4.2). All ten are distinct.
  "municipal.social_protection": "#B3402A",
  "municipal.health": "#1F6E56",
  "municipal.education": "#3D5A98",
  "municipal.housing_communal": "#B08A2E",
  "municipal.defence": "#7A4E8C",
  "municipal.public_order_safety": "#4A707A",
  "municipal.economic_affairs": "#C26E4C",
  "municipal.environment": "#2F4B3A",
  "municipal.recreation_culture": "#9C3D5E",
  "municipal.general_public_services": "#5B5347",
```

Then append, after `export const ACCENT = "#B3402A";`:

```ts
// Region choropleth (spec §5.2). Six-step terracotta ramp, quantile-classed by
// the caller; the last step is ACCENT. Occupied-territory shapes carry no value,
// so they get a flat fill and a dashed stroke instead of a ramp step.
//
// These live here, not in region-map.tsx, because the plan's Global Constraints
// forbid hardcoding a hex in a component: colors.ts is this codebase's token
// module and components receive colours as data. Keeping them here also lets the
// index page read the ramp without importing from a "use client" file.
export const MAP_RAMP = ["#F3EBDB", "#E9D6C6", "#DEBBA6", "#D19A80", "#C4735A", ACCENT];
export const MAP_NO_DATA_FILL = "#E5DBC9";
export const MAP_NO_DATA_STROKE = "#C4B69C";
```

- [ ] **Step 4: Widen the item level**

In `apps/web/lib/explorer/types.ts`, line 12:

```ts
export type ExplorerItemLevel = "total" | "public_field" | "admin_category" | "major_program" | "municipal_function";
```

- [ ] **Step 5: Create the label helpers**

Create `apps/web/lib/explorer/municipalLabels.ts`:

```ts
// Georgian display copy for the municipalities section.
//
// These live in the UI, not in data/taxonomy/municipal-regions.json, on purpose:
// that file is mirrored by the MunicipalRegion Prisma model and parity-checked
// on {id, kaLabel, sortOrder}, so adding a field there would mean a migration,
// a live import and a parity re-verification for one word in one headline.

/**
 * Genitive forms for region headlines ("იმერეთის მუნიციპალური ბიუჯეტები").
 * Reviewed once and stored, for the same reason municipalities carry a reviewed
 * display_name_ka: deriving Georgian genitives mechanically produces wrong
 * forms. A unit test asserts this covers every region in the served taxonomy.
 */
export const REGION_GENITIVE_KA: Record<string, string> = {
  "region.tbilisi": "თბილისის",
  "region.adjara": "აჭარის",
  "region.guria": "გურიის",
  "region.imereti": "იმერეთის",
  "region.kakheti": "კახეთის",
  "region.mtskheta_mtianeti": "მცხეთა-მთიანეთის",
  "region.racha_lechkhumi_kvemo_svaneti": "რაჭა-ლეჩხუმისა და ქვემო სვანეთის",
  "region.samegrelo_zemo_svaneti": "სამეგრელო-ზემო სვანეთის",
  "region.samtskhe_javakheti": "სამცხე-ჯავახეთის",
  "region.kvemo_kartli": "ქვემო ქართლის",
  "region.shida_kartli": "შიდა ქართლის",
};

/** Georgian ordinal for a rank. First place is პირველი, never მე-1. */
export function georgianOrdinal(rank: number): string {
  return rank === 1 ? "პირველი" : `მე-${rank}`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- tests/explorer/municipalLabels.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Document the tokens**

In `DESIGN.md` §4.2, after the existing token tables, add:

```markdown
Municipal functions (`municipal.*`) reuse the semantic colour of the same concept
on the budget side, so a category keeps one colour across the whole site:

| Function | Token | Shares with |
|---|---|---|
| `municipal.social_protection` | `#B3402A` | `spending.social_protection` |
| `municipal.health` | `#1F6E56` | `spending.health` |
| `municipal.education` | `#3D5A98` | `spending.education` |
| `municipal.housing_communal` | `#B08A2E` | `spending.infrastructure_regional_development` |
| `municipal.defence` | `#7A4E8C` | `spending.defence` |
| `municipal.public_order_safety` | `#4A707A` | `spending.public_order_safety` |
| `municipal.economic_affairs` | `#C26E4C` | `spending.economic_affairs` |
| `municipal.environment` | `#2F4B3A` | `spending.agriculture_environment` |
| `municipal.recreation_culture` | `#9C3D5E` | `spending.culture` |
| `municipal.general_public_services` | `#5B5347` | `spending.general_public_services` |
```

- [ ] **Step 8: Full check and commit**

Run: `npm run check`
Expected: PASS.

```bash
git add apps/web/lib/explorer/colors.ts apps/web/lib/explorer/types.ts apps/web/lib/explorer/municipalLabels.ts apps/web/tests/explorer/municipalLabels.test.ts DESIGN.md
git commit -m "feat: add municipal colour tokens and Georgian label helpers"
```

---

### Task 4: Region map geometry module

**Files:**
- Create: `apps/web/lib/explorer/municipalGeo.ts`
- Test: `apps/web/tests/explorer/municipalGeo.test.ts` (extend)

**Interfaces:**
- Consumes: `GEORGIA_GEO.regions[].iso` and `.ring` from Task 1.
- Produces: `MAP_WIDTH`, `MAP_HEIGHT`, `MAP_VIEWBOX`; `REGION_ID_BY_SHAPE_ISO: Record<string, string | null>`; `RegionShape = { shapeIso: string; regionId: string | null; noDataReason: "occupied_territory" | null; nameKa: string; d: string }`; `buildRegionShapes(): RegionShape[]`.

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/municipalGeo.test.ts`:

```ts
import { readFileSync } from "node:fs";
import path from "node:path";
import { GEORGIA_GEO } from "../../lib/landing/georgiaGeo";
import { buildRegionShapes, MAP_HEIGHT, MAP_WIDTH, projectPoint, REGION_ID_BY_SHAPE_ISO } from "../../lib/explorer/municipalGeo";

const servedRegionIds = (
  JSON.parse(
    readFileSync(path.resolve(process.cwd(), "../../data/taxonomy/municipal-regions.json"), "utf8"),
  ) as Array<{ id: string }>
).map((region) => region.id);

describe("the shape ↔ region join", () => {
  it("resolves every shape to a region or a stated no-data reason", () => {
    for (const shape of buildRegionShapes()) {
      if (shape.regionId === null) {
        expect(shape.noDataReason).toBe("occupied_territory");
      } else {
        expect(servedRegionIds).toContain(shape.regionId);
        expect(shape.noDataReason).toBeNull();
      }
    }
  });

  it("resolves every served region to exactly one shape", () => {
    const shapes = buildRegionShapes();
    for (const regionId of servedRegionIds) {
      const matches = shapes.filter((shape) => shape.regionId === regionId);
      expect(matches, `${regionId} must map to exactly one shape`).toHaveLength(1);
    }
  });

  it("leaves exactly one shape without data — the occupied territory", () => {
    const noData = buildRegionShapes().filter((shape) => shape.regionId === null);
    expect(noData).toHaveLength(1);
    expect(noData[0]!.shapeIso).toBe("GE-AB");
  });

  it("maps no shape to a region outside the served taxonomy", () => {
    for (const regionId of Object.values(REGION_ID_BY_SHAPE_ISO)) {
      if (regionId !== null) expect(servedRegionIds).toContain(regionId);
    }
  });
});

describe("the projection", () => {
  it("is deterministic", () => {
    expect(buildRegionShapes().map((s) => s.d)).toEqual(buildRegionShapes().map((s) => s.d));
  });

  it("keeps every point inside the viewBox", () => {
    for (const shape of buildRegionShapes()) {
      const numbers = shape.d.match(/-?\d+(\.\d+)?/g) ?? [];
      expect(numbers.length).toBeGreaterThan(0);
      for (let i = 0; i < numbers.length; i += 2) {
        const x = Number(numbers[i]);
        const y = Number(numbers[i + 1]);
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(MAP_WIDTH);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(MAP_HEIGHT);
      }
    }
  });

  it("produces closed paths", () => {
    for (const shape of buildRegionShapes()) {
      expect(shape.d.startsWith("M")).toBe(true);
      expect(shape.d.endsWith("Z")).toBe(true);
    }
  });

  it("places points through the same function the rings use", () => {
    // The self-governing city dots call projectPoint directly. If a caller ever
    // reimplements the arithmetic, the dots drift off the shapes silently —
    // this pins the two to one implementation.
    const { x, y } = projectPoint(GEORGIA_GEO.bbox.lonMin, GEORGIA_GEO.bbox.latMax);
    expect(x).toBe(0);
    expect(y).toBe(0);
    const corner = projectPoint(GEORGIA_GEO.bbox.lonMax, GEORGIA_GEO.bbox.latMin);
    expect(corner.x).toBeCloseTo(MAP_WIDTH, 0);
    expect(corner.y).toBeCloseTo(MAP_HEIGHT, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalGeo.test.ts`
Expected: FAIL — module `municipalGeo` not found.

- [ ] **Step 3: Write the module**

Create `apps/web/lib/explorer/municipalGeo.ts`:

```ts
import { GEORGIA_GEO } from "../landing/georgiaGeo";

// Region choropleth geometry for /explorer/municipalities.
//
// The map is REGION grain, not municipality grain: no openly-licensed ADM2
// geometry matches the 64-unit served registry (the 2026-08-02 serving-layer
// spec §4.3 records why), so a municipality-level map is a later spec. The rule
// that survives at this grain is the same one: every shape resolves to a region
// or to an explicit no-data reason, and every region resolves to exactly one
// shape. tests/explorer/municipalGeo.test.ts asserts both directions.

export type RegionShape = {
  shapeIso: string;
  regionId: string | null;
  noDataReason: "occupied_territory" | null;
  nameKa: string;
  d: string;
};

/**
 * Keyed on geoBoundaries `shapeISO`, never `shapeName`: geoBoundaries spells
 * Samtskhe–Javakheti with an en dash (U+2013) and names GE-RL "Racha-Lechkhumi
 * and Kvemo Svaneti", neither of which matches georgiaGeo.ts. A name join would
 * fail silently on exactly those two.
 *
 * `null` means the shape is drawn with no data. GE-AB (აფხაზეთი) is the only
 * one: its sole municipal body is excluded from public serving, so the region
 * is not part of the municipal taxonomy at all.
 */
export const REGION_ID_BY_SHAPE_ISO: Record<string, string | null> = {
  "GE-TB": "region.tbilisi",
  "GE-AJ": "region.adjara",
  "GE-GU": "region.guria",
  "GE-IM": "region.imereti",
  "GE-KA": "region.kakheti",
  "GE-MM": "region.mtskheta_mtianeti",
  "GE-RL": "region.racha_lechkhumi_kvemo_svaneti",
  "GE-SZ": "region.samegrelo_zemo_svaneti",
  "GE-SJ": "region.samtskhe_javakheti",
  "GE-KK": "region.kvemo_kartli",
  "GE-SK": "region.shida_kartli",
  "GE-AB": null,
};

const BBOX = GEORGIA_GEO.bbox;

// Equirectangular with a cos(midLat) correction so Georgia is not stretched
// east-west. The derived height at 1000px wide is 509, which is the viewBox the
// confirmed design reference uses.
const MID_LAT_RAD = (((BBOX.latMin + BBOX.latMax) / 2) * Math.PI) / 180;
const KX = Math.cos(MID_LAT_RAD);

export const MAP_WIDTH = 1000;
const SCALE = MAP_WIDTH / ((BBOX.lonMax - BBOX.lonMin) * KX);
export const MAP_HEIGHT = Math.round((BBOX.latMax - BBOX.latMin) * SCALE);
export const MAP_VIEWBOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Project one [lon, lat] into viewBox space. Everything placed on the map goes
 * through this — shapes AND the self-governing city dots. Do not reimplement the
 * arithmetic at a call site: a second copy drifts the moment the projection
 * changes, and nothing fails when it does.
 */
export function projectPoint(lon: number, lat: number): { x: number; y: number } {
  return {
    x: Number(clamp((lon - BBOX.lonMin) * KX * SCALE, 0, MAP_WIDTH).toFixed(1)),
    y: Number(clamp((BBOX.latMax - lat) * SCALE, 0, MAP_HEIGHT).toFixed(1)),
  };
}

/** Project a [lon, lat] ring into an SVG path. Rounded to 1dp — sub-pixel. */
export function projectRing(ring: ReadonlyArray<readonly [number, number]>): string {
  const points = ring.map(([lon, lat]) => {
    const { x, y } = projectPoint(lon, lat);
    return `${x} ${y}`;
  });
  return `M${points.join("L")}Z`;
}

/**
 * Every ADM1 shape, projected and joined. Call this on the server: it returns
 * path strings, so the index page ships ~15 KB of `d` attributes instead of the
 * ~40 KB coordinate table.
 */
export function buildRegionShapes(): RegionShape[] {
  return GEORGIA_GEO.regions.map((region) => {
    const regionId = REGION_ID_BY_SHAPE_ISO[region.iso];
    if (regionId === undefined) {
      throw new Error(`unmapped ADM1 shape ${region.iso} (${region.en}) — every shape must resolve`);
    }

    return {
      shapeIso: region.iso,
      regionId,
      noDataReason: regionId === null ? ("occupied_territory" as const) : null,
      nameKa: region.ka,
      d: projectRing(region.ring),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/municipalGeo.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Confirm the derived height**

Run: `npx tsx -e "import('./lib/explorer/municipalGeo.ts').then(m => console.log(m.MAP_VIEWBOX))"`
Expected: `0 0 1000 509`. If it differs by more than ±3, the bbox in `georgiaGeo.ts` changed in Task 1 — check that `GEORGIA_GEO.bbox` was not edited.

- [ ] **Step 6: Assert the join in data validation**

The spec requires this assertion in the data gate, not only in a component test,
so a future edit to the region taxonomy fails `npm run data:validate`.

In `apps/web/scripts/validate-data-files.ts`, add to the municipal section:

```ts
import { buildRegionShapes, REGION_ID_BY_SHAPE_ISO } from "../lib/explorer/municipalGeo";

// Every ADM1 shape resolves to a served region or to a stated no-data reason,
// and every served region resolves to exactly one shape. This mirrors the rule
// that no official row disappears silently from a total.
{
  const servedRegionIds = new Set(regions.map((region) => region.id));
  const shapes = buildRegionShapes();

  for (const shape of shapes) {
    if (shape.regionId === null) {
      if (shape.noDataReason === null) {
        errors.push(`map shape ${shape.shapeIso} has neither a region nor a no-data reason`);
      }
      continue;
    }
    if (!servedRegionIds.has(shape.regionId)) {
      errors.push(`map shape ${shape.shapeIso} maps to unknown region ${shape.regionId}`);
    }
  }

  for (const regionId of servedRegionIds) {
    const matches = shapes.filter((shape) => shape.regionId === regionId);
    if (matches.length !== 1) {
      errors.push(`region ${regionId} maps to ${matches.length} shapes, expected exactly 1`);
    }
  }

  const mappedIso = new Set(Object.keys(REGION_ID_BY_SHAPE_ISO));
  for (const shape of shapes) {
    if (!mappedIso.has(shape.shapeIso)) errors.push(`map shape ${shape.shapeIso} is not in the join table`);
  }
}
```

Match the surrounding file's error-collection style — read it first; if it
pushes onto a differently named array or throws instead, follow that.

- [ ] **Step 7: Run data validation**

Run: `npm run data:validate`
Expected: PASS, with no new errors.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/municipalGeo.ts apps/web/tests/explorer/municipalGeo.test.ts apps/web/scripts/validate-data-files.ts
git commit -m "feat: add region map projection and shape join"
```

---

### Task 5: Municipal entity model

The core model: turn one municipality's (or one region's) facts into chart and table shapes, with `public_total_gel` as the one public total and functional sums retained for reconciliation.

**Files:**
- Create: `apps/web/lib/explorer/municipalData.ts`
- Test: `apps/web/tests/explorer/municipalData.test.ts`

**Interfaces:**
- Consumes: `MunicipalFunction`, `Municipality`, `MunicipalFunctionFact`, `MunicipalTotalFact` from `lib/data/municipal/types`; `SourceDocumentRow` from `lib/data/sources`; `ExplorerTableRow` from `lib/explorer/types`; `colorForItem` from `lib/explorer/colors`.
- Produces:
  - `MunicipalEntityModel = { years: number[]; rows: ExplorerTableRow[]; totalRow: ExplorerTableRow }`
  - `buildMunicipalEntityModel(input: MunicipalEntityInput): MunicipalEntityModel`
  - `getDefaultMunicipalSelection(model: MunicipalEntityModel): string[]`

- [ ] **Step 1: Write the failing test**

Create `apps/web/tests/explorer/municipalData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import { buildMunicipalEntityModel, getDefaultMunicipalSelection } from "../../lib/explorer/municipalData";

const FUNCTIONS: MunicipalFunction[] = [
  { id: "municipal.economic_affairs", kaLabel: "ეკონომიკური საქმიანობა", functionalCode: "7.4", sortOrder: 4 },
  { id: "municipal.education", kaLabel: "განათლება", functionalCode: "7.9", sortOrder: 9 },
  { id: "municipal.health", kaLabel: "ჯანმრთელობის დაცვა", functionalCode: "7.7", sortOrder: 7 },
];

const SOURCES: SourceDocumentRow[] = [
  {
    sourceId: "source.municipal_portal_archive",
    sourceName: "ადგილობრივი ბიუჯეტების შესრულება",
    sourceUrlOrFile: "mof.ge",
    lastReviewedAt: "2026-08-01",
  },
];

function fact(year: number, categoryId: string, amountGel: number): MunicipalFunctionFact {
  const found = FUNCTIONS.find((f) => f.id === categoryId)!;
  return {
    year,
    municipalityCode: "04",
    categoryId,
    functionalCode: found.functionalCode,
    amountGel,
    basis: "actual",
    sourceId: "source.municipal_portal_archive",
  };
}

function total(year: number, publicTotalGel: number, functionalSumGel: number, showWarning = false): MunicipalTotalFact {
  return {
    year,
    municipalityCode: "04",
    publicTotalGel,
    publicTotalMeasure: "total_payments",
    totalPaymentsGel: publicTotalGel,
    expensesGel: null,
    nonfinancialAssetGrowthGel: null,
    financialAssetGrowthGel: null,
    liabilityDecreaseGel: null,
    functionalSumGel,
    reconciliationDifferenceGel: publicTotalGel - functionalSumGel,
    warningAmountGel: showWarning ? publicTotalGel - functionalSumGel : null,
    showWarning,
    warningType: showWarning ? "source_version_difference" : "none",
    basis: "actual",
    sourceId: "source.municipal_portal_archive",
  };
}

const FUNCTION_FACTS: MunicipalFunctionFact[] = [
  fact(2015, "municipal.economic_affairs", 100), fact(2015, "municipal.education", 50), fact(2015, "municipal.health", 10),
  fact(2016, "municipal.economic_affairs", 200), fact(2016, "municipal.education", 60), fact(2016, "municipal.health", 5),
  fact(2017, "municipal.economic_affairs", 300), fact(2017, "municipal.education", 70), fact(2017, "municipal.health", 0),
];

const TOTAL_FACTS: MunicipalTotalFact[] = [
  total(2015, 160, 160),
  total(2016, 300, 265, true),
  total(2017, 370, 370),
];

function build(startYear = 2015, endYear = 2017) {
  return buildMunicipalEntityModel({
    functions: FUNCTIONS,
    functionFacts: FUNCTION_FACTS,
    totalFacts: TOTAL_FACTS,
    sourceDocuments: SOURCES,
    startYear,
    endYear,
  });
}

describe("buildMunicipalEntityModel", () => {
  it("emits one row per function, in taxonomy sort order", () => {
    expect(build().rows.map((row) => row.itemId)).toEqual([
      "municipal.economic_affairs",
      "municipal.health",
      "municipal.education",
    ]);
  });

  it("makes the total row the official headline", () => {
    expect(build().totalRow.valuesByYear[2016]).toBe(300);
  });

  it("keeps the functional rows distinct from the official public total", () => {
    const model = build();
    for (const year of model.years) {
      const summed = model.rows.reduce((sum, row) => sum + (row.valuesByYear[year] ?? 0), 0);
      expect(summed).toBeCloseTo(year === 2016 ? 265 : model.totalRow.valuesByYear[year]!, 6);
    }
  });

  it("clips to the selected range", () => {
    expect(build(2016, 2017).years).toEqual([2016, 2017]);
  });

  it("scopes change and share to the selected range, not the full span", () => {
    // The bug this guards: rendering a model built for the whole span next to
    // range-filtered year columns, so ცვლილება describes a period the reader
    // is not looking at. economic_affairs: 100→300 full span, 200→300 clipped.
    const economicFull = build().rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    const economicClipped = build(2016, 2017).rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    expect(economicFull.change).toBeCloseTo(2, 6);
    expect(economicClipped.change).toBeCloseTo(0.5, 6);
    expect(build(2015, 2016).totalRow.change).not.toBe(build().totalRow.change);
  });

  it("treats a zero function as a real zero, not a gap", () => {
    // municipal.defence collapses to 0 in the served data; the chart must draw
    // the line to zero rather than breaking it.
    const health = build().rows.find((row) => row.itemId === "municipal.health")!;
    expect(health.valuesByYear[2017]).toBe(0);
  });

  it("gives every row its stable colour token", () => {
    const economic = build().rows.find((row) => row.itemId === "municipal.economic_affairs")!;
    expect(economic.color).toBe("#C26E4C");
  });
});

describe("getDefaultMunicipalSelection", () => {
  it("takes the official total plus the top five by latest-year value", () => {
    expect(getDefaultMunicipalSelection(build())).toEqual([
      "municipal.total",
      "municipal.economic_affairs",
      "municipal.education",
      "municipal.health",
    ]);
  });

});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: FAIL — module `municipalData` not found.

- [ ] **Step 3: Write the model**

Create `apps/web/lib/explorer/municipalData.ts`:

```ts
import type {
  MunicipalFunction,
  MunicipalFunctionFact,
  MunicipalTotalFact,
} from "../data/municipal/types";
import type { SourceDocumentRow } from "../data/sources";
import type { ExplorerTableRow, SourceMetadata } from "./types";
import { colorForItem, INK } from "./colors";

// Model layer for the municipalities section.
//
// It produces the SAME shapes the budget explorer's chart and table already
// consume (ExplorerTableRow, and ChartSeries built from it), so those components
// are reused untouched. It deliberately does not go through buildExplorerModel:
// that model is built around sides, groupings and a national item×year grain,
// while this one is municipality×function×year with a public total plus internal reconciliation data.

export const MUNICIPAL_TOTAL_ITEM_ID = "municipal.total";
export const MIXED_SOURCE_ID = "mixed:source_id";

function agreeOrMixed(current: string, incoming: string, mixedMarker: string): string {
  return current === incoming ? current : mixedMarker;
}

export type MunicipalEntityModel = {
  years: number[];
  rows: ExplorerTableRow[];
  totalRow: ExplorerTableRow;
};

export type MunicipalEntityInput = {
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];
  startYear: number;
  endYear: number;
};

/**
 * Collapse many municipalities' facts into one entity's, for a region roll-up.
 * Called on the SERVER so a region page ships ~110 function rows like a
 * municipality page does, rather than up to twelve times that.
 *
 * Functions and `publicTotalGel` are summed at region grain; the functional
 * reconciliation fields remain internal and the public roll-up uses only the
 * official total.
 */
export function aggregateFactsForEntity(
  entityId: string,
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[] } {
  const functionByKey = new Map<string, MunicipalFunctionFact>();
  for (const row of functionFacts) {
    const key = `${row.year}|${row.categoryId}`;
    const existing = functionByKey.get(key);
    if (existing) {
      existing.amountGel += row.amountGel;
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      continue;
    }
    functionByKey.set(key, { ...row, municipalityCode: entityId });
  }

  const totalByYear = new Map<number, MunicipalTotalFact>();
  for (const row of totalFacts) {
    const existing = totalByYear.get(row.year);
    if (existing) {
      existing.publicTotalGel += row.publicTotalGel;
      existing.functionalSumGel += row.functionalSumGel;
      existing.sourceId = agreeOrMixed(existing.sourceId, row.sourceId, MIXED_SOURCE_ID);
      // Reconciliation fields remain internal after the roll-up.
      continue;
    }
    totalByYear.set(row.year, {
      ...row,
      municipalityCode: entityId,
      showWarning: false,
      warningType: "none",
      warningAmountGel: null,
      reconciliationDifferenceGel: null,
    });
  }

  return {
    functionFacts: Array.from(functionByKey.values()),
    totalFacts: Array.from(totalByYear.values()),
  };
}

function sourceMetadataFor(sourceId: string, sources: Map<string, SourceDocumentRow>): SourceMetadata {
  const source = sources.get(sourceId);
  return {
    sourceName: source?.sourceName ?? "",
    sourceUrlOrFile: source?.sourceUrlOrFile ?? "",
    lastReviewedAt: source?.lastReviewedAt ?? "",
  };
}

function changeBetween(start: number | null, end: number | null): number | null {
  if (start === null || end === null || start === 0) return null;
  return (end - start) / start;
}

export function buildMunicipalEntityModel(input: MunicipalEntityInput): MunicipalEntityModel {
  const { functions, functionFacts, totalFacts, sourceDocuments, startYear, endYear } = input;

  const sources = new Map(sourceDocuments.map((source) => [source.sourceId, source]));
  const years = Array.from(new Set(totalFacts.map((row) => row.year)))
    .filter((year) => year >= startYear && year <= endYear)
    .sort((a, b) => a - b);
  const inRange = new Set(years);

  const amounts = new Map<string, number>();
  const sourceIds = new Map<string, string>();
  for (const row of functionFacts) {
    if (!inRange.has(row.year)) continue;
    const key = `${row.categoryId}|${row.year}`;
    amounts.set(key, (amounts.get(key) ?? 0) + row.amountGel);
    sourceIds.set(key, row.sourceId);
  }

  const publicTotalByYear: Record<number, number> = {};
  const officialSourceIdByYear = new Map<number, string>();
  for (const row of totalFacts) {
    if (!inRange.has(row.year)) continue;
    publicTotalByYear[row.year] = (publicTotalByYear[row.year] ?? 0) + row.publicTotalGel;
    const currentSourceId = officialSourceIdByYear.get(row.year);
    officialSourceIdByYear.set(
      row.year,
      currentSourceId === undefined ? row.sourceId : agreeOrMixed(currentSourceId, row.sourceId, MIXED_SOURCE_ID),
    );
  }

  const firstYear = years[0];
  const lastYear = years.at(-1);

  const ordered = functions.slice().sort((left, right) => left.sortOrder - right.sortOrder);

  const rows: ExplorerTableRow[] = ordered.map((fn, index) => {
    const valuesByYear: Record<number, number | null> = {};
    const basisByYear: Record<number, "actual" | "planned"> = {};
    const sourceByYear: Record<number, SourceMetadata> = {};

    for (const year of years) {
      const key = `${fn.id}|${year}`;
      // The dataset is dense, so a missing key means the year is genuinely
      // outside coverage — null, not zero. A served zero stays zero.
      valuesByYear[year] = amounts.has(key) ? amounts.get(key)! : null;
      basisByYear[year] = "actual";
      sourceByYear[year] = sourceMetadataFor(sourceIds.get(key) ?? "", sources);
    }

    const endValue = lastYear === undefined ? null : valuesByYear[lastYear] ?? null;
    const endTotal = lastYear === undefined ? null : publicTotalByYear[lastYear] ?? null;

    return {
      itemId: fn.id,
      parentItemId: null,
      level: "municipal_function",
      detailLabel: null,
      kaLabel: fn.kaLabel,
      enLabel: fn.kaLabel,
      color: colorForItem(fn.id, index),
      basisByYear,
      sourceByYear,
      valuesByYear,
      change: changeBetween(
        firstYear === undefined ? null : valuesByYear[firstYear] ?? null,
        endValue,
      ),
      shareEndYear: endValue !== null && endTotal ? endValue / endTotal : null,
    };
  });

  const totalValuesByYear: Record<number, number | null> = {};
  const totalBasisByYear: Record<number, "actual" | "planned"> = {};
  const totalSourceByYear: Record<number, SourceMetadata> = {};
  for (const year of years) {
    totalValuesByYear[year] = publicTotalByYear[year] ?? null;
    totalBasisByYear[year] = "actual";
    totalSourceByYear[year] = sourceMetadataFor(officialSourceIdByYear.get(year) ?? "", sources);
  }

  const totalRow: ExplorerTableRow = {
    itemId: MUNICIPAL_TOTAL_ITEM_ID,
    parentItemId: null,
    level: "total",
    detailLabel: null,
    kaLabel: "მთლიანი ბიუჯეტი",
    enLabel: "Total",
    color: INK,
    basisByYear: totalBasisByYear,
    sourceByYear: totalSourceByYear,
    valuesByYear: totalValuesByYear,
    change: changeBetween(
      firstYear === undefined ? null : totalValuesByYear[firstYear] ?? null,
      lastYear === undefined ? null : totalValuesByYear[lastYear] ?? null,
    ),
    shareEndYear: 1,
  };

  return { years, rows, totalRow };
}

/**
 * The official total plus the top five functions by latest-year value.
 */
export function getDefaultMunicipalSelection(model: MunicipalEntityModel): string[] {
  const lastYear = model.years.at(-1);
  if (lastYear === undefined) return [];

  return [model.totalRow.itemId, ...model.rows
    .slice()
    .sort((left, right) => (right.valuesByYear[lastYear] ?? 0) - (left.valuesByYear[lastYear] ?? 0))
    .slice(0, 5)
    .map((row) => row.itemId)];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Verify against the real served data**

Run:

```bash
npx tsx -e "
import { loadServedMunicipalData } from './lib/data/servedData';
import { loadServedLandingData } from './lib/data/servedData';
import { buildMunicipalEntityModel } from './lib/explorer/municipalData';
const d = await loadServedMunicipalData();
const { sourceDocuments } = await loadServedLandingData();
const m = buildMunicipalEntityModel({
  functions: d.functions,
  functionFacts: d.functionFacts.filter(f => f.municipalityCode === '04'),
  totalFacts: d.totalFacts.filter(f => f.municipalityCode === '04'),
  sourceDocuments, startYear: 2015, endYear: 2025,
});
console.log('years', m.years.length, 'rows', m.rows.length);
console.log('2025 public total', m.totalRow.valuesByYear[2025]);
"
```

Expected: `years 11 rows 10`; the public total is sourced from `public_total_gel`, while the ten functional rows remain available for internal reconciliation.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/municipalData.test.ts
git commit -m "feat: add the municipal entity model"
```

---

### Task 6: Index and region roll-up model

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Test: `apps/web/tests/explorer/municipalData.test.ts` (extend)

**Interfaces:**
- Consumes: Task 5's module.
- Produces:
  - `MunicipalListRow = { id: string; kind: "municipality" | "region"; nameKa: string; subtitleKa: string; regionId: string | null; valueGel: number; rank: number }`
  - `buildMunicipalListRows(input): { municipalities: MunicipalListRow[]; regions: MunicipalListRow[] }`
  - `buildIndexKpis(input): MunicipalKpi[]` where `MunicipalKpi = { label: string; value: string; detail: string }`
  - `regionFactsFor(regionId, municipalities, functionFacts, totalFacts)` → `{ functionFacts, totalFacts, memberCodes }`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/municipalData.test.ts`:

```ts
import type { Municipality } from "../../lib/data/municipal/types";
import { aggregateFactsForEntity, buildIndexKpis, buildMunicipalListRows, regionFactsFor } from "../../lib/explorer/municipalData";

const MUNICIPALITIES: Municipality[] = [
  { code: "04", sortId: 1, nameKa: "ქალაქ თბილისის მუნიციპალიტეტი", displayNameKa: "თბილისი", regionId: "region.tbilisi", isSelfGoverningCity: true },
  { code: "06", sortId: 2, nameKa: "ქალაქ ბათუმის მუნიციპალიტეტი", displayNameKa: "ბათუმი", regionId: "region.adjara", isSelfGoverningCity: true },
  { code: "07", sortId: 3, nameKa: "ქობულეთის მუნიციპალიტეტი", displayNameKa: "ქობულეთი", regionId: "region.adjara", isSelfGoverningCity: false },
];

const REGION_LABELS = new Map([
  ["region.tbilisi", "თბილისი"],
  ["region.adjara", "აჭარა"],
]);

function totalFor(code: string, year: number, publicTotalGel: number): MunicipalTotalFact {
  return { ...total(year, publicTotalGel, publicTotalGel), municipalityCode: code };
}

const INDEX_TOTALS: MunicipalTotalFact[] = [
  totalFor("04", 2015, 1_000_000_000), totalFor("04", 2025, 2_000_000_000),
  totalFor("06", 2015, 200_000_000), totalFor("06", 2025, 500_000_000),
  totalFor("07", 2015, 50_000_000), totalFor("07", 2025, 100_000_000),
];

const listInput = {
  municipalities: MUNICIPALITIES,
  regionLabels: REGION_LABELS,
  totalFacts: INDEX_TOTALS,
  year: 2025,
};

describe("buildMunicipalListRows", () => {
  it("ranks municipalities by the official total, descending", () => {
    const { municipalities } = buildMunicipalListRows(listInput);
    expect(municipalities.map((row) => row.nameKa)).toEqual(["თბილისი", "ბათუმი", "ქობულეთი"]);
    expect(municipalities.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it("labels a municipality row with its region", () => {
    const { municipalities } = buildMunicipalListRows(listInput);
    expect(municipalities[1]!.subtitleKa).toBe("აჭარა");
  });

  it("rolls regions up and ranks them independently", () => {
    const { regions } = buildMunicipalListRows(listInput);
    expect(regions.map((row) => row.id)).toEqual(["region.tbilisi", "region.adjara"]);
    expect(regions[1]!.valueGel).toBe(600_000_000);
  });

  it("counts a region's members in its subtitle", () => {
    const { regions } = buildMunicipalListRows(listInput);
    expect(regions[1]!.subtitleKa).toBe("2 მუნიციპალიტეტი");
  });
});

describe("regionFactsFor", () => {
  it("selects only the region's members", () => {
    const selected = regionFactsFor("region.adjara", MUNICIPALITIES, [], INDEX_TOTALS);
    expect(selected.memberCodes.sort()).toEqual(["06", "07"]);
    expect(selected.totalFacts).toHaveLength(4);
  });
});

describe("aggregateFactsForEntity", () => {
  const members = regionFactsFor("region.adjara", MUNICIPALITIES, [], INDEX_TOTALS);
  const rolled = aggregateFactsForEntity("region.adjara", members.functionFacts, members.totalFacts);

  it("collapses the members to one row per year", () => {
    expect(rolled.totalFacts).toHaveLength(2);
    expect(rolled.totalFacts.every((row) => row.municipalityCode === "region.adjara")).toBe(true);
  });

  it("rolls functions and the official public total up independently", () => {
    const y2025 = rolled.totalFacts.find((row) => row.year === 2025)!;
    expect(y2025.publicTotalGel).toBe(600_000_000);
    expect(y2025.functionalSumGel).toBe(600_000_000);
  });

  it("keeps roll-up reconciliation fields internal", () => {
    expect(rolled.totalFacts.every((row) => row.showWarning === false)).toBe(true);
    expect(rolled.totalFacts.every((row) => row.warningType === "none")).toBe(true);
  });

  it("does not mutate the input rows", () => {
    expect(members.totalFacts[0]!.municipalityCode).not.toBe("region.adjara");
  });
});

describe("buildIndexKpis", () => {
  const kpis = () =>
    buildIndexKpis({
      municipalities: MUNICIPALITIES,
      totalFacts: INDEX_TOTALS,
      functionFacts: [],
      functions: FUNCTIONS,
      firstYear: 2015,
      latestYear: 2025,
    });

  it("leads with the municipal total for the latest year", () => {
    expect(kpis()[0]!.value).toBe("2.60 მლრდ ₾");
    expect(kpis()[0]!.detail).toBe("2025 · 3 მუნიციპალიტეტი");
  });

  it("reports growth from the first served year", () => {
    // 1.25bn → 2.6bn
    expect(kpis()[1]!.label).toBe("ზრდა 2015-დან");
    expect(kpis()[1]!.value).toBe("+108%");
  });

  it("reports concentration rather than a max/min ratio", () => {
    expect(kpis()[2]!.label).toBe("თბილისის წილი");
    expect(kpis()[2]!.value).toBe("76.9%");
    expect(kpis()[2]!.detail).toBe("დანარჩენი 2 ერთეული — 23.1%");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: FAIL — `buildMunicipalListRows` is not exported.

- [ ] **Step 3: Extend the model**

First add to the **existing import block at the top** of
`apps/web/lib/explorer/municipalData.ts` (do not append imports at the bottom):

```ts
import type { Municipality } from "../data/municipal/types";
import { formatAmount, formatShare } from "./format";
```

Then append the rest to the end of the file:

```ts
export type MunicipalListRow = {
  id: string;
  kind: "municipality" | "region";
  nameKa: string;
  subtitleKa: string;
  regionId: string | null;
  valueGel: number;
  rank: number;
};

export type MunicipalListInput = {
  municipalities: Municipality[];
  regionLabels: Map<string, string>;
  totalFacts: MunicipalTotalFact[];
  year: number;
};

/**
 * Index rows for both grains. Both rank on public_total_gel, the official
 * headline — the measure the index shows everywhere. The functional sum
 * remains internal reconciliation data and is never the public ranking/page total.
 */
export function buildMunicipalListRows(input: MunicipalListInput): {
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
} {
  const { municipalities, regionLabels, totalFacts, year } = input;

  const totalByCode = new Map<string, number>();
  for (const row of totalFacts) {
    if (row.year !== year) continue;
    totalByCode.set(row.municipalityCode, (totalByCode.get(row.municipalityCode) ?? 0) + row.publicTotalGel);
  }

  const municipalityRows = municipalities
    .map((municipality) => ({
      id: municipality.code,
      kind: "municipality" as const,
      nameKa: municipality.displayNameKa,
      subtitleKa: regionLabels.get(municipality.regionId) ?? "",
      regionId: municipality.regionId,
      valueGel: totalByCode.get(municipality.code) ?? 0,
      rank: 0,
    }))
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const byRegion = new Map<string, { valueGel: number; members: number }>();
  for (const municipality of municipalities) {
    const bucket = byRegion.get(municipality.regionId) ?? { valueGel: 0, members: 0 };
    bucket.valueGel += totalByCode.get(municipality.code) ?? 0;
    bucket.members += 1;
    byRegion.set(municipality.regionId, bucket);
  }

  const regionRows = Array.from(byRegion.entries())
    .map(([regionId, bucket]) => ({
      id: regionId,
      kind: "region" as const,
      nameKa: regionLabels.get(regionId) ?? regionId,
      subtitleKa: `${bucket.members} მუნიციპალიტეტი`,
      regionId,
      valueGel: bucket.valueGel,
      rank: 0,
    }))
    .sort((left, right) => right.valueGel - left.valueGel)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return { municipalities: municipalityRows, regions: regionRows };
}

/** Narrow the corpus to one region's members, for a region page. */
export function regionFactsFor(
  regionId: string,
  municipalities: Municipality[],
  functionFacts: MunicipalFunctionFact[],
  totalFacts: MunicipalTotalFact[],
): { functionFacts: MunicipalFunctionFact[]; totalFacts: MunicipalTotalFact[]; memberCodes: string[] } {
  const memberCodes = municipalities.filter((row) => row.regionId === regionId).map((row) => row.code);
  const members = new Set(memberCodes);

  return {
    memberCodes,
    functionFacts: functionFacts.filter((row) => members.has(row.municipalityCode)),
    totalFacts: totalFacts.filter((row) => members.has(row.municipalityCode)),
  };
}

export type MunicipalKpi = { label: string; value: string; detail: string };

export type MunicipalIndexKpiInput = {
  municipalities: Municipality[];
  totalFacts: MunicipalTotalFact[];
  functionFacts: MunicipalFunctionFact[];
  functions: MunicipalFunction[];
  firstYear: number;
  latestYear: number;
};

function sumPublicTotal(totalFacts: MunicipalTotalFact[], year: number): number {
  return totalFacts.filter((row) => row.year === year).reduce((sum, row) => sum + row.publicTotalGel, 0);
}

/**
 * The four index KPIs. Per-capita is not available (no reviewed population
 * dataset), so the third is concentration and the fourth is composition —
 * both size-independent and both derivable from served facts.
 */
export function buildIndexKpis(input: MunicipalIndexKpiInput): MunicipalKpi[] {
  const { municipalities, totalFacts, functionFacts, functions, firstYear, latestYear } = input;

  const latestTotal = sumPublicTotal(totalFacts, latestYear);
  const firstTotal = sumPublicTotal(totalFacts, firstYear);
  const growth = firstTotal === 0 ? null : (latestTotal - firstTotal) / firstTotal;

  const largest = municipalities
    .map((municipality) => ({
      nameKa: municipality.displayNameKa,
      valueGel: totalFacts
        .filter((row) => row.year === latestYear && row.municipalityCode === municipality.code)
        .reduce((sum, row) => sum + row.publicTotalGel, 0),
    }))
    .sort((left, right) => right.valueGel - left.valueGel)[0];
  const concentration = largest && latestTotal > 0 ? largest.valueGel / latestTotal : null;

  const byFunction = new Map<string, number>();
  for (const row of functionFacts) {
    if (row.year !== latestYear) continue;
    byFunction.set(row.categoryId, (byFunction.get(row.categoryId) ?? 0) + row.amountGel);
  }
  const topFunction = Array.from(byFunction.entries()).sort((left, right) => right[1] - left[1])[0];
  const topFunctionLabel = functions.find((fn) => fn.id === topFunction?.[0])?.kaLabel ?? "";

  return [
    {
      label: "მუნიციპალური ხარჯი",
      value: formatAmount(latestTotal),
      detail: `${latestYear} · ${municipalities.length} მუნიციპალიტეტი`,
    },
    {
      label: `ზრდა ${firstYear}-დან`,
      value: growth === null ? "—" : `${growth >= 0 ? "+" : "−"}${Math.abs(growth * 100).toFixed(0)}%`,
      detail: `${formatAmount(firstTotal)} → ${formatAmount(latestTotal)}`,
    },
    {
      label: largest ? `${largest.nameKa}ს წილი` : "კონცენტრაცია",
      value: formatShare(concentration),
      detail:
        concentration === null
          ? ""
          : `დანარჩენი ${municipalities.length - 1} ერთეული — ${formatShare(1 - concentration)}`,
    },
    {
      label: "უმსხვილესი სფერო",
      value: latestTotal > 0 && topFunction ? formatShare(topFunction[1] / latestTotal) : "—",
      detail: topFunctionLabel,
    },
  ];
}
```

Note the third KPI's label is built from the largest municipality's name plus `ს`, so it reads `თბილისის წილი` without a hardcoded city name. Verify this renders correctly in Step 5; if the Georgian is wrong for a future leader, move it to `municipalLabels.ts` alongside the region genitives.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify against real data**

Run:

```bash
npx tsx -e "
import { loadServedMunicipalData } from './lib/data/servedData';
import { buildIndexKpis, buildMunicipalListRows } from './lib/explorer/municipalData';
const d = await loadServedMunicipalData();
const labels = new Map(d.regions.map(r => [r.id, r.kaLabel]));
const { municipalities, regions } = buildMunicipalListRows({ municipalities: d.municipalities, regionLabels: labels, totalFacts: d.totalFacts, year: 2025 });
console.log('municipalities', municipalities.length, 'regions', regions.length);
console.log('top', municipalities.slice(0,3).map(r => r.nameKa + ' ' + (r.valueGel/1e6).toFixed(0) + 'M').join(', '));
console.log('regions', regions.map(r => r.nameKa).join(', '));
for (const k of buildIndexKpis({ municipalities: d.municipalities, totalFacts: d.totalFacts, functionFacts: d.functionFacts, functions: d.functions, firstYear: 2015, latestYear: 2025 })) console.log(k.label, '|', k.value, '|', k.detail);
"
```

Expected: `municipalities 64 regions 11`; top three `თბილისი 2108M, ბათუმი 486M, რუსთავი 173M`; KPIs reading `5.62 მლრდ ₾`, `+176%`, `37.5%`, `31.5% / ეკონომიკური საქმიანობა`.

The 2025 national figure is `5,624,861,932.94` GEL, which is `5.62` at two decimals. Internal reconciliation happens to agree nationally in that year; this is not a rule and must not affect the public-total contract.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/municipalData.test.ts
git commit -m "feat: add municipal index rows, region roll-ups and index KPIs"
```

---

### Task 7: Entity indicators model

**Files:**
- Modify: `apps/web/lib/explorer/municipalData.ts`
- Test: `apps/web/tests/explorer/municipalData.test.ts` (extend)

**Interfaces:**
- Consumes: `MunicipalEntityModel` (Task 5), `MunicipalKpi` (Task 6). Also from `lib/explorer/format.ts`: `MISSING`, and `formatShare(fraction, signed?, decimals?)` — Task 6 added the third `decimals` argument (default `1`) precisely so a KPI can render a 0-decimal signed percent without building its own sign. `municipalData.ts` already imports both; extend the existing import rather than adding a second line.
- Produces:
  - `MunicipalMover = { rank: number; kaLabel: string; growth: number | null; color: string }`
  - `MunicipalComparisonRow = { kaLabel: string; color: string; isTotal: boolean; fromGel: number | null; toGel: number | null; changeShare: number | null; changeGel: number | null }`
  - `buildEntityKpis(input): MunicipalKpi[]`
  - `buildMovers(model): { up: MunicipalMover[]; down: MunicipalMover[] }`
  - `buildComparisonRows(model): MunicipalComparisonRow[]`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/municipalData.test.ts`:

```ts
import { buildComparisonRows, buildEntityKpis, buildMovers } from "../../lib/explorer/municipalData";
import { formatAmount } from "../../lib/explorer/format";

describe("buildEntityKpis", () => {
  const kpis = () =>
    buildEntityKpis({
      model: build(),
      nationalTotalLatest: 740,
      rank: 1,
      rankOutOf: 64,
    });

  it("leads with the OFFICIAL total, not the functional sum", () => {
    // 2016 is the divergent year: official 300, functional 265. The KPI must
    // read the official headline, so it must NOT equal the functional sum.
    const model = build(2015, 2016);
    const divergent = buildEntityKpis({ model, nationalTotalLatest: 740, rank: 1, rankOutOf: 64 });
    expect(divergent[0]!.label).toBe("ოფიციალური ბიუჯეტი");
    expect(divergent[0]!.detail).toContain("ფინანსთა სამინისტროს");
    expect(model.totalRow.valuesByYear[2016]).toBe(300);
    // formatAmount renders both in მლნ; assert the KPI tracked the official one
    // by checking it changes when the official total does, not the functional.
    expect(divergent[0]!.value).toBe(formatAmount(300));
  });

  it("reports growth across the selected range", () => {
    expect(kpis()[1]!.label).toBe("ზრდა 2015-დან");
  });

  it("names the largest function and its share", () => {
    expect(kpis()[2]!.label).toBe("უმსხვილესი სფერო");
    expect(kpis()[2]!.detail).toBe("ეკონომიკური საქმიანობა");
  });

  it("gives the size-independent placement figure per-capita used to provide", () => {
    expect(kpis()[3]!.label).toBe("წილი მუნიციპალურ ხარჯებში");
    expect(kpis()[3]!.value).toBe("50.0%");
  });
});

describe("buildMovers", () => {
  it("ranks the fastest growers first", () => {
    expect(buildMovers(build()).up[0]!.kaLabel).toBe("ეკონომიკური საქმიანობა");
  });

  it("keeps a shrinking series in the slow-growth column, never called a loss", () => {
    const down = buildMovers(build()).down;
    expect(down[0]!.kaLabel).toBe("ჯანმრთელობის დაცვა");
    expect(down[0]!.growth).toBeLessThan(0);
  });

  it("carries each row's category colour", () => {
    expect(buildMovers(build()).up[0]!.color).toBe("#C26E4C");
  });
});

describe("buildComparisonRows", () => {
  it("puts the total first, then functions by end-year size", () => {
    const rows = buildComparisonRows(build());
    expect(rows[0]!.isTotal).toBe(true);
    expect(rows.slice(1).map((row) => row.kaLabel)).toEqual([
      "ეკონომიკური საქმიანობა",
      "განათლება",
      "ჯანმრთელობის დაცვა",
    ]);
  });

  it("reports both the absolute and relative change", () => {
    const economic = buildComparisonRows(build()).find((row) => row.kaLabel === "ეკონომიკური საქმიანობა")!;
    expect(economic.fromGel).toBe(100);
    expect(economic.toGel).toBe(300);
    expect(economic.changeGel).toBe(200);
    expect(economic.changeShare).toBeCloseTo(2, 6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: FAIL — `buildEntityKpis` is not exported.

- [ ] **Step 3: Extend the model**

Append to the end of `apps/web/lib/explorer/municipalData.ts`. Every import this
code needs (`formatAmount`, `formatShare`, `ExplorerTableRow`, `changeBetween`)
is already in the file from Tasks 5 and 6 — add no new imports.

```ts
export type MunicipalMover = { rank: number; kaLabel: string; growth: number | null; color: string };

export type MunicipalComparisonRow = {
  kaLabel: string;
  color: string;
  isTotal: boolean;
  fromGel: number | null;
  toGel: number | null;
  changeShare: number | null;
  changeGel: number | null;
};

export type MunicipalEntityKpiInput = {
  model: MunicipalEntityModel;
  /** Sum of every served municipality's public total in the range's end year. */
  nationalTotalLatest: number;
  rank: number;
  rankOutOf: number;
};

/** The four entity KPIs, for both municipality and region pages. */
export function buildEntityKpis(input: MunicipalEntityKpiInput): MunicipalKpi[] {
  const { model, nationalTotalLatest } = input;
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const officialEnd = endYear === undefined ? 0 : model.totalRow.valuesByYear[endYear] ?? 0;
  const functionalStart = startYear === undefined ? null : model.totalRow.valuesByYear[startYear] ?? null;
  const functionalEnd = endYear === undefined ? null : model.totalRow.valuesByYear[endYear] ?? null;
  const growth = changeBetween(functionalStart, functionalEnd);

  const largest = model.rows
    .slice()
    .sort(
      (left, right) =>
        (endYear === undefined ? 0 : right.valuesByYear[endYear] ?? 0) -
        (endYear === undefined ? 0 : left.valuesByYear[endYear] ?? 0),
    )[0];
  const largestValue = largest && endYear !== undefined ? largest.valuesByYear[endYear] ?? 0 : 0;

  return [
    {
      label: "ოფიციალური ბიუჯეტი",
      value: formatAmount(officialEnd),
      detail: `${endYear ?? ""} · ფინანსთა სამინისტროს ჯამი`,
    },
    {
      label: `ზრდა ${startYear ?? ""}-დან`,
      // MISSING and the U+2212 minus come from format.ts — never hand-write
      // either (Global Constraints). formatShare's third argument is the
      // decimal count; Task 6 added it so a 0-decimal signed percent does not
      // have to build its own sign. Zero growth renders "0%", not "+0%".
      value: growth === null ? MISSING : formatShare(growth, true, 0),
      detail: `${formatAmount(functionalStart)} → ${formatAmount(functionalEnd)}`,
    },
    {
      label: "უმსხვილესი სფერო",
      value: functionalEnd ? formatShare(largestValue / functionalEnd) : MISSING,
      detail: largest?.kaLabel ?? "",
    },
    {
      label: "წილი მუნიციპალურ ხარჯებში",
      value: nationalTotalLatest > 0 ? formatShare(officialEnd / nationalTotalLatest) : MISSING,
      detail: `${input.rankOutOf} ერთეულიდან`,
    },
  ];
}

/**
 * Growth board (DESIGN.md §7.13). The bottom column is ყველაზე ნელი ზრდა even
 * when a row is shrinking — never call growth a loss.
 */
export function buildMovers(model: MunicipalEntityModel): { up: MunicipalMover[]; down: MunicipalMover[] } {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const growth = model.rows
    .map((row) => ({
      kaLabel: row.kaLabel,
      color: row.color,
      growth: changeBetween(
        startYear === undefined ? null : row.valuesByYear[startYear] ?? null,
        endYear === undefined ? null : row.valuesByYear[endYear] ?? null,
      ),
    }))
    .sort((left, right) => (right.growth ?? -Infinity) - (left.growth ?? -Infinity));

  const rank = (rows: typeof growth) => rows.map((row, index) => ({ ...row, rank: index + 1 }));

  return { up: rank(growth.slice(0, 3)), down: rank(growth.slice(-3).reverse()) };
}

/** პერიოდის შედარება: the total, then every function by end-year size. */
export function buildComparisonRows(model: MunicipalEntityModel): MunicipalComparisonRow[] {
  const startYear = model.years[0];
  const endYear = model.years.at(-1);

  const rowFor = (source: ExplorerTableRow, isTotal: boolean): MunicipalComparisonRow => {
    const fromGel = startYear === undefined ? null : source.valuesByYear[startYear] ?? null;
    const toGel = endYear === undefined ? null : source.valuesByYear[endYear] ?? null;

    return {
      kaLabel: source.kaLabel,
      color: source.color,
      isTotal,
      fromGel,
      toGel,
      changeShare: changeBetween(fromGel, toGel),
      changeGel: fromGel === null || toGel === null ? null : toGel - fromGel,
    };
  };

  const functions = model.rows
    .slice()
    .sort(
      (left, right) =>
        (endYear === undefined ? 0 : right.valuesByYear[endYear] ?? 0) -
        (endYear === undefined ? 0 : left.valuesByYear[endYear] ?? 0),
    )
    .map((row) => rowFor(row, false));

  return [rowFor(model.totalRow, true), ...functions];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/municipalData.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/explorer/municipalData.ts apps/web/tests/explorer/municipalData.test.ts
git commit -m "feat: add municipal entity KPIs, movers and period comparison"
```

---

### Task 8: Municipal URL state

**Files:**
- Modify: `apps/web/lib/explorer/urlState.ts`
- Test: `apps/web/tests/explorer/urlState.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MunicipalUrlState = { chartMode?: ChartMode; share?: boolean; range?: { start: number; end: number }; selection?: string[]; level?: "muni" | "region" }`
  - `parseMunicipalHash(hash: string): MunicipalUrlState`
  - `serializeMunicipalHash(input: { chartMode: ChartMode; share: boolean; rangeStart: number; rangeEnd: number; selectedIds: string[] }): string`
  - `parseMunicipalLevel(hash: string): "muni" | "region"`

- [ ] **Step 1: Write the failing test**

Append to `apps/web/tests/explorer/urlState.test.ts`:

```ts
import { parseMunicipalHash, parseMunicipalLevel, serializeMunicipalHash } from "../../lib/explorer/urlState";

describe("municipal hash state", () => {
  it("round-trips an entity view", () => {
    const hash = serializeMunicipalHash({
      chartMode: "table",
      share: true,
      rangeStart: 2016,
      rangeEnd: 2024,
      selectedIds: ["municipal.health", "municipal.education"],
    });
    const parsed = parseMunicipalHash(`#${hash}`);
    expect(parsed.chartMode).toBe("table");
    expect(parsed.share).toBe(true);
    expect(parsed.range).toEqual({ start: 2016, end: 2024 });
    expect(parsed.selection).toEqual(["municipal.health", "municipal.education"]);
  });

  it("reuses the budget explorer's key vocabulary", () => {
    const hash = serializeMunicipalHash({
      chartMode: "line",
      share: false,
      rangeStart: 2015,
      rangeEnd: 2025,
      selectedIds: ["municipal.health"],
    });
    expect(hash).toBe("m=line&r=2015-2025&sel=municipal.health");
  });

  it("drops unknown values rather than trusting them", () => {
    const parsed = parseMunicipalHash("#m=pie&r=nope&sh=maybe");
    expect(parsed.chartMode).toBeUndefined();
    expect(parsed.range).toBeUndefined();
    expect(parsed.share).toBeUndefined();
  });

  it("restores a deliberately empty selection as empty", () => {
    expect(parseMunicipalHash("#sel=").selection).toEqual([]);
  });

  it("reads the index level, defaulting to municipalities", () => {
    expect(parseMunicipalLevel("#lvl=region")).toBe("region");
    expect(parseMunicipalLevel("#lvl=muni")).toBe("muni");
    expect(parseMunicipalLevel("#lvl=galaxy")).toBe("muni");
    expect(parseMunicipalLevel("")).toBe("muni");
  });

  it("survives a malformed hash", () => {
    expect(() => parseMunicipalHash("#%%%")).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/urlState.test.ts`
Expected: FAIL — `parseMunicipalHash` is not exported.

- [ ] **Step 3: Extend `urlState.ts`**

Append to `apps/web/lib/explorer/urlState.ts`:

```ts
// The municipalities section reuses the same hash keys as the budget explorer —
// m mode, sh share, r range, sel selection — so there is one vocabulary in the
// URL spec (DESIGN.md §6.3), plus lvl which exists only on the index.

export type MunicipalUrlState = {
  chartMode?: ChartMode;
  share?: boolean;
  range?: { start: number; end: number };
  selection?: string[];
};

export function parseMunicipalHash(hash: string): MunicipalUrlState {
  const state: MunicipalUrlState = {};

  try {
    const params = new URLSearchParams(hash.replace(/^#/, ""));

    const mode = params.get("m");
    if (mode === "line" || mode === "table") state.chartMode = mode;

    if (params.get("sh") === "1") state.share = true;

    const range = params.get("r");
    if (range && /^\d{4}-\d{4}$/.test(range)) {
      const [start = 0, end = 0] = range.split("-").map(Number);
      state.range = { start, end };
    }

    const selection = params.get("sel");
    if (selection !== null) state.selection = selection.split(",").filter(Boolean);
  } catch {
    return state;
  }

  return state;
}

export function serializeMunicipalHash(input: {
  chartMode: ChartMode;
  share: boolean;
  rangeStart: number;
  rangeEnd: number;
  selectedIds: string[];
}): string {
  const params = new URLSearchParams();
  params.set("m", input.chartMode);
  if (input.share) params.set("sh", "1");
  params.set("r", `${input.rangeStart}-${input.rangeEnd}`);
  params.set("sel", input.selectedIds.join(","));
  return params.toString();
}

/** Index list grain. Municipalities is the default; the map is always regions. */
export function parseMunicipalLevel(hash: string): "muni" | "region" {
  try {
    return new URLSearchParams(hash.replace(/^#/, "")).get("lvl") === "region" ? "region" : "muni";
  } catch {
    return "muni";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/explorer/urlState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/explorer/urlState.ts apps/web/tests/explorer/urlState.test.ts
git commit -m "feat: add municipal URL hash state"
```

---

### Task 9: Index page

**Files:**
- Create: `apps/web/components/municipalities/region-map.tsx`, `apps/web/components/municipalities/municipalities-index.tsx`, `apps/web/app/explorer/municipalities/page.tsx`

**Interfaces:**
- Consumes: `MAP_RAMP`, `MAP_NO_DATA_FILL`, `MAP_NO_DATA_STROKE` from `lib/explorer/colors.ts` (Task 3) — this component must not write a hex of its own; `buildRegionShapes`, `MAP_VIEWBOX`, `projectPoint` (Task 4); `buildMunicipalListRows`, `buildIndexKpis` (Task 6); `parseMunicipalLevel` (Task 8).
- Produces: the route `/explorer/municipalities`. `RegionMapShape = { shapeIso: string; regionId: string | null; nameKa: string; d: string; valueGel: number | null; bucket: number }`.

- [ ] **Step 1: Write the map component**

Create `apps/web/components/municipalities/region-map.tsx`:

```tsx
"use client";

import { useState } from "react";
import { MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP } from "../../lib/explorer/colors";
import { formatAmount } from "../../lib/explorer/format";

// Region choropleth (DESIGN.md §6.4 rules: no cards, no shadows except the
// tooltip). Paths arrive already projected from the server, so this component
// ships ~15 KB of `d` strings rather than the coordinate table.
//
// Every colour comes from colors.ts. No hex is written here.

export type RegionMapShape = {
  shapeIso: string;
  regionId: string | null;
  nameKa: string;
  d: string;
  valueGel: number | null;
  /** 0-5 index into MAP_RAMP; -1 for a no-data shape. */
  bucket: number;
};

export type RegionMapCity = { code: string; nameKa: string; x: number; y: number };

type RegionMapProps = {
  viewBox: string;
  shapes: RegionMapShape[];
  cities: RegionMapCity[];
  legendMin: string;
  legendMax: string;
  onOpenRegion: (regionId: string) => void;
  onOpenMunicipality: (code: string) => void;
  hoveredRegionId: string | null;
  onHoverRegion: (regionId: string | null) => void;
};

export function RegionMap({
  viewBox,
  shapes,
  cities,
  legendMin,
  legendMax,
  onOpenRegion,
  onOpenMunicipality,
  hoveredRegionId,
  onHoverRegion,
}: RegionMapProps) {
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const hovered = shapes.find((shape) => shape.regionId !== null && shape.regionId === hoveredRegionId) ?? null;

  const readout =
    hovered === null
      ? "გადაატარე კურსორი რუკაზე"
      : `${hovered.nameKa} · ${formatAmount(hovered.valueGel)} · გახსნა →`;

  return (
    <div data-testid="region-map">
      <svg viewBox={viewBox} role="img" aria-label="საქართველოს რეგიონების ბიუჯეტის რუკა" className="block h-auto w-full">
        {shapes.map((shape) => {
          const noData = shape.regionId === null;
          const active = !noData && shape.regionId === hoveredRegionId;

          return (
            <path
              key={shape.shapeIso}
              data-testid={`region-shape-${shape.shapeIso}`}
              data-no-data={noData ? "true" : undefined}
              d={shape.d}
              fill={noData ? MAP_NO_DATA_FILL : active ? "var(--ink)" : MAP_RAMP[shape.bucket]}
              stroke={noData ? MAP_NO_DATA_STROKE : active ? "var(--ink)" : "var(--hairline-soft)"}
              strokeWidth={active ? 1.6 : 0.7}
              strokeDasharray={noData ? "3 2.5" : undefined}
              strokeLinejoin="round"
              style={{ cursor: noData ? "default" : "pointer" }}
              onMouseEnter={() => onHoverRegion(shape.regionId)}
              onMouseLeave={() => onHoverRegion(null)}
              onClick={() => (shape.regionId === null ? undefined : onOpenRegion(shape.regionId))}
            />
          );
        })}
        {cities.map((city) => (
          <circle
            key={city.code}
            data-testid={`self-gov-city-${city.code}`}
            cx={city.x}
            cy={city.y}
            r={hoveredCity === city.code ? 9.5 : 7.5}
            fill={hoveredCity === city.code ? "var(--accent)" : "var(--positive)"}
            fillOpacity={hoveredCity === city.code ? 1 : 0.88}
            stroke="var(--tile)"
            strokeWidth={hoveredCity === city.code ? 2 : 1.2}
            style={{ cursor: "pointer" }}
            onMouseEnter={() => setHoveredCity(city.code)}
            onMouseLeave={() => setHoveredCity(null)}
            onClick={() => onOpenMunicipality(city.code)}
          >
            <title>{city.nameKa}</title>
          </circle>
        ))}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-3.5 border-t border-[var(--hairline-soft)] pt-2.5">
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMin}</span>
        <span className="flex flex-none">
          {MAP_RAMP.map((fill) => (
            <span key={fill} aria-hidden className="h-[9px] w-8" style={{ backgroundColor: fill }} />
          ))}
        </span>
        <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--faint)]">{legendMax}</span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[var(--positive)] opacity-[0.88]" />
          <span className="text-[11px] text-[var(--faint)]">თვითმმართველი ქალაქები</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-[9px] w-3.5 border border-dashed"
            style={{ borderColor: MAP_NO_DATA_STROKE, backgroundColor: MAP_NO_DATA_FILL }}
          />
          <span className="text-[11px] text-[var(--faint)]">ოკუპირებული ტერიტორია — მონაცემები არ არის</span>
        </span>
        <span
          data-testid="map-readout"
          className="ml-auto font-[family-name:var(--font-numeric)] text-[11px] text-[var(--ink)]"
        >
          {readout}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the index client component**

Create `apps/web/components/municipalities/municipalities-index.tsx`. It owns the level tab, the search box, the ranked list and the hover state shared with the map.

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MunicipalKpi, MunicipalListRow } from "../../lib/explorer/municipalData";
import { formatAmount } from "../../lib/explorer/format";
import { parseMunicipalLevel } from "../../lib/explorer/urlState";
import { SourceNote, TabDivider, TextTab } from "../ui/editorial";
import { RegionMap, type RegionMapCity, type RegionMapShape } from "./region-map";

type MunicipalitiesIndexProps = {
  viewBox: string;
  shapes: RegionMapShape[];
  cities: RegionMapCity[];
  legendMin: string;
  legendMax: string;
  municipalities: MunicipalListRow[];
  regions: MunicipalListRow[];
  kpis: MunicipalKpi[];
  latestYear: number;
  sourceNote: string;
};

export function MunicipalitiesIndex(props: MunicipalitiesIndexProps) {
  const router = useRouter();
  const [level, setLevel] = useState<"muni" | "region">("muni");
  const [query, setQuery] = useState("");
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);

  useEffect(() => {
    setLevel(parseMunicipalLevel(window.location.hash));
  }, []);

  useEffect(() => {
    try {
      // Clearing the hash must restore the path, not write a literal space.
      history.replaceState(null, "", level === "region" ? "#lvl=region" : window.location.pathname);
    } catch {
      // History can be unavailable in embedded contexts; the UI still works.
    }
  }, [level]);

  const source = level === "region" ? props.regions : props.municipalities;
  const rows = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return source;
    return source.filter((row) => row.nameKa.includes(needle) || row.subtitleKa.includes(needle));
  }, [source, query]);

  const max = rows[0]?.valueGel ?? 1;
  const openMunicipality = (code: string) => router.push(`/explorer/municipalities/${code}`);
  const openRegion = (regionId: string) => router.push(`/explorer/municipalities/region/${regionId.replace("region.", "")}`);

  return (
    <>
      <div className="grid items-start gap-10 min-[1100px]:grid-cols-[minmax(0,1fr)_336px]">
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] pb-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
              რეგიონები რუკაზე · {props.latestYear}
            </span>
          </div>
          <div className="mt-1.5">
            <RegionMap
              viewBox={props.viewBox}
              shapes={props.shapes}
              cities={props.cities}
              legendMin={props.legendMin}
              legendMax={props.legendMax}
              hoveredRegionId={hoveredRegionId}
              onHoverRegion={setHoveredRegionId}
              onOpenRegion={openRegion}
              onOpenMunicipality={openMunicipality}
            />
          </div>

          <div className="mt-8 border-t-2 border-[var(--ink)] pt-5">
            <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">
              ძირითადი ინდიკატორები
            </h2>
            <div className="grid grid-cols-2 gap-8 min-[1100px]:grid-cols-4">
              {props.kpis.map((kpi) => (
                <div key={kpi.label} data-testid="index-kpi" className="flex flex-col gap-[5px]">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">
                    {kpi.label}
                  </span>
                  <span className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-nowrap">
                    {kpi.value}
                  </span>
                  <span className="text-[11.5px] leading-snug text-[var(--muted)]">{kpi.detail}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
          </div>
        </div>

        <div className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:border-[var(--hairline)] min-[1100px]:pt-0 min-[1100px]:pl-[26px]">
          <div className="flex items-baseline justify-between gap-2.5 border-b-2 border-[var(--ink)] pb-2">
            <span className="flex items-baseline gap-3.5">
              <TextTab label="მუნიციპალიტეტები" active={level === "muni"} onClick={() => setLevel("muni")} testId="level-muni" />
              <TabDivider />
              <TextTab label="რეგიონები" active={level === "region"} onClick={() => setLevel("region")} testId="level-region" />
            </span>
            <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">₾</span>
          </div>

          <div className="flex items-center gap-2 pt-3 pb-1">
            <input
              data-testid="municipal-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={level === "region" ? "ძებნა — რეგიონი" : "ძებნა — მუნიციპალიტეტი ან რეგიონი"}
              aria-label="ძებნა"
              className="h-[38px] min-w-0 flex-1 rounded-[3px] border border-[var(--control)] bg-[var(--tile)] px-[11px] text-[13px] text-[var(--ink)] outline-none focus:border-[var(--ink)]"
            />
            <span data-testid="row-count" className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">
              {rows.length === source.length ? `${source.length}` : `${rows.length} / ${source.length}`}
            </span>
          </div>

          {rows.length === 0 ? (
            <div data-testid="municipal-empty" className="px-1 py-[26px] text-center">
              <div className="text-[13px] text-[var(--body)]">ვერაფერი მოიძებნა</div>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 inline-flex h-[30px] cursor-pointer items-center rounded-[3px] border border-[var(--control)] px-3 text-[12px] text-[var(--accent)]"
              >
                ძებნის გასუფთავება
              </button>
            </div>
          ) : (
            <div className="mt-1.5 max-h-[620px] overflow-y-auto">
              {rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  data-testid="municipal-list-row"
                  onClick={() => (row.kind === "region" ? openRegion(row.id) : openMunicipality(row.id))}
                  onMouseEnter={() => setHoveredRegionId(row.regionId)}
                  onMouseLeave={() => setHoveredRegionId(null)}
                  className={`grid w-full grid-cols-[22px_minmax(0,1fr)_66px_12px] items-center gap-[9px] border-b border-[var(--row-border)] py-[7px] pr-1 text-left ${
                    row.regionId !== null && row.regionId === hoveredRegionId ? "bg-[var(--tint)]" : ""
                  }`}
                >
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                    {String(row.rank).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium">{row.nameKa}</span>
                    <span className="block truncate text-[10.5px] text-[var(--faint)]">{row.subtitleKa}</span>
                    <span className="mt-[5px] block h-[3px] bg-[var(--hairline-soft)]">
                      <span
                        className="block h-[3px] bg-[var(--accent)]"
                        style={{ width: `${((row.valueGel / max) * 100).toFixed(1)}%` }}
                      />
                    </span>
                  </span>
                  <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]">
                    {formatAmount(row.valueGel)}
                  </span>
                  <span aria-hidden className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
                    →
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Write the route**

Create `apps/web/app/explorer/municipalities/page.tsx`:

```tsx
import type { Metadata } from "next";
import { MunicipalitiesIndex } from "../../../components/municipalities/municipalities-index";
import { PageHeader } from "../../../components/shell/page-header";
import type { RegionMapCity, RegionMapShape } from "../../../components/municipalities/region-map";
import { MAP_RAMP } from "../../../lib/explorer/colors";
import { loadServedLandingData, loadServedMunicipalData } from "../../../lib/data/servedData";
import { buildIndexKpis, buildMunicipalListRows } from "../../../lib/explorer/municipalData";
import { buildRegionShapes, MAP_VIEWBOX, projectPoint } from "../../../lib/explorer/municipalGeo";
import { GEORGIA_GEO } from "../../../lib/landing/georgiaGeo";
import { formatAmount } from "../../../lib/explorer/format";

const TITLE = "მუნიციპალიტეტები — GeoData";

export async function generateMetadata(): Promise<Metadata> {
  const { totalFacts } = await loadServedMunicipalData();
  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const description = `საქართველოს მუნიციპალიტეტების ბიუჯეტები ფუნქციების მიხედვით, ${years[0]} წლიდან დღემდე.`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/explorer/municipalities" },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: "/explorer/municipalities",
      title: TITLE,
      description,
    },
  };
}

/** Quantile classing: with 11 values spanning 22×, equal intervals would put
 *  nine regions in one bucket. Quantiles show rank position instead. */
function bucketize(values: number[]): (value: number) => number {
  const sorted = values.slice().sort((a, b) => a - b);
  const breaks = [1, 2, 3, 4, 5].map((k) => sorted[Math.floor((k / 6) * sorted.length)] ?? Infinity);

  return (value: number) => {
    let index = 0;
    while (index < 5 && value >= (breaks[index] ?? Infinity)) index += 1;
    return index;
  };
}

export default async function MunicipalitiesIndexPage() {
  const { municipalities, regions, totalFacts, functionFacts, functions } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year: latestYear });
  const valueByRegion = new Map(list.regions.map((row) => [row.id, row.valueGel]));
  const bucketOf = bucketize(list.regions.map((row) => row.valueGel));

  const shapes: RegionMapShape[] = buildRegionShapes().map((shape) => {
    const valueGel = shape.regionId === null ? null : valueByRegion.get(shape.regionId) ?? null;

    return {
      shapeIso: shape.shapeIso,
      regionId: shape.regionId,
      nameKa: shape.nameKa,
      d: shape.d,
      valueGel,
      bucket: valueGel === null ? -1 : bucketOf(valueGel),
    };
  });

  // Self-governing city dots: the registry flag decides membership, GEORGIA_GEO
  // supplies the coordinates, and projectPoint — the SAME function the shapes
  // use — places them. Never reimplement the projection here.
  const cities: RegionMapCity[] = municipalities
    .filter((municipality) => municipality.isSelfGoverningCity)
    .flatMap((municipality) => {
      const marker = GEORGIA_GEO.cityMarkers.find((city) => city.ka === municipality.displayNameKa);
      if (!marker) return [];
      const { x, y } = projectPoint(marker.lon, marker.lat);

      return [{ code: municipality.code, nameKa: municipality.displayNameKa, x, y }];
    });

  if (cities.length !== municipalities.filter((row) => row.isSelfGoverningCity).length) {
    throw new Error("a self-governing city has no coordinate in GEORGIA_GEO.cityMarkers");
  }

  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";
  const values = list.regions.map((row) => row.valueGel);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები" },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />
        <h1 className="mt-[34px] mb-2.5 max-w-[640px] font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
          რას ხარჯავენ საქართველოს მუნიციპალიტეტები
        </h1>
        <p className="mb-[26px] max-w-[560px] text-[13.5px] leading-relaxed text-[var(--body)]">
          აირჩიე მუნიციპალიტეტი რუკაზე ან სიაში — გაიხსნება მისი ბიუჯეტის სრული ისტორია ფუნქციების მიხედვით.
        </p>

        <MunicipalitiesIndex
          viewBox={MAP_VIEWBOX}
          shapes={shapes}
          cities={cities}
          legendMin={formatAmount(Math.min(...values))}
          legendMax={formatAmount(Math.max(...values))}
          municipalities={list.municipalities}
          regions={list.regions}
          kpis={buildIndexKpis({ municipalities, totalFacts, functionFacts, functions, firstYear, latestYear })}
          latestYear={latestYear}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს. საზღვრები: geoBoundaries (gbOpen GEO ADM1), CC BY 3.0.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
```

`MAP_HEIGHT` is imported for the viewBox contract; if lint flags it as unused, drop it from the import list.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 5: Verify in the browser**

Start the preview (do NOT use `npm run dev` via a shell tool — use the Browser pane's `preview_start`), navigate to `http://localhost:3100/explorer/municipalities`, and confirm:
- 12 region shapes render, one of them dashed (`GE-AB`).
- 5 green city dots.
- The list shows 64 rows, თბილისი first.
- Switching to `რეგიონები` shows 11 rows.
- No console errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/municipalities apps/web/app/explorer/municipalities/page.tsx
git commit -m "feat: add the municipalities index page"
```

---

### Task 10: Entity picker

**Files:**
- Create: `apps/web/components/municipalities/entity-picker.tsx`

**Interfaces:**
- Consumes: `MunicipalListRow` (Task 6).
- Produces: `<EntityPicker open onClose groups activeId onSelectMunicipality onSelectRegion />` where `EntityPickerGroup = { regionId: string; nameKa: string; valueGel: number; members: Array<{ code: string; nameKa: string; valueGel: number }> }`.

**The trigger button lives in the parent, not here.** The parent renders it
inside its `<h1>`; this component renders only the popover, as a sibling of that
heading. A `role="dialog"` nested inside a heading is announced as part of the
heading, and a `position: fixed` overlay inside an `h1` is fragile to position.
Open state is therefore owned by `MunicipalExplorer` (Task 11), which also binds
`⌘K`.

- [ ] **Step 1: Write the component**

Create `apps/web/components/municipalities/entity-picker.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatAmount } from "../../lib/explorer/format";

// Entity picker for the 64 municipality and 11 region pages. A plain popover
// with focus return, not a command palette: ⌘K is a shortcut onto the same
// control the heading click opens. With 64 entities, prev/next and a trip back
// to the index are not enough navigation.

export type EntityPickerGroup = {
  regionId: string;
  nameKa: string;
  valueGel: number;
  members: Array<{ code: string; nameKa: string; valueGel: number }>;
};

type EntityPickerProps = {
  open: boolean;
  onClose: () => void;
  groups: EntityPickerGroup[];
  activeId: string;
  onSelectMunicipality: (code: string) => void;
  onSelectRegion: (regionId: string) => void;
};

export function EntityPicker({ open, onClose, groups, activeId, onSelectMunicipality, onSelectRegion }: EntityPickerProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        // Focus returns to the trigger, which the parent renders in its <h1>.
        document.querySelector<HTMLButtonElement>("[data-testid='entity-picker-trigger']")?.focus();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setQuery("");
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const filtered = useMemo(() => {
    const needle = query.trim();
    if (needle === "") return groups;

    return groups
      .map((group) => ({ ...group, members: group.members.filter((member) => member.nameKa.includes(needle)) }))
      .filter((group) => group.members.length > 0 || group.nameKa.includes(needle));
  }, [groups, query]);

  return (
    <div className="relative">
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="აირჩიე მუნიციპალიტეტი ან რეგიონი"
        data-testid="entity-picker"
        className="absolute top-1 left-0 z-40 w-[430px] max-w-[92vw] border border-[var(--control)] bg-[var(--tile)]"
      >
        <div className="border-b border-[var(--hairline-soft)] p-3">
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ძებნა — მუნიციპალიტეტი ან რეგიონი"
                aria-label="ძებნა"
            className="h-[34px] w-full rounded-[3px] border border-[var(--control)] bg-[var(--paper)] px-2.5 text-[13px] text-[var(--ink)] outline-none"
          />
        </div>
        <div className="max-h-[340px] overflow-y-auto">
          {filtered.map((group) => (
            <div key={group.regionId}>
              <button
                type="button"
                data-testid="picker-region"
                onClick={() => {
                  onClose();
                  onSelectRegion(group.regionId);
                }}
                className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-[var(--hairline-soft)] bg-[var(--tint)] px-3 py-2 text-left ${
                  group.regionId === activeId ? "text-[var(--accent)]" : "text-[var(--ink)]"
                }`}
              >
                <span className="truncate text-[12px] font-semibold">{group.nameKa}</span>
                <span className="font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
                  {formatAmount(group.valueGel)} · {group.members.length}
                </span>
              </button>
              {group.members.map((member) => (
                <button
                  key={member.code}
                  type="button"
                  data-testid="picker-municipality"
                  onClick={() => {
                    onClose();
                    onSelectMunicipality(member.code);
                  }}
                  className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-[var(--row-border)] py-[7px] pr-3 pl-[26px] text-left ${
                    member.code === activeId ? "font-semibold text-[var(--accent)]" : "text-[var(--body)]"
                  }`}
                >
                  <span className="truncate text-[13px]">{member.nameKa}</span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                    {formatAmount(member.valueGel)}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--hairline-soft)] px-3 py-2 text-[11px] text-[var(--faint)]">
          რეგიონის დაჭერა აჩვენებს მის ჯამურ მონაცემებს
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/municipalities/entity-picker.tsx
git commit -m "feat: add the municipality and region entity picker"
```

---

### Task 11: Municipality pages

**Files:**
- Create: `apps/web/components/municipalities/use-municipal-state.ts`, `apps/web/components/municipalities/municipal-explorer.tsx`, `apps/web/components/municipalities/municipal-indicators.tsx`, `apps/web/app/explorer/municipalities/[code]/page.tsx`

**Interfaces:**
- Consumes: Tasks 2, 5, 7, 8, 10.
- Produces: 64 routes, plus `MunicipalExplorer`, whose exact prop type is:

```ts
export type MunicipalExplorerProps = {
  title: string;                 // "როგორ ხარჯავს ბიუჯეტს" — the picker trigger follows it
  triggerLabel: string;          // the entity name, rendered as the picker trigger
  metaLine: string;
  entityId: string;              // municipality code, or region id — marks the active picker row

  // RAW facts, already narrowed (and, for a region, aggregated) by the route.
  // The component rebuilds the model whenever the range moves; see below.
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];

  nationalTotalLatest: number;
  rank: number;
  rankOutOf: number;
  csvBasename: string;
  pickerGroups: EntityPickerGroup[];
  prev: { label: string; href: string };
  next: { label: string; href: string };
  sourceNote: string;
  children?: ReactNode;          // region pages put their member list here
};
```

**Why raw facts and not a prebuilt model.** `ExplorerTableRow.change` and
`.shareEndYear`, the movers board and the comparison table are all *functions of
the selected range*. Handing the component one model built for the full span and
filtering its `years` array leaves those four describing 2015–2025 while the year
columns describe the user's selection — wrong numbers, silently. The budget
explorer rebuilds via `buildExplorerModel(startYear, endYear)` in a `useMemo` for
exactly this reason, and this component does the same. Rebuilding is ~110 rows of
arithmetic; the alternative is 66 precomputed range combinations per page.

- [ ] **Step 1: Write the state hook**

Create `apps/web/components/municipalities/use-municipal-state.ts`:

```ts
"use client";

import { useEffect, useRef, useState } from "react";
import type { ChartMode } from "../../lib/explorer/types";
import { parseMunicipalHash, serializeMunicipalHash } from "../../lib/explorer/urlState";


export function useMunicipalState(years: number[], defaultSelection: string[], knownIds: Set<string>) {
  const min = years[0] ?? 0;
  const max = years.at(-1) ?? 0;

  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [share, setShare] = useState(false);
  const [start, setStart] = useState(min);
  const [end, setEnd] = useState(max);
  const [selectedIds, setSelectedIds] = useState(defaultSelection);
  const appliedRef = useRef(false);
  const writtenRef = useRef(false);

  useEffect(() => {
    if (appliedRef.current) return;
    appliedRef.current = true;
    const parsed = parseMunicipalHash(window.location.hash);

    /* eslint-disable react-hooks/set-state-in-effect */
    if (parsed.chartMode) setChartMode(parsed.chartMode);
    if (parsed.share) setShare(true);
    if (parsed.range) {
      setStart(Math.min(Math.max(parsed.range.start, min), max));
      setEnd(Math.min(Math.max(parsed.range.end, min), max));
    }
    if (parsed.selection) {
      const known = parsed.selection.filter((id) => knownIds.has(id));
      // A deliberately-empty shared selection restores as empty; one whose ids
      // are ALL unknown falls back to the default.
      if (known.length > 0 || parsed.selection.length === 0) setSelectedIds(known);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hash = serializeMunicipalHash({ chartMode, share, rangeStart: start, rangeEnd: end, selectedIds });

  useEffect(() => {
    if (!writtenRef.current) {
      writtenRef.current = true;
      return;
    }
    try {
      history.replaceState(null, "", `#${hash}`);
    } catch {
      // History can be unavailable in embedded contexts; the UI still works.
    }
  }, [hash]);

  function toggleSeries(itemId: string) {
    setSelectedIds((current) =>
      current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId],
    );
  }

  function setRange(patch: { start?: number; end?: number }) {
    if (patch.start !== undefined) setStart(Math.min(Math.max(patch.start, min), max));
    if (patch.end !== undefined) setEnd(Math.min(Math.max(patch.end, min), max));
  }

  return {
    chartMode,
    setChartMode: (mode: ChartMode) => {
      setChartMode(mode);
    },
    share,
    setShare,
    range: { start: Math.min(start, end), end: Math.max(start, end), min, max },
    setRange,
    selectedIds,
    toggleSeries,
    setSelectedIds,
  };
}
```

- [ ] **Step 2: Write the indicators component**

Create `apps/web/components/municipalities/municipal-indicators.tsx`:

```tsx
import type { MunicipalComparisonRow, MunicipalKpi, MunicipalMover } from "../../lib/explorer/municipalData";
import { formatAmount, formatShare, MISSING } from "../../lib/explorer/format";
import { NEGATIVE, POSITIVE } from "../../lib/explorer/colors";
import { SwatchBar } from "../ui/editorial";

// KPI row (DESIGN.md §7.11), movers board (§7.13) and the period comparison.

function MoverRow({ mover, maxAbs }: { mover: MunicipalMover; maxAbs: number }) {
  const growth = mover.growth;
  const width = growth === null || maxAbs === 0 ? 0 : (Math.abs(growth) / maxAbs) * 100;

  return (
    <div className="grid grid-cols-[24px_minmax(0,1fr)_96px_72px] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2">
      <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
        {String(mover.rank).padStart(2, "0")}
      </span>
      <span className="truncate text-[12.5px]">{mover.kaLabel}</span>
      <span className="h-[3px] bg-[var(--hairline-soft)]">
        <span
          className="block h-[3px]"
          style={{ width: `${width.toFixed(0)}%`, backgroundColor: growthColor(growth) }}
        />
      </span>
      <span className="text-right font-[family-name:var(--font-numeric)] text-[11.5px]" style={{ color: growthColor(growth) }}>
        {formatShare(growth, true)}
      </span>
    </div>
  );
}

/** Positive/negative token for a growth figure; muted when there is no value. */
function growthColor(growth: number | null): string {
  if (growth === null) return "var(--muted)";
  return growth >= 0 ? POSITIVE : NEGATIVE;
}

type MunicipalIndicatorsProps = {
  kpis: MunicipalKpi[];
  movers: { up: MunicipalMover[]; down: MunicipalMover[] };
  comparison: MunicipalComparisonRow[];
  startYear: number;
  endYear: number;
};

export function MunicipalIndicators({ kpis, movers, comparison, startYear, endYear }: MunicipalIndicatorsProps) {
  const maxAbs = Math.max(
    ...[...movers.up, ...movers.down].map((mover) => Math.abs(mover.growth ?? 0)),
    Number.EPSILON,
  );

  return (
    <>
      <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
        <h2 className="mb-[18px] font-[family-name:var(--font-display)] text-[22px] font-semibold">ძირითადი ინდიკატორები</h2>
        <div className="grid grid-cols-2 gap-8 min-[1100px]:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} data-testid="entity-kpi" className="flex flex-col gap-[5px]">
              <span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--muted)]">{kpi.label}</span>
              <span className="font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.1] tracking-[-0.02em] whitespace-nowrap">
                {kpi.value}
              </span>
              <span className="text-[11.5px] leading-snug text-[var(--muted)]">{kpi.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-11 grid grid-cols-1 gap-10 border-t-2 border-[var(--ink)] pt-[22px] min-[1100px]:grid-cols-2">
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე მზარდი</div>
          {movers.up.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
        <div>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">ყველაზე ნელი ზრდა</div>
          {movers.down.map((mover) => (
            <MoverRow key={mover.kaLabel} mover={mover} maxAbs={maxAbs} />
          ))}
        </div>
      </div>

      <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-display)] text-[22px] font-semibold whitespace-nowrap">პერიოდის შედარება</h2>
          <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
            {startYear} → {endYear}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table data-testid="comparison-table" className="w-full border-collapse" style={{ minWidth: 560 }}>
            <thead>
              <tr>
                {["საბიუჯეტო მუხლი", String(startYear), "ცვლილება", String(endYear)].map((label, index) => (
                  <th
                    key={label}
                    className={`border-b-2 border-[var(--ink)] pb-[7px] text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--muted)] ${
                      index === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparison.map((row) => (
                <tr
                  key={row.kaLabel}
                  className={`border-b border-[var(--hairline-soft)] ${row.isTotal ? "bg-[var(--tint)]" : ""}`}
                >
                  <td className="py-[9px]">
                    <span className="inline-flex items-center gap-[9px]">
                      <SwatchBar color={row.color} />
                      <span className={`truncate text-[12.5px] ${row.isTotal ? "font-semibold" : "font-medium"}`}>
                        {row.kaLabel}
                      </span>
                    </span>
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--body)]">
                    {formatAmount(row.fromGel)}
                  </td>
                  <td
                    className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px]"
                    style={{ color: growthColor(row.changeShare) }}
                  >
                    {row.changeShare === null ? MISSING : `${formatShare(row.changeShare, true)}  ${formatAmount(row.changeGel)}`}
                  </td>
                  <td className="py-[9px] text-right font-[family-name:var(--font-numeric)] text-[11.5px] font-semibold">
                    {formatAmount(row.toGel)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Write the shared explorer component**

Create `apps/web/components/municipalities/municipal-explorer.tsx`. It renders the workspace and the aside, uses the official total as the public total, and is used by both the municipality and region routes. Reconciliation fields remain internal.

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { MunicipalFunction, MunicipalFunctionFact, MunicipalTotalFact } from "../../lib/data/municipal/types";
import type { SourceDocumentRow } from "../../lib/data/sources";
import {
  buildComparisonRows,
  buildEntityKpis,
  buildMovers,
  buildMunicipalEntityModel,
  getDefaultMunicipalSelection,
} from "../../lib/explorer/municipalData";
import { buildExplorerCsv } from "../../lib/explorer/csvExport";
import { formatAmount, UNIT_MLN } from "../../lib/explorer/format";
import type { ChartMode } from "../../lib/explorer/types";
import { SegmentedTabs, SourceNote, SwatchBar } from "../ui/editorial";
import { EditorialLineChart, type ChartSeries } from "../main-explorer/editorial-line-chart";
import { ExplorerTable } from "../main-explorer/explorer-table";
import { RangeStrip } from "../main-explorer/range-strip";
import { EntityPicker, type EntityPickerGroup } from "./entity-picker";
import { MunicipalIndicators } from "./municipal-indicators";
import { useMunicipalState } from "./use-municipal-state";

export type MunicipalExplorerProps = {
  title: string;
  triggerLabel: string;
  metaLine: string;
  entityId: string;

  // Raw facts, already narrowed (and, for a region, aggregated) by the route.
  // NOT a prebuilt model: change, shareEndYear, the KPIs, the movers and the
  // comparison table are all functions of the selected range, which is client
  // state. Handing over one full-span model and filtering its years array would
  // leave all five describing a period the reader is not looking at.
  functions: MunicipalFunction[];
  functionFacts: MunicipalFunctionFact[];
  totalFacts: MunicipalTotalFact[];
  sourceDocuments: SourceDocumentRow[];

  nationalTotalLatest: number;
  rank: number;
  rankOutOf: number;
  csvBasename: string;
  pickerGroups: EntityPickerGroup[];
  prev: { label: string; href: string };
  next: { label: string; href: string };
  sourceNote: string;
  children?: ReactNode;
};

export function MunicipalExplorer(props: MunicipalExplorerProps) {
  const router = useRouter();
  const { functions, functionFacts, totalFacts, sourceDocuments } = props;
  const [pickerOpen, setPickerOpen] = useState(false);

  const allYears = useMemo(
    () => Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b),
    [totalFacts],
  );
  const firstYear = allYears[0] ?? 0;
  const lastYear = allYears.at(-1) ?? 0;

  // Full-span model, for the series list's stable order and the default
  // selection — both must survive a range change rather than re-deriving.
  const fullModel = useMemo(
    () =>
      buildMunicipalEntityModel({
        functions,
        functionFacts,
        totalFacts,
        sourceDocuments,
        startYear: firstYear,
        endYear: lastYear,
      }),
    [functions, functionFacts, totalFacts, sourceDocuments, firstYear, lastYear],
  );

  const knownIds = useMemo(() => new Set([fullModel.totalRow.itemId, ...fullModel.rows.map((row) => row.itemId)]), [fullModel]);
  const defaults = useMemo(() => getDefaultMunicipalSelection(fullModel), [fullModel]);
  const state = useMunicipalState(allYears, defaults, knownIds);

  // REBUILT on every range change. Filtering the full model's years instead
  // would leave change, shareEndYear, the movers and the comparison describing
  // the whole span while the year columns describe the selection.
  const model = useMemo(
    () =>
      buildMunicipalEntityModel({
        functions,
        functionFacts,
        totalFacts,
        sourceDocuments,
        startYear: state.range.start,
        endYear: state.range.end,
      }),
    [functions, functionFacts, totalFacts, sourceDocuments, state.range.start, state.range.end],
  );

  const years = model.years;
  const totalsByYear = new Map(years.map((year) => [year, model.totalRow.valuesByYear[year] ?? null]));

  const selectableRows = [model.totalRow, ...model.rows];
  const series: ChartSeries[] = selectableRows
    .filter((row) => state.selectedIds.includes(row.itemId))
    .map((row) => ({
      id: row.itemId,
      label: row.kaLabel,
      color: row.color,
      vals: years.map((year) => {
        const value = row.valuesByYear[year] ?? null;
        if (!state.share) return value;
        const total = totalsByYear.get(year);
        return value === null || !total ? null : (value / total) * 100;
      }),
      planned: years.map(() => false),
    }));

  const [seriesQuery, setSeriesQuery] = useState("");
  const visibleRows = useMemo(() => {
    const needle = seriesQuery.trim();
    const functions = needle === "" ? model.rows : model.rows.filter((row) => row.kaLabel.includes(needle));
    return [model.totalRow, ...functions];
  }, [model.rows, model.totalRow, seriesQuery]);
  const allSelected = selectableRows.length > 0 && selectableRows.every((row) => state.selectedIds.includes(row.itemId));
  const hasSelection = state.selectedIds.length > 0;

  function toggleAll() {
    if (hasSelection) {
      state.setSelectedIds([]);
      return;
    }
    state.setSelectedIds(selectableRows.map((row) => row.itemId));
  }

  function downloadCsv() {
    const csv = buildExplorerCsv([...model.rows, model.totalRow], years);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `geodata-${props.csvBasename}-${state.range.start}-${state.range.end}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPickerOpen(true);
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <div className="mt-[22px] flex items-baseline justify-between gap-5">
        <div className="min-w-0">
          {/* The popover is a SIBLING of the heading, not a child: a role="dialog"
              and a fixed overlay nested inside an h1 is announced as part of the
              heading and is fragile to position. */}
          <h1 className="mb-2 font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
            {props.title}{" "}
            <button
              type="button"
              data-testid="entity-picker-trigger"
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
              onClick={() => setPickerOpen((current) => !current)}
              className="cursor-pointer border-b-2 border-[var(--accent)] font-[family-name:var(--font-display)] text-inherit"
            >
              {props.triggerLabel}
            </button>
          </h1>
          <EntityPicker
            open={pickerOpen}
            onClose={() => setPickerOpen(false)}
            groups={props.pickerGroups}
            activeId={props.entityId}
            onSelectMunicipality={(code) => router.push(`/explorer/municipalities/${code}`)}
            onSelectRegion={(regionId) => router.push(`/explorer/municipalities/region/${regionId.replace("region.", "")}`)}
          />
          <div className="text-[12.5px] text-[var(--muted)]">{props.metaLine}</div>
        </div>
        <span className="flex flex-none items-center gap-4">
          <a href={props.prev.href} className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            ← {props.prev.label}
          </a>
          <a href={props.next.href} className="font-[family-name:var(--font-numeric)] text-[11.5px] text-[var(--muted)] no-underline hover:text-[var(--ink)]">
            {props.next.label} →
          </a>
        </span>
      </div>

      <div className="mt-7 grid items-start gap-10 border-t border-[var(--ink)] pt-5 min-[1100px]:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-[18px] flex items-center justify-between gap-5">
            <span className="flex items-baseline gap-4">
              <SegmentedTabs<ChartMode>
                ariaLabel="ხედის რეჟიმი"
                value={state.chartMode}
                onChange={state.setChartMode}
                options={[
                  { value: "line", label: "ხაზი", testId: "municipal-mode-line" },
                  { value: "table", label: "ცხრილი", testId: "municipal-mode-table" },
                ]}
              />
              <span className="font-[family-name:var(--font-numeric)] text-[10.5px] text-[var(--faint)]">
                {state.share ? "წილი მთლიან ბიუჯეტში, %" : "მთლიანი ბიუჯეტი · მლნ ₾"}
              </span>
            </span>
            <button
              type="button"
              data-testid="municipal-share-toggle"
              aria-pressed={state.share}
              onClick={() => state.setShare(!state.share)}
              className={`inline-flex h-[27px] cursor-pointer items-center rounded-full border px-3 text-[11.5px] ${
                state.share
                  ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)]"
                  : "border-[var(--control)] text-[var(--muted)]"
              }`}
            >
              % წილი
            </button>
          </div>

          {state.chartMode === "line" ? (
            <EditorialLineChart years={years} series={series} share={state.share} unit={UNIT_MLN} />
          ) : (
            <ExplorerTable
              rows={model.rows.filter((row) => state.selectedIds.includes(row.itemId))}
              totalRow={model.totalRow}
              showTotal={state.selectedIds.includes(model.totalRow.itemId)}
              years={years}
              firstColumnLabel="ფუნქცია"
              unit={UNIT_MLN}
              share={state.share}
            />
          )}

          {/* allYears, never model.years — the strip must offer the full span
              even when the selection has narrowed it. */}
          <div className="mt-6 border-t border-[var(--hairline-soft)] pt-4">
            <RangeStrip years={allYears} range={state.range} onChange={state.setRange} />
          </div>

          <div className="mt-5 max-w-[640px]">
            <SourceNote testId="municipal-source-note">{props.sourceNote}</SourceNote>
          </div>

          {props.children}

          {/* All three derive from the RANGE model, so they move together with
              the chart instead of describing a span the user is not looking at. */}
          <MunicipalIndicators
            kpis={buildEntityKpis({
              model,
              nationalTotalLatest: props.nationalTotalLatest,
              rank: props.rank,
              rankOutOf: props.rankOutOf,
            })}
            movers={buildMovers(model)}
            comparison={buildComparisonRows(model)}
            startYear={state.range.start}
            endYear={state.range.end}
          />
        </div>

        <aside className="min-w-0 border-t-2 border-[var(--ink)] pt-[22px] min-[1100px]:border-t-0 min-[1100px]:border-l min-[1100px]:border-[var(--hairline)] min-[1100px]:pt-0 min-[1100px]:pl-[26px]">
          <div className="sticky top-5">
            <div className="flex items-center justify-between gap-4 pb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                სერიები {state.selectedIds.length} / {selectableRows.length}
              </span>
              <button
                type="button"
                data-testid="municipal-series-all"
                aria-pressed={allSelected}
                onClick={toggleAll}
                className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-1 pr-1 pl-0.5 text-left"
              >
                <span aria-hidden>{allSelected ? "✓" : ""}</span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--ink)]">
                  {hasSelection ? "გასუფთავება" : "ყველას მონიშვნა"}
                </span>
              </button>
            </div>

            <input
              data-testid="municipal-series-search"
              value={seriesQuery}
              onChange={(event) => setSeriesQuery(event.target.value)}
              placeholder="ძებნა"
              aria-label="სერიების ძებნა"
              className="mb-2 h-[34px] w-full border-0 border-b border-[var(--control)] bg-transparent text-[13px] text-[var(--ink)] outline-none"
            />

            {visibleRows.map((row) => {
              const selected = state.selectedIds.includes(row.itemId);
              const latest = row.valuesByYear[state.range.end] ?? null;

              return (
                <button
                  key={row.itemId}
                  type="button"
                  data-testid="municipal-series-row"
                  aria-pressed={selected}
                  onClick={() => state.toggleSeries(row.itemId)}
                  className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-[var(--row-border)] py-[7px] pr-1 text-left"
                >
                  <span
                    aria-hidden
                    className="inline-flex h-3.5 w-3.5 items-center justify-center border-[1.5px] text-[9px] leading-none text-[var(--paper)]"
                    style={{
                      borderColor: selected ? row.color : "var(--control)",
                      backgroundColor: selected ? row.color : "transparent",
                    }}
                  >
                    {selected ? "✓" : ""}
                  </span>
                  <span className="flex min-w-0 items-center gap-[7px]">
                    <SwatchBar color={row.color} />
                    <span className="truncate text-[12px] font-medium">{row.kaLabel}</span>
                  </span>
                  <span className="font-[family-name:var(--font-numeric)] text-[10.5px] whitespace-nowrap text-[var(--faint)]">
                    {formatAmount(latest)}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              data-testid="municipal-csv"
              onClick={downloadCsv}
              className="mt-4 flex h-[38px] w-full cursor-pointer items-center justify-center rounded-[2px] bg-[var(--ink)] text-[12.5px] font-semibold text-[var(--paper)] hover:opacity-85"
            >
              CSV ჩამოტვირთვა
            </button>

            <a
              href="/explorer/municipalities"
              className="mt-3.5 block text-[12px] text-[var(--muted)] no-underline hover:text-[var(--ink)]"
            >
              ← ყველა მუნიციპალიტეტი
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}
```

- [ ] **Step 4: Write the shared page-data helper**

Both entity routes need the same picker groups and national total. Append to
`apps/web/lib/explorer/municipalData.ts`:

```ts
export type EntityPickerGroupModel = {
  regionId: string;
  nameKa: string;
  valueGel: number;
  members: Array<{ code: string; nameKa: string; valueGel: number }>;
};

/** Picker groups: regions in value order, each with its members in value order. */
export function buildPickerGroups(input: MunicipalListInput): EntityPickerGroupModel[] {
  const { municipalities, regions } = buildMunicipalListRows(input);
  const membersByRegion = new Map<string, Array<{ code: string; nameKa: string; valueGel: number }>>();

  for (const row of municipalities) {
    if (row.regionId === null) continue;
    const bucket = membersByRegion.get(row.regionId) ?? [];
    bucket.push({ code: row.id, nameKa: row.nameKa, valueGel: row.valueGel });
    membersByRegion.set(row.regionId, bucket);
  }

  return regions.map((region) => ({
    regionId: region.id,
    nameKa: region.nameKa,
    valueGel: region.valueGel,
    members: membersByRegion.get(region.id) ?? [],
  }));
}
```

`buildMunicipalListRows` already sorts both levels by value descending, so the
members inherit that order.

- [ ] **Step 5: Write the municipality route**

Create `apps/web/app/explorer/municipalities/[code]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../lib/data/servedData";
import { buildMunicipalListRows, buildPickerGroups } from "../../../../lib/explorer/municipalData";
import { georgianOrdinal } from "../../../../lib/explorer/municipalLabels";

// The 64 codes are the complete, closed set. Without this, an unknown code is
// left to request-time rendering instead of failing at build.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { municipalities } = await loadServedMunicipalData();
  return municipalities.map((municipality) => ({ code: municipality.code }));
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const { municipalities, totalFacts } = await loadServedMunicipalData();
  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) return {};

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const title = `${municipality.displayNameKa} — მუნიციპალიტეტები — GeoData`;
  const description = `${municipality.nameKa}ს ბიუჯეტი ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/explorer/municipalities/${code}` },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: `/explorer/municipalities/${code}`,
      title,
      description,
    },
  };
}

export default async function MunicipalityPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { municipalities, regions, functions, functionFacts, totalFacts } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const municipality = municipalities.find((row) => row.code === code);
  if (!municipality) notFound();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const listInput = { municipalities, regionLabels, totalFacts, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rank = list.municipalities.find((row) => row.id === code)?.rank ?? 0;
  const nationalTotalLatest = list.municipalities.reduce((sum, row) => sum + row.valueGel, 0);

  // Only this municipality's rows travel to the client: ~110 function facts and
  // 11 total facts, not the 7,744-row corpus.
  const own = {
    functionFacts: functionFacts.filter((row) => row.municipalityCode === code),
    totalFacts: totalFacts.filter((row) => row.municipalityCode === code),
  };

  // Prev/next walk the registry's official sort order, which is roughly
  // region-grouped in the source, so stepping through stays geographic.
  const ordered = municipalities.slice().sort((left, right) => left.sortId - right.sortId);
  const index = ordered.findIndex((row) => row.code === code);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;

  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: municipality.displayNameKa },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          title="როგორ ხარჯავს ბიუჯეტს"
          triggerLabel={municipality.displayNameKa}
          entityId={code}
          metaLine={`${regionLabels.get(municipality.regionId) ?? ""} · ${georgianOrdinal(rank)} ადგილი ${municipalities.length}-დან ${latestYear} წელს`}
          functions={functions}
          functionFacts={own.functionFacts}
          totalFacts={own.totalFacts}
          sourceDocuments={sourceDocuments}
          nationalTotalLatest={nationalTotalLatest}
          rank={rank}
          rankOutOf={municipalities.length}
          csvBasename={`municipality-${code}`}
          pickerGroups={buildPickerGroups(listInput)}
          prev={{ label: prev.displayNameKa, href: `/explorer/municipalities/${prev.code}` }}
          next={{ label: next.displayNameKa, href: `/explorer/municipalities/${next.code}` }}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო).${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
```

The route hands over **raw facts, not a model**: the KPIs, the movers, the
comparison table and each row's `change` / `shareEndYear` all depend on the
selected range, which is client state the route cannot know. `MunicipalExplorer`
rebuilds on every range change (Task 11 Step 3).

**Before writing this, read `node_modules/next/dist/docs/` on route params.**
This Next.js version awaits `params`; if the local docs say otherwise, follow
them and adjust both `generateMetadata` and the default export.

- [ ] **Step 6: Typecheck and lint**

Run: `npm run check`
Expected: PASS.

`buildPickerGroups` returns `EntityPickerGroupModel`, which is structurally
identical to the picker component's `EntityPickerGroup` — TypeScript accepts it
without a cast. If it does not, the two shapes have drifted; reconcile them
rather than casting.

- [ ] **Step 7: Verify in the browser**

Navigate to `/explorer/municipalities/04` and confirm: chart renders with the total plus five functions; the mode toggle switches to a table whose numbers read in the hundreds, not `0.00`; the range strip narrows the chart; selecting every row renders every series without a limit or reconciliation callout.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/municipalities apps/web/app/explorer/municipalities
git commit -m "feat: add municipality pages"
```

---

### Task 12: Region pages

**Files:**
- Create: `apps/web/app/explorer/municipalities/region/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 11's `MunicipalExplorer` (via its `children` slot for the member list), `regionFactsFor` (Task 6), `REGION_GENITIVE_KA` and `georgianOrdinal` (Task 3).
- Produces: 11 routes.

- [ ] **Step 1: Write the route**

Create `apps/web/app/explorer/municipalities/region/[id]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MunicipalExplorer } from "../../../../../components/municipalities/municipal-explorer";
import { PageHeader } from "../../../../../components/shell/page-header";
import { loadServedLandingData, loadServedMunicipalData } from "../../../../../lib/data/servedData";
import {
  aggregateFactsForEntity,
  buildMunicipalListRows,
  buildPickerGroups,
  regionFactsFor,
} from "../../../../../lib/explorer/municipalData";
import { georgianOrdinal, REGION_GENITIVE_KA } from "../../../../../lib/explorer/municipalLabels";
import { formatAmount } from "../../../../../lib/explorer/format";

const SOURCE_NOTE_BASE =
  "მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). " +
  "რეგიონის ჯამი მხოლოდ საჯაროდ მოწოდებულ მუნიციპალურ ბიუჯეტებს აერთიანებს: " +
  "აჭარის ავტონომიური რესპუბლიკის საკუთარი ბიუჯეტი მასში არ შედის, ხოლო შიდა ქართლსა და " +
  "მცხეთა-მთიანეთს ოკუპირებულ ტერიტორიებთან დაკავშირებული ერთეულები აკლია.";

// The 11 region ids are the complete, closed set.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { regions } = await loadServedMunicipalData();
  return regions.map((region) => ({ id: region.id.replace("region.", "") }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { regions, totalFacts } = await loadServedMunicipalData();
  const region = regions.find((row) => row.id === `region.${id}`);
  if (!region) return {};

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const title = `${region.kaLabel} — მუნიციპალიტეტები — GeoData`;
  const description = `${REGION_GENITIVE_KA[region.id] ?? region.kaLabel} მუნიციპალური ბიუჯეტები ფუნქციების მიხედვით, ${years[0]}–${years.at(-1)}.`;

  return {
    title,
    description,
    alternates: { canonical: `/explorer/municipalities/region/${id}` },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: `/explorer/municipalities/region/${id}`,
      title,
      description,
    },
  };
}

export default async function RegionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const regionId = `region.${id}`;
  const { municipalities, regions, functions, functionFacts, totalFacts } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const region = regions.find((row) => row.id === regionId);
  if (!region) notFound();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((row) => [row.id, row.kaLabel]));

  const listInput = { municipalities, regionLabels, totalFacts, year: latestYear };
  const list = buildMunicipalListRows(listInput);
  const rank = list.regions.find((row) => row.id === regionId)?.rank ?? 0;
  const nationalTotalLatest = list.municipalities.reduce((sum, row) => sum + row.valueGel, 0);

  const members = regionFactsFor(regionId, municipalities, functionFacts, totalFacts);
  // Collapse the members' rows into one entity's on the SERVER, so this page
  // ships ~110 function rows like a municipality page rather than up to 12×.
  const own = aggregateFactsForEntity(regionId, members.functionFacts, members.totalFacts);

  const memberRows = list.municipalities
    .filter((row) => row.regionId === regionId)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  const ordered = regions.slice().sort((left, right) => left.sortOrder - right.sortOrder);
  const index = ordered.findIndex((row) => row.id === regionId);
  const prev = ordered[(index - 1 + ordered.length) % ordered.length]!;
  const next = ordered[(index + 1) % ordered.length]!;
  const hrefFor = (target: { id: string }) => `/explorer/municipalities/region/${target.id.replace("region.", "")}`;

  const lastUpdatedAt = sourceDocuments.map((source) => source.lastReviewedAt).sort().at(-1) ?? "";

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
            { label: region.kaLabel },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />

        <MunicipalExplorer
          title="როგორ იხარჯება"
          triggerLabel={`${REGION_GENITIVE_KA[regionId] ?? region.kaLabel} მუნიციპალური ბიუჯეტები`}
          entityId={regionId}
          metaLine={`${members.memberCodes.length} მუნიციპალიტეტი · ${georgianOrdinal(rank)} ადგილი ${regions.length}-დან`}
          functions={functions}
          functionFacts={own.functionFacts}
          totalFacts={own.totalFacts}
          sourceDocuments={sourceDocuments}
          nationalTotalLatest={nationalTotalLatest}
          rank={rank}
          rankOutOf={regions.length}
          csvBasename={`region-${id}`}
          pickerGroups={buildPickerGroups(listInput)}
          prev={{ label: prev.kaLabel, href: hrefFor(prev) }}
          next={{ label: next.kaLabel, href: hrefFor(next) }}
          sourceNote={`${SOURCE_NOTE_BASE}${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        >
          <div className="mt-11 border-t-2 border-[var(--ink)] pt-[22px]">
            <h2 className="mb-3.5 font-[family-name:var(--font-display)] text-[22px] font-semibold">
              რეგიონის მუნიციპალიტეტები
            </h2>
            {memberRows.map((member) => (
              <a
                key={member.id}
                href={`/explorer/municipalities/${member.id}`}
                data-testid="region-member-row"
                className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--hairline-soft)] py-2 text-[var(--ink)] no-underline hover:bg-[var(--tint)]"
              >
                <span className="font-[family-name:var(--font-numeric)] text-[11px] text-[var(--faint)]">
                  {String(member.rank).padStart(2, "0")}
                </span>
                <span className="truncate text-[12.5px]">{member.nameKa}</span>
                <span className="font-[family-name:var(--font-numeric)] text-[11.5px]">{formatAmount(member.valueGel)}</span>
              </a>
            ))}
          </div>
        </MunicipalExplorer>
      </div>
    </main>
  );
}
```

Count the `../` segments carefully — this route is one level deeper than the
municipality route, so imports take five, not four.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 3: Verify in the browser**

Navigate to `/explorer/municipalities/region/imereti` and confirm: 12 member rows, the roll-up chart renders, and the source note names the აჭარა and შიდა ქართლი caveats.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/explorer/municipalities/region
git commit -m "feat: add region roll-up pages"
```

---

### Task 13: Navigation flip and hub card 03

**Files:**
- Modify: `apps/web/lib/explorer/sections.ts`, `apps/web/lib/explorer/hubCards.ts`, `apps/web/app/explorer/page.tsx`, `apps/web/app/sitemap.ts`
- Test: `apps/web/tests/explorer/hubCards.test.ts`

**Interfaces:**
- Consumes: `MunicipalTotalFact` (Task 5's imports).
- Produces: `buildHubCards(facts: ServedBudgetFact[], municipalTotals: Map<number, number>): HubCardModel[]`.

- [ ] **Step 1: Write the failing test**

In `apps/web/tests/explorer/hubCards.test.ts`, add a municipal totals fixture and a new case:

```ts
const MUNICIPAL_TOTALS = new Map([
  [2015, 2_034_000_000],
  [2025, 5_625_000_000],
]);

it("makes card 03 a live destination once municipal data is routed", () => {
  const card = buildHubCards(FACTS, MUNICIPAL_TOTALS)[2]!;
  expect(card.href).toBe("/explorer/municipalities");
  expect(card.comingSoon).toBe(false);
  expect(card.series).not.toBeNull();
  expect(card.footer).toBe("2025 · 5.62 მლრდ ₾");
});
```

Update every other `buildHubCards(FACTS)` call in the file to `buildHubCards(FACTS, MUNICIPAL_TOTALS)`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/explorer/hubCards.test.ts`
Expected: FAIL — `buildHubCards` takes one argument, and card 03 has `href: null`.

- [ ] **Step 3: Flip the section**

In `apps/web/lib/explorer/sections.ts`, line 15:

```ts
  municipalities: { label: "მუნიციპალიტეტები", href: "/explorer/municipalities" },
```

The sidebar row and the hub card both read this, so both go live from this one edit — `section-nav.tsx` already branches on a null href.

- [ ] **Step 4: Give card 03 its graphic**

In `apps/web/lib/explorer/hubCards.ts`, change the signature and card 03:

```ts
export function buildHubCards(
  facts: ServedBudgetFact[],
  municipalTotals: Map<number, number>,
): HubCardModel[] {
```

and replace the card-03 object with:

```ts
    {
      index: "03",
      title: BUDGET_SECTIONS.municipalities.label,
      description: "64 მუნიციპალიტეტი და 11 რეგიონი — რაში იხარჯება ადგილობრივი ბიუჯეტები.",
      href: BUDGET_SECTIONS.municipalities.href,
      comingSoon: BUDGET_SECTIONS.municipalities.href === null,
      series: municipal.series,
      // ink, not accent: the sparkline traces a side total, and DESIGN.md §4.2
      // gives every total series ink. #B3402A is a category token.
      seriesColor: municipal.series === null ? null : INK,
      footer: municipal.footer,
    },
```

Add `const municipal = build(municipalTotals);` next to the existing `spend` / `revenues` lines.

- [ ] **Step 5: Update the hub route**

In `apps/web/app/explorer/page.tsx`, load municipal totals and pass them:

```ts
import { loadServedMunicipalData } from "../../lib/data/servedData";
...
const { totalFacts } = await loadServedMunicipalData();
const municipalTotals = new Map<number, number>();
for (const row of totalFacts) {
  municipalTotals.set(row.year, (municipalTotals.get(row.year) ?? 0) + row.publicTotalGel);
}
const cards = buildHubCards(facts, municipalTotals);
```

- [ ] **Step 6: Add the routes to the sitemap**

In `apps/web/app/sitemap.ts`, append the index, the 64 municipality URLs and the 11 region URLs, derived from `loadServedMunicipalData()` — never hardcoded.

- [ ] **Step 7: Run tests**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/lib/explorer/sections.ts apps/web/lib/explorer/hubCards.ts apps/web/app/explorer/page.tsx apps/web/app/sitemap.ts apps/web/tests/explorer/hubCards.test.ts
git commit -m "feat: route the municipalities section from the sidebar and hub"
```

---

### Task 14: Browser tests and documentation

**Files:**
- Create: `apps/web/tests/browser/municipalities.spec.ts`
- Modify: `DESIGN.md`, `AGENTS.md`, `docs/data-methodology/municipal-functional-annual-2015-2025.md`

- [ ] **Step 1: Write the browser spec**

Create `apps/web/tests/browser/municipalities.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.describe("municipalities index", () => {
  test("renders the region map with an explicit no-data shape", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await expect(page.getByTestId("region-map")).toBeVisible();
    await expect(page.locator("[data-testid^='region-shape-']")).toHaveCount(12);
    await expect(page.getByTestId("region-shape-GE-AB")).toHaveAttribute("data-no-data", "true");
    await expect(page.locator("[data-testid^='self-gov-city-']")).toHaveCount(5);
  });

  test("lists all municipalities and switches grain", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(64);
    await page.getByTestId("level-region").click();
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(11);
    await expect(page).toHaveURL(/#lvl=region/);
  });

  test("filters and clears the search", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await page.getByTestId("municipal-search").fill("თელავი");
    await expect(page.getByTestId("municipal-list-row")).toHaveCount(1);
    await page.getByTestId("municipal-search").fill("ზზზზ");
    await expect(page.getByTestId("municipal-empty")).toBeVisible();
  });

  test("opens a municipality from the list", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await page.getByTestId("municipal-list-row").first().click();
    await expect(page).toHaveURL(/\/explorer\/municipalities\/04$/);
  });

  test("shows four KPIs", async ({ page }) => {
    await page.goto("/explorer/municipalities");
    await expect(page.getByTestId("index-kpi")).toHaveCount(4);
  });
});

test.describe("municipality page", () => {
  test("switches between chart and table", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    await page.getByTestId("municipal-mode-table").click();
    await expect(page.getByTestId("explorer-table")).toBeVisible();
    // The regression this guards: in billions every municipal cell reads 0.00.
    await expect(page.getByTestId("explorer-table")).not.toContainText("0.00");
  });

  test("renders every selected series without a cap", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    const rows = page.getByTestId("municipal-series-row");
    for (let index = 0; index < 11; index += 1) {
      const row = rows.nth(index);
      if ((await row.getAttribute("aria-pressed")) === "false") await row.click();
    }
    await expect(page.locator("[data-testid='editorial-line-chart'] path[data-series]")).toHaveCount(11);
  });

  test("does not render a reconciliation callout", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    await expect(page.getByTestId("municipal-source-note")).toBeVisible();
  });

  test("opens the entity picker with the keyboard", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    await page.keyboard.press("Control+k");
    await expect(page.getByTestId("entity-picker")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("entity-picker")).toHaveCount(0);
  });

  test("keeps the picker popover out of the heading", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    await page.keyboard.press("Control+k");
    // A role="dialog" inside an h1 is announced as part of the heading.
    await expect(page.locator("h1 [data-testid='entity-picker']")).toHaveCount(0);
    await expect(page.locator("h1 [data-testid='entity-picker-trigger']")).toHaveCount(1);
  });

  test("pins the total under search and selects every row globally from empty", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    const bulk = page.getByTestId("municipal-series-all");
    await bulk.click();
    await expect(page.locator("[data-testid='municipal-series-row'][aria-pressed='true']")).toHaveCount(0);

    await page.getByTestId("municipal-series-search").fill("განათლება");
    await expect(page.getByTestId("municipal-series-row")).toHaveCount(2);
    await expect(page.getByTestId("municipal-series-row").first()).toContainText("მთლიანი ბიუჯეტი");

    await bulk.click();
    await page.getByTestId("municipal-series-search").fill("");
    await expect(page.getByTestId("municipal-series-row")).toHaveCount(11);
    await expect(page.locator("[data-testid='municipal-series-row'][aria-pressed='true']")).toHaveCount(11);
    await expect(bulk).toHaveAttribute("aria-pressed", "true");
  });

  test("offers a CSV download", async ({ page }) => {
    await page.goto("/explorer/municipalities/04");
    const download = page.waitForEvent("download");
    await page.getByTestId("municipal-csv").click();
    expect((await download).suggestedFilename()).toMatch(/^geodata-municipality-04-\d{4}-\d{4}\.csv$/);
  });

  test("recomputes the period comparison when the range moves", async ({ page }) => {
    // The regression this guards: filtering years without rebuilding the model,
    // so ცვლილება and the comparison table describe the full span while the
    // chart describes the selection.
    await page.goto("/explorer/municipalities/04");
    const before = await page.getByTestId("comparison-table").innerText();
    await page.goto("/explorer/municipalities/04#m=line&r=2020-2025&sel=municipal.education");
    await page.reload();
    const after = await page.getByTestId("comparison-table").innerText();
    expect(after).not.toBe(before);
  });
});

test.describe("region page", () => {
  test("lists its member municipalities and carries the roll-up caveats", async ({ page }) => {
    await page.goto("/explorer/municipalities/region/imereti");
    await expect(page.getByTestId("region-member-row")).toHaveCount(12);
    await expect(page.getByTestId("municipal-source-note").first()).toContainText("აჭარის ავტონომიური რესპუბლიკის");
  });
});

test.describe("shell", () => {
  test("municipalities is a live section", async ({ page }) => {
    await page.goto("/explorer");
    await expect(page.getByTestId("section-link-municipalities")).toBeVisible();
    const card = page.getByTestId("hub-card").nth(2);
    await expect(card).not.toContainText("მალე");
  });
});
```

Before relying on `22` as თელავი's code, confirm it:

```bash
grep "თელავი" ../../data/imports/municipalities.csv
```

Use whatever code that prints. If თელავი's code is not `22`, update both places in the spec.

- [ ] **Step 2: Run the browser tests**

Run: `npm run test:browser -- tests/browser/municipalities.spec.ts`
Expected: PASS, 11 tests.

- [ ] **Step 3: Run the full browser suite**

Run: `npm run test:browser`
Expected: PASS. This catches any regression in the landing hero (Task 1) or the budget explorer (Task 2).

- [ ] **Step 4: Update the docs**

`DESIGN.md`:
- §6.2, add the three routes to the IA block and drop `მალე` from the municipalities entry.
- §6.7, hub-card table: card 03 gains `total municipal series, Sparkline at 200×34 in ink`, footer `{latestYear} · {total}`, links to `/explorer/municipalities`. Delete the paragraph describing card 03 as not-a-link.
- §6.7, sidebar: `მუნიციპალიტეტები` is now an ordinary section link; only the four indicator teasers keep `მალე`.
- Add a new section specifying the municipal surfaces: the region-grain map and why (no openly-licensed ADM2 geometry matches the 64-unit registry), the one public official total with internal reconciliation, and the `მლნ ₾` unit.

`AGENTS.md`, Current Project State: change "served for 2015-2025 … as **data only** … no route reads the data, and the `მალე` marker stays" to record that the section is routed at `/explorer/municipalities`, with a region-grain map, and that a municipality-level ADM2 map remains a future spec.

`docs/data-methodology/municipal-functional-annual-2015-2025.md`: add a section for the region shape join — source (geoBoundaries gbOpen GEO ADM1, release `9469f09`, CC BY 3.0), the join key (`shapeISO`, never `shapeName`), the full 12-row table, and the rule that every shape resolves to a region or to a stated no-data reason.

- [ ] **Step 5: Full verification**

Run: `npm run check`
Expected: PASS.

Run: `npm run build`
Expected: PASS, with 76 municipal routes in the prerender list.

Run: `GEODATA_DATA_SOURCE=db npm run build`
Expected: PASS with parity verified. Skip only if `apps/web/.env` is absent, and say so in the commit.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tests/browser/municipalities.spec.ts DESIGN.md AGENTS.md docs/data-methodology/municipal-functional-annual-2015-2025.md
git commit -m "test: add municipalities browser coverage and update the docs"
```

---

## Definition of Done

1. `npm run check` green.
2. `npm run build` green, 76 municipal routes prerendered.
3. `GEODATA_DATA_SOURCE=db npm run build` green.
4. `npm run test:browser` green — the whole suite, not just the new spec.
5. `DESIGN.md`, `AGENTS.md` and the methodology doc updated in the same change.
6. CI green before merge.
