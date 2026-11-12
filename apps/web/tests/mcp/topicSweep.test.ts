// apps/web/tests/mcp/topicSweep.test.ts
//
// Every tool once per topic dataset, through createMcpServer() - the server the HTTP route builds - so the registered
// output schemas and the size bound are in the path (final review C1, C2 and recommendation 2). The unit tests call
// rank() and describeCoverage() directly and never meet either.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { createMcpServer } from "../../lib/mcp/tools";
import { queryIndicators } from "../../lib/factQuery/queryIndicators";

type CallResult = { isError?: boolean; content: { type: string; text: string }[]; structuredContent?: Record<string, unknown> };

let client: Client;
beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "topic-sweep", version: "1.0.0" });
  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
});
afterAll(async () => { await client.close(); });

const call = async (name: string, args: Record<string, unknown>) => (await client.callTool({ name, arguments: args })) as CallResult;
/** The failures a valid call must never meet: a refused output (schema) or a refused size. Any other error is the tool's answer. */
const brokenCode = (result: CallResult) => (result.isError ? /error (internal_error|result_too_large)/.exec(result.content[0]?.text ?? "")?.[1] : undefined);

describe("rank over MCP in the series' own units (C1)", () => {
  const rankOf = async (args: Record<string, unknown>) => {
    const result = await call("rank", { measure: "value", limit: 5, ...args });
    expect(result.isError, result.content[0]?.text).toBeFalsy();
    return (result.structuredContent as { kind: string; data: { entries: { unit: string; value: number }[] } }).data.entries;
  };

  it("ranks thousand persons, persons, °C and USD", async () => {
    expect((await rankOf({ datasetId: "unemployment-age", dimension: "series", seriesId: "unemployed.age.25_29", metric: "value", year: 2024 })).map((entry) => entry.unit))
      .toEqual(Array(5).fill("thousand_persons"));
    const pupils = await rankOf({ datasetId: "education-schools", dimension: "entities", entityType: "municipality", seriesId: "education.pupils.total", metric: "absolute_change", fromYear: 2015, toYear: 2025, order: "ascending", limit: 2 });
    expect(pupils).toMatchObject([{ unit: "persons", value: -1861 }, { unit: "persons", value: -1273 }]);
    const climate = loadPackagedSnapshot().topics.datasets.find((dataset) => dataset.page.datasetId === "environment-climate")!;
    const temperature = climate.series.find((series) => series.unit === "celsius" && series.headingKa !== null && !series.isTotal)!;
    expect((await rankOf({ datasetId: "environment-climate", dimension: "series", seriesId: temperature.seriesId, metric: "absolute_change", fromYear: 2015, toYear: 2024 }))[0]!.unit).toBe("celsius");
    expect((await rankOf({ datasetId: "trade-partners", dimension: "series", parentSeriesId: "trade.exports", metric: "value", year: 2024 })).map((entry) => entry.unit)).toEqual(Array(5).fill("usd"));
  });
});

describe("every tool answers every topic dataset (recommendation 2)", () => {
  it("returns no internal_error and no result_too_large", async () => {
    const snapshot = loadPackagedSnapshot();
    const broken: string[] = [];
    for (const dataset of snapshot.topics.datasets) {
      const datasetId = dataset.page.datasetId;
      const first = dataset.series[0]!;
      const country = dataset.entities.find((entity) => entity.entityType === "country");
      const place = dataset.entities.find((entity) => entity.entityType === "municipality") ?? dataset.entities.find((entity) => entity.entityType === "region");
      const headed = dataset.series.find((series) => series.headingKa !== null && !series.isTotal);
      const sourceIndex = dataset.columns.sources.find((ids) => ids.length > 0)![0]!;
      const calls: [string, Record<string, unknown>][] = [
        ["describe_coverage", { datasetId }],
        ["query_indicators", { datasetId, seriesIds: [first.seriesId], years: [dataset.lastYear] }],
        ["compare", { target: { dataset: "topic", datasetId, seriesIds: [first.seriesId], ...(country ? {} : { entityIds: [dataset.entities[0]!.entityId] }) }, fromYear: dataset.firstYear, toYear: dataset.lastYear, measure: "value" }],
        ["get_sources", { sourceIds: [snapshot.topics.sourceIds[sourceIndex]], datasetId }],
        ["rank", place
          ? { datasetId, dimension: "entities", entityType: place.entityType, seriesId: first.seriesId, measure: "value", metric: "value", year: dataset.lastYear, limit: 3 }
          : { datasetId, dimension: "series", seriesId: (headed ?? first).seriesId, measure: "value", metric: "value", year: dataset.lastYear, limit: 3 }],
      ];
      for (const [name, args] of calls) {
        const code = brokenCode(await call(name, args));
        if (code) broken.push(`${name} ${datasetId}: ${code}`);
      }
    }
    expect(broken).toEqual([]);
  });

  // The documented workflow is "one meaningful keyword"; these used to exceed 512 KiB (C2).
  it.each([
    "exports", "export", "imports", "trade", "goods", "services", "products", "ექსპორტი", "იმპორტი", "exports to Turkey",
    "spending", "budget", "ბიუჯეტი", "population", "მოსახლეობა", "prices", "ფასები", "wages", "ხელფასი", "age", "women", "total",
  ])("answers the search %s without a datasetId", async (search) => {
    const result = await call("describe_coverage", { search });
    expect(brokenCode(result)).toBeUndefined();
    expect(result.isError).toBeFalsy();
  });
});

// A unit name that ends in an abbreviation's stop ("million t CO₂ eq.") used to end the definition with two.
describe("every topic unit's value definition", () => {
  it("names the unit and ends with one full stop", () => {
    const snapshot = loadPackagedSnapshot();
    const doubled: string[] = [];
    for (const dataset of snapshot.topics.datasets) {
      for (const unit of new Set(dataset.series.map((series) => series.unit))) {
        const series = dataset.series.find((entry) => entry.unit === unit)!;
        const response = queryIndicators(snapshot, { datasetId: dataset.page.datasetId, seriesIds: [series.seriesId], entityIds: [dataset.entities[0]!.entityId], years: [dataset.lastYear] });
        if (response.kind !== "observations") continue;
        for (const observation of (response.data as { observations: { valueDefinition: string; valueDefinitionEn: string }[] }).observations) {
          for (const text of [observation.valueDefinition, observation.valueDefinitionEn]) if (/\.\.(\s|$)/u.test(text)) doubled.push(`${dataset.page.datasetId} ${unit}: ${text}`);
        }
      }
    }
    expect(doubled).toEqual([]);
    const co2 = queryIndicators(snapshot, { datasetId: "environment-greenhouse-gases", seriesIds: ["environment.ghg.total"], years: [2020] }) as { data: { observations: { valueDefinitionEn: string }[] } };
    expect(co2.data.observations[0]!.valueDefinitionEn).toMatch(/in million t CO₂ eq\.$/u);
  });
});
