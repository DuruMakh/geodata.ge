import { expect, it } from "vitest";
import nextConfig from "../../next.config";

it("every archived original is served sandboxed", async () => {
  const headers = await nextConfig.headers?.();
  const rule = headers?.find(rule => rule.source === "/downloads/methodology/:dataset/files/:path*");
  expect(rule?.headers).toContainEqual({ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" });
  expect(rule?.headers).toContainEqual({ key: "X-Robots-Tag", value: "noindex, follow" });
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
