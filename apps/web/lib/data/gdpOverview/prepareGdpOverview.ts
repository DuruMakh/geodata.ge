import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import Decimal from "decimal.js";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";
import { csvEscape } from "../csvEscape";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { GDP_SERIES, type GdpObservation, type GdpSeriesId } from "./types";

export const GDP_SOURCE_ROOT = path.resolve(
  process.cwd(),
  "../../docs/Raw Data/Economy/gdp-overview",
);
const reviewed = "2026-09-11";
import { validateGdpObservations } from "./validation";
export { validateGdpObservations } from "./validation";

type GdpSourceManifest = {
  files: {
    file: string;
    sha256: string;
    bytes: number;
    preliminary_years?: number[];
  }[];
};

/**
 * Which Geostat years are still preliminary is a property of the archived
 * edition, so it is declared in the manifest beside the hash rather than
 * written into this script as a year.
 */
export function geostatPreliminaryYears(manifest: GdpSourceManifest): Set<number> {
  return new Set(manifest.files.flatMap((entry) => entry.preliminary_years ?? []));
}

export async function prepareGdpOverview(sourceRoot = GDP_SOURCE_ROOT) {
  const manifest = JSON.parse(
    await fs.readFile(path.join(sourceRoot, "source-manifest.json"), "utf8"),
  ) as GdpSourceManifest;
  const buffers = new Map<string, Buffer>();
  const sourceHashes: Record<string, string> = {};
  for (const entry of manifest.files) {
    const bytes = await fs.readFile(path.join(sourceRoot, entry.file));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== entry.sha256 || bytes.length !== entry.bytes)
      throw new Error(`GDP source hash mismatch: ${entry.file}`);
    buffers.set(path.basename(entry.file), bytes);
    sourceHashes[entry.file] = hash;
  }
  const preliminary = geostatPreliminaryYears(manifest);
  const facts: GdpObservation[] = [];
  function add(
    seriesId: GdpSeriesId,
    year: number,
    value: string,
    sourceId: string,
    sourceLocator: string,
    accountingStandard: GdpObservation["accountingStandard"] = null,
  ) {
    facts.push({
      seriesId,
      year,
      value,
      unit: GDP_SERIES[seriesId].unit,
      status: accountingStandard && preliminary.has(year) ? "preliminary" : "published",
      accountingStandard,
      sourceId,
      sourceLocator,
      lastReviewedAt: reviewed,
    });
  }
  for (const [code, id] of [
    ["NY.GDP.MKTP.KD", "real_usd_2015"],
    ["NY.GDP.MKTP.KD.ZG", "real_growth_percent"],
  ] as const) {
    const response = JSON.parse(buffers.get(`${code}.json`)!.toString("utf8"));
    if (response[0].pages !== 1 || response[0].sourceid !== "2")
      throw new Error("Unexpected World Bank response metadata");
    for (const row of response[1]) {
      if (
        row.indicator.id !== code ||
        row.countryiso3code !== "GEO" ||
        row.country.value !== "Georgia"
      )
        throw new Error("World Bank country/indicator mismatch");
      if (row.value === null) continue;
      add(
        id,
        Number(row.date),
        new Decimal(String(row.value)).toFixed(),
        `source.wb_gdp_${id}`,
        `GEO/${code}/${row.date}`,
      );
    }
  }
  const fx: Record<number, number> = {};
  for (const [filename, first, last, standard] of [
    ["geostat_nominal_legacy.xlsx", 1996, 2009, "sna_1993"],
    ["geostat_nominal_current.xlsx", 2010, null, "sna_2008"],
  ] as const) {
    const book = XLSX.read(buffers.get(filename), { type: "buffer" });
    const name = book.SheetNames[0],
      sheet = book.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
    const find = (text: string) => {
      const index = rows.findIndex((row) =>
        row.some((v) => String(v).includes(text)),
      );
      if (index < 0) throw new Error(`GDP source row missing: ${text}`);
      return index;
    };
    const mappings: [GdpSeriesId, number, number][] = [
      ["nominal_gel", find("(=) GDP at market prices"), 1e6],
      ["nominal_usd", find("GDP in mil. USD"), 1e6],
      ["per_capita_gel", find("GDP per capita in GEL"), 1],
      ["per_capita_usd", find("GDP per capita, USD"), 1],
    ];
    const fxRow = find("Exchange rate");
    rows[1].forEach((header, column) => {
      const match = /^(\d{4})(\*)?$/.exec(String(header));
      if (!match) return;
      const year = Number(match[1]);
      if (year < first || (last !== null && year > last)) return;
      if (preliminary.has(year) !== Boolean(match[2]))
        throw new Error("Geostat preliminary header mismatch");
      fx[year] = Number(rows[fxRow][column]);
      for (const [id, row, scale] of mappings) {
        const raw = rows[row][column];
        if (typeof raw !== "number" || !Number.isFinite(raw))
          throw new Error("Invalid Geostat numeric cell");
        add(
          id,
          year,
          new Decimal(String(raw)).times(scale).toFixed(),
          `source.geostat_national_gdp_${standard}`,
          `${name}!${XLSX.utils.encode_cell({ r: row, c: column })}`,
          standard,
        );
      }
    });
  }
  validateGdpObservations(facts);
  facts.sort((a, b) => a.seriesId.localeCompare(b.seriesId) || a.year - b.year);
  const value = (id: GdpSeriesId, year: number) => {
    const observation = facts.find((fact) => fact.seriesId === id && fact.year === year);
    if (!observation) throw new Error(`Missing GDP observation ${id}:${year}`);
    return Number(observation.value);
  };
  let maxGrowthError = 0;
  for (const year of facts
    .filter((fact) => fact.seriesId === "real_growth_percent")
    .map((fact) => fact.year)) {
    maxGrowthError = Math.max(
      maxGrowthError,
      Math.abs(
        (value("real_usd_2015", year) / value("real_usd_2015", year - 1) - 1) * 100 -
          value("real_growth_percent", year),
      ),
    );
  }
  if (maxGrowthError > 1e-7)
    throw new Error("World Bank growth/level mismatch");
  for (const year of facts.filter((fact) => fact.seriesId === "nominal_gel").map((fact) => fact.year))
    for (const [gel, usd] of [
      ["nominal_gel", "nominal_usd"],
      ["per_capita_gel", "per_capita_usd"],
    ] as const) {
      if (!Number.isFinite(fx[year]) || Math.abs(value(gel, year) / fx[year] - value(usd, year)) > 1)
        throw new Error(`Geostat currency mismatch ${year}`);
    }
  const denominator = parse(
    await fs.readFile(
      path.resolve(
        process.cwd(),
        "../../data/imports/national-gdp-annual-1996-2025.csv",
      ),
      "utf8",
    ),
    { columns: true, bom: true },
  ) as Record<string, string>[];
  for (const row of denominator)
    if (
      Math.round(value("nominal_gel", Number(row.year)) / 1e5) / 10 !==
      Number(row.gdp_current_prices_million_gel)
    )
      throw new Error(`Budget denominator precision mismatch ${row.year}`);
  const counts = Object.fromEntries(
    Object.keys(GDP_SERIES).map((id) => [
      id,
      facts.filter((f) => f.seriesId === id).length,
    ]),
  );
  return {
    facts,
    validation: {
      status: "PASS" as const,
      counts,
      sourceHashes,
      budgetDenominatorUnchanged: true,
      maxGrowthErrorPercentagePoints: maxGrowthError,
    },
  };
}

export async function writeGdpOverviewArtifacts(write: boolean) {
  const result = await prepareGdpOverview();
  const headers = [
    "series_id",
    "year",
    "value",
    "unit",
    "status",
    "accounting_standard",
    "source_id",
    "source_locator",
    "last_reviewed_at",
  ];
  const csv =
    "\uFEFF" +
    [
      headers.join(","),
      ...result.facts.map((f) =>
        [
          f.seriesId,
          f.year,
          f.value,
          f.unit,
          f.status,
          f.accountingStandard ?? "",
          f.sourceId,
          f.sourceLocator,
          f.lastReviewedAt,
        ]
          .map(csvEscape)
          .join(","),
      ),
    ].join("\n") +
    "\n";
  for (const [file, content] of [
    ["data/imports/gdp-overview-annual.csv", csv],
    [
      "data/reports/gdp-overview-validation.json",
      JSON.stringify(result.validation, null, 2) + "\n",
    ],
  ]) {
    const target = path.resolve(process.cwd(), "../..", file);
    if (write) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, content);
    } else
      await assertGeneratedArtifactMatches("GDP overview", target, content);
  }
  return result.validation;
}
