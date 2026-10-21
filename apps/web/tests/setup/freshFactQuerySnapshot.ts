// apps/web/tests/setup/freshFactQuerySnapshot.ts
//
// Vitest globalSetup: runs once per `vitest run`, before any test file.
// tests/helpers/factQuerySnapshot.ts reads lib/factQuery/generated/snapshot.json,
// which `pretest` writes. `npx vitest run <file>` skips pretest, so this builds
// the file once, with the same npm script, when it is missing or older than one
// of its inputs. Only the real inputs count, so editing unrelated lib code does
// not make the next single-file run pay for a rebuild:
//   - the build script and every module it imports, followed through relative
//     and `@/` imports (lib/factQuery, the lib/data loaders, lib/i18n, ...);
//   - the files those modules read at run time: the repository's data/ and
//     docs/Raw Data/, and the message catalogues under lib/i18n/messages.
//     data/reports/ is left out: it holds only outputs (data:validate and
//     prebuild write their validation reports there), and no module in the
//     snapshot's import graph reads it, so a validation run does not force a
//     rebuild.
// Directories are walked with their own mtimes as well, so a deleted or renamed
// input marks the snapshot stale. A deleted or renamed module needs no such
// check: the module that imported it changes too.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const WEB_ROOT = process.cwd();
const SNAPSHOT_PATH = path.join(WEB_ROOT, "lib", "factQuery", "generated", "snapshot.json");
const BUILD_SCRIPT = path.join(WEB_ROOT, "scripts", "prepare-fact-query-snapshot.ts");
const DATA_ROOTS = [
  path.join(WEB_ROOT, "..", "..", "data"),
  path.join(WEB_ROOT, "..", "..", "docs", "Raw Data"),
  path.join(WEB_ROOT, "lib", "i18n", "messages"),
];
const NOT_INPUTS = new Set([path.join(WEB_ROOT, "..", "..", "data", "reports")]);
const IMPORT_SPECIFIER = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

function resolveImport(importer: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(WEB_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(importer), specifier)
      : null;
  if (base === null) return null;
  const stem = base.replace(/\.js$/, "");
  const candidates = [base, `${stem}.ts`, `${stem}.tsx`, path.join(stem, "index.ts")];
  // Anything else is package code, or an import-shaped string in a comment.
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

function collectModules(file: string, modules: Set<string>): Set<string> {
  if (modules.has(file)) return modules;
  modules.add(file);
  if (!/\.tsx?$/.test(file)) return modules;
  for (const match of readFileSync(file, "utf8").matchAll(IMPORT_SPECIFIER)) {
    const resolved = resolveImport(file, match[1]);
    if (resolved !== null) collectModules(resolved, modules);
  }
  return modules;
}

function hasEntryNewerThan(directory: string, mtimeMs: number): boolean {
  if (NOT_INPUTS.has(directory)) return false;
  if (statSync(directory).mtimeMs > mtimeMs) return true;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory() ? hasEntryNewerThan(entryPath, mtimeMs) : statSync(entryPath).mtimeMs > mtimeMs) return true;
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
  for (const file of collectModules(BUILD_SCRIPT, new Set())) {
    if (statSync(file).mtimeMs > snapshotMtimeMs) return false;
  }
  return !DATA_ROOTS.some((root) => hasEntryNewerThan(root, snapshotMtimeMs));
}

export default function setup(): void {
  if (snapshotIsCurrent()) return;
  execSync("npm run data:prepare-fact-query-snapshot", { stdio: "inherit" });
}
