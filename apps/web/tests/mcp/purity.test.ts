// apps/web/tests/mcp/purity.test.ts
//
// tests/factQuery/purity.test.ts guards the query core. This guards the runtime
// that wraps it, where the temptation is different: the core must not do IO,
// but /mcp legitimately does - so what has to be pinned here is that it reaches
// only the deployed bundle, and never a model provider or the database.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RUNTIME_DIRS = [path.join(process.cwd(), "lib", "mcp"), path.join(process.cwd(), "app", "mcp")];

const FORBIDDEN: [RegExp, string][] = [
  // Spec 13 and decision 6: no provider SDK anywhere in this release's
  // production surface, not even unused to demonstrate portability.
  [/from\s+["']@ai-sdk\//, "AI SDK provider"],
  [/from\s+["']ai["']/, "ai package"],
  [/from\s+["']@anthropic-ai\//, "Anthropic SDK"],
  [/from\s+["']openai["']/, "OpenAI SDK"],
  // Spec 4.4, 11.2, 18: the runtime answers from the packaged snapshot. A
  // request-time database read is a stop condition, not a fallback.
  [/from\s+["']@prisma\//, "Prisma client"],
  [/from\s+["'].*\/db\//, "database module"],
  // Spec 14.4: requests must not fetch source documents or anything else.
  [/\bfetch\s*\(/, "outbound fetch"],
  [/from\s+["'](?:node:)?https?["']/, "http client"],
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

describe("MCP runtime purity", () => {
  it("reaches no model provider or dataset database and uses the network only for the limiter", async () => {
    const files = (await Promise.all(RUNTIME_DIRS.map(walk))).flat();
    expect(files.length).toBeGreaterThan(0);

    const offences: string[] = [];
    for (const file of files) {
      const source = await readFile(file, "utf8");
      for (const [pattern, what] of FORBIDDEN) {
        // The production limiter is the sole network exception: only fixed
        // Redis commands over configured credentials, never dataset fetching.
        if (what === "outbound fetch" && path.basename(file) === "upstashCounter.ts") continue;
        if (pattern.test(source)) offences.push(`${path.basename(file)}: ${what}`);
      }
    }

    expect(offences).toEqual([]);
  });

  it("touches the filesystem in exactly one place", async () => {
    const files = (await Promise.all(RUNTIME_DIRS.map(walk))).flat();
    const readers: string[] = [];

    for (const file of files) {
      const source = await readFile(file, "utf8");
      if (/from\s+["'](?:node:)?fs/.test(source)) readers.push(path.basename(file));
    }

    // One loader, one artifact, one place to audit.
    expect(readers).toEqual(["snapshot.ts"]);
  });
});
