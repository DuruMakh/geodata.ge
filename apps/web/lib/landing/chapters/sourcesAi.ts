import { TOOLS } from "../../mcp/tools";
import type { MethodologyHubEntry } from "../../methodology/types";
import type { HomeChapters } from "./types";

// The sources table is the methodology hub's own entries, in its order; the AI
// section lists the read-only MCP tools by name.

export function buildSourceRows(entries: MethodologyHubEntry[], reviewedAt: string): HomeChapters["sources"] {
  const rows = entries.map((entry) => ({
    name: entry.title,
    firstYear: entry.coverage.firstYear,
    lastYear: entry.coverage.lastYear,
    files: entry.originalFileCount,
  }));
  return { rows, totalFiles: rows.reduce((sum, row) => sum + row.files, 0), reviewedAt };
}

export function toolNames(): string[] {
  return TOOLS.map((tool) => tool.name);
}
