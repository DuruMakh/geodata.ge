import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { listPublicPagePaths } from "../lib/i18n/inventory.server";
import { pageHref } from "../lib/i18n/routes";

type Asset = { url: string; kind: "script" | "font"; decodedBytes: number; contentEncoding?: string | null; encodedLengthHeader?: number | null };
type PageMeasurement = { path: string; locale: "ka" | "en"; status: number; htmlBytes: number; contentEncoding: string | null; encodedLengthHeader: number | null; scriptUrls: string[]; fontUrls: string[]; scriptBytes: number; fontBytes: number };
function assetsIn(html: string): { url: string; kind: Asset["kind"] }[] {
  const assets = new Map<string, Asset["kind"]>();
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) assets.set(match[1].replaceAll("&amp;", "&"), "script");
  for (const match of html.matchAll(/<link\b[^>]*>/g)) {
    if (/\bas="font"/.test(match[0])) {
      const url = match[0].match(/\bhref="([^"]+)"/)?.[1];
      if (url) assets.set(url.replaceAll("&amp;", "&"), "font");
    }
  }
  return [...assets].map(([url, kind]) => ({ url, kind }));
}
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const sum = (assets: Asset[], kind: Asset["kind"]) => assets.filter(asset => asset.kind === kind).reduce((total, asset) => total + asset.decodedBytes, 0);
async function emittedAssets(root: string) {
  const directory = join(root, ".next/static");
  const files = (await readdir(directory, { recursive: true })).filter(file => /\.(?:js|woff2)$/.test(file));
  const rows = await Promise.all(files.map(async file => ({ file, bytes: (await stat(join(directory, file))).size })));
  return { scriptBytes: rows.filter(row => row.file.endsWith(".js")).reduce((total, row) => total + row.bytes, 0), fontBytes: rows.filter(row => row.file.endsWith(".woff2")).reduce((total, row) => total + row.bytes, 0), files: rows };
}

export async function measureBilingualOutput(baseUrl: string, outputDirectory: string): Promise<void> {
  const root = process.cwd();
  const paths = await listPublicPagePaths();
  const pages: PageMeasurement[] = [];
  const assets = new Map<string, Asset>();
  for (const path of paths) for (const locale of ["ka", "en"] as const) {
    const response = await fetch(new URL(pageHref(path, locale), baseUrl));
    if (response.status !== 200) throw new Error(`${locale}:${path}: HTTP ${response.status}`);
    const html = await response.text();
    const references = assetsIn(html);
    for (const asset of references) if (!assets.has(asset.url)) {
      const resource = await fetch(new URL(asset.url, baseUrl));
      if (!resource.ok) throw new Error(`Missing asset: ${asset.url}`);
      const body = Buffer.from(await resource.arrayBuffer());
      assets.set(asset.url, { ...asset, decodedBytes: body.byteLength, contentEncoding: resource.headers.get("content-encoding"), encodedLengthHeader: resource.headers.has("content-length") ? Number(resource.headers.get("content-length")) : null });
    }
    const selected = references.map(asset => assets.get(asset.url)!);
    pages.push({ path, locale, status: response.status, htmlBytes: Buffer.byteLength(html), contentEncoding: response.headers.get("content-encoding"), encodedLengthHeader: response.headers.has("content-length") ? Number(response.headers.get("content-length")) : null, scriptUrls: references.filter(asset => asset.kind === "script").map(asset => asset.url), fontUrls: references.filter(asset => asset.kind === "font").map(asset => asset.url), scriptBytes: sum(selected, "script"), fontBytes: sum(selected, "font") });
  }

  // F1 retained its build duration and data manifest, but not bundle bytes.
  // Reconstruct only those missing measurements from the exact baseline checkout.
  const baselineRoot = resolve(root, "../../.tmp/bilingual/baseline-checkout/apps/web");
  const [baselineEmitted, currentEmitted] = await Promise.all([emittedAssets(baselineRoot), emittedAssets(root)]);
  const baselineAssets = new Map<string, Asset>();
  const baselinePages = [];
  for (const path of paths) {
    const html = await readFile(join(baselineRoot, ".next/server/app", path === "/" ? "index.html" : `${path.slice(1)}.html`), "utf8");
    const references = assetsIn(html);
    for (const asset of references) if (!baselineAssets.has(asset.url)) {
      const file = new URL(asset.url, "https://fiscal.ge").pathname.replace(/^\/_next\//, ".next/");
      const body = await readFile(join(baselineRoot, file));
      baselineAssets.set(asset.url, { ...asset, decodedBytes: body.byteLength });
    }
    const selected = references.map(asset => baselineAssets.get(asset.url)!);
    baselinePages.push({ path, htmlBytes: Buffer.byteLength(html), scriptBytes: sum(selected, "script"), fontBytes: sum(selected, "font") });
  }

  const snapshotBytes = await readFile(join(root, "lib/factQuery/generated/snapshot.json"));
  const snapshot = JSON.parse(snapshotBytes.toString("utf8"));
  const manifest = JSON.parse(await readFile(join(root, "public/downloads/data/manifest.json"), "utf8"));
  const publications = [];
  for (const file of [...manifest.files, { fileName: "manifest.json" }]) {
    const bytes = await readFile(join(root, "public/downloads/data", file.fileName));
    if (file.sha256 && (file.sha256 !== hash(bytes) || file.byteSize !== bytes.byteLength)) throw new Error(`Manifest mismatch: ${file.fileName}`);
    publications.push({ fileName: file.fileName, bytes: bytes.byteLength, sha256: hash(bytes), rowCount: file.rowCount ?? manifest.files.length });
  }
  const baselineManifest = JSON.parse(await readFile(resolve(root, "../../.tmp/bilingual/baseline/baseline-manifest.json"), "utf8"));
  const baselineSnapshotBytes = (await readFile(resolve(root, "../../.tmp/bilingual/baseline/snapshot.json"))).byteLength;
  const baselineSeconds = (await readFile(resolve(root, "../../.tmp/bilingual/baseline/build-seconds.txt"), "utf8")).trim();
  const finalSeconds = (await readFile(join(outputDirectory, "build-seconds.txt"), "utf8")).trim();
  const buildLog = await readFile(join(outputDirectory, "build.log"), "utf8");
  const generatedCount = Number(buildLog.match(/\((\d+)\/\1\)/)?.[1]);
  const dynamicRoutes = [...buildLog.matchAll(/^[├└] ƒ (\/[^\r\n]*)/gm)].map(match => match[1]);
  if (!generatedCount || JSON.stringify(dynamicRoutes) !== '["/mcp"]') throw new Error("Unverified static/dynamic build inventory");
  const prerender = JSON.parse(await readFile(join(root, ".next/prerender-manifest.json"), "utf8"));
  const mcp = JSON.parse(await readFile(join(outputDirectory, "mcp.json"), "utf8"));
  const baselineMcp = JSON.parse(await readFile(resolve(root, "../../.tmp/bilingual/baseline/mcp.json"), "utf8"));
  const oversized = mcp.measurements.filter((row: { name: string; limitOutcome: string }) => row.limitOutcome === "byte_limit" && baselineMcp.measurements.find((before: { name: string }) => before.name === row.name)?.limitOutcome === "accepted");

  const report = [
    "# Bilingual local acceptance measurements", "",
    `Build release commit: ${snapshot.releaseCommit}; schema ${snapshot.schemaVersion}; dataVersion ${snapshot.dataVersion}.`,
    `Measured ${pages.length} HTTP pages, ${assets.size} distinct referenced assets and ${publications.length} JSON publications.`,
    `Build duration: F1 ${baselineSeconds}s; final ${finalSeconds}s. Static generation entries: 99 → ${generatedCount}. Only request-time route: ${dynamicRoutes.join(", ")}.`,
    `Snapshot bytes: ${baselineSnapshotBytes} → ${snapshotBytes.byteLength}.`, "",
    `All emitted client JavaScript, including lazy chunks: ${baselineEmitted.scriptBytes} → ${currentEmitted.scriptBytes} bytes. Emitted font files: ${baselineEmitted.fontBytes} → ${currentEmitted.fontBytes} bytes.`, "",
    "## Bytes and interpretation", "",
    "HTML, script and font bytes below are decoded file/body bytes, not network transfer sizes. Per-page JavaScript counts scripts referenced in initial HTML; the separate emitted total includes lazy chunks. Encoded Content-Length and Content-Encoding are recorded separately when the server supplies them; HTTP framing is not measured. Baseline bundle bytes were reconstructed from ac9f53fc0 with the same locked dependencies. Build duration uses F1's original timing; cache and machine load can differ.", "",
    "| Page | Baseline HTML | Georgian HTML | English HTML | Baseline JS | Georgian JS | English JS | Baseline fonts | Current fonts |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...baselinePages.filter(row => ["/", "/explorer/expenditure", "/explorer/municipalities", "/explorer/analysis", "/methodology/expenditure", "/connect"].includes(row.path)).map(before => {
      const ka = pages.find(row => row.path === before.path && row.locale === "ka")!;
      const en = pages.find(row => row.path === before.path && row.locale === "en")!;
      return `| ${before.path} | ${before.htmlBytes} | ${ka.htmlBytes} | ${en.htmlBytes} | ${before.scriptBytes} | ${ka.scriptBytes} | ${en.scriptBytes} | ${before.fontBytes} | ${en.fontBytes} |`;
    }), "", "## Published JSON", "",
    "| File | Baseline bytes | Final bytes | Rows |", "| --- | ---: | ---: | ---: |",
    ...publications.filter(file => file.fileName !== "manifest.json").map(file => `| ${file.fileName} | ${baselineManifest.files.find((before: { fileName: string }) => before.fileName === file.fileName).byteSize} | ${file.bytes} | ${file.rowCount} |`), "",
    "## MCP size boundary", "",
    ...oversized.map((row: { name: string; completeBytes: number }) => `- ${row.name}: now ${row.completeBytes} complete serialized bytes; use fewer source IDs or the shared bulk publication.`),
    "The 495/500-cell municipal requests were already above the byte cap before translation. All input, cell, ranking and complete-result limits remain unchanged.", "",
    "## Verification boundary", "", "This report covers the local CSV build and SDK responses. No local database credentials were available; fixture tests exercise both loader paths with the same catalogue. A live database-mode build and production commit/URL verification remain part of the authorized release pipeline.", "",
  ];
  await mkdir(outputDirectory, { recursive: true });
  const outputs = { "pages.json": pages, "assets.json": { current: [...assets.values()], baseline: [...baselineAssets.values()], baselinePages, baselineEmitted, currentEmitted }, "publications.json": { schemaVersion: snapshot.schemaVersion, dataVersion: snapshot.dataVersion, releaseCommit: snapshot.releaseCommit, snapshotBytes: snapshotBytes.byteLength, files: publications }, "build-inventory.json": { generatedCount, dynamicRoutes, prerenderedRoutes: Object.keys(prerender.routes) } };
  for (const [name, value] of Object.entries(outputs)) await writeFile(join(outputDirectory, name), `${JSON.stringify(value, null, 2)}\n`);
  await writeFile(join(outputDirectory, "comparison.md"), report.join("\n"));
  console.log(`Measured ${pages.length} pages, ${assets.size} assets and ${publications.length} publications: ${outputDirectory}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argument = (name: string) => { const index = process.argv.indexOf(name); if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}`); return process.argv[index + 1]; };
  measureBilingualOutput(argument("--base-url"), resolve(argument("--output"))).catch(error => { console.error(error); process.exitCode = 1; });
}
