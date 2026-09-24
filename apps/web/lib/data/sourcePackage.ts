import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Reads one archived source file named by a package manifest and checks it
 * against the manifest's byte size and SHA-256 before anything parses it.
 *
 * The file must sit inside `packageDir` and be a regular file, not a symlink:
 * a manifest row cannot point the pipeline at bytes outside the reviewed
 * package. `mismatch` is the caller's own message, so each dataset keeps its
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
  if (path.isAbsolute(file) || relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Source file is outside its package: ${file}`);
  }
  const stat = await fs.lstat(target);
  if (stat.isSymbolicLink()) throw new Error(`Source file is a symlink: ${file}`);
  if (!stat.isFile()) throw new Error(`Source file is not a regular file: ${file}`);
  return fs.readFile(target);
}
