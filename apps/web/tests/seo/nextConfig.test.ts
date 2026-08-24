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
