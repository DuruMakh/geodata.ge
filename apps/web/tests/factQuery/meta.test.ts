import { beforeAll, describe, expect, it } from "vitest";
import { testSnapshot } from "../helpers/factQuerySnapshot";
import { compare } from "../../lib/factQuery/compare";
import { getSources } from "../../lib/factQuery/getSources";
import { queryMunicipal } from "../../lib/factQuery/queryMunicipal";
import { buildResponseMeta } from "../../lib/factQuery/meta";
import { rank } from "../../lib/factQuery/rank";
import type { Comparison } from "../../lib/factQuery/compare";
import type { GetSourcesData } from "../../lib/factQuery/getSources";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = testSnapshot({ releaseCommit: "test", generatedAt: "2026-09-02T00:00:00.000Z" });
});

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), "utf8");

describe("response meta carries only the evidence behind the answer", () => {
  // Measured before the fix: this exact call returned 80.0 KiB, of which 77.9 KiB
  // was meta.sources - one source carrying all 75 municipal workbooks, when the
  // single returned row cites 2 of them. Narrowing takes it to 4.4 KiB.
  it("narrows meta.sources[].documents to the documents the rows cite", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["11"],
      seriesIds: ["municipal.total"],
      years: [2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const cited = new Set(
      (result.data as { observations: { documentIds: string[] }[] }).observations.flatMap((o) => o.documentIds),
    );
    const carried = result.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId));

    expect(carried.length).toBeGreaterThan(0);
    expect([...new Set(carried)].sort()).toEqual([...cited].sort());
    expect(bytes(result)).toBeLessThan(8 * 1024);
  });

  // Narrowing points at the right original; it never hides provenance. Same
  // contract resolveDocumentIds states: a cited source must always show
  // something a reader can open.
  it("never leaves a cited source with zero documents", () => {
    const result = queryMunicipal(snapshot, {
      entityIds: ["region.adjara"],
      seriesIds: ["municipal.total"],
      years: [2016, 2020, 2024],
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    for (const source of result.meta.sources) {
      const archived = snapshot.sources.find((s) => s.sourceId === source.sourceId);
      if (archived === undefined || archived.documents.length === 0) continue;
      expect(source.documents.length, `${source.sourceId} was narrowed to nothing`).toBeGreaterThan(0);
    }
  });

  it("narrows a comparison to the documents behind its two endpoints", () => {
    const result = compare(snapshot, {
      target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
      fromYear: 2016,
      toYear: 2024,
      measure: "amount_gel",
    });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const comparisons = (result.data as { comparisons: Comparison[] }).comparisons;
    const cited = new Set(comparisons.flatMap((c) => [...c.from.documentIds, ...c.to.documentIds]));
    const carried = new Set(result.meta.sources.flatMap((source) => source.documents.map((d) => d.documentId)));

    expect(carried.size).toBeGreaterThan(0);
    expect([...carried].sort()).toEqual([...cited].sort());
  });

  // getSources' whole purpose is to return documents. Narrowing must not touch it.
  it("leaves getSources' own document listing intact", () => {
    const sourceId = "source.municipal_mof_annual_and_history_workbooks";
    const result = getSources(snapshot, { sourceIds: [sourceId] });
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const archived = snapshot.sources.find((s) => s.sourceId === sourceId);
    expect(archived).toBeDefined();
    expect(result.meta.sources[0]!.documents.length).toBe(archived!.documents.length);
  });
});

// A ranking over every municipality reads every municipality's workbook, but it
// shows only a few rows. Rows it shows carry the full record of each document
// behind them; the other inputs are named by id (`inputDocumentIds`), so nothing
// the ranking read is dropped and nothing it merely used to order is spelled out.
// What remains in full still states once what its documents agree on.
describe("a source states once what all of its documents agree on", () => {
  const rankAllMunicipalities = () =>
    rank(snapshot, {
      datasetId: "municipal-expenditure",
      dimension: "entities",
      entityType: "municipality",
      seriesId: "municipal.total",
      year: 2025,
      measure: "amount_gel",
      metric: "value",
      order: "descending",
      limit: 5,
    });

  it("hoists a field every document shares and removes it from each of them", () => {
    const result = rankAllMunicipalities();
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const source = result.meta.sources.find((s) => s.documents.length > 1);
    expect(source).toBeDefined();
    // Every municipal workbook comes from the same ministry under the same licence.
    expect(source!.documentDefaults?.publisher).toBe("საქართველოს ფინანსთა სამინისტრო");
    for (const document of source!.documents) {
      expect(document).not.toHaveProperty("publisher");
      expect(document).not.toHaveProperty("licenceId");
    }
  });

  // The fields that identify WHICH document this is must never move.
  it("keeps the identifying fields on every document", () => {
    const result = rankAllMunicipalities();
    if (result.kind === "error") throw new Error(result.error.messageEn);

    for (const source of result.meta.sources) {
      for (const document of source.documents) {
        expect(typeof document.documentId).toBe("string");
        expect(typeof document.title).toBe("string");
        expect(typeof document.titleKa).toBe("string");
        expect(typeof document.titleEn).toBe("string");
        expect(Array.isArray(document.years)).toBe(true);
        expect(document.archiveUrl ?? document.officialUrl).not.toBeNull();
      }
    }
  });

  // Integrity metadata answers "do these bytes match", which is get_sources'
  // question. It stays there and in the published sources.json.
  it("drops sha256 and byteSize from the response envelope but not from getSources", () => {
    const ranked = rankAllMunicipalities();
    if (ranked.kind === "error") throw new Error(ranked.error.messageEn);
    for (const source of ranked.meta.sources) {
      for (const document of source.documents) {
        expect(document).not.toHaveProperty("sha256");
        expect(document).not.toHaveProperty("byteSize");
      }
    }

    const listed = getSources(snapshot, { sourceIds: ["source.municipal_mof_annual_and_history_workbooks"] });
    if (listed.kind === "error") throw new Error(listed.error.messageEn);
    const first = (listed.data as GetSourcesData).sources[0]!.documents[0]!;
    expect(first.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(first.byteSize).toBeGreaterThan(0);
  });

  // A field the documents disagree about is not shared, so it cannot be stated
  // once. `years` differs here: 64 history workbooks span 2016-2025, the 2025
  // functional classification covers one year.
  it("leaves a field the documents disagree about on each document", () => {
    const result = rankAllMunicipalities();
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const source = result.meta.sources.find((s) => s.documents.length > 1)!;
    const spans = new Set(source.documents.map((d) => JSON.stringify(d.years)));
    expect(spans.size).toBeGreaterThan(1);
    expect(source.documentDefaults).not.toHaveProperty("years");
  });

  it("names every document it read, invents none, and gives the full record only for the rows it shows", () => {
    const result = rankAllMunicipalities();
    if (result.kind === "error") throw new Error(result.error.messageEn);

    const full = result.meta.sources.flatMap((s) => s.documents.map((d) => d.documentId));
    const inputs = result.meta.sources.flatMap((s) => (s as { inputDocumentIds?: string[] }).inputDocumentIds ?? []);
    const cited = [...full, ...inputs];
    const archived = new Set(
      result.meta.sources.flatMap((s) => snapshot.sources.find((a) => a.sourceId === s.sourceId)!.documents.map((d) => d.documentId)),
    );

    // A ranking over every municipality genuinely reads every municipality's
    // workbook, so it still names them - one entry each, none repeated, none
    // invented - but only the documents behind the 5 shown rows (and any
    // document every candidate cites) are given in full.
    expect(cited.length).toBeGreaterThan(60);
    expect(new Set(cited).size).toBe(cited.length);
    for (const documentId of cited) expect(archived.has(documentId)).toBe(true);
    expect(inputs.length).toBeGreaterThan(40);
    expect(full.length).toBeLessThan(cited.length / 2);

    // The original 45 KB ceiling covered Georgian-only titles. Bilingual
    // evidence necessarily adds per-document titles; verify at least 40%
    // saving against the evidence a ranking used to carry: every document it
    // read, in full, with nothing shared. The full records still reassemble
    // exactly from the shared fields plus their own.
    const previous = result.meta.sources.map(source => {
      const original = snapshot.sources.find(row => row.sourceId === source.sourceId)!;
      const ids = new Set([...source.documents.map(document => document.documentId), ...((source as { inputDocumentIds?: string[] }).inputDocumentIds ?? [])]);
      for (const document of source.documents) {
        const { sha256: _hash, byteSize: _size, ...whole } = original.documents.find(row => row.documentId === document.documentId)!;
        expect({ ...source.documentDefaults, ...document }).toEqual(whole);
      }
      return { ...original, documents: original.documents.filter(row => ids.has(row.documentId)).map(({ sha256: _hash, byteSize: _size, ...whole }) => whole) };
    });
    expect(bytes(result.meta.sources)).toBeLessThan(bytes(previous) * 0.6);
    expect(bytes(result.meta.sources)).toBeLessThan(64 * 1024);
  });
});

describe("buildResponseMeta input-only documents", () => {
  const document = (documentId: string) => ({
    documentId, title: documentId, titleKa: documentId, titleEn: documentId, documentLanguage: "ka" as const,
    officialUrl: null, archiveUrl: null, years: [2025], publisher: "p", publisherKa: "p", publisherEn: "p",
    attribution: null, attributionKa: null, attributionEn: null, licenceId: null, mediaType: "m", retrievedAt: "2026-01-01",
    datasetId: null, role: "primary" as const, sha256: "a".repeat(64), byteSize: 1,
  });
  const source = (sourceId: string, ids: string[]) => ({
    sourceId, name: sourceId, nameKa: sourceId, nameEn: sourceId, derivationKa: null, derivationEn: null,
    lastReviewedAt: "2026-01-01", derivation: null, documents: ids.map(document),
  });

  it("moves input-only documents to ids on their source and keeps cited ones in full", () => {
    const meta = buildResponseMeta(snapshot, {
      sources: [source("s.a", ["d1", "d2", "d3"])],
      citedDocumentIds: ["d1"],
      inputOnlyDocumentIds: ["d2", "d3"],
    });
    expect(meta.sources[0]!.documents.map((d) => d.documentId)).toEqual(["d1"]);
    expect(meta.sources[0]!.inputDocumentIds).toEqual(["d2", "d3"]);
  });

  it("leaves a source with only input documents holding documents: [] and its ids", () => {
    const meta = buildResponseMeta(snapshot, {
      sources: [source("s.a", ["d1"]), source("s.b", ["d2", "d3"])],
      citedDocumentIds: ["d1"],
      inputOnlyDocumentIds: ["d2", "d3"],
    });
    expect(meta.sources[1]!.documents).toEqual([]);
    expect(meta.sources[1]!.inputDocumentIds).toEqual(["d2", "d3"]);
    expect(meta.sources[0]!).not.toHaveProperty("inputDocumentIds");
  });

  it("is unchanged when no input-only documents are supplied", () => {
    const meta = buildResponseMeta(snapshot, { sources: [source("s.a", ["d1", "d2"])], citedDocumentIds: ["d1"] });
    expect(meta.sources[0]!.documents.map((d) => d.documentId)).toEqual(["d1"]);
    expect(meta.sources[0]!).not.toHaveProperty("inputDocumentIds");
  });
});
