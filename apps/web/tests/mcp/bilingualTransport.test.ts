import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import type { FactQuerySnapshot, FactQueryResponse } from "../../lib/factQuery/types";
import { TOOLS, createMcpServer } from "../../lib/mcp/tools";
import { toolResult } from "../../lib/mcp/result";

let snapshot: FactQuerySnapshot;
beforeAll(async () => { snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-05T00:00:00Z" }); });
const run = (name: string, input: unknown) => TOOLS.find(tool => tool.name === name)!.run(snapshot, input);

function verifyEnglishText(response: FactQueryResponse) {
  const text = toolResult(response).content[0]!.text;
  function visit(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key.endsWith("En") && typeof item === "string" && item.length) expect(text, key).toContain(item);
      if (key === "reasonsEn") for (const reason of item as string[]) expect(text).toContain(reason);
      if (key === "documentId" || key === "sourceId") expect(text, key).toContain(item as string);
      visit(item);
    }
  }
  visit(response);
  expect(text).toMatch(/\p{Script=Georgian}/u);
  return text;
}

describe("bilingual text-only transport", () => {
  it.each([
    ["query_national", { side: "expenditure", seriesIds: ["spending.education"], years: [2025], measure: "amount_gel" }],
    ["query_national", { side: "expenditure", seriesIds: ["expenditure.total"], years: [2025], measure: "amount_gel" }],
    ["query_debt", { seriesIds: ["debt.rate.domestic"], years: [2025], measure: "rate_percent" }],
    ["query_municipal", { entityIds: ["05", "11"], seriesIds: ["municipal.total"], years: [2025], measure: "amount_gel" }],
    ["describe_coverage", { datasetId: "government-debt" }],
    ["compare", { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, fromYear: 2024, toYear: 2025, measure: "amount_gel" }],
    ["rank", { datasetId: "municipal-expenditure", dimension: "entities", entityType: "municipality", seriesId: "municipal.total", fromYear: 2024, toYear: 2025, measure: "amount_gel", metric: "percentage_change", limit: 5 }],
    ["get_sources", { sourceIds: ["source.municipal_mof_annual_and_history_workbooks"], years: [2025], entityIds: ["11"] }],
    ["get_sources", { sourceIds: ["source.unknown"] }],
  ] as const)("retains English meaning, Georgian text and evidence in %s", (name, input) => {
    verifyEnglishText(run(name, input));
  });

  it("shows the exact education value once in the text row and keeps severe caveats first", () => {
    const response = run("query_national", { side: "expenditure", seriesIds: ["spending.education"], years: [2025], measure: "amount_gel" });
    const text = verifyEnglishText(response);
    expect(text.match(/3045941254/g)).toHaveLength(1);
    const municipal = run("compare", { target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] }, fromYear: 2023, toYear: 2024, measure: "amount_gel" });
    const evidence = verifyEnglishText(municipal);
    const severe = municipal.meta.caveats.filter(caveat => caveat.severity === "severe");
    const notes = municipal.meta.caveats.filter(caveat => caveat.severity === "note");
    expect(severe.length).toBeGreaterThan(0);
    expect(notes.length).toBeGreaterThan(0);
    for (const warning of severe) for (const note of notes) expect(evidence.indexOf(warning.messageEn)).toBeLessThan(evidence.indexOf(note.messageEn));
  });

  it("declares English fields and document defaults in the actual SDK schema", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "bilingual-contract-test", version: "1" });
    const server = createMcpServer();
    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      const { tools } = await client.listTools();
      expect(tools).toHaveLength(10);
      for (const tool of tools) {
        const schema = JSON.stringify(tool.outputSchema);
        for (const field of ["nameEn", "titleEn", "publisherEn", "attributionEn", "documentLanguage", "methodologyRefEn"]) expect(schema, tool.name).toContain(`"${field}"`);
        const defaults: unknown[] = [];
        function find(value: unknown): void {
          if (value === null || typeof value !== "object") return;
          for (const [key, item] of Object.entries(value)) { if (key === "documentDefaults") defaults.push(item); find(item); }
        }
        find(tool.outputSchema);
        expect(defaults.length).toBeGreaterThan(0);
        for (const value of defaults) expect(JSON.stringify(value)).toContain('"publisherEn"');
        expect(JSON.stringify(tool.inputSchema)).not.toContain('"language"');
      }
      const result = await client.callTool({ name: "query_national", arguments: { side: "expenditure", seriesIds: ["spending.education"], years: [2025], measure: "amount_gel" } });
      expect(result.isError).toBeFalsy();
      expect(JSON.stringify(result.structuredContent)).toContain('"seriesLabelEn":"Education"');
      expect(JSON.stringify(result.content)).toContain("Education");
    } finally { await client.close(); await server.close(); }
  });
});
