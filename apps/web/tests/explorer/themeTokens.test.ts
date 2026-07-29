import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function token(name: string): string {
  const match = globalsCss.match(new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!match) throw new Error(`globals.css defines no ${name}`);
  return match[1];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((channel) => {
    const srgb = Number.parseInt(channel, 16) / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(left: string, right: string): number {
  const [lighter, darker] = [relativeLuminance(left), relativeLuminance(right)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

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
      "--ink-fg-muted",
      "--ink-fg-faint",
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

  it("keeps both ink-surface foreground tokens above the WCAG AA floor", () => {
    const ink = token("--ink");
    const muted = token("--ink-fg-muted");
    const faint = token("--ink-fg-faint");

    // Both tiers carry real sidebar copy at well under 18.66px, so both answer
    // to the 4.5:1 small-text floor rather than the 3:1 large-text one. Without
    // this, either hex can be edited back to a failing value with every check,
    // build and browser test still green (DESIGN.md §4.1).
    expect(contrastRatio(muted, ink)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(faint, ink)).toBeGreaterThanOrEqual(4.5);

    // Two distinguishable tiers, not one value spelled twice.
    expect(muted).not.toBe(faint);
    expect(relativeLuminance(muted)).toBeGreaterThan(relativeLuminance(faint));
  });

  it("does not reintroduce superseded theme systems", () => {
    expect(globalsCss).not.toContain("#0071e3");
    expect(globalsCss).not.toContain('[data-theme="night"]');
    expect(globalsCss).not.toContain("gradient");
  });
});
