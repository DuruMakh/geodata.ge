// apps/web/tests/factQuery/purity.test.ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = path.join(process.cwd(), "lib", "factQuery");
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
    const files = (await walk(CORE_DIR)).filter((f) => !f.endsWith("buildSnapshot.ts"));
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
});
