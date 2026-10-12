# Task 1 report — accepted annual services types

Status: DONE
Baseline: `8546eee3`, branch `codex/trade-services`, checkout `C:/Users/Mylaptop/.codex/worktrees/d51c/Geodata.ge`.

## Result

Added the bounded services preparation, canonical validation and loading family. The accepted package contains thirteen identities and 258 facts: 130 source observations (129 numeric and the one published dash) and 128 derived numerical facts. National facts number twenty and service-type facts 238, covering 2020–2024 only. Total exports in 2024 are exactly `7706284984.7599976` USD. Maintenance/repair exports in 2020 retain null USD, native `-`, and `not_applicable`; its unsupported turnover and balance facts are absent.

The preparer verifies the selected original bytes against `full-source-manifest.json`, frozen input fingerprints, annual layouts, worksheet cells and stored decimal tokens, source observation and coverage inventories, and all ten independently reviewed numerical type sums. All monetary arithmetic uses Decimal precision 50. Derivations use the same identity/year and ordered export/import references. The two unchanged UK country-table failures remain outside this independently accepted scope, with their complete evidence copied and fingerprint-bound in the accepted report.

The canonical loader reads only the accepted CSV/catalogue/report and translation registry. Validation checks catalogue and fact fields, complete keys/statuses, native-cell references and conversions, counterpart identities/order/arithmetic, counts, and canonical/catalogue/scoped-English fingerprints. The every-field parity helper preserves nulls and native provenance while normalizing database decimal padding. The report binds only the thirteen English labels; unrelated translation additions do not change its fingerprint. Preparation and raw workbook parsing are absent from the serving loader's import graph.

## RED/GREEN evidence

Commands run from `apps/web`. Vitest commands set `TEMP` and `TMP` to the controller-approved workspace directory `.tmp/services-test-temp`.

- RED: `npx vitest run tests/data/tradeServices/prepareTradeServices.test.ts tests/data/tradeServices/validation.test.ts` — exit 1, both suites failed because the services preparation module did not exist. No production services implementation existed at that point.
- First GREEN: the same focused command — exit 0, 46/46 tests passed in 64.48 seconds.
- Expanded final preparer coverage: the same two-file command — preparer 21/21 passed; validation 26/27 passed. The single failing assertion incorrectly assumed this accepted package contains a numerical zero. Inspection confirmed that it contains negative balances but no zero observation. The assertion was replaced with an explicit synthetic parity test that distinguishes numerical zero from null; no source data or implementation was changed to satisfy it.
- Final validation GREEN: `npx vitest run tests/data/tradeServices/validation.test.ts` — exit 0, 28/28 passed in 3.71 seconds. Together with the final preparer result, current focused coverage is 49 passing checks across both files.
- `npx eslint lib/data/tradeServices scripts/prepare-trade-services.ts tests/data/tradeServices lib/i18n/inventory.server.ts` — exit 0.
- `npm run typecheck` — exit 0.
- `npm run data:prepare-trade-services` — exit 0.
- `npm run data:check-trade-services` — exit 0; deterministic CSV/catalogue/report bytes match.
- `git diff --check` — exit 0.
- BOM check: accepted CSV starts with `EFBBBF`; the automated deterministic-artifact regression also checks these three bytes.
- Research archive diff is empty. Original selected source hashes are `091845ddd121d21e43332cfcdf69008ec3d9444fae279fbe3c6002ba0d75fda3` (exports) and `100b9a901dffd1db6604aac7c0b46094e8e46ac425c2090d2d9e18e1141a01d6` (imports).

The mutation regressions use temporary copies of only required inputs. Semantic CSV mutations refresh the relevant independent artifact hash before attempting preparation, so they reach the source/identity checks. Coverage includes omission/duplicate/extra keys; changed identity, year, source, cell, role, unit, labels, formats and rounded values; dash replaced by zero; altered originals/inventory/stale fingerprints; a newly affected hold; swapped or reordered derivation references; every fact/catalogue parity field; accepted-file loading; missing report fingerprints; changed hold evidence; and unrelated English-label additions.

The existing Vite CommonJS/config-loader warning appeared during focused runs; controller confirmed it is baseline. It was left unchanged. npm's version notice was informational.

## Files changed

- New `apps/web/lib/data/tradeServices/types.ts` — public data interfaces, fact key, accepted identity/source/document bindings and input inventory.
- New `apps/web/lib/data/tradeServices/prepareTradeServices.ts` — bounded exact-decimal preparation and artifact write/check commands.
- New `apps/web/lib/data/tradeServices/validation.ts` — canonical/source/derivation/fingerprint validation and shared serialization.
- New `apps/web/lib/data/tradeServices/importTradeServices.ts` — canonical loader and every-field parity; no DB bridge before Task 2.
- New `apps/web/scripts/prepare-trade-services.ts`.
- New `apps/web/tests/data/tradeServices/prepareTradeServices.test.ts` and `validation.test.ts`.
- New `data/imports/trade-services-annual.csv`, `data/taxonomy/trade-services.json` and `data/reports/trade-services-validation.json`.
- Modified `apps/web/package.json` — prepare/check scripts and bounded check in `data:validate`.
- Modified `data/localization/en/labels.json` and `apps/web/lib/i18n/inventory.server.ts` — thirteen reviewed names and inventory registration.
- This task report.

## Self-review and boundaries

Reused `readVerifiedPackageFile`, `readTradeSourceWorksheet`, Decimal precision 50, `serializeBomCsvRows`, `assertGeneratedArtifactMatches`, and `assertSameServedRows`. No duplicate workbook reader, dependency, country acceptance, data scope expansion, `.gitignore` change, DB loader stub, live migration/import or publishing action was introduced. The accepted report is intentionally force-added because the repository ignores `data/reports` by default.

Native `sourceId` and `sourceBlock` are null for derived facts, as allowed by the requirements; `sourceRefs` always retains the exact ordered native counterparts. The controller confirmed this interface for subsequent mirror work.

No unresolved Task 1 concern. Full repository gates, UI/browser checks, methodology integration and offline mirror work belong to later tasks/controller verification and were not run or claimed here. The broader research package remains `requires_source_resolution`.
