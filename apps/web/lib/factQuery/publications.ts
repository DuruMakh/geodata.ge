// apps/web/lib/factQuery/publications.ts
//
// Build-time bulk publications (spec section 12.1). Pure: a snapshot in, byte
// buffers out. No filesystem, no process, no network - the script in
// scripts/prepare-fact-query-publications.ts owns all I/O, exactly as
// buildSnapshot and prepare-fact-query-snapshot already split those concerns.
//
// Every figure here comes from the Part 1 query functions. Nothing in this
// file recalculates a budget number, so a published file and an MCP answer
// cannot disagree: there is only one implementation of an observation.
import { queryGdp } from "./queryGdp";
import { queryEconomicSectors } from "./queryEconomicSectors";
import { SECTOR_QUERY_MEASURES } from "./economicSectorsSeries";
import { GDP_QUERY_SERIES } from "./gdpSeries";
import { csvEscape } from "../data/csvEscape";
import { CONTRIBUTION_FIRST_YEAR } from "../data/inflation/contributions";
import { inflationSeriesCoverage, measurePeriodRange, periodsBetween, weightYearRange } from "./inflationData";
import { INFLATION_DEFINITIONS, NATIONAL_SERIES, TARGET_SERIES_ID, type InflationMeasure } from "./inflationSeries";
import { inflationObservations } from "./queryInflation";
import { createHash } from "node:crypto";
import { MUNICIPAL_COUNTRY_ID } from "../data/municipal/types";
import { describeCoverage, type CoverageData } from "./describeCoverage";
import { serviceMessage } from "./localization";
import type { Observation } from "./observations";
import { queryMinistries } from "./queryMinistries";
import { queryDebt } from "./queryDebt";
import { queryDeficit } from "./queryDeficit";
import { queryMunicipal } from "./queryMunicipal";
import { queryNational } from "./queryNational";
import { AGGREGATE_ONLY_MUNICIPAL_CODES } from "./types";
import type { Caveat, Coverage, DatasetId, FactQueryResponse, FactQuerySnapshot, ResolvedSource } from "./types";

export type PublicationHeader = {
  schemaVersion: string;
  dataVersion: string;
  releaseCommit: string;
  generatedAt: string;
  publisher: string;
  licence: string;
  licenceUrl: string;
  attribution: string;
};

export type PublicationArtifact = {
  fileName: string;
  bytes: Buffer;
  rowCount: number;
};

// Drives buildCatalogueFile's datasets array and buildManifestFile's coverage
// array. Widening DatasetId does not force an entry here, so a dataset served
// over /mcp can silently be absent from the published catalogue - which is
// exactly what happened to debt and the balance until this was widened.
const DATASET_IDS: readonly DatasetId[] = [
  "national-revenue",
  "national-expenditure",
  "ministries",
  "municipal-expenditure",
  "government-debt",
  "general-government-balance",
  "gdp-overview",
  "economic-sectors",
  "inflation",
];

/**
 * Repeated at the top of every published file so a download read on its own,
 * without llms.txt or the manifest, still states its version, licence and
 * attribution (spec section 12.1).
 */
export function publicationHeader(snapshot: FactQuerySnapshot): PublicationHeader {
  return {
    schemaVersion: snapshot.schemaVersion,
    dataVersion: snapshot.dataVersion,
    releaseCommit: snapshot.releaseCommit,
    generatedAt: snapshot.generatedAt,
    publisher: "Fiscal.ge",
    licence: "CC BY 4.0",
    licenceUrl: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Fiscal.ge, CC BY 4.0",
  };
}

/** Stable two-space JSON with a trailing newline, matching the snapshot writer. */
export function serialize(value: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * describeCoverage returns FactQueryResponse, whose `data` is `unknown` by
 * contract. The kind check is what makes the cast safe: a catalogue response
 * always carries CoverageData, and anything else is a build-stopping bug
 * rather than something to publish.
 */
export function catalogueData(snapshot: FactQuerySnapshot, datasetId?: DatasetId): CoverageData {
  const response = describeCoverage(snapshot, datasetId === undefined ? {} : { datasetId });
  if (response.kind !== "catalogue") {
    throw new Error(`describeCoverage(${datasetId ?? "all"}) returned ${response.kind}, expected catalogue`);
  }
  return response.data as CoverageData;
}

export function buildCatalogueFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const overview = catalogueData(snapshot);

  const datasets = DATASET_IDS.map((datasetId) => {
    const data = catalogueData(snapshot, datasetId);
    const summary = data.datasets.find((entry) => entry.datasetId === datasetId);
    if (summary === undefined) throw new Error(`No dataset summary for ${datasetId}`);
    return {
      ...summary,
      series: data.series ?? [],
      ...(data.entities !== undefined ? { entities: data.entities } : {}),
    };
  });

  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice: serviceMessage(snapshot, "ka", "publication.catalogueNotice"),
    noticeEn: serviceMessage(snapshot, "en", "publication.catalogueNotice"),
    datasets,
    exclusions: overview.exclusions,
  });

  return {
    fileName: "catalogue.json",
    bytes,
    rowCount: datasets.reduce((total, dataset) => total + dataset.series.length, 0),
  };
}

export function buildSourcesFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    notice: serviceMessage(snapshot, "ka", "publication.sourcesNotice"),
    noticeEn: serviceMessage(snapshot, "en", "publication.sourcesNotice"),
    sources: snapshot.sources,
  });

  return { fileName: "sources.json", bytes, rowCount: snapshot.sources.length };
}

/**
 * Built LAST, over the exact buffers that get written. Hashing a
 * re-serialization would let the manifest describe bytes nobody published.
 * The manifest cannot list itself: writing its own hash would change its own
 * bytes.
 */
export function buildManifestFile(
  snapshot: FactQuerySnapshot,
  artifacts: readonly PublicationArtifact[],
): PublicationArtifact {
  const bytes = serialize({
    ...publicationHeader(snapshot),
    // Spec 12.1 assigns coverage to the manifest. Without it a client had to
    // fetch 12 MB to learn which years the municipal file spans.
    coverage: DATASET_IDS.map((datasetId) => {
      const summary = catalogueData(snapshot, datasetId).datasets.find((entry) => entry.datasetId === datasetId);
      if (summary === undefined) throw new Error(`No dataset summary for ${datasetId}`);
      return { datasetId, firstYear: summary.years[0], lastYear: summary.years[1] };
    }),
    files: artifacts.map((artifact) => ({
      fileName: artifact.fileName,
      url: `/downloads/data/${artifact.fileName}`,
      rowCount: artifact.rowCount,
      byteSize: artifact.bytes.byteLength,
      sha256: sha256(artifact.bytes),
      mediaType: artifact.fileName.endsWith(".csv") ? "text/csv" : "application/json",
    })),
  });

  return { fileName: "manifest.json", bytes, rowCount: artifacts.length };
}

type ObservationResult = {
  data: { observations: Observation[]; coverage: Coverage };
  meta: { sources: ResolvedSource[]; caveats: Caveat[] };
};

/**
 * `status` is deliberately not asserted. A bulk query over every series and
 * year legitimately reports "partial", because a series that does not exist in
 * every year produces missing cells - and those cells are published in
 * `coverage` rather than hidden. Only a non-observations `kind` is a bug.
 */
function observationsOf(response: FactQueryResponse, label: string): ObservationResult {
  if (response.kind !== "observations") {
    const detail = response.kind === "error" ? response.error.messageEn : response.kind;
    throw new Error(`${label} returned ${detail}, expected observations`);
  }
  return response as unknown as ObservationResult;
}

function datasetFile(
  snapshot: FactQuerySnapshot,
  datasetId: DatasetId,
  fileName: string,
  response: FactQueryResponse,
  supportingValues: Record<string, unknown>,
): PublicationArtifact {
  const result = observationsOf(response, fileName);
  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId,
    notice: serviceMessage(snapshot, "ka", "publication.sumWarning"),
    noticeEn: serviceMessage(snapshot, "en", "publication.sumWarning"),
    catalogue: catalogueData(snapshot, datasetId),
    observations: result.data.observations,
    coverage: result.data.coverage,
    supportingValues,
    // Repeated in full, not by reference: spec 12.1 requires source and caveat
    // definitions to stay usable when the file is downloaded on its own.
    sources: result.meta.sources,
    caveats: result.meta.caveats,
  });

  return { fileName, bytes, rowCount: result.data.observations.length };
}

function yearsOf(values: readonly { year: number }[]): number[] {
  return [...new Set(values.map((value) => value.year))].sort((left, right) => left - right);
}

/**
 * The catalogue is the authority on which totals a dataset has, so the file
 * can never advertise a total it does not publish. Deriving the list instead
 * of hardcoding it is the whole point: the first version built seriesIds from
 * the served facts alone, and a calculated total has no fact row, so
 * revenue.total, expenditure.total and admin_spending.total silently vanished
 * from three of four files while their own catalogues still listed them.
 */
function totalSeriesIds(snapshot: FactQuerySnapshot, datasetId: DatasetId): string[] {
  return (catalogueData(snapshot, datasetId).series ?? [])
    .filter((entry) => entry.level === "total")
    .map((entry) => entry.seriesId);
}

/**
 * Union two responses' caveats by code, merging their `affects` lists.
 *
 * A first-wins dedup loses scope: `Caveat.affects` is computed per response,
 * so a code firing at both ministries levels with disjoint lists kept only the
 * first. 1,056 of 1,364 ministries rows declared `nominal_gel` (since retired)
 * while the published caveat's `affects` named only the 14 admin series.
 * Harmless for a note; the same path would drop a severe caveat's scope as soon
 * as a planned ministries fact exists.
 */
function mergeCaveats(left: readonly Caveat[], right: readonly Caveat[]): Caveat[] {
  const byCode = new Map<string, Caveat>();
  for (const caveat of [...left, ...right]) {
    const seen = byCode.get(caveat.code);
    byCode.set(
      caveat.code,
      seen === undefined ? caveat : { ...seen, affects: [...new Set([...seen.affects, ...caveat.affects])].sort() },
    );
  }
  return [...byCode.values()];
}

/** Same hazard as caveats: merge a source's documents rather than keeping the first list. */
function mergeSources(left: readonly ResolvedSource[], right: readonly ResolvedSource[]): ResolvedSource[] {
  const bySourceId = new Map<string, ResolvedSource>();
  for (const source of [...left, ...right]) {
    const seen = bySourceId.get(source.sourceId);
    if (seen === undefined) {
      bySourceId.set(source.sourceId, source);
      continue;
    }
    const documents = [...seen.documents];
    for (const document of source.documents) {
      if (!documents.some((existing) => existing.documentId === document.documentId)) documents.push(document);
    }
    bySourceId.set(source.sourceId, { ...seen, documents });
  }
  return [...bySourceId.values()];
}

/**
 * Ministries publishes both hierarchy levels in one file (spec 12.1). The two
 * responses are queried separately because `level` is a request dimension,
 * then concatenated; every row still carries its own `level`. Sources and
 * caveats are unioned by id so the file states each one once.
 */
function ministriesFile(snapshot: FactQuerySnapshot): PublicationArtifact {
  const years = yearsOf(snapshot.ministries.facts);
  const admin = observationsOf(
    queryMinistries(snapshot, {
      level: "admin_category",
      // The applicable total rides with the admin level (spec 12.1). Without
      // it the file advertised admin_spending.total in its own catalogue and
      // published no row for it.
      seriesIds: [
        ...snapshot.ministries.categories.map((category) => category.id),
        ...totalSeriesIds(snapshot, "ministries"),
      ],
      years,
      measure: "amount_gel",
    }),
    "ministries.json (admin_category)",
  );
  // Program series are the itemIds of the major_program-level facts.
  const programSeriesIds = [
    ...new Set(snapshot.ministries.facts.filter((fact) => fact.level === "major_program").map((fact) => fact.itemId)),
  ];
  const programs = observationsOf(
    queryMinistries(snapshot, { level: "major_program", seriesIds: programSeriesIds, years, measure: "amount_gel" }),
    "ministries.json (major_program)",
  );

  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId: "ministries" satisfies DatasetId,
    notice: serviceMessage(snapshot, "ka", "publication.sumWarning"),
    noticeEn: serviceMessage(snapshot, "en", "publication.sumWarning"),
    catalogue: catalogueData(snapshot, "ministries"),
    observations: [...admin.data.observations, ...programs.data.observations],
    coverage: { admin_category: admin.data.coverage, major_program: programs.data.coverage },
    supportingValues: { gdpFacts: snapshot.gdpFacts },
    sources: mergeSources(admin.meta.sources, programs.meta.sources),
    caveats: mergeCaveats(admin.meta.caveats, programs.meta.caveats),
  });

  return {
    fileName: "ministries.json",
    bytes,
    rowCount: admin.data.observations.length + programs.data.observations.length,
  };
}

// Derived from the facts rather than listed, so a tenth reviewed debt series is
// published rather than silently dropped - the same failure totalSeriesIds
// above exists to prevent.
function debtSeriesIds(snapshot: FactQuerySnapshot, kind: "amount" | "rate"): string[] {
  const wanted = kind === "rate" ? ["rate"] : ["stock", "service"];
  return [...new Set(snapshot.debt.facts.filter((f) => wanted.includes(f.family)).map((f) => f.seriesId))];
}

export function buildDatasetFiles(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const nationalYears = yearsOf(snapshot.national.facts);
  const seriesFor = (side: "revenue" | "expenditure") => [
    ...new Set(snapshot.national.facts.filter((fact) => fact.side === side).map((fact) => fact.itemId)),
  ];
  // amount_gel only (spec 12.1): shares and per-resident figures are
  // reproducible from these denominators, so publishing four measures of every
  // row would multiply the file to say nothing new.
  const gdp = { gdpFacts: snapshot.gdpFacts };

  const municipalEntityIds = [
    ...snapshot.municipal.municipalities
      .map((municipality) => municipality.code)
      .filter(
        (code) => !AGGREGATE_ONLY_MUNICIPAL_CODES.includes(code as (typeof AGGREGATE_ONLY_MUNICIPAL_CODES)[number]),
      ),
    ...snapshot.municipal.regions.map((region) => region.id),
    MUNICIPAL_COUNTRY_ID,
  ];

  return [
    datasetFile(
      snapshot,
      "national-revenue",
      "national-revenue.json",
      queryNational(snapshot, {
        side: "revenue",
        seriesIds: [...seriesFor("revenue"), ...totalSeriesIds(snapshot, "national-revenue")],
        years: nationalYears,
        measure: "amount_gel",
      }),
      gdp,
    ),
    datasetFile(
      snapshot,
      "national-expenditure",
      "national-expenditure.json",
      queryNational(snapshot, {
        side: "expenditure",
        seriesIds: [...seriesFor("expenditure"), ...totalSeriesIds(snapshot, "national-expenditure")],
        years: nationalYears,
        measure: "amount_gel",
      }),
      gdp,
    ),
    ministriesFile(snapshot),
    datasetFile(
      snapshot,
      "municipal-expenditure",
      "municipal-expenditure.json",
      queryMunicipal(snapshot, {
        entityIds: municipalEntityIds,
        seriesIds: [
          ...snapshot.municipal.functions.map((fn) => fn.id),
          ...totalSeriesIds(snapshot, "municipal-expenditure"),
        ],
        years: yearsOf(snapshot.municipal.functionFacts),
        measure: "amount_gel",
      }),
      { populationFacts: snapshot.municipal.populationFacts.map(fact => ({
        ...fact,
        transformationKa: serviceMessage(snapshot, "ka", "supporting.populationTransformation", { sheet: fact.sourceSheet, cell: fact.sourceCell, year: fact.year }),
        transformationEn: serviceMessage(snapshot, "en", "supporting.populationTransformation", { sheet: fact.sourceSheet, cell: fact.sourceCell, year: fact.year }),
        sourceUnitKa: serviceMessage(snapshot, "ka", "supporting.populationUnit"),
        sourceUnitEn: serviceMessage(snapshot, "en", "supporting.populationUnit"),
      })) },
    ),
    // amount_gel only, like every dataset file above: the GDP share is
    // reproducible from the denominators shipped alongside. Rates are the
    // exception - a rate has no amount form, so its own measure is the only way
    // to publish it at all, and it goes in a second file rather than being
    // mixed into one whose every other row is money.
    datasetFile(
      snapshot,
      "government-debt",
      "government-debt.json",
      queryDebt(snapshot, {
        seriesIds: debtSeriesIds(snapshot, "amount"),
        years: yearsOf(snapshot.debt.facts),
        measure: "amount_gel",
      }),
      gdp,
    ),
    datasetFile(
      snapshot,
      "government-debt",
      "government-debt-rates.json",
      queryDebt(snapshot, {
        seriesIds: debtSeriesIds(snapshot, "rate"),
        years: yearsOf(snapshot.debt.facts.filter((fact) => fact.family === "rate")),
        measure: "rate_percent",
      }),
      {},
    ),
    datasetFile(
      snapshot,
      "general-government-balance",
      "general-government-balance.json",
      queryDeficit(snapshot, {
        years: yearsOf(snapshot.deficit.facts),
        measure: "share_of_gdp_pct",
      }),
      // The published GEL amount travels with the share so the file carries
      // both measures the source publishes, without a second request.
      { balanceGelByYear: Object.fromEntries(snapshot.deficit.facts.map((f) => [f.year, f.generalGovernmentBalanceGel])) },
    ),
  ];
}

export function buildGdpCsv(snapshot: FactQuerySnapshot): PublicationArtifact {
 const rows=snapshot.gdpOverview.facts;
 const text="\uFEFFseries_id,year,value,unit,status,source_id\n"+rows.map(f=>[f.seriesId,f.year,f.value,f.unit,f.status,f.sourceId].map(csvEscape).join(",")).join("\n")+"\n";
 return {fileName:"gdp-overview.csv",bytes:Buffer.from(text,"utf8"),rowCount:rows.length};
}

export function buildAllPublications(snapshot: FactQuerySnapshot): PublicationArtifact[] {
  const inflationCategories = inflationCategoryParts(snapshot);
  const inflationCategoriesCsv = buildInflationCategoriesCsv(inflationCategories);
  const artifacts = [buildCatalogueFile(snapshot), buildSourcesFile(snapshot), ...buildDatasetFiles(snapshot),
 datasetFile(snapshot,"gdp-overview","gdp-overview.json",queryGdp(snapshot,{seriesIds:Object.keys(GDP_QUERY_SERIES),years:yearsOf(snapshot.gdpOverview.facts)}),{}),
 buildGdpCsv(snapshot), buildEconomicSectorsJson(snapshot), buildEconomicSectorsCsv(snapshot),
    buildInflationNationalJson(snapshot), inflationCategoriesCsv, buildInflationCategoriesJson(snapshot, inflationCategories, inflationCategoriesCsv)];
  return [...artifacts, buildManifestFile(snapshot, artifacts)];
}

export function buildEconomicSectorsCsv(snapshot: Pick<FactQuerySnapshot, "economicSectors">): PublicationArtifact {
  const { facts, registry } = snapshot.economicSectors;
  // Match snapshot identity ordering, independent of canonical import row order.
  const ordered = [...facts].sort((a, b) => {
    if (a.seriesId !== b.seriesId) return a.seriesId < b.seriesId ? -1 : 1;
    if (a.measure !== b.measure) return a.measure < b.measure ? -1 : 1;
    return a.year - b.year;
  });
  const text = "\uFEFFseries_id,label_ka,label_en,year,measure,value,unit,valuation,price_basis,calculation,status,source_id\n" + ordered.map(f=>{
    const r=registry.find(r=>r.id===f.seriesId)!;
    return [f.seriesId,r.labelKa,r.labelEn,f.year,f.measure,f.value,f.unit,f.valuation,f.priceBasis,f.calculation,f.status,f.sourceId].map(csvEscape).join(",");
  }).join("\n")+"\n";
  return {fileName:"economic-sectors.csv",bytes:Buffer.from(text,"utf8"),rowCount:facts.length};
}

function buildEconomicSectorsJson(snapshot: FactQuerySnapshot): PublicationArtifact {
  const results=Object.keys(SECTOR_QUERY_MEASURES).map(measure=>queryEconomicSectors(snapshot,{
    measure,seriesIds:snapshot.economicSectors.registry.map(r=>r.id),years:yearsOf(snapshot.economicSectors.facts),
  }));
  const parts=results.map(r=>observationsOf(r,"economic-sectors.json"));
  const first=results[0];
  if(first.kind!=="observations") throw new Error("Sector publication query failed");
  const observations=parts.flatMap(p=>p.data.observations);
  const returnedCount = observations.filter(o => o.availability === "available").length;
  const response: FactQueryResponse={...first,status:returnedCount === observations.length ? "ok" : returnedCount ? "partial" : "empty",data:{observations,coverage:{...parts[0].data.coverage,
    missingCells:parts.flatMap(p=>p.data.coverage.missingCells),expectedCount:observations.length,returnedCount,
  }},meta:{...first.meta,
    sources:parts.reduce<ResolvedSource[]>((all, part) => mergeSources(all, part.meta.sources), []),
    caveats:parts.reduce<Caveat[]>((all, part) => mergeCaveats(all, part.meta.caveats), []),
  }};
  return datasetFile(snapshot,"economic-sectors","economic-sectors.json",response,{});
}

/**
 * Several observation responses of one dataset as one file body. Coverage stays
 * per part, keyed by measure, the way ministries.json keys it by level: the parts
 * span different months and years, so one merged block would describe only the
 * first part. Sources and caveats are unioned.
 */
function mergeObservationResponses(label: string, parts: Record<string, FactQueryResponse>): FactQueryResponse {
  const responses = Object.values(parts);
  const results = responses.map((response) => observationsOf(response, label));
  const first = responses[0]!;
  if (first.kind !== "observations") throw new Error(`${label}: expected observations`);
  const observations = results.flatMap((result) => result.data.observations);
  const returnedCount = observations.filter((o) => o.availability === "available").length;
  return {
    ...first,
    status: returnedCount === observations.length ? "ok" : returnedCount > 0 ? "partial" : "empty",
    data: {
      observations,
      coverage: Object.fromEntries(Object.keys(parts).map((key, index) => [key, results[index]!.data.coverage])),
    },
    meta: {
      ...first.meta,
      sources: results.reduce<ResolvedSource[]>((all, result) => mergeSources(all, result.meta.sources), []),
      caveats: results.reduce<Caveat[]>((all, result) => mergeCaveats(all, result.meta.caveats), []),
    },
  };
}

/** Every month any of these series publishes the measure. */
function inflationMonths(snapshot: FactQuerySnapshot, seriesIds: string[], measure: InflationMeasure): string[] {
  const coverage = inflationSeriesCoverage(snapshot);
  const ranges = seriesIds.flatMap((id) => coverage.get(id)?.periodsByMeasure[measure] ?? []);
  const firsts = ranges.filter((_, index) => index % 2 === 0).sort();
  const lasts = ranges.filter((_, index) => index % 2 === 1).sort();
  return periodsBetween(firsts[0]!, lasts.at(-1)!);
}

function buildInflationNationalJson(snapshot: FactQuerySnapshot): PublicationArtifact {
  const parts: Record<string, FactQueryResponse> = Object.fromEntries(
    (["index_2010", "yoy_pct", "mom_pct", "avg12_pct"] as const).map((measure) => {
      const seriesIds = Object.entries(NATIONAL_SERIES).filter(([, series]) => series.measures.includes(measure)).map(([id]) => id);
      return [measure, inflationObservations(snapshot, { seriesIds, measure, periods: inflationMonths(snapshot, seriesIds, measure) }, { includeResidual: false })];
    }),
  );
  const headline = measurePeriodRange(snapshot, "yoy_pct")!;
  parts.target_pct = inflationObservations(snapshot, { seriesIds: [TARGET_SERIES_ID], measure: "target_pct", periods: periodsBetween(headline[0], headline[1]) }, { includeResidual: false });
  const [minYear, maxYear] = weightYearRange(snapshot);
  parts.basket_weight_pct = inflationObservations(
    snapshot,
    { seriesIds: snapshot.inflation.groups.map((group) => group.id), measure: "basket_weight_pct", years: Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i) },
    { includeResidual: false },
  );
  return datasetFile(snapshot, "inflation", "inflation-national.json", mergeObservationResponses("inflation-national.json", parts), {});
}

type InflationCategoryPart = { selection: "" | "divisions" | "subgroups"; response: FactQueryResponse };

/** Group rates for every group, then contributions per full level with that level's residual. */
function inflationCategoryParts(snapshot: FactQuerySnapshot): InflationCategoryPart[] {
  const ids = (level?: "division" | "subgroup") => snapshot.inflation.groups.filter((g) => level === undefined || g.level === level).map((g) => g.id);
  const rates = (measure: "yoy_pct" | "mom_pct"): InflationCategoryPart => ({
    selection: "",
    response: inflationObservations(snapshot, { seriesIds: ids(), measure, periods: inflationMonths(snapshot, ids(), measure) }, { includeResidual: false }),
  });
  const contributionMonths = periodsBetween(`${CONTRIBUTION_FIRST_YEAR}-01`, measurePeriodRange(snapshot, "yoy_pct")![1]);
  const contributions = (level: "division" | "subgroup"): InflationCategoryPart => ({
    selection: level === "division" ? "divisions" : "subgroups",
    response: inflationObservations(snapshot, { seriesIds: ids(level), measure: "contribution_pp", periods: contributionMonths }, { includeResidual: true }),
  });
  return [rates("yoy_pct"), rates("mom_pct"), contributions("division"), contributions("subgroup")];
}

export const INFLATION_CATEGORIES_CSV_COLUMNS = ["series_id", "level", "parent_id", "selection", "measure", "period", "value", "unit", "status", "calculation", "source_ids"] as const;

/** Available cells only; labels, definitions and caveats live in inflation-categories.json. */
function buildInflationCategoriesCsv(parts: InflationCategoryPart[]): PublicationArtifact {
  const lines: string[] = [];
  for (const part of parts) {
    for (const o of observationsOf(part.response, "inflation-categories.csv").data.observations) {
      if (o.value === null) continue;
      lines.push(
        [o.seriesId, o.level, o.parentSeriesId ?? "", part.selection, o.measure, o.period ?? "", String(o.value), o.unit, o.basis ?? "",
          o.measure === "contribution_pp" ? "fiscal_ge_derived" : "published", o.sourceIds.join(";")]
          .map(csvEscape)
          .join(","),
      );
    }
  }
  const text = `\uFEFF${INFLATION_CATEGORIES_CSV_COLUMNS.join(",")}\n${lines.join("\n")}\n`;
  return { fileName: "inflation-categories.csv", bytes: Buffer.from(text, "utf8"), rowCount: lines.length };
}

function buildInflationCategoriesJson(snapshot: FactQuerySnapshot, parts: InflationCategoryPart[], csv: PublicationArtifact): PublicationArtifact {
  const results = parts.map((part) => observationsOf(part.response, "inflation-categories.json"));
  const bytes = serialize({
    ...publicationHeader(snapshot),
    datasetId: "inflation",
    notice: serviceMessage(snapshot, "ka", "publication.inflationCategoriesNotice"),
    noticeEn: serviceMessage(snapshot, "en", "publication.inflationCategoriesNotice"),
    catalogue: catalogueData(snapshot, "inflation"),
    data: {
      url: "/downloads/data/inflation-categories.csv",
      mediaType: "text/csv",
      columns: [...INFLATION_CATEGORIES_CSV_COLUMNS],
      rowCount: csv.rowCount,
      byteSize: csv.bytes.byteLength,
      sha256: sha256(csv.bytes),
    },
    definitions: INFLATION_DEFINITIONS,
    sources: results.reduce<ResolvedSource[]>((all, result) => mergeSources(all, result.meta.sources), []),
    caveats: results.reduce<Caveat[]>((all, result) => mergeCaveats(all, result.meta.caveats), []),
  });
  return { fileName: "inflation-categories.json", bytes, rowCount: csv.rowCount };
}
