import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { SERVER_INSTRUCTIONS } from "../../lib/mcp/instructions";
import { TOOLS, createMcpServer } from "../../lib/mcp/tools";

async function connected(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1.0.0" });
  await Promise.all([createMcpServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

const TOOL_NAMES = [
  "compare",
  "describe_coverage",
  "get_sources",
  "query_ministries",
  "query_municipal",
  "query_national",
  "rank",
];

describe("MCP tool surface", () => {
  it("advertises exactly the seven read-only query functions", async () => {
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
    expect(SERVER_INSTRUCTIONS).toContain("CC BY 4.0");
    expect(SERVER_INSTRUCTIONS).toContain("GEL");
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toMatch(/caveat|limitation/);
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toContain("deficit");
    expect(SERVER_INSTRUCTIONS.toLowerCase()).toMatch(/never estimate|do not estimate/);
    expect(TOOLS).toHaveLength(7);
  });

  it("keeps every tool name in the advertised set", () => {
    expect(TOOLS.map((tool) => tool.name).sort()).toEqual(TOOL_NAMES);
  });
});
