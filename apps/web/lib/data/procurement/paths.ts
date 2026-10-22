/** Where the collected procurement data lives: the project's private folder, never the public repository. */
export function procurementDataDir(): string {
  return process.env.PROCUREMENT_DATA_DIR ?? "/mnt/project-files/procurement-data";
}

const years = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Tender Monitor's tender files run to August 2026; its direct-purchase files stop in August 2025 (no 2026 file). */
export const TENDER_YEARS: readonly number[] = years(2016, 2026);
export const PURCHASE_YEARS: readonly number[] = years(2016, 2025);

export type SourceFile = { kind: "tenders" | "purchases"; year: number; url: string; zipPath: string; xlsxPath: string };

const ARCHIVE_URL = "https://tendermonitor.ge/uploads/archives";

function sourceFile(kind: SourceFile["kind"], year: number): SourceFile {
  // "simpified" is the site's own spelling.
  const name = `${kind === "tenders" ? "main" : "simpified"}_${year}`;
  return { kind, year, url: `${ARCHIVE_URL}/${name}.zip`, zipPath: `originals/${name}.zip`, xlsxPath: `originals/${name}.xlsx` };
}

export function sourceFiles(): SourceFile[] {
  return [...TENDER_YEARS.map(year => sourceFile("tenders", year)), ...PURCHASE_YEARS.map(year => sourceFile("purchases", year))];
}
