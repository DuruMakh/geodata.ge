import { expect, it } from "vitest";
import nextConfig from "../../next.config";

it.each(["external_trade_methodology.html.txt", "metadata-en.html.txt"])("isolates the captured Trade HTML original %s", async filename => {
  const headers = await nextConfig.headers?.();
  const rule = headers?.find(rule => rule.source === `/downloads/methodology/trade/files/${filename}`);
  expect(rule).toBeDefined();
  expect(rule?.headers).toContainEqual({ key: "Content-Disposition", value: "attachment" });
  expect(rule?.headers).toContainEqual({ key: "Content-Security-Policy", value: "sandbox; default-src 'none'" });
});

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
