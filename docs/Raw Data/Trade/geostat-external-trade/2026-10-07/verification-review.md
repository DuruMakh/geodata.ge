# Trade research verification and review

This report concerns the annual research foundation approved on 7 October 2026. Source acceptance remains held; extraction fidelity and internal agreement of the publisher's tables are separate results.

## Data evidence

- All 45 archived source fingerprints match, including the 31 original Geostat workbooks.
- The separate openpyxl reader matches all 364,495 source observations, all 364,461 primary observations and all 3,473 reviewed derived values across 466 source/year blocks. Its maximum monetary reader-conversion difference is USD 0.000001, within the USD 0.001 reader tolerance. Native-to-USD conversions remain exact.
- Generated artifacts reproduce byte for byte. The independent report records its input fingerprints and reader fingerprint; preparation rejects stale evidence.
- The final focused suite passes 39 tests. Its deliberate corruptions cover source bytes, omissions, duplicate keys, leading zeroes, labels, units, values, missingness, unsupported matches, stale artifacts and source acceptance holds.
- The strict source-acceptance command returns 2 for the two unresolved UK service-import comparisons. The reconciliation report retains 59,166 passes, 3,220 unavailable comparisons, 82 historical code-allocation exceptions and two failures.

Full evidence is in `independent-verification.json`, `prepared-validation.json`, `prepared-reconciliation.csv`, `artifact-manifest.csv`, `source-review.md` and `unresolved-source-issues.json`.

## Fresh final review

A separate reviewer examined the whole research branch from its `ba44dcff` base, including the final preparation files. The review independently checked all original-source fingerprints and all 58 generated-artifact fingerprints. It found no material incorrect value or misleading acceptance claim.

The two reproducibility findings were addressed in one fix pass:

1. Tests create their temporary parent directory on a clean checkout. `FreshCheckoutTests.test_checks_create_their_temporary_parent` failed before the fix and passed afterward.
2. The source-precision test uses the archived filename's exact capitalization. `FreshCheckoutTests.test_source_precision_check_uses_case_sensitive_filename` failed under a simulated case-sensitive lookup before the fix and passed afterward.

The second finding was raised from Minor to Important because it breaks the documented test command on a case-sensitive checkout. Both regression tests and the complete 39-test suite pass. No review finding is deferred.

The reviewer did not choose a preferred UK publisher value, infer undeclared historical classification causes, or approve product integration. Both UK representations and the native historical allocations remain preserved. No publisher contact, public integration or deployment was authorized.

## Local repository verification

The standard four-worker `npm run check` was attempted twice. Lint and type checking passed; existing publication tests exceeded their time budgets when run together. The three initially affected suites pass all 50 tests with one worker. The failed combined runs are not represented as passing.

The long single-worker run was interrupted when its tool session and process disappeared, before a final summary. It is not counted as passing. The complete unchanged suite subsequently passed with four workers and a 120-second CLI test/hook allowance: **350 files passed, one file skipped; 3,026 tests passed and seven skipped**, exit 0, in 493.42 seconds. Command: `npx vitest run --configLoader native --maxWorkers=4 --testTimeout=120000 --hookTimeout=120000 --reporter=dot`. No test assertion, production code or permanent timeout setting was changed. This is a local timing exception, not a passing result for the original combined command.

The separately completed `npm run data:validate`, `npm run i18n:check` and `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build` all return 0. Build postchecks verify the existing publication fingerprints. Lint and type checking passed in the standard check attempts. Browser tests are outside this change because it introduces no UI behavior.

The research code and extraction are verified locally. Overall source acceptance is still held for the two UK discrepancies. Publishing, source acceptance and the standard CI gate remain separate decisions.
