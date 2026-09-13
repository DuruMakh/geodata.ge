// apps/web/tests/factQuery/describeCoverage.test.ts
import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { queryMinistries } from "../../lib/factQuery/queryMinistries";
import { envelopeSchema } from "../../lib/factQuery/schemas";
import { AGGREGATE_ONLY_MUNICIPAL_CODES, type FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-08-29T00:00:00.000Z" });
});

type CoverageData = {
  datasets: { datasetId: string; years: [number, number]; measures: string[] }[];
  series?: { seriesId: string; labelKa: string; availability: string; level: string; years: number[]; datasetId?: string }[];
  entities?: { entityId: string; labelKa: string; entitySlug: string | null; datasetId?: string }[];
  exclusions: { entityId: string; reason: string }[];
};

const data = (result: ReturnType<typeof describeCoverage>) => (result as { data: CoverageData }).data;

describe("describeCoverage", () => {
  it("lists debt and the balance with the ranges their own facts carry", () => {
    const response = describeCoverage(snapshot, {});
    if (response.kind !== "catalogue") throw new Error("expected a catalogue");
    const byId = new Map(
      (response.data as { datasets: { datasetId: string; years: [number, number]; budgetScope: string }[] }).datasets.map(
        (dataset) => [dataset.datasetId, dataset],
      ),
    );

    expect(byId.get("government-debt")!.years).toEqual([2013, 2030]);
    expect(byId.get("general-government-balance")!.years).toEqual([1995, 2031]);

    // The boundary slug is half of a join: an observation carries the same
    // string, and budget_scopes_differ exists because boundaries that share a
    // shape are not the same concept.
    expect(byId.get("government-debt")!.budgetScope).toBe("central_government_liabilities");
    expect(byId.get("general-government-balance")!.budgetScope).toBe("general_government_imf");
  });

  it("gives the debt rate series only the years a reviewed source published", () => {
    const response = describeCoverage(snapshot, { datasetId: "government-debt" });
    if (response.kind !== "catalogue") throw new Error("expected a catalogue");
    const series = new Map(
      (response.data as { series: { seriesId: string; years: number[] }[] }).series.map((s) => [s.seriesId, s.years]),
    );

    // Ragged on purpose. Listing a year here that carries no rate would tell a
    // client one exists.
    expect(series.get("debt.rate.external")).not.toContain(2016);
    expect(series.get("debt.rate.total")).toContain(2016);
  });

  it("returns a conforming catalogue envelope with every dataset", () => {
    const result = describeCoverage(snapshot, {});
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("catalogue");
    expect(data(result).datasets.map((d) => d.datasetId).sort()).toEqual([
      "economic-sectors",
      "gdp-overview",
      "general-government-balance",
      "government-debt",
      "ministries",
      "municipal-expenditure",
      "national-expenditure",
      "national-revenue",
      "regional-economies",
    ]);
  });

  it("describes regional GDP coverage, regions, activities and only the two approved measures", () => {
    const result = describeCoverage(snapshot, { datasetId: "regional-economies" });
    const coverage = data(result);

    expect(coverage.datasets).toEqual([
      expect.objectContaining({
        datasetId: "regional-economies",
        years: [2010, 2024],
        entityTypes: ["region"],
        measures: ["amount_gel", "share_of_region_gdp_pct"],
      }),
    ]);
    expect(coverage.entities).toHaveLength(11);
    expect(coverage.series).toHaveLength(21);
    expect(coverage.series?.[0]).toMatchObject({ seriesId: "economy.regional_gdp_total", level: "total" });
    expect(JSON.stringify(coverage)).toContain("market-price GDP");
    expect(JSON.stringify(coverage)).not.toContain("real_growth_pct");
  });

  it("narrows datasets to the requested one", () => {
    const result = describeCoverage(snapshot, { datasetId: "national-revenue" });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(data(result).datasets.length).toBe(1);
    expect(data(result).datasets[0]?.datasetId).toBe("national-revenue");
  });

  it("marks revenue.taxes_total taxonomy_only, never served", () => {
    const series = data(describeCoverage(snapshot, { datasetId: "national-revenue" })).series ?? [];
    const entry = series.find((s) => s.seriesId === "revenue.taxes_total");

    expect(entry).toBeDefined();
    expect(entry?.availability).toBe("taxonomy_only");
    expect(entry?.years).toEqual([]);
  });

  it("lists the calculated totals even though no fact row backs them", () => {
    const revenue = data(describeCoverage(snapshot, { datasetId: "national-revenue" })).series ?? [];
    const total = revenue.find((s) => s.seriesId === "revenue.total");

    expect(total?.availability).toBe("calculated_total");
    expect(total?.years.length).toBeGreaterThan(0);
  });

  it("reports exact years per series, not a filled range", () => {
    const series = data(describeCoverage(snapshot, { datasetId: "ministries", level: "major_program" })).series ?? [];
    const ragged = series.filter((s) => s.years.length > 0 && s.years.length < s.years[s.years.length - 1] - s.years[0] + 1);

    expect(ragged.length).toBeGreaterThan(0);
  });

  it("never lists an excluded municipality as an entity, but does explain it", () => {
    const result = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure" }));
    const entityIds = (result.entities ?? []).map((e) => e.entityId);

    for (const code of AGGREGATE_ONLY_MUNICIPAL_CODES) {
      expect(entityIds).not.toContain(code);
      expect(result.exclusions.some((x) => x.entityId === code && x.reason.length > 0)).toBe(true);
    }
  });

  it("exposes the url slug on municipalities as a matching aid", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure" })).entities ?? [];
    expect(entities.find((e) => e.entityId === "11")?.entitySlug).toBe("khulo");
  });

  it("searches over id, georgian label and slug", () => {
    const bySlug = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "khulo" })).entities ?? [];
    const byId = data(describeCoverage(snapshot, { datasetId: "national-revenue", search: "revenue.vat" })).series ?? [];

    expect(bySlug.map((e) => e.entityId)).toContain("11");
    expect(byId.map((s) => s.seriesId)).toContain("revenue.vat");
  });

  it("returns empty status when a search matches nothing", () => {
    const result = describeCoverage(snapshot, { datasetId: "national-revenue", search: "zzz-no-such-series" });
    expect(result.status).toBe("empty");
  });

  it("rejects a stale expectedDataVersion", () => {
    const result = describeCoverage(snapshot, { expectedDataVersion: "0".repeat(64) });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect((result as { error: { code: string } }).error.code).toBe("data_version_changed");
  });

  it("rejects an unknown dataset with invalid_parameters and offers valid choices", () => {
    const result = describeCoverage(snapshot, { datasetId: "not-a-dataset" });
    expect(envelopeSchema.parse(result)).toBeTruthy();
    expect(result.kind).toBe("error");
    expect((result as { error: { code: string; validChoices?: string[] } }).error.code).toBe("invalid_parameters");
    expect((result as { error: { validChoices?: string[] } }).error.validChoices).toContain("national-revenue");
  });

  it("fires no data-shaped caveat on a catalogue request", () => {
    expect(describeCoverage(snapshot, {}).meta.caveats).toEqual([]);
  });

  it("carries licence and data version in meta", () => {
    const meta = describeCoverage(snapshot, {}).meta;
    expect(meta.licence).toBe("CC BY 4.0");
    expect(meta.dataVersion).toBe(snapshot.dataVersion);
  });

  describe("the level filter lists what is queryable at that level, not structural levels", () => {
    const seriesAt = (level: "admin_category" | "major_program") =>
      data(describeCoverage(snapshot, { datasetId: "ministries", level })).series ?? [];

    it("surfaces admin_spending.total under admin_category, still labelled a total", () => {
      const total = seriesAt("admin_category").find((s) => s.seriesId === "admin_spending.total");

      // queryMinistries accepts the total ONLY at admin_category, so a client
      // narrowing the catalogue by level must find it there - otherwise the
      // state budget's headline number is undiscoverable through the catalogue.
      expect(total).toBeDefined();
      // Its structural level is untouched: the filter widened, the data did not.
      expect(total?.level).toBe("total");
      expect(total?.availability).toBe("calculated_total");
    });

    it("does not surface admin_spending.total under major_program", () => {
      expect(seriesAt("major_program").map((s) => s.seriesId)).not.toContain("admin_spending.total");
    });

    it("agrees with what queryMinistries actually accepts at admin_category", () => {
      const catalogueQueryable = seriesAt("admin_category")
        .filter((s) => s.availability !== "taxonomy_only")
        .map((s) => s.seriesId)
        .sort();

      // An unknown_series error reports the real queryable set as validChoices.
      const rejected = queryMinistries(snapshot, {
        level: "admin_category",
        seriesIds: ["definitely.not.a.series"],
        years: [2024],
        measure: "amount_gel",
      });
      const accepted = (rejected as { error: { validChoices?: string[] } }).error.validChoices ?? [];

      expect(catalogueQueryable).toEqual([...accepted].sort());
      expect(catalogueQueryable).toContain("admin_spending.total");
    });

    it("does not leak a national total into a ministries level filter", () => {
      const series = data(describeCoverage(snapshot, { datasetId: "national-revenue", level: "admin_category" })).series ?? [];
      expect(series.map((s) => s.seriesId)).not.toContain("revenue.total");
    });
  });
});

// "Ask this FIRST when you do not already know an id" has to work before the
// dataset is known too - which is precisely when a caller cannot supply one.
// Before this, search without a datasetId returned nothing, silently, and read
// as "no such thing" rather than "wrong call".
describe("search before you know the dataset", () => {
  it("finds a municipal entity with no datasetId given", () => {
    const entities = data(describeCoverage(snapshot, { search: "ბათუმი" })).entities ?? [];
    expect(entities.map((e) => e.entityId)).toContain("06");
  });

  it("names the dataset each cross-dataset match belongs to", () => {
    const found = data(describeCoverage(snapshot, { search: "ბათუმი" }));
    for (const entity of found.entities ?? []) expect(entity.datasetId).toBe("municipal-expenditure");
    expect((found.entities ?? []).length).toBeGreaterThan(0);
  });

  it("finds a national series with no datasetId given", () => {
    const series = data(describeCoverage(snapshot, { search: "განათლება" })).series ?? [];
    expect(series.length).toBeGreaterThan(0);
    for (const entry of series) expect(typeof entry.datasetId).toBe("string");
  });

  it("reports empty rather than ok when a cross-dataset search matches nothing", () => {
    const result = describeCoverage(snapshot, { search: "zzzznotathing" });
    expect(result.status).toBe("empty");
  });

  // The single-dataset shape is a published contract; searching across datasets
  // must not start tagging it.
  it("does not tag matches when a datasetId was given", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "ბათუმი" })).entities ?? [];
    expect(entities.length).toBeGreaterThan(0);
    for (const entity of entities) expect(entity.datasetId).toBeUndefined();
  });

  // Without a search the dataset catalogue is still the whole answer.
  it("still returns no series or entities when neither search nor datasetId is given", () => {
    const found = data(describeCoverage(snapshot, {}));
    expect(found.series).toBeUndefined();
    expect(found.entities).toBeUndefined();
  });
});

// Georgian inflects. A question says "ბათუმის ბიუჯეტი", not "ბათუმი", and a
// model passes the form the question used.
describe("search understands Georgian case endings", () => {
  it("finds ბათუმი from the genitive ბათუმის", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "ბათუმის" })).entities ?? [];
    expect(entities.map((e) => e.entityId)).toContain("06");
  });

  // The harder case: the ending replaces the final vowel rather than appending,
  // so no prefix of the query is a prefix of the label.
  it("finds განათლება from the genitive განათლების", () => {
    const plain = data(describeCoverage(snapshot, { datasetId: "national-expenditure", search: "განათლება" })).series ?? [];
    const inflected = data(describeCoverage(snapshot, { datasetId: "national-expenditure", search: "განათლების" })).series ?? [];
    expect(plain.length).toBeGreaterThan(0);
    expect(inflected.map((s) => s.seriesId).sort()).toEqual(plain.map((s) => s.seriesId).sort());
  });

  it("finds ონი from the genitive ონის", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "ონის" })).entities ?? [];
    expect(entities.map((e) => e.labelKa)).toContain("ონი");
  });

  // A two-character stem must begin the label, not merely appear in it, or
  // "ონის" would drag in every label containing "ონ".
  it("does not let a short stem match mid-word", () => {
    const entities = data(describeCoverage(snapshot, { datasetId: "municipal-expenditure", search: "ონის" })).entities ?? [];
    for (const entity of entities) expect(entity.labelKa.startsWith("ონ")).toBe(true);
  });
});
