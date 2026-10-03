import { createMcpHandler, isLegacyRequest, WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/server";
import {
  LIMITS,
  RATE_MAX_REQUESTS,
  RATE_WINDOW_SECONDS,
  type CounterVerdict,
  createCounter,
  isPaused,
} from "../../lib/mcp/limits";
import { checkRequest, clientKey, corsOriginFor } from "../../lib/mcp/security";
import { TOOLS, createMcpServer } from "../../lib/mcp/tools";
import { logToolCall } from "../../lib/mcp/log";
import { errorCodeSchema } from "../../lib/factQuery/schemas";
import { loadPackagedSnapshot } from "../../lib/mcp/snapshot";
import { tooLargeResponse, toolResult } from "../../lib/mcp/result";

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

// Shared HTTP entry, fresh server for each exchange; no subscription capability.
let modernHandler: ReturnType<typeof createMcpHandler> | undefined;

/** Global daily ceiling across all instances (spec 11.3): 10,000 accepted requests per UTC day. */
const DAILY_MAX = 10_000;
const DAY_SECONDS = 24 * 60 * 60;

function rpcError(status: number, code: string, messageKa: string, messageEn: string, headers: HeadersInit = {}, rpcCode = -32000, id: string | number | null = null): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code: rpcCode, message: `${code}: ${messageEn}`, data: { code, messageKa, messageEn } },
      id,
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

/** The protocol methods this server implements, so the log can name them. */
const PROTOCOL_METHODS = new Set(["server/discover", "initialize", "notifications/initialized", "ping", "tools/list", "tools/call"]);

/**
 * What this call was, for the log. Never the arguments, never the body.
 *
 * Every value this returns is one of a fixed set of constants. The caller
 * controls `method` and `params.name` completely, and section 11.5 allows a
 * tool name and validated stable IDs while forbidding invalid parameter
 * strings - so echoing either straight through would write unbounded
 * caller-supplied text into retained records, sixty times a minute per key.
 * Matching against the known surface first means an unrecognised name is
 * counted, not quoted.
 */
function toolNameOf(body: unknown): string {
  if (typeof body !== "object" || body === null) return "unparsed";
  const message = body as { method?: unknown; params?: { name?: unknown } };

  if (message.method === "tools/call") {
    const name = message.params?.name;
    return typeof name === "string" && TOOLS.some((tool) => tool.name === name) ? name : "unknown_tool";
  }
  if (typeof message.method !== "string") return "unparsed";
  return PROTOCOL_METHODS.has(message.method) ? message.method : "unknown_method";
}

/** The response a counter verdict demands, or null to carry on. */
function refusalFor(verdict: CounterVerdict): Response | null {
  if (verdict === "deny") {
    return rpcError(
      429,
      "rate_limited",
      "მოთხოვნების რაოდენობა ლიმიტს გადააჭარბა. სცადეთ ერთი წუთის შემდეგ, ან ჩამოტვირთეთ ფაილები.",
      "Rate limit exceeded. Retry in a minute, or download the published files at https://fiscal.ge/downloads/data/manifest.json.",
      { "retry-after": String(RATE_WINDOW_SECONDS) },
    );
  }
  if (verdict === "unavailable") {
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
  return null;
}

/**
 * CORS preflight.
 *
 * A browser sends this before any POST carrying `content-type:
 * application/json`, so without it an origin approved in MCP_ALLOWED_ORIGINS
 * still could not reach the endpoint: Next's generated OPTIONS answers 204
 * with an `Allow` header and no CORS headers at all, and the browser stops
 * there. Runs the same pause, host and origin checks as a real request - a
 * preflight is not a reason to skip them.
 */
function preflight(request: Request): Response {
  if (isPaused()) return new Response(null, { status: 503, headers: { "retry-after": "3600" } });

  const verdict = checkRequest(request);
  const origin = corsOriginFor(request);
  if (!verdict.ok || origin === null) return new Response(null, { status: 403 });

  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, mcp-method, mcp-name",
      "access-control-max-age": "600",
      vary: "origin",
    },
  });
}

/**
 * Nothing thrown here reaches the caller or the log.
 *
 * Without this, an unexpected throw - an unreadable snapshot, a transport
 * fault - returns Next's default 500 instead of the bilingual envelope every
 * other failure uses, emits no log record at all, and writes a stack
 * containing absolute bundle paths to the platform log. Sections 11.2 and 11.5
 * forbid publishing both. The caught value is deliberately never inspected.
 */
function withResponseHeaders(request: Request, response: Response): Response {
  response.headers.append("vary", "origin");
  response.headers.set("cache-control", "no-store");
  const origin = corsOriginFor(request);
  if (origin !== null) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-expose-headers", "retry-after");
  }
  return response;
}

const LOG_ERROR_CODES = new Set<string>([...errorCodeSchema.options, "request_too_large", "forbidden_host", "forbidden_origin", "internal_error"]);

type RequestContext = { tool: string; dataVersion: string; id?: string | number };

async function handle(request: Request): Promise<Response> {
  const startedAt = Date.now();
  const context: RequestContext = { tool: "unparsed", dataVersion: "unavailable" };
  let response: Response;
  try {
    response = await serve(request, context);
  } catch {
    response = rpcError(
      500, "internal_error",
      "სერვისში მოხდა შეცდომა. მონაცემები ხელმისაწვდომია საიტზე და ჩამოსატვირთ ფაილებში.",
      "The service failed to answer this request. The data remains available at https://fiscal.ge/downloads/data/manifest.json.",
      {}, -32000, context.id,
    );
  }
  withResponseHeaders(request, response);
  const text = await response.clone().text();
  const body = text.length === 0 ? null : JSON.parse(text);
  const failed = response.status >= 400 || body?.error !== undefined || body?.result?.isError === true;
  const toolText = body?.result?.content?.find((item: { type: string }) => item.type === "text")?.text ?? "";
  const code = body?.error?.data?.code ?? /^error ([a-z_]+)/m.exec(toolText)?.[1];
  logToolCall({
    ...context,
    resultBytes: Buffer.byteLength(text, "utf8"),
    durationMs: Date.now() - startedAt,
    outcome: failed ? "error" : "ok",
    ...(failed ? { errorCode: LOG_ERROR_CODES.has(code) ? code : "protocol_error" } : {}),
  });
  return response;
}

async function serve(request: Request, context: RequestContext): Promise<Response> {
  // 1. Paused? Nothing else runs, and static pages are untouched.
  if (isPaused()) {
    return rpcError(
      503,
      "service_unavailable",
      "სერვისი დროებით მიუწვდომელია. მონაცემები კვლავ ხელმისაწვდომია საიტზე და ჩამოსატვირთ ფაილებში.",
      "The MCP service is currently unavailable. The data remains available on the site and in the published files at https://fiscal.ge/downloads/data/manifest.json.",
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

  // 3. Body cap, in two passes. The declared length is a caller's claim, so it
  // can only ever be grounds to refuse early - never grounds to accept - and a
  // caller who understates it still meets the real measurement below. Checking
  // it first is what makes 11.3's "reject before full processing" true: without
  // it every oversized request is buffered to the platform's own multi-megabyte
  // ceiling before this route says no. Read once, and hand the parsed value to
  // the transport so the body is not consumed twice.
  const tooLarge = (): Response =>
    rpcError(
      413,
      "request_too_large",
      `მოთხოვნა ზედმეტად დიდია (მაქსიმუმი ${LIMITS.bodyBytes / 1024} კბ).`,
      `Request body exceeds the ${LIMITS.bodyBytes / 1024} KiB limit.`,
    );

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > LIMITS.bodyBytes) return tooLarge();

  const chunks: Uint8Array[] = [];
  let bodyBytes = 0;
  const reader = request.body?.getReader();
  if (reader !== undefined) {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bodyBytes += chunk.value.byteLength;
      if (bodyBytes > LIMITS.bodyBytes) {
        await reader.cancel();
        return tooLarge();
      }
      chunks.push(chunk.value);
    }
  }
  const raw = new TextDecoder().decode(Buffer.concat(chunks));

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(raw);
  } catch {
    return rpcError(400, "invalid_parameters", "მოთხოვნა არასწორი JSON-ია.", "Request body is not valid JSON.", {}, -32700);
  }

  if (Array.isArray(parsedBody)) {
    return rpcError(400, "invalid_parameters", "თითოეული მოთხოვნა ცალკე გაგზავნეთ.", "Send one JSON-RPC message per HTTP request; batches are not supported.", {}, -32600);
  }
  context.tool = toolNameOf(parsedBody);
  if (typeof parsedBody === "object" && parsedBody !== null && "id" in parsedBody && (typeof parsedBody.id === "string" || typeof parsedBody.id === "number")) context.id = parsedBody.id;

  // 4. Rate limits. A counter failure stops expensive processing with a
  // retryable error rather than quietly disabling the limit (spec 11.3).
  //
  // Each limit is checked before the next one is charged. Charging the shared
  // daily budget for a request the per-key limit has already refused would let
  // a single caller spend all 10,000 of it on answers it never received, and
  // take the endpoint down for everybody else until the next UTC day - the
  // per-key limit offering no protection at all, because the very requests it
  // denies are the ones doing the spending.
  const key = clientKey(request);
  // No trusted platform header means no way to tell two callers apart, so they
  // share one bucket rather than skipping the limit. Every request on Vercel is
  // keyed; anywhere else this fails towards refusing rather than towards
  // serving, which is the posture the rest of this module takes.
  const perKey = await counter().hit(`mcp:rate:${key ?? "unkeyed"}`, RATE_WINDOW_SECONDS, RATE_MAX_REQUESTS);
  const perKeyRefusal = refusalFor(perKey);
  if (perKeyRefusal !== null) return perKeyRefusal;

  const daily = await counter().hit(`mcp:daily:${new Date().toISOString().slice(0, 10)}`, DAY_SECONDS, DAILY_MAX);
  if (daily === "deny") {
    const retryAfter = DAY_SECONDS - Math.floor(Date.now() / 1000) % DAY_SECONDS;
    return rpcError(429, "rate_limited", "დღიური ლიმიტი ამოიწურა. გამოიყენეთ ჩამოსატვირთი ფაილები ან სცადეთ შემდეგ UTC დღეს.", "The daily request allowance is exhausted. Retry after the next UTC midnight or use https://fiscal.ge/downloads/data/manifest.json.", { "retry-after": String(retryAfter) });
  }
  const dailyRefusal = refusalFor(daily);
  if (dailyRefusal !== null) return dailyRefusal;

  // 5. The SDK classifies protocol eras. Its default legacy adapter streams
  // even with responseMode: json, so use its published JSON transport for
  // that era and the discovery handler for modern traffic (same tool factory).
  context.dataVersion = loadPackagedSnapshot().dataVersion;
  const checkedRequest = new Request(request.url, {
    method: "POST", headers: request.headers, body: raw, signal: request.signal,
  });
  let response: Response;
  if (await isLegacyRequest(checkedRequest, parsedBody)) {
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      response = await transport.handleRequest(checkedRequest, { parsedBody });
    } finally { await server.close(); }
  } else {
    modernHandler ??= createMcpHandler(createMcpServer, { legacy: "reject", responseMode: "json", maxSubscriptions: 0 });
    response = await modernHandler.fetch(checkedRequest);
    // The SDK catches factory exceptions itself; keep the application's safe,
    // bilingual failure boundary rather than exposing its generic 500 body.
    if (response.status >= 500) throw new Error("MCP serving failed");
  }

  // SDK resultType/server identity metadata adds bytes after the tool's own
  // size check. Refuse the full answer if the final serialized reply is over
  // the limit; never remove evidence or return a partially trimmed answer.
  const text = await response.clone().text();
  if (Buffer.byteLength(text, "utf8") > LIMITS.resultBytes) {
    const reply = JSON.parse(text);
    const result = toolResult(tooLargeResponse(loadPackagedSnapshot(), { returned: 0, bytes: Buffer.byteLength(text, "utf8") }));
    reply.result = { ...result, ...(reply.result?.resultType ? { resultType: reply.result.resultType } : {}), ...(reply.result?._meta ? { _meta: reply.result._meta } : {}) };
    response = new Response(JSON.stringify(reply), { status: response.status, headers: response.headers });
  }

  return response;
}

export { handle as POST };
export function OPTIONS(request: Request): Response {
  return withResponseHeaders(request, preflight(request));
}
function unsupportedMethod(request: Request): Response {
  return withResponseHeaders(request, methodNotAllowed());
}
export { unsupportedMethod as GET, unsupportedMethod as DELETE };
