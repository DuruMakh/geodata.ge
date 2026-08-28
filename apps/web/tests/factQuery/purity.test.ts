// apps/web/tests/factQuery/purity.test.ts
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const CORE_DIR = path.join(process.cwd(), "lib", "factQuery");
const FORBIDDEN = [
  /from\s+["']node:fs/,
  /from\s+["']node:net/,
  /from\s+["']node:http/,
  /\bfetch\s*\(/,
  /from\s+["'].*\/db\//,
  /from\s+["']@prisma\//,
  /from\s+["']@ai-sdk\//,
  /from\s+["']ai["']/,
  /from\s+["']@anthropic-ai\//,
  /console\.(log|warn|error|info)\s*\(/,
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
