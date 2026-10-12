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
    ],
  });
});
