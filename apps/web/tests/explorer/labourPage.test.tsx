import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LABOUR_SECTIONS, labourFullLabel, labourSeries } from "../../lib/explorer/labour";
import en from "../../lib/i18n/messages/en/labour.json";
import ka from "../../lib/i18n/messages/ka/labour.json";
import { labourPageMetadata } from "../../lib/pages/labour-shared";
import { renderLabourPage } from "../../lib/pages/labour";
import { renderPageMarkup } from "../helpers/render-localized";

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => { process.env.NEXT_PUBLIC_SITE_URL = "https://fiscal.ge"; });
afterEach(() => { process.env.NEXT_PUBLIC_SITE_URL = original; });
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const latest = (html: string) => text(html.match(/<p data-testid="labour-latest"[^>]*>(.*?)<\/p>/)?.[1] ?? "");
const page = async (locale: "ka" | "en", section: Parameters<typeof renderLabourPage>[1]) => renderPageMarkup(locale, await renderLabourPage(locale, section));

describe("the Labour pages", () => {
  it("Jobs by industry: one heading, the one latest line, 60 rows, the Unemployment breadcrumb and 2017 onwards", async () => {
    const html = await page("ka", "industries");
    expect(html.match(/<h1[^>]*>/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${ka["labour.page.industries.title"]}</h1>`));
    expect(html.match(/data-testid="labour-latest"/g)).toHaveLength(1);
    expect(latest(html)).toContain("2025");
    expect(latest(html)).toContain("1,389.7");
    expect(html).toContain('data-testid="labour-industries"');
    expect(html.match(/data-testid="series-row"/g)).toHaveLength(60);
    expect(html).toContain('href="/explorer/unemployment"');
    expect(html).toContain('"temporalCoverage":"2017/2025"');
  });

  it("Young people: the 15–24 share in English", async () => {
    const html = await page("en", "young-people");
    expect(latest(html)).toContain("17.6%");
    expect(html).toContain('href="/en/explorer/unemployment"');
  });

  it("metadata names each page in its language", async () => {
    const meta = await labourPageMetadata("en", "hours");
    expect(meta.title).toBe(`${en["labour.page.hours.metaTitle"]} | Fiscal.ge`);
    expect(meta.alternates?.canonical).toContain("/en/explorer/unemployment/hours");
  });
});

describe("the Labour labels", () => {
  it("name every row and heading of every page in both languages, so no full name reads \"undefined\"", () => {
    for (const messages of [ka, en] as Record<string, string>[]) {
      for (const { id: section } of LABOUR_SECTIONS) {
        for (const series of labourSeries(section)) {
          const full = labourFullLabel(series.heading, messages[`labour.heading.${series.heading}`], messages[`labour.row.${series.item}`]);
          expect(full, `${section} ${series.id}`).not.toContain("undefined");
          // The list names each heading, Everyone included.
          expect(messages[`labour.heading.${series.heading}`], `${section} ${series.heading}`).toBeTruthy();
        }
      }
    }
  });
});
