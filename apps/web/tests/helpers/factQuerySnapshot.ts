// apps/web/tests/helpers/factQuerySnapshot.ts
//
// The fact-query snapshot the query and MCP unit tests read. Building it takes
// several seconds, and dozens of files used to build the identical snapshot for
// themselves. They now share lib/factQuery/generated/snapshot.json, which
// `pretest` writes and tests/setup/freshFactQuerySnapshot.ts rebuilds when a
// file is run on its own and the snapshot is missing or stale.
//
// Reuses the route's loader, so tests read the same file with the same schema
// checks and parse it once per test file. Only releaseCommit and generatedAt
// (BuildSnapshotOptions) differ between builds, and neither enters dataVersion,
// so a test that needs particular values gets them as overrides.
import type { BuildSnapshotOptions } from "../../lib/factQuery/buildSnapshot";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

export function testSnapshot(overrides: Partial<BuildSnapshotOptions> = {}): FactQuerySnapshot {
  return { ...loadPackagedSnapshot(), ...overrides };
}
