# Homepage annual masthead removal report

## Scope

Removed the complete annual masthead from the landing data ledger. The `#data`
anchor, top margin, scroll margin, and 2px ink rule remain. Expenditure is now
the first direct child under that rule, and only later dataset sections retain
their ordinary hairline top border.

## RED

Command (from `apps/web`):

```text
npm.cmd run test:browser -- tests/browser/landing.spec.ts
```

Result: failed as intended. The new assertion expected
`landing-data-header` to have count `0`; the old page returned `1`. The other
six landing browser tests passed.

## GREEN and focused checks

Commands (from `apps/web`):

```text
npm.cmd run test:browser -- tests/browser/landing.spec.ts
npm.cmd test -- tests/landing/landingData.test.ts
npm.cmd run typecheck
git diff --check
```

Results:

- browser: 7 passed;
- landing model: 1 file, 5 tests passed;
- TypeScript: passed with `tsc --noEmit`;
- whitespace validation: passed.

## Visual QA

Opened `http://localhost:3101/#data` and captured the data-ledger viewport at
1366×768, 390×844, and 320×844. The temporary captures were inspected at:
`apps/web/output/playwright/masthead-1366.png`,
`apps/web/output/playwright/masthead-390.png`, and
`apps/web/output/playwright/masthead-320.png`.

At every width, section `01` begins immediately after the retained strong top
rule; there is no blank masthead spacer, annual title, or shared-year label.
The first section has no duplicate hairline at that boundary. Section-level
total, year, and basis/status remain visible. The focused browser suite also
confirmed zero document overflow at 390px and 320px. Browser console review
reported zero warnings and zero errors. The captures are temporary QA output
and are not part of the commit. `design-qa.md` did not need an update because
the observed difference is the approved removal itself.

## Files changed

- `apps/web/tests/browser/landing.spec.ts`
- `apps/web/components/landing/landing-page.tsx`
- `apps/web/components/landing/landing-dataset-section.tsx`
- `apps/web/lib/landing/landingData.ts`
- `apps/web/tests/landing/landingData.test.ts`
- `DESIGN.md`
- this report

## Self-review

Confirmed the masthead markup and `commonLatestYear` calculation, field,
return value, and unit-test assertion are removed. No latest-year or total
derivation changed. The OpenGraph timeout, implementation plan, deployment
configuration, and unrelated files were not changed.

## Commit

Pending local commit.
