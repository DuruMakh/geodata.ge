import { describe, expect, it } from "vitest";
import { loadServedExplorerData } from "../../lib/data/servedData";
import { colorForProgram, SERIES_COLORS } from "../../lib/explorer/colors";
import { buildDebtExplorerModel } from "../../lib/explorer/debtExplorer";
import { buildExplorerModel } from "../../lib/explorer/explorerData";

// The 14 admin categories resolve to fixed hexes, but the 48 major programs used
// to fall through to EDITORIAL_PALETTE — which contains those same hexes. With
// everything selected that drew #4A707A six times: once as შინაგან საქმეთა
// სამინისტრო and five times as unrelated programs. Programs now take their
// ministry's hue, so the palette also encodes the parent/child relation.

const MINISTRIES = Object.keys(SERIES_COLORS).filter((id) => id.startsWith("admin_spending."));

const PAPER = "#F7F2E9";
const TINT = "#F1EADC";

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

function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  if (delta === 0) return 0;
  const raw = max === r ? (g - b) / delta : max === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;

  return ((raw * 60) % 360 + 360) % 360;
}

describe("fixed series colours", () => {
  it("keeps every canonical series above the 3:1 graphical-object floor", () => {
    const failures: string[] = [];
    for (const color of new Set(Object.values(SERIES_COLORS))) {
      for (const [surface, background] of [["paper", PAPER], ["tint", TINT]] as const) {
        const ratio = contrastRatio(color, background);
        if (ratio < 3) failures.push(`${color} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }

    expect(failures).toEqual([]);
  });

  it("keeps every Government Debt series above the 3:1 graphical-object floor", () => {
    const model = buildDebtExplorerModel({
      facts: [],
      gdpFacts: [],
      family: "stock",
      selectedIds: [],
      range: { start: 2013, end: 2025 },
      shareOfGdp: false,
    });
    const failures: string[] = [];

    for (const item of model.items) {
      for (const [surface, background] of [["paper", PAPER], ["tint", TINT]] as const) {
        const ratio = contrastRatio(item.color, background);
        if (ratio < 3) failures.push(`${item.id} ${item.color} on ${surface}: ${ratio.toFixed(2)}:1`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe("major program colours", () => {
  it("never repeats its parent ministry's own colour", () => {
    for (const ministry of MINISTRIES) {
      const parentColor = SERIES_COLORS[ministry]!;
      expect(colorForProgram(parentColor, 0)).not.toBe(parentColor);
    }
  });

  it("does not repeat when a future ministry grows beyond eight programs", () => {
    for (const ministry of MINISTRIES) {
      const parentColor = SERIES_COLORS[ministry]!;
      const siblings = Array.from({ length: 24 }, (_, ordinal) => colorForProgram(parentColor, ordinal));

      expect(new Set(siblings).size).toBe(24);
    }
  });

  it("derives an unlisted ministry's programs from its displayed parent colour", () => {
    const displayedParent = "#2D6F8A";

    expect(Math.abs(hueOf(colorForProgram(displayedParent, 0)) - hueOf(displayedParent))).toBeLessThan(3);
  });

  // A series line is a graphical object you need to see to read the chart, so it
  // owes WCAG 1.4.11 the same 3:1 the --control border owes it. Deriving shades
  // from a lightness band alone did not pay it: the band edge (L 78) sits far
  // above the 3:1 crossing for the low-saturation warm hues, which put 38 of
  // these 98 shades under the floor and the palest at 1.62:1.
  it("keeps every program shade above the WCAG 1.4.11 3:1 floor on paper and tint", () => {
    const failures: string[] = [];
    for (const ministry of MINISTRIES) {
      const parentColor = SERIES_COLORS[ministry]!;
      for (let ordinal = 0; ordinal < 24; ordinal += 1) {
        const shade = colorForProgram(parentColor, ordinal);
        for (const [surface, background] of [["paper", PAPER], ["tint", TINT]] as const) {
          const ratio = contrastRatio(shade, background);
          if (ratio < 3) failures.push(`${ministry} #${ordinal} ${shade} on ${surface}: ${ratio.toFixed(2)}:1`);
        }
      }
    }

    expect(failures).toEqual([]);
  });

  // 3° is the 8-bit floor, not a design tolerance: the hue is carried through
  // unchanged and only re-quantised when the shade lands back on a hex, which
  // moves the low-saturation greys by at most 2.25°.
  it("keeps the parent ministry's hue", () => {
    for (const ministry of MINISTRIES) {
      const parentHue = hueOf(SERIES_COLORS[ministry]!);
      const parentColor = SERIES_COLORS[ministry]!;
      for (let ordinal = 0; ordinal < 24; ordinal += 1) {
        expect(Math.abs(hueOf(colorForProgram(parentColor, ordinal)) - parentHue)).toBeLessThan(3);
      }
    }
  });
});

describe("ministries scope on the reviewed corpus", () => {
  it("draws no two series in the same colour", async () => {
    const { facts, adminFacts, adminCategories, glossary } = await loadServedExplorerData();
    const years = [...new Set(adminFacts.map((fact) => fact.year))].sort((a, b) => a - b);
    const model = buildExplorerModel({
      facts,
      adminFacts,
      adminCategories: new Map(adminCategories.map((category) => [category.id, category])),
      expenditureGrouping: "ministries",
      glossary,
      side: "expenditure",
      selectedItemIds: [],
      startYear: years[0]!,
      endYear: years[years.length - 1]!,
      measure: "nominal",
    });

    const idsByColor = new Map<string, string[]>();
    for (const item of model.items) {
      idsByColor.set(item.color, [...(idsByColor.get(item.color) ?? []), item.id]);
    }
    const collisions = [...idsByColor.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([color, ids]) => `${color} <- ${ids.join(", ")}`);

    expect(collisions).toEqual([]);
    expect(model.items.length).toBeGreaterThan(60);
  });
});

describe("inflation city colours", () => {
  const CITIES = ["city.tbilisi", "city.kutaisi", "city.batumi", "city.gori", "city.telavi", "city.zugdidi"];
  it("gives each city a distinct colour that holds 3:1 against paper and tint", () => {
    const colours = CITIES.map((id) => SERIES_COLORS[id]);
    expect(new Set(colours).size).toBe(6);
    for (const colour of colours) {
      expect(colour).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrastRatio(colour!, PAPER)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(colour!, TINT)).toBeGreaterThanOrEqual(3);
    }
  });
});
