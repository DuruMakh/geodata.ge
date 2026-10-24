# Week Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the findings of the 2026-10-21 week review: make CI catch database mismatches before merge, renew or retire the lint-chain security exception before it stops CI on 2026-11-02, and remove the duplication, brittle tests and small inconsistencies the review found.

**Architecture:** No new product behaviour. CI gains one job that applies every migration and runs the parity-checked import against a disposable PostgreSQL. The security gate's pinned versions move to the versions Dependabot #209 brings. Housing, Transport and Internet share one regions-page frame. Tests and the sitemap derive counts and names instead of relying on fixed totals and positions.

**Tech Stack:** Next.js 16 (16.3.8 → 16.4.2 in Task 3), TypeScript, Prisma 7 on PostgreSQL, Vitest, Playwright, GitHub Actions, axe-core 4.11.4.

**Spec:** `docs/superpowers/reviews/2026-10-21-week-review.md` (finding IDs R1–R14 below refer to it).

## Global Constraints

- AGENTS.md "Reuse First": reuse as is, extend with a small addition, and name the existing code considered before adding anything new. AGENTS.md "Engineering Behavior": no unrelated refactors; every changed line serves a finding.
- Commands run in `apps/web`. The done-check is `CLAUDE.md`'s: `npm run check`, `npm run build`, and `npm run test:browser` against a production build built and served with `NEXT_PUBLIC_SITE_URL=https://fiscal.ge`. Run each gate once, at the end, not per task.
- Task 3 touches the runtime of `/mcp`, so `npx vitest run tests/factQuery/reference.test.ts` must pass. A disagreement is a stop condition: report it, never edit the expectation.
- Never touch the production database. Migrations reach it only through the deploy workflow's `npm run prisma:deploy`.
- Visuals are owned by `DESIGN.md`; no task changes a colour, size or layout.
- Branches use the `claude/` prefix (as #187–#212 did). One commit per task, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Draft PR, required CI green, owner authorization to merge. Every merge to `main` deploys.
- Delivery: **PR A** = Tasks 2–3 (release safety; must merge before **2026-11-02 00:00 UTC / 04:00 Tbilisi**). **PR B** = Tasks 4–10. Task 1 has no code.

## Reuse

- **Reused as is:** `roundForDisplay` (`lib/explorer/format.ts`), `areaRoutes` (`lib/explorer/areaRoutes.ts`), `loadSourcedWorkbookSources`, `NAV_TREE`, `LIVE_METHODOLOGY_IDS`, `SERVED_DATA_FILES`, the two existing database integration tests, `scripts/audit-dependencies.ts`, `tests/browser/accessibility-polish.spec.ts`, and the axe-core 4.11.4 already in the lockfile (via `eslint-plugin-jsx-a11y`).
- **Small additions:** one CI job; two version pins and one date in the audit gate; derived counts in five tests; one constant in `social.ts`; one helper in `format.ts`.
- **Genuinely new:** `lib/pages/region-area-frame.tsx` (replaces three copies; nothing existing generalises the frame, and `areaRoutes` covers routes only) and `lib/awaitNamed.ts` (no keyed `Promise.all` helper exists; `sourceInventory.ts` builds its own map inline).

## Owner decisions

- **D1 (needed before Task 3, deadline 2026-11-02):** renew the braces exception (GHSA-vfj7-8cjw-p6xm) for `eslint-config-next`/`@next/eslint-plugin-next` **16.4.2** with a new expiry. Proposed: **2026-12-01 00:00 UTC**. Upstream braces is still 3.0.3 with no fix. If declined, CI stops on 2026-11-02 until the lint chain is replaced.
- **D2 (R12, not in this plan):** the site's identity and home page now that there are 20 hubs (update AGENTS.md "Project Snapshot", group the hubs, or slow the expansion). Needs its own brainstorming and `DESIGN.md` work.
- **D3 (R13, not in this plan):** one shared topic table, loader and registry instead of a copy per hub. Needs its own spec before the next hub.
- **D4 (R14, not in this plan):** keep raw sources in plain git, move them to Git LFS, or move them to an external archive.

## Review Focus

1. **Next 16.4.2 changes a page or `/mcp`.** Expected: the full browser suite on the production build, the reference fixture and `npx vitest run tests/mcp` all pass unchanged. Owned by Task 3.
2. **The mirror job is slow or flaky.** Expected: Postgres health-checked before use, job under 20 minutes, a failed import printing the parity message. Owned by Task 2 (record the measured duration in `docs/deployment.md`).
3. **The renewed exception is broader than approved.** Expected: version 16.4.3, version 16.3.8, any other advisory, any production path and any date at or after the new expiry all still block. Owned by Task 3's tests.
4. **The shared frame changes an area page.** Expected: the HTML of all 78 Housing, Transport and Internet index and area pages (13 per hub, both languages) is identical before and after, ignoring script tags. Owned by Task 4.
5. **Named loading changes the sitemap.** Expected: identical URLs and `lastModified` values before and after. Owned by Task 6.

---

### Task 1: Confirm the two held releases are live (R1, no code)

**Files:** none.

- [ ] **Step 1: Check the deploy of 92b4eb35**

Run: `gh run list --workflow deploy-production.yml --branch main --limit 1 --json headSha,conclusion --jq '.[0]'`
Expected: `{"conclusion":"success","headSha":"92b4eb35…"}` (or a later main SHA with `success`).

- [ ] **Step 2: Prove it landed** (recipe in memory `deployment-gotchas`)

Run:
```bash
DID=$(gh api repos/DuruMakh/geodata.ge/deployments --jq '[.[] | select(.environment=="Production")][0].id'); gh api "repos/DuruMakh/geodata.ge/deployments/$DID/statuses" --jq '.[0].state'
curl -s -o /dev/null -w "%{http_code}\n" https://fiscal.ge/explorer/expenditure-types
curl -s https://fiscal.ge/en/explorer/money/interest-rates | grep -c "7\.07"
```
Expected: `success`, `200` (was 404 before #212), and a count ≥ 1 (the page showed 7.1 before #211).

- [ ] **Step 3: If the deploy failed,** read `gh run view <id> --log-failed`. A `Database does not match the reviewed CSVs for <table>` message with a rounded db value is the same defect in another column: add a migration `apps/web/prisma/migrations/<UTC timestamp>_<table>_precision/migration.sql` modelled on `20261021180000_municipal_population_precision`, change the matching `@db.Decimal` in `prisma/schema.prisma`, and ship it as its own PR before anything else. Report any other failure to the owner.

### Task 2: Rehearse migrations and the import in CI (R2)

**Files:**
- Modify: `.github/workflows/ci.yml` (new job `mirror`)
- Modify: `apps/web/tests/data/demography/importIntegration.test.ts:29-54` (derive expected counts)
- Modify: `docs/deployment.md` (CI section: the new job and its measured time), `docs/data-methodology/database-import.md` (the rehearsal now runs in CI)

**Interfaces:**
- Consumes: `SERVED_DATA_FILES` from `apps/web/lib/data/servedData.ts`; npm scripts `prisma:deploy`, `data:import`.
- Produces: CI check named `Database mirror (disposable PostgreSQL)`.

- [ ] **Step 1: Make the demography database test derive its counts.** It is already stale (it predates `demography.mid_year_population`, `marriages`, `divorces` and the four mean-age series) and has never run in CI. Replace the literal list in "mirrors the served files" with counts read from the served CSVs:

```ts
const DEMOGRAPHY_FILES = Object.entries(SERVED_DATA_FILES).filter(([key]) => key.startsWith("demography")).map(([, file]) => file);
// expected: [{ seriesId, n }] sorted by seriesId, counted from every row of DEMOGRAPHY_FILES that has a series_id
expect(rows).toEqual(expectedFromCsv);
```

- [ ] **Step 2: Add the job** after `checks` in `ci.yml`. It runs in parallel, so it adds no wall time while it stays under the browser job.

```yaml
  mirror:
    name: Database mirror (disposable PostgreSQL)
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:17
        env: { POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres, POSTGRES_DB: geodata }
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U postgres -d geodata" --health-interval 5s --health-timeout 5s --health-retries 20
    env:
      DIRECT_URL: postgresql://postgres:postgres@localhost:5432/geodata
      GEODATA_TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/geodata
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4   # same node-version and cache settings as the checks job
      - run: npm ci --no-audit
      # The migrations revoke table access from Supabase's two API roles, which plain PostgreSQL lacks.
      - run: psql "$DIRECT_URL" -c 'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;'
      - run: npm run prisma:deploy
      - run: npm run data:import
      - run: npx vitest run tests/data/demography/importIntegration.test.ts tests/data/governmentDebt/mirrorIntegration.test.ts
```

- [ ] **Step 3: Prove it catches today's defect.** On the PR branch, push a temporary commit that changes `20261021180000_municipal_population_precision/migration.sql` to `DECIMAL(10,1)`. Expected: the `mirror` job fails at `npm run data:import` with `Database does not match the reviewed CSVs for municipal population facts`. Revert that commit (`git revert`) and push. Expected: `mirror` passes and the two integration test files report 0 skipped.

- [ ] **Step 4: Document** in `docs/deployment.md` (CI section) that the `mirror` job applies every migration and runs the parity-checked import before merge, with its measured duration. In `database-import.md`, replace the "optional rehearsal" wording with a pointer to this job.

- [ ] **Step 5: Commit** — `ci: rehearse migrations and the parity-checked import on a disposable database`

### Task 3: Renew the lint-chain exception and take the Next 16.4.2 group (R3, R7; needs D1)

**Files:**
- Modify: `apps/web/scripts/audit-dependencies.ts:6-11` (`EXPIRES`, `LINT_CHAIN`)
- Modify: `apps/web/tests/scripts/auditDependencies.test.ts:7,46` (versions, expiry dates)
- Modify: `apps/web/package.json`, `apps/web/package-lock.json` (from Dependabot #209)
- Modify: `docs/deployment.md` §"Temporary dependency-security exception" and §"Current dependency-security review"

- [ ] **Step 1: Stop until the owner has answered D1 in words.** Record the answer, its date and the chosen expiry in the PR description.

- [ ] **Step 2: Bring in #209:** `git merge --no-ff origin/dependabot/npm_and_yarn/apps/web/minor-and-patch-e179626fe3`, then `npm ci`. Expected lock versions: `next` 16.4.2, `eslint-config-next` 16.4.2, `@next/eslint-plugin-next` 16.4.2, braces 3.0.3, micromatch 4.0.8, fast-glob 3.3.1.

- [ ] **Step 3: Update the test first:** set `versions` to `["3.0.3", "4.0.8", "3.3.1", "16.4.2", "16.4.2"]`, and change the expiry cases to `it.each(["2026-12-01T00:00:00Z", "2027-01-01T00:00:00Z"])` (or the D1 date and one month after). Add `it.each(["16.3.8", "16.4.3"])("blocks the unreviewed lint-chain version %s", …)`, expecting `blocked` to contain `eslint-config-next`.

- [ ] **Step 4: Run** `npx vitest run tests/scripts/auditDependencies.test.ts`. Expected: FAIL (the gate still pins 16.3.8 and 2026-11-02).

- [ ] **Step 5: Set** `EXPIRES = Date.parse("<D1 date>T00:00:00Z")` and the two 16.x entries of `LINT_CHAIN` to `"16.4.2"`. Rerun Step 4. Expected: PASS. Then `npx tsx scripts/audit-dependencies.ts`. Expected: exit 0 with five `TEMPORARY ACCEPTED RISK … expires <D1 date>` lines.

- [ ] **Step 6: Fresh exposure evidence** (the runbook requires it): `npm view braces version` prints `3.0.3`; `grep -rn rootDir eslint.config.*` prints nothing; the five lock entries are `dev: true`; after `npm run build`, `grep -l "braces\|micromatch" .next/server/app/mcp/route.js.nft.json` prints nothing. Paste the outputs into `docs/deployment.md`.

- [ ] **Step 7: Read** the Next 16.4 notes in `node_modules/next/dist/docs/` (upgrade guide) and list any item touching static export, `generateStaticParams`, route handlers or `next/font` in the PR description.

- [ ] **Step 8: Rewrite** "Current dependency-security review" as of today: MCP server and client 2.3.1 and SDK 1.32.1 (commits 6ae991c9, 8c101d27, with their advisory IDs), vite 8.3.4, Next 16.4.2, today's `npm audit` counts, and a re-run of the 2026-10-17 embedded-parser probe on 2.3.1 (does `//%41.com` still resolve to host `A.com`?). Add one sentence: a dependency update forced by the audit gate inside a feature PR updates this section in the same PR.

- [ ] **Step 9: Verify** with the reference fixture and the MCP suite (`npx vitest run tests/factQuery/reference.test.ts tests/mcp`, expected PASS), then the full done-check (Global Constraints), including the browser suite on a 16.4.2 production build.

- [ ] **Step 10: Commit** — `chore(deps): Next 16.4.2 group; renew the reviewed lint-chain exception to <D1 date>`. After merge, Dependabot closes #209 on its own.

### Task 4: One regions-page frame for Housing, Transport and Internet (R4)

**Files:**
- Create: `apps/web/lib/pages/region-area-frame.tsx`
- Modify: `apps/web/lib/pages/housing-shared.tsx`, `transport-shared.tsx`, `internet-shared.tsx` (each becomes one `regionAreaFrame({...})` call that re-exports today's names, so no route or caller changes)
- Test: `apps/web/tests/explorer/regionAreaFrame.test.ts`

**Interfaces:**
- Produces:
```ts
export type RegionAreaFrameConfig<Area extends string, Fact extends { year: number; lastReviewedAt: string }> = {
  hub: "housing" | "transport" | "internet";        // message namespace and Dataset id
  hubPath: `/${string}`; indexHref: `/${string}`;
  indexKey: "regions" | "homes";                    // `<hub>.page.<indexKey>.title|summary|metaTitle`
  areas: readonly Area[]; areaSlug(area: Area): string; areaHref(area: Area): `/${string}`; mapId(area: Area): string;
  areaHeadingIds(area: Area): readonly string[];    // rendered as `<hub>.heading.<id>` for variableMeasured
  load(): Promise<{ facts: Fact[] }>; sourceIds: readonly string[];
};
export type RegionAreaBody<Area extends string, Fact> = { facts: Fact[]; presentation: Presentation; areaLabels: Record<Area, string>; origin: string; lastReviewedAt: string };
export function regionAreaFrame<Area extends string, Fact extends { year: number; lastReviewedAt: string }>(config: RegionAreaFrameConfig<Area, Fact>): {
  areaPages: readonly MunicipalRegion[]; areaStaticParams(): { id: string }[]; areaForSlug(slug: string): Area;
  indexPageMetadata(locale: Locale): Promise<Metadata>; areaPageMetadata(slug: string, locale: Locale): Promise<Metadata>;
  loadWorkbookSources(locale: Locale): Promise<SourcedWorkbookPublicSource[]>;
  renderFrame(locale: Locale, area: Area | undefined, years: (facts: Fact[]) => number[], body: (page: RegionAreaBody<Area, Fact>) => ReactNode): Promise<ReactNode>;
};
```
The body is today's `housing-shared.tsx`, with `housing`, `HOUSING_*` and `page.regions` read from the config.

- [ ] **Step 1: Snapshot before.** Run `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npm run build`, then copy the HTML files under `.next/server/app` for `explorer/housing/regions*`, `explorer/transport/regions*`, `explorer/internet/homes*` and their `en/` twins to a scratch folder (78 files).
- [ ] **Step 2: Write the test:** `regionAreaFrame` with a two-area config returns `areaStaticParams()` equal to `[{ id: "georgia" }, { id: "<region slug>" }]`, and `areaForSlug("nowhere")` calls `notFound()` (mock `next/navigation`).
- [ ] **Step 3: Run it:** `npx vitest run tests/explorer/regionAreaFrame.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** `region-area-frame.tsx`; reduce the three `-shared.tsx` files to their config plus the re-exports (`AREA_PAGES`, `areaForSlug`, `<hub>AreaStaticParams`, `<hub>RegionsPageMetadata`/`internetHomesPageMetadata`, `<hub>AreaPageMetadata`, `load<Hub>WorkbookSources`, `render<Hub>RegionsFrame`/`renderInternetHomesFrame`, and the `…Body` type aliases).
- [ ] **Step 5: Run** the new test plus `npx vitest run tests/explorer/housing.test.ts tests/explorer/transport* tests/explorer/internet*`. Expected: PASS.
- [ ] **Step 6: Snapshot after** and compare the same 78 files with `<script…</script>` and `/_next/static/…` paths removed. Expected: no differences.
- [ ] **Step 7: Commit** — `refactor(pages): one regions-page frame for Housing, Transport and Internet`

Business (`business-regions.tsx`, 71% similar) and Science and culture (`science-culture-shared.tsx`, 66%) differ in more than names; they wait for D3.

### Task 5: Tests count hubs from the menu, not by hand (R5)

**Files:** `apps/web/tests/browser/landing.spec.ts:917-918`, `methodology.spec.ts:96,107-108`, `mobile-site-menu.spec.ts:19-20`, `mobile-repairs-nav.spec.ts:144-145`, `apps/web/tests/i18n/methodologyCoverage.test.ts:28`

- [ ] **Step 1: Replace the literals** (import `NAV_TREE` from `lib/navigation/navTree` and `LIVE_METHODOLOGY_IDS` from `lib/methodology/catalog`; both import cleanly outside Next, checked 2026-10-21):
  - footer links: `toHaveCount(NAV_TREE.length + 5)` (logo, methodology, AI-კავშირი, მიზანი, address; 25 today)
  - 404 recovery links: `NAV_TREE.length + 2` (22 today); phone menu links: `NAV_TREE.length + 3` (23 today)
  - methodology live rows: `LIVE_METHODOLOGY_IDS.length` (29 today)
  - footer height: `toBeLessThanOrEqual(Math.ceil((NAV_TREE.length + 3) / 2) * 44 + 232)` (760 today)
  - `methodologyCoverage.test.ts`: drop `toHaveLength(29)`; keep the `toContain` assertion.
  Update each comment that names a count ("the twenty dataset hubs") to say "every dataset hub".
- [ ] **Step 2: Run** those four specs against a production build (CLAUDE.md recipe) and `npx vitest run tests/i18n/methodologyCoverage.test.ts`. Expected: PASS with today's counts.
- [ ] **Step 3: Commit** — `test: count hubs and methodology pages from their registries`

### Task 6: Load the sitemap's datasets by name (R6)

**Files:**
- Create: `apps/web/lib/awaitNamed.ts`
- Modify: `apps/web/lib/seo/sitemap.ts:88-127` (and every later use of the destructured names)
- Test: `apps/web/tests/lib/awaitNamed.test.ts`

**Interfaces:**
- Produces: `export async function awaitNamed<T extends Record<string, Promise<unknown>>>(promises: T): Promise<{ [K in keyof T]: Awaited<T[K]> }>`

- [ ] **Step 1: Record the sitemap before:** `NEXT_PUBLIC_SITE_URL=https://fiscal.ge npx tsx -e "import('./lib/seo/sitemap.ts').then(async m => console.log(JSON.stringify((await m.default()).map(e => [e.url, String(e.lastModified)]))))" > <scratch>/sitemap-before.json`
- [ ] **Step 2: Write the tests:** `awaitNamed({ a: Promise.resolve(1), b: Promise.resolve("x") })` resolves to `{ a: 1, b: "x" }`; `awaitNamed({ a: Promise.reject(new Error("boom")) })` rejects with `"boom"`.
- [ ] **Step 3: Run** `npx vitest run tests/lib/awaitNamed.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 4: Implement** with one `Promise.all` over `Object.entries`. In `sitemap.ts`, replace the positional destructuring with `const data = await awaitNamed({ landing: loadServedLandingData(), municipal: loadServedMunicipalData(), debt: loadServedGovernmentDebtData(), … })` (one key per loader, named after its dataset), and read `data.crime.facts` and so on.
- [ ] **Step 5: Verify:** the Step 2 tests pass; `npx vitest run tests/seo` passes (includes `sitemapHubDates.test.ts`); rerunning Step 1 into `sitemap-after.json` gives a file identical to `sitemap-before.json`.
- [ ] **Step 6: Commit** — `refactor(seo): load the sitemap's datasets by name, not by position`

### Task 7: Excel files round calculated values as the page does (R8)

**Files:**
- Modify: `apps/web/lib/explorer/format.ts` (add the helper next to `roundForDisplay`)
- Modify: `apps/web/lib/explorer/crimeWorkbook.ts:40`, `socialWorkbook.ts:76`, `demographyMarriageWorkbook.ts:37`
- Test: `apps/web/tests/explorer/format.test.ts`, `apps/web/tests/explorer/crime.test.ts`

**Interfaces:**
- Produces: `export function roundShown(value: number | null, decimals: number): number | null` (null stays null; otherwise `roundForDisplay(value, decimals)`)

- [ ] **Step 1: Write the tests.** In `format.test.ts`: `roundShown(0.95, 1)` is `1`, `roundShown(1.45, 1)` is `1.5`, `roundShown(-0.95, 1)` is `-1`, `roundShown(230.44, 1)` is `230.4`, `roundShown(null, 1)` is `null`. In `crime.test.ts`, build the convictions workbook in `per100k` for 2004–2004 with `facts = [{ year: 2004, indicatorId: "crime.convicted.total", sourceId: "geostat_crime_convicts_types", unit: "persons", value: 19 }]` and `population = [{ year: 2004, persons: 2_000_000 }]` (the existing `SOURCES`, `LABELS`, `state()` and `presentationFor("en")`), and expect `model.analysis.rows[0]![2]` to be `1`. Today it is `0.9`.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/format.test.ts tests/explorer/crime.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `roundShown`, and replace the three `Number(value.toFixed(…))` expressions with `roundShown(value, …)`. Social keeps rounding only the derived series.
- [ ] **Step 4: Run** the Step 2 files plus `tests/explorer/social.test.ts tests/explorer/demographyMarriageWorkbook.test.ts`. Expected: PASS, with existing values such as 230.4 and 5.7 unchanged.
- [ ] **Step 5: Commit** — `fix(workbooks): round calculated values as the page shows them`

### Task 8: One source for the "2025 prices" year (R9)

**Files:** `apps/web/lib/explorer/social.ts:135`; test `apps/web/tests/explorer/social.test.ts`

- [ ] **Step 1: Write the test:** for `en` and `ka`, `message(messages, "social.series.social.pension.avg_monthly#real")` contains `String(SOCIAL_PRICE_BASE_YEAR)`, and `atPrices` with no third argument uses `SOCIAL_PRICE_BASE_YEAR` (the 2025 value equals the served 2025 average).
- [ ] **Step 2: Run** `npx vitest run tests/explorer/social.test.ts`. Expected: FAIL (constant missing).
- [ ] **Step 3: Add** `export const SOCIAL_PRICE_BASE_YEAR = 2025;` and make it the default of `atPrices`. Leave the labels' text as it is: the translation helper throws on a missing placeholder, so a `{year}` placeholder would risk every caller; the test ties them together instead.
- [ ] **Step 4: Run** Step 2 again. Expected: PASS.
- [ ] **Step 5: Commit** — `refactor(social): name the price base year once and tie its labels to it`

### Task 9: An automated accessibility check (R10)

**Files:** `apps/web/package.json` (devDependency), `apps/web/tests/browser/accessibility-polish.spec.ts` (one new test)

- [ ] **Step 1: Pin the scanner** already in the lockfile: `npm install --save-dev --save-exact axe-core@4.11.4`. Expected: the lockfile's axe-core entry is unchanged apart from becoming a direct dependency.
- [ ] **Step 2: Write the test** `"every hub, its first page and the site pages pass axe WCAG 2.1 A and AA on a phone"`: at 375×812, visit each `NAV_TREE` hub `href` and its `sections[0]?.href`, plus `/`, `/methodology`, `/connect` and `/about`. Inject `node_modules/axe-core/axe.min.js` with `page.addScriptTag({ path })`, run `axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })`, and expect `violations` mapped to `id + target` to equal `[]` per page.
- [ ] **Step 3: Run** it against a production build. Expected: FAIL on `/about`, `color-contrast` on the mission band's `aria-hidden` "01" (`#B3402A` on `#1E1B16`, 3.01:1).
- [ ] **Step 4: Exclude** only that element (`exclude: [['[data-testid="mission-cover"] [aria-hidden="true"] strong']]`), with a comment: decorative and hidden from assistive technology, so WCAG 1.4.3's incidental-text exception applies, and its colour is `DESIGN.md`'s to change. Rerun. Expected: PASS for all 44 pages.
- [ ] **Step 5: Commit** — `test(a11y): scan every hub with axe at phone width`

### Task 10: Take the open Dependabot updates (R11)

**Files:** `.github/workflows/ci.yml` (`actions/cache`, `actions/download-artifact`), `apps/web/package.json` + lockfile (`dotenv`)

- [ ] **Step 1: Read** the release notes from v4 to v6 (`actions/cache`) and from v4 to v8 (`actions/download-artifact`); compare them with the `Download the build` step (`name: next-build`, its `path`) and the cache steps. Write any behaviour change and the matching edit in the PR description.
- [ ] **Step 2: Update** the two actions in `ci.yml` (every job that uses them).
- [ ] **Step 3: Update** dotenv: `npm install --save-dev --save-exact dotenv@18.0.5`, then read `node_modules/dotenv/CHANGELOG.md` for 18.0.0. `prisma.config.ts` calls `loadEnv({ path, quiet: true })`; confirm that option still exists. Verify: `npx prisma validate` succeeds without a `.env`.
- [ ] **Step 4: Verify** in CI: all jobs green, and the browser job still finds the build it downloads.
- [ ] **Step 5: Commit** — `chore(deps): actions/cache 6, download-artifact 8, dotenv 18`. After merge, Dependabot closes #195, #196 and #149.

---

## Not in this plan

- D2–D4 above (owner decisions, each needing its own spec).
- A shared hub-card builder: ten builders share a pattern, but the common part is about four lines each; the rest is per-hub content.
- The 17-digit `value` column in the CSVs (e.g. `644.20000000000005`): an existing convention; pages and Excel use `published_value`.
- Browser-test sharding: the step takes 13 of its 45 minutes. Revisit when it passes 25.
- `scripts/import-budget-facts.ts` positional loading: its results have distinct types, so a swap fails the typecheck.
