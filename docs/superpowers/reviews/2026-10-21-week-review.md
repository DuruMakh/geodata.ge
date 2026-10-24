# Week review, 14–21 October 2026

Requested by Duru on 2026-10-21: a full review of the week's work as a senior engineer, architect, UI/UX designer and tester. Scope: PRs #187–#212 (11 new topic hubs, Farming, GDP by expenditure, Marriages and divorces, Jobs by industry, Services by country, Foreign debt and reserves, the MCP remediation, the October data-validation fixes and Spending by type). Reviewed on `main` a456de1f, then 097be122 and 92b4eb35 as they merged. This file is the finding list the fix plan (`docs/superpowers/plans/2026-10-21-week-review-fixes.md`) works from.

## Findings

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| R1 | urgent | The production deploy of #211 (097be122) failed in "Converge mirror": `MunicipalPopulationFact.populationThousand` was `DECIMAL(10,1)` and #211 serves three decimals (Tbilisi 1335.671). The import transaction rolled back, so production kept a456de1f. Fixed on `main` by 24d9156a (migration `20261021180000_municipal_population_precision`, merged with #212); the deploy of 92b4eb35 passed the parity-checked import at about 19:40 UTC and was verifying the build when this review closed. | Deploy run 39654819490, "row 2025:04 differs: csv … 1335.671 … db … 1335.7" |
| R2 | high | CI has no database, so a schema/precision mismatch is found only by the production deploy. `tests/data/demography/importIntegration.test.ts` and `tests/data/governmentDebt/mirrorIntegration.test.ts` always skip in CI. | `.github/workflows/ci.yml` has no `services:`; `GEODATA_TEST_DATABASE_URL` is never set |
| R3 | high, dated | `scripts/audit-dependencies.ts` accepts GHSA-vfj7-8cjw-p6xm (braces 3.0.3, dev-only lint chain) only for `eslint-config-next`/`@next/eslint-plugin-next` 16.3.8 and only until **2026-11-02 00:00 UTC**. After that every CI run fails. The same pin makes Dependabot #209 (Next 16.3.8 → 16.4.2 and 11 more) fail. Upstream braces is still 3.0.3 (no fix) on 2026-10-21; #209 changes only the two 16.x pins in the chain. | Run 39539656158: "BLOCKING SECURITY FINDING: eslint-config-next" |
| R4 | medium | `lib/pages/transport-shared.tsx` is `lib/pages/housing-shared.tsx` with two comments changed (97% line similarity); `internet-shared.tsx` differs only by naming its index "homes" (80%). AGENTS.md: "Duplicating existing code is a defect." | difflib comparison after replacing hub names |
| R5 | medium | Browser and unit tests hard-code hub and methodology totals (footer links 25, 404 links 22, phone menu 23, methodology rows 29, footer height 760 px), so every hub breaks them; three commits this week only re-counted. | `landing.spec.ts:918`, `methodology.spec.ts:96,108`, `mobile-site-menu.spec.ts:20`, `mobile-repairs-nav.spec.ts:145`, `methodologyCoverage.test.ts:28` |
| R6 | medium | `lib/seo/sitemap.ts` loads 38 datasets in one positional `Promise.all`; every result has the same shape, so a swap type-checks. #210 fixed one such swap (Transport/Internet dates). All 38 pairs were verified aligned on 2026-10-21. | sitemap.ts:88 |
| R7 | medium | The MCP server/client 2.2.0 → 2.3.1 and SDK 1.31.0 → 1.32.1 updates (forced by new advisories that failed the audit on every branch) landed inside the Internet (#205) and Transport (#202) PRs; `docs/deployment.md` "Current dependency-security review (2026-10-17)" still records 2.2.0/1.31.0. | commits 6ae991c9, 8c101d27 |
| R8 | low | The Crime, Social and Marriages Excel builders round calculated values with `Number(x.toFixed(d))`, which #211 replaced elsewhere with `roundForDisplay` (Excel/Geostat rounding). No served value differs today (0 of 1,158 crime rates), but 19 per 2,000,000 people is 0.95 per 100,000: the page shows 1.0, the workbook would write 0.9. | `crimeWorkbook.ts:40`, `socialWorkbook.ts:76`, `demographyMarriageWorkbook.ts:37` |
| R9 | low | "At 2025 prices" lives in two places: `atPrices(…, baseYear = 2025)` and the series label text in both languages. | `lib/explorer/social.ts:135`, `social.json:83` |
| R10 | low | No automated accessibility check exists. An axe-core 4.11.4 scan (WCAG 2.0/2.1 A and AA) of all 20 hubs, their first pages, home, methodology, connect and about at 375 and 1280 px found one violation: the decorative `aria-hidden` "01" on About's ink band (`#B3402A` on `#1E1B16`, 3.01:1). | 88 scans, 2026-10-21 |
| R11 | low | Dependabot PRs #195 (download-artifact 8), #196 (cache 6) and #149 (dotenv 18) are open and untouched. | `gh pr list` |
| R12 | owner decision | Product identity: AGENTS.md and the home page describe a public-finance and economy explorer, "not a broad public-data catalog", while 20 hubs now include crime, environment, internet and transport. The home page's sections are budget-only; the sidebar of 20 hubs scrolls. | live `/en` |
| R13 | owner decision | Architecture: nine new `*Fact` tables share the same 15 columns (five more differ by 1–3), and each hub edits the same 21 shared files. A shared topic registry/table would remove that, but it is a project of its own. | `prisma/schema.prisma` |
| R14 | owner decision | `docs/Raw Data` grew from 629 MB to 883 MB this week in plain git (no LFS); 45 worktrees exist. Checkout is still 15–21 s in CI. | `git ls-tree -l` |

## Verified clean (do not re-check)

- 1,102 browser loads of all 956 new URLs (every page at 375 px, non-place pages at 1280 px): no page errors, console errors, failed or 4xx/5xx requests, sideways overflow, raw message keys, `NaN`/`undefined` text, or missing/duplicate `h1`.
- 126 Excel downloads: three sheets, source hyperlinks, no broken values.
- 956 new pages: unique titles and descriptions, canonical equals URL, both language alternates.
- 14 new tables enable row-level security and revoke `anon`/`authenticated`.
- 10 values across Housing, Transport, Environment, Education, Social and Crime equal the original workbooks and the live pages.
- `/mcp`: GET 405 pointing to /connect, malformed JSON gets the bilingual error, tools list loads.
- `npm run check` on a456de1f: lint, typecheck, 5,649 tests passed (13 skipped), data validation, i18n check.
- Page weight 25–37 KB compressed; colour tokens on paper pass AA (`faint` 4.52:1).
