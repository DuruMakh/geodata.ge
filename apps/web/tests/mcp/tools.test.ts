import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describeCoverage } from "../../lib/factQuery/describeCoverage";
import { serverInstructions } from "../../lib/mcp/instructions";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { TOOLS, createMcpServer } from "../../lib/mcp/tools";

async function connected(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Any counts; these tests are about how the text is built, not about the data. */
const ENTITY_COUNTS = { municipalities: 64, regions: 11 };

const TOOL_NAMES = [
  "compare",
  "describe_coverage",
  "get_sources",
  "query_debt",
  "query_deficit",
  "query_economic_sectors",
  "query_gdp",
  "query_inflation",
  "query_ministries",
  "query_municipal",
  "query_national",
  "rank",
];

describe("MCP tool surface", () => {
  it("advertises exactly the read-only query functions", async () => {
    const { tools } = await (await connected()).listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
    for (const tool of tools) {
      expect(tool.annotations?.readOnlyHint, tool.name).toBe(true);
      expect(tool.annotations?.destructiveHint, tool.name).toBe(false);
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
      expect(tool.inputSchema.type, tool.name).toBe("object");
      expect(tool.description!.length, tool.name).toBeGreaterThan(40);
    }
  });

  // The .refine() constraints do not survive into JSON Schema - the SDK routes
  // Zod v4 through toJSONSchema, which cannot express a cross-field rule. A
  // model that cannot see them must be told them in words, or it will guess and
  // get an error it has no way to interpret.
  it("states in prose the constraints JSON Schema cannot express", async () => {
    const { tools } = await (await connected()).listTools();
    const compare = tools.find((tool) => tool.name === "compare")!;
    const rank = tools.find((tool) => tool.name === "rank")!;

    expect(compare.description).toMatch(/fromYear/);
    expect(rank.description).toMatch(/fromYear/);
    expect(rank.description).toMatch(/entityType/);
  });

  it("answers a real call with structured content and text", async () => {
    const result = await (await connected()).callTool({
      name: "query_national",
      arguments: { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" },
    });

    expect(result.isError).toBeFalsy();
    expect((result.structuredContent as { kind: string }).kind).toBe("observations");
    expect((result.content as { type: string; text: string }[])[0]!.text).toContain("2024");
  });

  it("returns the bilingual expenditure example through the SDK's declared output schema", async () => {
    const client = await connected();
    try {
      const result = await client.callTool({ name: "query_national", arguments: { side: "expenditure", seriesIds: ["spending.education"], years: [2025], measure: "amount_gel" } });
      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ data: { observations: [{
        entityLabelKa: "საქართველო", entityLabelEn: "Georgia", seriesLabelKa: "განათლება", seriesLabelEn: "Education",
        valueDefinitionEn: "Reviewed value in GEL at full precision.", missingReasonEn: null,
      }] } });
    } finally { await client.close(); }
  });

  it("returns a tool error, not a transport failure, for an unknown series", async () => {
    const result = await (await connected()).callTool({
      name: "query_national",
      arguments: { side: "expenditure", seriesIds: ["expenditure.not_a_series"], years: [2024], measure: "amount_gel" },
    });

    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]!.text).toContain("unknown_series");
  });

  // A shape failure is caught by the SDK against the registered inputSchema,
  // before our handler runs, so it comes back as the SDK's English
  // InvalidParams rather than the core's bilingual envelope. That is the
  // accepted cost of registering the schema at all - and registering it is what
  // stops most of these calls being made. What matters is that the message is
  // ACTIONABLE: it must name the offending field and the valid options, not
  // just say "invalid".
  it("rejects a malformed argument with a message naming the field and its options", async () => {
    const result = await (await connected()).callTool({
      name: "query_national",
      arguments: { side: "sideways", seriesIds: [], years: [], measure: "amount_gel" },
    });
    const text = (result.content as { text: string }[])[0]!.text;

    expect(result.isError).toBe(true);
    expect(text).toContain("side");
    expect(text).toContain("revenue");
    expect(text).toContain("expenditure");
    expect(text).toContain("seriesIds");
  });

  // Every SEMANTIC error - the ones a model actually hits once its arguments
  // are well-formed - must still carry both languages, because this is the text
  // a Georgian-speaking user may be shown.
  it("carries Georgian and English on a semantic error", async () => {
    const result = await (await connected()).callTool({
      name: "query_municipal",
      arguments: { entityIds: ["11"], seriesIds: ["municipal.total"], years: [1997], measure: "amount_gel" },
    });
    const text = (result.content as { text: string }[])[0]!.text;

    expect(result.isError).toBe(true);
    // Georgian script present, and an English sentence alongside it.
    expect(text).toMatch(/[Ⴀ-ჿ]/);
    expect(text).toMatch(/[a-z]{4,}\s+[a-z]{4,}/i);
  });

  it("refuses an oversized request rather than truncating it", async () => {
    const result = await (await connected()).callTool({
      name: "query_municipal",
      arguments: {
        // 14 municipalities x 7 series x 11 years = 1,078 cells, over the 500 cap.
        entityIds: ["04", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18"],
        seriesIds: [
          "municipal.total", "municipal.education", "municipal.health", "municipal.social_protection",
          "municipal.housing_communal", "municipal.recreation_culture", "municipal.economic_affairs",
        ],
        years: [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025],
        measure: "amount_gel",
      },
    });

    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]!.text).toContain("result_too_large");
    expect((result.content as { text: string }[])[0]!.text).toContain("/downloads/data/");
  });

  it("tells the client what the service is for and what it must not claim", () => {
    // Spec 13: the truth policy is part of the contract, not decoration.
    const instructions = serverInstructions({ "national-revenue": "2004-2025" }, ENTITY_COUNTS);

    expect(instructions).toContain("CC BY 4.0");
    expect(instructions).toContain("GEL");

    // The reader is a citizen, not a developer. Without this the model treats an
    // id as a precise technical term worth quoting, and answers came back with
    // "შემოსავლების (national-revenue)" - a database token in a sentence about
    // public money.
    expect(instructions).toContain("developer reading an API");
    expect(instructions).toContain("Do not put them in the answer");
    // The code must not be named as the thing that marks the boundary, or the
    // model repeats the code.
    expect(instructions).not.toContain("The budget_scopes_differ");
    expect(instructions.toLowerCase()).toMatch(/caveat|limitation/);
    expect(instructions.toLowerCase()).toContain("deficit");
    expect(instructions.toLowerCase()).toMatch(/never estimate|do not estimate/);
    expect(TOOLS).toHaveLength(TOOL_NAMES.length);
  });

  // The instructions state coverage, so they must read it from the catalogue
  // rather than carry a written-down range. This one had already drifted before
  // it shipped: the text said ministries covered 2005-2025 while the catalogue
  // said 2004-2025.
  it("states coverage from the catalogue rather than a hardcoded range", async () => {
    const { tools } = await (await connected()).listTools();
    const ministries = tools.find((tool) => tool.name === "query_ministries")!;

    const filled = serverInstructions({ ministries: "1999-2001" }, ENTITY_COUNTS);
    expect(filled).toContain("1999-2001");
    expect(serverInstructions({}, ENTITY_COUNTS)).toContain("see describe_coverage");
    // And the live server agrees with itself: the tool description carries the
    // real range, not a different one.
    expect(ministries.description).toMatch(/\d{4}-\d{4}/);
  });

  // Same rule as the year ranges: the entity counts are read from the snapshot,
  // so "64 municipalities" cannot go stale in the text while the data moves on.
  it("counts municipalities and regions rather than stating them", () => {
    expect(serverInstructions({}, { municipalities: 7, regions: 3 })).toContain("7 municipalities");
    expect(serverInstructions({}, { municipalities: 7, regions: 3 })).toContain("3 regions");
  });

  // Revenue is consolidated receipts; expenditure is state-budget expenditure.
  // A client told they are both "state budget" has been handed the premise for
  // a deficit subtraction the whole caveat exists to prevent.
  it("names the two national accounting boundaries as different", () => {
    const instructions = serverInstructions({}, ENTITY_COUNTS);

    expect(instructions).toContain("consolidated budget RECEIPTS");
    expect(instructions).toContain("STATE-BUDGET expenditure");
  });

  // The sector bullet carried its measure years as text ("cover2010–2025"), so
  // they would have gone stale on the next data refresh - and lost their spaces
  // on the way in.
  it("states economic-sector measure years from the data", async () => {
    const snapshot = loadPackagedSnapshot();
    const range = (measure: string) => {
      const years = snapshot.economicSectors.facts.filter((fact) => fact.measure === measure).map((fact) => fact.year);
      return `${Math.min(...years)}-${Math.max(...years)}`;
    };
    const { tools } = await (await connected()).listTools();
    const sectors = tools.find((tool) => tool.name === "query_economic_sectors")!;

    expect(sectors.description).toContain(`shares cover ${range("nominal")}`);
    expect(sectors.description).toContain(`real growth covers ${range("real_growth")}`);
    const filled = serverInstructions({}, ENTITY_COUNTS, { amount_gel: "1999-2001", real_growth_pct: "2000-2001" });
    expect(filled).toContain("shares cover 1999-2001");
    expect(filled).toContain("real growth covers 2000-2001");
    expect(serverInstructions({}, ENTITY_COUNTS)).toContain("shares cover see describe_coverage");
  });

  it("counts the datasets describe_coverage searches rather than naming a number", async () => {
    const snapshot = loadPackagedSnapshot();
    const catalogue = describeCoverage(snapshot, {});
    if (catalogue.kind !== "catalogue") throw new Error("Expected catalogue");
    const count = (catalogue.data as { datasets: unknown[] }).datasets.length;
    const { tools } = await (await connected()).listTools();

    expect(tools.find((tool) => tool.name === "describe_coverage")!.description).toContain(`all ${count} datasets`);
  });

  it("never glues a number to the word before it", async () => {
    const { tools } = await (await connected()).listTools();
    const texts = [...tools.map((tool) => tool.description ?? ""), serverInstructions({}, ENTITY_COUNTS)];
    // A glued year ("cover2010") is the regression. Measure ids such as avg12_pct
    // legitimately put a digit after a letter.
    for (const text of texts) expect(text).not.toMatch(/[a-z]\d{4}/i);
  });

  // GDP is served in USD, constant-2015 USD and percent, and carries published
  // and preliminary statuses. Telling a client that every amount is nominal GEL
  // with an actual/planned/projection basis is false of two datasets.
  it("does not describe every value as nominal GEL with a budget basis", () => {
    const instructions = serverInstructions({}, ENTITY_COUNTS);

    expect(instructions).not.toContain("All amounts are nominal GEL");
    expect(instructions).toContain('"published"');
    expect(instructions).toContain('"preliminary"');
    expect(instructions).toContain("real_growth_pct");
  });

  it("answers query_inflation with a monthly period in structured content", async () => {
    const client = await connected();
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: "2026-08", toPeriod: "2026-08" },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({ data: { observations: [{ period: "2026-08", unit: "percent" }] } });
    // The text twin must name the month, or a year of months reads as twelve identical "2026" rows.
    expect((result.content as { text: string }[])[0]!.text).toContain("\t2026-08\tyoy_pct\t5.6479\t");
  });

  it("names both months of an inflation comparison in the text twin", async () => {
    const client = await connected();
    const result = await client.callTool({
      name: "compare",
      arguments: { target: { dataset: "inflation", seriesIds: ["cpi.headline"] }, fromPeriod: "2025-08", toPeriod: "2026-08", measure: "yoy_pct" },
    });
    expect(result.isError).toBeFalsy();
    expect((result.content as { text: string }[])[0]!.text).toContain("\t2025-08→2026-08\t");
  });

  it("refuses an oversized inflation request before calculating it", async () => {
    const client = await connected();
    const snapshot = loadPackagedSnapshot();
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: snapshot.inflation.groups.map((group) => group.id), measure: "yoy_pct", fromPeriod: "2025-01", toPeriod: "2025-12" },
    });
    expect(result.isError).toBe(true);
    expect((result.content as { text: string }[])[0]!.text).toContain("result_too_large");
  });

  // The binding MCP gate is LIMITS.resultBytes (512 KiB, both representations), not
  // the 500-cell cap, and inflation rows carry long bilingual definitions. A year of
  // division contributions is the everyday contributions question, so it must fit.
  it("fits a year of division contributions within the response-size limit", async () => {
    const client = await connected();
    const snapshot = loadPackagedSnapshot();
    const divisions = snapshot.inflation.groups.filter((group) => group.level === "division").map((group) => group.id);
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: divisions, measure: "contribution_pp", fromPeriod: "2025-01", toPeriod: "2025-12" },
    });
    expect(result.isError).toBeFalsy();
  });

  // The headline grows by a row every month. Before definitions moved to a legend the
  // full history was 505 KiB of 512 and would have been refused within a few releases.
  it("fits the full published headline history and prints its definition once", async () => {
    const client = await connected();
    const periods = loadPackagedSnapshot()
      .inflation.facts.filter((fact) => fact.seriesId === "cpi.headline" && fact.measure === "yoy_pct")
      .map((fact) => fact.period)
      .sort();
    const result = await client.callTool({
      name: "query_inflation",
      arguments: { seriesIds: ["cpi.headline"], measure: "yoy_pct", fromPeriod: periods[0], toPeriod: periods.at(-1) },
    });
    expect(result.isError).toBeFalsy();
    const observations = (result.structuredContent as { data: { observations: { valueDefinitionEn: string }[] } }).data.observations;
    expect(observations.length).toBe(periods.length);
    const text = (result.content as { text: string }[])[0]!.text;
    expect(text.split(observations[0]!.valueDefinitionEn)).toHaveLength(2);
    expect(text).toContain("\tinflation:yoy_pct\t");
    // Headroom, so the test fails years before production would refuse the call.
    expect(Buffer.byteLength(JSON.stringify(result), "utf8")).toBeLessThan(0.85 * 512 * 1024);
  });

  it("tells clients inflation is the one monthly dataset", () => {
    const instructions = serverInstructions({}, ENTITY_COUNTS);
    expect(instructions).toContain("INFLATION");
    expect(instructions).toContain("only monthly dataset");
    expect(instructions).toContain("schema 1.2.0");
    expect(instructions).not.toContain("Quarterly or monthly data, live budget execution");
  });

  it("keeps every tool name in the advertised set", () => {
    expect(TOOLS.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  });
});
