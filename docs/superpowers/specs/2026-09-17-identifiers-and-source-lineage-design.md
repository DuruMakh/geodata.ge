# Identifiers and source lineage for debt and deficit: specification

Date: 2026-09-17
Status: Implementation authorized for inline execution on 2026-09-19. Scope and packaging were approved in conversation on 2026-09-17, after a reviewed audit of the work merged 2026-09-02..09-14.
Baseline: `main` at `c7451ceaf`. Line numbers refer to that commit. Paths are under `apps/web/` unless they start with `data/`, `docs/` or name a root document.
Series: audit remediation, spec 4 of 8. No dependency on the other specs. This is a data change, so the methodology documents change with it (CLAUDE.md definition of done, item 3).

## 1. Outcome and scope

1. The deficit series has one stable ID in the explorer, the query service, labels and publications.
2. Debt facts use the same `source.*` IDs as the source registry and every other dataset. Source lineage lives in the data layer, not in UI code, and the mirror enforces it with a foreign key and an import check.
3. The debt stock total is checked against the published total, as the published transformation text already claims.
4. The debt and deficit mirror tables get the same access revocation as every later table, and the migration runbook stops omitting it.

### 1.1 User-approved decisions (2026-09-17)

- Packaging only.

### 1.2 Decisions taken in this spec

- **Deficit ID.** The surviving ID is `deficit.general_government.balance`. It is already published by `/mcp` and the JSON publications and approved in `2026-09-04-debt-and-deficit-over-mcp-design.md:41`. The 20+ intent reference fixture pins it (`tests/factQuery/fixtures/referenceIntents.ts:754`), and changing that fixture's expectations is a stop condition. The explorer moves; old explorer links keep working through an alias.
- **Debt source IDs.** Debt facts carry registry IDs (`source.mof_*`). The debt source rows already exist in `data/sources/source-documents.csv:111-115`, so no registry change is needed.
- **Existing migrations.** Applied migrations are never renamed. The duplicate `20260912000000_*` timestamp is documented, not rewritten.

## 2. One deficit series ID

Evidence:

- The explorer uses `deficit.general_government_balance` (`lib/explorer/deficitExplorer.ts:7`, `lib/pages/deficit.tsx:36`, hash writer `lib/explorer/deficitUrlState.ts:49`). The query service uses `deficit.general_government.balance` (`lib/factQuery/types.ts:293`).
- Both modules export a constant named `DEFICIT_SERIES_ID`.
- Both IDs carry English labels (`data/localization/en/labels.json:826`, `:830`), and `lib/i18n/inventory.server.ts:49` requires both.
- A third English label is the explorer fallback (`deficitExplorer.ts:12`).
- A hash carrying the query-service ID is silently ignored (`deficitUrlState.ts:29`), hidden by the explorer's `selected = true` default (`components/deficit/deficit-explorer.tsx:44`).

Change:

- `lib/explorer/deficitExplorer.ts` imports `DEFICIT_SERIES_ID` from `lib/factQuery/types.ts` and exports no constant of its own. `DEFICIT_ITEM.id` uses it, and so does `lib/pages/deficit.tsx:36`.
- `parseDeficitHash` accepts both IDs in `sel`; `serializeDeficitHash` writes the dotted one.
- Delete the underscore label (`labels.json:826`) and its inventory entry (`inventory.server.ts:49`).
- Delete the fallback English label (`deficitExplorer.ts:12`) if every render path passes a presentation. If one does not, the fallback reads the catalogue label instead of a literal.

Tests to update:

- `tests/explorer/deficitExplorer.test.ts:24`
- `tests/explorer/deficitUrlState.test.ts:12`, plus a new alias case
- `tests/explorer/deficitRoute.test.tsx:47`
- `tests/browser/deficit.spec.ts:20-21`, `:44`
- `tests/browser/bilingual-debt-deficit.spec.ts:41-42`, `:129`

The reference fixture must pass unchanged.

## 3. Debt source IDs and lineage

### 3.1 Evidence

- **Bare IDs.** `data/imports/government-debt-facts-2013-2030.csv` stores bare `source_id` values (`mof_monthly_debt_report_2026_07`, `mof_debt_strategy_2019_2021`, …), and `not_available` rates have an empty one. The registry and every other dataset use `source.*`.
- **Three translations.** `lib/factQuery/queryDebt.ts:88-90` (`registrySourceId`), `lib/factQuery/getSources.ts:192`, and the UI table in `lib/explorer/debtWorkbook.ts`:
  - `SOURCE_FILENAME_BY_ID` (`:33-43`)
  - `externalServiceSourceId(year)` (`:45-51`), which attributes actual service years to public debt bulletins N7/N13/N19/N25
  - the reviewed rate sources added for `not_available` rates (`:66-68`)
  - matching workbook sources with `downloadHref.includes(filename)` (`:79-85`), which mismatches once a bulletin `n1` or `n2` sits beside `n13` or `n25`
- **No foreign key.** `GovernmentDebtFact` (`prisma/schema.prisma:197`) has no `SourceDocument` relation. `GeneralGovernmentBalanceFact` does (`:215-224`).
- **No import check.** `scripts/import-budget-facts.ts` asserts source subsets for sectors, GDP overview, national GDP and inflation (`:242-252`, `:288`), but not debt.

### 3.2 Change

1. **Registry IDs at prepare time.** The debt package generator writes `source.`-prefixed IDs, and the canonical CSV is regenerated. Only the `source_id` column may change; the regeneration diff must show no other column change.
2. **Lineage module.** Move the lineage rules from `debtWorkbook.ts` into `lib/data/governmentDebt/sourceLineage.ts`, with `sourcesForDebtFact(fact): string[]` returning registry IDs. It returns:
   - the fact's own source
   - for actual service facts, the external-service bulletin for that year
   - for `not_available` rates, the reviewed rate sources

   The bulletin year ranges stay exactly as they are today.
3. **Workbook matching.** `debtWorkbook.ts` uses `sourcesForDebtFact` and matches archive rows by registry `sourceId`, not filename substrings. If the workbook source rows passed by `lib/pages/debt.tsx` do not carry `sourceId`, add it in that projection from the reviewed manifest.
4. **Query service.** Delete `registrySourceId` and the inline translation in `getSources.ts:192`; both read the fact's `sourceId` directly.
5. **Mirror.** Add a source-document relation on the existing nullable `GovernmentDebtFact.sourceId`, following the source-registry relationship used by `GeneralGovernmentBalanceFact`. The migration is `prisma/migrations/20260917000000_government_debt_source_document/migration.sql`: existing-ID normalization, foreign key and index. The debt mirror reader and parity key keep comparing the full served row.
6. **Import check.** `scripts/import-budget-facts.ts` adds `assertSubset("Government Debt fact source IDs", nonEmptyDebtSourceIds, sourceIds)`.

### 3.3 Acceptance

- **Workbook sources unchanged.** Before refactoring, capture a golden test, `tests/explorer/debtWorkbook.test.ts`: the source sheet (document titles and years) for stock, service and rate over full coverage, plus one partial range. The same assertions pass after the change.
- **MCP output unchanged.** Debt responses already show `source.*` IDs through the translation. The reference fixture passes unchanged.
- **One published change.** The public CSV `government-debt.csv` (`lib/data/publicDatasetExports.ts:156-170`) now shows `source.`-prefixed IDs. Record this in `docs/data-methodology/government-debt-annual.md`.

## 4. Debt stock total control

Evidence: every stock total row publishes the transformation "Exact sum of the published Domestic Government Debt and External Government Debt GEL components; the rounded published total is retained only as a validation control" (`lib/data/governmentDebt/parseDebtSources.ts:104-106`). No code parses or compares that published total. The domestic service has a control (`lib/data/governmentDebt/prepareGovernmentDebtPackage.ts`, domestic service section); external service has none.

Change:

- **Stock totals:** parse the published total row from the same table and require |exact sum − published total| ≤ half a unit of its last published digit, per year.
- **External service:** where the source table publishes a total for external service, apply the same rule. Where it does not, the validation report records "no published control" for those rows.
- **Reporting:** control results go into `docs/Raw Data/Debt/government-debt-annual/validation-report.json`. A failure stops the prepare step.

Values were checked by hand against the bulletins during the 2026-09-17 review and match, so the CSV must not change.

Tests: `tests/data/governmentDebt/*` gains cases where a component or published total is altered by more than the tolerance, and prepare fails with a message naming the year.

## 5. Mirror access and migration runbook

Evidence:

- `20260911000000_gdp_overview`, `20260912000000_economic_sectors`, `20260912000000_inflation_cpi` and `20260913000000_inflation_categories` each revoke table access, e.g. `REVOKE ALL ON TABLE "GdpOverviewFact" FROM anon, authenticated;`.
- `20260902000000_government_debt_fact` and `20260904000000_general_government_balance_fact` do not.
- RLS without policies already denies those roles, so the revoke is defence in depth.
- The runbook section on hand-written migrations (`docs/data-methodology/database-import.md:244-247`) mentions RLS but not the revoke.
- Two migration folders share the timestamp `20260912000000`.

Change:

- **New migration** `prisma/migrations/20260917000100_revoke_debt_deficit_mirror_access/migration.sql`:

  ```sql
  REVOKE ALL ON TABLE "GovernmentDebtFact" FROM anon, authenticated;
  REVOKE ALL ON TABLE "GeneralGovernmentBalanceFact" FROM anon, authenticated;
  ```

- **Runbook:** add a step after the RLS step: every new mirror table gets `REVOKE ALL ON TABLE "<Table>" FROM anon, authenticated;`, and every migration folder gets a unique timestamp. Note that the two existing `20260912000000_*` folders stay as applied.

## 6. Non-goals

- Changing any debt or deficit value, status or coverage.
- Changing which documents `get_sources` lists for debt. If planning shows that the external-service bulletins are missing from the query service's source listing, that is reported for a separate decision, because it changes query output.
- Renaming applied migrations.

## 7. Documents to update in the same change

- `docs/data-methodology/government-debt-annual.md`: registry-form source IDs, the lineage module, and the stock total control.
- `docs/data-methodology/general-government-balance.md`: the single series ID.
- `docs/data-methodology/database-import.md`: revoke step and unique timestamps.

## 8. Verification and acceptance

Feedback while editing:

```bash
npx vitest run tests/explorer/deficitExplorer.test.ts tests/explorer/deficitUrlState.test.ts tests/explorer/deficitRoute.test.tsx tests/explorer/debtWorkbook.test.ts tests/data/governmentDebt
```

```bash
npx vitest run tests/factQuery/reference.test.ts
```

Data: `npm run data:validate`. Rehearse the migration and a parity-checked import against a disposable database, as `docs/data-methodology/database-import.md` describes, before production.

Done-check: `npm run check`, `npm run build` and `npm run test:browser` on the production-build recipe.

Acceptance:

- `/explorer/deficit#sel=deficit.general_government_balance` still selects the series, and the page writes the dotted ID.
- `labels.json` holds one deficit label.
- The debt CSV differs only in `source_id`.
- Debt workbook source sheets match the golden test.
- The mirror enforces the debt foreign key, and the import rejects an unknown debt source ID.
- Prepare fails on a stock total mismatch.
- Both older tables have access revoked.

## 9. Authority and next step

This spec owns the bounded decisions in §1. The methodology documents stay the owners of data behaviour and are updated in the same change. After user review, the next step is an implementation plan at `docs/superpowers/plans/2026-09-17-identifiers-and-source-lineage.md`.
