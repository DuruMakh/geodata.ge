import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

/**
 * Reads one archived source file named by a package manifest and checks it
 * against the manifest's byte size and SHA-256 before anything parses it.
 *
 * The file must sit inside `packageDir` and be a regular file, and neither it
 * nor any folder between it and `packageDir` may be a symlink or junction: a
 * manifest row cannot point the pipeline at bytes outside the reviewed package. `mismatch` is the caller's own message, so each dataset keeps its
 * diagnostic. Hashes compare case-insensitively (the debt and IMF manifests
 * record them upper-case); the returned `sha256` is lower-case hex.
 */
export async function readVerifiedPackageFile(
  packageDir: string,
  file: string,
  expected: { sha256: string; bytes: number },
  mismatch: string,
): Promise<{ bytes: Buffer; sha256: string }> {
  const bytes = await readPackageFile(packageDir, file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== expected.sha256.toLowerCase() || bytes.length !== expected.bytes) throw new Error(mismatch);
  return { bytes, sha256 };
}

/** The same containment and symlink checks, for callers that compare the hash themselves. */
export async function readPackageFile(packageDir: string, file: string): Promise<Buffer> {
  const root = path.resolve(packageDir);
  const target = path.resolve(root, file);
  const relative = path.relative(root, target);
  if (
    path.isAbsolute(file) ||
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Source file is outside its package: ${file}`);
  }
  const stat = await fs.lstat(target);
  // A symlinked folder above the file leads outside as surely as the file itself.
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error(`Source file is a symlink: ${file}`);
  }
  if (!stat.isFile()) throw new Error(`Source file is not a regular file: ${file}`);
  return fs.readFile(target);
}

/**
 * Reads a frozen research package's protected files against its `artifact-manifest.csv` and checks that its
 * `independent-verification.json` passed for the current `verifiedInputs`. Returns the files' bytes and the SHA-256 of
 * every input read (manifest, files, then the verification record) for the acceptance report. `label` starts each error.
 */
export async function readVerifiedResearchPackage(directory: string, { label, files, verifiedInputs }: { label: string; files: readonly string[]; verifiedInputs: readonly string[] }): Promise<{ research: Record<string, Buffer>; inputSha256: Record<string, string> }> {
  const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const inputSha256: Record<string, string> = {};
  const manifestBytes = await fs.readFile(path.join(directory, "artifact-manifest.csv"));
  inputSha256["artifact-manifest.csv"] = hash(manifestBytes);
  const manifest = new Map((parse(manifestBytes, { columns: true, bom: true, skip_empty_lines: true }) as Record<string, string>[]).map(row => [row.file, row]));
  const research: Record<string, Buffer> = {};
  for (const name of files) {
    const entry = manifest.get(name);
    if (!entry) throw new Error(`${label} research artifact missing from manifest: ${name}`);
    const { bytes, sha256 } = await readVerifiedPackageFile(directory, name, { sha256: entry.sha256, bytes: Number(entry.bytes) }, `${label} research artifact hash mismatch: ${name}`);
    research[name] = bytes; inputSha256[name] = sha256;
  }
  const evidenceBytes = await fs.readFile(path.join(directory, "independent-verification.json"));
  const evidence = JSON.parse(evidenceBytes.toString("utf8")) as { result: string; input_artifact_sha256?: Record<string, string> };
  if (evidence.result !== "pass" || verifiedInputs.some(name => evidence.input_artifact_sha256?.[name] !== inputSha256[name])) throw new Error(`${label} independent verification is not current and passing`);
  inputSha256["independent-verification.json"] = hash(evidenceBytes);
  return { research, inputSha256 };
}
