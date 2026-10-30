import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PUBLIC_DATASET_FILE_NAMES } from "../lib/data/publicDatasetExports";
import { buildAllPublications, type PublicationArtifact } from "../lib/factQuery/publications";
import type { FactQuerySnapshot } from "../lib/factQuery/types";
import { loadPackagedSnapshot } from "../lib/mcp/snapshot";

const OUTPUT_DIR = path.join(process.cwd(), "public", "downloads", "data");
const SNAPSHOT_FILE = "lib/factQuery/generated/snapshot.json";

// The publications are cut from the snapshot the route serves, which
// data:prepare-fact-query-snapshot has just written earlier in the same chain
// (prebuild, predev). Rebuilding it here would cost a second full build; a
// missing or unreadable file stops the step instead of falling back to one.
function packagedSnapshot(): FactQuerySnapshot {
  try {
    return loadPackagedSnapshot();
  } catch (error) {
    const problem = !existsSync(path.join(process.cwd(), SNAPSHOT_FILE))
      ? "is missing"
      : error instanceof Error && error.message === "snapshot_incompatible"
        ? "is from an older schema"
        : "is unreadable";
    throw new Error(`${SNAPSHOT_FILE} ${problem}. Run npm run data:prepare-fact-query-snapshot first.`);
  }
}

// Published files this step does not build, written earlier in prebuild and predev: the public topic CSVs
// (data:prepare-public-datasets) and the national CPI CSV (data:prepare-inflation-public). The manifest names
// them so a client can find and verify every file. A missing one stops the step with its name.
const SIDE_FILE_NAMES = [...PUBLIC_DATASET_FILE_NAMES, "inflation-cpi-national.csv"];

async function sideFiles(): Promise<PublicationArtifact[]> {
  return Promise.all(
    SIDE_FILE_NAMES.map(async (fileName) => {
      const bytes = await readFile(path.join(OUTPUT_DIR, fileName)).catch(() => null);
      if (bytes === null) {
        throw new Error(
          `public/downloads/data/${fileName} is missing. It is written earlier in prebuild: run npm run data:prepare-public-datasets and npm run data:prepare-inflation-public first.`,
        );
      }
      // One header line; every other non-empty line is a data row.
      const rowCount = Math.max(0, bytes.toString("utf8").split(/\r?\n/).filter((line) => line !== "").length - 1);
      return { fileName, bytes, rowCount };
    }),
  );
}

async function main() {
  const write = process.argv.includes("--write");
  const check = process.argv.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");

  const snapshot = packagedSnapshot();
  const artifacts = buildAllPublications(snapshot, await sideFiles());

  if (write) {
    // Deliberately NOT clearing OUTPUT_DIR: preparePublicDatasets wipes and
    // rewrites it with its five public CSVs earlier in the prebuild chain, and
    // regional-economy and inflation CSVs are also written between the two.
    await mkdir(OUTPUT_DIR, { recursive: true });
    for (const artifact of artifacts) {
      await writeFile(path.join(OUTPUT_DIR, artifact.fileName), artifact.bytes);
      process.stdout.write(`${artifact.fileName}: ${artifact.rowCount} rows, ${artifact.bytes.byteLength} bytes\n`);
    }
    process.stdout.write(`wrote ${artifacts.length} publications dataVersion=${snapshot.dataVersion}\n`);
  }

  // Check: the files on disk must be the files this snapshot produces. A stale
  // publication would let a download disagree with the explorer and with any
  // MCP answer built from the same release. --write runs it over what it has
  // just written, so the build needs no separate re-check after it.
  //
  // Two separate things are verified, because neither alone is sufficient:
  //
  //   1. Content parity, ignoring generatedAt and releaseCommit, which change
  //      on every run by design (spec 4.3). The manifest additionally ignores
  //      its recorded sha256 and byteSize: those hash bytes that CONTAIN
  //      generatedAt, so they legitimately differ between two runs of the same
  //      snapshot and cannot be compared across runs.
  //   2. The on-disk manifest's hashes and byte sizes against the on-disk
  //      files. That is the claim the manifest actually makes, and step 1
  //      cannot check it.
  const stale: string[] = [];

  const stripVolatile = (parsed: Record<string, unknown>): Record<string, unknown> => {
    const withoutIdentity: Record<string, unknown> = { ...parsed, generatedAt: null, releaseCommit: null };
    const files = withoutIdentity.files;
    if (!Array.isArray(files)) return withoutIdentity;
    return {
      ...withoutIdentity,
      files: files.map((file) => ({ ...(file as Record<string, unknown>), sha256: null, byteSize: null })),
    };
  };
  const comparable = (bytes: Buffer): string | null => {
    try {
      return JSON.stringify(stripVolatile(JSON.parse(bytes.toString("utf8")) as Record<string, unknown>));
    } catch {
      return null;
    }
  };

  for (const artifact of artifacts) {
    const onDisk = await readFile(path.join(OUTPUT_DIR, artifact.fileName)).catch(() => null);
    if (onDisk === null) {
      stale.push(`${artifact.fileName}: missing`);
      continue;
    }
    if(artifact.fileName.endsWith(".csv")) {
      if(!onDisk.equals(artifact.bytes)) stale.push(`${artifact.fileName}: content differs`);
      continue;
    }
    const before = comparable(onDisk);
    if (before === null) {
      stale.push(`${artifact.fileName}: not readable as JSON`);
      continue;
    }
    if (before !== comparable(artifact.bytes)) stale.push(`${artifact.fileName}: content differs`);
  }

  const manifestBytes = await readFile(path.join(OUTPUT_DIR, "manifest.json")).catch(() => null);
  if (manifestBytes !== null) {
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as {
      files: { fileName: string; sha256: string; byteSize: number }[];
    };
    for (const file of manifest.files) {
      const bytes = await readFile(path.join(OUTPUT_DIR, file.fileName)).catch(() => null);
      if (bytes === null) {
        stale.push(`${file.fileName}: named by the manifest but absent`);
        continue;
      }
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (digest !== file.sha256) stale.push(`${file.fileName}: sha256 does not match the manifest`);
      if (bytes.byteLength !== file.byteSize) stale.push(`${file.fileName}: byteSize does not match the manifest`);
    }
  }

  if (stale.length > 0) {
    throw new Error(
      `${stale.length} publication problem(s). Run npm run data:prepare-fact-query-publications:\n` +
        stale.map((line) => `  - ${line}`).join("\n"),
    );
  }

  process.stdout.write(
    `${artifacts.length} publications current, manifest hashes verified, dataVersion=${snapshot.dataVersion}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
