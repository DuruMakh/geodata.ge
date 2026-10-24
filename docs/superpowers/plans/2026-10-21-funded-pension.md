# Funded pension page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/explorer/health/funded-pension` (and `/en/...`): the Pension Fund's 2019–2025 savings, money in and out, members, employers and return, as a fifth social protection page.

**Architecture:** A new research package (`docs/Raw Data/Social/pension-fund/`) extracts 99 values from the Pension Fund's PDFs once, offline. `prepareSocialData` appends them to the existing `social-protection-annual.csv` / `SocialFact` mirror, so there is no new table. The page is a third `SocialTopicId` rendered by the existing `SocialExplorer` / `renderSocialTopicPage`.

**Tech Stack:** Next.js 16, strict TypeScript, Vitest, Playwright, Python 3 + poppler `pdftotext` (package extraction only, never in CI).

**Spec:** `docs/superpowers/specs/2026-10-21-funded-pension-design.md`

## Global Constraints

- Years 2019–2025 only. Georgia only (`country.georgia`).
- Under the heading: only "2025: 8.24 billion GEL in pension savings" (ka proposal: "2025: 8.24 მლრდ ლარი საპენსიო დანაზოგში"), one line at 390px.
- No tabs. All rows visible under headings. One heading charted at a time. Default selection: `social.funded_pension.savings.amount` only.
- Gaps are gaps, never zero. A value the statement does not print is absent.
- Money is stored in GEL (= printed thousands × 1000), shown in million GEL to one decimal; % of GDP to two decimals; return to one decimal; counts whole.
- `months`: 1 for stocks and cumulative counts (savings, net assets, members, employers); 12 for flows and the return.
- Every served value has `valueStatus = official`; only the % of GDP view is calculated.
- Reuse first: no new component, table, migration, chart or icon family. Icons are Lucide.
- No push, PR, CI or full gate before Duru sees screenshots and a preview (Task 8).

## Expected values (the fixture every task checks against)

Money in thousand GEL as printed (stored × 1000):

| measure | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| savings | 508,031 | 1,164,657 | 1,980,291 | 2,947,151 | 4,357,160 | 6,060,268 | 8,237,530 |
| net_assets | 547,844 | 1,213,129 | 2,048,024 | 3,027,208 | 4,484,620 | 6,191,340 | 8,365,433 |
| contributions | 548,315 | 571,148 | 658,014 | 802,753 | 996,862 | 1,179,226 | 1,431,780 |
| contributions_private | 294,314 | 319,679 | 375,117 | 469,120 | 587,066 | 692,043 | 843,224 |
| contributions_public | 88,663 | 85,307 | 94,283 | 108,859 | 137,625 | 175,799 | 217,567 |
| contributions_state | 165,338 | 166,162 | 188,614 | 224,774 | 272,171 | 311,384 | 370,989 |
| interest | 17,038 | 87,026 | 163,741 | 218,227 | 254,614 | 356,201 | 461,555 |
| securities_gains | — | — | — | −31,187 | 168,430 | 197,986 | 319,147 |
| dividends | — | — | — | 3,543 | 18,598 | 25,485 | 33,223 |
| payouts | 57,322 | 1,548 | 1,988 | 5,787 | 15,014 | 40,110 | 63,609 |

Counts and return (2025 annual report):

| measure | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 |
|---|---|---|---|---|---|---|---|
| members | 958,226 | 1,105,041 | 1,234,732 | 1,359,035 | 1,478,720 | 1,581,832 | 1,705,365 |
| left | 164,198 | 3,098 | 1,605 | 1,218 | 1,165 | 727 | 540 |
| paid_persons | 185 | 466 | 839 | 1,853 | 3,747 | 8,363 | 11,367 |
| employers | 61,173 | 71,600 | 82,801 | 94,994 | 108,047 | 119,966 | 145,780 |
| return (%) | 6.1 | 12.9 | 9.5 | 7.3 | 12.3 | 11.5 | 11.8 |

Served document per year (money): 2019 and 2020 → `2020-IFRS.pdf`; 2021 → `2022-IFRS-GE.pdf`; 2022 → `2023-IFRS-GE.pdf`; 2023 → `2024-IFRS-GE.pdf`; 2024 and 2025 → `2025-IFRS.pdf` (English). Counts and return → `Annual_Rep_2025_geo.pdf`. Source ids: `pension_fund_ifrs_2020`, `pension_fund_ifrs_2022`, `pension_fund_ifrs_2023`, `pension_fund_ifrs_2024`, `pension_fund_ifrs_2025`, `pension_fund_report_2025`.

## Review Focus

1. **% of GDP view, then a members row is ticked.** Expect the view to drop back to ₾, the switch to disappear, and the hash to lose `tab=gdp`. *Test: Task 4, "a non-money heading resets the view".*
2. **A hash naming `tab=gdp` with a members or return selection.** Expect the page to open in ₾ with that selection, not crash or show an empty chart. *Test: Task 4, same test, parse branch.*
3. **The negative 2022 securities value.** Expect it to pass validation, survive the database round trip (`socialValueText`) and show as −31.2 in the chart, the table and Excel. *Tests: Task 2, "negative and decimal values"; Task 5, workbook test.*
4. **Dividends and securities before 2022.** Expect dashes, not zeros, and the years strip still to offer 2019–2025 when Money in and out is selected. *Test: Task 4, "flows coverage".*
5. **The English latest line at 390px.** "2025: 8.24 billion GEL in pension savings" must not wrap. *Test: Task 7, the existing 390px loop gets the new URL.*

---

### Task 1: Research package

**Files:**
- Create: `docs/Raw Data/Social/pension-fund/official/` (PDFs), `source-manifest.json`, `extract.py`, `test_extract.py`, `pension-fund-annual.csv`, `validation-report.json`, `README.md`

**Interfaces:**
- Produces: `pension-fund-annual.csv` with header `measure,year,value,unit,months,source_id,document,page,line` (UTF-8 BOM). `value` is in stored units: GEL for money (printed × 1000, may be negative), whole counts, return with one decimal. `unit` ∈ `gel|persons|employers|percent`. 99 rows, sorted by measure then year, measure order as in the fixture tables.
- Produces: `validation-report.json` = `{"passed": true, "failures": [], "rows": 99, "restatements": [...], "revisions": [...]}`.
- Produces: `source-manifest.json`, a list of `{source_id, document, url, bytes, sha256, retrieved_on, used_for: "served"|"check"}`.

- [ ] **Step 1: Download the originals.** Resolve each slug via `https://site-api.pensions.ge/api/v1/embedded-doc/get?slug=<slug>` (`result.url`), then fetch `https://site-api.pensions.ge/<url>` into `official/`. Served: `2020-IFRS`, `2022-IFRS`, `2023-IFRS`, `2024-IFRS`, `2025-IFRS`, `2025-annual-report`. Check-only: `2019-IFRS` and `2019`–`2024-annual-report`. Do not keep `2021-IFRS` (it is a scanned image).
- [ ] **Step 2: Write `test_extract.py` (unittest, the SSA package's style).** Assert that `extract.extract()` returns exactly the fixture tables above. Also assert: contribution parts sum to the total every year; the restatement and revision lists equal the recorded ones; `return[2024] == "11.5"` and the recorded revision says the 2024 report's text gives 11.6.
- [ ] **Step 3: Run it.** `cd "docs/Raw Data/Social/pension-fund" && python3 -I test_extract.py`. Expected: FAIL, because `extract` is missing.
- [ ] **Step 4: Implement `extract.py`.**
  - `extract() -> list[dict]` and a `main()` that writes the CSV and the report.
  - Read text with `pdftotext -layout`. Read the return chart (2025 report, page 7) and the "left the scheme" chart with `pdftotext -bbox`: assign each `%` or number label to the nearest year label by x. The left bar of each year pair is the return.
  - Use per-document line labels, because the 2019–2020 statements say "სუბსიდია", 2022–2024 say "სახელმწიფოს საპენსიო შენატანი", and 2025 is English ("Subsidy from the State of Georgia", "Balance at 31 December").
  - Savings come from the members' liabilities note: the "ნაშთი 31 დეკემბერს" / "Balance at 31 December" line whose opening balance is the prior year's.
  - Run the spec §4 package checks. Any failure exits non-zero.
- [ ] **Step 5: Run the tests, then write the outputs.** `python3 -I test_extract.py && python3 -I extract.py`. Expected: tests PASS, 99 rows, `"passed": true`.
- [ ] **Step 6: Write `README.md`.** Cover the files, the served-document rule, the recorded restatements and revisions (including 2024's 11.5 against 11.6), and how to re-run.
- [ ] **Step 7: Commit.** `git add "docs/Raw Data/Social/pension-fund" && git commit -m "data: Pension Fund research package for the funded pension page"`

### Task 2: Types and validation

**Files:**
- Create: `apps/web/lib/data/social/fundedPension.ts`
- Modify: `apps/web/lib/data/social/types.ts`, `apps/web/lib/data/social/validation.ts`
- Test: `apps/web/tests/data/social/fundedPension.test.ts`

**Interfaces:**
- Produces (in `types.ts`):
  - `FUNDED_PENSION_MONEY = ["savings","net_assets","contributions","contributions_private","contributions_public","contributions_state","interest","securities_gains","dividends","payouts"] as const`
  - `FUNDED_PENSION_COUNTS = ["members","left","paid_persons","employers"] as const`
  - the indicators `social.funded_pension.${money}.amount`, `social.funded_pension.${count}` and `social.funded_pension.return`, appended to `SOCIAL_INDICATORS`
  - `FUNDED_PENSION_SOURCES` (the six source ids), appended to `SOCIAL_SOURCES`
  - `SocialFact.unit` gains `"employers" | "percent"`
- Produces (in `fundedPension.ts`):
  - `isFundedPension(id: string): boolean`
  - `fundedPensionUnit(id): SocialFact["unit"]`
  - `fundedPensionMonths(id): 1 | 12`
  - `fundedPensionFirstYear(id): 2019 | 2022`
  - `validateFundedPensionFacts(facts: readonly SocialFact[]): void`
- Changes `validateSocialFacts`: it calls `validateFundedPensionFacts` on the funded rows and runs every existing check on the remaining rows unchanged. `socialUnit` delegates funded ids to `fundedPensionUnit`. `socialValueText` gives `return` one decimal and keeps a negative sign.

- [ ] **Step 1: Write the failing tests** in `fundedPension.test.ts`. Build the 99 facts from the fixture and assert:
  - "the fixture passes" — no throw;
  - "negative and decimal values" — `socialValueText("social.funded_pension.securities_gains.amount", "-31187000.000000000000") === "-31187000"` and `socialValueText("social.funded_pension.return", "11.800000000000") === "11.8"`;
  - "rejects" — each case throws: a missing year, a 2018 row, a dividends row for 2021 (printed no line), a zero where none is printed, `months` 12 on savings, a value with two decimals on return, a changed anchor (spec §4 anchor table), parts ≠ total, `valueStatus: "calculated"`, and a wrong `sourceId` for a year (e.g. 2021 citing `pension_fund_ifrs_2025`).
- [ ] **Step 2: Run them.** `cd apps/web && npx vitest run tests/data/social/fundedPension.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above. The expected source per year follows the served-document table. Anchors are the spec §4 table.
- [ ] **Step 4: Run** `npx vitest run tests/data/social/` and expect PASS. The existing SSA tests must stay green: the SSA rows are untouched.
- [ ] **Step 5: Commit.** Message: `feat(data): funded pension indicators and validation`

### Task 3: Prepare, sources and archive

**Files:**
- Modify:
  - `apps/web/lib/data/social/prepareSocial.ts`, `apps/web/lib/data/social/types.ts` (`socialArchiveSourceId`)
  - `data/sources/source-documents.csv`, `data/localization/en/sources.json`
  - `data/methodology/source-archives/social-protection.csv`, `apps/web/lib/methodology/sourceInventory.ts`
- Generated: `data/imports/social-protection-annual.csv`, `data/reports/social-protection-validation.json`
- Test: `apps/web/tests/data/social/social.test.ts`

**Interfaces:**
- Produces: `prepareSocialData` also reads `docs/Raw Data/Social/pension-fund/pension-fund-annual.csv`. It checks the header, checks that there are 99 rows, verifies each cited document with `readVerifiedPackageFile` against `source-manifest.json`, and requires `validation-report.json` to have `passed: true`. It maps `measure` to an indicator and writes `sourceWorkbook = document`, `sourceSheet = page`, `sourceCell = line`.
- Produces: `socialArchiveSourceId(id)` strips the trailing `_NN` only for `ssa_` ids, so a `pension_fund_*` id is its own archive id.
- Produces: source documents `source.pension_fund_*` (six rows, Georgian names) with English names. Archive rows use `source_id` = the fact's source id, `dataset_id = social-protection`, `public_download_path = downloads/methodology/social-protection/files/<document>`, and organisation «საქართველოს საპენსიო ფონდი».

- [ ] **Step 1: Update `social.test.ts` expectations.** Set observations to 22,087 (21,988 + 99). Every `pension_fund_*` source has a source document. A tampered PDF hash makes prepare throw "Social source capture mismatch".
- [ ] **Step 2: Run them.** `npx vitest run tests/data/social/social.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**, then run `npm run data:prepare-social` and `npm run data:prepare-methodology-archives`.
- [ ] **Step 4: Check.** `npx vitest run tests/data/social/ && npm run data:check-social && npm run data:check-methodology-archives`. Expected: PASS. The diff of `social-protection-annual.csv` adds exactly 99 `social.funded_pension.*` rows.
- [ ] **Step 5: Commit.** Message: `data: serve the funded pension values in the social protection file`

### Task 4: Explorer model

**Files:**
- Modify: `apps/web/lib/explorer/social.ts`
- Test: `apps/web/tests/explorer/social.test.ts`

**Interfaces:**
- Produces:
  - `SOCIAL_SECTIONS` gains `{ id: "funded-pension", href: \`${HEALTH_HUB_PATH}/funded-pension\`, labelKey: "common.socialFundedPension" }` last
  - `SocialTopicId = "social-payments" | "social-package" | "funded-pension"`
  - `SocialHeading` gains `"savings" | "flows" | "members" | "employers" | "return"`
  - `SocialUnit` gains `"employers"`
- `socialTopicSeries("funded-pension")` returns, in spec §3 order:
  - savings (savings, net_assets), with the first row as reference;
  - flows (contributions, private, public, state, interest, securities_gains, dividends, payouts);
  - members (members, left, paid_persons);
  - employers (employers);
  - return (return).
- `socialViews(section, heading?)`:
  - Without a heading it returns every view the section has: `funded-pension` → `["amount","gdp"]`. `renderSocialTopicPage` uses this to decide whether to load GDP.
  - With a heading, `funded-pension` keeps `"gdp"` only for `savings` and `flows`.
  - The other sections ignore the heading and are unchanged.
- `socialTopicFacts("funded-pension", "gdp", …)` converts the money rows with the existing `shareOfGdp` path and leaves the other rows as they are. Generalise `socialPaymentsViewFacts` to take the section's money ids. Do not duplicate it.
- `changeSocialSelection` and `parseSocialHash` set `view = "amount"` when the resulting heading has no gdp view. `changeSocialView` takes the section (today it hardcodes `"social-payments"`).
- `socialDisplay`: savings and flows behave like `money`; members → persons, 0 decimals; employers → `employers`, 0 decimals; return → percent, 1 decimal.
- `socialSeriesColor`: the first row of each funded heading is INK; the others take the palette by their position in `FUNDED_PENSION_MONEY` (money) or `FUNDED_PENSION_COUNTS` (counts).

- [ ] **Step 1: Write the failing tests.**
  - "funded pension opens on savings in members' accounts": `defaultSocialState("funded-pension").selectedIds` is `["social.funded_pension.savings.amount"]`; the 2025 value is 8237.53; coverage is 2019–2025.
  - "funded pension lists five headings in order": the headings sequence and row ids are exactly as above.
  - "flows coverage": selecting dividends keeps the years 2019–2025 for the heading, and dividends 2019–2021 are null.
  - "a non-money heading resets the view": from a gdp state, `changeSocialSelection` to `members` gives `view: "amount"`; `parseSocialHash("#tab=gdp&series=social.funded_pension.return", …)` gives `view: "amount"`; `socialViews("funded-pension","members")` is `["amount"]`.
  - "funded pension % of GDP": savings 2025 equals `shareOfGdp(8237530000, 2025)` × 100 and is marked calculated; members are unchanged in the gdp view.
- [ ] **Step 2: Run** `npx vitest run tests/explorer/social.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** it again. Expected: PASS, the existing tests included. Update the "four sections" test to five sections.
- [ ] **Step 5: Commit.** Message: `feat(explorer): funded pension series, headings and views`

### Task 5: Page, hub card, workbook, messages and SEO

**Files:**
- Create: `apps/web/app/(ka)/explorer/health/funded-pension/page.tsx`, `apps/web/app/(en)/en/explorer/health/funded-pension/page.tsx` (copies of the social-package routes with the section changed)
- Modify:
  - `apps/web/components/social/social-explorer.tsx`: the switch shows when `socialViews(section, model.heading).length > 1`; the heading unit shows no unit for `employers` either; the `changeSocialView` call passes the section
  - `apps/web/lib/pages/social.tsx`: `latestFigure` gives billions to two decimals for `funded-pension` too; the JSON-LD `sources` are `["pension_fund", "geostat"]` for this section
  - `apps/web/lib/pages/social-places.tsx`: the `loadSocialWorkbookSources` filter also accepts `pension_fund_` rows
  - `apps/web/lib/explorer/socialHubCards.ts`: HEADLINE `funded-pension` → savings, formatted as million GEL to one decimal
  - `apps/web/lib/explorer/socialWorkbook.ts`: `SOCIAL_UNIT_KEYS.employers = "unitEmployers"`; the stem is `social-funded-pension-…`
  - `apps/web/lib/seo/datasetVocabulary.ts`: the `pension_fund` agency (ka «საქართველოს საპენსიო ფონდი», en "Pension Fund of Georgia", `https://pensions.ge`), also added to the social-protection topic sources; the measurement technique mentions the audited statements
  - `apps/web/lib/i18n/messages/{ka,en}/social.json` and `common.json`
  - `apps/web/public/llms.txt`
- Test: `tests/explorer/social.test.ts`, `tests/navigation/navTree.test.ts`, `tests/seo/routes.test.ts`, `tests/seo/agentFiles.test.ts`

**Message keys (en, with ka as proposals for proofreading):**

| Key | English | Georgian |
| --- | --- | --- |
| `common.socialFundedPension` | Funded pension | დაგროვებითი პენსია |
| `social.page.funded-pension.title` | Funded pension | დაგროვებითი პენსია |
| `social.page.funded-pension.summary` | Savings, contributions, members and returns of Georgia's funded pension scheme, year by year. | |
| `social.page.funded-pension.metaTitle` | Funded pension in Georgia | |
| `social.latest.funded-pension` | {period}: {value} billion GEL in pension savings | {period}: {value} მლრდ ლარი საპენსიო დანაზოგში |
| `social.sourceNote.funded-pension` | Source: Pension Fund of Georgia | წყარო: საქართველოს საპენსიო ფონდი |

Heading keys:

| Key | English |
| --- | --- |
| `social.heading.savings` | Savings, end of year |
| `social.heading.flows` | Money in and out |
| `social.heading.members` | Members |
| `social.heading.employers` | Employers |
| `social.heading.return` | Return |

Series labels (`social.series.<id>`), in English:

| Series | English |
| --- | --- |
| savings | In members' accounts |
| net_assets | Total fund assets |
| contributions | All contributions |
| contributions_private | Private-sector employers and staff |
| contributions_public | Public-sector employers and staff |
| contributions_state | State budget contribution |
| interest | Interest earned |
| securities_gains | Gains or losses on securities |
| dividends | Dividends |
| payouts | Pensions and savings paid out |
| members | Joined since 2019 |
| left | Left the scheme |
| paid_persons | Received a pension or their savings |
| employers | Registered since 2019 |
| return | Annual return |

Unit keys: `social.unitEmployers` (en "employers").

- [ ] **Step 1: Write the failing tests.**
  - "the hub has five social cards": the fifth card's index is "08", its href ends in `/funded-pension`, and its footer is `2025 · 8,237.5 mln GEL · 2019–2025` (the en format).
  - "a funded pension flows workbook": `Money in and out` with securities selected, in ₾. Data sheet 2022 = −31.187 (million GEL), the 2019 cell is empty, and Sources lists `2023-IFRS-GE.pdf` and `2025-IFRS.pdf`. In the gdp view it is marked calculated and cites the GDP files.
  - navTree: `["/explorer/health/funded-pension", "health-funded-pension-link"]`.
  - routes: `/funded-pension` is in the sitemap in both languages.
  - agentFiles: an `llms.txt` entry for `/explorer/health/funded-pension` naming 2019–2025.
- [ ] **Step 2: Run** those four files with `npx vitest run …`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the four files, then `npm run typecheck` and `npm run i18n:check`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: funded pension page on the Health and social protection hub`

### Task 6: Methodology and documents

**Files:**
- Modify:
  - `apps/web/lib/methodology/content/social-protection.ts` and `content/en/social-protection.ts`: a "Funded pension" section covering the spec §8 bullet list
  - `docs/data-methodology/social-protection-annual.md`: the sources, the served-document rule, the checks and the recorded differences; remove "funded pensions" from the exclusion line
  - `Project_Definition.md`: the next free §2 letter after 2T, with the 2026-10-21 approvals; remove "funded pensions" from §2T's exclusions
  - `DESIGN.md` §36: the eight hub cards, the sidebar list, the page
  - `docs/data-methodology/database-import.md`: SocialFact now includes the funded pension rows
- Test: the existing methodology tests (`npx vitest run tests/methodology`)

- [ ] **Step 1: Write the content.** No causes, forecasts or advice. Keep to plain words.
- [ ] **Step 2: Run** `npx vitest run tests/methodology && npm run i18n:check`. Expected: PASS.
- [ ] **Step 3: Commit.** Message: `docs: funded pension methodology and scope`

### Task 7: Browser tests

**Files:**
- Modify: `apps/web/tests/browser/social.spec.ts`, `apps/web/tests/browser/hubs.spec.ts`, and any page-count assertion that `npx vitest run tests/seo` or the build reports

- [ ] **Step 1: Write the tests.**
  - "Funded pension: the 8.24 billion line, savings first, the % of GDP switch only on money headings, the 2022 loss". Checks:
    - the latest text;
    - five headings;
    - `social-measure-gdp` is visible on Savings;
    - ticking Members hides the switch and drops `tab=gdp` from the hash;
    - the table on securities shows −31.2 in 2022 and "—" in 2019.
  - Add `"funded-pension"` to the hubs sections list (eight cards) and to the 390px one-line loop.
- [ ] **Step 2: Build once, serve and run only these specs** (CLAUDE.md recipe, `CI=1`, port 3100): `npx playwright test tests/browser/social.spec.ts tests/browser/hubs.spec.ts`. Expected: PASS.
- [ ] **Step 3: Commit.** Message: `test: funded pension browser checks`

### Task 8: Duru review gate, then delivery

- [ ] **Step 1: Take screenshots** from the served build into `/mnt/project-files/screenshots/funded-pension/`:
  - the hub;
  - the page in ka and en, at 1440 and 390;
  - Money in and out in the table view;
  - the % of GDP view.
- [ ] **Step 2: Post the screenshots** with a decision card: "Clickable preview" / "Screenshots only" / "Looks good, go ahead". Push the branch (no PR) only for "Clickable preview", then find the Vercel URL via the GitHub statuses API.
- [ ] **Step 3: Run the full gates once, after Duru's OK.** Run `npm run check`, `npm run build` and the full browser suite against a served build. Merge `origin/main` first, because sibling threads touch the same shared files.
- [ ] **Step 4: Open a draft PR** with the attribution block, assign and request a review from DuruMakh, and subscribe to its activity.
- [ ] **Step 5: Merge only on Duru's go**, and only after any other thread's release is live. Then confirm the live commit (`/downloads/data/catalogue.json` `releaseCommit`) and the live URLs.
