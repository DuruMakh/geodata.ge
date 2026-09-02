import { describe, expect, it } from "vitest";
import { POST, GET, DELETE } from "../../app/mcp/route";

const ENDPOINT = "https://fiscal.ge/mcp";
const PROTOCOL = "2025-11-25";

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const initialize = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: "route-test", version: "1.0.0" },
  },
};

async function jsonOf(response: Response): Promise<Record<string, never>> {
  const text = await response.text();
  // enableJsonResponse returns plain JSON, but accept an SSE frame too so this
  // test pins behaviour rather than one transport setting.
  const payload = text.startsWith("event:") || text.startsWith("data:")
    ? text.split("\n").find((line) => line.startsWith("data:"))!.slice(5).trim()
    : text;
  return JSON.parse(payload);
}

describe("/mcp route", () => {
  it("initializes at the declared protocol revision", async () => {
    const response = await POST(post(initialize));
    const body = await jsonOf(response);

    expect(response.status).toBe(200);
    expect((body as unknown as { result: { protocolVersion: string } }).result.protocolVersion).toBe(PROTOCOL);
    // Stateless: no session to hand back, so no session header (spec 11.1).
    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("advertises the server instructions on initialize", async () => {
    const body = await jsonOf(await POST(post(initialize)));
    const result = (body as unknown as { result: { instructions?: string; serverInfo: { name: string } } }).result;

    expect(result.serverInfo.name).toBe("fiscal-ge");
    expect(result.instructions).toContain("CC BY 4.0");
  });

  it("lists the seven tools", async () => {
    const body = await jsonOf(
      await POST(post({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, { "mcp-protocol-version": PROTOCOL })),
    );
    const tools = (body as unknown as { result: { tools: { name: string }[] } }).result.tools;

    expect(tools).toHaveLength(7);
    expect(tools.map((tool) => tool.name)).toContain("query_national");
  });

  it("answers a tool call with a figure", async () => {
    const body = await jsonOf(
      await POST(
        post(
          {
            jsonrpc: "2.0",
            id: 3,
            method: "tools/call",
            params: {
              name: "query_national",
              arguments: { side: "expenditure", seriesIds: ["expenditure.total"], years: [2024], measure: "amount_gel" },
            },
          },
          { "mcp-protocol-version": PROTOCOL },
        ),
      ),
    );
    const result = (body as unknown as { result: { isError?: boolean; content: { text: string }[] } }).result;

    expect(result.isError).toBeFalsy();
    expect(result.content[0]!.text).toContain("2024");
    expect(result.content[0]!.text).toContain("CC BY 4.0");
  });

  it("returns a JSON-RPC error for an unknown method", async () => {
    const body = await jsonOf(
      await POST(post({ jsonrpc: "2.0", id: 4, method: "nonsense/method", params: {} }, { "mcp-protocol-version": PROTOCOL })),
    );

    expect((body as unknown as { error: { code: number } }).error.code).toBe(-32601);
  });

  it("rejects malformed JSON without a 200", async () => {
    const response = await POST(post("{not json", { "mcp-protocol-version": PROTOCOL }));

    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  // Spec 11.1: no long-lived background subscriptions. Passed straight to the
  // transport, a GET with this Accept header returns 200 and opens a
  // keep-alive SSE stream that this server has nothing to push to - an
  // unauthenticated way to pin a function instance for the full 10-second
  // ceiling. It is rejected before the transport sees it. An ordinary browser
  // GET returning 405 is not itself a failure.
  it("refuses to open a stream on GET", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(response.headers.get("content-type")).toContain("application/json");
    // Not a stream: the body is finite and readable in one go.
    expect(await response.text()).toContain("POST only");
  });

  it("refuses a session DELETE, having no sessions", () => {
    expect(DELETE().status).toBe(405);
  });

  it("declares the runtime and duration the deployment needs", async () => {
    const segment = await import("../../app/mcp/route");

    expect(segment.runtime).toBe("nodejs");
    expect(segment.dynamic).toBe("force-dynamic");
    expect(segment.maxDuration).toBe(10);
  });
});
