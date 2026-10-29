// Prints the anonymous /mcp usage tally for the last N UTC days.
//
//   npm run mcp:usage -- --days 7 [--namespace preview]
//
// Reads one hash per day (`<namespace>:mcp:stats:<YYYY-MM-DD>`, written by
// lib/mcp/upstashCounter.ts) with HGETALL, one Redis command per day, using
// the integration's READ-ONLY token. Each field is
// `tool|outcome|errorCode|limit|clientClass`; there is nothing else in it to
// print. See docs/deployment.md, "Shared production rate limiter".
import { runAsCli } from "../lib/runAsCli";

const DEFAULT_DAYS = 7;
const MAX_DAYS = 90; // the hashes expire after 100 days; stay well inside
/** F04 Stage 2 trigger: the Anthropic range being refused by its per-key daily cap, on any tool (the field's first part). */
export const DECISION_SUFFIX = "|rate_limited|key_day|anthropic";

/** The last `days` UTC dates up to and including `now`'s, newest first. */
export function lastDays(days: number, now: Date): string[] {
  return Array.from({ length: days }, (_, back) => new Date(now.getTime() - back * 86_400_000).toISOString().slice(0, 10));
}

/** `--days N` (1 to 90, default 7) and `--namespace production|preview`. Throws on anything else. */
export function parseArguments(args: readonly string[]): { days: number; namespace: "production" | "preview" } {
  let days = DEFAULT_DAYS;
  let namespace: "production" | "preview" = "production";
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (flag === "--days" && value !== undefined && /^\d{1,3}$/.test(value) && Number(value) >= 1 && Number(value) <= MAX_DAYS) days = Number(value);
    else if (flag === "--namespace" && (value === "production" || value === "preview")) namespace = value;
    else throw new Error(`Usage: npm run mcp:usage -- [--days 1-${MAX_DAYS}] [--namespace production|preview]`);
  }
  return { days, namespace };
}

/** An HGETALL reply (flat `[field, count, field, count, ...]`) as field to count. Anything unreadable is dropped. */
export function parseHash(result: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  if (!Array.isArray(result)) return counts;
  for (let index = 0; index + 1 < result.length; index += 2) {
    const count = Number(result[index + 1]);
    if (typeof result[index] === "string" && Number.isInteger(count) && count > 0) counts.set(result[index], count);
  }
  return counts;
}

/** Sums the daily hashes into one. */
export function totals(days: readonly Map<string, number>[]): Map<string, number> {
  const sum = new Map<string, number>();
  for (const day of days) for (const [field, count] of day) sum.set(field, (sum.get(field) ?? 0) + count);
  return sum;
}

function table(counts: ReadonlyMap<string, number>): string[] {
  return [...counts].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([field, count]) => `  ${String(count).padStart(8)}  ${field}`);
}

export function report(daily: readonly { day: string; counts: Map<string, number> }[]): string {
  const lines: string[] = [];
  for (const { day, counts } of daily) {
    lines.push(`${day}  (${[...counts.values()].reduce((sum, count) => sum + count, 0)} requests)`);
    lines.push(...(counts.size === 0 ? ["  no data"] : table(counts)));
  }
  const all = totals(daily.map(({ counts }) => counts));
  lines.push("", `All ${daily.length} days  (${[...all.values()].reduce((sum, count) => sum + count, 0)} requests)`, ...table(all));
  const refused = [...all].reduce((sum, [field, count]) => (field.endsWith(DECISION_SUFFIX) ? sum + count : sum), 0);
  if (refused > 0) lines.push("", `DECISION NEEDED: ${refused} x *${DECISION_SUFFIX}. Send this to the owner for F04 Stage 2.`);
  return lines.join("\n");
}

function endpoint(): { url: string; token: string } {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_READ_ONLY_TOKEN;
  if (!url || !token) {
    throw new Error("Set KV_REST_API_URL and KV_REST_API_READ_ONLY_TOKEN (the Upstash integration's read-only token) in the environment. Nothing was read.");
  }
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".upstash.io") || parsed.username || parsed.password) {
    throw new Error("KV_REST_API_URL must be an https://*.upstash.io address without credentials. Nothing was read.");
  }
  return { url, token };
}

export async function main(args: readonly string[]): Promise<void> {
  const { days, namespace } = parseArguments(args);
  const { url, token } = endpoint();
  const daily: { day: string; counts: Map<string, number> }[] = [];
  for (const day of lastDays(days, new Date())) {
    const response = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(["HGETALL", `${namespace}:mcp:stats:${day}`]),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Upstash answered ${response.status} for ${day}.`);
    daily.push({ day, counts: parseHash(((await response.json()) as { result?: unknown }).result) });
  }
  console.log(report(daily));
}

runAsCli(import.meta.url, main);
