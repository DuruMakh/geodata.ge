import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("editorial design system tokens", () => {
  it("defines required CSS variables", () => {
    for (const token of [
      "--paper",
      "--tint",
      "--tile",
      "--ink",
      "--body",
      "--muted",
      "--faint",
      "--hairline",
      "--hairline-soft",
      "--row-border",
      "--control",
      "--accent",
      "--positive",
      "--negative",
      "--font-display",
      "--font-ui",
      "--font-numeric",
    ]) {
      expect(globalsCss).toContain(token);
    }
  });

  it("uses the editorial paper palette", () => {
    expect(globalsCss).toContain("#F7F2E9");
    expect(globalsCss).toContain("#1E1B16");
    expect(globalsCss).toContain("#B3402A");
  });

  it("does not reintroduce superseded theme systems", () => {
    expect(globalsCss).not.toContain("#0071e3");
    expect(globalsCss).not.toContain('[data-theme="night"]');
    expect(globalsCss).not.toContain("gradient");
  });
});
