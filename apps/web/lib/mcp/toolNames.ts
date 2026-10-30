// apps/web/lib/mcp/toolNames.ts
//
// The fixed labels a /mcp call is known by in the log and in the usage tally. They live here, not in the route, so
// the tally's tests read the same set the route writes.
import { TOOLS } from "./tools";

/** The protocol methods this server implements, so the log can name them. */
export const PROTOCOL_METHODS = new Set(["server/discover", "initialize", "notifications/initialized", "ping", "tools/list", "tools/call"]);

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
export function toolNameOf(body: unknown): string {
  if (typeof body !== "object" || body === null) return "unparsed";
  const message = body as { method?: unknown; params?: { name?: unknown } };

  if (message.method === "tools/call") {
    const name = message.params?.name;
    return typeof name === "string" && TOOLS.some((tool) => tool.name === name) ? name : "unknown_tool";
  }
  if (typeof message.method !== "string") return "unparsed";
  return PROTOCOL_METHODS.has(message.method) ? message.method : "unknown_method";
}
