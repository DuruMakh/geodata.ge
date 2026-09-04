import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const analyticsSource = readFileSync(resolve(process.cwd(), "components/site/site-analytics.tsx"), "utf8");

describe("site analytics loading", () => {
  it("defers Google Analytics while preserving Clarity's existing integration", () => {
    expect(analyticsSource).toContain('<Script id="google-analytics" strategy="lazyOnload">');
    expect(analyticsSource).toContain('<Script id="microsoft-clarity" strategy="afterInteractive">');
    expect(analyticsSource).toContain('script.src = "https://www.googletagmanager.com/gtag/js?id=G-RRS446MKJW"');
    expect(analyticsSource).toContain('t.src = "https://www.clarity.ms/tag/" + i');
  });
});
