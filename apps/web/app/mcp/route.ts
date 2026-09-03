import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { LIMITS, RATE_MAX_REQUESTS, RATE_WINDOW_SECONDS, createCounter, isPaused } from "../../lib/mcp/limits";
import { checkRequest, clientKey, corsOriginFor } from "../../lib/mcp/security";
import { createMcpServer } from "../../lib/mcp/tools";
import { logToolCall } from "../../lib/mcp/log";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";

// The only request-time code in the repository. Every other route is
// prerendered. Node runtime because the snapshot loader reads the artifact from
// the deployed bundle; never prerendered because this is a protocol endpoint,
// not a page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // spec section 11.3: 10 s request ceiling

/**
 * One counter per instance, built on first use rather than at module load so
 * the configuration is read when the instance actually starts serving. The
 * implementation behind it is shared across instances.
 */
let counterInstance: ReturnType<typeof createCounter> | undefined;
function counter(): ReturnType<typeof createCounter> {
  return (counterInstance ??= createCounter());
}

/** Global daily ceiling across all instances (spec 11.3): 10,000 accepted requests per UTC day. */
const DAILY_MAX = 10_000;
const DAY_SECONDS = 24 * 60 * 60;

function rpcError(status: number, code: string, messageKa: string, messageEn: string, headers: HeadersInit = {}): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: `${code}: ${messageEn}`, data: { code, messageKa, messageEn } },
      id: null,
    }),
    { status, headers: { "content-type": "application/json", ...headers } },
  );
}

/**
 * Only POST reaches the transport.
 *
 * The Web-standard transport answers a GET carrying `Accept: text/event-stream`
 * by opening a standalone SSE stream with a keep-alive timer, and in stateless
 * mode there is no session check to stop it. This server has nothing to push
 * down such a stream - every tool is request/response - so it would be pure
 * cost: an unauthenticated caller could pin a function instance for the full
 * 10-second ceiling with a one-line request, which is exactly the
 * "long-lived background subscription" spec 11.1 forbids and precisely the
 * compute exposure 11.4 asks us to bound.
 *
 * DELETE terminates a session, and stateless mode has none.
 *
 * Spec 11.1 anticipates this: "an ordinary browser GET returning 405 is not
 * itself a failure."
 */
function methodNotAllowed(): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. This endpoint accepts POST only." },
      id: null,
    }),
    { status: 405, headers: { "content-type": "application/json", allow: "POST" } },
  );
}

/** What this call was, for the log. Never the arguments, never the body. */
function toolNameOf(body: unknown): string {
  if (typeof body !== "object" || body === null) return "unparsed";
  const message = body as { method?: unknown; params?: { name?: unknown } };
  if (message.method === "tools/call" && typeof message.params?.name === "string") return message.params.name;
  return typeof message.method === "string" ? message.method : "unparsed";
}

async function handle(request: Request): Promise<Response> {
  const startedAt = Date.now();

  // 1. Paused? Nothing else runs, and static pages are untouched.
  if (isPaused()) {
    return rpcError(
      503,
      "service_unavailable",
      "სერვისი დროებით მიუწვდომელია. მონაცემები კვლავ ხელმისაწვდომია საიტზე და ჩამოსატვირთ ფაილებში.",
      "The MCP service is currently unavailable. The data remains available on the site and in the published files at https://fiscal.ge/downloads/data/.",
      { "retry-after": "3600" },
    );
  }

  // 2. Protocol security controls, before any work.
  const verdict = checkRequest(request);
  if (!verdict.ok) {
    return rpcError(
      verdict.status,
      verdict.code,
      "მოთხოვნა უარყოფილია.",
      "Request rejected: origin or host is not configured for this deployment.",
    );
  }

  // 3. Body cap, measured on the actual bytes rather than a Content-Length the
  // caller controls. Read once and hand the parsed value to the transport so
  // the body is not consumed twice.
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > LIMITS.bodyBytes) {
    return rpcError(
      413,
      "result_too_large",
      `მოთხოვნა ზედმეტად დიდია (მაქსიმუმი ${LIMITS.bodyBytes / 1024} კბ).`,
      `Request body exceeds the ${LIMITS.bodyBytes / 1024} KiB limit.`,
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return rpcError(400, "invalid_parameters", "მოთხოვნა არასწორი JSON-ია.", "Request body is not valid JSON.");
  }

  // 4. Rate limits. A counter failure stops expensive processing with a
  // retryable error rather than quietly disabling the limit (spec 11.3).
  const key = clientKey(request);
  const perKey = key === null ? "allow" : await counter().hit(`mcp:rate:${key}`, RATE_WINDOW_SECONDS, RATE_MAX_REQUESTS);
  const daily = await counter().hit(`mcp:daily:${new Date().toISOString().slice(0, 10)}`, DAY_SECONDS, DAILY_MAX);

  for (const outcome of [perKey, daily]) {
    if (outcome === "deny") {
      return rpcError(
        429,
        "rate_limited",
        "მოთხოვნების რაოდენობა ლიმიტს გადააჭარბა. სცადეთ ერთი წუთის შემდეგ, ან ჩამოტვირთეთ ფაილები.",
        "Rate limit exceeded. Retry in a minute, or download the published files at https://fiscal.ge/downloads/data/.",
        { "retry-after": String(RATE_WINDOW_SECONDS) },
      );
    }
    if (outcome === "unavailable") {
      // No configured shared limiter, or the limiter itself failed. Serving
      // unlimited public traffic is a section 18 stop condition, so this fails
      // closed rather than open.
      return rpcError(
        503,
        "service_unavailable",
        "სერვისი დროებით მიუწვდომელია.",
        "Request limiting is unavailable, so the service is not accepting requests. Try again later.",
        { "retry-after": "60" },
      );
    }
  }

  // 5. Stateless: no sessionIdGenerator, so no session store and no
  // cross-request state to keep consistent across instances (spec 11.1).
  // enableJsonResponse keeps a fixed single POST a plain JSON reply.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer();

  await server.connect(transport);
  let response: Response;
  try {
    response = await transport.handleRequest(request, { parsedBody });
  } finally {
    // One transport per request: close it whether the call succeeded or threw,
    // so a failed request cannot leave a stream open on a reused instance.
    await server.close();
  }

  const cors = corsOriginFor(request);
  if (cors !== null) {
    // The one approved origin, echoed exactly. Never `*`, and never with
    // credentials.
    response.headers.set("access-control-allow-origin", cors);
    response.headers.set("vary", "origin");
  }

  logToolCall({
    tool: toolNameOf(parsedBody),
    dataVersion: loadPackagedSnapshot().dataVersion,
    resultCount: 0,
    resultBytes: Number(response.headers.get("content-length") ?? 0),
    durationMs: Date.now() - startedAt,
    outcome: response.status < 400 ? "ok" : "error",
  });

  return response;
}

export { handle as POST };
export { methodNotAllowed as GET, methodNotAllowed as DELETE };
