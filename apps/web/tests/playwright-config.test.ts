import { afterEach, describe, expect, it, vi } from "vitest";

const originalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.PLAYWRIGHT_BASE_URL;
  else process.env.PLAYWRIGHT_BASE_URL = originalBaseUrl;
  vi.resetModules();
});

describe("Playwright exact-artifact configuration", () => {
  it("does not start the default server when an external artifact URL is supplied", async () => {
    process.env.PLAYWRIGHT_BASE_URL = "http://localhost:3110";
    vi.resetModules();

    const { default: config } = await import("../playwright.config");

    expect(config.webServer).toBeUndefined();
  });
});
