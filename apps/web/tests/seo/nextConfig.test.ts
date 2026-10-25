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

// U14-01: page data is fetched by the page after load; its name carries a hash of its content, so it is cached for good.
it("lets browsers keep content-hashed page data for a year, out of search results", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers).toContainEqual({
    source: "/page-data/:file*",
    headers: [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      { key: "X-Robots-Tag", value: "noindex" },
    ],
  });
});

// deep-review known #10: the place index that All data's search fetches stays out of search results, in both languages.
it("noindexes the place index files", async () => {
  const headers = await nextConfig.headers?.();
  const rule = headers?.find(entry => entry.source.startsWith("/explorer-places"));
  expect(rule).toEqual({ source: "/explorer-places.:locale(ka|en).json", headers: [{ key: "X-Robots-Tag", value: "noindex" }] });
  // tests/browser/seo.spec.ts checks the served files carry it, and All data does not.
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
  // Outside development, no eval and no source wide enough to admit any host.
  expect(policy).not.toContain("'unsafe-eval'");
  for (const token of policy?.split(/[\s;]+/) ?? []) {
    expect(["*", "https:", "http:"]).not.toContain(token);
  }
  // Report-only first: no page is blocked until the policy is deliberately switched to enforcing.
  expect(headers?.find(rule => rule.source === "/(.*)")?.headers.map(header => header.key)).not.toContain("Content-Security-Policy");
});
