"use client";

import { useMemo, useState } from "react";
import { message } from "../../lib/i18n/messages";
import { useI18n } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { PublicSourceManifestRow } from "../../lib/methodology/publicSources";
import type { MethodologyArchiveSummary, MethodologyDatasetId } from "../../lib/methodology/types";

export type { PublicSourceManifestRow } from "../../lib/methodology/publicSources";

type SourceArchiveProps = {
  datasetId: MethodologyDatasetId;
  datasetLabel: string;
  rows: readonly PublicSourceManifestRow[];
  summary: MethodologyArchiveSummary;
};

function formatLabel(row: PublicSourceManifestRow) {
  const extension = row.official_filename.split(".").at(-1);
  return extension ? extension.toUpperCase() : row.media_type;
}

function formatBytes(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function SourceArchive({ datasetId, datasetLabel, rows, summary }: SourceArchiveProps) {
  const { locale, messages } = useI18n();
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const years = useMemo(
    () => [...new Set(rows.flatMap((row) => row.years))].toSorted((left, right) => right - left),
    [rows],
  );
  const captionPeriod = year === null
    ? message(messages, "methodology.yearRange", { first: years.at(-1) ?? "", last: years[0] ?? "" })
    : message(messages, "methodology.yearValue", { year });
  const filteredRows = rows.filter(row =>
    (year === null || row.years.includes(year)) && matchesLabelQuery(query, [
      ...row.searchLabels, row.official_filename, formatLabel(row), row.year,
    ]),
  );

  return (
    <div data-testid="source-archive" className="mt-7">
      <div className="flex flex-wrap items-start justify-between gap-5 border-y border-[var(--ink)] py-5">
        <div>
          <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold">
            {message(messages, "methodology.archiveCount", { count: summary.fileCount })}
          </p>
          <p className="mt-1 font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[10px] text-[var(--muted)]">
            {formatBytes(summary.totalBytes)}
          </p>
        </div>
        <a
          href={`/downloads/methodology/${datasetId}/${datasetId}-original-sources.zip`}
          className="border border-[var(--ink)] px-4 py-2.5 text-[0.6875rem] font-semibold hover:bg-[var(--ink)] hover:text-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(179,64,42,0.4)]"
        >
          {message(messages, "methodology.archiveDownload")}
        </a>
      </div>

      {locale === "en" ? <p className="mt-4 max-w-[800px] text-[0.71875rem] leading-relaxed text-[var(--muted)]">{message(messages, "methodology.originalLanguageNote")}</p> : null}

      <div className="mt-8 grid gap-6 min-[760px]:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] min-[760px]:items-end">
        <label className="block">
          <span className="text-[0.6875rem] font-semibold text-[var(--muted)]">{message(messages, "methodology.archiveSearch")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={message(messages, "methodology.searchPlaceholder")}
            className="mt-2 block h-[34px] w-full border-0 border-b border-[var(--control)] bg-transparent px-0 text-[0.8125rem] outline-none placeholder:text-[var(--faint)] focus:border-[var(--accent)]"
          />
        </label>
        {/* Below 760px the years wrap onto more rows instead of scrolling sideways. */}
        <div data-testid="archive-year-filter" className="pb-1 min-[760px]:overflow-x-auto" aria-label={message(messages, "methodology.yearFilter")}>
          <div className="flex flex-wrap gap-2 min-[760px]:min-w-max min-[760px]:flex-nowrap">
            <button
              type="button"
              aria-pressed={year === null}
              onClick={() => setYear(null)}
              className="min-h-9 border-b px-2 text-[0.6875rem] font-semibold aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
            >
              {message(messages, "methodology.allYears")}
            </button>
            {years.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={year === candidate}
                onClick={() => setYear(candidate)}
                className="min-h-9 border-b px-2 font-[family-name:var(--font-numeric)] text-[0.6875rem] aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Below 760px the same rows render as stacked blocks — year, title, file
          name, publisher, then a full-width download link showing format and
          size. The 760px table only scrolled sideways there and hid the links. */}
      <div className="mt-7 border-t-2 border-[var(--ink)] min-[760px]:overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.71875rem] max-[759px]:block min-[760px]:min-w-[760px]">
          <caption className="sr-only">{message(messages, "methodology.archiveCaption", { dataset: datasetLabel, period: captionPeriod })}</caption>
          <thead className="max-[759px]:hidden">
            <tr className="border-b border-[var(--ink)] text-[0.6875rem] min-[768px]:text-[9.5px] uppercase tracking-[0.05em] text-[var(--muted)]">
              <th className="px-2 py-3 font-semibold">{message(messages, "methodology.year")}</th>
              <th className="px-2 py-3 font-semibold">{message(messages, "methodology.file")}</th>
              <th className="px-2 py-3 font-semibold">{message(messages, "methodology.format")}</th>
              <th className="px-2 py-3 font-semibold">{message(messages, "methodology.size")}</th>
              <th className="px-2 py-3 font-semibold">{message(messages, "methodology.download")}</th>
            </tr>
          </thead>
          <tbody className="max-[759px]:block">
            {filteredRows.map((row) => {
              const format = formatLabel(row);
              return (
                <tr key={row.source_id} data-testid="source-archive-row" className="border-b border-[var(--hairline-soft)] align-top max-[759px]:block max-[759px]:py-4">
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)] max-[759px]:block max-[759px]:p-0 max-[759px]:text-[0.6875rem] max-[759px]:text-[var(--muted)]">{row.year}</td>
                  <td className="max-w-[320px] px-2 py-4 max-[759px]:block max-[759px]:max-w-none max-[759px]:p-0 max-[759px]:pt-1">
                    <span className="block font-semibold text-[var(--ink)] max-[759px]:text-[0.8125rem] max-[759px]:leading-snug">{row.title}</span>
                    <span lang={/\p{Script=Georgian}/u.test(row.official_filename) ? "ka" : undefined} data-original-language="filename" data-source-id={row.source_id} className="mt-1 block break-all font-[family-name:var(--font-numeric)] text-[0.6875rem] min-[768px]:text-[9.5px] text-[var(--muted)]">
                      {row.official_filename}
                    </span>
                    <span className="mt-1 block text-[0.6875rem] min-[768px]:text-[10px] text-[var(--faint)] max-[759px]:text-[0.6875rem]">{row.publisher}</span>
                    {row.documentLanguage ? <span className="mt-1 block text-[0.6875rem] min-[768px]:text-[10px] text-[var(--faint)] max-[759px]:text-[0.6875rem]">{message(messages, "methodology.documentLanguage", { language: message(messages, `methodology.language${row.documentLanguage === "ka" ? "Ka" : row.documentLanguage === "en" ? "En" : "Mul"}`) })}</span> : null}
                  </td>
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)] max-[759px]:hidden">{format}</td>
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)] max-[759px]:hidden">{formatBytes(row.byte_size)}</td>
                  <td className="px-2 py-4 max-[759px]:block max-[759px]:p-0 max-[759px]:pt-3">
                    <a
                      href={row.downloadHref}
                      aria-label={message(messages, "methodology.downloadFile", { title: row.title, format })}
                      className="font-semibold text-[var(--accent)] underline underline-offset-4 hover:text-[var(--ink)] max-[759px]:flex max-[759px]:min-h-11 max-[759px]:w-full max-[759px]:items-center max-[759px]:justify-between max-[759px]:gap-3 max-[759px]:border max-[759px]:border-[var(--ink)] max-[759px]:px-3 max-[759px]:text-[0.75rem] max-[759px]:no-underline"
                    >
                      <span>{message(messages, "methodology.downloadArrow")}</span>
                      <span className="font-[family-name:var(--font-numeric)] text-[0.6875rem] font-normal min-[760px]:hidden">{format} · {formatBytes(row.byte_size)}</span>
                    </a>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 ? (
              <tr className="max-[759px]:block">
                <td colSpan={5} data-testid="source-archive-empty" className="py-12 text-center text-[0.8125rem] text-[var(--muted)] max-[759px]:block">
                  {message(messages, "methodology.empty")}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 text-[0.6875rem]">
        <span className="text-[var(--muted)]">{message(messages, "methodology.manifest")}</span>
        <a
          href={`/downloads/methodology/${datasetId}/manifest.csv`}
          aria-label={message(messages, "methodology.manifestDownload", { format: "CSV" })}
          className="inline-flex min-h-11 items-center text-[var(--accent)] underline underline-offset-4"
        >
          CSV ↓
        </a>
        <a
          href={`/downloads/methodology/${datasetId}/manifest.json`}
          aria-label={message(messages, "methodology.manifestDownload", { format: "JSON" })}
          className="inline-flex min-h-11 items-center text-[var(--accent)] underline underline-offset-4"
        >
          JSON ↓
        </a>
      </div>
    </div>
  );
}
