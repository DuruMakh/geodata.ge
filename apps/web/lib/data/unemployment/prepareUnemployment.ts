import fs from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { strFromU8, unzipSync } from "fflate";
import * as XLSX from "xlsx";
import Decimal from "decimal.js";
import { serializeBomCsvRows } from "../csvEscape";
import { readVerifiedPackageFile } from "../sourcePackage";
import { assertGeneratedArtifactMatches } from "../generatedArtifacts";
import { unemploymentObservationFromCsv } from "./importUnemployment";
import { assertCompleteUnemploymentCoverage, validateUnemploymentFacts } from "./validation";
import { REGIONAL_EMPLOYMENT_STATUS_FIRST_YEAR } from "./types";
import type { CsvRecord } from "../csv";

type Source = { source_id: string; local_file: string; sha256: string; bytes: number; retrieved_at: string };
export async function prepareUnemploymentData(repositoryRoot: string, mode: "write" | "check"): Promise<void> {
  const directory = path.join(repositoryRoot, "docs/Raw Data/Unemployment/geostat-labour-force-annual");
  const manifest: Source[] = JSON.parse(await fs.readFile(path.join(directory, "source-manifest.json"), "utf8"));
  const required = ["total", "sex", "settlement", "age", "region", "education", "long_term"].map(id => `geostat_lfs_annual_${id}`).concat("geostat_lfs_source_page", "geostat_lfs_metadata_2026");
  if (manifest.length !== required.length || new Set(manifest.map(s => s.source_id)).size !== required.length || required.some(id => !manifest.some(s => s.source_id === id))) throw new Error("Unemployment source inventory mismatch");
  const cells = new Map<string, string>();
  for (const source of manifest) {
    const { bytes } = await readVerifiedPackageFile(directory, source.local_file, source, `Unemployment source capture mismatch: ${source.local_file}`);
    if (!source.local_file.endsWith(".xlsx")) continue;
    const book = XLSX.read(bytes, { type: "buffer" });
    const xml = unzipSync(bytes);
    for (let i = 0; i < book.SheetNames.length; i++) {
      const sheetXml = strFromU8(xml[`xl/worksheets/sheet${i + 1}.xml`]);
      for (const match of sheetXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const address = /\br="([A-Z]+\d+)"/.exec(match[1])?.[1];
        const value = /<v>([^<]+)<\/v>/.exec(match[2])?.[1];
        if (address && value && book.Sheets[book.SheetNames[i]][address]?.t === "n") cells.set(`${source.source_id}:${book.SheetNames[i]}:${address}`, value);
      }
    }
  }
  const files = [["unemployment-annual.csv", "unemployment-annual.csv"], ["education-annual.csv", "unemployment-education-annual.csv"], ["long-term-unemployment-annual.csv", "unemployment-long-term-annual.csv"]];
  const outputs = await Promise.all(files.map(async ([original, canonical]) => {
    const content = await fs.readFile(path.join(directory, original), "utf8");
    const rows: CsvRecord[] = parse(content, { columns: true, bom: true, skip_empty_lines: true });
    const facts = rows.map(row => unemploymentObservationFromCsv(row, manifest.find(source => source.source_id === row.source_id)!.retrieved_at));
    for (const fact of facts) if (cells.get(`${fact.sourceId}:${fact.sourceSheet}:${fact.sourceCell}`) !== fact.value) throw new Error(`Unemployment source cell mismatch: ${fact.sourceId}:${fact.sourceSheet}:${fact.sourceCell}`);
    return { canonical, content, facts };
  }));
  const sourceRows: CsvRecord[] = parse(await fs.readFile(path.join(directory, "source-observations.csv"), "utf8"), { columns: true, bom: true, skip_empty_lines: true });
  const employmentRows = sourceRows.filter(row => (["national", "settlement"].includes(row.dimension) || row.dimension === "region" && row.role === "primary") && row.methodology_epoch === "ilo19_20" && ["hired", "self_employed", "unidentified_worker"].includes(row.indicator_id));
  for (const row of employmentRows) {
    const value = cells.get(`${row.source_id}:${row.source_sheet}:${row.source_cell}`);
    if (value === undefined || !new Decimal(value).eq(row.value)) throw new Error(`Unemployment source cell mismatch: ${row.source_id}:${row.source_sheet}:${row.source_cell}`);
  }
  const statusRows = employmentRows.filter(row => row.indicator_id !== "unidentified_worker");
  const headers = Object.keys(sourceRows[0]);
  outputs.push({ canonical: "unemployment-employment-status-annual.csv", content: serializeBomCsvRows([headers, ...statusRows.map(row => headers.map(header => row[header]))]), facts: statusRows.map(row => unemploymentObservationFromCsv(row, manifest.find(source => source.source_id === row.source_id)!.retrieved_at)) });
  const facts = outputs.flatMap(output => output.facts);
  for (const fact of facts.filter(f => (["national", "settlement"].includes(f.dimension) || f.dimension === "region" && f.year >= REGIONAL_EMPLOYMENT_STATUS_FIRST_YEAR) && f.indicatorId === "employed")) {
    const parts = employmentRows.filter(row => row.dimension === fact.dimension && row.group_id === fact.groupId && Number(row.year) === fact.year);
    if (parts.length !== 3 || parts.reduce((sum, row) => sum.plus(row.value), new Decimal(0)).minus(fact.value).abs().gt("0.000001")) throw new Error("Unemployment employment status does not reconcile with the official employed total");
  }
  validateUnemploymentFacts(facts); assertCompleteUnemploymentCoverage(facts);
  for (const output of outputs) {
    const target = path.join(repositoryRoot, "data/imports", output.canonical);
    if (mode === "write") { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, output.content, "utf8"); }
    else await assertGeneratedArtifactMatches("unemployment", target, output.content);
  }
}
