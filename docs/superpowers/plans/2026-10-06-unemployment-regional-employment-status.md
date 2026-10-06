# Regional hired and self-employed counts

The user approved adding the regional breakdown under Employed, matching the national overview. The archived regional workbook publishes both categories for all eleven modern regions in 2020–2025. Earlier years remain unavailable; the longer Employed history stays visible when selected together with its children. Rates and counts keep their existing separate selection rules.

1. Promote the 132 primary regional hired/self-employed observations into the existing employment-status CSV. Verify every value against the archived workbook, reconcile the three official components with Employed, and retain the original research package and three primary CSVs unchanged.
2. Reuse the expandable Employed row on regional pages. Derive the displayed range from selected regional series, preserve gaps before 2020, and check saved selections, tables and Excel downloads in both languages.
3. Update coverage validation and methodology, run the required checks, production build and browser suite, and review the bounded change. Keep the result in this local worktree; publication is outside this request.

## Verification ledger

- Regression tests failed for the missing source rows, source-cell checking and regional children before implementation; 66 focused data/explorer tests then passed.
- Independent review verified all new source tokens and reconciliations, and identified comparison parent-history truncation. A dedicated regression reproduced the 2020 start before the fix. Coverage now follows the selected regional indicators across the comparison scope while preserving historical-group gaps, and national parent references use the same years.
- Targeted verification: 67 tests passed, including comparison histories, saved settings and workbook gaps. The reviewer confirmed the comparison finding resolved with no remaining Critical/Important issues.
- `npm run check`: passed, with 3,008 unit tests passing and seven existing skips; source preparation validates 3,370 serving observations and translation checks validate 138 page identities.
- `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`: passed, including static regional pages and publication consistency checks.
- Browser verification on port 3127: the full run passed 696 scenarios; four new assertions wrongly looked for children after their parent automatically collapsed on switching back to a rate. Reopening Employed in the test corrected that expectation; all four affected scenarios passed on rerun. All 700 browser scenarios are verified against the same production build. Changed-file ESLint passed.
- Visual inspection of Georgian desktop and English mobile screenshots confirmed the expandable categories, original parent history, shorter child lines and bilingual coverage explanation. Screenshots are preserved under `apps/web/.tmp/unemployment-preview/regional-employment-*.png`.
- Complete locally: preview remains on port 3127. No commits, publication or live database writes were performed.
