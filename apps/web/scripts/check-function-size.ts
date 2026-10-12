// Postbuild guard: fails the build when a server function's traced files approach Vercel's 250 MB function limit.
// On 2026-10-10 the methodology pages traced every public download into their functions (250.13 MB) and the
// production deploy failed; `outputFileTracingExcludes` in next.config.ts fixed it. This makes the next such
// regression fail locally and in CI instead of at deploy time. See docs/deployment.md.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export const FUNCTION_SIZE_LIMIT = 200 * 1024 * 1024;

const sizes = new Map<string, number>();
async function fileBytes(file: string): Promise<number> {
  if (!sizes.has(file)) {
    const info = await stat(file).catch(() => null);
    sizes.set(file, info?.isFile() ? info.size : 0);
  }
  return sizes.get(file)!;
}

async function tracedFiles(trace: string): Promise<string[]> {
  const { files } = JSON.parse(await readFile(trace, "utf8")) as { files: string[] };
  return files.map((file) => path.resolve(path.dirname(trace), file));
}

/** Bytes of the files a `.nft.json` trace lists, together with `shared` (absolute paths), each counted once. */
export async function functionTraceBytes(trace: string, shared: readonly string[] = []): Promise<number> {
  let total = 0;
  for (const file of new Set([...(await tracedFiles(trace)), ...shared])) total += await fileBytes(file);
  return total;
}

/**
 * Sizes every route trace under `<nextDir>/server`, each with the shared `next-server.js.nft.json` files, largest
 * first. Rejects when any exceeds `limit`.
 */
export async function checkFunctionSizes(nextDir: string, limit = FUNCTION_SIZE_LIMIT): Promise<{ trace: string; bytes: number }[]> {
  const serverTrace = path.join(nextDir, "next-server.js.nft.json");
  const shared = await stat(serverTrace).then(() => tracedFiles(serverTrace), () => []);
  const traces = (await readdir(path.join(nextDir, "server"), { recursive: true }))
    .filter((file) => file.endsWith(".nft.json"))
    .map((file) => path.join("server", file));
  const report = await Promise.all(traces.map(async (trace) => ({ trace, bytes: await functionTraceBytes(path.join(nextDir, trace), shared) })));
  report.sort((a, b) => b.bytes - a.bytes);
  const over = report.filter((entry) => entry.bytes > limit);
  if (over.length) throw new Error(`Server functions over ${megabytes(limit)}: ${over.map((entry) => `${entry.trace} ${megabytes(entry.bytes)}`).join(", ")}`);
  return report;
}

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

async function main(): Promise<number> {
  try {
    const report = await checkFunctionSizes(path.resolve(".next"));
    console.log(`Largest server functions (limit ${megabytes(FUNCTION_SIZE_LIMIT)}):`);
    for (const { trace, bytes } of report.slice(0, 5)) console.log(`  ${megabytes(bytes).padStart(9)}  ${trace}`);
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

if (path.basename(process.argv[1] ?? "") === "check-function-size.ts") main().then((code) => { process.exitCode = code; });
