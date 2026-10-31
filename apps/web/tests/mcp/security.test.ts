import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRequest, clientClass, clientKey } from "../../lib/mcp/security";
import { ANTHROPIC_EGRESS_CIDR, inIpv4Cidr } from "../../lib/mcp/providerRanges";

const untouched = vi.hoisted(() => ({ counter: vi.fn(), snapshot: vi.fn(), server: vi.fn() }));
vi.mock("../../lib/mcp/limits", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/mcp/limits")>(),
  createCounter: untouched.counter,
}));
vi.mock("../../lib/mcp/snapshot", () => ({ loadPackagedSnapshot: untouched.snapshot }));
vi.mock("../../lib/mcp/tools", async importOriginal => ({
  ...await importOriginal<typeof import("../../lib/mcp/tools")>(),
  createMcpServer: untouched.server,
}));
import { GET, DELETE } from "../../app/mcp/route";

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

// A coarse class for the usage tally, never an identity. It tests the same
// trusted address clientKey hashes, and answers only one of three words.
describe("clientClass", () => {
  const classOf = (headers: Record<string, string>): string => clientClass(request({ host: "fiscal.ge", ...headers }));

  it("calls an address inside Anthropic's published egress range anthropic", () => {
    expect(ANTHROPIC_EGRESS_CIDR).toBe("160.79.104.0/21");
    expect(classOf({ "x-vercel-forwarded-for": "160.79.104.1" })).toBe("anthropic");
    expect(classOf({ "x-vercel-forwarded-for": "160.79.111.255" })).toBe("anthropic");
  });

  it("calls an address just outside that range other", () => {
    expect(classOf({ "x-vercel-forwarded-for": "160.79.112.0" })).toBe("other");
    expect(classOf({ "x-vercel-forwarded-for": "160.79.103.255" })).toBe("other");
    expect(classOf({ "x-vercel-forwarded-for": "203.0.113.7" })).toBe("other");
  });

  it("calls an address it cannot read other, and a request with none unkeyed", () => {
    expect(classOf({ "x-vercel-forwarded-for": "2001:db8::1" })).toBe("other");
    expect(classOf({ "x-vercel-forwarded-for": "not an address" })).toBe("other");
    expect(classOf({})).toBe("unkeyed");
    expect(classOf({ "x-vercel-forwarded-for": "" })).toBe("unkeyed");
  });

  it("does not trust a client-supplied address, exactly like clientKey", () => {
    expect(classOf({ "x-forwarded-for": "160.79.104.1" })).toBe("unkeyed");
  });
});

describe("inIpv4Cidr", () => {
  it.each([
    ["10.0.0.0", "10.0.0.0/8", true],
    ["10.255.255.255", "10.0.0.0/8", true],
    ["11.0.0.0", "10.0.0.0/8", false],
    ["192.0.2.1", "192.0.2.1/32", true],
    ["192.0.2.2", "192.0.2.1/32", false],
    ["1.2.3.4", "0.0.0.0/0", true],
    ["255.255.255.255", "128.0.0.0/1", true],
    ["127.0.0.1", "128.0.0.0/1", false],
  ])("%s in %s is %s", (ip, cidr, expected) => {
    expect(inIpv4Cidr(ip, cidr)).toBe(expected);
  });

  it.each(["", "1.2.3", "1.2.3.4.5", "256.1.1.1", "1.2.3.-4", "01.2.3.4x", "::1", " 1.2.3.4", "1.2.3.4 "])("rejects the non-address %j", (ip) => {
    expect(inIpv4Cidr(ip, "0.0.0.0/0")).toBe(false);
  });

  it.each(["10.0.0.0", "10.0.0.0/33", "10.0.0.0/-1", "10.0.0.0/x", "bad/8"])("treats the malformed range %j as matching nothing", (cidr) => {
    expect(inIpv4Cidr("10.0.0.1", cidr)).toBe(false);
  });
});

// The leak assertion that used to live here serialized this verdict object -
// `{ok:false,status:403,code:"forbidden_host"}` - and asserted a fixed literal
// contained no secret, which it could never do. It is now made against the
// actual rejection responses, in tests/mcp/route.test.ts, where a body that
// could leak something is available to assert on.

describe("a host the deployment has not configured", () => {
  it("is refused outright in production, where nothing configured is a mistake", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_ENV = "production";

    expect(checkRequest(request({ host: "anything.example" })).ok).toBe(false);
  });

  it("is still answered outside production, where a bare dev server has no site URL", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    expect(checkRequest(request({ host: "localhost:3000" })).ok).toBe(true);
  });

  it("matches a configured host whatever case the caller sends it in", () => {
    expect(checkRequest(request({ host: "FISCAL.GE" })).ok).toBe(true);
  });
});

// A preview is neither the configured site nor production. Vercel reports the
// PRODUCTION domain in VERCEL_PROJECT_PRODUCTION_URL there as well, so without
// the deployment's own address the allowlist refuses the deployment itself -
// a check that rejects nobody but us.
describe("a preview deployment's own host", () => {
  beforeEach(() => {
    process.env.VERCEL_ENV = "preview";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "fiscal.ge";
  });

  it("is accepted on the stable branch address", () => {
    process.env.VERCEL_BRANCH_URL = "geodata-ge-git-branch-team.vercel.app";

    expect(checkRequest(request({ host: "geodata-ge-git-branch-team.vercel.app" }))).toEqual({ ok: true });
  });

  it("is accepted on the per-deployment address", () => {
    process.env.VERCEL_URL = "geodata-ge-abc123-team.vercel.app";

    expect(checkRequest(request({ host: "geodata-ge-abc123-team.vercel.app" }))).toEqual({ ok: true });
  });

  it("does not widen the allowlist to an unrelated host", () => {
    process.env.VERCEL_BRANCH_URL = "geodata-ge-git-branch-team.vercel.app";

    expect(checkRequest(request({ host: "attacker.example" })).ok).toBe(false);
  });

  // The whole point of the guard: production keeps the configured identity as
  // its entire allowlist, so nothing the platform reports about a deployment
  // widens it there.
  it("is not honoured in production", () => {
    process.env.VERCEL_ENV = "production";
    process.env.VERCEL_BRANCH_URL = "geodata-ge-git-branch-team.vercel.app";
    process.env.VERCEL_URL = "geodata-ge-abc123-team.vercel.app";

    expect(checkRequest(request({ host: "geodata-ge-abc123-team.vercel.app" })).ok).toBe(false);
  });
});

describe.each([GET, DELETE])("unsupported-method request policy %#", handle => {
  it.each([
    [{ host: "fiscal.ge" }, 405, undefined],
    [{ host: "fiscal.ge", origin: "https://approved.example" }, 405, undefined],
    [{ host: "fiscal.ge", origin: "https://evil.example" }, 403, "forbidden_origin"],
    [{ host: "fiscal.ge", origin: "null" }, 403, "forbidden_origin"],
    [{ host: "evil.example" }, 403, "forbidden_host"],
    [{}, 403, "forbidden_host"],
  ] as const)("refuses the request before data, sessions, streams or limiter work %#", async (headers, status, code) => {
    process.env.MCP_ALLOWED_ORIGINS = "https://approved.example";
    const response = handle(new Request(ENDPOINT, { method: handle === DELETE ? "DELETE" : "GET", headers: { ...headers, accept: "text/event-stream" } }));
    expect(response.status).toBe(status);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("mcp-session-id")).toBeNull();
    const body = await response.json();
    if (status === 405) {
      expect(response.headers.get("allow")).toBe("POST");
      expect(body.error.message).toContain("POST only");
    } else {
      expect(body.error.data.code).toBe(code);
      expect(body.error.data.messageKa).toMatch(/[Ⴀ-ჿ]/);
    }
    expect(untouched.counter).not.toHaveBeenCalled();
    expect(untouched.snapshot).not.toHaveBeenCalled();
    expect(untouched.server).not.toHaveBeenCalled();
  });
});
