import { createHmac, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** A Georgian personal number has 11 digits; a company ID code has 9. */
export function isPersonalNumber(code: string): boolean {
  return /^\d{11}$/.test(code.trim());
}

/** The key that stands in for a personal number in cleaned tables. Kept beside the data, never in the repository. */
export async function loadOrCreateSecret(dataDir: string): Promise<string> {
  const file = path.join(dataDir, "secret.key");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(file, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
  }
  return fs.readFileSync(file, "utf8").trim();
}

/** An 11-digit run that is not part of a longer word or number (a `p_` key's hex is not caught). */
export const PERSONAL_NUMBER_RUN = /(?<![0-9A-Za-z_])\d{11}(?![0-9A-Za-z])/;

/** Free text with every standalone 11-digit run replaced by `[removed]`. */
export function maskPersonalNumbers(text: string): string {
  return text.replace(new RegExp(PERSONAL_NUMBER_RUN.source, "g"), "[removed]");
}

/**
 * A personal number, or a code with one inside it, becomes `p_` + 16 hex of its HMAC-SHA-256, the same for the same
 * code; any other code is kept.
 */
export function partyKey(code: string, secret: string): string {
  const trimmed = code.trim();
  if (!PERSONAL_NUMBER_RUN.test(trimmed)) return trimmed;
  return `p_${createHmac("sha256", secret).update(trimmed).digest("hex").slice(0, 16)}`;
}

const isPersonalValue = (value: unknown) =>
  (typeof value === "string" && isPersonalNumber(value)) || (typeof value === "number" && Number.isInteger(value) && isPersonalNumber(String(value)));

/** A copy with every 11-digit value, at any depth, replaced by null, and every 11-digit run inside a text masked. */
export function stripPersonalNumbers<T>(value: T): T {
  if (isPersonalValue(value)) return null as T;
  if (typeof value === "string") return maskPersonalNumbers(value) as T;
  if (Array.isArray(value)) return value.map(item => stripPersonalNumbers(item)) as T;
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, stripPersonalNumbers(item)])) as T;
  }
  return value;
}
