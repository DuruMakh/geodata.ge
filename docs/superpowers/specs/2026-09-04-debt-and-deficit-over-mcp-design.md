# Debt and Deficit over MCP — Design

**Status:** approved design, not yet implemented
**Date:** 2026-09-04
**Owner:** fiscal.ge AI query core

## Goal

Serve two datasets the site already publishes — government debt and the general
government balance — through the `/mcp` endpoint, so that the AI connection
covers what the explorer covers.

Today `/connect` tells a visitor that public debt is **not** included. That was
true of the endpoint and is now confusing: `/explorer/debt` ships on `main`, and
`/explorer/deficit` is on `codex/general-government-deficit-data`. A visitor sees
debt and deficit charts on the site and reads that the AI connection does not
have them.

## What gets served

### Government debt — 9 series, 3 families

| family | series | value kind | years |
|---|---|---|---|
| stock | `debt.stock.total`, `.domestic`, `.external` | GEL | 2013–2025, all actual |
| service | `debt.service.total`, `.principal`, `.interest` | GEL | 2013–2025 actual, 2026–2030 projection |
| rate | `debt.rate.total`, `.domestic`, `.external` | percent p.a. | 2015–2025, with documented gaps |

Rate coverage is uneven by design, not by omission: `debt.rate.total` is complete
for 2015–2025, `.domestic` has actual values for 2018–2024, `.external` for
2021–2024. The remaining year/scope cells carry `not_available` because no
reviewed source published a rate for them.

Publisher: Ministry of Finance of Georgia. Boundary: central government
liabilities.

### General government balance — 1 series

| series | measures | years |
|---|---|---|
| `deficit.general_government.balance` | `share_of_gdp_pct` and `amount_gel`, both published | 1995–2025 actual, 2026–2031 projection |

Both measures are present in the reviewed row, so neither is derived here.

Publisher: IMF, World Economic Outlook, April 2026 vintage. Boundary: general
government. **Values are signed**: a negative value is a deficit.

## Value model changes

Two additive changes to `lib/factQuery/types.ts`. No existing value changes
meaning, and nothing already served moves.

### 1. `basis` gains `"projection"`

The core models a value as `basis: "actual" | "planned"`. Both debt service and
the balance carry a third status that is neither:

- Debt service 2026–2030 is a schedule of what the **existing portfolio** will
  cost. It is not a budget anyone approved.
- The balance 2026–2031 is an **IMF macroeconomic forecast**.

`planned` means a government-approved budget figure. Serving either of these as
`planned` would tell clients something untrue, which is the failure mode this
endpoint exists to prevent. Both source datasets already use the literal string
`projection` for their own status, so the name is taken from the data rather
than invented.

### 2. `Measure` gains `"rate_percent"`, unit `percent`

A weighted-average interest rate is a percent but is not a *share* of anything.
Reusing `share_of_gdp_pct` or `share_of_total_pct` would mislabel it. Valid only
on `debt.rate.*`; every other series rejects it with the existing invalid-measure
error.

The balance needs no new measure: its percent is a share of GDP, which
`share_of_gdp_pct` already means.

## Snapshot

`FactQuerySnapshot` gains:

```ts
debt: { facts: ServedGovernmentDebtFact[] };
deficit: { facts: GeneralGovernmentBalanceFact[] };
```

Both are the served shapes as they already exist; neither is re-modelled.
`buildSnapshot` reads the facts through the loaders that already exist
(`importGovernmentDebtFacts`, `importGeneralGovernmentBalance`) and the two
source manifests through the same helper that already reads the GDP manifest —
`docs/Raw Data/Debt/government-debt-annual/source-manifest.csv` and the IMF WEO
manifest have the same column shape it expects.

`DatasetId` gains `"government-debt"` and `"general-government-balance"`.

`dataVersion` will change. That is expected and correct: the snapshot's content
changes. It is the first change since this branch began.

## Tools

Two new tools, following the established one-tool-per-dataset shape
(`query_national`, `query_ministries`, `query_municipal`).

### `query_debt`

Inputs: `seriesIds` (the 9), `years`, `measure` (`amount_gel`,
`share_of_gdp_pct` for stock, `rate_percent` for rates).

### `query_deficit`

Inputs: `years`, `measure` (`share_of_gdp_pct`, `amount_gel`). No `seriesIds` —
there is exactly one series, and a required parameter with one legal value is
noise.

### Existing tools

- **`compare`** accepts both. Comparing 2013 to 2025 debt, or two balance years,
  is an obvious question and the compare machinery is dataset-agnostic.
- **`rank`** accepts neither. Both are country-level; there is nothing to rank.
  Requesting either returns the existing invalid-dataset error.
- **`describe_coverage`** gains both datasets, with their real year ranges.
- **`get_sources`** resolves their source ids like any other.

## Caveats

A new `lib/factQuery/caveats/rules.debt.ts` and `rules.deficit.ts`. Six codes,
taking the registry from 23 to 29.

| code | severity | fires when |
|---|---|---|
| `debt_service_projection` | severe | any served debt-service year is 2026–2030 |
| `deficit_projection` | severe | any served balance year is 2026 or later |
| `debt_not_budget_scope` | severe | any debt series is served |
| `deficit_general_government_scope` | severe | the balance is served |
| `debt_rate_not_published` | note | a requested rate cell is `not_available` |
| `debt_gdp_share_vintage` | note | debt is served as `share_of_gdp_pct` |

Two projection codes rather than one shared code, because the *reason* differs
and a reader needs the reason: a debt-service projection is a schedule of
existing obligations, while a balance projection is an IMF forecast of an
economy. One message cannot say both truthfully.

`debt_not_budget_scope` and `deficit_general_government_scope` are the siblings
of the existing `budget_scopes_differ`. The predictable error is a client
subtracting national expenditure from national receipts, comparing the result to
the published balance, finding a different number, and inventing an explanation.
Each caveat states its own boundary: central government liabilities for debt,
general government per the IMF for the balance, and neither is the difference
between the two national series served here.

`debt_gdp_share_vintage` exists because the debt package's own validation report
records `possible_gdp_vintage_difference` — a share computed from the GDP facts
in this snapshot can differ from the Ministry's published share. A note, not a
severe: the number is right for the denominator used, and the caveat names the
denominator.

## Server instructions

`lib/mcp/instructions.ts` gains, under a new `DEBT AND FISCAL BALANCE` section:

- What each dataset is and who publishes it.
- **The sign rule.** A negative balance is a deficit and a positive one a
  surplus. Report the sign. Dropping it turns a deficit into a surplus, which is
  the worst available error in this data.
- **The boundary rule.** Debt is central government liabilities; the balance is
  general government as measured by the IMF; neither is derivable from the
  receipts and expenditure series served here, and none of the three may be
  added to or subtracted from the others.
- **The projection rule.** Years marked `projection` are not recorded outcomes.
  Say so whenever one appears in an answer.

## Surfaces that must move with it

- `/connect`: drop `სახელმწიფო ვალი` from *not served*; add debt and the balance
  to *served* with their year ranges, derived from the catalogue as the existing
  four already are.
- `public/llms.txt`: the tool list gains `query_debt` and `query_deficit`; the
  coverage paragraph gains both datasets.
- `docs/data-methodology/ai-grounding-and-caveats.md`: document the six new
  codes and update the registry count. A test asserts the doc matches the
  registry, so this is enforced rather than remembered.
- `docs/deployment.md`: no change — no new environment variable or limit.

## Publications

Both datasets gain a JSON publication under `/downloads/data/`, generated from
the snapshot like the existing four, and listed in `manifest.json`.

This also removes a special case introduced during the main merge: the
methodology page's JSON-publication map has an empty entry for `debt`, and
`MethodologyArticle` skips its JSON line when the list is empty. Once debt has a
publication, the entry is populated. The empty-list guard stays — it is correct
behaviour for any future dataset without a JSON twin.

## Out of scope

- The four debt validation/control artefacts (overlap comparisons, control-year
  checks, rate checks). They are review evidence, not published facts.
- Sub-annual debt data. The monthly report is a source; only its annual figures
  are served.
- Ranking either dataset.
- Any change to how the four existing datasets behave.

## Testing

- Unit tests per layer: snapshot build, both query functions, both rule files.
- Caveat engine count test moves 23 → 29.
- `describe_coverage` asserts both new datasets with their real ranges.
- The 20-intent reference fixture gains intents that exercise: a debt stock
  year, a debt-service projection year, a rate gap, and a balance year — each
  asserting the expected caveat codes. A disagreement there is a stop condition,
  per `CLAUDE.md` definition of done item 4.
- `/connect` browser test asserts debt and the balance appear in the served
  column and no longer in the excluded column.
- `npm run check` and `npm run build` green; `npm run test:browser` for the
  `/connect` change.

## Sequencing and risk

The balance dataset lives on `codex/general-government-deficit-data`, which is
unmerged, unpushed, and still changing — it gained an explorer commit during
this design session. The owner has chosen to implement both together, merging
that branch into this one.

The accepted risk: if that branch is revised before it reaches `main`, the
deficit portion of this work is reworked. The debt portion is insulated, because
debt is already on `main`.
