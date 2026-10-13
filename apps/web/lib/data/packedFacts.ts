/**
 * Facts as a page receives them in its inline payload: the field names once, then one array of values per fact in that
 * order. A field whose values are all strings (or null) is listed once in `codes`, and each row holds the index of its
 * value, so an id, a status or a name that repeats on every fact is sent once. It generalizes the trade pages' tuples
 * (ClientTradePartnerFact in tradePartners/importTradePartners.ts), which are read in place by their own models; these
 * are unpacked back into the same objects, so the models that read them are unchanged.
 */
export type PackedFacts<T> = { fields: string[]; codes: Record<string, (string | null)[]>; rows: unknown[][]; /** Carries the fact type; never set. */ readonly fact?: T };
/** What a page component accepts: the packed payload a server page sends, or the plain facts (tests, server-side callers). */
export type FactsInput<T> = readonly T[] | PackedFacts<T>;

/** Packs facts that all carry the same fields; a fact with other fields would not round-trip, so it is refused. */
export function packFacts<T extends object>(facts: readonly T[]): PackedFacts<T> {
  const fields = facts.length ? Object.keys(facts[0]!) : [], signature = fields.join("\u0000");
  const records = facts as readonly Record<string, unknown>[];
  if (records.some(fact => Object.keys(fact).join("\u0000") !== signature)) throw new Error(`packFacts: every fact must carry exactly the fields ${fields.join(", ")}`);
  const codes: Record<string, (string | null)[]> = {}, indices: Record<string, Map<string | null, number>> = {};
  for (const field of fields) if (records.every(fact => typeof fact[field] === "string" || fact[field] === null) && records.some(fact => fact[field] !== null)) { codes[field] = []; indices[field] = new Map(); }
  const rows = records.map(fact => fields.map(field => {
    const value = fact[field], index = indices[field];
    if (!index) return value;
    const known = index.get(value as string | null);
    if (known !== undefined) return known;
    index.set(value as string | null, codes[field]!.push(value as string | null) - 1);
    return codes[field]!.length - 1;
  }));
  return { fields, codes, rows };
}

const unpacked = new WeakMap<PackedFacts<unknown>, unknown[]>();
/** The facts as objects again, identical to those packed; unpacked once per payload, so every reader can call it. */
export function unpackFacts<T>(facts: FactsInput<T>): T[] {
  if (Array.isArray(facts)) return facts as T[];
  const packed = facts as PackedFacts<T>, cached = unpacked.get(packed);
  if (cached) return cached as T[];
  const result = packed.rows.map(row => Object.fromEntries(packed.fields.map((field, column) => {
    const codes = packed.codes[field];
    return [field, codes ? codes[row[column] as number] : row[column]];
  })) as T);
  unpacked.set(packed, result);
  return result;
}
