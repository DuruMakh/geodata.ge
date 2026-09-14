# AI grounding and the caveat catalogue

This document is the single owner of the caveat catalogue used by the fact-query core (`apps/web/lib/factQuery/`). Every code the core can emit is listed here with its trigger, severity, both message texts, and the methodology document that owns the underlying rule.

**A code appearing in this document is not evidence that its trigger is correct.** The firing and non-firing tests under `apps/web/tests/factQuery/caveats/` are what establish that, and they have twice caught a rule attaching a warning to figures it did not describe. Read this document to learn what a code means; read the tests to learn when it fires.

## Bilingual response contract, schema 1.1.0

The shared `/mcp` endpoint and all ten `/downloads/data/` publications use one
reviewed snapshot. Descriptions, labels, definitions, missingness, comparison
reasons and ranking explanations include Georgian and English. Caveat text is
resolved from stable snapshot message keys; its severity, comparison effect and
affected IDs are independent of the wording. `methodologyRef` retains the
original owner document. `methodologyRefEn` points to the existing public English
topic explanation: expenditure, revenue, municipalities or debt methodology, or
the deficit explorer's source and forecast explanation. These are topic links,
not invented English copies of internal documents.

Generic source/document fields preserve the original metadata and required
attribution. `*Ka` and `*En` companions are reviewed descriptions, not replacements
for original legal wording. `documentLanguage` is `null` when unverified; English
metadata does not establish that a source document is English. Narrowed source
evidence and shared document defaults retain both languages. Full source records
retain the archived byte sizes and hashes.

No language input is needed. The same nine tools and valid requests continue to
work; catalogue search accepts either language. Schema 1.1.0 is additive, so
clients rejecting unknown properties or requiring exactly 1.0.0 must update.
Translation corrections change `dataVersion`, just as other snapshot changes do.
Responses are not byte-identical to 1.0.0. The unchanged 512 KiB complete-result
limit counts both structured and text output; a source-heavy request can now
require fewer sources. `result_too_large` preserves narrower-query and shared
bulk-manifest guidance. No evidence is silently removed to make an answer fit.

Both `/connect` and `/en/connect` include paired national, municipal, debt-rate
and deficit-forecast examples. The SDK tests prove serialization and response
contracts; they do not prove an external AI client's interpretation.

## Why caveats exist at all

The query core exists so that a language model answering a question about the Georgian budget quotes reviewed figures instead of inventing them. That is only half the problem. A correct number presented without its limitation is still a wrong answer: 2004 receipts really are 2,283,035,800 GEL, and growth from that figure to 2005 is still meaningless, because the two totals count different things.

So every response carries machine-readable caveats alongside its figures, each scoped to the cells it actually describes. Severity `severe` means a reader who ignores it will likely draw a wrong conclusion. Severity `note` means the figure is sound but its context matters.

## Scoping is part of the contract

A caveat's `affects` array pins it to specific observations, normally as `seriesId:year` or `entityId:year` composites. A rule whose `affects` is coarser than the grain at which its claim is true will label figures it does not describe, and nothing in the type system catches that. Two such defects have shipped and been fixed; the precision contract is documented in `apps/web/lib/factQuery/observations.ts`. A bare id or a bare year is correct only where the claim is genuinely uniform across every cell in the request, which is why `budget_scopes_differ` is allowed to use one.

## Severity and comparison effect are different questions

Severity says how badly a reader is misled if they ignore the caveat. **Comparison effect** says something independent: whether the two endpoints of a two-year comparison still measure the same thing.

- `breaks` - the endpoints do not measure the same thing. A comparison whose endpoints disagree on this caveat is returned as `not_comparable`, with both reviewed values intact and no growth figure.
- `limits` - still answerable, but the reader must be told; the comparison is returned as `limited`.
- `none` - a quality, provenance or presentation disclosure. It rides along on the row and never suppresses a growth figure.

The two axes genuinely cross. `gdp_sna_break_2010` is a *note* that still limits a comparison; `municipal_source_actual_missing` is *severe* but does not stop one, because the figure it flags still measures total payments.

This field exists because `compare` previously consulted a hand-maintained list of scope-breaking codes that contained exactly one entry, and nothing could prove that list complete. It was not. Declaring the effect on the rule forces whoever writes the next rule to decide, and a test asserts every registered code is classified.

**A comparison is never decided by `valueDefinition`.** That field is display prose written for a reader. It stays constant across the municipal 2015 portal-fallback break and it varies when a ministries program is merely renamed, so using it to decide like-for-like was wrong in both directions at once. `Observation.valueDefinitionId` carries the structured identity instead.

## The catalogue

33 codes are registered.

| Code | Severity | Comparison effect | Owner document |
| --- | --- | --- | --- |
| `planned_values` | severe | `none` | `ai-grounding-and-caveats.md#planned_values` |
| `revenue_2004_component_scope` | severe | `breaks` | `revenue-methodology.md#56-2004--annual-report-partial-panel` |
| `revenue_2004_total_scope` | severe | `breaks` | `revenue-methodology.md` |
| `revenue_2004_liabilities_unavailable` | severe | `breaks` | `revenue-methodology.md` |
| `budget_scopes_differ` | severe | `none` | `revenue-methodology.md` |
| `negative_revenue_correction` | note | `none` | `revenue-methodology.md` |
| `revenue_internal_flows_netted` | note | `breaks` | `revenue-methodology.md` |
| `gdp_sna_break_2010` | note | `limits` | `national-nominal-gdp.md` |
| `gdp_preliminary` | note | `none` | `national-nominal-gdp.md` |
| `gdp_historical_method` | note | `limits` | `gdp-overview.md` |
| `gdp_world_bank_history` | note | `none` | `gdp-overview.md` |
| `sectors_preliminary` | note | `none` | `economic-sectors.md` |
| `municipality_not_territorial` | severe | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_country_scope` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `adjara_consolidation_applied` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_functions_no_republican_crosswalk` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_total_definition_changed` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_source_actual_missing` | severe | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_source_version_difference` | severe | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_financing_outside_functional` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_functional_total_gap` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `per_resident_coverage_limited` | severe | `none` | `municipal-population-regional-gdp.md` |
| `program_coverage_partial` | severe | `none` | `ministries-drilldown-programs-methodology.md` |
| `admin_category_not_yet_established` | severe | `none` | `ministries-expenditure-methodology.md` |
| `program_historical_join` | note | `limits` | `ministries-drilldown-programs-methodology.md` |
| `program_parent_category_modern_grouping` | severe | `none` | `ministries-drilldown-programs-methodology.md` |
| `non_positive_comparison_base` | note | `none` | `ai-grounding-and-caveats.md#non_positive_comparison_base` |
| `debt_not_budget_scope` | severe | `none` | `ai-grounding-and-caveats.md#debt_not_budget_scope` |
| `debt_service_projection` | severe | `breaks` | `ai-grounding-and-caveats.md#debt_service_projection` |
| `debt_rate_not_published` | note | `limits` | `ai-grounding-and-caveats.md#debt_rate_not_published` |
| `debt_gdp_share_vintage` | note | `none` | `ai-grounding-and-caveats.md#debt_gdp_share_vintage` |
| `deficit_general_government_scope` | severe | `none` | `ai-grounding-and-caveats.md#deficit_general_government_scope` |
| `deficit_projection` | severe | `breaks` | `ai-grounding-and-caveats.md#deficit_projection` |

### `planned_values`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#planned_values`

**Trigger.** Any returned cell whose `basis` is `planned`.

**Georgian.** შედეგი შეიცავს გეგმურ (და არა ფაქტობრივ) მაჩვენებელს.

**English.** The result contains planned rather than actual values.

Actual wins over planned wherever both exist, but where only a plan exists the figure is a budget intention, not an outturn. Every reviewed fact is currently `actual`, so this rule does not fire on today's data; it exists because planned rows are within the data model.

### `revenue_2004_total_scope`

**Severity:** severe  
**Comparison effect:** `breaks`  
**Owner document:** `revenue-methodology.md`

**Trigger.** `revenue.total` requested for 2004, or any `share_of_total_pct` request against national revenue in 2004.

**Georgian.** 2004 წლის შემოსავლების ჯამი უფრო ვიწრო მოცულობისაა: ვალდებულებების ზრდა მიუწვდომელია.

**English.** The 2004 receipts total has narrower coverage: increase in liabilities is unavailable.

The 2004 receipts total is 2,283,035,800 GEL over ten components, and increase in liabilities is not one of them. Growth from 2004 to any later year is therefore not like-for-like, and `compare` declines it. The share branch matters just as much: every 2004 percentage silently inherits the narrower denominator even when `revenue.total` is never named in the request.

### `revenue_2004_liabilities_unavailable`

**Severity:** severe  
**Comparison effect:** `breaks`  
**Owner document:** `revenue-methodology.md`

**Trigger.** `revenue.increase_liabilities` requested for 2004.

**Georgian.** 2004 წლისთვის ვალდებულებების ზრდა მიუწვდომელია — ის ნული არ არის.

**English.** Increase in liabilities is unavailable for 2004. It is not zero.

The category begins in 2005. The 2004 cell is neither estimated nor zeroed; it returns a null value with a reason. This is the canonical missing-is-not-zero case in the dataset.

### `budget_scopes_differ`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `revenue-methodology.md`

**Trigger.** A request naming both a national revenue total and a national expenditure total.

**Georgian.** ეროვნული შემოსავლებისა და ხარჯების ჯამები სხვადასხვა საბიუჯეტო მოცულობას ეყრდნობა; მათი გამოკლებით დეფიციტი არ დგინდება.

**English.** National revenue and expenditure totals use different budget concepts; subtracting them does not establish a deficit.

National revenue is consolidated budget receipts; national expenditure is state-budget expenditure classified into public spending fields. They are different budget concepts, so subtracting one from the other does not produce a deficit. Every observation also carries a `budgetScope` naming which side it belongs to, so geography alone can never imply the two measure the same thing.

### `negative_revenue_correction`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `revenue-methodology.md`

**Trigger.** A returned revenue cell whose value is negative.

**Georgian.** უარყოფითი მნიშვნელობა გადამოწმებული კორექციაა და არა დაკარგული მონაცემი.

**English.** A negative value is a reviewed correction, not missing or invalid data.

A negative reviewed figure is a correction that belongs in the series, not a data error to be filtered out or flipped. Without this a consumer may treat it as corrupt and silently drop it.

### `revenue_internal_flows_netted`

**Severity:** note  
**Comparison effect:** `breaks`  
**Owner document:** `revenue-methodology.md`

**Trigger.** A netted revenue series requested at or after the year netting begins.

**Georgian.** შერჩეული მუხლი შიდა ნაკადების დოკუმენტირებულ ნეტირებას იყენებს.

**English.** The selected item uses the documented netting of internal flows.

Scoped per cell rather than per series: the netting does not apply to the earlier years of the same series, and claiming it there would describe those figures wrongly. Its comparison effect is `breaks`, and that was a correction: from 2008 the series subtracts GFS rows 1.3.3 and 1.4.1.1.3 and before 2008 it does not, so the two endpoints count different things. Both endpoints carry a byte-identical `valueDefinition`, so nothing else could catch it, and `revenue.grants` 2005 to 2020 was published as `comparable, +651.19%`.

### `gdp_sna_break_2010`

**Severity:** note  
**Comparison effect:** `limits`  
**Owner document:** `national-nominal-gdp.md`

**Trigger.** A GDP-share request whose years span both GDP accounting standards.

**Georgian.** მშპ-ის მაჩვენებელი 2010 წელს აღრიცხვის სტანდარტს იცვლის (SNA 1993 → SNA 2008).

**English.** The GDP denominator changes accounting standard at 2010 (SNA 1993 to SNA 2008).

The GDP denominator switches from SNA 1993 to SNA 2008 at 2010. A percentage-point comparison across that break is reported as limited rather than declined outright: it remains usable so long as the caveat is visible.

### `gdp_preliminary`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `national-nominal-gdp.md`

**Trigger.** A GDP-share request using a GDP figure still marked preliminary, or a GDP overview cell whose status is `preliminary`.

**Georgian.** ამ შედეგში გამოყენებული მშპ-ის მაჩვენებელი წინასწარია და შეიძლება გადაიხედოს.

**English.** A GDP figure used by this result is preliminary and may be revised.

A preliminary figure can be revised. The share, or the GDP value itself, is still reported; the reader is told the ground may move. One code covers both cases because the fact is the same: until 2026-09-14 the GDP overview emitted this code inline with its own wording, so the catalogue described one message while clients received another.

### `gdp_historical_method`

**Severity:** note  
**Comparison effect:** `limits`  
**Owner document:** `gdp-overview.md`

**Trigger.** A GDP overview request whose returned nominal cells (current GEL, USD or per person) span both accounting standards.

**Georgian.** 2009 წლის ჩათვლით გამოიყენება SNA 1993, 2010 წლიდან — SNA 2008; ისტორიული სერია ერთიანად გადახედილი არ არის.

**English.** Geostat nominal series use SNA 1993 through 2009 and SNA 2008 from 2010; the historical series is not uniformly revised.

Every nominal cell already names its standard in `valueDefinitionId`; the caveat is about mixing them in one answer. It used to ride on every nominal cell, including a 2024-only answer with nothing to mix, which taught clients to ignore it.

### `gdp_world_bank_history`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `gdp-overview.md`

**Trigger.** Any available cell of a World Bank real GDP series (constant-2015 USD or annual real growth).

**Georgian.** ადრეული ისტორიული მონაცემების აღდგენის დეტალები წყაროს მეტამონაცემებში მითითებული არ არის.

**English.** The World Bank metadata does not specify how the earliest historical observations were reconstructed. Published values are preserved without custom rebasing or splicing.

The source does not say which years were reconstructed, so there is no narrower scope to give it than the World Bank cells themselves.

### `sectors_preliminary`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `economic-sectors.md`

**Trigger.** Any economic-sector cell whose status is `preliminary`.

**Georgian.** ეს სექტორული მონაცემები წინასწარია და შეიძლება გადაიხედოს.

**English.** These sector observations are preliminary and subject to revision.

Scoped by status, never by year. The inline message it replaced named 2025, which would have become false the day Geostat finalised that year.

### `municipality_not_territorial`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** Any request naming one of the five aggregate-only codes 05, 42, 43, 46, 64.

**Georgian.** მითითებული კოდის ბიუჯეტი ტერიტორიულად მიკუთვნებადი ხარჯი არ არის და გამორიცხულია.

**English.** The named code's budget is not territorially attributable spending and is excluded.

These budgets exist but are not territorially attributable spending inside those municipalities, so they never produce a row. Critically, they are also never reported as unknown entities. Saying so would tell a reader the municipality does not exist, when it exists and is deliberately excluded.

### `municipal_country_scope`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A municipal request naming the Georgia aggregate.

**Georgian.** საქართველოს მუნიციპალური აგრეგატი მოიცავს 69 გადამოწმებულ ბიუჯეტს და აჭარის ნეტო კორექციას; რეგიონული მწკრივები ამ ჯამს არ ქმნიან.

**English.** The Georgia municipal aggregate covers 69 reviewed budgets plus the net Adjara adjustment; regional rows do not sum to it.

The Georgia municipal aggregate covers 69 reviewed budgets plus the net Adjara adjustment, while the 64 rankable municipalities are a strict subset. Summing the 64 gives a different, smaller number, and the two must not be confused.

### `adjara_consolidation_applied`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A municipal total or share request naming the Adjara region.

**Georgian.** შედეგი იყენებს აჭარის რესპუბლიკური გადახდების ნეტო კორექციას, ერთხელ.

**English.** The result applies the net Adjara republican adjustment once.

Adjara's regional total is its six member municipalities plus the net republican payments, added once with integer-cent arithmetic. The caveat states that the adjustment is already included, so a reader does not add it again. Its two firing paths affect DIFFERENT cells, so `affects()` is built per cell: a share request consolidates every denominator, but a plain `amount_gel` request consolidates only the total, and the function amounts beside it are unconsolidated municipal-only sums. A bare entity id matched both, stamping Adjara's 2024 education figure - which contains no republican money - with a consolidation notice.

### `municipal_functions_no_republican_crosswalk`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A functional-category request naming the Adjara region or the country aggregate.

**Georgian.** ფუნქციური კატეგორიები მხოლოდ მუნიციპალურია; რესპუბლიკური ფუნქციური განაწილება არ არსებობს და არ არის გამოგონილი.

**English.** Functional categories are municipal-only; no republican functional allocation exists and none is invented.

The republican payments folded into Adjara's total have no functional breakdown. Adjara's ten functions therefore do not add up to its total, and no allocation is invented to make them.

### `municipal_total_definition_changed`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A comparison whose two endpoints use different public-total definitions.

**Georgian.** შედარების ერთ-ერთ წელს ჯამი ფუნქციების შეკრებით არის გაზომილი, და არა ოფიციალური ჯამური გადახდებით. სხვაობა ჩვეულებრივ 1%-ზე ნაკლებია, თუმცა ზოგიერთ მუნიციპალიტეტში მეტია.

**English.** In one of the compared years the total is the sum of the ten functions rather than the official total-payments headline. The difference is usually under 1%, and larger for some municipalities.

2015 is the archived portal's functional figure for all 64 municipalities, total and functions alike, while 2016 onward are MoF payment totals.

**Why this compares rather than refusing.** The gap between the two measures was measured across all 64 municipalities in every year where both exist: median 0.94% in 2016, falling to 0.20% by 2024, with a p90 of 4.2% in 2016 and a worst case of 13.5%. Refusing every 2015-to-later question outright withheld a usable ten-year answer from every reader in order to protect that tail, which is the wrong trade for a public explorer. The comparison is produced and carries this note. Owner decision, 2026-09-04.

The acceptance is specific to this basis pair, listed as `ACCEPTED_BASIS_CHANGE` in `apps/web/lib/factQuery/compare.ts`. Khulo 2024 uses `functional_total_fallback_missing_payment_actual`, because its workbook publishes a plan rather than an actual, and still breaks a comparison — as does any definition change introduced later, and any change of measure or level.

### `municipal_source_actual_missing`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A returned municipality-year whose warning type is a missing source actual.

**Georgian.** საჭირო ფაქტობრივი გადახდების მაჩვენებელი მიუწვდომელია; გამოყენებულია გადამოწმებული ფუნქციური ჯამი.

**English.** The required payment actual is unavailable; the reviewed functional total is used instead.

Khulo 2024 is the only such row: 30,969,077.43 GEL, a reviewed functional total standing in for a payment actual that does not exist. Its display flag is **false**, so a rule keyed on that flag would serve the fallback with no disclosure at all. The rule reads the warning type, never the display flag.

### `municipal_source_version_difference`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A returned municipality-year whose warning type is a source version difference.

**Georgian.** ფუნქციური და ჯამური მონაცემები წყაროს სხვადასხვა ვერსიიდანაა; შეჯერება იძულებით არ ხდება.

**English.** Functional and total inputs come from documented differing source versions; they are not forcibly reconciled.

Functional and total inputs come from documented differing source versions and are not forcibly reconciled. This is a provenance disclosure about a figure that still measures total payments; on its own it does not make two years incomparable.

### `municipal_financing_outside_functional`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A returned municipality-year whose warning type is financing outside the functional breakdown.

**Georgian.** საჯარო ჯამი მოიცავს ფინანსურ კომპონენტებს, რომლებიც ათ ფუნქციაზე არ არის განაწილებული.

**English.** The public total includes financing components not distributed across the ten functions.

The public total includes financing components that are not distributed across the ten functions, which is why functional rows can fall short of the total.

### `municipal_functional_total_gap`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A share request whose returned functional shares fall short of the public total, at any grain.

**Georgian.** ფუნქციური წილები საჯარო ჯამს სრულად არ ფარავს; 100%-მდე ნორმალიზება არ ხდება.

**English.** Functional shares do not cover the applicable public total and are never normalised to 100%.

Functional shares are never normalised to 100%. Reporting the gap is the honest alternative to scaling the parts until they fit. The trigger measures the RETURNED shares as well as reading the contributing rows' reconciliation figures, because those figures are null on every country row: the aggregate whose ten shares sum to 91.41% previously had no rule that could report it, and a region's 57.38% was reported only against member codes absent from the response.

### `per_resident_coverage_limited`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `municipal-population-regional-gdp.md`

**Trigger.** A per-resident request outside 2025, for a non-total series, or for the country aggregate.

**Georgian.** ერთ მცხოვრებზე გაანგარიშება მხოლოდ 2025 წლის მუნიციპალურ/რეგიონულ ჯამებზეა დაშვებული.

**English.** Per-resident values are supported only for the approved 2025 municipal and region totals.

The reviewed population panel covers 2025 only, for the 64 municipalities. The country aggregate is excluded even at 2025, because its numerator includes five aggregate-only budgets with no territorial population, which a year check alone would miss. Each of these returns a missing cell rather than an out-of-range error: the year is inside coverage, and it is the measure that is unavailable.

### `program_coverage_partial`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ministries-drilldown-programs-methodology.md`

**Trigger.** A major-program observation with no value for a requested year.

**Georgian.** მოთხოვნილი პროგრამული მწკრივი ზოგიერთ წელს არ ფარავს; არარსებული მნიშვნელობა ნული არ არის.

**English.** The requested program series does not cover every requested year; a missing value is not zero.

Program coverage is genuinely ragged: contiguous 2017-2025, partial from 2012, with nine series reaching back to 2006 through approved joins, and no program rows at all before 2006. A gap year is an absence, not a zero.

### `admin_category_not_yet_established`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ministries-expenditure-methodology.md`

**Trigger.** An administrative-category observation with no value for a requested year.

**Georgian.** მოთხოვნილი ადმინისტრაციული კატეგორია ამ წლის კლასიფიკაციაში არ არსებობს — ის მოგვიანებით ჩამოყალიბდა; არარსებული მნიშვნელობა ნული არ არის.

**English.** The requested administrative category does not exist in that year's classification — it was established later; a missing value is not zero.

Split out of `program_coverage_partial`, which previously claimed a *program* gap on category cells in both languages. Categories are not all coeval: thirteen run 2004-2025 while regional development and infrastructure starts only in 2009, so a 2004 request for it is a real missing cell that needed its own message and its own methodology reference.

### `program_historical_join`

**Severity:** note  
**Comparison effect:** `limits`  
**Owner document:** `ministries-drilldown-programs-methodology.md`

**Trigger.** A program cell served through an approved succession or legacy join. Its comparison effect is `limits`: spec 6.6 requires a documented join to qualify or decline a comparison, and while it was classified as an ordinary note a join-spanning pair returned `comparable, +170.07%`.

**Georgian.** მწკრივი იყენებს დამტკიცებულ ისტორიულ გაერთიანებას; შენარჩუნებულია მისი მოცულობა და ორიგინალი დასახელება.

**English.** The series uses an approved historical succession join; its scope and original label are preserved.

Scoped to the 190 genuinely joined cells across 25 series, per cell rather than per series. A joined series still serves most of its years from its own official code, and claiming a join on those years describes them wrongly, which it did for 135 of 325 cells before the scoping was tightened.

### `program_parent_category_modern_grouping`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ministries-drilldown-programs-methodology.md`

**Trigger.** A program cell whose parent category had no row in that year.

**Georgian.** მშობელი ადმინისტრაციული კატეგორია სერიის თანამედროვე მიკუთვნებაა და ამ წელს ჯერ არ არსებობდა; ხარჯი მაშინ სხვა უწყებამ განახორციელა. თანხა და წილი სწორია, მაგრამ მშობელი კატეგორია ამ წლისთვის კუთვნილების მტკიცება არ არის.

**English.** The parent administrative category is this series' modern grouping and did not exist in that year; the spending was administered by a different institution. The amount and share are correct, but the parent is not a containment claim for that year.

Three cells: the roads series for 2006-2008, whose modern parent ministry was created in 2009. The amount and the share are correct, because the reviewed rows put that spending under the Ministry of Economic Development, inside the year's administrative total. But following the parent id would produce a sentence about a ministry that did not exist. The figure is untouched; only the limitation is added.

### `non_positive_comparison_base`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#non_positive_comparison_base`

**Trigger.** An amount comparison whose earlier endpoint is zero or negative.

**Georgian.** საწყისი მაჩვენებელი ნულოვანი ან უარყოფითია, ამიტომ პროცენტული ზრდა არ გამოითვლება; აბსოლუტური სხვაობა შესაძლოა დარჩეს.

**English.** The starting value is zero or negative, so percentage growth is unavailable; an absolute difference may remain.

Percentage change divides by the earlier value, so a non-positive base makes growth undefined. The absolute difference survives and is still returned. Gated to amounts: percentage measures use a point difference, which subtraction handles fine.

### `debt_not_budget_scope`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#debt_not_budget_scope`

**Trigger.** Any government-debt response.

**Georgian.** სახელმწიფო ვალი ცენტრალური მთავრობის ვალდებულებაა და ბიუჯეტის მაჩვენებელი არ არის: მას ხარჯებს ვერ დაუმატებთ და შემოსავლებს ვერ გამოაკლებთ.

**English.** Government debt is a central-government liability, not a budget figure: it cannot be added to expenditure or subtracted from receipts.

Unconditional within the dataset, like `deficit_general_government_scope` and unlike every rule above it. The error it prevents does not depend on which series or year was asked for: it becomes available the moment a debt figure sits beside budget figures the client already holds. Debt is a stock of obligations, not spending, and no arithmetic combines the two.

### `debt_service_projection`

**Severity:** severe  
**Comparison effect:** `breaks`  
**Owner document:** `ai-grounding-and-caveats.md#debt_service_projection`

**Trigger.** Any returned cell whose `basis` is `projection`, in the debt dataset.

**Georgian.** მომავალი წლების მომსახურება პროგნოზია — უკვე არსებული პორტფელის გადახდის გრაფიკი, და არა დაფიქსირებული შედეგი.

**English.** Future-year debt service is a projection - the payment schedule of the already-outstanding portfolio, not a recorded outcome.

Debt service after the last actual year is a schedule of what the debt already outstanding is contracted to cost. It is not a budget anyone approved, which is why `basis` is `projection` rather than `planned`. `breaks` rather than `limits`: comparing a recorded year to a projected one compares two different kinds of quantity.

### `debt_rate_not_published`

**Severity:** note  
**Comparison effect:** `limits`  
**Owner document:** `ai-grounding-and-caveats.md#debt_rate_not_published`

**Trigger.** A `rate_percent` request in which at least one returned cell has no value.

**Georgian.** ამ წლებისთვის საპროცენტო განაკვეთი გადამოწმებულ წყაროებში გამოქვეყნებული არ არის — მონაცემი აკლია და ნულოვანი არ არის.

**English.** No reviewed source published an interest rate for these years - the value is missing, not zero.

Rate coverage is uneven because publication was uneven: `debt.rate.total` runs continuously, while the domestic and external splits appear only in the years a reviewed source carried them. The missing cell already blocks invention; this names the reason, so a reader can tell an unpublished figure from an unasked question.

### `debt_gdp_share_vintage`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#debt_gdp_share_vintage`

**Trigger.** Any debt request whose measure is `share_of_gdp_pct`.

**Georgian.** მშპ-ში წილი გამოთვლილია ამ სერვისის მშპ-ის მაჩვენებლით; ფინანსთა სამინისტროს გამოქვეყნებულმა წილმა შესაძლოა სხვა ვინტაჟის მშპ გამოიყენოს და ოდნავ განსხვავდებოდეს.

**English.** The GDP share is computed with this service's GDP figures; the Ministry's published share may use a different GDP vintage and differ slightly.

The debt package's own validation report records `possible_gdp_vintage_difference` against the Ministry's published debt-to-GDP share. A note rather than a severe: the number is correct for the denominator used. What the caveat supplies is the denominator, so a reader comparing this share to a published one knows why two right answers differ.

### `deficit_general_government_scope`

**Severity:** severe  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#deficit_general_government_scope`

**Trigger.** Any general-government-balance response.

**Georgian.** ეს არის ზოგადი მთავრობის ბალანსი საერთაშორისო სავალუტო ფონდის გაზომვით — და არა აქ მოწოდებული შემოსულობებისა და ხარჯების სხვაობა. ეს ორი ერთმანეთს არ უტოლდება.

**English.** This is the general government balance as measured by the IMF - not the difference between the receipts and expenditure served here. The two are not the same quantity.

The sibling of `budget_scopes_differ`, one boundary further out. General government is wider than either national series this service carries, so subtracting national expenditure from national receipts does not reproduce this number, and the difference between the two is not an error to be explained. Unconditional within the dataset, for the same reason as `debt_not_budget_scope`.

### `deficit_projection`

**Severity:** severe  
**Comparison effect:** `breaks`  
**Owner document:** `ai-grounding-and-caveats.md#deficit_projection`

**Trigger.** Any returned cell whose `basis` is `projection`, in the balance dataset.

**Georgian.** მომავალი წლების მაჩვენებელი საერთაშორისო სავალუტო ფონდის პროგნოზია და არა დაფიქსირებული შედეგი.

**English.** Future-year values are an IMF forecast, not a recorded outcome.

A separate code from `debt_service_projection` rather than one shared projection rule, because the reason differs and the reason is what a reader needs. A debt-service projection is a schedule of obligations already incurred; this is a forecast of an economy, and the next WEO vintage can revise it. One message cannot say both truthfully.


## Published bulk files

Ten JSON files are generated at build time from the same verified snapshot the
query core reads, and served under `/downloads/data/`. They are publications,
not an API: there is no request-time runtime behind them.

Row counts, byte sizes and SHA-256 hashes are **not repeated here**: they change
with the data, and a hardcoded table would rot silently. `manifest.json` carries
them for every file and is regenerated with them, so read it there.

| Public path | Contents |
| --- | --- |
| `/downloads/data/manifest.json` | Every published file with its row count, byte size, SHA-256, and each dataset's covered year range. |
| `/downloads/data/catalogue.json` | Every dataset, with its entities, series, hierarchy and exclusions. |
| `/downloads/data/sources.json` | Every logical source with its public originals or its stated derivation. |
| `/downloads/data/national-revenue.json` | Annual state-budget revenue observations, including `revenue.total`. |
| `/downloads/data/national-expenditure.json` | Annual state-budget expenditure observations, including `expenditure.total`. |
| `/downloads/data/ministries.json` | Administrative categories and major programs, both levels in one file, including `admin_spending.total`. |
| `/downloads/data/municipal-expenditure.json` | Municipality, region and Georgia rows for the ten functional categories, including `municipal.total`. |
| `/downloads/data/government-debt.json` | Debt stock and debt service in GEL. Years after the last recorded one are projections of the existing portfolio. |
| `/downloads/data/government-debt-rates.json` | Weighted-average interest rates in percent per annum, with the documented publication gaps left empty. |
| `/downloads/data/general-government-balance.json` | The IMF's general government balance as a share of GDP, with the published GEL amount alongside. Values are signed: negative is a deficit. |

Each file publishes every total its own embedded catalogue advertises. That is
enforced by a test rather than by care: the first version derived its series
list from the served facts, and a *calculated* total has no fact row, so three
of the four files advertised a total they did not contain — which also
suppressed the `budget_scopes_differ` caveat that stops a reader subtracting the
two national totals into a deficit that does not exist.

`ministries.json` has no CSV counterpart; it is a new published dataset rather
than a format conversion. The three existing processed CSVs stay where they
are, unchanged.

### What the figures are

Every observation is `amount_gel`, with two exceptions that have no amount
form at all. Shares and per-resident values are **not** precomputed: each file
carries the denominators needed to reproduce its allowed ratios instead —
`supportingValues.gdpFacts` for the national, ministries and debt files,
`supportingValues.populationFacts` for the municipal one. Publishing four
measures of every row would multiply the files to say nothing new.

The exceptions are `government-debt-rates.json`, whose observations are
`rate_percent` because an interest rate cannot be expressed as an amount, and
`general-government-balance.json`, whose observations are `share_of_gdp_pct`
because that is the form the IMF publishes; its GEL amount travels alongside in
`supportingValues.balanceGelByYear` rather than being derived.

Each file is self-contained. It repeats its own `catalogue`, `coverage`,
`sources` and `caveats` in full rather than by reference, so a download read on
its own — without `llms.txt` and without the manifest — still states what the
figures mean, which cells are missing, where they came from and how they are
limited. Every file also carries `schemaVersion`, `dataVersion`,
`releaseCommit`, `generatedAt` and the CC BY 4.0 licence and attribution.

### Rows must not be summed

These files deliberately contain overlapping totals and their components, so
that both can be inspected. Every row carries `level`, `parentSeriesId` and
`entityType`, and each file repeats the warning in its `notice` field: adding
every row together double-counts. A municipality's rows sit inside its region's,
which sit inside Georgia's; a total sits above its functional categories.

### Excluded municipalities

Codes `05`, `42`, `43`, `46` and `64` never appear as territorial rows, and
their individual contribution amounts are never exposed. They are named in
`catalogue.exclusions` with a reason, so a consumer can tell an excluded
municipality from a missing one.

### Which originals a row cites

`documentIds` names only the originals that support that row. The municipality
budget-history source archives one workbook per municipality, so a single
municipality's figure cites its own workbook plus the cross-municipality
functional-classification workbook for that year — not all 75. A region cites
its members' workbooks; the Georgia row cites every served municipality's,
because it really is built from all of them.

### Regeneration and staleness

`npm run data:prepare-fact-query-publications` writes the files; it runs last in
the `prebuild` chain, after `data:prepare-public-datasets`, which clears the
output directory before writing its CSVs.

`npm run data:check-fact-query-publications` verifies them, and runs as
`postbuild` — after the files exist. It fails the build if a published file
drifts from what the current snapshot produces, and separately verifies the
on-disk manifest's hashes and byte sizes against the on-disk files. It is
deliberately **not** part of `npm run data:validate`: that runs before `npm run
build` in CI, and `public/downloads/data/` is gitignored, so on a clean runner
the files do not exist yet and the check failed `missing` on every fresh
checkout.

## The MCP connection

The same observations, sources and caveats are also served live at
`https://fiscal.ge/mcp` over MCP Streamable HTTP, protocol revision
`2025-11-25`, stateless and unauthenticated. `/connect` is the human-facing
guide to it.

Nine read-only tools: `describe_coverage`, `query_national`,
`query_ministries`, `query_municipal`, `query_debt`, `query_deficit`,
`compare`, `rank`, `get_sources`.

**The connection and the bulk files use the same definitions.** Both are
produced from one snapshot by the same pure functions in
`apps/web/lib/factQuery/`, so an observation's fields, its `budgetScope`, its
`valueDefinitionId`, and every caveat in the catalogue above mean exactly the
same thing in both places. There is no second implementation to drift.

The difference is shape, not substance: the files are the whole dataset in one
download, the connection answers a bounded question and returns only the
evidence behind that answer. A response is capped at 512 KiB including both its
structured and text representations, and an over-cap request is refused with
narrowing guidance rather than trimmed — dropping sources or warnings to make a
result fit would publish a figure without its limitations.

The endpoint reads no database and fetches no document at request time. It
answers from the snapshot bundled into the deployment, so it keeps working
if the database is unavailable. Operating limits, the pause switch, and the
logging and privacy policy are in `docs/deployment.md`.

`ai-reference-intents.md` records the twenty budget questions the service is
tested against, in Georgian and English, with the answer each must give and the
limitation it must carry.

## Keeping this document true

`apps/web/tests/factQuery/caveats/documented.test.ts` fails if a registered code is missing from this file, so the catalogue cannot grow without the documentation growing with it. It deliberately does not check the prose: a test can prove a code is mentioned, not that the sentence beside it is right. That stays a review responsibility.


### `revenue_2004_component_scope`

**Severity:** severe. **Comparison effect:** `breaks`.

**Trigger:** An available 2004 observation for `revenue.asset_decrease` or
`revenue.other_taxes`. The 2004 capital-revenue row and residual other-taxes
calculation do not establish equivalence to the later components. This rule
suppresses growth across the boundary for those two series and their growth
rankings. It does not change reviewed amounts or the validated VAT comparison.

**Owner:** `revenue-methodology.md#56-2004--annual-report-partial-panel`.

**Georgian:** 2004 წლის კაპიტალური შემოსავლები და სხვა გადასახადები შემდგომი წლებისგან განსხვავებული განსაზღვრებითაა მოცემული; ამ საზღვარზე ზრდა არ გამოითვლება.

**English:** The 2004 capital receipts and other taxes use different definitions from later years. Growth is not calculated across this boundary.
