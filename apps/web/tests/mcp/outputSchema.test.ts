import { beforeAll, describe, expect, it } from "vitest";
import { buildFactQuerySnapshot } from "../../lib/factQuery/buildSnapshot";
import { TOOLS } from "../../lib/mcp/tools";
import { toolOutput } from "../../lib/mcp/outputSchema";
import { toolResult } from "../../lib/mcp/result";
import type { FactQuerySnapshot } from "../../lib/factQuery/types";

let snapshot: FactQuerySnapshot;

beforeAll(async () => {
  snapshot = await buildFactQuerySnapshot({ releaseCommit: "test", generatedAt: "2026-09-04T00:00:00.000Z" });
});

/**
 * One real, successful call per tool. The SDK validates structuredContent
 * against the declared output schema and fails the call on a mismatch, so a
 * schema that does not match reality would break every request rather than
 * merely mis-describe one.
 */
const CALLS: Record<string, unknown> = {
  describe_coverage: { datasetId: "municipal-expenditure" },
  query_national: { side: "revenue", seriesIds: ["revenue.total"], years: [2024], measure: "amount_gel" },
  query_ministries: {
    level: "admin_category",
    seriesIds: ["admin_spending.defence"],
    years: [2024],
    measure: "amount_gel",
  },
  query_municipal: { entityIds: ["11"], seriesIds: ["municipal.total"], years: [2024], measure: "amount_gel" },
  compare: {
    target: { dataset: "municipal", entityIds: ["11"], seriesIds: ["municipal.total"] },
    fromYear: 2023,
    toYear: 2024,
    measure: "amount_gel",
  },
  rank: {
    datasetId: "municipal-expenditure",
    dimension: "entities",
    entityType: "municipality",
    seriesId: "municipal.total",
    year: 2025,
    measure: "amount_gel",
    metric: "value",
    order: "descending",
    limit: 5,
  },
  get_sources: { sourceIds: ["source.municipal_mof_annual_and_history_workbooks"] },
};

describe("every tool's structured output matches its declared schema", () => {
  for (const tool of TOOLS) {
    it(`${tool.name} returns structuredContent the schema accepts`, () => {
      const input = CALLS[tool.name];
      expect(input, `no probe call defined for ${tool.name}`).toBeDefined();

      const response = tool.run(snapshot, input);
      if (response.kind === "error") throw new Error(`${tool.name}: ${response.error.messageEn}`);

      const result = toolResult(response);
      expect(result.structuredContent).toBeDefined();

      const parsed = toolOutput.safeParse(result.structuredContent);
      if (!parsed.success) {
        throw new Error(`${tool.name} failed its own output schema: ${JSON.stringify(parsed.error.issues, null, 2)}`);
      }
    });
  }

  // Every probe above must exist, or a tool could be added without ever being
  // validated against the schema it now advertises.
  it("covers all seven tools", () => {
    expect(Object.keys(CALLS).sort()).toEqual(TOOLS.map((tool) => tool.name).sort());
  });

  // A failed call carries no structured payload, which is why the schema
  // describes successes only.
  it("attaches no structuredContent to an error, so the schema is never applied to one", () => {
    const failed = TOOLS.find((tool) => tool.name === "query_municipal")!.run(snapshot, { entityIds: [] });
    expect(failed.kind).toBe("error");

    const result = toolResult(failed);
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
  });
});
