import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

describe("approved design system tokens", () => {
  it("defines required CSS variables", () => {
    for (const token of [
      "--primary",
      "--primary-active",
      "--teal",
      "--yellow",
      "--blue",
      "--orange",
      "--violet",
      "--slate",
      "--canvas",
      "--surface",
      "--soft",
      "--strong",
      "--chart",
      "--hairline",
      "--ink",
      "--body",
      "--mute",
      "--grid",
      "--shadow",
      "--on-primary",
    ]) {
      expect(globalsCss).toContain(token);
    }
  });

  it("defines light and night theme blocks", () => {
    expect(globalsCss).toContain('[data-theme="light"]');
    expect(globalsCss).toContain('[data-theme="night"]');
  });
});
