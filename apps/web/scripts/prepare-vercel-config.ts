import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { runAsCli } from "../lib/runAsCli";
import { siteHeaders, siteRedirects, type SiteHeaderRule, type SiteRedirect } from "../lib/site/routing";

// Writes apps/web/vercel.json: the site is a static export (next.config.ts `output: "export"`), so Vercel, not
// Next.js, applies the redirects and headers, and /mcp is the one function. The rules come from
// lib/site/routing.ts; tests/site/vercelConfig.test.ts fails when the committed file has drifted from them.
const OUTPUT = path.join(process.cwd(), "vercel.json");

export type VercelConfig = {
  framework: null;
  buildCommand: string;
  outputDirectory: string;
  cleanUrls: boolean;
  trailingSlash: boolean;
  redirects: SiteRedirect[];
  headers: SiteHeaderRule[];
  rewrites: { source: string; destination: string }[];
  functions: Record<string, { maxDuration: number; includeFiles: string }>;
  git: { deploymentEnabled: { main: boolean } };
};

export function buildVercelConfig(): VercelConfig {
  return {
    // "Other": Vercel serves out/ as files and builds api/ as functions. Set here rather than in the dashboard, so a
    // Preview tests exactly what production runs.
    framework: null,
    buildCommand: "npm run build",
    outputDirectory: "out",
    cleanUrls: true,
    trailingSlash: false,
    redirects: siteRedirects(),
    headers: [
      ...siteHeaders(),
      // Next.js's own server sent these two; static serving needs them stated. Built assets carry a content hash.
      { source: "/_next/static/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      // The social preview images are written without a file extension.
      ...["/opengraph-image", "/en/opengraph-image"].map(source => ({ source, headers: [{ key: "Content-Type", value: "image/png" }] })),
    ],
    // The public address stays https://fiscal.ge/mcp.
    rewrites: [{ source: "/mcp", destination: "/api/mcp" }],
    functions: {
      // 10 s request ceiling (MCP spec section 11.3). The snapshot is written by prebuild and read at request time,
      // so the function bundle must include it explicitly.
      "api/mcp.ts": { maxDuration: 10, includeFiles: "lib/factQuery/generated/snapshot.json" },
    },
    // Production deploys only through .github/workflows/deploy-production.yml.
    git: { deploymentEnabled: { main: false } },
  };
}

export async function main(args: readonly string[]) {
  const write = args.includes("--write");
  const check = args.includes("--check");
  if (write === check) throw new Error("Pass exactly one of --write or --check");
  const text = `${JSON.stringify(buildVercelConfig(), null, 2)}\n`;
  if (write) {
    await writeFile(OUTPUT, text, "utf8");
    process.stdout.write(`wrote ${OUTPUT}\n`);
    return;
  }
  if ((await readFile(OUTPUT, "utf8")) !== text) throw new Error("vercel.json is out of date: run npm run site:prepare-vercel-config");
}

runAsCli(import.meta.url, main);
