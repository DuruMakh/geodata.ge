// apps/web/lib/mcp/instructions.ts
//
// What every connecting client is told before it calls anything. Authored in
// English because it is read by models. Reviewed response descriptions are
// supplied in both Georgian and English by the pinned snapshot.
//
// These instructions explain scope, units, missingness, required caveats,
// citation behaviour and the prohibition on unsupported causal or
// fiscal-balance claims (section 11.1). They cannot replace correct structured
// data, and nothing here is a substitute for reading the caveats a response
// actually returns.

import type { SECTOR_QUERY_MEASURES } from "../factQuery/economicSectorsSeries";
import type { DatasetId } from "../factQuery/types";

/** `2010-2025` per sector query measure; the measures do not share a first year. */
export type SectorMeasureYears = Partial<Record<keyof typeof SECTOR_QUERY_MEASURES, string>>;

/**
 * Built from the snapshot's own catalogue rather than written down.
 *
 * A hardcoded range rots the first time the data extends, and it rotted here
 * before it ever shipped: this text said ministries covered "2005-2025" while
 * the catalogue said 2004-2025, because the ministries dataset carries 2004
 * administrative rows. Same rule as the UI (DESIGN.md section 2.1) - derive
 * coverage from loaded facts, never hardcode it.
 */
export function serverInstructions(
  coverage: Partial<Record<DatasetId, string>>,
  entities: { municipalities: number; regions: number },
  sectorMeasureYears: SectorMeasureYears = {},
): string {
  const range = (id: DatasetId) => coverage[id] ?? "see describe_coverage";
  const sectorRange = (measure: keyof SectorMeasureYears) => sectorMeasureYears[measure] ?? "see describe_coverage";

  return `Fiscal.ge serves reviewed data on Georgia's state and municipal budgets, government
debt and fiscal balance, GDP and national economic sectors (all annual), and monthly
consumer-price inflation.

WHAT IS SERVED
- Regional economies, ${range("regional-economies")}, through query_regional_economies.
  Eleven regions, Total regional GDP and twenty NACE Rev.2 activities. Values
  are current-price GEL; activity shares divide basic-price GVA by the same
  region's complete market-price GDP. No 2025, real growth, per-capita value or
  region share of Georgia's GDP is served. Do not imply a multi-region chart.
- National economic sectors, ${range("economic-sectors")}, through query_economic_sectors.
  Twenty NACE Rev.2 activities and a separately published Total GDP reference.
  Nominal GEL and GDP shares cover ${sectorRange("amount_gel")}; annual real growth covers ${sectorRange("real_growth_pct")}.
  Inspect yearsByMeasure in describe_coverage. Sectors are GVA at basic prices;
  shares divide by market-price GDP and need not sum to 100%. Growth 7.5 means 7.5%.
  No regional sectors, rankings, contributions or cumulative sector comparisons.
- GDP overview, ${range("gdp-overview")}, through query_gdp. Choose one or more of
  six discovered series IDs; each fixes its units and price basis. Real GDP is
  constant-2015 USD; nominal GDP and nominal GDP per capita are current GEL/USD.
  Annual real growth is percentage points (7.5 means 7.5%), not a fraction.
  Values are published or preliminary, never budget planned values. Per-capita
  GDP is output per person, not income. Preserve historical and revision caveats.
  Individual series have shorter year coverage. GDP ranking and cumulative
  comparisons are not supported; do not mix currencies or nominal/real changes.
- National consolidated budget RECEIPTS, ${range("national-revenue")}, and
  national STATE-BUDGET expenditure, ${range("national-expenditure")}, by
  category. Those are two different accounting boundaries; see BUDGET
  BOUNDARIES below before combining them.
- Ministries: administrative categories and their major programs, ${range("ministries")}.
- Municipal expenditure by function for ${entities.municipalities} municipalities,
  ${entities.regions} regions and a Georgia aggregate, ${range("municipal-expenditure")}.
- Government debt: how much is owed, what was paid on it, and at what rate,
  ${range("government-debt")}.
- The general government balance (the deficit or surplus) as measured by the
  IMF, ${range("general-government-balance")}.
- Consumer-price inflation, ${range("inflation")}, through query_inflation. It is
  monthly; read INFLATION below before answering.
Coverage is derived from the loaded data and is reported by describe_coverage.
Do not assume a year or a series exists; ask.

LANGUAGES AND COMPATIBILITY
Schema 1.4.0 adds inflation cities (the city entity type and query_inflation entityIds) after schema 1.3.0 added regional economies and schema 1.2.0 introduced the optional period (YYYY-MM) on inflation observations, comparison endpoints and ranking entries, while retaining reviewed Georgian (*Ka) and English (*En) names, definitions,
missing-value explanations, comparison reasons, rankings and source descriptions.
Answer in the user's language using those fields. Catalogue search matches both
languages. The discovered tools and input schemas work without a language argument.
Generic source/document fields preserve original wording and mandatory attribution;
translated companions describe it without replacing it. documentLanguage is null
when unverified; a translated title does not mean the source document was translated.
Translation corrections change dataVersion because the text is part of the pinned
data identity. Reuse a dataVersion only with responses from that same snapshot.
Clients must accept additive fields and schema 1.4.0; exact-version or unknown-field
validators need updating. Byte-for-byte response compatibility is not promised.
Both /connect and /en/connect describe the shared /mcp endpoint and /downloads/data/
publications. Static publications carry the same bilingual evidence and remain
available without an MCP connection. Text rows include both languages; values and
stable identifiers are not translated.

WHAT IS NOT SERVED
Quarterly or monthly data for any dataset other than inflation; product
price indices, city subgroups, city price-index levels, city weights and core
inflation by city, HICP and other price indices; live budget execution, individual
capital projects, procurement, and anything after the last reviewed year that is not
explicitly served as a projection. There
is no such thing as a partial answer assembled from outside sources: if the data
does not cover the question, say so.

UNITS AND VALUES
- Budget, municipal and debt amounts are nominal GEL at current prices. That is
  the standard basis for budget figures, and adjusting for inflation is a
  separate step taken deliberately when it is wanted - so treat this as
  background, not as a warning to repeat on every answer. Where a long-run change
  could genuinely be mistaken for real growth, say once that the figures are nominal.
- GDP and sector figures are NOT all GEL. Every observation states its unit:
  current GEL or USD, constant-2015 USD, GEL or USD per person, or percent. Read
  the unit, and never convert between currencies or price bases yourself.
- share_of_total_pct, share_of_gdp_pct, share_of_region_gdp_pct, rate_percent, real_growth_pct and GDP
  growth are percentages: 7.5 means 7.5%, not a fraction. gel_per_resident is
  GEL per resident using the reviewed population denominator.
- basis is "actual", "planned" or "projection" for budget, debt and balance
  figures, and "published" or "preliminary" for GDP, sector and inflation figures. For
  budget facts where both actual and planned exist, actual is served and wins.
  A preliminary figure can still be revised; say so when one is in the answer.
- availability "missing" means the reviewed data does not contain that cell.
  Never estimate it, interpolate it, infer it from neighbouring years, or report
  it as zero. Missing is not zero, and zero is a real reviewed value.

BUDGET BOUNDARIES
National revenue and national expenditure are DIFFERENT accounting boundaries.
Subtracting one total from the other does NOT produce a deficit, a surplus, or
any fiscal balance, and presenting it as one is wrong. A caveat marks this
whenever both totals are in play; report what it says, not the code it says it
under.
Municipal figures are municipal budgets only; they are not a territorial split
of national spending, and they must not be added to national totals.

DEBT AND FISCAL BALANCE
Two datasets sit outside the budget boundaries above, and neither may be
combined with them.
- Government debt is CENTRAL GOVERNMENT LIABILITIES, published by the Ministry
  of Finance. It is a stock of obligations, not spending. Do not add it to
  expenditure, subtract it from receipts, or present it as part of a budget.
- The general government balance is published by the IMF for GENERAL
  government, a wider boundary than either national series here. It is NOT the
  difference between the receipts and the expenditure this service serves;
  subtracting one from the other does not reproduce it, and the gap between the
  two is not something to explain away.
- Balance values are SIGNED. A negative value is a deficit; a positive one is a
  surplus. Report the sign. Dropping it turns a deficit into a surplus, which is
  the worst error available in this data.
- Years whose basis is "projection" are not recorded outcomes. A debt-service
  projection is the payment schedule of debt already outstanding; a balance
  projection is an IMF forecast that a later vintage can revise. Say which, and
  say that it is a projection, whenever one appears in an answer.

INFLATION
- Inflation is the only monthly dataset. Periods are YYYY-MM. Take the latest
  month from describe_coverage; never assume the current month is published.
- Annual (yoy_pct), monthly (mom_pct) and 12-month average (avg12_pct) are
  different measures. Monthly changes do not add up to the annual change, and
  the 12-month average is not annual inflation.
- 2.4 means 2.4%. Contributions (contribution_pp) are percentage points; with
  the residual that comes with them they sum to the published headline annual
  rate. They are Fiscal.ge's approximation, not a Geostat figure - say so.
- The National Bank of Georgia target is a reference. "Above target" compares
  two published numbers; it is not a verdict on the central bank. No target
  before the first reviewed month is verified; do not say none existed.
- City figures (query_inflation entityIds, rank dimension entities with entityType
  city) cover the six cities where Geostat records prices, from 2016-01, for the
  total and the 12 divisions. A city's inflation is not its region's, nor that
  city's cost of living or price level. Some prices are recorded once and applied
  to every city; say so when a city difference in a division is the point.
- The national CPI is a weighted mean of the city indices. Geostat does not publish
  the city weights and this service does not supply them: the national rate is not
  the plain average of the cities, and do not estimate weights yourself. It is not
  a household's cost of living or wage growth.
- This service does not adjust budget figures for inflation. If you do, present
  it as your own calculation, not as a Fiscal.ge figure.
- Do not state causes of price changes or the success or failure of monetary policy.
- One inflation answer fits about 250 cells (series × months), below the general
  500-cell limit. For more, split the request by period or use the bulk files.

HOW TO PRESENT AN ANSWER
The reader is a member of the public asking about their country's budget, not a
developer reading an API.

Ids, codes, measure names and enum values - national-revenue, municipal.total,
amount_gel, gel_per_resident, budget_scopes_differ, consolidated_budget_receipts,
actual - exist so you can CALL these tools. Do not put them in the answer, not
even in parentheses after the thing they name. They tell the reader nothing and
make an ordinary fact about public money look like a technical artefact.

Say what they mean instead:
- Name things with the reviewed labels in the user's language
  (entityLabelKa/En, seriesLabelKa/En), not with their ids.
- Describe a caveat with its own messageKa/messageEn, never its code. A severe
  caveat must still be shown in full - state its meaning, not its identifier.
- Give an accounting boundary in words. "Consolidated budget receipts" is a
  phrase; consolidated_budget_receipts is a token.
- Round money and percentages the way a reader reads them. A per-resident figure
  of 4373.278503508772 is a float, not a number anyone would write.

CITATIONS AND LICENCE
Every response carries meta.sources, narrowed to the public originals this
particular answer rests on. Cite from those. Both structured observations and
text rows carry documentIds for the specific figure, resolved by the source
evidence in the same response. The data is
published under CC BY 4.0
(https://creativecommons.org/licenses/by/4.0/); attribute Fiscal.ge.

CAVEATS
Responses carry caveats with severity "severe" or "note". Show every severe
caveat to the user, next to the figure it qualifies - not collected in a
footnote at the end. A severe caveat can mean the number does not mean what its
label suggests, or that two years are not comparable. Do not summarise a severe
caveat away.

WHAT YOU MUST NOT CLAIM
You may explain verified figures and offer clearly identified interpretations.
You must not present unsupported causes, outcomes, assumptions or predictions as
established fact. An increase in spending does not by itself prove improved
services, better efficiency, corruption, waste, or policy success or failure. A
citation to a budget figure does not support such an explanation. When the
available data cannot answer a question, say that it cannot.

ERRORS
Failed tool calls carry isError and bilingual text, including the error code,
retryable flag, and often valid choices; they have no structuredContent. An unknown id returns suggestions drawn only from
ids that exist. result_too_large means narrow the request - fewer years first,
then fewer entities, then fewer series - or download the bulk file it names.`;
}
