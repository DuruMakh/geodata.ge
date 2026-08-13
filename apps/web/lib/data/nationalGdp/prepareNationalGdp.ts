import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

import { csvEscape } from "../csvEscape";
import type {
  GdpAccountingStandard,
  NationalGdpFact,
  NationalGdpPreparationResult,
  NationalGdpSourceFact,
  NationalGdpValidationReport,
} from "./types";

type ManifestRow = {
  source_id: string;
  accounting_standard: GdpAccountingStandard;
  local_file: string;
  sha256: string;
  bytes: string;
  source_year_min: string;
  source_year_max: string;
};

const REVIEWED_AT = "2026-08-13";
const TRANSFORMATION =
  "Published one-decimal million GEL multiplied by 1,000,000; no estimate.";
const REPO_ROOT = path.resolve(process.cwd(), "../..");
const PACKAGE_DIR = path.join(
  REPO_ROOT,
  "docs",
  "Raw Data",
  "GDP",
  "national-nominal-gdp",
);
const STAGING_PATH = path.join(
  REPO_ROOT,
  "data",
  "staging",
  "national-gdp-source-facts-1996-2025.csv",
);
const CANONICAL_PATH = path.join(
  REPO_ROOT,
  "data",
  "imports",
  "national-gdp-annual-1996-2025.csv",
);
const REPORT_PATH = path.join(
  REPO_ROOT,
  "data",
  "reports",
  "national-gdp-annual-1996-2025-validation.json",
);

function serializeCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  return `\uFEFF${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function sourceByteKey(standard: GdpAccountingStandard): "sna1993" | "sna2008" {
  return standard === "sna_1993" ? "sna1993" : "sna2008";
}

function findMarketPriceRow(sheet: XLSX.WorkSheet): number {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= Math.min(range.e.c, 2); column += 1) {
      const cell = sheet[XLSX.utils.encode_cell({ c: column, r: row })];
      if (String(cell?.v ?? "").trim() === "(=) GDP at market prices") return row;
    }
  }
  throw new Error("Could not find Geostat's GDP at market prices row");
}

function extractSourceFacts(
  workbookBytes: Buffer,
  manifest: ManifestRow,
): NationalGdpSourceFact[] {
  const workbook = XLSX.read(workbookBytes, { type: "buffer" });
  const sourceSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sourceSheet];
  if (!sheet) throw new Error(`Missing first worksheet for ${manifest.source_id}`);

  const marketPriceRow = findMarketPriceRow(sheet);
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const yearMin = Number(manifest.source_year_min);
  const yearMax = Number(manifest.source_year_max);
  const rows: NationalGdpSourceFact[] = [];

  for (let column = range.s.c; column <= range.e.c; column += 1) {
    const header = String(
      sheet[XLSX.utils.encode_cell({ c: column, r: 1 })]?.v ?? "",
    ).trim();
    const match = /^(\d{4})(\*)?$/.exec(header);
    if (!match) continue;

    const year = Number(match[1]);
    if (year < yearMin || year > yearMax) continue;
    const sourceCell = XLSX.utils.encode_cell({ c: column, r: marketPriceRow });
    const rawValue = Number(sheet[sourceCell]?.v);
    if (!Number.isFinite(rawValue) || rawValue <= 0) {
      throw new Error(`Invalid GDP value at ${sourceSheet}!${sourceCell}`);
    }

    rows.push({
      year,
      gdpCurrentPricesMillionGel: Math.round(rawValue * 10) / 10,
      accountingStandard: manifest.accounting_standard,
      status: match[2] ? "preliminary" : "final_as_published",
      sourceId: manifest.source_id,
      sourceSheet,
      sourceCell,
      sourceUnit: "mil. GEL",
    });
  }

  const expectedCount = yearMax - yearMin + 1;
  if (rows.length !== expectedCount) {
    throw new Error(
      `${manifest.source_id} produced ${rows.length} annual rows; expected ${expectedCount}`,
    );
  }
  return rows;
}

export async function prepareNationalGdp({
  write,
}: {
  write: boolean;
}): Promise<NationalGdpPreparationResult> {
  const manifestText = await fs.readFile(path.join(PACKAGE_DIR, "source-manifest.csv"), "utf8");
  const manifestRows = parse(manifestText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as ManifestRow[];

  if (manifestRows.length !== 2) throw new Error("Expected exactly two national GDP sources");

  const sourceBytes = {} as NationalGdpValidationReport["sourceBytes"];
  const sourceHashes = {} as NationalGdpValidationReport["sourceHashes"];
  const extracted: NationalGdpSourceFact[] = [];

  for (const manifest of manifestRows) {
    const workbookBytes = await fs.readFile(path.join(PACKAGE_DIR, manifest.local_file));
    const hash = createHash("sha256").update(workbookBytes).digest("hex").toUpperCase();
    if (workbookBytes.byteLength !== Number(manifest.bytes) || hash !== manifest.sha256) {
      throw new Error(`Reviewed source mismatch for ${manifest.source_id}`);
    }
    const key = sourceByteKey(manifest.accounting_standard);
    sourceBytes[key] = workbookBytes.byteLength;
    sourceHashes[key] = hash;
    extracted.push(...extractSourceFacts(workbookBytes, manifest));
  }

  const sourceFacts = extracted.sort(
    (left, right) =>
      left.year - right.year || left.accountingStandard.localeCompare(right.accountingStandard),
  );
  const canonicalFacts: NationalGdpFact[] = sourceFacts
    .filter((row) =>
      row.year <= 2009
        ? row.accountingStandard === "sna_1993"
        : row.accountingStandard === "sna_2008",
    )
    .map((row) => ({
      ...row,
      gdpCurrentPricesGel: row.gdpCurrentPricesMillionGel * 1_000_000,
      transformation: TRANSFORMATION,
      lastReviewedAt: REVIEWED_AT,
    }));

  const validation: NationalGdpValidationReport = {
    status: "PASS",
    sourceHashesMatch: true,
    sourceBytes,
    sourceHashes,
    sourceFactCount: sourceFacts.length,
    canonicalFactCount: canonicalFacts.length,
    canonicalYearMin: canonicalFacts[0]?.year ?? 0,
    canonicalYearMax: canonicalFacts.at(-1)?.year ?? 0,
    overlapYears: Array.from({ length: 9 }, (_, index) => 2010 + index),
  };

  if (write) {
    const stagingRows = sourceFacts.map((row) => ({
      year: row.year,
      gdp_current_prices_million_gel: row.gdpCurrentPricesMillionGel.toFixed(1),
      accounting_standard: row.accountingStandard,
      status: row.status,
      source_id: row.sourceId,
      source_sheet: row.sourceSheet,
      source_cell: row.sourceCell,
      source_unit: row.sourceUnit,
    }));
    const canonicalRows = canonicalFacts.map((row) => ({
      year: row.year,
      gdp_current_prices_million_gel: row.gdpCurrentPricesMillionGel.toFixed(1),
      gdp_current_prices_gel: row.gdpCurrentPricesGel,
      valuation: "current_prices",
      accounting_standard: row.accountingStandard,
      status: row.status,
      source_id: row.sourceId,
      source_sheet: row.sourceSheet,
      source_cell: row.sourceCell,
      source_unit: row.sourceUnit,
      transformation: row.transformation,
      last_reviewed_at: row.lastReviewedAt,
    }));

    await Promise.all([
      fs.writeFile(
        STAGING_PATH,
        serializeCsv(Object.keys(stagingRows[0] ?? {}), stagingRows),
        "utf8",
      ),
      fs.writeFile(
        CANONICAL_PATH,
        serializeCsv(Object.keys(canonicalRows[0] ?? {}), canonicalRows),
        "utf8",
      ),
      fs.writeFile(REPORT_PATH, `${JSON.stringify(validation, null, 2)}\n`, "utf8"),
    ]);
  }

  return { sourceFacts, canonicalFacts, validation };
}
