import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import * as XLSX from "xlsx";

import { csvEscape } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
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

// Edition guards, not coverage: these three literals pin the two archived Geostat
// workbooks and the reviewed canonical span. The refresh step in
// docs/data-methodology/national-nominal-gdp.md updates them together with the
// manifest hashes; nothing else in the pipeline may widen them silently.
const EXPECTED_SOURCE_YEARS: Record<GdpAccountingStandard, [number, number]> = {
  sna_1993: [1996, 2018],
  sna_2008: [2010, 2025],
};
const EXPECTED_CANONICAL_YEARS = Array.from({ length: 30 }, (_, index) => 1996 + index);
const EXPECTED_OVERLAP_YEARS = Array.from({ length: 9 }, (_, index) => 2010 + index);

function serializeCsv(headers: string[], rows: Array<Record<string, string | number>>): string {
  return `\uFEFF${[
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header] ?? "")).join(",")),
  ].join("\n")}\n`;
}

function sourceByteKey(standard: GdpAccountingStandard): "sna1993" | "sna2008" {
  return standard === "sna_1993" ? "sna1993" : "sna2008";
}

export function validateGdpWorkbookTitle(sheet: XLSX.WorkSheet, sourceId: string): void {
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const titles: string[] = [];
  for (let row = range.s.r; row <= Math.min(range.e.r, 1); row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const value = sheet[XLSX.utils.encode_cell({ c: column, r: row })]?.v;
      if (typeof value === "string") titles.push(value.replace(/\s+/g, " ").trim());
    }
  }
  const valid = titles.some(
    (title) =>
      title.startsWith("GROSS DOMESTIC PRODUCT") &&
      title.includes("(at current prices, mil. GEL)"),
  );
  if (!valid) {
    throw new Error(`${sourceId} is missing the expected current-price million-GEL title`);
  }
}

export function validatePublishedOneDecimal(cell: XLSX.CellObject | undefined, sourceCell: string): void {
  const decimalPlaces = String(cell?.z ?? "").match(/0\.(0+)/)?.[1]?.length;
  if (decimalPlaces !== 1) {
    throw new Error(`${sourceCell} is not published at one-decimal million-GEL precision`);
  }
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
  const workbook = XLSX.read(workbookBytes, { type: "buffer", cellNF: true });
  const sourceSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sourceSheet];
  if (!sheet) throw new Error(`Missing first worksheet for ${manifest.source_id}`);

  validateGdpWorkbookTitle(sheet, manifest.source_id);
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
    const cell = sheet[sourceCell];
    validatePublishedOneDecimal(cell, `${sourceSheet}!${sourceCell}`);
    const rawValue = Number(cell?.v);
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

export function validateNationalGdpSeries(
  sourceFacts: NationalGdpSourceFact[],
  canonicalFacts: NationalGdpFact[],
): number[] {
  const sourceKeys = new Set<string>();
  for (const row of sourceFacts) {
    const key = `${row.accountingStandard}:${row.year}`;
    if (sourceKeys.has(key)) throw new Error(`Duplicate GDP source year: ${key}`);
    sourceKeys.add(key);
  }

  for (const [standard, [yearMin, yearMax]] of Object.entries(EXPECTED_SOURCE_YEARS)) {
    const years = sourceFacts
      .filter((row) => row.accountingStandard === standard)
      .map((row) => row.year);
    const expected = Array.from({ length: yearMax - yearMin + 1 }, (_, index) => yearMin + index);
    if (JSON.stringify(years) !== JSON.stringify(expected)) {
      throw new Error(`${standard} GDP source coverage must be ${yearMin}–${yearMax}`);
    }
  }

  const canonicalYears = canonicalFacts.map((row) => row.year);
  if (JSON.stringify(canonicalYears) !== JSON.stringify(EXPECTED_CANONICAL_YEARS)) {
    throw new Error("Canonical GDP coverage must contain each year from 1996–2025 exactly once");
  }
  for (const row of canonicalFacts) {
    const expectedStandard = row.year <= 2009 ? "sna_1993" : "sna_2008";
    if (row.accountingStandard !== expectedStandard) {
      throw new Error(`Canonical GDP accounting-standard handoff is invalid for ${row.year}`);
    }
    // Geostat publishes the newest year with an asterisk. The same refresh step
    // moves this year and the manifest note that documents it.
    const expectedStatus = row.year === 2025 ? "preliminary" : "final_as_published";
    if (row.status !== expectedStatus) {
      throw new Error(`Canonical GDP status is invalid for ${row.year}`);
    }
  }

  const standardsByYear = new Map<number, Set<GdpAccountingStandard>>();
  for (const row of sourceFacts) {
    const standards = standardsByYear.get(row.year) ?? new Set<GdpAccountingStandard>();
    standards.add(row.accountingStandard);
    standardsByYear.set(row.year, standards);
  }
  const overlapYears = [...standardsByYear.entries()]
    .filter(([, standards]) => standards.size === 2)
    .map(([year]) => year)
    .sort((left, right) => left - right);
  if (JSON.stringify(overlapYears) !== JSON.stringify(EXPECTED_OVERLAP_YEARS)) {
    throw new Error("GDP source overlap must cover 2010–2018 exactly");
  }
  return overlapYears;
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
  const overlapYears = validateNationalGdpSeries(sourceFacts, canonicalFacts);

  const validation: NationalGdpValidationReport = {
    status: "PASS",
    sourceHashesMatch: true,
    sourceBytes,
    sourceHashes,
    sourceFactCount: sourceFacts.length,
    canonicalFactCount: canonicalFacts.length,
    canonicalYearMin: canonicalFacts[0]?.year ?? 0,
    canonicalYearMax: canonicalFacts.at(-1)?.year ?? 0,
    overlapYears,
  };

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
    valuation: "market_prices",
    accounting_standard: row.accountingStandard,
    status: row.status,
    source_id: row.sourceId,
    source_sheet: row.sourceSheet,
    source_cell: row.sourceCell,
    source_unit: row.sourceUnit,
    transformation: row.transformation,
    last_reviewed_at: row.lastReviewedAt,
  }));
  const artifacts = [
    {
      filePath: STAGING_PATH,
      content: serializeCsv(Object.keys(stagingRows[0] ?? {}), stagingRows),
    },
    {
      filePath: CANONICAL_PATH,
      content: serializeCsv(Object.keys(canonicalRows[0] ?? {}), canonicalRows),
    },
    { filePath: REPORT_PATH, content: `${JSON.stringify(validation, null, 2)}\n` },
  ];

  if (write) {
    await Promise.all(artifacts.map((artifact) => fs.writeFile(artifact.filePath, artifact.content, "utf8")));
  } else {
    await Promise.all(
      artifacts.map((artifact) =>
        assertGeneratedArtifactMatches("national GDP", artifact.filePath, artifact.content),
      ),
    );
  }

  return { sourceFacts, canonicalFacts, validation };
}
