import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set(["dataVersion", "releaseCommit", "generatedAt"]);

/**
 * True only for object literals and `Object.create(null)` values — the object
 * shapes whose entire content is visible through `Object.entries()`. False for
 * null, arrays, and anything with hidden internal state (Map, Set, Date, RegExp,
 * or any other class instance). Shared by `canonicalize` and `hashDataVersion` so
 * the two cannot drift on what counts as "plain".
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

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

  if (!isPlainObject(value)) {
    const typeName = (value as { constructor?: { name?: string } }).constructor?.name ?? Object.prototype.toString.call(value);
    throw new Error(`canonicalize: cannot hash a non-plain object (${typeName})`);
  }

  const entries = Object.entries(value)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(",")}}`;
}

/**
 * SHA-256 over canonical content, excluding the three volatile identity fields.
 *
 * Volatile-key stripping only applies when the payload is a plain object (the
 * shared `isPlainObject` check). Anything else — including Map, Set, Date, and
 * other non-plain objects — passes straight through to `canonicalize`, which
 * throws for those rather than letting them silently reduce to `{}`. Arrays and
 * primitives pass through too, and continue to hash normally.
 */
export function hashDataVersion(payload: unknown): string {
  const stripped = isPlainObject(payload)
    ? Object.fromEntries(Object.entries(payload).filter(([k]) => !VOLATILE_KEYS.has(k)))
    : payload;

  return createHash("sha256").update(canonicalize(stripped), "utf8").digest("hex");
}
