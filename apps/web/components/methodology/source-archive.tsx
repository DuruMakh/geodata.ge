"use client";

import { useMemo, useState } from "react";
import type { ValidatedSourceManifestRow } from "../../lib/methodology/sourceManifest";
import type { MethodologyArchiveSummary, MethodologyDatasetId } from "../../lib/methodology/types";

export type PublicSourceManifestRow = Pick<
  ValidatedSourceManifestRow,
  | "source_id"
  | "year"
  | "years"
  | "source_organization"
  | "display_title_ka"
  | "official_filename"
  | "media_type"
  | "byte_size"
  | "sha256"
  | "retrieved_at"
  | "retrieved_at_basis"
  | "downloadHref"
>;

type SourceArchiveProps = {
  datasetId: MethodologyDatasetId;
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

function retrievalBasisLabel(basis: PublicSourceManifestRow["retrieved_at_basis"]) {
  if (basis === "repository_first_commit_proxy") {
    return "რეპოზიტორში პირველი დამატების თარიღი (მიახლოებითი)";
  }
  if (basis === "source_manifest") return "წყაროს მანიფესტში მითითებული თარიღი";
  return "ზუსტი მიღების თარიღი";
}

export function SourceArchive({ datasetId, rows, summary }: SourceArchiveProps) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const years = useMemo(
    () => [...new Set(rows.flatMap((row) => row.years))].toSorted((left, right) => right - left),
    [rows],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("ka-GE");
  const filteredRows = rows.filter((row) => {
    if (year !== null && !row.years.includes(year)) return false;
    const searchable = [
      row.display_title_ka,
      row.official_filename,
      row.source_organization,
      formatLabel(row),
      row.year,
    ]
      .join(" ")
      .toLocaleLowerCase("ka-GE");
    return searchable.includes(normalizedQuery);
  });

  return (
    <div data-testid="source-archive" className="mt-7">
      <div className="flex flex-wrap items-start justify-between gap-5 border-y border-[var(--ink)] py-5">
        <div>
          <p className="font-[family-name:var(--font-display)] text-[18px] font-semibold">
            {summary.fileCount} უცვლელი პირველწყარო
          </p>
          <p className="mt-1 font-[family-name:var(--font-numeric)] text-[10px] text-[var(--muted)]">
            {formatBytes(summary.totalBytes)} · უახლესი ჩანაწერის თარიღი {summary.latestRetrievedAt}
          </p>
          {(summary.proxyDateCount ?? 0) > 0 ? (
            <p
              data-testid="source-archive-proxy-disclosure"
              className="mt-3 max-w-[680px] text-[11.5px] leading-relaxed text-[var(--body)]"
            >
              {summary.proxyDateCount} ჩანაწერისთვის ნაჩვენებია ფაილის რეპოზიტორში პირველი დამატების
              მიახლოებითი თარიღი და არა პირველწყაროს ზუსტი მიღების თარიღი.
            </p>
          ) : null}
        </div>
        <a
          href={`/downloads/methodology/${datasetId}/${datasetId}-original-sources.zip`}
          className="border border-[var(--ink)] px-4 py-2.5 text-[11px] font-semibold hover:bg-[var(--ink)] hover:text-[var(--paper)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(179,64,42,0.4)]"
        >
          სრული არქივი · ZIP ↓
        </a>
      </div>

      <div className="mt-8 grid gap-6 min-[760px]:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.2fr)] min-[760px]:items-end">
        <label className="block">
          <span className="text-[11px] font-semibold text-[var(--muted)]">პირველწყაროს ძებნა</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mt-2 block w-full border-0 border-b border-[var(--control)] bg-transparent px-0 py-2 text-[13px] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <div className="overflow-x-auto pb-1" aria-label="წლის ფილტრი">
          <div className="flex min-w-max gap-2">
            <button
              type="button"
              aria-pressed={year === null}
              onClick={() => setYear(null)}
              className="min-h-9 border-b px-2 text-[11px] font-semibold aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
            >
              ყველა
            </button>
            {years.map((candidate) => (
              <button
                key={candidate}
                type="button"
                aria-pressed={year === candidate}
                onClick={() => setYear(candidate)}
                className="min-h-9 border-b px-2 font-[family-name:var(--font-numeric)] text-[11px] aria-pressed:border-[var(--accent)] aria-pressed:text-[var(--accent)]"
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-7 overflow-x-auto border-t-2 border-[var(--ink)]">
        <table className="w-full min-w-[1020px] border-collapse text-left text-[11.5px]">
          <thead>
            <tr className="border-b border-[var(--ink)] text-[9.5px] uppercase tracking-[0.05em] text-[var(--muted)]">
              <th className="px-2 py-3 font-semibold">წელი</th>
              <th className="px-2 py-3 font-semibold">პირველწყარო / ფაილი</th>
              <th className="px-2 py-3 font-semibold">ფორმატი</th>
              <th className="px-2 py-3 font-semibold">ზომა</th>
              <th className="px-2 py-3 font-semibold">თარიღი</th>
              <th className="px-2 py-3 font-semibold">SHA-256</th>
              <th className="px-2 py-3 font-semibold">ჩამოტვირთვა</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => {
              const format = formatLabel(row);
              return (
                <tr key={row.source_id} data-testid="source-archive-row" className="border-b border-[var(--hairline-soft)] align-top">
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)]">{row.year}</td>
                  <td className="max-w-[320px] px-2 py-4">
                    <span className="block font-semibold text-[var(--ink)]">{row.display_title_ka}</span>
                    <span className="mt-1 block break-all font-[family-name:var(--font-numeric)] text-[9.5px] text-[var(--muted)]">
                      {row.official_filename}
                    </span>
                    <span className="mt-1 block text-[10px] text-[var(--faint)]">{row.source_organization}</span>
                  </td>
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)]">{format}</td>
                  <td className="px-2 py-4 font-[family-name:var(--font-numeric)]">{formatBytes(row.byte_size)}</td>
                  <td
                    data-testid="source-archive-retrieval"
                    className="px-2 py-4 font-[family-name:var(--font-numeric)]"
                  >
                    <span className="block">{row.retrieved_at}</span>
                    <span className="mt-1 block max-w-[190px] font-[family-name:var(--font-ui)] text-[9.5px] leading-relaxed text-[var(--muted)]">
                      {retrievalBasisLabel(row.retrieved_at_basis)}
                    </span>
                  </td>
                  <td
                    data-testid="source-archive-sha256"
                    title={row.sha256}
                    className="max-w-[185px] break-all px-2 py-4 font-[family-name:var(--font-numeric)] text-[9px] leading-relaxed"
                  >
                    {row.sha256}
                  </td>
                  <td className="px-2 py-4">
                    <a
                      href={row.downloadHref}
                      aria-label={`${row.display_title_ka} — ${format} ჩამოტვირთვა`}
                      className="font-semibold text-[var(--accent)] underline underline-offset-4 hover:text-[var(--ink)]"
                    >
                      ჩამოტვირთვა ↓
                    </a>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} data-testid="source-archive-empty" className="py-12 text-center text-[13px] text-[var(--muted)]">
                  ვერაფერი მოიძებნა
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px]">
        <span className="text-[var(--muted)]">მანიფესტი:</span>
        <a
          href={`/downloads/methodology/${datasetId}/manifest.csv`}
          aria-label="პირველწყაროების მანიფესტი — CSV ჩამოტვირთვა"
          className="text-[var(--accent)] underline underline-offset-4"
        >
          CSV ↓
        </a>
        <a
          href={`/downloads/methodology/${datasetId}/manifest.json`}
          aria-label="პირველწყაროების მანიფესტი — JSON ჩამოტვირთვა"
          className="text-[var(--accent)] underline underline-offset-4"
        >
          JSON ↓
        </a>
      </div>
    </div>
  );
}
