import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import Decimal from "decimal.js";

type Row = Record<string, string>;

const SECTOR_GDP_DECIMAL_PLACES = 5;

const readCsv = async (file: string): Promise<Row[]> =>
  parse(await readFile(file, "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as Row[];

/**
 * The same nominal GDP is published three times: as the budget denominator
 * (rounded to 0.1 mln GEL), as the overview's `nominal_gel`, and as the sector
 * table's `economy.gdp_total`. Each rounding is a reviewed contract, so they are
 * not merged; this check makes a refresh that moves only one of them fail loudly.
 */
export async function checkNominalGdpConsistency(
  repositoryRoot: string,
): Promise<{ years: number[]; comparisons: number }> {
  const at = (...segments: string[]) => path.join(repositoryRoot, ...segments);
  const [overview, sectors, national, nationalManifest] = await Promise.all([
    readCsv(at("data", "imports", "gdp-overview-annual.csv")),
    readCsv(at("data", "imports", "economic-sectors-annual.csv")),
    readCsv(at("data", "imports", "national-gdp-annual-1996-2025.csv")),
    readCsv(at("docs", "Raw Data", "GDP", "national-nominal-gdp", "source-manifest.csv")),
  ]);
  const overviewManifest = JSON.parse(
    await readFile(
      at("docs", "Raw Data", "Economy", "gdp-overview", "source-manifest.json"),
      "utf8",
    ),
  ) as { files: { file: string; sha256: string; bytes: number }[] };

  const problems: string[] = [];
  let comparisons = 0;

  const nominal = new Map<number, Decimal>();
  for (const row of overview) {
    if (row.series_id !== "nominal_gel") continue;
    nominal.set(Number(row.year), new Decimal(row.value!));
  }
  if (nominal.size === 0) problems.push("The GDP overview CSV has no nominal_gel rows");

  // 1. The sector table's GDP total is the same series, digit for digit.
  for (const row of sectors) {
    if (row.series_id !== "economy.gdp_total" || row.measure !== "nominal") continue;
    const year = Number(row.year);
    const reference = nominal.get(year);
    comparisons += 1;
    if (!reference) {
      problems.push(`economy.gdp_total ${year} has no nominal_gel counterpart`);
      continue;
    }
    if (
      !new Decimal(row.value!)
        .toDecimalPlaces(SECTOR_GDP_DECIMAL_PLACES)
        .eq(reference.toDecimalPlaces(SECTOR_GDP_DECIMAL_PLACES))
    ) {
      problems.push(
        `economy.gdp_total ${year} is ${row.value}, nominal_gel is ${reference.toFixed()}`,
      );
    }
  }

  // 2. The budget denominator is the same series rounded to 0.1 mln GEL.
  for (const row of national) {
    const year = Number(row.year);
    const reference = nominal.get(year);
    comparisons += 1;
    if (!reference) {
      problems.push(`national GDP ${year} has no nominal_gel counterpart`);
      continue;
    }
    const rounded = reference.div(1_000_000).toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
    if (!rounded.eq(new Decimal(row.gdp_current_prices_million_gel!))) {
      problems.push(
        `national GDP ${year} is ${row.gdp_current_prices_million_gel} mln GEL, nominal_gel rounds to ${rounded.toFixed(1)}`,
      );
    }
  }

  // 3. The one Geostat workbook is archived twice; both copies must be identical.
  const overviewCopy = overviewManifest.files.find((entry) =>
    entry.file.endsWith("geostat_nominal_current.xlsx"),
  );
  const nationalCopy = nationalManifest.find((row) =>
    row.local_file?.endsWith("03_GDP-at-Current-Prices.xlsx"),
  );
  comparisons += 1;
  if (!overviewCopy || !nationalCopy) {
    problems.push("Cannot find both archived copies of 03_GDP-at-Current-Prices.xlsx");
  } else if (
    overviewCopy.sha256.toLowerCase() !== nationalCopy.sha256!.toLowerCase() ||
    String(overviewCopy.bytes) !== nationalCopy.bytes
  ) {
    problems.push(
      `The two archived copies of 03_GDP-at-Current-Prices.xlsx differ: ${overviewCopy.sha256}/${overviewCopy.bytes} and ${nationalCopy.sha256}/${nationalCopy.bytes}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(`Nominal GDP artifacts disagree:\n${problems.join("\n")}`);
  }
  return { years: [...nominal.keys()].sort((left, right) => left - right), comparisons };
}
