// apps/web/tests/factQuery/purity.test.ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = path.join(process.cwd(), "lib", "factQuery");
const TOPICS_DIR = path.join(CORE_DIR, "topics");
/** The topic modules runtime code may import: types, the column store and the page list. Every other topics file is build-time. */
const RUNTIME_TOPIC_MODULES = ["types.ts", "store.ts", "pages.ts"];
/** Build-time only (they read files and call the topic loaders): the snapshot build and tests import them, never /mcp. */
const isBuildTime = (file: string) => file.endsWith("buildSnapshot.ts") || (path.dirname(file) === TOPICS_DIR && !RUNTIME_TOPIC_MODULES.includes(path.basename(file)));
const FORBIDDEN = [
  /(?:from\s+["'][^"']*\/i18n\/(?:messages|catalogue\.server)|import\s*\(\s*["'][^"']*\/i18n\/(?:messages|catalogue\.server))/,
  /(?:from\s+["'](?:node:)?fs|import\s*\(\s*["'](?:node:)?fs)/,
  /(?:from\s+["'](?:node:)?net|import\s*\(\s*["'](?:node:)?net)/,
  /(?:from\s+["'](?:node:)?https?|import\s*\(\s*["'](?:node:)?https?)/,
  /(?:from\s+["'](?:node:)?child_process|import\s*\(\s*["'](?:node:)?child_process)/,
  /(?:from\s+["'](?:node:)?dns|import\s*\(\s*["'](?:node:)?dns)/,
  /\bfetch\s*\(/,
  /(?:from\s+["'].*\/db\/|import\s*\(\s*["'].*\/db\/)/,
  /(?:from\s+["']@prisma\/|import\s*\(\s*["']@prisma\/)/,
  /(?:from\s+["']@ai-sdk\/|import\s*\(\s*["']@ai-sdk\/)/,
  /(?:from\s+["']ai["']|import\s*\(\s*["']ai["'])/,
  /(?:from\s+["']@anthropic-ai\/|import\s*\(\s*["']@anthropic-ai\/)/,
  /console\.\w+\s*\(/,
];

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

describe("factQuery purity", () => {
  it("imports no io, database, provider sdk, or logging", async () => {
    const files = (await walk(CORE_DIR)).filter((f) => !isBuildTime(f));
    expect(files.length).toBeGreaterThan(0);

    const offences: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const pattern of FORBIDDEN) {
        if (pattern.test(source)) offences.push(`${path.basename(file)}: ${pattern}`);
      }
    }
    expect(offences).toEqual([]);
  });

  it("runtime code imports no build-time topic module (registry, breaks, adapters)", async () => {
    const runtime = [
      ...(await walk(CORE_DIR)).filter((f) => !isBuildTime(f)),
      ...(await walk(path.join(process.cwd(), "lib", "mcp"))),
      path.join(process.cwd(), "api", "mcp.ts"),
    ];
    const offences: string[] = [];
    for (const file of runtime) {
      const source = await readFile(file, "utf8");
      for (const [, specifier] of source.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
        if (!specifier!.startsWith(".")) continue;
        const target = path.resolve(path.dirname(file), specifier!);
        if (path.dirname(target) === TOPICS_DIR && !RUNTIME_TOPIC_MODULES.includes(`${path.basename(target, ".ts")}.ts`)) offences.push(`${path.relative(process.cwd(), file)}: ${specifier}`);
      }
    }
    expect(runtime.length).toBeGreaterThan(0);
    expect(offences).toEqual([]);
  });
});
