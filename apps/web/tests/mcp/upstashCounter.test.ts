import { afterEach, describe, expect, it, vi } from "vitest";
import { createCounter } from "../../lib/mcp/limits";
import { PROTOCOL_METHODS, toolNameOf } from "../../lib/mcp/toolNames";
import { TOOLS } from "../../lib/mcp/tools";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
function configure() {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("MCP_RATE_LIMITER", "upstash");
  vi.stubEnv("KV_REST_API_URL", "https://counter.upstash.io");
  vi.stubEnv("KV_REST_API_TOKEN", "test-secret");
}

describe("production shared counter", () => {
  it("uses the shared service in production and respects its denial", async () => {
    configure();
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ result: 1 })).mockResolvedValueOnce(Response.json({ result: 0 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await createCounter().hit("mcp:rate:test", 60, 60)).toBe("allow");
    expect(await createCounter().hit("mcp:rate:test", 60, 60)).toBe("deny");
    const command = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(command[0]).toBe("EVAL");
    expect(command[3]).toBe("production:mcp:rate:test");
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });
  // The script used to recognise a daily key by its window being exactly 86400
  // seconds, a number coupled to the route's own constant (U30-11).
  it("tells the script which kind of window it is counting", async () => {
    configure();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ result: 1 })));
    vi.stubGlobal("fetch", fetcher);
    await createCounter().hit("mcp:rate:test", 60, 60);
    await createCounter().hit("mcp:daily:test", 86_400, 10_000, "fixed");
    const [rolling, fixed] = fetcher.mock.calls.map((call) => JSON.parse(call[1].body));
    expect(rolling[7]).toBe("rolling");
    expect(fixed[7]).toBe("fixed");
    expect(fixed[1]).not.toContain("86400");
  });
  it.each([{ result: null }, { error: "unavailable" }, { result: "unexpected" }])("fails closed on an unusable response %#", async (body) => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
    expect(await createCounter().hit("mcp:rate:test", 60, 60)).toBe("unavailable");
  });
  it("fails closed on a timeout or service error", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network secret detail")));
    expect(await createCounter().hit("mcp:rate:test", 60, 60)).toBe("unavailable");
  });
  it("never sends credentials without HTTPS or when config is incomplete", async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    vi.stubEnv("KV_REST_API_URL", "http://counter.upstash.io");
    expect(await createCounter().hit("mcp:rate:test", 60, 60)).toBe("unavailable");
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("the daily usage tally", () => {
  it("sends one EVAL that counts the field and sets a 100-day expiry on the first count", async () => {
    configure();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ result: 1 }));
    vi.stubGlobal("fetch", fetcher);

    await createCounter().record("2026-10-29", "tools/list|ok|-|-|anthropic");

    expect(fetcher).toHaveBeenCalledTimes(1);
    const command = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(command[0]).toBe("EVAL");
    expect(command[1]).toContain("HINCRBY");
    expect(command[1]).toMatch(/== 1 then[^\n]*EXPIRE/);
    expect(command.slice(2)).toEqual([1, "production:mcp:stats:2026-10-29", "tools/list|ok|-|-|anthropic", 8_640_000]);
    expect(fetcher.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the preview namespace outside production", async () => {
    configure();
    vi.stubEnv("VERCEL_ENV", "preview");
    const fetcher = vi.fn().mockResolvedValue(Response.json({ result: 1 }));
    vi.stubGlobal("fetch", fetcher);

    await createCounter().record("2026-10-29", "ping|ok|-|-|other");

    expect(JSON.parse(fetcher.mock.calls[0][1].body)[3]).toBe("preview:mcp:stats:2026-10-29");
  });

  it("never throws, whatever the service does", async () => {
    configure();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network secret detail")));
    await expect(createCounter().record("2026-10-29", "ping|ok|-|-|other")).resolves.toBeUndefined();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(createCounter().record("2026-10-29", "ping|ok|-|-|other")).resolves.toBeUndefined();
  });

  it("sends nothing without HTTPS credentials, and refuses a day or field outside the expected shape", async () => {
    configure();
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await createCounter().record("today", "ping|ok|-|-|other");
    await createCounter().record("2026-10-29", "ping|ok|-|-|203.0.113.7 evil");
    vi.stubEnv("KV_REST_API_URL", "http://counter.upstash.io");
    await createCounter().record("2026-10-29", "ping|ok|-|-|other");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    "query_inflation_products|error|unsupported_comparison|-|other",
    "notifications/initialized|ok|-|-|unkeyed",
    "unknown_method|error|protocol_error|-|anthropic",
    "initialize|error|rate_limited|key_day|anthropic",
    "tools/call|error|service_unavailable|-|other",
  ])("accepts the field %s", async (field) => {
    configure();
    const fetcher = vi.fn().mockResolvedValue(Response.json({ result: 1 }));
    vi.stubGlobal("fetch", fetcher);
    await createCounter().record("2026-10-29", field);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // The route labels a call by a TOOLS name, a protocol method or a fixed fallback; a label the
  // pattern refuses would drop that tool out of the tally without a sound.
  it("accepts a field for every tool name, protocol method and fallback label the route can write", async () => {
    const methods = [...PROTOCOL_METHODS];
    expect(methods).toContain("tools/call");
    // The fixed fallbacks are what the route writes for a name it does not know, never the caller's text.
    expect(toolNameOf({ method: "tools/call", params: { name: "drop table" } })).toBe("unknown_tool");
    expect(toolNameOf({ method: "evil" })).toBe("unknown_method");
    expect(toolNameOf("text")).toBe("unparsed");
    expect(toolNameOf({ method: "tools/call", params: { name: "rank" } })).toBe("rank");
    const labels = [...TOOLS.map((tool) => tool.name), ...methods, "unknown_tool", "unknown_method", "unparsed"];
    configure();
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ result: 1 })));
    vi.stubGlobal("fetch", fetcher);
    for (const label of labels) await createCounter().record("2026-10-29", `${label}|error|rate_limited|key_day|anthropic`);
    expect(fetcher.mock.calls.map((call) => JSON.parse(call[1].body)[4].split("|")[0])).toEqual(labels);
  });

  it("releases the response body of a tally write", async () => {
    configure();
    const response = Response.json({ result: 1 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await createCounter().record("2026-10-29", "ping|ok|-|-|other");
    expect(response.bodyUsed).toBe(true);
  });

  it("is a harmless no-op on the in-process counter and when no limiter is configured", async () => {
    vi.stubEnv("MCP_RATE_LIMITER", "memory");
    await expect(createCounter().record("2026-10-29", "ping|ok|-|-|other")).resolves.toBeUndefined();
    vi.stubEnv("MCP_RATE_LIMITER", "");
    await expect(createCounter().record("2026-10-29", "ping|ok|-|-|other")).resolves.toBeUndefined();
  });
});

