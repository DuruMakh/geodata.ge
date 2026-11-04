"use client";

import { crawlTables } from "../../lib/explorer/crawlTables";
import type { WorkbookExportModel } from "../../lib/explorer/workbookModel";
import { useI18n } from "../../lib/i18n/provider";
import { workbookMessage } from "../../lib/i18n/workbook";

/** Every series of a chart page as plain tables, hidden from visitors, so crawlers read the numbers. */
export function CrawlTables({ models }: { models: readonly WorkbookExportModel[] }) {
  const { locale, messages } = useI18n();
  const tables = crawlTables(models, messages);
  if (tables.length === 0) return null;
  const category = workbookMessage(locale, "workbook.category");
  return (
    <div hidden data-testid="crawl-tables">
      {tables.map((table, index) => (
        <table key={index}>
          <caption>{table.caption}</caption>
          <thead>
            <tr>
              <th>{category}</th>
              {table.columns.map((column) => <th key={column}>{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th>{row.label}</th>
                {row.cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
}
