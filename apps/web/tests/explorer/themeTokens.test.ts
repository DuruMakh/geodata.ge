import { readdirSync, readFileSync } from "node:fs";
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

  it("keeps the paper-surface faint token above the WCAG AA floor", () => {
    const paper = token("--paper");
    const tile = token("--tile");
    const muted = token("--muted");
    const faint = token("--faint");

    // --faint is not decoration: it carries the page-header coverage line at
    // 10.5px, the hub card footers at 10px and the გეგმა planned tag at 9px, all
    // small text, so it answers to the 4.5:1 floor on both persistent
    // paper-family surfaces (DESIGN.md §4.1). The ink pair has had this guard
    // since v4.1; the paper surface did not, which is how faint sat at 2.42:1.
    expect(contrastRatio(faint, paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(faint, tile)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(muted, paper)).toBeGreaterThanOrEqual(4.5);

    // Same two-tier rule the ink pair follows: faint stays a visible step
    // lighter than muted, so the hierarchy survives the contrast fix.
    expect(muted).not.toBe(faint);
    expect(relativeLuminance(faint)).toBeGreaterThan(relativeLuminance(muted));
  });

  it("keeps paper-surface foreground tokens off every ink shell surface", () => {
    // Found by content, not by filename: the rule is about any component that
    // paints the ink surface, so a second dark shell element must inherit the
    // guard automatically rather than slip past a hardcoded path.
    const shellDir = join(process.cwd(), "components", "shell");
    const inkSurfaces = readdirSync(shellDir)
      .filter((name) => name.endsWith(".tsx"))
      .map((name) => ({ name, source: readFileSync(join(shellDir, name), "utf8") }))
      .filter(({ source }) => source.includes("bg-[var(--ink)]"));

    // Guards the guard: if the sidebar is renamed or restructured so nothing
    // matches, this fails loudly instead of vacuously passing over zero files.
    expect(inkSurfaces.map(({ name }) => name)).toContain("data-sidebar.tsx");

    // Paper-surface foreground tokens are tuned against paper and go unreadable
    // on ink once they clear AA on paper; the ink surface has its own
    // --ink-fg-* counterparts (DESIGN.md §4.1).
    for (const { name, source } of inkSurfaces) {
      for (const paperToken of ["var(--faint)", "var(--muted)", "var(--body)"]) {
        expect(`${name}: ${source.includes(paperToken)}`).toBe(`${name}: false`);
      }
    }
  });

  it("does not reintroduce superseded theme systems", () => {
    expect(globalsCss).not.toContain("#0071e3");
    expect(globalsCss).not.toContain('[data-theme="night"]');
    expect(globalsCss).not.toContain("gradient");
  });
});

describe("municipality map focus", () => {
  it("removes the rectangular legacy map ring", () => {
    expect(globalsCss).not.toContain("--map-focus-ring");
    expect(globalsCss).not.toContain("[data-focus-map]:focus-visible");
  });

  it("suppresses the native outline only for municipality map targets", () => {
    expect(globalsCss).toContain(
      "[data-municipality-map-target]:focus,\n[data-municipality-map-target]:focus-visible {\n  outline: none;\n}",
    );
    expect(globalsCss).not.toContain("path:focus-visible,\ncircle:focus-visible");
  });

  it("leaves the app-wide button/select/input ring untouched", () => {
    expect(globalsCss).toContain(
      "button:focus-visible,\nselect:focus-visible,\ninput:focus-visible {\n  outline: 2px solid rgba(179, 64, 42, 0.4);\n  outline-offset: 2px;\n}",
    );
  });
});
