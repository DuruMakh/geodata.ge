import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { getSources } from "../../lib/factQuery/getSources";
import { buildGdpCsv } from "../../lib/factQuery/publications";
import { expect, it } from "vitest";
import { queryGdp } from "../../lib/factQuery/queryGdp";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { observationSchema } from "../../lib/factQuery/schemas";
const snapshot = loadPackagedSnapshot();
it("returns source values with distinct price bases and preliminary status", () => {
  const response = queryGdp(snapshot, {
    seriesIds: [
      "real_usd_2015",
      "real_growth_percent",
      "nominal_gel",
      "nominal_usd",
      "per_capita_gel",
      "per_capita_usd",
    ],
    years: [2025],
  });
  if (response.kind !== "observations")
    throw new Error(JSON.stringify(response));
  const rows = (response.data as { observations: unknown[] }).observations.map(
    (r) => observationSchema.parse(r),
  );
  expect(rows).toHaveLength(6);
  expect(
    rows.find((r) => r.seriesId === "real_growth_percent")?.value,
  ).toBeGreaterThan(7);
  expect(rows.find((r) => r.seriesId === "real_usd_2015")?.unit).toBe(
    "USD_2015",
  );
  expect(rows.find((r) => r.seriesId === "nominal_usd")?.basis).toBe(
    "preliminary",
  );
  expect(rows.find((r) => r.seriesId === "per_capita_usd")?.value).toBeCloseTo(
    10296.54436,
  );
  expect(
    rows.every(
      (r) => r.documentIds.length > 0 && r.valueDefinitionEn.length > 0,
    ),
  ).toBe(true);
  expect(response.meta.caveats.some((c) => c.code === "gdp_preliminary")).toBe(
    true,
  );
});
it("keeps missing early nominal observations absent and validates requests", () => {
  const r = queryGdp(snapshot, {
    seriesIds: ["nominal_gel", "real_usd_2015"],
    years: [1960],
  });
  expect(r.status).toBe("partial");
  expect(
    queryGdp(snapshot, { seriesIds: ["unknown"], years: [2025] }).kind,
  ).toBe("error");
  expect(
    queryGdp(snapshot, { seriesIds: ["real_usd_2015"], years: [1959] }).kind,
  ).toBe("error");
  expect(
    queryGdp(snapshot, {
      seriesIds: ["real_usd_2015"],
      years: [2025],
      expectedDataVersion: "0".repeat(64),
    }).kind,
  ).toBe("error");
});

it("discovers GDP in both languages and resolves its early-year originals", () => {
  for (const search of ["GDP", "მშპ"]) {
    const r = describeCoverage(snapshot, { datasetId: "gdp-overview", search });
    expect(r.kind).toBe("catalogue");
    expect(r.status).toBe("ok");
  }
  const r = queryGdp(snapshot, { seriesIds: ["real_usd_2015"], years: [1960] });
  if (r.kind !== "observations") throw new Error("query failed");
  const row = observationSchema.parse(
    (r.data as { observations: unknown[] }).observations[0],
  );
  const sources = getSources(snapshot, {
    sourceIds: row.sourceIds,
    datasetId: "gdp-overview",
    years: [1960],
  });
  expect(sources.kind).toBe("sources");
  expect(JSON.stringify(sources)).not.toContain(
    '"narrowingOutcome":"dropped_no_match"',
  );
});
it("keeps exact reviewed decimals and a BOM in the public CSV", () => {
  const csv = buildGdpCsv(snapshot);
  expect(csv.rowCount).toBe(251);
  expect(csv.bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))).toBe(
    true,
  );
  for (const f of snapshot.gdpOverview.facts)
    expect(csv.bytes.toString("utf8")).toContain(
      `${f.seriesId},${f.year},${f.value},`,
    );
});
