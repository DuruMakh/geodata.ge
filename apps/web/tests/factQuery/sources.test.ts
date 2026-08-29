// apps/web/tests/factQuery/sources.test.ts
import { describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { selectSources } from "../../lib/factQuery/sources";

const OPTIONS = { releaseCommit: "test-commit", generatedAt: "2026-08-28T00:00:00.000Z" };

describe("public source resolution", () => {
  it("never emits an internal repository path as a public url", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    expect(snapshot.sources.length).toBeGreaterThan(0);

    for (const source of snapshot.sources) {
      for (const document of source.documents) {
        for (const url of [document.officialUrl, document.archiveUrl]) {
          if (url === null) continue;
          expect(url).toMatch(/^https:\/\//);
          expect(url).not.toContain("docs/Raw Data");
        }
      }
    }
  });

  it("never emits a sentinel source id", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    for (const source of snapshot.sources) {
      expect(source.sourceId).not.toMatch(/^mixed:/);
      expect(source.sourceId.length).toBeGreaterThan(0);
    }
  });

  it("resolves every source id referenced by a served national fact", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const known = new Set(snapshot.sources.map((s) => s.sourceId));
    const referenced = new Set(snapshot.national.facts.flatMap((f) => f.sourceId.split(";").map((s) => s.trim())));

    expect([...referenced].filter((id) => !known.has(id))).toEqual([]);
  });

  it("returns only the requested sources, deduplicated and ordered", async () => {
    const snapshot = await buildFactQuerySnapshot(OPTIONS);
    const target = snapshot.sources[0]!.sourceId;

    const selected = selectSources(snapshot, [target, target, "source.does_not_exist"]);
    expect(selected.map((s) => s.sourceId)).toEqual([target]);
  });
});
