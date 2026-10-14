import { expect, test } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";

test("human-only unemployment registration does not expose its sources in the MCP snapshot", async () => {
  const snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-10-04T00:00:00.000Z" });
  expect(snapshot.sources.filter(source => source.sourceId.startsWith("source.geostat_lfs_"))).toEqual([]);
});
