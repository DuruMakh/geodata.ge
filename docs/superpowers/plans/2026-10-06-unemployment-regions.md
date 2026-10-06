# Unemployment regions implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved bounded change in this session. Preserve the existing uncommitted overview work.

**Goal:** Reuse Economy's region map and list, opening a separate unemployment page per region with overview-style indicator checkboxes.

**Architecture:** Share the existing map geometry, map interactions and ranked-list layout between Economy and Unemployment. Add static regional unemployment routes and extend the existing unemployment selection/model/export with a fixed region context. Retain the former comparison behind historical/shared links.

**Tech Stack:** Next.js 16, React, TypeScript, existing editorial components and reviewed CSV facts.

**Spec:** `docs/superpowers/specs/2026-10-04-unemployment-reuse-explorer-design.md`, regional amendment approved in chat on 2026-10-06.

## Global constraints

- Only regions are selectable on the map; retain non-interactive occupied-area overlays.
- Derive years and values from served facts; keep historical combined regions distinct.
- Reuse overview's mutually exclusive percentage/count selection and existing downloads.
- Preserve age/gender behavior and concurrent overview edits; no publishing or database writes.

## Review focus

- Map labels, colours and ordering must reflect unemployment percentages, with no GDP/GEL text.
- Region pages use their own published coverage, including 2017/2019 starts.
- Invalid or cross-region saved selections cannot load another region's figures.
- Keyboard/map/list navigation and language switches retain the correct destination/settings.
- Excel contains selected region/indicators, correct units, missing-value status and original links.

### Task 1: Reused map and index

- [x] Write and run regional tests showing eleven real paths, percentage ranking and static route destinations; expect failure before implementation.
- [x] Share Economy's geometry, map and list using concrete metric/route inputs. Build an unemployment map from latest regional unemployment-rate facts.
- [x] Run `npx vitest run --configLoader native tests/explorer/unemploymentRegions.test.tsx tests/explorer/regionalEconomyMap.test.ts tests/explorer/regionalEconomiesIndex.test.tsx --maxWorkers=1`; expect all implemented map tests and existing Economy checks to pass.

### Task 2: Regional pages and selection

- [x] Extend regional tests for defaults, unit exclusion, saved settings, region-specific years and workbook values; watch failures.
- [x] Add eleven static region pages in each language; reuse existing indicator selector, chart, table, range and Excel. Reuse region picker destinations.
- [x] Keep legacy comparison links functional, with the same indicator selection rules; update scope, design, methodology, route inventory, revisions and sitemap.
- [x] Run focused unemployment, routing, localization and Economy checks; expect all to pass.

### Task 3: Verification and review

- [x] Add browser coverage for map/list sync, keyboard navigation, region picker, units, downloads, legacy links and both languages/mobile widths.
- [x] Run `npm run check`, `npm run build` and `npm run test:browser` sequentially once final inputs are ready; expect exit 0. Inspect desktop/mobile screenshots.
- [x] Obtain a read-only fresh review, address verified issues and rerun only affected checks.
- [x] Report local preview and verified outcome. Leave mixed work uncommitted and unpublished.

## Execution ledger

Pre-flight: map model feeds shared UI; fixed region context feeds selection/model/export. Existing interfaces will remain backward compatible for Economy and age/gender.

Ruling: Continue with the user's already approved regional flow without another plan approval. Implement inline and use one independent final reviewer as required by the review skill.

Ruling: Preserve old multi-region comparisons through index hash links and a historical comparison link. This retains reviewed combined-region data without drawing composite boundaries or assigning its values to modern regions.

Task 1/2: implemented and verified. Initial new suite failed because the feature modules did not exist; Economy baseline was 5/5. The focused final run passed 59/59 across ten affected files. Typecheck and lint passed. After replacing a browser-incompatible external JSON import with the existing server region loader, the regional suite passed 10/10 and typecheck passed again.

Final review: one read-only fresh reviewer found no Critical or Important issues. Final: minor (deferred): the historical comparison shares the map index's introduction; dedicated comparison wording is a future polish change.

Final: Ruling: concurrent overview/data work and external delivery are outside this region change; preserve their current files and do not publish. Changing regions starts that region's default selection, matching the reused Economy picker. Browser appearance/runtime will be judged by the browser completion gate and screenshot inspection, not source review alone.

Browser finding: the 768px list link failed in both languages because a hover tooltip inserted above the stacked list shifted the click target. The shared map tooltip now overlays the map without changing layout. These failing real-browser scenarios provide the RED check; rerun after rebuilding is the GREEN check. Economy also receives the stable tooltip as the shared consumer.

Task 3: complete. Both failing tablet checks passed after the tooltip fix. Final build exited 0 and prerendered all eleven regional pages in each language. `npm run check` exited 0: 3,000 passed tests, seven pre-existing skips, 3,238 unemployment observations validated, 138 public page identities localized. The full `npm run test:browser` exited 0 with 696/696 passing, including Economy and unemployment navigation, charts, tables, units, Excel, source archives and bilingual/static discovery. Georgian desktop map and mobile region screenshots were inspected. `git diff --check` passed. Preview: http://localhost:3127/explorer/unemployment/regions. HEAD remains 8ad8872f; mixed changes remain uncommitted and unpublished.

Approved follow-ups: remove hover/focus data popups from the Unemployment, Economy and municipal Budget maps; retain map/list highlights, navigation and complete accessible target names. Remove obsolete popup positioning/state and its retired resize check. Move the unemployment region picker into the H1 as the same accent-coloured, dashed-underlined name button used by Economy, removing the separate control below the title. Update the canonical design and bilingual heading lead.

Follow-up verification: final build and `npm run check` exited 0 with 3,000 tests passed and seven existing skips. The popup behavior was reproduced by two failing browser scenarios before removal; all five affected map interaction checks then passed. Three heading assertions failed before implementation and passed afterward; all eleven regional browser checks passed on mobile/tablet/desktop in both languages. Desktop Georgian and long-name mobile English screenshots were inspected. Final full browser run: 694 passed with one old English municipal check still expecting the removed popup; that expectation was updated, and its targeted rerun plus changed-file lint passed. All 695 current scenarios are verified across that run and targeted correction. Changes remain local and uncommitted.

The later full-worktree review's four interface findings, including the previously deferred comparison introduction, are addressed in `2026-10-06-unemployment-review-fixes.md`; that ledger records their regression and completion checks.
