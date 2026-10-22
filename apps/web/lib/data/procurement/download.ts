import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { serializeBomCsvRows } from "../csvEscape";
import { sourceFiles } from "./paths";

export type ManifestRow = { path: string; bytes: number; sha256: string; source_url: string; retrieved_at: string };

const MANIFEST_HEADER = ["path", "bytes", "sha256", "source_url", "retrieved_at"] as const;

function manifestRow(dataDir: string, relativePath: string, sourceUrl: string): ManifestRow {
  const filePath = path.join(dataDir, relativePath);
  const bytes = fs.readFileSync(filePath);
  return {
    path: relativePath,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    source_url: sourceUrl,
    retrieved_at: fs.statSync(filePath).mtime.toISOString(),
  };
}

/** Moves the one workbook inside a freshly unzipped archive to its fixed name. */
async function extractWorkbook(zipPath: string, xlsxPath: string, unzip: (zip: string, outDir: string) => Promise<void>) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "procurement-unzip-"));
  try {
    await unzip(zipPath, outDir);
    const workbooks = fs.readdirSync(outDir).filter(name => name.toLowerCase().endsWith(".xlsx"));
    if (workbooks.length !== 1) throw new Error(`${zipPath} holds ${workbooks.length} workbooks; expected exactly one`);
    fs.copyFileSync(path.join(outDir, workbooks[0]), xlsxPath);
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

/**
 * Downloads every Tender Monitor yearly file not already present, unpacks its workbook and writes MANIFEST.csv
 * (path, size, SHA-256, address, time) for every zip and workbook.
 */
export async function downloadSources(
  dataDir: string,
  fetchImpl: typeof fetch,
  unzip: (zip: string, outDir: string) => Promise<void>,
): Promise<ManifestRow[]> {
  fs.mkdirSync(path.join(dataDir, "originals"), { recursive: true });
  const rows: ManifestRow[] = [];
  for (const file of sourceFiles()) {
    const zipPath = path.join(dataDir, file.zipPath);
    const xlsxPath = path.join(dataDir, file.xlsxPath);
    if (!fs.existsSync(zipPath)) {
      const response = await fetchImpl(file.url);
      if (!response.ok) throw new Error(`Download of ${file.url} failed with HTTP ${response.status}`);
      fs.writeFileSync(`${zipPath}.part`, Buffer.from(await response.arrayBuffer()));
      fs.renameSync(`${zipPath}.part`, zipPath);
    }
    if (!fs.existsSync(xlsxPath)) await extractWorkbook(zipPath, xlsxPath, unzip);
    rows.push(manifestRow(dataDir, file.zipPath, file.url), manifestRow(dataDir, file.xlsxPath, file.url));
  }
  fs.writeFileSync(
    path.join(dataDir, "MANIFEST.csv"),
    serializeBomCsvRows([[...MANIFEST_HEADER], ...rows.map(row => MANIFEST_HEADER.map(key => row[key]))]),
  );
  return rows;
}
