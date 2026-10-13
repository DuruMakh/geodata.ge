import { afterEach, describe, expect, it, vi } from "vitest";
import { createCounter } from "../../lib/mcp/limits";

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
