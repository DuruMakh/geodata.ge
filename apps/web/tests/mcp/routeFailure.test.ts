import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// An unexpected failure inside the handler - an unreadable snapshot, a
// transport fault - used to escape the route entirely. Next then returned its
// own 500 instead of the bilingual envelope every other failure uses, wrote the
// error's stack (absolute bundle paths and all) to the platform log, and
// emitted no application log record at all. Sections 11.2 and 11.5 forbid
// publishing both.
//
// The message deliberately carries everything that must not come back out.
const FAILURE = vi.hoisted(() => ({
  message: "ENOENT: no such file or directory, open 'C:\\var\\task\\lib\\factQuery\\generated\\snapshot.json'",
}));

vi.mock("../../lib/mcp/tools", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/mcp/tools")>();
  return {
    ...actual,
    createMcpServer: () => {
      throw new Error(FAILURE.message);
    },
  };
});

import { POST } from "../../app/mcp/route";

const ENDPOINT = "https://fiscal.ge/mcp";
const original = { ...process.env };
const written: string[] = [];

beforeAll(() => {
  process.env.MCP_ENABLED = "true";
  process.env.MCP_RATE_LIMITER = "memory";
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk));
    return true;
  });
});

afterAll(() => {
  process.env = { ...original };
  vi.restoreAllMocks();
});

function post(): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      host: "fiscal.ge",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1.0.0" } },
    }),
  });
}

describe("an unexpected failure inside the handler", () => {
  it("preserves a modern request ID while keeping snapshot failures bilingual and private", async () => {
    const response = await POST(new Request(ENDPOINT, {
      method: "POST", headers: { host: "fiscal.ge", "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-protocol-version": "2026-07-28", "mcp-method": "server/discover" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "failed-modern-id", method: "server/discover", params: { _meta: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": { name: "failure-test", version: "1" },
        "io.modelcontextprotocol/clientCapabilities": {},
      } } }),
    }));
    const text = await response.text();
    expect(response.status).toBe(500);
    expect(JSON.parse(text).id).toBe("failed-modern-id");
    expect(text).toContain("internal_error");
    expect(text).toMatch(/[Ⴀ-ჿ]/);
    expect(text).not.toContain("snapshot.json");
    expect(text).not.toContain("ENOENT");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("answers with the service's own bilingual error, not the framework's", async () => {
    const response = await POST(post());
    const body = await response.text();

    expect(response.status).toBe(500);
    expect(body).toContain("internal_error");
    expect(body).toMatch(/[Ⴀ-ჿ]/);
    // A failure of the service is not a disappearance of the data, and the
    // message has to say where the figures still are.
    expect(body).toContain("/downloads/data/");
  });

  it("puts neither the path nor the caught message into the response", async () => {
    const body = await (await POST(post())).text();

    expect(body).not.toContain("snapshot.json");
    expect(body).not.toContain("ENOENT");
    expect(body).not.toMatch(/[A-Za-z]:\\|\/var\/task|node_modules/);
  });

  it("still emits exactly one allow-listed log record, carrying no caught text", async () => {
    written.length = 0;
    await POST(post());

    expect(written).toHaveLength(1);
    const record = JSON.parse(written[0]!) as Record<string, unknown>;

    expect(record.outcome).toBe("error");
    expect(record.errorCode).toBe("internal_error");
    expect(written[0]).not.toContain("snapshot.json");
    expect(written[0]).not.toContain("ENOENT");
  });
});
