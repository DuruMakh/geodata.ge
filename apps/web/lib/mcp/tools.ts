// apps/web/lib/mcp/tools.ts
//
// The read-only tools, wired to the pure query core. This file owns names,
// descriptions, schemas and annotations; it owns no arithmetic. Every figure
// still comes from lib/factQuery/, and every error envelope is the core's own.
import { McpServer, type StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import type { ZodTypeAny } from "zod";
import { compare } from "../factQuery/compare";
import { describeCoverage } from "../factQuery/describeCoverage";
import { getSources } from "../factQuery/getSources";
import { queryMinistries } from "../factQuery/queryMinistries";
import { queryDebt } from "../factQuery/queryDebt";
import { queryGdp } from "../factQuery/queryGdp";
import { queryGdpInput } from "../factQuery/schemas";
import { queryEconomicSectors } from "../factQuery/queryEconomicSectors";
import { queryEconomicSectorsInput } from "../factQuery/schemas";
import { queryRegionalEconomies } from "../factQuery/queryRegionalEconomies";
import { queryRegionalEconomiesInput } from "./schemas.regional-economies";
import { inflationDatasetPeriods, inflationEntityPeriods } from "../factQuery/inflationData";
import { inflationCellCount, queryInflation } from "../factQuery/queryInflation";
import { queryInflationInput } from "../factQuery/schemas";
import { productQueryCellCount, queryInflationProducts } from "../factQuery/queryInflationProducts";
import { queryInflationProductsInput } from "../factQuery/schemas";
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
import { SECTOR_QUERY_MEASURES, sectorMeasureYearSpans } from "../factQuery/economicSectorsSeries";
import { MUNICIPAL_PER_RESIDENT_YEAR } from "../explorer/municipalData";
import { serverInstructions, type SectorMeasureYears } from "./instructions";
import { outputSchemaFor } from "./outputSchema";
import { boundedToolResult, internalErrorResult, LIMITS, resultSizeKind, tooLargeResponse, toolResult } from "./result";
import { loadPackagedSnapshot } from "./snapshot";
import type { DatasetId, FactQueryResponse, FactQuerySnapshot } from "../factQuery/types";

export type ToolDefinition = {
  name: string;
  title: string;
  /** Built from the snapshot so coverage is never hardcoded (DESIGN.md section 2.1). */
  describe: (coverage: DatasetCoverage, facts: ServiceFacts) => string;
  schema: ZodTypeAny;
  run: (snapshot: FactQuerySnapshot, input: unknown) => FactQueryResponse;
};

type DatasetCoverage = Record<DatasetId, string>;

/** Other counts and ranges the text states, read from the same snapshot. */
type ServiceFacts = {
  datasetCount: number;
  sectorMeasureYears: SectorMeasureYears;
  inflationPeriods: string;
  inflationGroupCount: number;
  regionalRegions: number;
  regionalActivities: number;
  regionalLastYear: number;
  cityLabelsEn: string[];
  cityFirstPeriod: string;
  cityDivisions: number;
  municipalities: number;
  municipalRegions: number;
  sectorActivities: number;
};

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
    name: "query_regional_economies",
    title: "რეგიონული ეკონომიკები / Regional economies",
    describe: (coverage, facts) =>
      `Annual GDP and ${facts.regionalActivities} NACE Rev.2 economic activities for Georgia's ${facts.regionalRegions} published regions, ${coverage["regional-economies"]}. Measures: amount_gel and share_of_region_gdp_pct. Values are current-price GEL; activities are GVA at basic prices, while each share divides by the same region's complete market-price GDP. Percent 7.5 means 7.5%. No year after ${facts.regionalLastYear}, real growth, per-capita values, national GDP share, rankings, forecasts or multi-region chart implication.`,
    schema: queryRegionalEconomiesInput,
    run: queryRegionalEconomies,
  },
  {
    name: "query_economic_sectors",
    title: "ეკონომიკის სექტორები / Economic sectors",
    describe: (coverage, facts) =>
      `National economic activities A–T and Total GDP, ${coverage["economic-sectors"]}. Nominal GEL and GDP shares cover ${facts.sectorMeasureYears.amount_gel}; annual real growth covers ${facts.sectorMeasureYears.real_growth_pct}. Use describe_coverage for IDs and measure-specific years. Measures: amount_gel, share_of_gdp_pct, real_growth_pct. Sectors are GVA at basic prices; shares divide by market-price GDP, not selected sectors. Percent 7.5 means 7.5%. No regions, ranking, contributions or cumulative comparisons.`,
    schema: queryEconomicSectorsInput,
    run: queryEconomicSectors,
  },
  {
    name: "query_gdp",
    title: "მშპ / GDP",
    describe: coverage =>
      `Annual GDP overview, ${coverage["gdp-overview"]}. Use describe_coverage for the six series IDs and their exact years. Series encode current GEL/USD, constant-2015 USD, annual real growth percent, or nominal GDP per capita GEL/USD. No currency conversion, index rebasing, population calculation, forecasts, ranking or cumulative comparison. Growth 7.5 means 7.5%. For long histories request one series at a time to stay within the response-size limit. Published/preliminary status and source caveats travel with every result.`,
    schema: queryGdpInput,
    run: (snapshot, input) => queryGdp(snapshot, input),
  },
  {
    name: "query_inflation",
    title: "ინფლაცია / Inflation",
    describe: (_coverage, facts) =>
      `Monthly consumer-price inflation for Georgia, ${facts.inflationPeriods}: national CPI (cpi.headline, cpi.core, cpi.core_ex_tobacco), ` +
      `the National Bank of Georgia target (cpi.target), ${facts.inflationGroupCount} COICOP divisions and subgroups, their annual basket weights, ` +
      "and Fiscal.ge-derived contributions to annual inflation. Pass fromPeriod and toPeriod as YYYY-MM (inclusive) and one measure: " +
      "yoy_pct, mom_pct, avg12_pct, index_2010, target_pct, basket_weight_pct (one cell per calendar year) or contribution_pp. " +
      "A measure a series does not publish is rejected with the valid measures. Percent values use 2.4 for 2.4%. " +
      "Contributions are percentage points, never mix divisions and subgroups, and arrive with a residual series that closes them on the published headline. " +
      "Take the latest month from describe_coverage. Monthly changes do not add up to annual inflation, and the 12-month average is not annual inflation. " +
      "One answer fits about 250 cells (entities × series × months): a single series' full history, or a year of every division's contributions. " +
      "Beyond that ask for fewer months or groups; a result over the response-size limit is refused and points to the bulk files. " +
      `Optional entityIds: country.georgia (default) or the ${facts.cityLabelsEn.length} city.* ids from describe_coverage — ${facts.cityLabelsEn.join(", ")} — from ${facts.cityFirstPeriod}, for cpi.headline and cpi.cat.01–12 (yoy_pct, mom_pct; avg12_pct for cpi.headline). Cells count entities × series × months.`,
    schema: queryInflationInput,
    run: (snapshot, input) => queryInflation(snapshot, input),
  },
  {
    name: "query_inflation_products",
    title: "პროდუქტების ინფლაცია / Product inflation",
    describe: coverage =>
      `Reviewed current-basket products for Georgia, ${coverage["inflation-products"]}. Discover IDs, firstPeriod and measure coverage with describe_coverage datasetId inflation-products. ` +
      "Measures are exactly yoy_pct (published annual index minus 100) and cumulative_pct (Fiscal.ge-derived compounded monthly inputs). " +
      "Pass inclusive fromPeriod and toPeriod (YYYY-MM). Cumulative requires startYear <= the year of fromPeriod and uses the previous December as calculationBasePeriod; annual rejects startYear. " +
      "One cumulative endpoint is one output cell even when its inputs span many years. Incomplete inputs or a later product start return missing with reasons, never a partial calculation. " +
      "No retail GEL prices, product weights, contributions, city products or retired products. Keep identity-history and derived-value caveats. " +
      "At most 500 output cells (products × output months); the 512 KiB evidence-inclusive limit can require fewer products/months or bulk files.",
    schema: queryInflationProductsInput,
    run: queryInflationProducts,
  },
  {
    name: "describe_coverage",
    title: "დაფარვა და შესაძლებლობები / Coverage and capabilities",
    describe: (_coverage, facts) =>
      "Ask this FIRST when you do not already know an id. Returns the datasets, entities, series, " +
      "hierarchy, calculated totals, legal measures, year coverage and documented exclusions that " +
      "actually exist. Optional `search` matches reviewed Georgian and English labels and Latin slugs, and works WITHOUT " +
      `a datasetId — search alone looks across all ${facts.datasetCount} datasets and each match names the dataset ` +
      "it belongs to, so you can find an id before you know where it lives. A search answers with the matches and " +
      "the datasets they belong to, not the whole catalogue. Use one meaningful keyword; if a phrase returns no matches, " +
      "try the principal word or browse the named dataset. A failed phrase match is not proof that the data is absent. Georgian case endings " +
      "are handled: `ბათუმის` finds `ბათუმი`. Never guess a series or entity id; take it from here.",
    schema: describeCoverageInput,
    run: (snapshot, input) => describeCoverage(snapshot, input),
  },
  {
    name: "query_national",
    title: "სახელმწიფო ბიუჯეტი / State budget",
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
    title: "უწყებები და პროგრამები / Ministries and programs",
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
    title: "მუნიციპალური ხარჯები / Municipal expenditure",
    describe: (coverage, facts) =>
      `Municipal expenditure by function, ${coverage["municipal-expenditure"]}, for ${facts.municipalities} municipalities, ${facts.municipalRegions} ` +
      "regions and the Georgia aggregate. `entityIds` takes a municipality code, a region id " +
      "(region.adjara) or the country id. Measures: amount_gel, share_of_total_pct, " +
      `gel_per_resident (${MUNICIPAL_PER_RESIDENT_YEAR} municipality/region totals only). Five municipal codes are excluded as not territorially attributable and ` +
      "return an explained exclusion rather than a number. These are municipal budgets, not a " +
      "territorial split of national spending.",
    schema: queryMunicipalInput,
    run: (snapshot, input) => queryMunicipal(snapshot, input),
  },
  {
    name: "query_debt",
    title: "სახელმწიფო ვალი / Government debt",
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
    title: "ზოგადი მთავრობის ბალანსი / General government balance",
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
    title: "შედარება ორ წელს შორის / Comparison between two years",
    describe: () =>
      "Change between two years, or for inflation two months, for one target, with the comparability judgement attached. " +
      "Budget, debt and balance targets require fromYear < toYear. Inflation targets { dataset: \"inflation\", seriesIds } " +
      "require fromPeriod < toPeriod (YYYY-MM), except basket_weight_pct, which takes fromYear < toYear. These are " +
      "cross-field rules the JSON Schema cannot express. Returns absolute, " +
      "percentage and percentage-point change as the measure allows, plus a comparability of " +
      "comparable, limited or not_comparable. Use this rather than subtracting two query results " +
      "yourself: it is what detects a definition change between the two years. " +
      "Product target { dataset: inflation-products, seriesIds } supports yoy_pct percentage-point change only. Cumulative comparison is refused; query_inflation_products with startYear returns accumulated price change.",
    schema: compareInput,
    run: (snapshot, input) => compare(snapshot, input),
  },
  {
    name: "rank",
    title: "დალაგება / Ranking",
    describe: () =>
      "Order series or entities by value or by change. `metric: value` requires `year`; the change " +
      "metrics require `fromYear` and `toYear` (cross-field rules the JSON Schema cannot express). " +
      "Ranking municipalities requires `entityType` and exactly one `seriesId`. Reports ties and " +
      "says when the cutoff splits one, and names every excluded candidate with its reason. For inflation: dimension series, " +
      "level division or subgroup (optionally parentSeriesId), and period with metric value or fromPeriod and toPeriod with percentage_point_change. " +
      "For inflation cities: dimension entities, entityType city, one seriesId, and the same period fields. " +
      "For inflation-products: dimension series, metric value, period, and yoy_pct or cumulative_pct (the latter requires startYear and states its previous-December base). " +
      "All current products are candidates; incomplete histories are explicitly excluded. No product entity/region/parent/level filters or change-ranking metrics.",
    schema: rankInput,
    run: (snapshot, input) => rank(snapshot, input),
  },
  {
    name: "get_sources",
    title: "წყაროები / Sources",
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

function serviceFacts(snapshot: FactQuerySnapshot, coverage: DatasetCoverage): ServiceFacts {
  const spans = sectorMeasureYearSpans(snapshot);
  const activities = (registry: { classificationCode: string | null }[]) => registry.filter((series) => series.classificationCode !== null).length;
  return {
    datasetCount: Object.keys(coverage).length,
    sectorMeasureYears: Object.fromEntries(
      Object.entries(SECTOR_QUERY_MEASURES).map(([queryMeasure, measure]) => [queryMeasure, `${spans[measure][0]}-${spans[measure][1]}`]),
    ),
    inflationPeriods: inflationDatasetPeriods(snapshot).join(" to "),
    inflationGroupCount: snapshot.inflation.groups.length,
    regionalRegions: snapshot.regionalEconomies.regions.length,
    regionalActivities: activities(snapshot.regionalEconomies.registry),
    regionalLastYear: Math.max(...snapshot.regionalEconomies.facts.map((fact) => fact.year)),
    cityLabelsEn: snapshot.inflation.cityEntities.map((city) => city.labelEn),
    cityFirstPeriod: [...inflationEntityPeriods(snapshot).values()].map(([first]) => first).sort()[0] ?? "see describe_coverage",
    cityDivisions: new Set(snapshot.inflation.cities.map((fact) => fact.seriesId).filter((id) => id.startsWith("cpi.cat."))).size,
    municipalities: snapshot.municipal.municipalities.length,
    municipalRegions: snapshot.municipal.regions.length,
    sectorActivities: activities(snapshot.economicSectors.registry),
  };
}

type ServiceText = { instructions: string; descriptions: ReadonlyMap<string, string> };

/**
 * What the server says about itself depends on the snapshot alone, and every
 * exchange builds a new server, so building it per request rebuilt the whole
 * catalogue for a ping (U30-01). Keyed by the snapshot object, which the loader
 * keeps for the life of the instance.
 */
const serviceTextBySnapshot = new WeakMap<FactQuerySnapshot, ServiceText>();

function serviceText(snapshot: FactQuerySnapshot): ServiceText {
  const cached = serviceTextBySnapshot.get(snapshot);
  if (cached !== undefined) return cached;

  const coverage = datasetCoverage(snapshot);
  const facts = serviceFacts(snapshot, coverage);
  const text: ServiceText = {
    instructions: serverInstructions(
      coverage,
      {
        // Counted, not written down, for the same reason the year ranges are.
        municipalities: facts.municipalities,
        regions: facts.municipalRegions,
        regionalEconomyRegions: facts.regionalRegions,
        regionalActivities: facts.regionalActivities,
        regionalLastYear: facts.regionalLastYear,
        sectorActivities: facts.sectorActivities,
        cities: facts.cityLabelsEn.length,
        cityDivisions: facts.cityDivisions,
        cityFirstPeriod: facts.cityFirstPeriod,
      },
      facts.sectorMeasureYears,
    ),
    descriptions: new Map(TOOLS.map((tool) => [tool.name, tool.describe(coverage, facts)])),
  };
  serviceTextBySnapshot.set(snapshot, text);
  return text;
}

/**
 * Drops what Zod emits that tells a client nothing: the ±(2^53 - 1) bounds on
 * every integer and `additionalProperties: {}`. Keys inside a `properties` map
 * are field names, not keywords, so they are never dropped.
 */
function compactJsonSchema(value: unknown, isPropertyMap = false): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map((item) => compactJsonSchema(item)));
  if (value === null || typeof value !== "object") return value;
  const compact: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!isPropertyMap) {
      if ((key === "minimum" && item === Number.MIN_SAFE_INTEGER) || (key === "maximum" && item === Number.MAX_SAFE_INTEGER)) continue;
      if (key === "additionalProperties" && item !== null && typeof item === "object" && Object.keys(item).length === 0) continue;
    }
    compact[key] = compactJsonSchema(item, !isPropertyMap && key === "properties");
  }
  return Object.freeze(compact);
}

/**
 * The SDK converts each registered schema to JSON Schema when a tool is
 * registered and again on every tools/list. The schemas never change, so this
 * converts each one once per instance (U30-01, U30-03). Validation is still
 * Zod's own, so arguments and results are checked exactly as before; the
 * cached JSON is frozen so nothing can alter what the next client is shown.
 */
function convertedOnce(schema: ZodTypeAny, safeValidationError?: string): StandardSchemaWithJSON {
  const standard = schema["~standard"] as StandardSchemaWithJSON["~standard"];
  const converted = new Map<string, Record<string, unknown>>();
  const convert = (io: "input" | "output") => (options: Parameters<StandardSchemaWithJSON["~standard"]["jsonSchema"]["input"]>[0]) => {
    const key = `${io}:${options.target}`;
    let json = converted.get(key);
    if (json === undefined) {
      json = compactJsonSchema(standard.jsonSchema[io](options)) as Record<string, unknown>;
      converted.set(key, json);
    }
    return json;
  };
  const validate: typeof standard.validate = safeValidationError === undefined ? standard.validate : async value => {
    try {
      const result = await standard.validate(value);
      if (result.issues) throw new Error(safeValidationError);
      return result;
    } catch {
      throw new Error(safeValidationError);
    }
  };
  return { "~standard": { version: 1, vendor: standard.vendor, validate, jsonSchema: { input: convert("input"), output: convert("output") } } };
}

let registeredSchemas: Map<string, { input: StandardSchemaWithJSON; output: StandardSchemaWithJSON }> | undefined;

export function createMcpServer(): McpServer {
  const snapshot = loadPackagedSnapshot();
  const safeResult = internalErrorResult(snapshot);
  const safeValidationError = safeResult.content[0]!.text;
  const { instructions, descriptions } = serviceText(snapshot);
  registeredSchemas ??= new Map(TOOLS.map((tool) => [tool.name, { input: convertedOnce(tool.schema), output: convertedOnce(outputSchemaFor(tool.name), safeValidationError) }]));

  const server = new McpServer(
    { name: "fiscal-ge", version: "1.0.0" },
    { capabilities: { tools: { listChanged: false } }, instructions },
  );

  for (const tool of TOOLS) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: descriptions.get(tool.name),
        // The schema is registered so clients can SEE it and build valid calls;
        // that is what prevents most errors in the first place. The SDK also
        // validates against it and rejects a shape failure with its own English
        // InvalidParams before this handler runs. That is accepted: the field
        // names it names are the public ones already in the schema, and every
        // SEMANTIC error - unknown series, year out of range, unsupported
        // measure, result too large - still comes back as the core's own
        // bilingual envelope below.
        inputSchema: registeredSchemas.get(tool.name)!.input,
        // Declared so a client KNOWS the structured twin exists. Every response
        // has always carried one, but without this a client has no way to learn
        // that and parses the text table instead.
        outputSchema: registeredSchemas.get(tool.name)!.output,
        annotations: ANNOTATIONS,
      },
      (args: unknown) => {
        try {
          // The SDK has validated and deduplicated these arrays. Reject the
          // requested product before calculating cells or resolving their sources.
          const input = args as { years?: number[]; fromYear?: number; toYear?: number; seriesIds?: string[]; entityIds?: string[]; regionIds?: string[]; target?: { seriesIds?: string[]; entityIds?: string[] } };
          const regionalYears = input.years?.length ?? (
            input.fromYear !== undefined && input.toYear !== undefined
              ? input.toYear - input.fromYear + 1
              : snapshot.regionalEconomies.facts.length > 0
                ? new Set(snapshot.regionalEconomies.facts.map((fact) => fact.year)).size
                : 0
          );
          const count = tool.name === "compare"
            ? (input.target?.entityIds?.length ?? 1) * (input.target?.seriesIds?.length ?? 1)
            : tool.name === "query_regional_economies"
              ? (input.regionIds?.length ?? snapshot.regionalEconomies.regions.length) * (input.seriesIds?.length ?? snapshot.regionalEconomies.registry.length) * regionalYears
            : tool.name === "query_inflation"
              ? inflationCellCount(args as Parameters<typeof inflationCellCount>[0])
              : tool.name === "query_inflation_products"
                ? productQueryCellCount(args as Parameters<typeof productQueryCellCount>[0])
              : tool.name.startsWith("query_")
                ? (input.entityIds?.length ?? 1) * (input.seriesIds?.length ?? 1) * (input.years?.length ?? 1)
                : 0;
          const limit = tool.name === "compare" ? LIMITS.comparisonPairs : LIMITS.cells;
          if (count > limit) return toolResult(tooLargeResponse(snapshot, { returned: count, bytes: 0 }));
          const result = boundedToolResult(snapshot, tool.run(snapshot, args), resultSizeKind(tool.name));
          if (!result.isError && result.structuredContent === undefined) throw new Error(safeValidationError);
          return result;
        } catch {
          return { ...safeResult, content: safeResult.content.map(item => ({ ...item })) };
        }
      },
    );
  }

  return server;
}
