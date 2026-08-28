import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set(["dataVersion", "releaseCommit", "generatedAt"]);

/**
 * Deterministic JSON. Object keys are sorted; array order is preserved because
 * the served-data loaders already order rows and that order is meaningful.
 *
 * Throws rather than silently hashing inaccurately: values that `JSON.stringify`
 * cannot faithfully represent (non-finite numbers, undefined in a value position,
 * bigint, function, symbol) or that carry hidden state `Object.entries` cannot see
 * (Map, Set, Date, RegExp, or any other non-plain-object class instance) would
 * otherwise collapse into indistinguishable output, breaking the contract that the
 * digest changes whenever any published value changes.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`canonicalize: cannot hash a non-finite number (${value})`);
    }
    return JSON.stringify(value);
  }

  if (typeof value === "undefined") {
    throw new Error("canonicalize: cannot hash undefined");
  }

  if (typeof value === "bigint") {
    throw new Error(`canonicalize: cannot hash a bigint (${value})`);
  }

  if (typeof value === "function") {
    throw new Error(`canonicalize: cannot hash a function (${value.name || "anonymous"})`);
  }

  if (typeof value === "symbol") {
    throw new Error(`canonicalize: cannot hash a symbol (${String(value)})`);
  }

  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? Object.prototype.toString.call(value);
    throw new Error(`canonicalize: cannot hash a non-plain object (${typeName})`);
  }

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/** SHA-256 over canonical content, excluding the three volatile identity fields. */
export function hashDataVersion(payload: unknown): string {
  const stripped =
    payload !== null && typeof payload === "object" && !Array.isArray(payload)
      ? Object.fromEntries(Object.entries(payload as Record<string, unknown>).filter(([k]) => !VOLATILE_KEYS.has(k)))
      : payload;

  return createHash("sha256").update(canonicalize(stripped), "utf8").digest("hex");
}
