"use client";

import { useState } from "react";

/** Rows per page of a trade table of selected rows (DESIGN.md §28.2). */
export const TABLE_PAGE_ROWS = 25;

/** The page a table of `count` selected rows is on; a new selection starts again at its first page. */
export function useTablePage(selection: readonly string[], count: number) {
  const [paging, setPaging] = useState<{ selection: readonly string[]; page: number }>({ selection: [], page: 0 });
  const pageCount = Math.ceil(count / TABLE_PAGE_ROWS);
  const page = Math.min(paging.selection === selection ? paging.page : 0, Math.max(0, pageCount - 1));
  return {
    page,
    pageCount,
    setPage: (next: number) => setPaging({ selection, page: next }),
    pageItems: <T,>(items: readonly T[]) => items.slice(page * TABLE_PAGE_ROWS, (page + 1) * TABLE_PAGE_ROWS),
  };
}

/** `Selected · N · page / pages` with Previous / Next under a paged trade table (Products, Partners). */
export function TablePager({ label, summary, page, pageCount, onPage, previous, next, testIdPrefix }: {
  label: string;
  summary: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  previous: string;
  next: string;
  testIdPrefix: string;
}) {
  return <nav aria-label={label} className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--muted)]"><span>{summary} · {page + 1} / {pageCount}</span>{pageCount > 1 ? <div className="flex gap-5"><button type="button" data-testid={`${testIdPrefix}-previous`} disabled={page === 0} onClick={() => onPage(page - 1)} className="min-h-11 cursor-pointer disabled:opacity-35">{previous}</button><button type="button" data-testid={`${testIdPrefix}-next`} disabled={page + 1 === pageCount} onClick={() => onPage(page + 1)} className="min-h-11 cursor-pointer disabled:opacity-35">{next}</button></div> : null}</nav>;
}
