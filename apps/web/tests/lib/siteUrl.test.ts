import { afterEach, describe, expect, it } from "vitest";
import { resolveSiteUrl } from "../../lib/siteUrl";

const ORIGINAL_ENV = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...ORIGINAL_ENV };
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      process.env[key] = value;
    }
  }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("resolveSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL and strips trailing slashes", () => {
    setEnv({
      NEXT_PUBLIC_SITE_URL: "https://fiscal.ge/",
      VERCEL_PROJECT_PRODUCTION_URL: "geodata-ge.vercel.app",
    });
    expect(resolveSiteUrl()).toBe("https://fiscal.ge");
  });

  it("rejects an explicit site URL that is not a bare HTTPS origin", () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: "https://fiscal.ge/explorer" });
    expect(() => resolveSiteUrl()).toThrow(/HTTPS origin without a path/i);
  });

  it("falls back to the Vercel production host with https", () => {
    setEnv({ VERCEL_PROJECT_PRODUCTION_URL: "geodata-ge.vercel.app" });
    expect(resolveSiteUrl()).toBe("https://geodata-ge.vercel.app");
  });

  it("falls back to localhost outside Vercel", () => {
    setEnv({});
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
  });

  it("ignores blank values", () => {
    setEnv({ NEXT_PUBLIC_SITE_URL: "  ", VERCEL_PROJECT_PRODUCTION_URL: "" });
    expect(resolveSiteUrl()).toBe("http://localhost:3000");
  });
});
