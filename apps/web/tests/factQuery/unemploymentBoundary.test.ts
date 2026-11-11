import { expect, test } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";

test("the MCP snapshot exposes exactly the Labour Force Survey sources the unemployment topic datasets cite", async () => {
  const snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-10-04T00:00:00.000Z" });
  const lfs = snapshot.sources.filter(source => source.sourceId.startsWith("source.geostat_lfs_")).map(source => source.sourceId).sort();
  const cited = new Set(snapshot.topics.datasets.filter(dataset => dataset.page.family === "unemployment").flatMap(dataset => dataset.columns.sources.flat()).map(index => snapshot.topics.sourceIds[index]!));
  expect(lfs).toEqual([...cited].sort());
  // The source page, the metadata and the unserved underutilisation workbook back no served figure.
  for (const id of ["source.geostat_lfs_source_page", "source.geostat_lfs_metadata_2026", "source.geostat_lfs_underuse"]) expect(lfs).not.toContain(id);
});
