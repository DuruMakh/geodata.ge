import type { Locator } from "@playwright/test";

// The explorer table has two layouts (owner decision D5, 2026-10-07): series as rows
// with year columns, and, below 768px with up to three series, years as rows (newest
// first) with series as columns. These helpers read either one.

/** How many series the table shows. */
export function tableSeriesCount(table: Locator): Promise<number> {
  return table.evaluate((element) =>
    element.getAttribute("data-layout") === "rows"
      ? element.querySelectorAll("thead th[data-series-id]").length
      : element.querySelectorAll("tbody tr").length);
}

/** A series' cell texts, oldest year first; `label` matches part of the series name. */
export function tableSeriesValues(table: Locator, label: string): Promise<string[]> {
  return table.evaluate((element, name) => {
    const text = (cell: Element | null | undefined) => cell?.textContent?.trim() ?? "";
    if (element.getAttribute("data-layout") === "rows") {
      const column = [...element.querySelectorAll("thead th[data-series-id]")].findIndex((th) => text(th).includes(name));
      if (column < 0) return [];
      return [...element.querySelectorAll("tbody tr[data-year]")].reverse().map((row) => text(row.querySelectorAll("td")[column]));
    }
    const row = [...element.querySelectorAll("tbody tr")].find((tr) => text(tr.querySelector("td")).includes(name));
    return row ? [...row.querySelectorAll("td")].slice(1).map(text) : [];
  }, label);
}
