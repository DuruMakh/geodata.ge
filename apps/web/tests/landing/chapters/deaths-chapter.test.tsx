import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeathsChapter } from "../../../components/landing/chapters/deaths-chapter";
import { deathSquares, estimatedNameWidth, UNIT_NARROW_WIDTH, unitLayout } from "../../../components/landing/chapters/chart-layout";
import { deathGroupTip } from "../../../components/landing/chapters/chart-tips";
import type { UnitLabels } from "../../../components/landing/chapters/unit-chart";
import { message } from "../../../lib/i18n/messages";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import type { DeathsChapter as DeathsChapterModel } from "../../../lib/landing/chapters/types";

const ka = (key: string, values?: Record<string, string | number>) => message(kaLanding, key, values);

const data: DeathsChapterModel = {
  year: 2025,
  total: 44319,
  groups: [
    { id: "circulatory", label: "სისხლის მიმოქცევის სისტემის ავადმყოფობები", count: 16711, kind: "top" },
    { id: "ill_defined", label: "არაზუსტად განსაზღვრული მიზეზები", count: 9389, kind: "unknown" },
    { id: "cancer", label: "სიმსივნეები", count: 6877, kind: "established" },
    { id: "respiratory", label: "სასუნთქი სისტემის ავადმყოფობები", count: 3533, kind: "established" },
    { id: "external", label: "ტრავმები, მოწამვლები და გარეგანი მიზეზები", count: 1973, kind: "established" },
    { id: "other", label: "სხვა მიზეზები", count: 5836, kind: "other" },
  ],
  top: { id: "circulatory", label: "სისხლის მიმოქცევის სისტემის ავადმყოფობები", share: 0.377 },
  unknownShare: 0.2118,
};

// Built as landing-page.tsx builds them, from the same messages.
const labelsFor = (model: DeathsChapterModel, t: typeof ka): UnitLabels => ({
  title: t("landing.deaths.chart.title", { year: model.year }),
  unit: t("landing.deaths.chart.unit", { count: 100 }),
  unknown: t("landing.deaths.chart.unknown"),
  summary: t("landing.deaths.chart.summary", { total: "44,319", year: model.year, count: 100 }),
  people: t("landing.deaths.tip.people"),
  ofAll: t("landing.deaths.tip.ofAll"),
  squares: t("landing.deaths.tip.squares", { count: "{count}" }),
  unavailable: t("landing.heroUnavailable"),
});
const labels = labelsFor(data, ka);
const html = renderToStaticMarkup(<DeathsChapter data={data} labels={labels} />);

// Text 7 px per character, like a mid-weight Georgian font at 12.5px.
const measure = (s: string) => s.length * 7;
const counts = data.groups.map((group) => group.count);
const names = data.groups.map((group) => group.label);

describe("DeathsChapter (server render)", () => {
  it("titles the chart with the year and keys it with the square unit and the hollow cause-not-established square", () => {
    expect(html).toContain("გარდაცვალების მიზეზები, 2025");
    expect(html).toContain("= 100 გარდაცვლილი");
    expect(html).toContain("მიზეზი დაუდგენელია");
    const caption = html.match(/<figcaption[^>]*>(.*?)<\/figcaption>/)![1];
    const keys = [...caption.matchAll(/<li[^>]*><i([^>]*)><\/i>([^<]*)<\/li>/g)];
    expect(keys.map((key) => key[2])).toEqual(["= 100 გარდაცვლილი", "მიზეზი დაუდგენელია"]);
    expect(keys[0][1]).toContain("bg-[var(--ink)]");
    expect(keys[1][1]).toContain("border-[var(--control)]");
    expect(keys[1][1]).not.toContain("bg-");
  });

  it("lists the three largest causes with counts and the year in the accessible name", () => {
    const aria = html.match(/<canvas[^>]*aria-label="([^"]*)"/)?.[1];
    expect(aria).toBe(
      "44,319 გარდაცვალება მიზეზების მიხედვით, 2025 წელს, თითო კვადრატი 100 ადამიანია: სისხლის მიმოქცევის სისტემის ავადმყოფობები 16,711, არაზუსტად განსაზღვრული მიზეზები 9,389, სიმსივნეები 6,877",
    );
  });

  it("never names the remainder group among the three, even when fewer causes exist", () => {
    const few: DeathsChapterModel = { ...data, groups: [data.groups[0], { ...data.groups[5], count: 30000 }] };
    const aria = renderToStaticMarkup(<DeathsChapter data={few} labels={labels} />).match(/<canvas[^>]*aria-label="([^"]*)"/)?.[1];
    expect(aria).toBe("44,319 გარდაცვალება მიზეზების მიხედვით, 2025 წელს, თითო კვადრატი 100 ადამიანია: სისხლის მიმოქცევის სისტემის ავადმყოფობები 16,711");
  });

  it("starts the chart at its desktop height so the page does not jump when the engine sizes it", () => {
    const height = unitLayout(1180, counts, estimatedNameWidth, names).height;
    expect(html).toContain(`height:${height}px`);
  });

  // In the browser at 1440 (Noto Sans Georgian 600, 12.5px; names 322, 245, 83, 243, 306 and 93 px wide in the 238px
  // column) the engine breaks these names into [2, 2, 1, 2, 2, 1] lines and sizes the chart to 370px.
  it("breaks the real names on the server into the line counts the browser measured, so the chart starts at its final 370px", () => {
    const server = unitLayout(1180, counts, estimatedNameWidth, names);
    expect(server.rows.map((row) => row.lines.length)).toEqual([2, 2, 1, 2, 2, 1]);
    expect(server.height).toBe(370);
    expect(html).toContain("height:370px");
  });

  it("fails the render without groups", () => {
    expect(() => renderToStaticMarkup(<DeathsChapter data={{ ...data, groups: [] }} labels={labels} />)).toThrow("Deaths chapter: no groups");
  });
});

describe("unitLayout", () => {
  it("draws one square per 100 deaths, rounded (circulatory 167)", () => {
    expect(counts.map(deathSquares)).toEqual([167, 94, 69, 35, 20, 58]);
    expect(deathSquares(49)).toBe(0);
    expect(deathSquares(50)).toBe(1);
  });

  it("fills rows of whole tens and keeps the name column beside the squares on wide screens", () => {
    for (const width of [640, 800, 1180, 1400]) {
      const layout = unitLayout(width, counts, measure, names);
      expect(layout.narrow).toBe(false);
      expect(layout.perRow % 10).toBe(0);
      expect(layout.perRow).toBeGreaterThanOrEqual(10);
    }
    const wide = unitLayout(1180, counts, measure, names);
    expect(wide.perRow).toBe(80);
    expect(wide.rows).toHaveLength(6);
    expect(wide.rows[0].top).toBe(4);
  });

  it("is narrow below 640px: the names sit above their squares on a smaller pitch, so the chart grows", () => {
    expect(UNIT_NARROW_WIDTH).toBe(640);
    const narrow = unitLayout(375, counts, measure, names);
    expect(narrow.narrow).toBe(true);
    expect(narrow.perRow % 10).toBe(0);
    expect(narrow.perRow).toBe(40);
    expect(narrow.rows[0].top).toBeGreaterThan(4 + 16);
    expect(narrow.height).toBeGreaterThan(unitLayout(1180, counts, measure, names).height);
    expect(unitLayout(639, counts, measure, names).narrow).toBe(true);
  });

  it("breaks a name that is too wide at a space, onto two lines", () => {
    const layout = unitLayout(1180, counts, measure, names);
    expect(layout.rows[0].lines).toEqual(["სისხლის მიმოქცევის სისტემის", "ავადმყოფობები"]);
    expect(layout.rows[2].lines).toEqual(["სიმსივნეები"]);
  });

  it("stacks the rows one under the other with 14px between them", () => {
    const layout = unitLayout(1180, counts, measure, names);
    const { rows } = layout;
    // Wide: a row is as tall as its name block (16 per line + 20) or its squares, whichever is more.
    expect(rows[1].top).toBe(rows[0].top + Math.max(Math.ceil(167 / 80) * 10, 16 * rows[0].lines.length + 20) + 14);
    expect(layout.height).toBe(rows[5].top + Math.max(Math.ceil(58 / 80) * 10, 16 * rows[5].lines.length + 20) + 14 + 2);
  });
});

describe("deathGroupTip", () => {
  const tipLabels = { people: "გარდაცვლილი", ofAll: "ყველა გარდაცვალებიდან", squares: "≈ {count} კვადრატი" };

  it("shows the count, the share of all deaths and the squares, with the year in the title", () => {
    expect(deathGroupTip(data, tipLabels, 0)).toEqual({
      title: "სისხლის მიმოქცევის სისტემის ავადმყოფობები, 2025",
      rows: [
        { key: "var(--accent)", val: "16,711", name: "გარდაცვლილი" },
        { val: "38%", name: "ყველა გარდაცვალებიდან" },
      ],
      foot: "≈ 167 კვადრატი",
    });
  });

  it("keys each group by the colour of its squares", () => {
    expect(deathGroupTip(data, tipLabels, 1).rows[0].key).toBe("var(--control)");
    expect(deathGroupTip(data, tipLabels, 2).rows[0].key).toBe("var(--ink)");
    expect(deathGroupTip(data, tipLabels, 5).rows[0].key).toBe("var(--control)");
  });
});
