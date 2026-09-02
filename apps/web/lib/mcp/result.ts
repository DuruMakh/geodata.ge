// apps/web/lib/mcp/result.ts
//
// Turns a FactQueryResponse into what an MCP client receives: the envelope as
// structured content, plus an equivalent text representation for clients that
// consume text (spec section 11.1). Pure - no transport, no filesystem, no
// logging. The route wires it; this file decides shape and size.
import { buildResponseMeta } from "../factQuery/meta";
import type { Comparison } from "../factQuery/compare";
import type { GetSourcesData, ResolvedSourceView } from "../factQuery/getSources";
import type { RankData } from "../factQuery/rank";
import type { Observation } from "../factQuery/observations";
import type { Caveat, FactQueryResponse, FactQuerySnapshot, ResolvedSource } from "../factQuery/types";

/** Spec section 11.3's operating limits, one constant per row of that table. */
export const LIMITS = {
  /** Incoming body; rejected before full processing. */
  bodyBytes: 32 * 1024,
  /** Returned observation cells per tool call. */
  cells: 500,
  /** Comparison candidates (endpoint pairs) per call. */
  comparisonPairs: 250,
  /** Ranking output. */
  rankDefault: 10,
  rankMax: 100,
  /**
   * Serialized tool result, including evidence and BOTH representations.
   *
   * This is the binding gate, not `cells`. Measured on real municipal data, a
   * compliant 495-cell request serializes to 517.0 KiB at roughly 936 bytes of
   * JSON per observation - so a request can satisfy the cell cap and still
   * produce a response this ceiling must refuse. Sources and warnings are never
   * silently trimmed to fit; the whole result is refused with guidance instead.
   */
  resultBytes: 512 * 1024,
  /** Input array bounds, further restricted by coverage and result limits. */
  entities: 100,
  series: 200,
  years: 100,
  sourceIds: 100,
  /** Request duration. */
  durationMs: 10_000,
} as const;

export type ToolResult = {
  /** MCP types structured content as a record, so match that rather than `unknown`. */
  structuredContent?: Record<string, unknown>;
  content: { type: "text"; text: string }[];
  isError: boolean;
};

const BULK_DATA_URL = "https://fiscal.ge/downloads/data/";

function line(...cells: (string | number | null)[]): string {
  return cells.map((cell) => (cell === null ? "" : String(cell))).join("\t");
}

function observationLine(observation: Observation): string {
  const value =
    observation.value === null ? `missing${observation.missingReason ? ` (${observation.missingReason})` : ""}` : observation.value;
  return line(
    observation.entityLabelKa,
    observation.seriesLabelKa,
    observation.year,
    value,
    observation.unit,
    observation.basis,
    observation.caveatIds.join(","),
  );
}

function comparisonLine(comparison: Comparison): string {
  return line(
    comparison.entityLabelKa,
    comparison.seriesLabelKa,
    `${comparison.from.year}→${comparison.to.year}`,
    comparison.from.value,
    comparison.to.value,
    comparison.absoluteChange,
    comparison.percentageChange,
    comparison.percentagePointChange,
    comparison.unit,
    comparison.comparability,
    comparison.caveatIds.join(","),
  );
}

function sourceView(source: ResolvedSourceView): string {
  return line(source.sourceId, source.name, source.documentCount, source.narrowed ? "narrowed" : "full");
}

function bodyOf(response: Extract<FactQueryResponse, { kind: Exclude<FactQueryResponse["kind"], "error"> }>): string[] {
  const data = response.data as Record<string, unknown>;

  if (response.kind === "observations") {
    const { observations, coverage } = data as { observations: Observation[]; coverage: { returnedCount: number; expectedCount: number } };
    return [
      "# entity\tseries\tyear\tvalue\tunit\tbasis\tcaveats",
      ...observations.map(observationLine),
      `returned ${coverage.returnedCount} of ${coverage.expectedCount} requested cells`,
    ];
  }

  if (response.kind === "comparisons") {
    const { comparisons } = data as { comparisons: Comparison[] };
    return [
      "# entity\tseries\tyears\tfrom\tto\tchange\tpct\tpp\tunit\tcomparability\tcaveats",
      ...comparisons.map(comparisonLine),
    ];
  }

  if (response.kind === "ranking") {
    const { entries, universe, exclusions, rankingDefinition } = data as RankData;
    return [
      rankingDefinition,
      "# position\tentity\tseries\tvalue\tunit\ttied\tcaveats",
      ...entries.map((entry) =>
        line(entry.position, entry.entityLabelKa, entry.seriesLabelKa, entry.value, entry.unit, entry.tied ? "tied" : "", entry.caveatIds.join(",")),
      ),
      `${universe.returnedCount} of ${universe.eligibleCount} eligible from ${universe.candidateCount} candidates` +
        (universe.cutoffSplitsTie ? " — the cutoff splits a tie, so the last place is arbitrary" : ""),
      ...(exclusions.length > 0 ? [`excluded: ${exclusions.map((e) => `${e.id} (${e.reason})`).join("; ")}`] : []),
    ];
  }

  if (response.kind === "sources") {
    const { sources, narrowedBy } = data as GetSourcesData;
    return [
      "# sourceId\tname\tdocuments\tscope",
      ...sources.map(sourceView),
      ...(narrowedBy === null ? [] : [`narrowed by ${JSON.stringify(narrowedBy)}`]),
    ];
  }

  // catalogue: a nested capability description with no natural table. Its own
  // JSON is the clearest text form, and it is small.
  return [JSON.stringify(data, null, 2)];
}

function evidenceOf(sources: readonly ResolvedSource[], caveats: readonly Caveat[]): string[] {
  const out: string[] = [];

  if (sources.length > 0) {
    out.push("", "## წყაროები / sources");
    for (const source of sources) {
      out.push(`${source.sourceId} — ${source.name}${source.derivation === null ? "" : ` [derived: ${source.derivation}]`}`);
      for (const document of source.documents) {
        out.push(`  · ${document.title} — ${document.archiveUrl ?? document.officialUrl ?? "(no public link)"}`);
      }
    }
  }

  if (caveats.length > 0) {
    // Severe first: a model that reads top-down must meet the disqualifying
    // limitation before the housekeeping note.
    const ordered = [...caveats].sort((left, right) =>
      left.severity === right.severity ? left.code.localeCompare(right.code) : left.severity === "severe" ? -1 : 1,
    );
    out.push("", "## შენიშვნები / caveats");
    for (const caveat of ordered) {
      out.push(`${caveat.code} (${caveat.severity}): ${caveat.messageKa} | ${caveat.messageEn}`);
    }
  }

  return out;
}

/**
 * The text twin is a compact table, not a second serialization of the JSON.
 *
 * Spec section 11.1 requires an EQUIVALENT representation - equivalent in
 * content, not in structure - and section 11.3 counts both representations
 * against one 512 KiB ceiling. Re-serializing the envelope would spend half the
 * budget restating what `structuredContent` already carries exactly.
 */
export function renderText(response: FactQueryResponse): string {
  const header = [
    `fiscal.ge ${response.kind} — status ${response.status}`,
    `dataVersion ${response.meta.dataVersion}`,
    `licence ${response.meta.licence} (${response.meta.licenceUrl})`,
  ];

  if (response.kind === "error") {
    return [
      ...header,
      "",
      `error ${response.error.code} (retryable: ${response.error.retryable})`,
      response.error.messageKa,
      response.error.messageEn,
      ...(response.error.validChoices === undefined ? [] : [`valid choices: ${response.error.validChoices.join(", ")}`]),
      ...evidenceOf(response.meta.sources, response.meta.caveats),
    ].join("\n");
  }

  return [...header, "", ...bodyOf(response), ...evidenceOf(response.meta.sources, response.meta.caveats)].join("\n");
}

/** Shapes one envelope. Applies no limit - see boundedToolResult. */
export function toolResult(response: FactQueryResponse): ToolResult {
  const content = [{ type: "text" as const, text: renderText(response) }];

  // A failed call has no structured payload to validate against an output
  // schema, so it carries text only.
  return response.kind === "error"
    ? { content, isError: true }
    : // The envelope is a plain JSON object, but a discriminated union is not
      // implicitly assignable to an index-signature type, so state the fact.
      { structuredContent: response as unknown as Record<string, unknown>, content, isError: false };
}

export function tooLargeResponse(
  snapshot: FactQuerySnapshot,
  detail: { returned: number; bytes: number },
): FactQueryResponse {
  const howToNarrow =
    "Narrow the request and ask again: fewer years first, then fewer entities, then fewer series. " +
    `For a whole dataset, download the published file instead: ${BULK_DATA_URL}`;

  return {
    kind: "error",
    status: "error",
    error: {
      code: "result_too_large",
      messageKa:
        `შედეგი ზედმეტად დიდია: ${detail.returned} უჯრა` +
        (detail.bytes > 0 ? `, ${Math.round(detail.bytes / 1024)} კბ` : "") +
        `. დააზუსტეთ მოთხოვნა — ჯერ ნაკლები წელი, შემდეგ ნაკლები ერთეული, ბოლოს ნაკლები სერია. ` +
        `მთლიანი მონაცემთა ნაკრებისთვის ჩამოტვირთეთ გამოქვეყნებული ფაილი: ${BULK_DATA_URL}`,
      messageEn:
        `Result too large: ${detail.returned} cells` +
        (detail.bytes > 0 ? `, ${Math.round(detail.bytes / 1024)} KiB` : "") +
        `. ${howToNarrow}`,
      retryable: true,
    },
    meta: buildResponseMeta(snapshot),
  };
}

function cellCount(response: FactQueryResponse): number {
  if (response.kind === "observations") {
    return (response.data as { observations: unknown[] }).observations.length;
  }
  if (response.kind === "comparisons") return (response.data as { comparisons: unknown[] }).comparisons.length;
  if (response.kind === "ranking") return (response.data as RankData).entries.length;
  return 0;
}

/**
 * The shaping every caller should use. Refuses rather than trims: a truncated
 * answer is a wrong answer wearing a correct one's shape, and section 11.3
 * forbids silently dropping sources or warnings to fit.
 */
export function boundedToolResult(snapshot: FactQuerySnapshot, response: FactQueryResponse): ToolResult {
  const returned = cellCount(response);
  // Cheap pre-check, so an obviously oversized result is never serialized.
  if (returned > LIMITS.cells) return toolResult(tooLargeResponse(snapshot, { returned, bytes: 0 }));

  const result = toolResult(response);
  const bytes = Buffer.byteLength(JSON.stringify(result), "utf8");
  return bytes > LIMITS.resultBytes ? toolResult(tooLargeResponse(snapshot, { returned, bytes })) : result;
}
