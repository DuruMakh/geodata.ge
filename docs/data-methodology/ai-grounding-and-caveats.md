# AI grounding and the caveat catalogue

This document is the single owner of the caveat catalogue used by the fact-query core (`apps/web/lib/factQuery/`). Every code the core can emit is listed here with its trigger, severity, both message texts, and the methodology document that owns the underlying rule.

**A code appearing in this document is not evidence that its trigger is correct.** The firing and non-firing tests under `apps/web/tests/factQuery/caveats/` are what establish that, and they have twice caught a rule attaching a warning to figures it did not describe. Read this document to learn what a code means; read the tests to learn when it fires.

## Why caveats exist at all

The query core exists so that a language model answering a question about the Georgian budget quotes reviewed figures instead of inventing them. That is only half the problem. A correct number presented without its limitation is still a wrong answer: 2004 receipts really are 2,283,035,800 GEL, and growth from that figure to 2005 is still meaningless, because the two totals count different things.

So every response carries machine-readable caveats alongside its figures, each scoped to the cells it actually describes. Severity `severe` means a reader who ignores it will likely draw a wrong conclusion. Severity `note` means the figure is sound but its context matters.

## Scoping is part of the contract

A caveat's `affects` array pins it to specific observations, normally as `seriesId:year` or `entityId:year` composites. A rule whose `affects` is coarser than the grain at which its claim is true will label figures it does not describe, and nothing in the type system catches that. Two such defects have shipped and been fixed; the precision contract is documented in `apps/web/lib/factQuery/observations.ts`. A bare id or a bare year is correct only where the claim is genuinely uniform across every cell in the request, which is why `nominal_gel` and `budget_scopes_differ` are allowed to use one.

## Severity and comparison effect are different questions

Severity says how badly a reader is misled if they ignore the caveat. **Comparison effect** says something independent: whether the two endpoints of a two-year comparison still measure the same thing.

- `breaks` - the endpoints do not measure the same thing. A comparison whose endpoints disagree on this caveat is returned as `not_comparable`, with both reviewed values intact and no growth figure.
- `limits` - still answerable, but the reader must be told; the comparison is returned as `limited`.
- `none` - a quality, provenance or presentation disclosure. It rides along on the row and never suppresses a growth figure.

The two axes genuinely cross. `gdp_sna_break_2010` is a *note* that still limits a comparison; `municipal_source_actual_missing` is *severe* but does not stop one, because the figure it flags still measures total payments.

This field exists because `compare` previously consulted a hand-maintained list of scope-breaking codes that contained exactly one entry, and nothing could prove that list complete. It was not. Declaring the effect on the rule forces whoever writes the next rule to decide, and a test asserts every registered code is classified.

**A comparison is never decided by `valueDefinition`.** That field is display prose written for a reader. It stays constant across the municipal 2015 portal-fallback break and it varies when a ministries program is merely renamed, so using it to decide like-for-like was wrong in both directions at once. `Observation.valueDefinitionId` carries the structured identity instead.

## The catalogue

24 codes are registered.

| Code | Severity | Comparison effect | Owner document |
| --- | --- | --- | --- |
| `nominal_gel` | note | `none` | `ai-grounding-and-caveats.md#nominal_gel` |
| `planned_values` | severe | `none` | `ai-grounding-and-caveats.md#planned_values` |
| `revenue_2004_total_scope` | severe | `breaks` | `revenue-methodology.md` |
| `revenue_2004_liabilities_unavailable` | severe | `breaks` | `revenue-methodology.md` |
| `budget_scopes_differ` | severe | `none` | `revenue-methodology.md` |
| `negative_revenue_correction` | note | `none` | `revenue-methodology.md` |
| `revenue_internal_flows_netted` | note | `breaks` | `revenue-methodology.md` |
| `gdp_sna_break_2010` | note | `limits` | `national-nominal-gdp.md` |
| `gdp_preliminary` | note | `none` | `national-nominal-gdp.md` |
| `municipality_not_territorial` | severe | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_country_scope` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `adjara_consolidation_applied` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_functions_no_republican_crosswalk` | note | `none` | `municipal-functional-annual-2015-2025.md` |
| `municipal_total_definition_changed` | severe | `breaks` | `municipal-functional-annual-2015-2025.md` |
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

### `nominal_gel`

**Severity:** note  
**Comparison effect:** `none`  
**Owner document:** `ai-grounding-and-caveats.md#nominal_gel`

**Trigger.** Any `amount_gel` result spanning more than one year.

**Georgian.** თანხები ნომინალურ ლარშია, მიმდინარე ფასებში; ინფლაციაზე კორექტირებული არ არის.

**English.** Amounts are nominal GEL at current prices and are not adjusted for inflation.

Multi-year GEL figures invite a growth story. The figures are current-price nominal GEL with no deflator anywhere in the pipeline, so growth between two years mixes real change with inflation. Single-year requests do not fire it: there is no across-time comparison to mislead.

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

**Trigger.** A GDP-share request using a GDP figure still marked preliminary.

**Georgian.** გამოყენებული მშპ-ის მაჩვენებელი წინასწარია.

**English.** A GDP denominator used by this result is preliminary.

A preliminary denominator can be revised. The share is still reported; the reader is told the ground may move.

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

**Severity:** severe  
**Comparison effect:** `breaks`  
**Owner document:** `municipal-functional-annual-2015-2025.md`

**Trigger.** A comparison whose two endpoints use different public-total definitions.

**Georgian.** შედარების წერტილები საჯარო ჯამის სხვადასხვა განსაზღვრებას იყენებს; თანაზომადი ზრდა არ გამოითვლება.

**English.** The comparison endpoints use different public-total definitions; no like-for-like growth is produced.

2015 is the portal functional fallback for all 64 municipalities while 2016 onward are payment totals, so a 2015-to-later growth figure is not like-for-like. The comparison returns both endpoints with null change fields rather than a number that reads as growth.

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

## Keeping this document true

`apps/web/tests/factQuery/caveats/documented.test.ts` fails if a registered code is missing from this file, so the catalogue cannot grow without the documentation growing with it. It deliberately does not check the prose: a test can prove a code is mentioned, not that the sentence beside it is right. That stays a review responsibility.
