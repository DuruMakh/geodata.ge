// apps/web/tests/factQuery/getSources.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { getSources } from "../../lib/factQuery/getSources";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import type { GetSourcesData } from "../../lib/factQuery/getSources";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

const data = (result: ReturnType<typeof getSources>) => (result as { data: GetSourcesData }).data;
const errorOf = (result: ReturnType<typeof getSources>) =>
  (result as { error: { code: string; validChoices?: string[] } }).error;

describe("getSources", () => {
  it("accepts years covered only by product facts when narrowing product originals", () => {
    const sourceId = "source.geostat_product_yoy";
    const current = { ...snapshot, inflationProducts: { ...snapshot.inflationProducts, facts: [{ ...snapshot.inflationProducts.facts[0]!, period: "2035-01" }] }, sources: snapshot.sources.map(source => source.sourceId === sourceId ? { ...source, documents: source.documents.map(document => ({ ...document, years: [2035] })) } : source) };
    const result = getSources(current, { sourceIds: [sourceId], datasetId: "inflation-products", years: [2035] });
    expect(result.kind).toBe("sources");
    expect(data(result).sources[0]?.narrowingOutcome).toBe("applied");
    expect(data(result).sources[0]?.documents.every(document => document.years.includes(2035))).toBe(true);
  });
  it("returns a conforming sources envelope", () => {
    const result = getSources(snapshot, { sourceIds: ["source.mof_2017_revenue_form1_pdf"] });

    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("sources");
    expect(data(result).sources.length).toBe(1);
  });

  it("returns the document with its public urls and provenance", () => {
    const result = getSources(snapshot, { sourceIds: ["source.adjara_republic_budget_actual"] });
    const document = data(result).sources[0]?.documents.find(
      (d) => d.documentId === "source.adjara.republic.2015.actual_payments",
    );

    expect(document?.officialUrl).toBe("https://matsne.gov.ge/ka/document/download/3515842/2/ge/pdf");
    expect(document?.archiveUrl).toBe(
      "https://fiscal.ge/downloads/methodology/municipalities/files/2015/adjara-republic-actual-payments.pdf",
    );
    expect(document?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(document?.publisher.length).toBeGreaterThan(0);
    expect(document?.retrievedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("states a derived source's derivation and cites its upstream originals", () => {
    const result = getSources(snapshot, { sourceIds: ["source.adjara_consolidated_budget"] });
    const source = data(result).sources[0];

    expect(source?.derivation).not.toBeNull();
    expect((source?.derivation ?? "").length).toBeGreaterThan(0);
    expect(source?.documents.length).toBe(2);
  });

  it("leaves an ordinary source's derivation null", () => {
    const result = getSources(snapshot, { sourceIds: ["source.mof_2017_revenue_form1_pdf"] });
    expect(data(result).sources[0]?.derivation).toBeNull();
  });

  it("resolves several sources at once", () => {
    const ids = ["source.mof_2017_revenue_form1_pdf", "source.geostat_municipal_population"];
    const result = getSources(snapshot, { sourceIds: ids });

    expect(data(result).sources.map((s) => s.sourceId).sort()).toEqual([...ids].sort());
  });

  describe("unknown ids", () => {
    it("returns unknown_source rather than an empty success", () => {
      const result = getSources(snapshot, { sourceIds: ["source.not_a_real_source"] });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unknown_source");
    });

    it("suggests only ids the snapshot actually has, and never invents a url", () => {
      const result = getSources(snapshot, { sourceIds: ["source.mof_2017_revenue"] });
      const suggestions = errorOf(result).validChoices ?? [];
      const known = new Set(snapshot.sources.map((s) => s.sourceId));

      expect(suggestions.length).toBeGreaterThan(0);
      for (const suggestion of suggestions) expect(known.has(suggestion)).toBe(true);
      expect(suggestions).toContain("source.mof_2017_revenue_form1_pdf");
      expect(JSON.stringify(result)).not.toContain("http://");
    });

    it("bounds the suggestion list", () => {
      const result = getSources(snapshot, { sourceIds: ["source."] });
      expect((errorOf(result).validChoices ?? []).length).toBeLessThanOrEqual(10);
    });

    it("rejects the whole request when one of several ids is unknown", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.mof_2017_revenue_form1_pdf", "source.not_a_real_source"],
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unknown_source");
    });
  });

  describe("narrowing a grouped source", () => {
    const grouped = "source.municipal_mof_annual_and_history_workbooks";

    it("has many documents before narrowing", () => {
      const result = getSources(snapshot, { sourceIds: [grouped] });
      expect(data(result).sources[0]!.documentCount).toBeGreaterThan(10);
      expect(data(result).sources[0]!.narrowed).toBe(false);
      expect(data(result).narrowedBy).toBeNull();
    });

    it("narrows to one municipality's original workbook", () => {
      const result = getSources(snapshot, { sourceIds: [grouped], entityIds: ["11"] });
      const source = data(result).sources[0]!;

      expect(source.documents.length).toBeLessThan(source.documentCount);
      expect(source.narrowed).toBe(true);
      expect(source.documents.every((d) => d.documentId.endsWith("_11"))).toBe(true);
      expect(data(result).narrowedBy?.entityIds).toEqual(["11"]);
    });

    it("narrows by year", () => {
      const result = getSources(snapshot, { sourceIds: [grouped], years: [2020] });
      const source = data(result).sources[0]!;

      for (const document of source.documents) expect(document.years).toContain(2020);
    });

    it("does not hide provenance when a filter would leave nothing", () => {
      // A filter no document matches must not turn into "this figure has no
      // source" - the unnarrowed list comes back instead.
      const result = getSources(snapshot, { sourceIds: [grouped], datasetId: "national-revenue" });
      const source = data(result).sources[0]!;

      expect(source.documents.length).toBe(source.documentCount);
      expect(source.narrowed).toBe(false);
    });

    it("says WHICH of the three narrowing outcomes happened", () => {
      // narrowed alone could not distinguish these: it means "the list got
      // shorter", which the drop-the-filter fallback makes false by
      // construction. A caller asking for a year no document covers received a
      // document from another year, byte-identical to a genuine match.
      const notRequested = getSources(snapshot, { sourceIds: [grouped] });
      const applied = getSources(snapshot, { sourceIds: [grouped], years: [2020] });
      const dropped = getSources(snapshot, { sourceIds: [grouped], datasetId: "national-revenue" });

      expect(data(notRequested).sources[0]!.narrowingOutcome).toBe("not_requested");
      expect(data(applied).sources[0]!.narrowingOutcome).toBe("applied");
      expect(data(dropped).sources[0]!.narrowingOutcome).toBe("dropped_no_match");
    });

    it("distinguishes a real single-document match from a dropped filter", () => {
      const single = "source.mof_2017_revenue_form1_pdf";
      const match = getSources(snapshot, { sourceIds: [single], years: [2017] });
      const miss = getSources(snapshot, { sourceIds: [single], years: [2020] });

      // These two returned JSON-identical objects.
      expect(data(match).sources[0]!.narrowingOutcome).toBe("applied");
      expect(data(miss).sources[0]!.narrowingOutcome).toBe("dropped_no_match");
    });

    it("does not present an unscoped document as a dataset match", () => {
      // The Geostat municipal-population workbook carries no datasetId. It used
      // to be exempted from the filter and returned as a match for any dataset.
      const result = getSources(snapshot, {
        sourceIds: ["source.geostat_municipal_population"],
        datasetId: "national-revenue",
      });

      expect(data(result).sources[0]!.narrowingOutcome).toBe("dropped_no_match");
    });

    it("keeps a single-document source intact under narrowing", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.mof_2017_revenue_form1_pdf"],
        years: [2017],
      });

      expect(data(result).sources[0]?.documents.length).toBe(1);
    });
  });

  it("rejects a stale expectedDataVersion", () => {
    const result = getSources(snapshot, {
      sourceIds: ["source.mof_2017_revenue_form1_pdf"],
      expectedDataVersion: "0".repeat(64),
    });

    expect(result.kind).toBe("error");
    expect(errorOf(result).code).toBe("data_version_changed");
  });

  it("carries licence and data version in meta", () => {
    const meta = getSources(snapshot, { sourceIds: ["source.mof_2017_revenue_form1_pdf"] }).meta;

    expect(meta.licence).toBe("CC BY 4.0");
    expect(meta.dataVersion).toBe(snapshot.dataVersion);
  });

  describe("strict on every id namespace, not just source ids", () => {
    it("rejects an unknown entity id instead of returning the full list", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
        entityIds: ["not-a-code"],
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("unknown_entity");
      expect((errorOf(result).validChoices ?? []).length).toBeGreaterThan(0);
    });

    it("rejects a year outside coverage", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
        years: [1801],
      });

      expect(result.kind).toBe("error");
      expect(errorOf(result).code).toBe("year_out_of_range");
    });

    it("accepts a real municipality code and a covered year", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.municipal_mof_annual_and_history_workbooks"],
        entityIds: ["11"],
        years: [2020],
      });

      expect(result.kind).toBe("sources");
    });

    it("does not narrow a derived source away from its stated inputs", () => {
      const result = getSources(snapshot, {
        sourceIds: ["source.adjara_consolidated_budget"],
        years: [2020],
      });

      // Both upstreams stay: the derivation sentence describes a calculation
      // over both, so showing one would leave it unsupported.
      expect(data(result).sources[0]!.documents.length).toBe(2);
      expect(data(result).sources[0]!.narrowingOutcome).toBe("not_requested");
    });
  });
});

describe("years only the newer datasets reach", () => {
  it("does not report a covered year as out of range", () => {
    // coveredYears was built from the national, ministries and municipal facts
    // only, so it stopped at 2025 - and get_sources rejected 1995 and 2028 with
    // a false out-of-range error, breaking the flow the server instructions
    // push clients toward: query a year, take its sourceIds, ask about that year.
    for (const [sourceId, year] of [
      ["source.imf_weo_april_2026_general_government_balance", 1995],
      ["source.mof_public_debt_bulletin_n25", 2028],
    ] as const) {
      const response = getSources(snapshot, { sourceIds: [sourceId], years: [year] });

      expect(response.kind, `${sourceId} ${year}`).toBe("sources");
    }
  });
});
