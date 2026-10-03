# MCP: accurate city coverage dates

Date: 2026-10-01
Status: accepted for implementation planning by the user's 2026-10-01 request to write the unified implementation plan. This document is not an implementation or release claim.
Baseline: `1c2a0acd07f0fa522bf4f6aab33924b319cc2112`, the fetched main commit and live release identity observed during the audit.

## 1. Outcome

An assistant asking about one city's inflation must receive availability dates that describe the city and requested measure. Correct values, missing cells and coverage descriptions must agree.

The live audit reproduced two inconsistencies:

- Batumi headline annual inflation for August 2026 correctly returned 7.0857%, but `coverage.availablePeriods` began at `2004-01`. The catalogue correctly places city history from 2016.
- A June 2016 request for Zugdidi's 12-month average correctly returned a missing value and explained its `2017-12` start, but the response's available range began at `2002-01`.

The cause is `queryInflation.ts` using `measurePeriodRange`, which reads national/category coverage, for city requests. This is a description problem, not evidence that the numeric city observations are wrong.

## 2. Scope and chosen approach

Keep the existing `query_inflation` inputs, response shapes and missing-value behavior. Calculate city-inclusive request coverage from the existing snapshot facts. No new endpoint, configurable coverage table, historical data edits or database changes.

Two approaches were considered: attach another per-city coverage structure to every response, or correct the existing coverage fields. Correcting the fields is the minimum sufficient change. The existing observations and missing-cell reasons already explain individual gaps and later starts.

Work primarily belongs in `lib/factQuery/queryInflation.ts`, the existing inflation coverage helpers, and the relevant query, reference and MCP tests. Only adjust instructions where the meaning of the aggregate span needs clarification.

## 3. Required behavior

1. For a request containing cities, derive `availablePeriods` from available facts for the requested entities, series and measure across their complete reviewed history, not just the requested output window.
2. The range is the union's earliest and latest available month. It describes a span, not a promise that every intervening month or every selected series has data. Missing cells retain their bilingual reasons.
3. `availableYears` lists calendar years represented by those available facts. It must not advertise national-only years in a city-only response.
4. A mixed country/city request uses the union of the selected country and city coverage. An earlier national start in that mixed response is legitimate; city observations still preserve their own missingness.
5. For city facts, annual change, monthly change and the 12-month average each use their actual observed months. Zugdidi's later starts must remain visible without hardcoded dates.
6. Preserve existing national-only behavior, including how the target and contribution requests report missing months before their valid inputs begin. Do not widen this fix into a redesign of all dataset coverage.
7. Preserve the current acceptance window and error behavior: a city month inside the existing dataset window but before city publication returns missing, rather than becoming an invented zero or an unexplained refusal. Dates outside that window retain `year_out_of_range`.
8. If a supported city/series/measure combination has no available facts, return `availablePeriods: null`, `availableYears: []`, and the existing missing-cell explanations. Do not borrow another entity's dates.

All bounds come from facts marked available. A missing source cell must not establish an availability boundary. No numeric values, sources, definitions, caveats or existing exclusions change. This correction does not introduce a new public field; the data schema remains 1.4.0 unless delivered together with the product extension's 1.5.0 schema.

## 4. Verification

- Batumi-only headline annual query: correct value and city-derived coverage start.
- Zugdidi annual and average queries: actual measure-specific starts, including a missing month before each start.
- Multiple cities: correct union of available months and years.
- Country plus city: national coverage can extend the union, without filling city gaps.
- A missing interior month, and a synthetic supported selection with no available cells: correct missingness and boundaries.
- Existing national headline, target, weights and contribution cases retain their behavior.
- A transported MCP call preserves these fields in structured content and its text explanation. Add a reviewed reference case; do not silently change existing numeric fixture expectations.

Run focused query/MCP/reference tests while editing. Completion requires the repository's `npm run check`, `npm run build`, and `tests/factQuery/reference.test.ts` gates. A future release additionally verifies the same city queries on production and the matching release/data identities, following `docs/deployment.md`.

## 5. Related work and approval

Related specifications: [client compatibility](2026-10-01-mcp-client-compatibility-design.md), [documentation](2026-10-01-mcp-documentation-design.md), and [product inflation](2026-10-01-mcp-inflation-products-design.md).

This fix is useful independently of protocol migration and product access. Review this written specification before implementation planning; publishing follows separate delivery authorization.
