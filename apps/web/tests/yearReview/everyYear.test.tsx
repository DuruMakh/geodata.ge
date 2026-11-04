import { isValidElement, type ReactNode } from "react";
import { beforeAll, describe, expect, test } from "vitest";
import { Glance } from "../../components/year-review/glance";
import { LongView } from "../../components/year-review/long-view";
import type { YearReviewSectionProps } from "../../components/year-review/section";
import { WhereMoneyGoes } from "../../components/year-review/where-money-goes";
import { YearReviewPage } from "../../components/year-review/year-review-page";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import { renderAnalysisPage } from "../../lib/pages/analysis";
import type { YearReviewData } from "../../lib/yearReview/types";
import { renderPageMarkup } from "../helpers/render-localized";

// The static build renders only the default year; every other year is first computed in the browser, where a throw
// blanks the page. So the whole page renders here for every ruler year, in both languages, with the props and messages
// the server hands the client; the sections that follow the grouping, the long view's side and its measure render
// once more for each setting the page does not open on.

type Shipped = { data: YearReviewData; presentation: Presentation };
const shipped: Partial<Record<Locale, Shipped>> = {};

/** The props the server page hands YearReviewPage. */
function pageProps(node: ReactNode): Shipped[] {
  if (Array.isArray(node)) return node.flatMap(pageProps);
  if (!isValidElement<{ children?: ReactNode }>(node)) return [];
  return [...(node.type === YearReviewPage ? [node.props as unknown as Shipped] : []), ...pageProps(node.props.children)];
}

beforeAll(async () => {
  for (const locale of ["ka", "en"] as const) shipped[locale] = pageProps(await renderAnalysisPage(locale))[0]!;
}, 60_000);

// A number or a message gone wrong: NaN, Infinity or undefined printed, or a template value left unfilled.
const BROKEN = /NaN|Infinity|undefined|\{[A-Za-z][A-Za-z0-9_]*\}/g;
const noop = () => {};

describe.each(["ka", "en"] as const)("%s", (locale) => {
  test("every ruler year renders the whole page with no broken number or message", () => {
    const { data, presentation } = shipped[locale]!;
    for (const year of data.budget.years) {
      // The page opens on budget.defaultYear, so a page opened on each year is that year chosen.
      const markup = renderPageMarkup(locale, <YearReviewPage data={{ ...data, budget: { ...data.budget, defaultYear: year } }} presentation={presentation} />);
      expect(markup).toContain(`data-year="${year}"`);
      expect({ year, broken: markup.match(BROKEN) }).toEqual({ year, broken: null });
    }
  }, 60_000);

  test("every ruler year, the other grouping, the receipts side and GEL render too", () => {
    const { data, presentation } = shipped[locale]!;
    const settings: Pick<YearReviewSectionProps, "grouping" | "side" | "measure">[] = [
      { grouping: "institutions", side: "expenditure", measure: "share" },
      { grouping: "fields", side: "revenue", measure: "share" },
      { grouping: "institutions", side: "expenditure", measure: "gel" },
      { grouping: "fields", side: "revenue", measure: "gel" },
    ];
    for (const year of data.budget.years) {
      for (const setting of settings) {
        const props: YearReviewSectionProps = {
          data, year, ...setting, focus: null, pin: null, onFocus: noop, onPin: noop, onGrouping: noop, onSide: noop, onMeasure: noop,
        };
        const markup = renderPageMarkup(locale, (
          <I18nProvider {...presentation}>
            <Glance data={data} year={year} />
            <WhereMoneyGoes {...props} />
            <LongView {...props} />
          </I18nProvider>
        ));
        expect({ year, setting, broken: markup.match(BROKEN) }).toEqual({ year, setting, broken: null });
      }
    }
  }, 60_000);
});
