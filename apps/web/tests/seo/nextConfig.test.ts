import { expect, it } from "vitest";
import nextConfig from "../../next.config";

it("noindexes every archived original and serves every non-PDF archived original sandboxed", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers?.filter(rule => rule.source.startsWith("/downloads/methodology/"))).toEqual([
    {
      source: "/downloads/methodology/:dataset/files/:path*",
      headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
    },
    {
      source: "/downloads/methodology/:dataset/files/:path((?!.*\\.pdf$).*)",
      headers: [{ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" }],
    },
  ]);
});

it("noindexes only third-party methodology source originals", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers).not.toContainEqual(
    expect.objectContaining({ source: "/downloads/data/:path*" }),
  );
  expect(headers).not.toContainEqual(
    expect.objectContaining({ source: "/methodology/:path*" }),
  );
});

it("retains the general security headers on every route", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers).toContainEqual({
    source: "/(.*)",
    headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Content-Security-Policy-Report-Only", value: expect.any(String) },
    ],
  });
});

it("every page sends a report-only CSP that allows only the site, Google Analytics and Clarity", async () => {
  const headers = await nextConfig.headers?.();
  const policy = headers
    ?.find(rule => rule.source === "/(.*)")
    ?.headers.find(header => header.key === "Content-Security-Policy-Report-Only")
    ?.value;

  for (const directive of ["default-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'"]) {
    expect(policy).toContain(directive);
  }
  // The script hosts site-analytics.tsx injects (www.clarity.ms/tag sits under *.clarity.ms),
  // and nothing else from outside the site.
  const scriptSources = policy?.split("; ").find(directive => directive.startsWith("script-src "));
  expect(scriptSources).toContain("https://www.googletagmanager.com");
  expect(scriptSources).toContain("https://*.clarity.ms");
  for (const host of policy?.match(/https:\/\/[^\s;]+/g) ?? []) {
    expect(host).toMatch(/^https:\/\/(www\.googletagmanager\.com|\*\.googletagmanager\.com|\*\.google-analytics\.com|\*\.analytics\.google\.com|www\.clarity\.ms|\*\.clarity\.ms|c\.bing\.com)$/);
  }
  // Report-only first: no page is blocked until the policy is deliberately switched to enforcing.
  expect(headers?.find(rule => rule.source === "/(.*)")?.headers.map(header => header.key)).not.toContain("Content-Security-Policy");
});
