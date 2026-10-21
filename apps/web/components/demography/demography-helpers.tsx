"use client";

import { formatInUnit, UNIT_PERSONS } from "../../lib/explorer/format";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { ExcelDownloadButton } from "../explorer/excel-download-button";

// Small pieces the demography pages share: the section rule, person counts, and the workbook download.

/** The rule and spacing every section below a demography explorer opens with. */
export const SECTION_CLASS = "mt-16 border-t-2 border-[var(--ink)] pt-[22px]";

export const persons = (value: number | null | undefined) => formatInUnit(value, UNIT_PERSONS);

/** A person count with its sign: `+1,204`, `−880`. */
export const signedPersons = (value: number | null | undefined) =>
  value === null || value === undefined ? persons(value) : `${value > 0 ? "+" : ""}${persons(value)}`;

/** Builds the workbook and saves it; the writer loads only on the first download. */
export async function saveWorkbook(build: () => WorkbookExportModel) {
  const { downloadWorkbook } = await import("../../lib/explorer/workbookWriter.client");
  await downloadWorkbook(build());
}

/** A section's always-enabled Excel download, in a column as wide as the series panel's. */
export function Download({ testId, build, className = "mt-4 w-full max-w-[260px]" }: { testId: string; build: () => WorkbookExportModel; className?: string }) {
  return (
    <div className={className}>
      <ExcelDownloadButton testId={testId} disabled={false} onDownload={() => saveWorkbook(build)} />
    </div>
  );
}
