# Fiscal.ge Bilingual Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This document authorizes no agent dispatch by itself; follow the active session's delegation instructions.

**Goal:** Deliver complete Georgian and English versions of the current website, Excel exports, and AI data service using identical reviewed figures.

**Architecture:** Two thin page trees share components and calculations. Build-time translation catalogues supply localized display data to the website and a bundled bilingual snapshot to `/mcp`. The work is divided into three linked implementation plans with one release gate.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, strict TypeScript, Tailwind 4, existing Zod/Vitest/Playwright, ExcelJS 4.4.0, MCP SDK 1.30.0. Node 24.x. No new translation service, UI framework, database migration, or localization dependency.

**Spec:** [Approved bilingual design](../specs/2026-09-05-fiscal-bilingual-design.md).

**Planning baseline:** application commit `1cf524f29`; design commit `5922ff878`; planning checkout `C:\Users\Mylaptop\.codex\worktrees\88c7\Geodata.ge`, branch `codex/bilingual-site-design`. Recheck these at execution time. Task boxes below mean work to perform; none is marked implemented by this plan.

## Global Constraints

These apply to all three linked plans.

- Georgian stays at all existing page addresses; English equivalents use `/en`.
- Both languages use the same reviewed facts, calculations, source documents, and editorial design.
- The page address determines its language, including direct visits and reloads.
- There is no request-time language middleware and no use of request headers or cookies to choose page content.
- `/mcp` remains the sole request-time application route.
- Keep one endpoint, `/mcp`, and the same nine tool names and input contracts.
- Publish schema version `1.1.0` for the additive language contract.
- Preserve the current input limits, 500-cell limit, 250-comparison-pair limit, ranking limits, 512 KiB complete-result cap, duration cap, rate limiter, and pause behaviour.
- English workbooks have exactly three sheets: `Summary`, `Data`, and `Sources`.
- Georgian filenames retain their existing form; English files add `-en` before `.xlsx`.
- Do not translate IDs or hash keys.
- Runtime visitors never receive an automatic translation.
- Original source files remain original. Their descriptions are translated and their document language is identified where verified.
- English text does not silently fall back to Georgian or a technical identifier.
- Do not edit reviewed facts, original archives, mirror schemas, or the database for translation. Do not manually run `data:import` for this work. The existing authorized production pipeline may run its normal idempotent import during release.
- Keep current Georgian public copy, selection ordering, numeric precision, chart colours, default selections, data boundaries, and caveats. No shadcn or visual redesign.
- No partial English launch: keep implementation on the feature branch until the complete release gate passes. Existing preview hosting supplies noindex; do not add a product-facing partial-translation mode.
- Commands below run in `apps/web` unless labelled **repository root**. Git commands must stage only the current task's named files, including a matching historical path when a file moves. Never use a blanket `git add .`.

## Plan map and order

| Part | Tasks | Independently verifiable result |
|---|---|---|
| [1. Shared foundation](2026-09-05-fiscal-bilingual-foundation.md) | F1–F4 | Audited baseline, strict translation data, language-aware page roots, working state-preserving switch. |
| [2. Website and downloads](2026-09-05-fiscal-bilingual-website.md) | W1–W9 | Complete English public pages, methodology, real Excel files, localized search/share metadata. |
| [3. AI service and publications](2026-09-05-fiscal-bilingual-ai.md) | A1–A5 | Reviewed bilingual output across nine tools and all JSON publications, with unchanged operating limits. |
| This master plan | V1–V2 | Integrated acceptance evidence, then authorized production delivery. |

Recommended inline order: F1 → F2 → F3 → F4 → W1 → W2 → W3 → W4 → A1 → A2 → W5 → W6 → W7 → W8 → A3 → A4 → A5 → W9 → V1 → authorized V2. After A2, demonstrate the complete expenditure experience and its bilingual service response together. A1 is independent of the website work after F3 and can be scheduled earlier if useful. Do not edit shared files simultaneously in one checkout. This dependency statement does not authorize delegation.

For each code task: first write the specified behavioural regression, confirm it fails for the expected missing behaviour, implement the bounded change, run its focused checks, inspect the diff, and commit. Do not freeze incorrect financial outputs to get a test passing. Editorial translation steps require completeness and meaning review rather than artificial tests of prose quality.

## Files and ownership

| Owner | New or adapted files | Responsibility |
|---|---|---|
| F2 | `apps/web/lib/i18n/types.ts`, `routes.ts`, `messages.ts`, `provider.tsx`, `search.ts`, `messages/{ka,en}/common.json` | Locale, scoped interface text, link construction, predictable search. |
| F3 | `data/localization/en/{labels,programme-history,sources,documents}.json`; `apps/web/lib/i18n/{catalogue.server,inventory.server,labels,validation}.ts`; `apps/web/scripts/check-localization.ts` | Reviewed translation records and coverage without database changes. |
| F4 | `apps/web/app/(ka)/`, `apps/web/app/(en)/en/`, `apps/web/app/global-not-found.tsx`, `apps/web/components/site/{root-document,language-switch}.tsx`, `apps/web/lib/pages/` | Thin routes, correct document language, shared renderers and navigation. |
| W1–W9 | Existing explorer, analysis, municipal, debt, deficit, landing, methodology, export, and SEO files; scoped dictionaries | Public presentation; no copied numerical logic. |
| A1–A5 | Existing `factQuery` and `mcp` modules; new `lib/factQuery/localization.ts`, `data/localization/{ka,en}/service-messages.json` | Snapshot-pinned bilingual service output and versioning. |
| V1 | New `scripts/measure-bilingual-output.ts`; existing CI/check commands; release evidence under `.tmp/bilingual/` | Integrated evidence and performance/size comparison. |

Detailed tasks below and in linked plans define every new exported interface. Existing types not redefined there retain their current fields and meaning. Literal code in the plans is implementation/test guidance, not code already present in the application.

## Verification commands and environment

Use an isolated port for the implementation checkout. The following commands use 3217 after confirming it is free; if occupied, choose another unused port and keep the same value throughout. Do not stop another task's server.

```powershell
# Repository root: first execution inspection
git status --short --branch
git log -1 --oneline
git worktree list
Get-NetTCPConnection -LocalPort 3217 -ErrorAction SilentlyContinue

# apps/web: baseline/final application checks
npm ci
npm run check
npm run build
npx vitest run tests/factQuery/reference.test.ts
```

Install dependencies only if missing or the lockfile changed. Read the installed Next.js documentation before executing the route migration. Keep commands sequential so an earlier failure cannot be mistaken for a later successful exit. A documentation-only planning commit does not require these application commands.

Start the production server in a managed terminal session with `npm run start -- --port 3217`. If using PowerShell `Start-Process`, use `-WindowStyle Hidden`, an explicit working directory, separate log files under `.tmp/bilingual/`, and record the resulting PID. Stop only that PID at cleanup. Do not run a hidden helper with an unverified computed command path.

```powershell
# apps/web: tests against the server started from this checkout
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:3217'
$env:PW_WORKERS = '4'
npm run test:browser
```

Four browser workers are appropriate for the production server, not a cold development server. Honour `tests/browser/test-base-url.ts`; remove any hardcoded base URLs encountered within the tests touched by this work. Browser checks must inspect visible output, not just source-text patterns.

## Task V1: Integrate and verify the whole bilingual experience

**Depends on:** all F, W, and A tasks.

**Files:** Create `apps/web/scripts/measure-bilingual-output.ts`, `apps/web/tests/browser/bilingual-complete.spec.ts`; modify `apps/web/package.json`, `.github/workflows/ci.yml` only to run checks not already covered by the existing commands. Update `Project_Definition.md`, `DESIGN.md`, `docs/data-methodology/{ai-grounding-and-caveats,ai-reference-intents,public-methodology-and-source-archives}.md`, and `docs/deployment.md` for the bounded bilingual contracts. Reports go in `.tmp/bilingual/`, never tracked generated source trees.

**Interfaces:** Consume `listPublicPagePaths()` from F3, locale links/messages from F2, `checkLocalization()` from F3, and `measureBilingualOutput(baseUrl: string, outputDirectory: string): Promise<void>` defined here. The measurement entry point is `npx tsx scripts/measure-bilingual-output.ts --base-url http://localhost:3217 --output ../../.tmp/bilingual/final`.

- [x] Capture a final translation inventory with `npx tsx scripts/check-localization.ts --check`. Require zero missing, blank, mismatched-variable, unreviewed, or unintended Georgian-display entries. Explicit original-language fragments require an accompanying explanation and language markup.
- [x] Add this HTTP/browser assertion, importing `listPublicPagePaths` from `../../lib/i18n/inventory.server` and `pageHref` from `../../lib/i18n/routes`. Add separate interaction tests for every page family rather than treating HTTP coverage as interaction proof.

```ts
test('every public page has two working document languages', async ({ request }) => {
  for (const path of await listPublicPagePaths()) {
    for (const locale of ['ka', 'en'] as const) {
      const response = await request.get(pageHref(path, locale));
      expect(response.status(), `${locale}:${path}`).toBe(200);
      expect(await response.text()).toMatch(new RegExp(`<html[^>]*lang="${locale}"`));
    }
  }
});
```

- [x] Implement the measurement script using `node:fs/promises` plus `fetch`. Read the route inventory; record status, raw HTML bytes, referenced script/font URLs, and compressed transfer bytes when provided by HTTP headers. Read the generated snapshot and publication manifest for bytes/hashes. Record the static/dynamic route inventory from the build output. Do not relabel uncompressed bytes as network transfer size.

```ts
export async function measureBilingualOutput(baseUrl: string, outputDirectory: string): Promise<void> {
  const rows = [];
  for (const path of await listPublicPagePaths()) {
    for (const locale of ['ka', 'en'] as const) {
      const response = await fetch(new URL(pageHref(path, locale), baseUrl));
      const html = await response.text();
      rows.push({ path, locale, status: response.status, htmlBytes: Buffer.byteLength(html) });
    }
  }
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(join(outputDirectory, 'pages.json'), JSON.stringify(rows, null, 2));
}
```

The script's remaining named outputs are `assets.json` (deduplicated script/font URLs and measured bytes), `publications.json` (actual generated bytes/hashes), and `comparison.md` (differences from F1/A1 baselines). Import `mkdir` and `writeFile` from `node:fs/promises`, `join` from `node:path`, and the F2/F3 route helpers used above.

- [x] Run the focused new test first, then `npm run check`, `npm run build`, the unchanged reference fixture, and the full browser suite against that new build. Confirm all counts and exits; a repeated old server must not supply the evidence.
- [x] Inspect actual English and Georgian screens at 390, 768, and 1440 pixels. Cover every family, collapsed sidebar, mobile navigation, long programme names, map/tooltips, and keyboard use. Open one real workbook per exporter family and check all sheets. Save screenshots and workbook inspection notes with the checked commit.
- [x] Use `measure-bilingual-output.ts` and A4's service measurements to compare against baseline. Record actual build duration, prerendered route counts, JavaScript/font growth, snapshot size, JSON sizes, and newly oversized MCP requests. Investigate unjustified duplicated data or whole-site dictionaries in route bundles. Keep existing result limits; do not silently trim evidence.
- [x] Validate CSV and database loader parity using the same presentation catalogue. Unit fixtures must cover both loader shapes without credentials. If authorized read-only database credentials exist, also run a db-mode build and compare the service `dataVersion` to the CSV-mode build of identical reviewed data. Otherwise report that boundary and require the existing production pipeline's db-mode proof before declaring release complete. Do not request or print secret values.
- [x] Update the canonical documents listed above, retaining the shipped V1 record and existing deployment ownership. Record the schema upgrade, original-document exceptions, no-runtime-translation rule, review process for future additions, and measurement results.
- [x] Review the final diff for numerical/mapping changes and accidental edits outside scope. Commit only the final verification additions and canonical documentation after their checks pass; suggested message: `test: verify complete bilingual release and document contracts`.

**Done:** every acceptance row in design section 12 has fresh evidence tied to the checked commit. None is inferred from plan checkboxes. Implementation may be complete locally while publishing remains unauthorized.

> V1 completed locally on 2026-09-06. The final check passed 182 files / 1,750 tests, including all 24 unchanged numerical reference intents and the new CSV/database-loader fixture. The production build passed in 46.13 seconds with 191 static-generation entries, both static social resources, only /mcp dynamic and all ten publication hashes verified. The preview at http://127.0.0.1:3217 was restarted from this build; its application-source/release commit is 0ae5228c7. The following verification commit adds only tests, the measurement script and documentation.

> The final complete browser suite passed all 443 checks against that build. It covers all 182 initial-HTML and hydrated page variants, stateful navigation, bilingual search, mobile/sidebar/keyboard/chart behaviour, English metadata/social assets, real 404 recovery and workbook export. One earlier run exposed an assertion comparing a comma with its equivalent %2C encoding; the assertion now compares every decoded setting and still checks table values. The six focused national cases and the full 443-test repetition both passed.

> Visual evidence contains 84 screens across 14 page cases, both languages and widths 390/768/1440, with no page errors or horizontal overflow; family screenshots and comparison sheets were inspected. Twenty-eight actual browser workbooks (14 language pairs) were reopened and all three sheets inspected. The 122 distinct local archive hyperlinks returned HTTP 200; two original external URLs were preserved and were not revalidated externally in this task. All original snapshot fields, facts and source records match F1 exactly after excluding version/release metadata and added fields. Reviewed CSVs, taxonomy, source manifests, database readers, Prisma schema and the lockfile have no changes.

> Performance evidence: 182 pages, 30 distinct referenced assets, ten JSON files and the same 33 MCP requests were measured. Emitted client JavaScript grew 6.2% (2,404,505 to 2,553,522 decoded bytes); fonts stayed at 335,992 bytes. Snapshot size grew from 3,485,225 to 3,760,913 bytes. English homepage/expenditure/methodology HTML remains at or below the reconstructed baseline sizes. Route presentation loads selected-language message scopes and selected label IDs; no whole-site dictionary or complete service snapshot is sent in the client bundle. The only newly oversized measured MCP request is the first 100-source batch at 696,073 complete bytes; existing limits and explicit refusal guidance remain intact. Full figures and byte/transfer distinctions are in .tmp/bilingual/final/comparison.md. The detached baseline build is retained under .tmp/bilingual/baseline-checkout for reproducibility.

> No local database credentials were present. The credential-free fixture exercised both real serving branches with reviewed mirror-shaped rows, proved the same bilingual snapshot and presentation, and verified a changed amount still fails parity. This does not claim a live database-mode build. The existing CI commands already cover the new tests and prebuild translation validation; no redundant package or workflow change was needed. Publishing remains unauthorized: V2, CI/merge/deployment, live database parity and production URL proof are pending.

## Task V2: Authorized publication and production proof

**Depends on:** V1 and publishing authorization from the active session.

**Files:** no planned implementation files. Follow `docs/deployment.md`; update a release record only if this release produces a durable operational change.

**Interfaces:** the release is a matching website, translation snapshot, and public-download set from one reviewed commit. No direct implementation push to `main`.

- [ ] Recheck branch, local changes, remote state, and worktrees before delivery. Preserve unrelated work and user-owned checkouts.
- [ ] When authorized, push the feature branch, create a draft PR, obtain required green CI, perform review and resolve conversations, then merge through the existing delivery sequence. Do not create a duplicate implementation PR if one already exists.
- [ ] Confirm the Actions-owned deployment pipeline and Vercel deployment both succeed. Verify Vercel `READY` and its deployed commit; a green trigger alone is insufficient.
- [ ] Inspect paired homepage, expenditure, analysis, Batumi, a region, country aggregate, debt, deficit, methodology, About, and connection URLs on production. Verify response language/canonical/alternates, language switching with hash settings, one real English XLSX, representative unchanged archive hashes, the shared manifest, and nine-tool MCP smoke coverage within rate limits.
- [ ] Verify production schema `1.1.0`, service/publication matching `dataVersion`, and bilingual text/structured fields. Also run a representative legacy request without any language parameter.
- [ ] Synchronize only the explicitly intended checkout, report the merge/deployment evidence, and delete the merged feature branch according to repository workflow. Retain user-owned worktrees. A rollback must restore the matching website and snapshot/publications together.

**Done:** the report distinguishes local verification, merged state, deployed commit, and live checks. If publication was not requested, stop after V1 and report the local delivery state.

## Spec coverage and execution handoff

| Design sections | Implementation owners |
|---|---|
| 1–2: outcome and existing gaps | F1, F3, W1–W9, A1–A5 |
| 3–5: URLs, navigation, static architecture | F2, F4, W9, V1 |
| 6: translation ownership/completeness | F2–F3, W4, A1, V1 |
| 7: editorial, fiscal, visual rules | F3, W1–W8, A2–A3, V1 |
| 8: methodology, archives, Excel | W3–W4, A3, V1 |
| 9–10: AI, publications, limits | A1–A5, V1 |
| 11: search/sharing/discovery | F2, W9, A5 |
| 12: verification | all focused tests, V1 |
| 13–14: sequencing, release, canonical docs | this plan, V1–V2 |
| 15: references | F1 documentation check and the approved design |

Execution can use inline stages with `executing-plans`, or delegated task workers if the owner chooses that approach and the active session permits it. The present request is to write the plan; no task execution or publishing is implied by saving these documents.
