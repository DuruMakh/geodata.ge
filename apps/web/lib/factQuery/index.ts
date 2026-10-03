// apps/web/lib/factQuery/index.ts
//
// The public entry point: one reviewable list of the query service's surface.
// It is the catalogue, not a wall: lib/mcp, the publication and snapshot
// scripts and several explorer and SEO modules import types and helpers from
// modules inside the folder directly.
//
// Every query function here is pure: each takes a FactQuerySnapshot and returns
// a FactQueryResponse, with no filesystem, database, network, model call, or
// logging anywhere behind it (tests/factQuery/purity.test.ts enforces it).
// buildFactQuerySnapshot is the single exception and the only thing here that
// touches the loaders - build the snapshot once, then hand it to everything
// else.
export { buildFactQuerySnapshot } from "./buildSnapshot";

export { describeCoverage } from "./describeCoverage";
export { queryEconomicSectors } from "./queryEconomicSectors";
export { queryGdp } from "./queryGdp";
export { queryInflation } from "./queryInflation";
export { queryInflationProducts, productQueryCellCount } from "./queryInflationProducts";
export { queryInflationProductsInput } from "./schemas";
export type { QueryInflationProductsInput } from "./schemas";
export { queryNational } from "./queryNational";
export { queryMinistries } from "./queryMinistries";
export { queryMunicipal } from "./queryMunicipal";
export { compare } from "./compare";
export { rank } from "./rank";
export { getSources } from "./getSources";

export { CAVEAT_RULES } from "./caveats";
export { envelopeSchema } from "./schemas";
export { AGGREGATE_ONLY_MUNICIPAL_CODES, SCHEMA_VERSION } from "./types";

export type { Comparison, ComparisonEndpoint } from "./compare";
export type { GetSourcesData, ResolvedSourceView } from "./getSources";
export type { Observation } from "./observations";
export type { RankData, RankEntry } from "./rank";
export type {
  Availability,
  Caveat,
  Coverage,
  DatasetId,
  FactQueryError,
  FactQueryResponse,
  FactQuerySnapshot,
  Measure,
  PublicDocument,
  ResolvedSource,
  ResponseMeta,
  ServiceLocalization,
  Severity,
  Unit,
} from "./types";
