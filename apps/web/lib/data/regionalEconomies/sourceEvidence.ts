import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Decimal from "decimal.js";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import type { SectorDefinition } from "../economicSectors/types";

const D = Decimal.clone({ precision: 50, rounding: Decimal.ROUND_HALF_UP });
const YEARS = Array.from({ length: 15 }, (_, index) => 2010 + index);

export const REGIONAL_SOURCE_SHEETS = [
  ["Tbilisi", "region.tbilisi"],
  ["Adjara A.R.", "region.adjara"],
  ["Guria", "region.guria"],
  ["Imereti", "region.imereti"],
  ["Kakheti", "region.kakheti"],
  ["Mtskheta-Mtianeti", "region.mtskheta_mtianeti"],
  ["Racha", "region.racha_lechkhumi_kvemo_svaneti"],
  ["Samegrelo", "region.samegrelo_zemo_svaneti"],
  ["Samtskhe", "region.samtskhe_javakheti"],
  ["Kvemo Kartli", "region.kvemo_kartli"],
  ["Shida Kartli", "region.shida_kartli"],
] as const;

export const REGIONAL_TOTAL_ROWS = [
  ["Tbilisi", "region.tbilisi"],
  ["Adjara A.R.", "region.adjara"],
  ["Guria", "region.guria"],
  ["Imereti", "region.imereti"],
  ["Kakheti", "region.kakheti"],
  ["Mtskheta-Mtianeti", "region.mtskheta_mtianeti"],
  ["Racha-Lechkhumi and Kvemo Svaneti", "region.racha_lechkhumi_kvemo_svaneti"],
  ["Samegrelo-Zemo Svaneti", "region.samegrelo_zemo_svaneti"],
  ["Samtskhe-Javakheti", "region.samtskhe_javakheti"],
  ["Kvemo Kartli", "region.kvemo_kartli"],
  ["Shida Kartli", "region.shida_kartli"],
] as const;

type RegionalSourceRole = "regional_totals" | "regional_activities" | "national_validation";

export type RegionalSourceManifestEntry = {
  role: RegionalSourceRole;
  sourceId: string;
  file: string;
  originalFilename: string;
  url: string;
  sha256: string;
  bytes: number;
  sheetNames: string[];
};

export type RegionalSourceManifest = {
  capturedOn: string;
  reviewedAt: string;
  sourcePage: string;
  classification: string;
  accountingStandard: string;
  unit: string;
  metadataUrl: string;
  regionalAccountingToleranceGel: string;
  sources: RegionalSourceManifestEntry[];
};

type NumericCell = { value: string; locator: string };

type ActivitySheet = {
  sheetName: string;
  regionId: string;
  classification: string;
  years: number[];
  activities: { code: string; officialName: string; row: number; seriesId: string }[];
  accountingRows: { row: number; label: string }[];
  lastUpdate: string;
  metadataUrl: string;
  cell(year: number, row: number): NumericCell;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
const normalize = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");

function numericXmlByAddress(bytes: Buffer, sheetNumber: number, sheet: XLSX.WorkSheet) {
  const entries = unzipSync(bytes);
  const file = entries[`xl/worksheets/sheet${sheetNumber}.xml`];
  if (!file) throw new Error(`Missing worksheet XML: sheet${sheetNumber}`);
  const values = new Map<string, string>();
  for (const match of strFromU8(file).matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
    const value = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
    if (address && value !== undefined && sheet[address]?.t === "n") values.set(address, value);
  }
  return values;
}

function numericCell(
  sheet: XLSX.WorkSheet,
  values: Map<string, string>,
  sheetName: string,
  column: number,
  row: number,
  year: number,
): NumericCell {
  const address = XLSX.utils.encode_cell({ r: row - 1, c: column });
  const raw = values.get(address);
  if (!raw || !/^[+-]?\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/.test(raw)) {
    throw new Error(`Invalid regional source numeric cell: ${sheetName}!${address}`);
  }
  if (sheet[address]?.t !== "n") throw new Error(`Non-numeric regional source cell: ${sheetName}!${address}`);
  return { value: new D(raw).toFixed(), locator: `${sheetName}!${address} [${year}]` };
}

export async function loadRegionalSourceEvidence(repositoryRoot: string) {
  const manifestPath = path.join(repositoryRoot, "docs/Raw Data/Economy/regional-economies/source-manifest.json");
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8")) as RegionalSourceManifest;
  if (
    manifest.classification !== "NACE Rev. 2 / GNC 006-2016" ||
    manifest.accountingStandard !== "sna_2008" ||
    manifest.unit !== "million_gel_current_prices" ||
    manifest.regionalAccountingToleranceGel !== "0.01" ||
    manifest.capturedOn !== "2026-09-10"
  ) throw new Error("Unreviewed regional economy source contract");
  if (!same(manifest.sources.map((source) => source.role), ["regional_totals", "regional_activities", "national_validation"])) {
    throw new Error("Unexpected regional economy source roles");
  }

  const buffers = new Map<RegionalSourceRole, Buffer>();
  for (const source of manifest.sources) {
    const bytes = await fs.readFile(path.join(repositoryRoot, source.file));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== source.sha256 || bytes.length !== source.bytes) {
      throw new Error(`Regional source hash mismatch: ${source.file}`);
    }
    buffers.set(source.role, bytes);
  }

  const sectorRegistry = JSON.parse(
    await fs.readFile(path.join(repositoryRoot, "data/taxonomy/economic-sectors.json"), "utf8"),
  ) as SectorDefinition[];
  const sectors = sectorRegistry
    .filter((sector): sector is SectorDefinition & { classificationCode: string } => sector.classificationCode !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  if (!same(sectors.map((sector) => sector.classificationCode), "ABCDEFGHIJKLMNOPQRST".split(""))) {
    throw new Error("Unexpected regional sector registry");
  }

  const activitySource = manifest.sources.find((source) => source.role === "regional_activities")!;
  const activityBytes = buffers.get("regional_activities")!;
  const activityBook = XLSX.read(activityBytes, { type: "buffer" });
  if (!same(activityBook.SheetNames, activitySource.sheetNames) || !same(activityBook.SheetNames, REGIONAL_SOURCE_SHEETS.map(([name]) => name))) {
    throw new Error("Unexpected regional activity workbook sheets");
  }
  const accountingRows = [
    { row: 23, label: "(=) GDP at basic prices" },
    { row: 24, label: "(+) Taxes on products" },
    { row: 25, label: "(-) Subsidies on products" },
    { row: 26, label: "(=) GDP at market prices" },
  ];
  const activitySheets: ActivitySheet[] = REGIONAL_SOURCE_SHEETS.map(([sheetName, regionId], index) => {
    const sheet = activityBook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
    const classification = normalize(sheet.A2?.v).replace("NACE rev. 2", "NACE rev. 2");
    if (classification !== "NACE rev. 2") throw new Error(`Regional classification mismatch: ${sheetName}`);
    const annual = new Map<number, number>();
    rows[1].forEach((header, column) => {
      if (/^\d{4}$/.test(String(header))) annual.set(Number(header), column);
    });
    if (!same([...annual.keys()], YEARS)) throw new Error(`Regional activity coverage mismatch: ${sheetName}`);
    const activities = sectors.map((sector, activityIndex) => {
      const row = activityIndex + 3;
      if (normalize(sheet[`A${row}`]?.v) !== sector.classificationCode || normalize(sheet[`B${row}`]?.v) !== sector.officialName) {
        throw new Error(`Regional activity mapping mismatch: ${sheetName}!A${row}:B${row}`);
      }
      return { code: sector.classificationCode, officialName: sector.officialName, row, seriesId: sector.id };
    });
    for (const expected of accountingRows) {
      if (normalize(sheet[`B${expected.row}`]?.v) !== expected.label) {
        throw new Error(`Regional accounting-row mismatch: ${sheetName}!B${expected.row}`);
      }
    }
    const lastUpdateText = normalize(sheet.B28?.v);
    const lastUpdate = /^Last update: (\d{2}\.\d{2}\.\d{4})$/.exec(lastUpdateText)?.[1];
    if (lastUpdate !== "23.12.2025" || normalize(sheet.B30?.v) !== manifest.metadataUrl) {
      throw new Error(`Regional metadata mismatch: ${sheetName}`);
    }
    const numericValues = numericXmlByAddress(activityBytes, index + 1, sheet);
    return {
      sheetName,
      regionId,
      classification,
      years: [...annual.keys()],
      activities,
      accountingRows,
      lastUpdate,
      metadataUrl: normalize(sheet.B30?.v),
      cell(year: number, row: number) {
        const column = annual.get(year);
        if (column === undefined) throw new Error(`Missing regional activity year: ${sheetName} ${year}`);
        return numericCell(sheet, numericValues, sheetName, column, row, year);
      },
    };
  });

  const totalSource = manifest.sources.find((source) => source.role === "regional_totals")!;
  const totalBytes = buffers.get("regional_totals")!;
  const totalBook = XLSX.read(totalBytes, { type: "buffer" });
  if (!same(totalBook.SheetNames, totalSource.sheetNames)) throw new Error("Unexpected regional total workbook sheets");
  const totalSheetName = totalBook.SheetNames[0];
  const totalSheet = totalBook.Sheets[totalSheetName];
  const totalRows = XLSX.utils.sheet_to_json<unknown[]>(totalSheet, { header: 1, defval: null });
  const totalAnnual = new Map<number, number>();
  totalRows[1].forEach((header, column) => {
    if (/^\d{4}$/.test(String(header))) totalAnnual.set(Number(header), column);
  });
  if (!same([...totalAnnual.keys()], YEARS)) throw new Error("Regional total coverage mismatch");
  REGIONAL_TOTAL_ROWS.forEach(([label], index) => {
    if (normalize(totalSheet[`A${index + 3}`]?.v) !== label) throw new Error(`Regional total row mismatch: A${index + 3}`);
  });
  if (normalize(totalSheet.A14?.v) !== "GDP at market prices" || normalize(totalSheet.A16?.v) !== "Last update: 23.12.2025" || normalize(totalSheet.A18?.v) !== manifest.metadataUrl) {
    throw new Error("Regional total metadata mismatch");
  }
  const totalValues = numericXmlByAddress(totalBytes, 1, totalSheet);
  const totalRowByRegion = new Map<string, number>(
    REGIONAL_TOTAL_ROWS.map(([, regionId], index) => [regionId, index + 3]),
  );
  const totalSheetEvidence = {
    sheetName: totalSheetName,
    years: [...totalAnnual.keys()],
    cell(regionId: string, year: number) {
      const row = totalRowByRegion.get(regionId);
      const column = totalAnnual.get(year);
      if (row === undefined || column === undefined) throw new Error(`Missing regional total cell: ${regionId} ${year}`);
      return numericCell(totalSheet, totalValues, totalSheetName, column, row, year);
    },
    nationalCell(year: number) {
      const column = totalAnnual.get(year);
      if (column === undefined) throw new Error(`Missing regional publication national total: ${year}`);
      return numericCell(totalSheet, totalValues, totalSheetName, column, 14, year);
    },
  };

  const nationalSource = manifest.sources.find((source) => source.role === "national_validation")!;
  const nationalBytes = buffers.get("national_validation")!;
  const nationalBook = XLSX.read(nationalBytes, { type: "buffer" });
  if (!same(nationalBook.SheetNames, nationalSource.sheetNames)) throw new Error("Unexpected national validation workbook sheets");
  const nationalSheetName = nationalBook.SheetNames[0];
  const nationalSheet = nationalBook.Sheets[nationalSheetName];
  const nationalRows = XLSX.utils.sheet_to_json<unknown[]>(nationalSheet, { header: 1, defval: null });
  const nationalAnnual = new Map<number, number>();
  nationalRows[1].forEach((header, column) => {
    const match = /^(\d{4})\*?$/.exec(String(header));
    if (match) nationalAnnual.set(Number(match[1]), column);
  });
  const nationalValues = numericXmlByAddress(nationalBytes, 1, nationalSheet);
  const nationalValidation = {
    sheetName: nationalSheetName,
    years: [...nationalAnnual.keys()],
    cell(year: number, row: number) {
      const column = nationalAnnual.get(year);
      if (column === undefined) throw new Error(`Missing national validation year: ${year}`);
      return numericCell(nationalSheet, nationalValues, nationalSheetName, column, row, year);
    },
  };

  return { manifest, sectors, activitySheets, totalSheet: totalSheetEvidence, nationalValidation };
}
