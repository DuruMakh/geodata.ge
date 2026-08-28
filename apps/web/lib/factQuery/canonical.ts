import { createHash } from "node:crypto";

const VOLATILE_KEYS = new Set(["dataVersion", "releaseCommit", "generatedAt"]);

/**
 * Deterministic JSON. Object keys are sorted; array order is preserved because
 * the served-data loaders already order rows and that order is meaningful.
 */
export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;

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
