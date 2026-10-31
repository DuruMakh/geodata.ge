// apps/web/lib/mcp/providerRanges.ts
//
// Reviewed, vendored address ranges for the coarse client class in the usage
// tally (security.ts). Constants only: /mcp's one runtime network operation is
// Upstash, so nothing here is fetched. A stale range can only misfile traffic as
// "other", which is the safe direction, because the class never changes a limit.

/**
 * The one outbound IPv4 range Anthropic publishes for Claude's server-side
 * calls, "for example, when making MCP tool calls to external servers" (2,048
 * addresses). Source: https://platform.claude.com/docs/en/api/ip-addresses,
 * read 2026-10-29. Anthropic says it "will not change without notice".
 */
export const ANTHROPIC_EGRESS_CIDR = "160.79.104.0/21";

function ipv4ToNumber(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part) || Number(part) > 255) return null;
    value = value * 256 + Number(part);
  }
  return value;
}

/** Is a dotted IPv4 address inside an IPv4 CIDR range? Anything unreadable is outside. */
export function inIpv4Cidr(ip: string, cidr: string): boolean {
  const [base, bits, ...rest] = cidr.split("/");
  const address = ipv4ToNumber(ip);
  const network = ipv4ToNumber(base ?? "");
  if (rest.length > 0 || bits === undefined || !/^\d{1,2}$/.test(bits) || Number(bits) > 32 || address === null || network === null) return false;

  const hostBits = 32 - Number(bits);
  return Math.floor(address / 2 ** hostBits) === Math.floor(network / 2 ** hostBits);
}
