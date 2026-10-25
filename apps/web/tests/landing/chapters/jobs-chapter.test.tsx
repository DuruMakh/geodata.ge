import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JobsChapter, type JobsLabels } from "../../../components/landing/chapters/jobs-chapter";
import { message } from "../../../lib/i18n/messages";
import kaLanding from "../../../lib/i18n/messages/ka/landing.json";
import type { YouthJobsChapter } from "../../../lib/landing/chapters/types";

const t = (key: string, values?: Record<string, string | number>) => message(kaLanding, key, values);
const unavailable = t("landing.heroUnavailable");

const data: YouthJobsChapter = {
  year: 2025,
  all: { employed: 1389.7, unemployed: 224, outside: 1349.4, rate: 13.88, per100: [47, 8, 45] },
  youth: { employed: 195.1, unemployed: 66.4, outside: 298.4, rate: 25.39, per100: [35, 12, 53] },
  ratio: 1.83,
  comparison: "almostTwice",
  regions: [
    { id: "tbilisi", label: "თბილისი", rate: 17.5 },
    { id: "imereti", label: "იმერეთი", rate: 16.1 },
    { id: "adjara", label: "აჭარა", rate: 9.2 },
    { id: "samtskhe_javakheti", label: "სამცხე-ჯავახეთი", rate: 7 },
  ],
};

// Built as landing-page.tsx builds them, from the same messages.
const year = data.year;
const waffle = (who: "all" | "youth") => {
  const split = data[who];
  const key = who === "all" ? "landing.jobs.waffle.all" : "landing.jobs.waffle.youth";
  return {
    title: t(`${key}Title`, { year }),
    who: t(`${key}Who`),
    summary: t(`${key}Summary`, { year, employed: split.per100[0], unemployed: split.per100[1], outside: split.per100[2] }),
    employed: t("landing.jobs.employed"),
    unemployed: t("landing.jobs.unemployed"),
    outside: t("landing.jobs.outside"),
    people: t("landing.jobs.people"),
    thousand: t("landing.jobs.thousand"),
    million: t("landing.jobs.million"),
    unemploymentRate: t("landing.jobs.unemploymentRate"),
    ofLabourForce: t("landing.jobs.ofLabourForce"),
    labourForce: t("landing.jobs.labourForce"),
    neither: t("landing.jobs.neither"),
    unavailable,
  };
};
const labels: JobsLabels = {
  all: waffle("all"),
  youth: waffle("youth"),
  regions: {
    title: t("landing.jobs.regions.title", { year }),
    national: t("landing.jobs.regions.national"),
    rate: t("landing.jobs.regions.rate", { year }),
    equal: t("landing.jobs.regions.equal"),
    higher: t("landing.jobs.regions.higher", { diff: "{diff}" }),
    lower: t("landing.jobs.regions.lower", { diff: "{diff}" }),
    highest: t("landing.ageing.highest"),
    lowest: t("landing.ageing.lowest"),
    chartSummary: t("landing.jobs.regions.chartSummary", { year }),
    unavailable,
  },
};

const html = renderToStaticMarkup(<JobsChapter data={data} labels={labels} />);
const canvases = [...html.matchAll(/<canvas[^>]*aria-label="([^"]*)"[^>]*>/g)].map((m) => m[1]);
const keyRows = (figureTitle: string) => {
  const figure = html.match(new RegExp(`<figure[^>]*>(?:(?!</figure>).)*?${figureTitle.replace("+", "\\+")}(.*?)</figure>`))?.[1] ?? "";
  return [...figure.matchAll(/<li[^>]*data-key="([^"]+)"[^>]*>.*?<b[^>]*>(\d+)<\/b><span[^>]*>([^<]*)<em[^>]*>([^<]*)<\/em>/g)].map((m) => m.slice(1));
};

describe("JobsChapter (server render)", () => {
  it("titles both grids and the regions chart with the year from the data", () => {
    expect(html).toContain("15+ ასაკის ყოველი 100 ადამიანიდან, 2025");
    expect(html).toContain("15–29 ასაკის ყოველი 100 ახალგაზრდიდან, 2025");
    expect(html).toContain("უმუშევრობის დონე რეგიონების მიხედვით, 2025, %");
  });

  it("keys the all-ages grid 47 / 8 / 45 with millions to two decimals and whole thousands", () => {
    expect(keyRows("15+ ასაკის ყოველი 100 ადამიანიდან")).toEqual([
      ["employed", "47", "დასაქმებული", "1.39 მლნ"],
      ["unemployed", "8", "უმუშევარი", "224 ათასი"],
      ["outside", "45", "შრომის ძალის გარეთ", "1.35 მლნ"],
    ]);
  });

  it("keys the youth grid 35 / 12 / 53 with thousands", () => {
    expect(keyRows("15–29 ასაკის ყოველი 100 ახალგაზრდიდან")).toEqual([
      ["employed", "35", "დასაქმებული", "195 ათასი"],
      ["unemployed", "12", "უმუშევარი", "66 ათასი"],
      ["outside", "53", "შრომის ძალის გარეთ", "298 ათასი"],
    ]);
  });

  it("names the three groups per 100 in each grid's accessible name, and the highest and lowest region in the regions chart's", () => {
    expect(canvases).toEqual([
      "2025 წელს 15 წლისა და უფროსი ასაკის 100 ადამიანიდან 47 დასაქმებულია, 8 უმუშევარი, 45 შრომის ძალის გარეთაა",
      "2025 წელს 15–29 წლის 100 ახალგაზრდიდან 35 დასაქმებულია, 12 უმუშევარი, 53 შრომის ძალის გარეთაა",
      "უმუშევრობის დონე რეგიონების მიხედვით, 2025; ყველაზე მაღალი: თბილისი 17.5%; ყველაზე დაბალი: სამცხე-ჯავახეთი 7.0%",
    ]);
  });

  it("starts the regions chart at its desktop height so the page does not jump when the engine sizes it", () => {
    expect(html).toContain("height:168px");
  });
});
