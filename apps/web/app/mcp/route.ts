import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../../lib/mcp/tools";

// The only request-time code in the repository. Every other route is
// prerendered. Node runtime because the snapshot loader reads the artifact from
// the deployed bundle; never prerendered because this is a protocol endpoint,
// not a page.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10; // spec section 11.3: 10 s request ceiling

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

async function handle(request: Request): Promise<Response> {
  // Stateless: no sessionIdGenerator, so no session store and no cross-request
  // state to keep consistent across function instances (spec 11.1).
  // enableJsonResponse keeps a fixed single POST a plain JSON reply rather than
  // an SSE stream.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createMcpServer();

  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // One transport per request: close it whether the call succeeded or threw,
    // so a failed request cannot leave a stream open on a reused instance.
    await server.close();
  }
}

export { handle as POST };
export { methodNotAllowed as GET, methodNotAllowed as DELETE };
