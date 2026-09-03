// apps/web/lib/mcp/log.ts
//
// The only thing /mcp is allowed to log (spec section 11.5).
//
// Application logs may carry timestamp, tool name, validated stable IDs, years
// and measures, data version, result count, response size, duration, outcome
// and error code. They may NOT carry raw prompts, invalid parameter strings,
// request bodies, authorization headers, full user agents, or IP addresses.
//
// These records describe tool activity. They do not describe people: one key
// may be a whole organisation's traffic, and the original question a user asked
// never reaches this process at all.

export type ToolCallLog = {
  tool: string;
  datasetId?: string;
  measure?: string;
  /** A compact range, not the raw array, once a request spans more than a few years. */
  years?: string;
  entityCount?: number;
  seriesCount?: number;
  dataVersion: string;
  resultCount: number;
  resultBytes: number;
  durationMs: number;
  outcome: "ok" | "error";
  errorCode?: string;
};

/**
 * Emits one record built field by field from an allow-list.
 *
 * Deliberately not `{ ...record }`. Spreading the caller's object is exactly
 * how a request body, a user agent or an address ends up in analytics six
 * months later: the spread keeps working when someone adds a field upstream,
 * and nothing fails to warn you. Naming each field means a new one has to be
 * added here, on purpose, by someone reading this comment.
 */
export function logToolCall(record: ToolCallLog): void {
  const safe = {
    tool: record.tool,
    datasetId: record.datasetId,
    measure: record.measure,
    years: record.years,
    entityCount: record.entityCount,
    seriesCount: record.seriesCount,
    dataVersion: record.dataVersion,
    resultCount: record.resultCount,
    resultBytes: record.resultBytes,
    durationMs: record.durationMs,
    outcome: record.outcome,
    errorCode: record.errorCode,
  };

  process.stdout.write(`${JSON.stringify(safe)}\n`);
}

/** A compact `2015-2025` rather than a hundred integers. */
export function yearRange(years: readonly number[]): string | undefined {
  if (years.length === 0) return undefined;
  if (years.length <= 3) return years.join(",");
  const sorted = [...years].sort((left, right) => left - right);
  return `${sorted[0]}-${sorted[sorted.length - 1]}`;
}
