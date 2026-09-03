// apps/web/lib/mcp/tools.ts
//
// The seven read-only tools, wired to the pure query core. This file owns names,
// descriptions, schemas and annotations; it owns no arithmetic. Every figure
// still comes from lib/factQuery/, and every error envelope is the core's own.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodTypeAny } from "zod";
import { compare } from "../factQuery/compare";
import { describeCoverage } from "../factQuery/describeCoverage";
import { getSources } from "../factQuery/getSources";
import { queryMinistries } from "../factQuery/queryMinistries";
import { queryMunicipal } from "../factQuery/queryMunicipal";
import { queryNational } from "../factQuery/queryNational";
import { rank } from "../factQuery/rank";
import {
  compareInput,
  describeCoverageInput,
  getSourcesInput,
  queryMinistriesInput,
  queryMunicipalInput,
  queryNationalInput,
  rankInput,
} from "../factQuery/schemas";
import { serverInstructions } from "./instructions";
import { boundedToolResult } from "./result";
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
      "actually exist. Optional `search` matches Georgian labels and Latin slugs. Never guess a " +
      "series or entity id; take it from here.",
    schema: describeCoverageInput,
    run: (snapshot, input) => describeCoverage(snapshot, input),
  },
  {
    name: "query_national",
    title: "სახელმწიფო ბიუჯეტი",
    describe: (coverage) =>
      `Annual Georgian state-budget revenue or expenditure by category, ${coverage["national-revenue"]} for ` +
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
      "gel_per_resident. Five municipal codes are excluded as not territorially attributable and " +
      "return an explained exclusion rather than a number. These are municipal budgets, not a " +
      "territorial split of national spending.",
    schema: queryMunicipalInput,
    run: (snapshot, input) => queryMunicipal(snapshot, input),
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
        annotations: ANNOTATIONS,
      },
      (args: unknown) => boundedToolResult(snapshot, tool.run(snapshot, args)),
    );
  }

  return server;
}
