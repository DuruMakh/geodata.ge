// apps/web/lib/mcp/tools.ts
//
// The nine read-only tools, wired to the pure query core. This file owns names,
// descriptions, schemas and annotations; it owns no arithmetic. Every figure
// still comes from lib/factQuery/, and every error envelope is the core's own.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodTypeAny } from "zod";
import { compare } from "../factQuery/compare";
import { describeCoverage } from "../factQuery/describeCoverage";
import { getSources } from "../factQuery/getSources";
import { queryMinistries } from "../factQuery/queryMinistries";
import { queryDebt } from "../factQuery/queryDebt";
import { queryDeficit } from "../factQuery/queryDeficit";
import { queryMunicipal } from "../factQuery/queryMunicipal";
import { queryNational } from "../factQuery/queryNational";
import { rank } from "../factQuery/rank";
import {
  compareInput,
  describeCoverageInput,
  getSourcesInput,
  queryMinistriesInput,
  queryDebtInput,
  queryDeficitInput,
  queryMunicipalInput,
  queryNationalInput,
  rankInput,
} from "../factQuery/schemas";
import { serverInstructions } from "./instructions";
import { outputSchemaFor } from "./outputSchema";
import { boundedToolResult, LIMITS, tooLargeResponse, toolResult } from "./result";
import { loadPackagedSnapshot } from "./snapshot";
import type { DatasetId, FactQueryResponse, FactQuerySnapshot } from "../factQuery/types";

export type ToolDefinition = {
  name: string;
  title: string;
  /** Built from the snapshot so coverage is never hardcoded (DESIGN.md section 2.1). */
  describe: (coverage: DatasetCoverage) => string;
  schema: ZodTypeAny;
  run: (snapshot: FactQuerySnapshot, input: unknown) => FactQueryResponse;
};

type DatasetCoverage = Record<DatasetId, string>;

/**
 * Read-only, non-destructive, closed world: every answer comes from the
 * packaged snapshot, so there is nothing to write and nothing outside to reach.
 * Idempotent because the same request against the same dataVersion always
 * returns the same figures.
 */
const ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const TOOLS: readonly ToolDefinition[] = [
  {
    name: "describe_coverage",
    title: "დაფარვა და შესაძლებლობები",
    describe: () =>
      "Ask this FIRST when you do not already know an id. Returns the datasets, entities, series, " +
      "hierarchy, calculated totals, legal measures, year coverage and documented exclusions that " +
      "actually exist. Optional `search` matches Georgian labels and Latin slugs, and works WITHOUT " +
      "a datasetId — search alone looks across all six datasets and each match names the dataset " +
      "it belongs to, so you can find an id before you know where it lives. Georgian case endings " +
      "are handled: `ბათუმის` finds `ბათუმი`. Never guess a series or entity id; take it from here.",
    schema: describeCoverageInput,
    run: (snapshot, input) => describeCoverage(snapshot, input),
  },
  {
    name: "query_national",
    title: "სახელმწიფო ბიუჯეტი",
    describe: (coverage) =>
      `Annual Georgian consolidated-budget receipts or state-budget expenditure by category, ${coverage["national-revenue"]} for ` +
      `revenue and ${coverage["national-expenditure"]} for expenditure, in nominal GEL. Measures: ` +
      "amount_gel, share_of_total_pct, share_of_gdp_pct. Revenue and expenditure are DIFFERENT " +
      "accounting boundaries: subtracting their totals does not give a deficit.",
    schema: queryNationalInput,
    run: (snapshot, input) => queryNational(snapshot, input),
  },
  {
    name: "query_ministries",
    title: "უწყებები და პროგრამები",
    describe: (coverage) =>
      `Spending by administrative category (ministry) or by major program, ${coverage.ministries}, in ` +
      "nominal GEL. Set `level` to admin_category or major_program; the two levels are separate " +
      "populations and their rows must never be summed together. Measures: amount_gel, " +
      "share_of_total_pct, share_of_gdp_pct.",
    schema: queryMinistriesInput,
    run: (snapshot, input) => queryMinistries(snapshot, input),
  },
  {
    name: "query_municipal",
    title: "მუნიციპალური ხარჯები",
    describe: (coverage) =>
      `Municipal expenditure by function, ${coverage["municipal-expenditure"]}, for 64 municipalities, 11 ` +
      "regions and the Georgia aggregate. `entityIds` takes a municipality code, a region id " +
      "(region.adjara) or the country id. Measures: amount_gel, share_of_total_pct, " +
      "gel_per_resident (2025 municipality/region totals only). Five municipal codes are excluded as not territorially attributable and " +
      "return an explained exclusion rather than a number. These are municipal budgets, not a " +
      "territorial split of national spending.",
    schema: queryMunicipalInput,
    run: (snapshot, input) => queryMunicipal(snapshot, input),
  },
  {
    name: "query_debt",
    title: "სახელმწიფო ვალი",
    describe: (coverage) =>
      `Annual Georgian government debt, ${coverage["government-debt"]}. Three families: stock (how ` +
      "much debt exists), service (principal and interest paid) and rate (year-end weighted-average " +
      "interest rate). Measures: amount_gel and share_of_gdp_pct for stock and service, rate_percent " +
      "for rates; a measure its family does not carry is rejected, not answered empty. This is " +
      "CENTRAL GOVERNMENT LIABILITIES, not a budget figure - never add it to expenditure or subtract " +
      "it from receipts. Service years after the last actual year are projections of the " +
      "already-outstanding portfolio, not recorded outcomes. Rate coverage is uneven: where no " +
      "reviewed source published a rate the cell is missing, which is not zero.",
    schema: queryDebtInput,
    run: (snapshot, input) => queryDebt(snapshot, input),
  },
  {
    name: "query_deficit",
    title: "ზოგადი მთავრობის ბალანსი",
    describe: (coverage) =>
      `The general government balance as measured by the IMF, ${coverage["general-government-balance"]}. ` +
      "Measures: share_of_gdp_pct and amount_gel, both published by the source rather than derived " +
      "here. VALUES ARE SIGNED - a negative value is a deficit and a positive one a surplus, so " +
      "report the sign. This is a different accounting boundary from the receipts and expenditure " +
      "served here and is NOT their difference. Years after the last actual year are IMF forecasts.",
    schema: queryDeficitInput,
    run: (snapshot, input) => queryDeficit(snapshot, input),
  },
  {
    name: "compare",
    title: "შედარება ორ წელს შორის",
    describe: () =>
      "Change between two years for one target, with the comparability judgement attached. Requires " +
      "fromYear < toYear (a cross-field rule the JSON Schema cannot express). Returns absolute, " +
      "percentage and percentage-point change as the measure allows, plus a comparability of " +
      "comparable, limited or not_comparable. Use this rather than subtracting two query results " +
      "yourself: it is what detects a definition change between the two years.",
    schema: compareInput,
    run: (snapshot, input) => compare(snapshot, input),
  },
  {
    name: "rank",
    title: "დალაგება",
    describe: () =>
      "Order series or entities by value or by change. `metric: value` requires `year`; the change " +
      "metrics require `fromYear` and `toYear` (cross-field rules the JSON Schema cannot express). " +
      "Ranking municipalities requires `entityType` and exactly one `seriesId`. Reports ties and " +
      "says when the cutoff splits one, and names every excluded candidate with its reason.",
    schema: rankInput,
    run: (snapshot, input) => rank(snapshot, input),
  },
  {
    name: "get_sources",
    title: "წყაროები",
    describe: () =>
      "The public originals behind a set of sourceIds: title, publisher, official and archived URLs, " +
      "checksum and coverage years. Optionally narrowed by dataset, years or entities. A source " +
      "whose figures are Fiscal.ge's own reviewed calculation states its derivation and cites the " +
      "upstream originals instead of a publication of the derived figures, because none exists.",
    schema: getSourcesInput,
    run: (snapshot, input) => getSources(snapshot, input),
  },
] as const;

/** Year ranges read from the snapshot's own catalogue, never hardcoded. */
function datasetCoverage(snapshot: FactQuerySnapshot): DatasetCoverage {
  const response = describeCoverage(snapshot, {});
  const coverage = {} as DatasetCoverage;

  if (response.kind !== "error") {
    const { datasets } = response.data as { datasets: { datasetId: DatasetId; years: [number, number] }[] };
    for (const dataset of datasets) coverage[dataset.datasetId] = `${dataset.years[0]}-${dataset.years[1]}`;
  }

  return coverage;
}

export function createMcpServer(): McpServer {
  const snapshot = loadPackagedSnapshot();
  const coverage = datasetCoverage(snapshot);

  const server = new McpServer(
    { name: "fiscal-ge", version: "1.0.0" },
    {
      instructions: serverInstructions(coverage, {
        // Counted, not written down, for the same reason the year ranges are.
        municipalities: snapshot.municipal.municipalities.length,
        regions: snapshot.municipal.regions.length,
      }),
    },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.describe(coverage),
        // The schema is registered so clients can SEE it and build valid calls;
        // that is what prevents most errors in the first place. The SDK also
        // validates against it and rejects a shape failure with its own English
        // InvalidParams before this handler runs. That is accepted: the field
        // names it names are the public ones already in the schema, and every
        // SEMANTIC error - unknown series, year out of range, unsupported
        // measure, result too large - still comes back as the core's own
        // bilingual envelope below.
        inputSchema: tool.schema,
        // Declared so a client KNOWS the structured twin exists. Every response
        // has always carried one, but without this a client has no way to learn
        // that and parses the text table instead.
        outputSchema: outputSchemaFor(tool.name),
        annotations: ANNOTATIONS,
      },
      (args: unknown) => {
        // The SDK has validated and deduplicated these arrays. Reject the
        // requested product before calculating cells or resolving their sources.
        const input = args as { years?: number[]; seriesIds?: string[]; entityIds?: string[]; target?: { seriesIds?: string[]; entityIds?: string[] } };
        const count = tool.name === "compare"
          ? (input.target?.entityIds?.length ?? 1) * (input.target?.seriesIds?.length ?? 1)
          : tool.name.startsWith("query_")
            ? (input.entityIds?.length ?? 1) * (input.seriesIds?.length ?? 1) * (input.years?.length ?? 1)
            : 0;
        const limit = tool.name === "compare" ? LIMITS.comparisonPairs : LIMITS.cells;
        if (count > limit) return toolResult(tooLargeResponse(snapshot, { returned: count, bytes: 0 }));
        return boundedToolResult(snapshot, tool.run(snapshot, args));
      },
    );
  }

  return server;
}
