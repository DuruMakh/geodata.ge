// apps/web/lib/mcp/security.ts
//
// Protocol security controls for /mcp (spec section 11.2). None of these
// establish who the caller is - the endpoint is deliberately public and
// unauthenticated because every tool reads approved public data. They stop a
// browser page on another origin from driving the endpoint with a visitor's
// credentials, and stop a caller naming a host it does not own.
import { createHash } from "node:crypto";

export type SecurityVerdict = { ok: true } | { ok: false; status: number; code: string };

/**
 * Hosts this deployment actually answers on, from its own configuration.
 *
 * Read from the Host header only. X-Forwarded-Host is client-supplied on a
 * direct connection, so honouring it would let any caller name whatever host it
 * liked and walk straight through the check (11.2: reject spoofed host
 * forwarding).
 */
function approvedHosts(): Set<string> {
  const hosts = new Set<string>();
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site !== undefined && site.length > 0) {
    try {
      hosts.add(new URL(site).host);
    } catch {
      // A malformed configured URL contributes no host rather than throwing
      // inside a request.
    }
  }
  const platform = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (platform !== undefined && platform.length > 0) hosts.add(platform);
  return hosts;
}

function approvedOrigins(): string[] {
  return (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function checkRequest(request: Request): SecurityVerdict {
  const hosts = approvedHosts();
  const host = request.headers.get("host");
  if (hosts.size > 0 && (host === null || !hosts.has(host))) {
    return { ok: false, status: 403, code: "forbidden_host" };
  }

  const origin = request.headers.get("origin");
  // No Origin at all is the normal case for a server-side MCP client and is
  // permitted. A PRESENT origin must be one this deployment explicitly
  // supports - including "null", which is what a sandboxed iframe or a file://
  // page sends. Opaque is not absent.
  if (origin !== null && !approvedOrigins().includes(origin)) {
    return { ok: false, status: 403, code: "forbidden_origin" };
  }

  return { ok: true };
}

/**
 * The CORS header to answer with, or null for no CORS at all.
 *
 * Never `*`, and never with credentials: a wildcard credentialed grant would
 * let any page on the internet drive this endpoint as the visitor.
 */
export function corsOriginFor(request: Request): string | null {
  const origin = request.headers.get("origin");
  return origin !== null && approvedOrigins().includes(origin) ? origin : null;
}

/**
 * A short-lived limiter key derived from the platform's own trusted request
 * metadata, or null when there is none to trust.
 *
 * Never from a client-supplied header: X-Forwarded-For on a direct connection
 * is a claim, and trusting it would let one caller present a thousand
 * identities and defeat the limit entirely.
 *
 * Hashed, because a raw address is personal data. Hashing does not make a
 * persistent record anonymous (11.5), so the value is used only inside its own
 * enforcement window and never written to application logs.
 */
export function clientKey(request: Request): string | null {
  const trusted = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-real-ip");
  if (trusted === null || trusted.length === 0) return null;

  return createHash("sha256").update(trusted).digest("hex").slice(0, 32);
}
