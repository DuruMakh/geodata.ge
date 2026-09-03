import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITS } from "../../lib/mcp/result";
import { createCounter, isPaused, memoryCounter } from "../../lib/mcp/limits";
import { logToolCall, type ToolCallLog } from "../../lib/mcp/log";

const original = { ...process.env };

beforeEach(() => {
  delete process.env.MCP_ENABLED;
  delete process.env.MCP_RATE_LIMITER;
});

afterEach(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

describe("the pause switch", () => {
  // Default OFF. Spec 18 makes both unapproved paid services and
  // per-process-only abuse protection stop conditions, so the endpoint ships
  // deployed and dark until the owner authorises hosting and any budget.
  it("is paused unless explicitly enabled", () => {
    expect(isPaused()).toBe(true);
  });

  it("stays paused for any value that is not exactly true", () => {
    for (const value of ["", "false", "1", "yes", "TRUE ", "on"]) {
      process.env.MCP_ENABLED = value;
      expect(isPaused(), `MCP_ENABLED=${JSON.stringify(value)}`).toBe(true);
    }
  });

  it("runs when explicitly enabled", () => {
    process.env.MCP_ENABLED = "true";
    expect(isPaused()).toBe(false);
  });
});

describe("the shared counter", () => {
  // Spec 11.3: enforce shared quotas with platform controls or a minimal
  // approved shared counter, NOT process-local memory. With nothing
  // configured the endpoint must fail closed rather than serve unlimited
  // public traffic.
  it("fails closed when no limiter is configured", async () => {
    const counter = createCounter();

    expect(await counter.hit("k", 60, 60)).toBe("unavailable");
  });

  it("offers an in-memory counter for development only", async () => {
    process.env.MCP_RATE_LIMITER = "memory";
    const counter = createCounter();

    expect(await counter.hit("k", 60, 60)).toBe("allow");
  });

  it("denies once the window's allowance is spent", async () => {
    const counter = memoryCounter();
    const results: string[] = [];
    for (let i = 0; i < 4; i += 1) results.push(await counter.hit("same-key", 60, 3));

    expect(results).toEqual(["allow", "allow", "allow", "deny"]);
  });

  it("counts each key separately", async () => {
    const counter = memoryCounter();
    await counter.hit("a", 60, 1);

    expect(await counter.hit("b", 60, 1)).toBe("allow");
    expect(await counter.hit("a", 60, 1)).toBe("deny");
  });

  it("carries the operating limits spec 11.3 sets", () => {
    expect(LIMITS.bodyBytes).toBe(32 * 1024);
    expect(LIMITS.cells).toBe(500);
    expect(LIMITS.resultBytes).toBe(512 * 1024);
    expect(LIMITS.durationMs).toBe(10_000);
  });
});

describe("logging", () => {
  function captureLog(record: Record<string, unknown>): Record<string, unknown> {
    const written: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
      written.push(String(chunk));
      return true;
    });
    logToolCall(record as unknown as ToolCallLog);
    return JSON.parse(written.join("")) as Record<string, unknown>;
  }

  // Spec 11.5: no raw prompts, invalid parameter strings, request bodies,
  // authorization headers, full user agents, or IP addresses. Building from an
  // allow-list rather than spreading the caller's object is what makes that
  // structural instead of a habit.
  it("drops every field that is not on the allow-list", () => {
    const emitted = captureLog({
      tool: "query_national",
      dataVersion: "abc",
      resultCount: 1,
      resultBytes: 100,
      durationMs: 5,
      outcome: "ok",
      ip: "1.2.3.4",
      userAgent: "Mozilla/5.0 (very identifying)",
      body: '{"secret":"value"}',
      prompt: "what did Khulo spend",
      authorization: "Bearer token",
    });

    expect(emitted.tool).toBe("query_national");
    expect(emitted.ip).toBeUndefined();
    expect(emitted.userAgent).toBeUndefined();
    expect(emitted.body).toBeUndefined();
    expect(emitted.prompt).toBeUndefined();
    expect(emitted.authorization).toBeUndefined();

    const serialized = JSON.stringify(emitted);
    expect(serialized).not.toContain("1.2.3.4");
    expect(serialized).not.toContain("Khulo");
    expect(serialized).not.toContain("Bearer");
  });

  it("keeps the fields that describe the tool activity", () => {
    const emitted = captureLog({
      tool: "query_municipal",
      datasetId: "municipal-expenditure",
      measure: "amount_gel",
      years: "2015-2025",
      entityCount: 64,
      seriesCount: 1,
      dataVersion: "abc",
      resultCount: 704,
      resultBytes: 12345,
      durationMs: 9,
      outcome: "ok",
    });

    expect(emitted).toMatchObject({
      tool: "query_municipal",
      datasetId: "municipal-expenditure",
      measure: "amount_gel",
      years: "2015-2025",
      resultCount: 704,
      outcome: "ok",
    });
  });
});
