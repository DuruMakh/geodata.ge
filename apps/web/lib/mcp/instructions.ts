// apps/web/lib/mcp/instructions.ts
//
// What every connecting client is told before it calls anything. Authored in
// English because it is read by models, not by site visitors; the DATA it
// describes stays Georgian (spec section 10).
//
// These instructions explain scope, units, missingness, required caveats,
// citation behaviour and the prohibition on unsupported causal or
// fiscal-balance claims (section 11.1). They cannot replace correct structured
// data, and nothing here is a substitute for reading the caveats a response
// actually returns.

import type { DatasetId } from "../factQuery/types";

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
): string {
  const range = (id: DatasetId) => coverage[id] ?? "see describe_coverage";

  return `Fiscal.ge serves reviewed annual data on Georgia's state and municipal budgets.

WHAT IS SERVED
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
Coverage is derived from the loaded data and is reported by describe_coverage.
Do not assume a year or a series exists; ask.

WHAT IS NOT SERVED
Quarterly or monthly data, live budget execution, individual capital
projects, procurement, and anything after the last reviewed year that is not
explicitly served as a projection. There
is no such thing as a partial answer assembled from outside sources: if the data
does not cover the question, say so.

UNITS AND VALUES
- All amounts are nominal GEL at current prices. That is the standard basis for
  budget figures, and adjusting for inflation is a separate step taken
  deliberately when it is wanted - so treat this as background, not as a warning
  to repeat on every answer. Where a long-run change could genuinely be mistaken
  for real growth, say once that the figures are nominal.
- share_of_total_pct and share_of_gdp_pct are percentages; gel_per_resident is
  GEL per resident using the reviewed population denominator.
- basis is "actual" or "planned". Where both exist, actual is served and wins.
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

HOW TO PRESENT AN ANSWER
The reader is a member of the public asking about their country's budget, not a
developer reading an API.

Ids, codes, measure names and enum values - national-revenue, municipal.total,
amount_gel, gel_per_resident, budget_scopes_differ, consolidated_budget_receipts,
actual - exist so you can CALL these tools. Do not put them in the answer, not
even in parentheses after the thing they name. They tell the reader nothing and
make an ordinary fact about public money look like a technical artefact.

Say what they mean instead:
- Name things with the Georgian labels the response already carries
  (entityLabelKa, seriesLabelKa), not with their ids.
- Describe a caveat with its own messageKa/messageEn, never its code. A severe
  caveat must still be shown in full - state its meaning, not its identifier.
- Give an accounting boundary in words. "Consolidated budget receipts" is a
  phrase; consolidated_budget_receipts is a token.
- Round money and percentages the way a reader reads them. A per-resident figure
  of 4373.278503508772 is a float, not a number anyone would write.

CITATIONS AND LICENCE
Every response carries meta.sources, narrowed to the public originals this
particular answer rests on. Cite from those. (Structured observations also
carry documentIds for the specific figure; the text representation does not, so
meta.sources is the citation source that is correct in both.) The data is
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
Errors are structured and carry both Georgian and English messages, a retryable
flag, and often valid choices. An unknown id returns suggestions drawn only from
ids that exist. result_too_large means narrow the request - fewer years first,
then fewer entities, then fewer series - or download the bulk file it names.`;
}
