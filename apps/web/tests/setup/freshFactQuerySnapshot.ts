// apps/web/tests/setup/freshFactQuerySnapshot.ts
//
// Vitest globalSetup: runs once per `vitest run`, before any test file.
// tests/helpers/factQuerySnapshot.ts reads lib/factQuery/generated/snapshot.json,
// which `pretest` writes. `npx vitest run <file>` skips pretest, so this builds
// the file once, with the same npm script, when it is missing or older than any
// input it is built from (the reviewed data, the raw-data manifests, lib code
// and messages). Otherwise it costs a directory walk and nothing else.
import { execSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const SNAPSHOT_PATH = path.join(process.cwd(), "lib", "factQuery", "generated", "snapshot.json");
const INPUT_ROOTS = [
  path.join(process.cwd(), "lib"),
  path.join(process.cwd(), "..", "..", "data"),
  path.join(process.cwd(), "..", "..", "docs", "Raw Data"),
];

function hasFileNewerThan(directory: string, mtimeMs: number): boolean {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() ? hasFileNewerThan(entryPath, mtimeMs) : statSync(entryPath).mtimeMs > mtimeMs) return true;
  }
  return false;
}

function snapshotIsCurrent(): boolean {
  let snapshotMtimeMs: number;
  try {
    snapshotMtimeMs = statSync(SNAPSHOT_PATH).mtimeMs;
  } catch {
    return false;
  }
  return !INPUT_ROOTS.some((root) => hasFileNewerThan(root, snapshotMtimeMs));
}

export default function setup(): void {
  if (snapshotIsCurrent()) return;
  execSync("npm run data:prepare-fact-query-snapshot", { stdio: "inherit" });
}
