import { findSourceProvenanceFailures, type SourceProvenanceFailure } from "../lib/factQuery/sources";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";

const OUTPUT = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");

function releaseCommit(): string {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");

  const snapshot = await buildFactQuerySnapshot({
    releaseCommit: releaseCommit(),
    generatedAt: new Date().toISOString(),
  });

  if (write) {
    await mkdir(path.dirname(OUTPUT), { recursive: true });
    await writeFile(OUTPUT, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    process.stdout.write(`wrote ${OUTPUT} dataVersion=${snapshot.dataVersion}\n`);
    return;
  }

  // Check: validate the snapshot builds and is internally sound
  if (!snapshot.dataVersion || snapshot.dataVersion.length !== 64) {
    throw new Error("Invalid dataVersion: must be 64-char hex hash");
  }
  if (!Array.isArray(snapshot.national?.facts) || snapshot.national.facts.length === 0) {
    throw new Error("Invalid snapshot: national.facts array is empty");
  }
  if (!Array.isArray(snapshot.sources) || snapshot.sources.length === 0) {
    throw new Error("Invalid snapshot: sources array is empty");
  }

  // Spec section 8.1: every logical source must resolve either to at least one
  // public document or to a stated derivation. A source with neither would let
  // the query core cite a figure it cannot show anyone the origin of, so it
  // fails the build rather than shipping. Names every offending id, not just
  // the count and not just the first — a partial list turns one fix into
  // several rebuild cycles.
  const failures = findSourceProvenanceFailures(snapshot.sources);
  if (failures.length > 0) {
    const describe = (reason: SourceProvenanceFailure["reason"]) =>
      reason === "derived_without_upstreams"
        ? "states a derivation but cites no upstream original"
        : "resolves to neither a public document nor a stated derivation";
    throw new Error(
      `${failures.length} source(s) fail the section 8.1 provenance gate:\n` +
        failures.map((f) => `  - ${f.sourceId}: ${describe(f.reason)}`).join("\n"),
    );
  }

  process.stdout.write(
    `snapshot valid dataVersion=${snapshot.dataVersion} sources=${snapshot.sources.length} all resolved\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
