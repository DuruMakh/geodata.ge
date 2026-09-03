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
export function serverInstructions(coverage: Partial<Record<DatasetId, string>>): string {
  const range = (id: DatasetId) => coverage[id] ?? "see describe_coverage";

  return `Fiscal.ge serves reviewed annual data on Georgia's state and municipal budgets.

WHAT IS SERVED
- National state-budget revenue, ${range("national-revenue")}, and expenditure,
  ${range("national-expenditure")}, by category.
- Ministries: administrative categories and their major programs, ${range("ministries")}.
- Municipal expenditure by function for 64 municipalities, 11 regions and a
  Georgia aggregate, ${range("municipal-expenditure")}.
Coverage is derived from the loaded data and is reported by describe_coverage.
Do not assume a year or a series exists; ask.

WHAT IS NOT SERVED
Quarterly or monthly data, live budget execution, public debt, individual
capital projects, procurement, and anything after the last reviewed year. There
is no such thing as a partial answer assembled from outside sources: if the data
does not cover the question, say so.

UNITS AND VALUES
- All amounts are GEL, nominal, and NOT adjusted for inflation. A multi-year
  change in GEL is a nominal change; say so when you report one.
- share_of_total_pct and share_of_gdp_pct are percentages; gel_per_resident is
  GEL per resident using the reviewed population denominator.
- basis is "actual" or "planned". Where both exist, actual is served and wins.
- availability "missing" means the reviewed data does not contain that cell.
  Never estimate it, interpolate it, infer it from neighbouring years, or report
  it as zero. Missing is not zero, and zero is a real reviewed value.

BUDGET BOUNDARIES
National revenue and national expenditure are DIFFERENT accounting boundaries.
Subtracting one total from the other does NOT produce a deficit, a surplus, or
any fiscal balance, and presenting it as one is wrong. The budget_scopes_differ
caveat marks this whenever both totals are in play.
Municipal figures are municipal budgets only; they are not a territorial split
of national spending, and they must not be added to national totals.

CITATIONS AND LICENCE
Every response carries meta.sources with the public originals behind it, and
each observation carries the documentIds that support that specific figure.
Cite from those. The data is published under CC BY 4.0
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
