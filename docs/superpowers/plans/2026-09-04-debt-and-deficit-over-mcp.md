# Debt and Deficit over MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve government debt (9 series) and the IMF general government balance (1 series) through `/mcp`, so the AI connection covers what the explorer covers.

**Architecture:** Two additive changes to the query core's value model — a `projection` basis and a `rate_percent` measure — carry both datasets. Each dataset gets its own snapshot slice, query function, caveat rule file and MCP tool, following the pattern the existing four datasets already establish. Nothing already served changes meaning.

**Tech Stack:** Next.js 16 App Router, strict TypeScript, Zod 4, Vitest 4.1.5, Playwright, `@modelcontextprotocol/sdk` 1.30.0.

**Spec:** `docs/superpowers/specs/2026-09-04-debt-and-deficit-over-mcp-design.md`

## Global Constraints

- Run every command from `apps/web`.
- **Never run `npm run data:import`, and never edit anything under `data/imports/`.** Those CSVs are the reviewed source of truth.
- **Never edit the Supabase database directly.**
- Do not push implementation commits directly to `main`.
- Georgian labels are display data; ids stay lowercase ASCII.
- Every caveat carries both `messageKa` and `messageEn`.
- `missing` is never `0`, and a missing cell is never estimated or interpolated.
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Definition of done (`CLAUDE.md`): `npm run check` and `npm run build` pass; the 20-intent reference fixture passes; a disagreement there is a **stop condition** — report it, do not edit the expectation to match the code.

---

## File Structure

**Create:**
- `apps/web/lib/factQuery/queryDebt.ts` — the debt query function
- `apps/web/lib/factQuery/queryDeficit.ts` — the balance query function
- `apps/web/lib/factQuery/caveats/rules.debt.ts` — 4 debt rules
- `apps/web/lib/factQuery/caveats/rules.deficit.ts` — 2 balance rules
- `apps/web/tests/factQuery/queryDebt.test.ts`
- `apps/web/tests/factQuery/queryDeficit.test.ts`
- `apps/web/tests/factQuery/caveats/debt.test.ts`
- `apps/web/tests/factQuery/caveats/deficit.test.ts`

**Modify:**
- `apps/web/lib/factQuery/types.ts` — `DatasetId`, `Measure`, `Basis`, `FactQuerySnapshot`
- `apps/web/lib/factQuery/buildSnapshot.ts` — read both fact sets and both source manifests
- `apps/web/lib/factQuery/schemas.ts` — two input schemas, `describeCoverageInput` enum
- `apps/web/lib/factQuery/caveats/engine.ts` — `CaveatContext.observations[].basis`
- `apps/web/lib/factQuery/caveats/index.ts` — register both rule sets
- `apps/web/lib/factQuery/describeCoverage.ts` — both datasets
- `apps/web/lib/factQuery/compare.ts` — dispatch to both
- `apps/web/lib/factQuery/rank.ts` — reject both
- `apps/web/lib/factQuery/publications.ts` — two JSON publications
- `apps/web/lib/mcp/tools.ts` — `query_debt`, `query_deficit`
- `apps/web/lib/mcp/instructions.ts` — `DEBT AND FISCAL BALANCE` section
- `apps/web/app/connect/page.tsx` — served / not-served lists
- `apps/web/app/methodology/[dataset]/page.tsx` — populate the `debt` JSON map entry
- `apps/web/public/llms.txt`
- `docs/data-methodology/ai-grounding-and-caveats.md`
- `apps/web/tests/factQuery/fixtures/referenceIntents.ts`

---

### Task 0: Bring the deficit branch onto this branch

The balance dataset lives on `codex/general-government-deficit-data`, which is unmerged and unpushed. Every later task that touches the balance depends on this.

**Files:**
- Modify: whatever the merge brings; resolve conflicts only.

**Interfaces:**
- Produces: `GeneralGovernmentBalanceFact` from `apps/web/lib/data/generalGovernmentBalance/types.ts`, and `loadServedGeneralGovernmentBalanceData()` from `apps/web/lib/data/generalGovernmentBalance/importGeneralGovernmentBalance.ts`.

- [ ] **Step 1: Confirm the branch still says what the spec assumed**

```bash
git log --oneline origin/main..codex/general-government-deficit-data
git show codex/general-government-deficit-data:apps/web/lib/data/generalGovernmentBalance/types.ts | head -35
```

Expected: `GeneralGovernmentBalanceStatus = "actual" | "projection"` and a `GeneralGovernmentBalanceFact` carrying `generalGovernmentBalancePctGdp`, `generalGovernmentBalanceGel`, `status`, `sourceId`.

**If either has changed, STOP and report it.** The spec's claim that deficit costs no new concept rests on that exact shape.

- [ ] **Step 2: Merge**

```bash
git merge --no-ff codex/general-government-deficit-data
```

- [ ] **Step 3: Resolve conflicts, then verify**

Expect conflicts in `apps/web/package.json` (script list) and `apps/web/tests/seo/routes.test.ts` (route count — `/explorer/deficit` adds one, taking 90 to 91). Resolve both as unions, exactly as the `origin/main` merge did.

```bash
npm install
npm run check
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Merge codex/general-government-deficit-data

Brings in the IMF WEO general government balance dataset and its
explorer, so the query core can serve it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 1: Value model and snapshot

**Files:**
- Modify: `apps/web/lib/factQuery/types.ts`
- Modify: `apps/web/lib/factQuery/buildSnapshot.ts`
- Modify: `apps/web/lib/factQuery/caveats/engine.ts`
- Test: `apps/web/tests/factQuery/buildSnapshot.test.ts`

**Interfaces:**
- Consumes: `ServedGovernmentDebtFact` from `apps/web/lib/servedRows.ts`; `GeneralGovernmentBalanceFact` from Task 0.
- Produces: `snapshot.debt.facts: ServedGovernmentDebtFact[]`, `snapshot.deficit.facts: GeneralGovernmentBalanceFact[]`, `DatasetId` values `"government-debt"` and `"general-government-balance"`, `Measure` value `"rate_percent"`, and the `"projection"` basis.

- [ ] **Step 1: Write the failing test**

Add to `apps/web/tests/factQuery/buildSnapshot.test.ts`:

```ts
it("carries the debt and balance facts", () => {
  const snapshot = loadPackagedSnapshot();

  // 9 series x their own year spans; the count is pinned so a silent data
  // loss in the build shows up here rather than as a thin answer later.
  expect(snapshot.debt.facts.length).toBeGreaterThan(0);
  expect(new Set(snapshot.debt.facts.map((f) => f.seriesId))).toEqual(
    new Set([
      "debt.stock.total", "debt.stock.domestic", "debt.stock.external",
      "debt.service.total", "debt.service.principal", "debt.service.interest",
      "debt.rate.total", "debt.rate.domestic", "debt.rate.external",
    ]),
  );

  // Projections exist and start after the last actual year.
  const service = snapshot.debt.facts.filter((f) => f.family === "service");
  const lastActual = Math.max(...service.filter((f) => f.status === "actual").map((f) => f.year));
  const firstProjection = Math.min(
    ...service.filter((f) => f.status === "projection_existing_portfolio").map((f) => f.year),
  );
  expect(firstProjection).toBe(lastActual + 1);

  expect(snapshot.deficit.facts).toHaveLength(37);
  expect(snapshot.deficit.facts.filter((f) => f.status === "projection")).toHaveLength(6);
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/buildSnapshot.test.ts
```

Expected: FAIL — `snapshot.debt` is undefined.

- [ ] **Step 3: Extend the types**

In `apps/web/lib/factQuery/types.ts`:

```ts
export type DatasetId =
  | "national-revenue"
  | "national-expenditure"
  | "ministries"
  | "municipal-expenditure"
  | "government-debt"
  | "general-government-balance";

// rate_percent is a rate per annum, NOT a share of anything. Reusing
// share_of_gdp_pct or share_of_total_pct for it would mislabel the number.
export type Measure =
  | "amount_gel"
  | "share_of_total_pct"
  | "share_of_gdp_pct"
  | "gel_per_resident"
  | "rate_percent";

/**
 * `planned` means a budget a government approved. `projection` means neither
 * an outcome nor a plan: a schedule of what the EXISTING debt portfolio will
 * cost (debt service 2026-2030), or an IMF forecast of the economy (the
 * balance 2026-2031). Both source datasets already use the literal string
 * "projection" for their own status, so this name is taken from the data.
 */
export type Basis = "actual" | "planned" | "projection";
```

Add to `FactQuerySnapshot`, after `municipal`:

```ts
  debt: { facts: ServedGovernmentDebtFact[] };
  deficit: { facts: GeneralGovernmentBalanceFact[] };
```

Replace every `basis: "actual" | "planned" | null` in this file with `basis: Basis | null`.

- [ ] **Step 4: Widen the caveat context**

In `apps/web/lib/factQuery/caveats/engine.ts`, in `CaveatContext.observations`:

```ts
    basis: Basis | null;
```

Import `Basis` from `../types`.

- [ ] **Step 5: Read both fact sets in the snapshot build**

In `apps/web/lib/factQuery/buildSnapshot.ts`, beside the existing GDP manifest constant:

```ts
const DEBT_SOURCE_MANIFEST_RELATIVE_PATH = ["docs", "Raw Data", "Debt", "government-debt-annual"] as const;
const BALANCE_SOURCE_MANIFEST_RELATIVE_PATH = ["data", "sources", "imf-weo-general-government-balance"] as const;
```

Load both manifests through the same helper the GDP manifest already uses (the function that reads `source-manifest.csv` from a directory), and load the facts through the existing loaders:

```ts
const [debtFacts, balanceFacts] = await Promise.all([
  loadServedGovernmentDebtData(),
  loadServedGeneralGovernmentBalanceData(),
]);
```

Add to the returned snapshot object:

```ts
  debt: { facts: sortedBy(debtFacts, (f) => `${f.year}:${f.seriesId}`) },
  deficit: { facts: sortedBy(balanceFacts, (f) => f.year) },
```

- [ ] **Step 6: Regenerate the snapshot and run the test**

```bash
npm run data:prepare-fact-query-snapshot
npx vitest run tests/factQuery/buildSnapshot.test.ts
```

Expected: PASS. The printed `dataVersion` will differ from `3f4b6f9c…` — that is correct and expected; the snapshot's content changed.

- [ ] **Step 7: Run the whole suite to find what the widened types broke**

```bash
npm run typecheck && npx vitest run
```

Any `switch` on `DatasetId` or `Measure` that is now non-exhaustive fails here. Fix each by rejecting the new values explicitly rather than by adding a default branch — a silent default is how a debt id ends up in a national code path.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(factQuery): carry debt and balance facts in the snapshot

Adds a projection basis and a rate_percent measure, both additive: no
existing value changes meaning.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `queryDebt`

**Files:**
- Create: `apps/web/lib/factQuery/queryDebt.ts`
- Modify: `apps/web/lib/factQuery/schemas.ts`
- Test: `apps/web/tests/factQuery/queryDebt.test.ts`

**Interfaces:**
- Consumes: `snapshot.debt.facts` (Task 1).
- Produces: `queryDebt(snapshot: FactQuerySnapshot, rawInput: unknown, comparison?: CaveatContext["comparison"]): FactQueryResponse` and `queryDebtInput` (Zod).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { queryDebt } from "../../lib/factQuery/queryDebt";

const snapshot = loadPackagedSnapshot();

describe("queryDebt", () => {
  it("serves a stock year in GEL with an actual basis", () => {
    const response = queryDebt(snapshot, {
      seriesIds: ["debt.stock.total"], years: [2024], measure: "amount_gel",
    });

    expect(response.kind).toBe("data");
    const cell = response.data.observations[0];
    expect(cell.datasetId).toBe("government-debt");
    expect(cell.unit).toBe("GEL");
    expect(cell.basis).toBe("actual");
    expect(cell.value).toBeGreaterThan(0);
  });

  it("marks a 2027 service year as a projection rather than as planned", () => {
    const response = queryDebt(snapshot, {
      seriesIds: ["debt.service.total"], years: [2027], measure: "amount_gel",
    });

    expect(response.data.observations[0].basis).toBe("projection");
  });

  it("returns a rate as percent, and an unpublished rate year as missing not zero", () => {
    const response = queryDebt(snapshot, {
      seriesIds: ["debt.rate.external"], years: [2016, 2024], measure: "rate_percent",
    });

    const byYear = new Map(response.data.observations.map((o) => [o.year, o]));
    expect(byYear.get(2024)!.unit).toBe("percent");
    expect(byYear.get(2024)!.value).toBeGreaterThan(0);
    expect(byYear.get(2016)!.availability).toBe("missing");
    expect(byYear.get(2016)!.value).toBeNull();
  });

  it("rejects rate_percent on a stock series", () => {
    const response = queryDebt(snapshot, {
      seriesIds: ["debt.stock.total"], years: [2024], measure: "rate_percent",
    });

    expect(response.kind).toBe("error");
    expect(response.error.code).toBe("invalid_parameters");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/queryDebt.test.ts
```

Expected: FAIL — cannot resolve `../../lib/factQuery/queryDebt`.

- [ ] **Step 3: Add the input schema**

In `apps/web/lib/factQuery/schemas.ts`:

```ts
export const debtMeasure = z.enum(["amount_gel", "share_of_gdp_pct", "rate_percent"]);

export const queryDebtInput = z.object({
  seriesIds: seriesIdList,
  years: uniqueSortedYears,
  measure: debtMeasure,
  expectedDataVersion,
});
```

- [ ] **Step 4: Implement `queryDebt`**

Model it on `queryNational.ts`. The rules that differ:

- `entityId` is `"country.georgia"`, `entityType` `"country"`, `entityLabelKa` `"საქართველო"` — debt is country-level.
- `budgetScope` is `"central_government_liabilities"` for stock and service, so no reader can mistake it for a budget boundary.
- `basis` maps `"actual"` → `"actual"`, `"projection_existing_portfolio"` → `"projection"`, `"not_available"` → `null`.
- `availability` is `"missing"` when the fact's `value` is `null`, with `missingReason` = `"ამ წლისთვის განაკვეთი გადამოწმებულ წყაროში გამოქვეყნებული არ არის — ეს ნულოვან მნიშვნელობას არ ნიშნავს."`
- Measure validation is per family, and rejecting it is an `invalid_parameters` error, not a silent empty result:

```ts
const family = (seriesId: string) => seriesId.split(".")[1] as "stock" | "service" | "rate";

const MEASURE_BY_FAMILY = {
  stock: new Set(["amount_gel", "share_of_gdp_pct"]),
  service: new Set(["amount_gel", "share_of_gdp_pct"]),
  rate: new Set(["rate_percent"]),
} as const;
```

- `share_of_gdp_pct` divides by the same-year GDP fact already in the snapshot, reusing the GDP-denominator-missing path `queryNational` uses.
- `unit` is `"GEL"` for `amount_gel` and `"percent"` for both `share_of_gdp_pct` and `rate_percent`.
- `valueDefinitionId` is `` `${seriesId}:${measure}` `` so `compare` can detect a definition change.

- [ ] **Step 5: Run the test**

```bash
npx vitest run tests/factQuery/queryDebt.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(factQuery): add queryDebt

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `queryDeficit`

**Files:**
- Create: `apps/web/lib/factQuery/queryDeficit.ts`
- Modify: `apps/web/lib/factQuery/schemas.ts`
- Test: `apps/web/tests/factQuery/queryDeficit.test.ts`

**Interfaces:**
- Consumes: `snapshot.deficit.facts` (Task 1).
- Produces: `queryDeficit(snapshot, rawInput, comparison?)` and `queryDeficitInput`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { queryDeficit } from "../../lib/factQuery/queryDeficit";

const snapshot = loadPackagedSnapshot();

describe("queryDeficit", () => {
  it("keeps the sign: a deficit year is negative, not an absolute value", () => {
    const response = queryDeficit(snapshot, { years: [2020], measure: "share_of_gdp_pct" });
    const cell = response.data.observations[0];

    expect(cell.value).toBeLessThan(0);
    expect(cell.unit).toBe("percent");
    expect(cell.basis).toBe("actual");
  });

  it("marks 2028 as a projection", () => {
    const response = queryDeficit(snapshot, { years: [2028], measure: "share_of_gdp_pct" });

    expect(response.data.observations[0].basis).toBe("projection");
  });

  it("serves the published GEL amount rather than deriving one", () => {
    const response = queryDeficit(snapshot, { years: [2020], measure: "amount_gel" });
    const cell = response.data.observations[0];

    expect(cell.unit).toBe("GEL");
    expect(cell.value).toBe(
      snapshot.deficit.facts.find((f) => f.year === 2020)!.generalGovernmentBalanceGel,
    );
  });

  it("covers years the other datasets do not", () => {
    const response = queryDeficit(snapshot, { years: [1995], measure: "share_of_gdp_pct" });

    expect(response.kind).toBe("data");
    expect(response.data.observations[0].value).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/queryDeficit.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Add the input schema**

```ts
export const deficitMeasure = z.enum(["share_of_gdp_pct", "amount_gel"]);

// No seriesIds: there is exactly one series, and a required parameter with a
// single legal value is noise for the caller.
export const queryDeficitInput = z.object({
  years: uniqueSortedYears,
  measure: deficitMeasure,
  expectedDataVersion,
});
```

- [ ] **Step 4: Implement `queryDeficit`**

Same shape as Task 2, with:

- `seriesId` `"deficit.general_government.balance"`, `seriesLabelKa` `"ზოგადი მთავრობის ბალანსი"`.
- `budgetScope` `"general_government_imf"`.
- `basis` maps `"actual"` → `"actual"`, `"projection"` → `"projection"`.
- **Both measures come from the reviewed row** — `generalGovernmentBalancePctGdp` and `generalGovernmentBalanceGel`. Neither is derived, and neither is re-signed: pass the value through exactly as stored.
- `valueDefinition` (Georgian) states the sign convention: `"უარყოფითი მნიშვნელობა დეფიციტია, დადებითი — პროფიციტი."`

- [ ] **Step 5: Run the test**

```bash
npx vitest run tests/factQuery/queryDeficit.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(factQuery): add queryDeficit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Debt caveats

**Files:**
- Create: `apps/web/lib/factQuery/caveats/rules.debt.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/debt.test.ts`

**Interfaces:**
- Consumes: `CaveatRule`, `CaveatContext` from `./engine`.
- Produces: `DEBT_CAVEAT_RULES: readonly CaveatRule[]` with codes `debt_service_projection`, `debt_not_budget_scope`, `debt_rate_not_published`, `debt_gdp_share_vintage`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { DEBT_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.debt";
import { evaluateCaveats } from "../../../lib/factQuery/caveats/engine";

function context(overrides: Partial<Parameters<typeof evaluateCaveats>[0]>) {
  return {
    datasetId: "government-debt" as const,
    measure: "amount_gel" as const,
    years: [2024],
    seriesIds: ["debt.stock.total"],
    entityIds: ["country.georgia"],
    observations: [],
    municipalTotalInputs: [],
    comparison: null,
    ...overrides,
  } as Parameters<typeof evaluateCaveats>[0];
}

const codes = (c: Parameters<typeof evaluateCaveats>[0]) =>
  evaluateCaveats(c, DEBT_CAVEAT_RULES).map((caveat) => caveat.code);

describe("debt caveats", () => {
  it("always states the boundary, because subtracting debt from a budget is the predictable error", () => {
    expect(codes(context({}))).toContain("debt_not_budget_scope");
  });

  it("flags a projection year as severe", () => {
    const result = evaluateCaveats(
      context({
        seriesIds: ["debt.service.total"],
        observations: [{ entityId: "country.georgia", seriesId: "debt.service.total", level: "total",
          parentSeriesId: null, year: 2027, value: 1, basis: "projection",
          valueDefinitionId: "debt.service.total:amount_gel" }],
      }),
      DEBT_CAVEAT_RULES,
    );
    const projection = result.find((caveat) => caveat.code === "debt_service_projection");

    expect(projection?.severity).toBe("severe");
    expect(projection?.affects).toContain("debt.service.total:2027");
  });

  it("does not flag a projection when every served year is actual", () => {
    expect(
      codes(context({
        observations: [{ entityId: "country.georgia", seriesId: "debt.stock.total", level: "total",
          parentSeriesId: null, year: 2024, value: 1, basis: "actual",
          valueDefinitionId: "debt.stock.total:amount_gel" }],
      })),
    ).not.toContain("debt_service_projection");
  });

  it("explains an unpublished rate rather than leaving it bare", () => {
    expect(
      codes(context({
        measure: "rate_percent", seriesIds: ["debt.rate.external"],
        observations: [{ entityId: "country.georgia", seriesId: "debt.rate.external", level: "total",
          parentSeriesId: null, year: 2016, value: null, basis: null,
          valueDefinitionId: "debt.rate.external:rate_percent" }],
      })),
    ).toContain("debt_rate_not_published");
  });

  it("names the GDP denominator only when a share was asked for", () => {
    expect(codes(context({ measure: "share_of_gdp_pct" }))).toContain("debt_gdp_share_vintage");
    expect(codes(context({ measure: "amount_gel" }))).not.toContain("debt_gdp_share_vintage");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/caveats/debt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the rules**

```ts
// apps/web/lib/factQuery/caveats/rules.debt.ts
import type { CaveatRule } from "./engine";

export const DEBT_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "debt_not_budget_scope",
    severity: "severe",
    comparisonEffect: "none",
    messageKa:
      "სახელმწიფო ვალი ცენტრალური მთავრობის ვალდებულებაა და ბიუჯეტის მაჩვენებელი არ არის: მას ხარჯებს ვერ დაუმატებთ და შემოსავლებს ვერ გამოაკლებთ.",
    messageEn:
      "Government debt is a central-government liability, not a budget figure: it cannot be added to expenditure or subtracted from receipts.",
    methodologyRef: "ai-grounding-and-caveats.md#debt_not_budget_scope",
    // Unconditional for this dataset. The error it prevents does not depend on
    // which series or year was asked for - it depends on debt being in the
    // answer at all, next to budget figures the client may already hold.
    applies: () => true,
    affects: (c) => c.seriesIds,
  },
  {
    code: "debt_service_projection",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKa:
      "მომავალი წლების მომსახურება პროგნოზია — არსებული პორტფელის გადახდის გრაფიკი, და არა დაფიქსირებული შედეგი.",
    messageEn:
      "Future-year debt service is a projection - the existing portfolio's payment schedule, not a recorded outcome.",
    methodologyRef: "ai-grounding-and-caveats.md#debt_service_projection",
    applies: (c) => c.observations.some((o) => o.basis === "projection"),
    affects: (c) =>
      c.observations.filter((o) => o.basis === "projection").map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "debt_rate_not_published",
    severity: "note",
    comparisonEffect: "limits",
    messageKa:
      "ამ წლებისთვის საპროცენტო განაკვეთი გადამოწმებულ წყაროებში გამოქვეყნებული არ არის — მონაცემი აკლია, ნულოვანი არ არის.",
    messageEn:
      "No reviewed source published an interest rate for these years - the value is missing, not zero.",
    methodologyRef: "ai-grounding-and-caveats.md#debt_rate_not_published",
    applies: (c) => c.measure === "rate_percent" && c.observations.some((o) => o.value === null),
    affects: (c) => c.observations.filter((o) => o.value === null).map((o) => `${o.seriesId}:${o.year}`),
  },
  {
    code: "debt_gdp_share_vintage",
    severity: "note",
    comparisonEffect: "none",
    messageKa:
      "მშპ-ში წილი გამოთვლილია ამ სერვისის მშპ-ის მაჩვენებლით; ფინანსთა სამინისტროს გამოქვეყნებული წილი სხვა ვინტაჟის მშპ-ს იყენებდეს და ოდნავ განსხვავდებოდეს.",
    messageEn:
      "The GDP share is computed with this service's GDP figures; the Ministry's published share may use a different GDP vintage and differ slightly.",
    methodologyRef: "ai-grounding-and-caveats.md#debt_gdp_share_vintage",
    applies: (c) => c.measure === "share_of_gdp_pct",
    affects: (c) => c.seriesIds,
  },
];
```

- [ ] **Step 4: Register them**

In `apps/web/lib/factQuery/caveats/index.ts`, import `DEBT_CAVEAT_RULES` and add it to the `CAVEAT_RULES` array.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run tests/factQuery/caveats/
```

Expected: the debt tests PASS; `engine.test.ts`'s registry-count test FAILS at 23 vs 27. Update that count to 27 and its comment to name the four new codes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(factQuery): add the debt caveat rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Deficit caveats

**Files:**
- Create: `apps/web/lib/factQuery/caveats/rules.deficit.ts`
- Modify: `apps/web/lib/factQuery/caveats/index.ts`
- Test: `apps/web/tests/factQuery/caveats/deficit.test.ts`

**Interfaces:**
- Produces: `DEFICIT_CAVEAT_RULES` with codes `deficit_general_government_scope`, `deficit_projection`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { DEFICIT_CAVEAT_RULES } from "../../../lib/factQuery/caveats/rules.deficit";
import { evaluateCaveats } from "../../../lib/factQuery/caveats/engine";

function context(years: number[], basis: "actual" | "projection") {
  return {
    datasetId: "general-government-balance" as const,
    measure: "share_of_gdp_pct" as const,
    years,
    seriesIds: ["deficit.general_government.balance"],
    entityIds: ["country.georgia"],
    observations: years.map((year) => ({
      entityId: "country.georgia", seriesId: "deficit.general_government.balance",
      level: "total", parentSeriesId: null, year, value: -2, basis,
      valueDefinitionId: "deficit.general_government.balance:share_of_gdp_pct",
    })),
    municipalTotalInputs: [],
    comparison: null,
  } as Parameters<typeof evaluateCaveats>[0];
}

const codes = (c: Parameters<typeof evaluateCaveats>[0]) =>
  evaluateCaveats(c, DEFICIT_CAVEAT_RULES).map((caveat) => caveat.code);

describe("deficit caveats", () => {
  it("always states that this is general government, not the served budget series", () => {
    expect(codes(context([2020], "actual"))).toContain("deficit_general_government_scope");
  });

  it("flags an IMF forecast year as severe, separately from a debt projection", () => {
    const result = evaluateCaveats(context([2028], "projection"), DEFICIT_CAVEAT_RULES);
    const projection = result.find((caveat) => caveat.code === "deficit_projection");

    expect(projection?.severity).toBe("severe");
    // The message must say WHY it is a projection: an IMF forecast is not the
    // same kind of estimate as a debt-service schedule.
    expect(projection?.messageEn).toContain("IMF");
  });

  it("does not flag a recorded year", () => {
    expect(codes(context([2020], "actual"))).not.toContain("deficit_projection");
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run tests/factQuery/caveats/deficit.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the rules**

```ts
// apps/web/lib/factQuery/caveats/rules.deficit.ts
import type { CaveatRule } from "./engine";

export const DEFICIT_CAVEAT_RULES: readonly CaveatRule[] = [
  {
    code: "deficit_general_government_scope",
    severity: "severe",
    comparisonEffect: "none",
    messageKa:
      "ეს არის ზოგადი მთავრობის ბალანსი საერთაშორისო სავალუტო ფონდის გაზომვით — და არა აქ მოწოდებული შემოსავლებისა და ხარჯების სხვაობა. ამ ორის შედარება არაკორექტულია.",
    messageEn:
      "This is the general government balance as measured by the IMF - not the difference between the receipts and expenditure series served here. The two are not comparable.",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_general_government_scope",
    applies: () => true,
    affects: (c) => c.seriesIds,
  },
  {
    code: "deficit_projection",
    severity: "severe",
    comparisonEffect: "breaks",
    messageKa:
      "მომავალი წლების მაჩვენებელი საერთაშორისო სავალუტო ფონდის პროგნოზია და არა დაფიქსირებული შედეგი.",
    messageEn:
      "Future-year values are an IMF forecast, not a recorded outcome.",
    methodologyRef: "ai-grounding-and-caveats.md#deficit_projection",
    applies: (c) => c.observations.some((o) => o.basis === "projection"),
    affects: (c) =>
      c.observations.filter((o) => o.basis === "projection").map((o) => `${o.seriesId}:${o.year}`),
  },
];
```

- [ ] **Step 4: Register, then run**

Add `DEFICIT_CAVEAT_RULES` to `CAVEAT_RULES`, and update `engine.test.ts`'s count from 27 to 29.

```bash
npx vitest run tests/factQuery/caveats/
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(factQuery): add the deficit caveat rules

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Coverage, compare, rank

**Files:**
- Modify: `apps/web/lib/factQuery/describeCoverage.ts`
- Modify: `apps/web/lib/factQuery/schemas.ts`
- Modify: `apps/web/lib/factQuery/compare.ts`
- Modify: `apps/web/lib/factQuery/rank.ts`
- Test: `apps/web/tests/factQuery/describeCoverage.test.ts`, `apps/web/tests/factQuery/compare.test.ts`, `apps/web/tests/factQuery/rank.test.ts`

**Interfaces:**
- Consumes: `queryDebt` (Task 2), `queryDeficit` (Task 3).

- [ ] **Step 1: Write the failing tests**

```ts
// describeCoverage.test.ts
it("lists debt and the balance with their real ranges", () => {
  const response = describeCoverage(snapshot, {});
  const byId = new Map(response.data.datasets.map((d) => [d.datasetId, d]));

  expect(byId.get("government-debt")!.years).toEqual([2013, 2025]);
  expect(byId.get("general-government-balance")!.years).toEqual([1995, 2031]);
});

// compare.test.ts
it("compares two debt stock years", () => {
  const response = compare(snapshot, {
    target: { dataset: "debt", seriesIds: ["debt.stock.total"] },
    fromYear: 2015, toYear: 2024, measure: "amount_gel",
  });

  expect(response.kind).toBe("data");
  expect(response.data.comparisons[0].absoluteChange).not.toBeNull();
});

it("refuses to compare a recorded year with a projection", () => {
  const response = compare(snapshot, {
    target: { dataset: "debt", seriesIds: ["debt.service.total"] },
    fromYear: 2024, toYear: 2027, measure: "amount_gel",
  });

  expect(response.data.comparisons[0].comparability).toBe("not_comparable");
});

// rank.test.ts
it("refuses to rank country-level datasets", () => {
  for (const dataset of ["debt", "deficit"]) {
    const response = rank(snapshot, { dataset, seriesId: "debt.stock.total", year: 2024, measure: "amount_gel" });
    expect(response.kind).toBe("error");
  }
});
```

- [ ] **Step 2: Run them to confirm they fail**

```bash
npx vitest run tests/factQuery/describeCoverage.test.ts tests/factQuery/compare.test.ts tests/factQuery/rank.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

- `describeCoverageInput`'s `datasetId` enum gains both ids; `describeCoverage` builds a dataset entry for each from `snapshot.debt.facts` / `snapshot.deficit.facts`, listing the 9 debt series and the 1 balance series, with `years` as `[min, max]` of each fact set.
- `compare`'s `target.dataset` union gains `"debt"` and `"deficit"`, dispatching to `queryDebt` / `queryDeficit`. Because `debt_service_projection` and `deficit_projection` both carry `comparisonEffect: "breaks"`, the existing comparability machinery downgrades an actual-vs-projection comparison to `not_comparable` with no new code.
- `rank` rejects both with the existing invalid-dataset error path. Extend its error message to name the reason: these datasets have a single entity, so there is nothing to rank.

- [ ] **Step 4: Check that every new source id resolves**

Every response carries `meta.sources`, so a fact whose source id has no
manifest row would ship a citation-less number. Add to
`apps/web/tests/factQuery/sources.test.ts`:

```ts
it("resolves every debt and balance source id", () => {
  const factSourceIds = new Set([
    ...snapshot.debt.facts.map((f) => f.sourceId).filter((id): id is string => id !== null),
    ...snapshot.deficit.facts.map((f) => f.sourceId),
  ]);
  const resolved = new Set(snapshot.sources.map((source) => source.sourceId));

  for (const id of factSourceIds) expect(resolved).toContain(id);
});
```

Run it. If any id is unresolved, the manifest paths added in Task 1 Step 5 are
wrong — fix those rather than relaxing this test.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run tests/factQuery/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(factQuery): cover, compare and refuse to rank the new datasets

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: MCP tools and instructions

**Files:**
- Modify: `apps/web/lib/mcp/tools.ts`
- Modify: `apps/web/lib/mcp/instructions.ts`
- Test: `apps/web/tests/mcp/tools.test.ts`, `apps/web/tests/mcp/instructions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tools.test.ts
it("exposes query_debt and query_deficit", () => {
  const names = TOOLS.map((tool) => tool.name);

  expect(names).toContain("query_debt");
  expect(names).toContain("query_deficit");
});

// instructions.test.ts
it("states the sign convention and both boundaries", () => {
  const text = serverInstructions(coverage, { municipalities: 64, regions: 11 });

  expect(text).toContain("negative");
  expect(text).toContain("general government");
  expect(text).toContain("central government");
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/mcp/
```

Expected: FAIL.

- [ ] **Step 3: Register the tools**

```ts
  {
    name: "query_debt",
    title: "სახელმწიფო ვალი",
    describe: (coverage) =>
      `Annual Georgian government debt, ${coverage["government-debt"]}. Families: stock (how much ` +
      "debt exists), service (principal and interest paid) and rate (weighted-average interest " +
      "rate). Measures: amount_gel and share_of_gdp_pct for stock and service, rate_percent for " +
      "rates. This is CENTRAL GOVERNMENT LIABILITIES, not a budget figure: never add it to " +
      "expenditure or subtract it from receipts. Service years after the last actual year are " +
      "projections of the existing portfolio, not recorded outcomes.",
    schema: queryDebtInput,
    run: (snapshot, input) => queryDebt(snapshot, input),
  },
  {
    name: "query_deficit",
    title: "ზოგადი მთავრობის ბალანსი",
    describe: (coverage) =>
      `The general government balance as measured by the IMF, ${coverage["general-government-balance"]}. ` +
      "Measures: share_of_gdp_pct and amount_gel, both published by the source. VALUES ARE SIGNED: " +
      "a negative value is a deficit and a positive one a surplus - report the sign. This is a " +
      "different accounting boundary from the receipts and expenditure served here, and is NOT " +
      "their difference. Years after the last actual year are IMF forecasts.",
    schema: queryDeficitInput,
    run: (snapshot, input) => queryDeficit(snapshot, input),
  },
```

- [ ] **Step 4: Extend the instructions**

Add after `BUDGET BOUNDARIES` in `instructions.ts`:

```
DEBT AND FISCAL BALANCE
Two datasets sit outside the budget boundaries above, and neither may be
combined with them.
- Government debt is CENTRAL GOVERNMENT LIABILITIES, published by the Ministry
  of Finance. It is a stock of obligations, not spending. Do not add it to
  expenditure, subtract it from receipts, or present it as part of a budget.
- The general government balance is published by the IMF for GENERAL
  government, a wider boundary than either national series here. It is NOT the
  difference between the receipts and the expenditure this service serves, and
  presenting it as though it were is wrong.
- Balance values are SIGNED. A negative value is a deficit; a positive one is a
  surplus. Report the sign. Dropping it turns a deficit into a surplus.
- Years marked with basis "projection" are not recorded outcomes: debt service
  projections are the existing portfolio's payment schedule, and balance
  projections are an IMF forecast. Say which, and say that it is a projection,
  whenever one appears in an answer.
```

Also extend `WHAT IS SERVED` with both datasets and their ranges, and remove public debt from `WHAT IS NOT SERVED`.

- [ ] **Step 5: Run the tests**

```bash
npx vitest run tests/mcp/
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(mcp): expose query_debt and query_deficit

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Publications

**Files:**
- Modify: `apps/web/lib/factQuery/publications.ts`
- Modify: `apps/web/app/methodology/[dataset]/page.tsx`
- Test: `apps/web/tests/factQuery/publications.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it("publishes debt and the balance, and lists them in the manifest", () => {
  const files = buildPublications(snapshot);
  const names = files.map((file) => file.fileName);

  expect(names).toContain("government-debt.json");
  expect(names).toContain("general-government-balance.json");

  const manifest = JSON.parse(files.find((f) => f.fileName === "manifest.json")!.content);
  expect(manifest.files.map((f) => f.fileName)).toContain("government-debt.json");
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/factQuery/publications.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add both publications**

Follow the existing per-dataset publication builders. Each row carries its year, series id, value, unit, basis and source id — the same fields the query functions return, so the file and the endpoint cannot disagree.

- [ ] **Step 4: Populate the methodology map**

In `apps/web/app/methodology/[dataset]/page.tsx`, replace the empty `debt` entries added during the `main` merge:

```ts
  debt: [{ href: "/downloads/data/government-debt.json", labelKa: "სახელმწიფო ვალი" }],
```

and in `DATASET_JSON_DISTRIBUTIONS`:

```ts
  debt: ["/downloads/data/government-debt.json"],
```

Delete the now-stale comment above the `DATASET_JSON_DOWNLOADS` `debt` entry explaining why it was empty. **Keep** the empty-list guard in `MethodologyArticle` — it is correct for any future dataset without a JSON twin.

- [ ] **Step 5: Regenerate and verify**

```bash
npm run data:prepare-fact-query-publications
npm run data:check-fact-query-publications
npx vitest run tests/factQuery/publications.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(factQuery): publish debt and balance JSON

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Reference intents

The 20-intent fixture is the acceptance gate for the whole query core. **A disagreement here is a stop condition** — report it rather than editing the expectation.

**Files:**
- Modify: `apps/web/tests/factQuery/fixtures/referenceIntents.ts`
- Test: `apps/web/tests/factQuery/reference.test.ts`

- [ ] **Step 1: Read the four expected values out of the reviewed CSVs**

```bash
python - <<'PY'
import csv
rows = list(csv.DictReader(open("../../data/imports/government-debt-facts-2013-2030.csv", encoding="utf-8-sig")))
for want in [("debt.stock.total","2024"), ("debt.service.total","2027"), ("debt.rate.external","2016")]:
    hit = [r for r in rows if r["series_id"]==want[0] and r["year"]==want[1]]
    print(want, hit[0]["value"] if hit else "NO ROW", hit[0]["status"] if hit else "")
balance = list(csv.DictReader(open("../../data/imports/general-government-balance-annual-1995-2031.csv", encoding="utf-8-sig")))
print("balance 2020", [r for r in balance if r["year"]=="2020"][0])
PY
```

Record the printed values. **Use these, not what the engine returns** — the fixture's whole purpose is to check the engine against the reviewed data.

- [ ] **Step 2: Add four intents**

Append to the fixture, using the values from Step 1:

1. `debt-stock-2024` — `query_debt`, `debt.stock.total`, 2024, `amount_gel`. Required caveats: `debt_not_budget_scope`.
2. `debt-service-projection-2027` — `query_debt`, `debt.service.total`, 2027, `amount_gel`. Required caveats: `debt_not_budget_scope`, `debt_service_projection`.
3. `debt-rate-gap-2016` — `query_debt`, `debt.rate.external`, 2016, `rate_percent`. Expected cell value `null`. Required caveats: `debt_not_budget_scope`, `debt_rate_not_published`.
4. `deficit-2020` — `query_deficit`, 2020, `share_of_gdp_pct`. Expected value **negative**. Required caveats: `deficit_general_government_scope`.

- [ ] **Step 3: Run the fixture**

```bash
npx vitest run tests/factQuery/reference.test.ts
```

Expected: PASS, 24 intents. If any expected value disagrees with the engine, **stop and report** — do not adjust the fixture to match.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(factQuery): add debt and balance reference intents

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: `/connect`, llms.txt and the methodology doc

**Files:**
- Modify: `apps/web/app/connect/page.tsx`
- Modify: `apps/web/public/llms.txt`
- Modify: `docs/data-methodology/ai-grounding-and-caveats.md`
- Test: `apps/web/tests/browser/connect.spec.ts`, `apps/web/tests/seo/agentFiles.test.ts`

- [ ] **Step 1: Write the failing browser assertion**

In `connect.spec.ts`, inside the served/not-served test:

```ts
    // Debt and the balance are served now; the page must not still deny them.
    expect(await served.innerText()).toContain("ვალი");
    expect(await missing.innerText()).not.toContain("სახელმწიფო ვალი");
```

- [ ] **Step 2: Run to confirm failure**

```bash
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/connect.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Update the page**

In `apps/web/app/connect/page.tsx`, remove `"სახელმწიფო ვალი"` from `NOT_SERVED`, and add two served lines beside the existing four, using the catalogue-derived ranges (never hardcoded):

```tsx
                  <li>სახელმწიფო ვალი — {ranges["government-debt"]}</li>
                  <li>ზოგადი მთავრობის ბალანსი (დეფიციტი) — {ranges["general-government-balance"]}</li>
```

- [ ] **Step 4: Update llms.txt**

In the `## AI connection` section, change "seven read-only tools" to "nine read-only tools" and add `query_debt` and `query_deficit` to the list. Add both datasets to the coverage paragraph.

- [ ] **Step 5: Document the six caveat codes**

In `docs/data-methodology/ai-grounding-and-caveats.md`, change the registry count from 23 to 29, add a table row per new code with its severity and comparison effect, and add a section per code matching the anchors used in each rule's `methodologyRef`. A test asserts the doc matches the registry, so a missing row fails the suite.

- [ ] **Step 6: Run the gates**

```bash
npm run check
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx playwright test tests/browser/connect.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(connect): serve debt and the balance through the AI connection

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Full verification

- [ ] **Step 1: Run every gate**

```bash
npm run check
npm run build
CI=1 NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run test:browser
```

Expected: all PASS. Record the new `dataVersion` from the build output.

- [ ] **Step 2: Exercise the deployed preview end to end**

After pushing, call the preview's `/mcp` with `describe_coverage`, then one `query_debt` projection year and one `query_deficit` year, and confirm the severe caveats come back in the response. Local tests cannot prove the 3.4 MB snapshot ships correctly in the deployed bundle; only this can.

- [ ] **Step 3: Report**

State the final test counts, the new `dataVersion`, and the live verification result.
