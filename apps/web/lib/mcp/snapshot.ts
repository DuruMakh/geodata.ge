// apps/web/lib/mcp/snapshot.ts
//
// The one place the runtime touches the filesystem. lib/factQuery/ may not
// import fs (tests/factQuery/purity.test.ts enforces it), and the route must
// answer with no database and no network (spec sections 4.4 and 11.2), so the
// snapshot written by `data:prepare-fact-query-snapshot` during prebuild is
// read from the deployed bundle exactly once per instance.
import { readFileSync } from "node:fs";
import path from "node:path";
import { SCHEMA_VERSION, type FactQuerySnapshot } from "../factQuery/types";

const SNAPSHOT_PATH = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");

let cached: FactQuerySnapshot | undefined;

/**
 * Measured on 2026-10-13 against the 32.1 MB minified artifact: about 200 ms to
 * read and 290 ms to parse, about 185 MB resident, once per instance - most of
 * a cold request, and the reason the file is written minified (the indented
 * file was 46.3 MB and took about 320 ms to read). The inflation and product
 * tables are most of it. Warm requests then reuse the parsed object.
 *
 * Deliberately synchronous: it runs on the first request, and an async loader
 * would let two concurrent requests race to parse the same file.
 *
 * An unreadable or incompatible bundle throws. Section 4.4: the endpoint
 * returns a service error with no figures; it never falls back to another data
 * version or to an outside source.
 */
export function loadPackagedSnapshot(): FactQuerySnapshot {
  if (cached !== undefined) return cached;

  let parsed: FactQuerySnapshot;
  try {
    parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as FactQuerySnapshot;
  } catch {
    // No path, no errno, no environment detail: section 11.2 forbids leaking
    // internal paths through errors.
    throw new Error("snapshot_unavailable");
  }

  if (parsed.schemaVersion !== SCHEMA_VERSION) throw new Error("snapshot_incompatible");
  if (!/^[0-9a-f]{64}$/.test(parsed.dataVersion ?? "")) throw new Error("snapshot_incompatible");

  cached = parsed;
  return cached;
}
