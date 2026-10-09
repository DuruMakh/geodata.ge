# Trading partners local verification

The approved trends-first page combines countries and published country groups in one shared selection, with a separate end-year ranking and native Excel download. Publishing and live database operations are a separate stage.

## Reviewed code

- Checkout: `C:/Users/Mylaptop/.codex/worktrees/c66f/Geodata.ge`.
- Branch: `codex/trade-partners`.
- Independent read-only review: `83fec8bd81a247785e201b1ee2cc91aa98152eee` through `770fe966c2c4ae38ea4abdb6fe408921ff6cf65b`.
- Reviewed product fix and final production build: `e6313225ad85a09883a60d64e61da3799da5aa24`.
- The review found no Critical or Minor issues and one Important issue: the available choices used catalogue order. A failing regression reproduced it; the fix uses the current ranking's numerical/absolute-balance/missing-last/label order. Twenty model/state/render/workbook tests passed after the fix.
- A Georgian phone share heading overflow was reproduced by the browser check and fixed with a local wrapping rule. The same scenario subsequently passed.

## Evidence

- Preparation tests: 18 passed; canonical reproduction and bilingual catalogue checks passed.
- Reviewed data: 212 country identities, five groups, 12,462 primary observations and 10,530 valid derivations, covering 1995–2025. The 218 selectable choices include the reused national reference.
- Canonical CSV SHA-256: `67998f3a5348110068b7a5305394a145274333f2254c89ba7bf41455f4facf5c`.
- Serving/mirror tests: 10 passed; the guarded actual-PostgreSQL test intentionally skipped without a disposable database.
- Actual Georgian and English workbooks were generated and reopened, including mixed selections, numeric amounts, blank missing cells, actual basis and original source links.
- Final static production build and its postbuild publication/hash checks passed. Seven Trade originals total 2,134,702 bytes; the four new originals retain exact captured bytes.
- Full browser run: 748 passed out of 751. Two old inventory counts were updated for the approved new bilingual route; both inventory checks and the isolated navigation timeout passed in a three-test follow-up. Thus all 751 browser checks were resolved, with full and follow-up results recorded separately.
- The new source-registry count is 159, including five Trade workbook documents. Existing machine-snapshot assertions still exclude every Trade source; no Trade tool/dataset or central-publication entry was added. No golden query-reference expectation was changed.
- Raw XLSX preparation readers are absent from both Partners page dependency traces. The page uses the accepted serving package and thin client projection.
- Full isolated unit run: 3,121 passed, eight intentional skips and one outdated source-count assertion. The corrected file then passed all 21 checks, resolving all 3,122 unit checks across 370 files; one test file is intentionally skipped. Full-run and follow-up results are distinct.
- Full lint and type checks passed before the inventory-only test follow-ups; changed-file lint and the final full type check passed afterward.
- Final `data:validate` passed, including exact Trade Overview/Partners reproduction, methodology archives and the existing query snapshot. Final `i18n:check` passed with 532 labels and 142 public page identities.
- The combined `npm run check` attempt met contention timeouts during concurrent browser work. Its required constituent stages were subsequently completed separately without repeating unchanged passing gates. No timeout budget was widened.
- Desktop and Georgian phone previews are saved under `C:/Users/Mylaptop/.codex/visualizations/2026/10/08/01a11baa-d9ea-7950-a475-22f37321f462/` as `trading-partners-desktop.png` and `trading-partners-phone.png`. Local preview: `http://127.0.0.1:3116/en/explorer/trade/partners`.

## Execution decisions and boundaries

1. Windows rejected the Bash bookkeeping helper. Native PowerShell maintained the same plan-scoped ledger and task briefs. Risk if incorrect: a missed execution step; task progress was checked against the written plan.
2. Passing checks were retained when their inputs had not changed, instead of rerunning them through a bookkeeping wrapper. Risk if incorrect: stale verification; changed product inputs received fresh checks and builds.
3. The English workbook retains the existing `Summary / Data / Sources` names. The plan's “Simple table” wording described the existing readable sheet. Risk if incorrect: a different expected sheet label; the approved reuse requirement and real workbook tests support the existing names.
4. Ranking receives the chosen measure explicitly so its heading, signs and percentage column are determined correctly. Risk if incorrect: mislabelled values or shares; measure/denominator/signed-layout tests cover that boundary.
5. The exact original-file allowlist adds only the four approved partner workbooks. Risk if incorrect: exposing an unapproved source; seven-file inventory and original-hash checks constrain it.
6. Source-heavy checks were completed separately from the browser workload; the new XLSX preparation suite uses the existing isolated heavy group. Risk if incorrect: hiding a functional failure; full unit coverage and data reproduction remain required, without widened timeout budgets.
7. Actual PostgreSQL migration, rollback, precision and public-role restrictions were not judged as executed. The migration was generated offline with installed Prisma 7.10.0. Risk if incorrect: a database integration issue; actual database rehearsal remains required before claiming it.
8. Production deployment and live Partners routes were outside the publishing authorization. Risk if incorrect: confusing a local preview with a release; no push, PR, merge, live migration/import or deployment is claimed.
9. The two services discrepancies remain outside the separately accepted goods subset. Risk if incorrect: accepting unreconciled services figures; the frozen holds and scoped reports remain explicit.

No Minor findings were deferred from that first review. The separately requested review and focused fix follow-up are recorded below.

## Requested review including the unit-label amendment

The user invoked `superpowers:requesting-code-review` after asking for numeric chart ticks and the current Million/Billion scale beneath the heading. A fresh independent reviewer inspected `83fec8bd81a247785e201b1ee2cc91aa98152eee` through `41d10f865d3196883d44770ba5c646407631479e`, plus the uncommitted unit-label changes, without session history or checkout mutation.

The review found no Critical or Minor issues and two Important issues:

1. The Excel Summary's fixed two-decimal format displayed Qatar's USD 4,736,258.239671868 turnover in 2025 as `0.00` billion. The same problem affected 68 of 150 positive country turnover values. The fix retains the page's scale and numeric cells, deriving enough shared decimal places from the exported values to keep every nonzero amount visible. Number formats also quote the Unicode minus literal, following [Microsoft's custom-format guidance](https://support.microsoft.com/en-us/excel/review-guidelines-for-customizing-a-number-format).
2. A new accepted-year goods hold could still produce passed partner acceptance and be counted as outside scope. The fix rejects applicable country, country-group and national goods holds in either the research validation report or the source-issues file before emitting acceptance. The current two services holds remain excluded; no current trade value was found incorrect.

Both findings were reproduced with failing regressions before implementation. The same reviewer then checked the targeted fixes without repeating the full review and confirmed both resolved. Reopened actual-data workbooks in both languages display Qatar as `0.005` billion when exported alone and `0.0047363` in the complete country export. All 150 nonzero 2025 country turnovers remain visibly nonzero, with 30 true zeros and 32 blanks distinct. Repeating the applicable-hold reproduction through each issue file now rejects before any output.

Fresh verification after the fixes:

- All 19 checks in the changed preparation and workbook suites passed, including both issue records, all three accepted goods families, both languages and million/billion workbook scales, small signed amounts, true zero and blanks. The review's earlier 50 focused checks are separate evidence and are not added to this count.
- All 12 Trading partners browser checks passed against the refreshed production build, including an actual Qatar download, mixed exports, original-source bytes, language/history settings and phone/tablet/desktop layouts.
- Changed-file lint, full type checking and whitespace checks passed. The full static build and postbuild publication/hash checks passed.
- `data:check-trade-partners` reproduced the existing 22,992 observations and acceptance report exactly. Canonical data, original source files and the two services holds are unchanged.
- The user preview was rebuilt, restarted on port 3116 and reloaded with its existing saved view. Overview's chart was separately checked to retain its USD tick labels.

Coordinator rulings on every declined boundary:

1. Actual database migration, rollback, persisted decimals and public-role restrictions: accepted as a separate unexecuted rehearsal. Risk is a database integration or permission defect; runtime evidence is required before claiming database readiness.
2. Required CI, merge, deployment and production URLs: accepted as separate release operations outside this request. Risk is confusing local review with publication; none is claimed here.
3. Fresh build/browser verification and device performance: the build and affected browser checks are now complete. Full-suite reruns and dedicated performance measurements were not repeated; historical gate evidence above remains distinct from these focused results. Risk is an unrelated interaction not freshly exercised; required release checks still apply.
4. Services resolution, future captures, partial 2026, new measures, maps, detail pages and MCP expansion: accepted as outside the approved scope. Risk is broadening acceptance or product scope without review; these remain excluded.
5. Native Excel visual rendering: accepted as unexecuted. Actual workbook bytes were generated, reopened and their display formats checked, including the downloaded file; no installed-Excel visual session is claimed.

Final review assessment: both Important findings resolved; no remaining Critical, Important or Minor findings. At review completion, the unit amendment and review fixes were local and uncommitted on `codex/trade-partners`; release operations and database rehearsal were still separate.

## Integration for authorized publication

After the user authorized push, merge and synchronization, current main was integrated from `a7b24bd83d6c54a0e45c607bf357edce1aaad9d1`. Its responsive chart, phone table/navigation and Demography work remain intact. Conflicts preserve both navigation sections, both source loaders and both route/revision inventories. The chart adds only the optional unit-label setting to main's existing responsive implementation; the new sidebar child follows main's phone touch-target and menu-closing behavior. The combined inventory has 220 bilingual pairs and 440 sitemap URLs.

The same independent reviewer checked these integration changes against current main and found no new actionable defect, no changed existing translation/revision entry and no lost Demography design content. Unrelated incoming changes were not reviewed again; build/browser, CI, database, deployment and synchronization still require their own evidence.

Fresh `npm run check` passed on the integrated code: full lint/type checks, 3,406 unit tests with 11 intentional skips across 403 passing files and one skipped file, complete data validation and translation checks. The Prisma client was regenerated for the combined schema. The initial pre-integration check was stopped after discovering the newer main and is not counted as a passing gate.

The integrated static build and postbuild hashes passed. The full browser gate passed 1,100 of 1,103 checks. Two Partners phone checks assumed the old series-row table instead of main's year-row layout; they now use main's existing table helpers and verify both selected series across all three years. The legacy municipality redirect check assumed an exact pre-normalization hash; it now verifies the preserved range parameter and both range handles, retaining the existing direct-308 and target-200 checks for every code. All three failures were resolved in a five-check follow-up (including the corresponding desktop Partners cases); changed-file lint, full type checks and whitespace checks passed. Full-run and follow-up evidence remain distinct; no product behavior or timeout was changed.
