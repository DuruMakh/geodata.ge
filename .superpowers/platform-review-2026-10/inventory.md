# Fiscal.ge platform review — inventory (2026-10-12)

Base commit: `9177f036` (origin/main, after PR #181 Trade services).
Route source: `apps/web/app/(ka)` (72 `page.tsx`) and `apps/web/app/(en)/en` (72 `page.tsx`, same tree), plus `apps/web/app/mcp/route.ts`.
Every Georgian route is a thin wrapper over a render function in `apps/web/lib/pages/*`; the English route calls the same function with `"en"`.
Each unit below covers BOTH `/…` (ka) and `/en/…` (en).

Live build for agents: `http://localhost:3100` (built with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`).

## Review units (30), ranked by importance

| # | Unit id | Routes covered (ka + `/en` mirror) | Representative page | Main files | Why chosen |
|---|---|---|---|---|---|
| 1 | U01-landing | `/` | `/` | `lib/pages/home.tsx`, `components/landing/*`, `lib/landing/*`, `components/site/*` (header/footer/root document) | First impression, main entry point, site chrome on every page |
| 2 | U02-explorer-hub | `/explorer` | `/explorer` | `lib/pages/hub.tsx`, `components/hub/budget-hub.tsx`, `components/shell/legacy-hash-redirect.tsx`, `lib/pages/explorer-layout.tsx`, `components/shell/data-sidebar.tsx`, `components/shell/explorer-footer.tsx` | Main entry to every dataset; explorer layout/sidebar shared by all explorer pages |
| 3 | U03-expenditure | `/explorer/expenditure` | `/explorer/expenditure` | `lib/pages/expenditure.tsx`, `components/main-explorer/*` | Flagship budget explorer, heaviest shared explorer template |
| 4 | U04-revenue | `/explorer/revenue` | `/explorer/revenue` | `lib/pages/revenue.tsx`, `components/main-explorer/*` | Second budget flagship; same template as U03, checks its revenue-specific paths |
| 5 | U05-analysis | `/explorer/analysis` | `/explorer/analysis` | `lib/pages/analysis.tsx`, `components/main-explorer/*`, `components/analysis/*` | Single-year analysis, unique layout |
| 6 | U06-debt | `/explorer/debt` | `/explorer/debt` | `lib/pages/debt.tsx`, `components/debt/*` | Flagship fiscal page with its own tree panel |
| 7 | U07-deficit | `/explorer/deficit` | `/explorer/deficit` | `lib/pages/deficit.tsx`, `components/deficit/*` | Flagship fiscal page, own explorer |
| 8 | U08-municipal-index | `/explorer/municipalities`, `/explorer/municipalities/georgia` | `/explorer/municipalities` | `lib/pages/municipal-index.tsx`, `lib/pages/municipal-country.tsx`, `components/municipalities/municipalities-index*`, `components/municipalities/municipal-explorer*` | Map entry to municipal budgets; Georgia aggregate page |
| 9 | U09-municipal-places | `/explorer/municipalities/[slug]` (~65), `/explorer/municipalities/region/[id]` (~11) | `/explorer/municipalities/tbilisi` (spot-check smallest + largest) | `lib/pages/municipality.tsx`, `lib/pages/municipal-region.tsx`, `components/municipalities/*` | Largest page family (~150 built pages); template review |
| 10 | U10-gdp | `/explorer/economy/gdp` | `/explorer/economy/gdp` | `lib/pages/gdp.tsx`, `components/gdp/*` | Flagship economy page |
| 11 | U11-economy-sectors | `/explorer/economy/sectors` | `/explorer/economy/sectors` | `lib/pages/economic-sectors.tsx`, `components/economic-sectors/*` | Unique stacked-chart layout |
| 12 | U12-economy-regions | `/explorer/economy/regions`, `/explorer/economy/regions/[id]` (~11) | `/explorer/economy/regions/imereti` | `lib/pages/regional-economies.tsx`, `lib/pages/regional-economy.tsx`, `components/regional-economies/*` | Map index + region page template |
| 13 | U13-inflation-overview | `/explorer/inflation/overview`, `/explorer/inflation/categories` | `/explorer/inflation/overview` | `lib/pages/inflation.tsx`, `components/inflation/inflation-overview*`, `components/inflation/inflation-categories*` | Monthly dataset, the only sub-annual data; headline page |
| 14 | U14-inflation-products | `/explorer/inflation/products` | `/explorer/inflation/products` | `lib/pages/inflation.tsx`, `components/inflation/inflation-products*` | Heaviest product picker, unique layout |
| 15 | U15-inflation-cities | `/explorer/inflation/cities`, `/explorer/inflation/cities/[city]` | `/explorer/inflation/cities/tbilisi` | `lib/pages/inflation.tsx`, `components/inflation/inflation-cities*`, city picker | City index + per-city template |
| 16 | U16-unemployment | `/explorer/unemployment/overview`, `/gender`, `/age` | `/explorer/unemployment/overview` | `lib/pages/unemployment.tsx`, `components/unemployment/*` | Labour flagship; age heat map |
| 17 | U17-unemployment-regions | `/explorer/unemployment/regions`, `/explorer/unemployment/regions/[id]` | `/explorer/unemployment/regions/imereti` | `lib/pages/unemployment.tsx`, `lib/pages/unemployment-regions.tsx`, `components/unemployment/unemployment-regions*` | Map + region page template |
| 18 | U18-wages | `/explorer/wages/overview`, `/industries`, `/regions`, `/regions/[id]` | `/explorer/wages/overview` | `lib/pages/wages.tsx`, `components/wages/*`, `lib/explorer/wagesWorkbook.ts` | Recent hub with mixed precision; Excel bug history |
| 19 | U19-living-income-spending | `/explorer/living-standards/income`, `/spending`, `/income/regions/[id]`, `/spending/regions/[id]` | `/explorer/living-standards/income/regions/georgia` | `lib/pages/household.tsx`, `components/household/*` | Newest hub (PR #179), map + region pages |
| 20 | U20-living-poverty | `/explorer/living-standards/poverty`, `/inequality` | `/explorer/living-standards/poverty` | `lib/pages/poverty.tsx`, `components/poverty/*` | Poverty/inequality explorer; known Excel format item |
| 21 | U21-trade-overview-partners | `/explorer/trade/overview`, `/partners`, `/domestic-exports` | `/explorer/trade/partners` | `lib/pages/trade.tsx`, `components/trade/trade-overview*`, `trade-partners*`, `trade-domestic-exports*` | Trade flagship; compact payload page |
| 22 | U22-trade-products-services | `/explorer/trade/products`, `/explorer/trade/services` | `/explorer/trade/products` | `lib/pages/trade.tsx`, `components/trade/trade-products*`, `trade-services*` | Heaviest trade output; services just merged (PR #181) |
| 23 | U23-external-flows | `/explorer/external/current-account`, `/foreign-investment`, `/money-from-abroad` | `/explorer/external/money-from-abroad` | `lib/pages/external.tsx`, `components/external/*` | Three pages sharing comparison workspaces |
| 24 | U24-money-banks | `/explorer/money/supply`, `/loans-deposits`, `/interest-rates`, `/bank-health` | `/explorer/money/loans-deposits` | `lib/pages/moneyBanks.tsx`, `components/money-banks/*` | One template, four pages; icon-only measure toggles |
| 25 | U25-energy-food | `/explorer/energy-food/energy-supply`, `/electricity`, `/energy-use`, `/food-self-sufficiency` | `/explorer/energy-food/energy-supply` | `lib/pages/energy-food.tsx`, `components/energy-food/*` | One template, four pages |
| 26 | U26-demography-population | `/explorer/demography/population`, `/population/georgia`, `/population/region/[id]`, `/population/[slug]` | `/explorer/demography/population/region/imereti` (spot-check a small municipality and Tbilisi) | `lib/pages/demography-population*.tsx`, `components/demography/population-place-explorer*`, `age-sex-section*`, `vital-section*` | Second-largest page family (~90 place pages) |
| 27 | U27-demography-topics | `/explorer/demography/age-sex`, `/births-deaths`, `/migration` | `/explorer/demography/age-sex` | `lib/pages/demography-age-sex.tsx`, `demography-births-deaths.tsx`, `demography-migration.tsx`, `components/demography/*` | Unique layouts (pyramid, vital charts, migration) |
| 28 | U28-topic-hubs | `/explorer/economy`, `/inflation`, `/unemployment`, `/wages`, `/trade`, `/external`, `/money`, `/energy-food`, `/living-standards`, `/demography` | `/explorer/trade` (spot-check smallest: `/explorer/living-standards`, largest: `/explorer/inflation`) | `components/hub/budget-hub.tsx`, the `render*Hub` functions in `lib/pages/*.tsx` | One shared template across ten hubs |
| 29 | U29-methodology-about | `/methodology`, `/methodology/[dataset]`, `/about` | `/methodology/expenditure` (brief named `/methodology/budget`, which does not exist; spot-check smallest and largest article) | `lib/pages/methodology*.tsx`, `components/methodology/*`, `lib/methodology/*`, `lib/pages/about.tsx` | Text-heavy trust pages, downloads, source archive |
| 30 | U30-mcp-connect | `/mcp` (POST/GET), `/connect` | `/mcp` + `/connect` | `app/mcp/route.ts`, `lib/mcp/*`, `lib/factQuery/*`, `lib/pages/connect.tsx`, `components/connect/*` | The only request-time route; public AI endpoint and its docs page |

## Cross-cutting units (run after the page waves)

| Unit id | Scope |
|---|---|
| X1-shared-components | `apps/web/components/{explorer-shell,main-explorer,ui,shell,site,seo,hub}`, `apps/web/lib/{explorer,i18n,navigation,seo}`: duplication and API consistency |
| X2-security-config | `/mcp` (rate limit, pause switch, Host allowlist, answer cap), headers/CSP (`next.config.ts`, `vercel.json`), env handling, `npm audit`, GitHub Actions permissions, secrets in repo |
| X3-build-ci-tests | build time, slowest test files, flaky tests, suite-level redundancy and repeated setup (`apps/web/tests`, `vitest.config.ts`, `playwright.config.ts`, `.github/workflows`) |
| X4-docs-context | `public/llms.txt`, `Project_Definition.md`, `DESIGN.md`, `AGENTS.md`, `CLAUDE.md`, `docs/*` vs current reality |

## Pages left out

| Page | Covered by |
|---|---|
| Every `/en/…` route | the same unit as its Georgian route (each unit reviews both) |
| `/explorer/municipalities/region/[id]` (all but the spot-checks) | U09 template |
| `/explorer/municipalities/[slug]` (all but the spot-checks) | U09 template |
| `/explorer/economy/regions/[id]` (all but the representative) | U12 template |
| `/explorer/unemployment/regions/[id]`, `/explorer/wages/regions/[id]` (all but the representative) | U17, U18 templates |
| `/explorer/living-standards/{income,spending}/regions/[id]` (all but the representative) | U19 template |
| `/explorer/inflation/cities/[city]` (all but the representative) | U15 template |
| `/explorer/demography/population/[slug]`, `/region/[id]` (all but the spot-checks) | U26 template |
| `/methodology/[dataset]` (all but the spot-checks) | U29 template |
| Ten topic hubs other than the representative | U28 template |
| `global-not-found.tsx` (404 page) | not reviewed (shares the site header/footer reviewed in U01) |
| `robots.ts`, `sitemap.xml`, `opengraph-image` | SEO area of each unit (sitemap entry), X4 for llms.txt; image route not reviewed |
| `/downloads/*` static workbooks and JSON publications | U29 (downloads list) and U30 (fact-query publications) |
