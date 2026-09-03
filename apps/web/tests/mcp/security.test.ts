import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkRequest, clientKey } from "../../lib/mcp/security";

const ENDPOINT = "https://fiscal.ge/mcp";
const original = { ...process.env };

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge";
  delete process.env.MCP_ALLOWED_ORIGINS;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
});

afterEach(() => {
  process.env = { ...original };
});

function request(headers: Record<string, string>): Request {
  return new Request(ENDPOINT, { method: "POST", headers, body: "{}" });
}

describe("origin and host validation", () => {
  // Spec 11.2: permit origin-less server clients when otherwise valid. Most MCP
  // clients are servers and send no Origin at all; rejecting them would reject
  // the primary audience.
  it("allows a request with no Origin at all", () => {
    expect(checkRequest(request({ host: "fiscal.ge" }))).toEqual({ ok: true });
  });

  it("rejects a present but unapproved Origin", () => {
    const result = checkRequest(request({ host: "fiscal.ge", origin: "https://evil.example" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  // "null" is what a sandboxed iframe or a file:// page sends. Opaque is not
  // absent, and it must not be treated as the trusted no-Origin case.
  it("rejects an opaque null Origin rather than treating it as absent", () => {
    const result = checkRequest(request({ host: "fiscal.ge", origin: "null" }));

    expect(result.ok).toBe(false);
  });

  it("allows an explicitly approved Origin", () => {
    process.env.MCP_ALLOWED_ORIGINS = "https://claude.ai,https://fiscal.ge";

    expect(checkRequest(request({ host: "fiscal.ge", origin: "https://claude.ai" }))).toEqual({ ok: true });
  });

  it("rejects a Host outside the deployment's own configuration", () => {
    const result = checkRequest(request({ host: "attacker.example" }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(403);
  });

  // Spec 11.2: reject spoofed host forwarding. X-Forwarded-Host is
  // client-supplied on a direct connection, so honouring it would let any
  // caller name whatever host it liked.
  it("ignores X-Forwarded-Host when deciding the host", () => {
    const result = checkRequest(request({ host: "attacker.example", "x-forwarded-host": "fiscal.ge" }));

    expect(result.ok).toBe(false);
  });

  it("accepts the deployment's own platform host", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "geodata-ge.vercel.app";

    expect(checkRequest(request({ host: "geodata-ge.vercel.app" }))).toEqual({ ok: true });
  });
});

describe("client identification", () => {
  // Spec 11.3: obtain limiter addresses only from trusted platform request
  // metadata. A client-supplied header is a claim, not an identity, and
  // trusting it would let one caller present 1,000 identities.
  it("does not accept a client-supplied address as an identity", () => {
    expect(clientKey(request({ host: "fiscal.ge", "x-forwarded-for": "1.2.3.4" }))).toBeNull();
  });

  it("reads the platform's own trusted metadata when present", () => {
    const key = clientKey(request({ host: "fiscal.ge", "x-vercel-forwarded-for": "5.6.7.8" }));

    expect(key).not.toBeNull();
    // Never the raw address: it is hashed, and hashing does not make a
    // persistent record anonymous, so it is also short-lived by policy (11.5).
    expect(key).not.toContain("5.6.7.8");
  });
});

describe("rejection responses leak nothing", () => {
  it("names no environment variable, path or stack frame", () => {
    process.env.SECRET_TEST_VALUE = "super-secret-value";
    const result = checkRequest(request({ host: "attacker.example", origin: "https://evil.example" }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("super-secret-value");
    expect(serialized).not.toContain("SECRET_TEST_VALUE");
    expect(serialized).not.toMatch(/[A-Za-z]:\\|\/home\/|\/var\/task|node_modules/);
    expect(serialized).not.toContain("at ");
  });
});
