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

/**
 * Static on purpose, and short on purpose: Claude Code cuts server instructions at
 * 4,096 characters (2,048 before v2.1.296), so the rules that change an answer come
 * first and everything a tool description or a returned caveat already says is left
 * to them. Year ranges and entity counts live in the descriptions, which read them
 * from the snapshot (DESIGN.md section 2.1: derive coverage from loaded facts, never
 * hardcode it), so this text states none. The schema history is for developers and
 * lives on /connect.
 */
export function serverInstructions(): string {
  return `Use describe_coverage with short keywords before querying. Use returned IDs and supported measures; keep expectedDataVersion consistent. Preserve units, missing values, projections and caveats. Cite the returned original documents and Fiscal.ge. For product questions, search first and request only the required series and dates. Use the published files for bulk analysis.

Fiscal.ge serves reviewed data on Georgia's state and municipal budgets, government debt, the general government balance, GDP and economic sectors (annual), and consumer-price and product inflation (monthly). Never assume a year, series or entity exists; describe_coverage says what does. If a phrase finds nothing, retry the principal word or browse the dataset: an empty match is not proof that the data is absent. If the data does not cover the question, say so; do not fill the gap from other sources. Many Fiscal.ge website topics are not served here; a search returns websitePages for them: offer that link in the user's language and give no figure.

NEVER COMBINE
- National revenue is consolidated budget RECEIPTS; national expenditure is STATE-BUDGET expenditure. They are different accounting boundaries: revenue minus expenditure is NOT a deficit, surplus or balance.
- The balance served is the IMF general government balance. It is SIGNED: negative is a deficit, positive a surplus. Always keep the sign. It is not receipts minus expenditure.
- Government debt is a stock of central government liabilities, not spending. Never add it to or subtract it from budget figures.
- Municipal figures are municipal budgets, not a split of national spending. Do not add them to national totals or rebuild the Georgia aggregate by summing municipalities or regions.

VALUES
- Read each value's unit. Budget, municipal and debt amounts are nominal GEL; GDP and sector values can be GEL, USD, constant-2015 USD, per person (output, not income) or percent. Never convert currencies or price bases yourself.
- Percentages are already percent: 7.5 means 7.5%. Inflation contributions are percentage points.
- availability "missing" is not zero. Never estimate, interpolate or report it as 0. Missing is not zero; zero is a real value.
- Budget, debt and balance basis is actual, planned or projection (actual wins over planned); GDP, sector and inflation figures are "published" or "preliminary". Say when a figure is planned, a projection or preliminary.

INFLATION
- Inflation is the only monthly dataset. Annual, monthly and 12-month-average rates are different measures; monthly changes do not add up to the annual rate. Take the latest month from describe_coverage.
- A city's rate is not its region's or its cost of living, and the national rate is not the average of cities. Comparing with the National Bank target is not a verdict on policy. Do not state causes of price changes.
- Contributions and cumulative product changes are Fiscal.ge calculations over Geostat inputs (cumulative: base is the preceding December); say so. In the bulk inflation-products.csv, index_100 values (mom_index_100, yoy_index_100) are indices: 100 means no price change.

ANSWERING
- The reader is the public, not a developer reading an API. IDs, codes, measure and enum names are for calling tools: Do not put them in the answer. Use the returned labels in the user's language.
- Show every severe caveat in full, next to its figure, in its own words (messageKa/messageEn), never by code.
- Round as a reader would. Explain only verified figures: a spending change does not by itself show better services, efficiency, waste or policy success or failure.
- Cite meta.sources and each figure's documentIds. When asked for all underlying evidence, include https://fiscal.ge/downloads/data/sources.json, the complete original-document catalogue; first/last examples alone are not a complete citation path, and manifest.json lists files, not originals. Data is CC BY 4.0; attribute Fiscal.ge.
- result_too_large: ask for fewer years, then entities, then series, or use the bulk file it names.`;
}
