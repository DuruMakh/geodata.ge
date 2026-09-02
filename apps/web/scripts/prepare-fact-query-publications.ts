import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildFactQuerySnapshot } from "../lib/factQuery/buildSnapshot";
import { buildAllPublications } from "../lib/factQuery/publications";

const OUTPUT_DIR = path.join(process.cwd(), "public", "downloads", "data");

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
  const artifacts = buildAllPublications(snapshot);

  if (write) {
    // Deliberately NOT clearing OUTPUT_DIR: preparePublicDatasets already wiped
    // and rewrote it with the three public CSVs immediately before this script
    // runs (see the prebuild chain), and clearing again would delete them.
    await mkdir(OUTPUT_DIR, { recursive: true });
    for (const artifact of artifacts) {
      await writeFile(path.join(OUTPUT_DIR, artifact.fileName), artifact.bytes);
      process.stdout.write(`${artifact.fileName}: ${artifact.rowCount} rows, ${artifact.bytes.byteLength} bytes\n`);
    }
    process.stdout.write(`wrote ${artifacts.length} publications dataVersion=${snapshot.dataVersion}\n`);
    return;
  }

  // Check: the files on disk must be the files this snapshot produces. A stale
  // publication would let a download disagree with the explorer and with any
  // MCP answer built from the same release.
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
