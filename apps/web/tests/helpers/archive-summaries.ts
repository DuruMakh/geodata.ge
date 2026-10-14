import { vi } from "vitest";
import { LIVE_METHODOLOGY_IDS } from "../../lib/methodology/catalog";
import type * as PrepareArchives from "../../lib/methodology/prepareArchives";

/**
 * A `vi.mock` factory for lib/methodology/prepareArchives that answers `loadGeneratedArchiveSummaries` with one
 * validated summary per live article. The real report is written by `prebuild`, and CI runs the tests before the
 * build, so a fresh checkout has no report to read. Use it in a test that renders a methodology page but is not about
 * the archives:
 *
 *   vi.mock("../../lib/methodology/prepareArchives", async (importOriginal) =>
 *     (await import("../helpers/archive-summaries")).withValidatedArchiveSummaries(importOriginal));
 */
export async function withValidatedArchiveSummaries(importOriginal: <T>() => Promise<T>): Promise<typeof PrepareArchives> {
  const actual = await importOriginal<typeof PrepareArchives>();
  return {
    ...actual,
    loadGeneratedArchiveSummaries: vi.fn(async () =>
      Object.fromEntries(
        LIVE_METHODOLOGY_IDS.map((id) => [
          id,
          { fileCount: 1, totalBytes: 1, latestRetrievedAt: "2026-09-01", validated: true, status: "PASS", minYear: 2004, maxYear: 2025 },
        ]),
      ) as Awaited<ReturnType<typeof actual.loadGeneratedArchiveSummaries>>,
    ),
  };
}
