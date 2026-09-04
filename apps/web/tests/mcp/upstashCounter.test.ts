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
