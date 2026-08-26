import { expect, it } from "vitest";
import nextConfig from "../../next.config";

it("noindexes only third-party methodology source originals", async () => {
  const headers = await nextConfig.headers?.();

  expect(headers).toContainEqual({
    source: "/downloads/methodology/:dataset/files/:path*",
    headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
  });
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
