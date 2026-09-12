import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { InflationOverview } from "../../components/inflation/inflation-overview";
import { loadServedInflationData } from "../../lib/data/inflation/importInflation";
import { getMessages } from "../../lib/i18n/messages.server";
import { I18nProvider } from "../../lib/i18n/provider";

let html: string;

beforeAll(async () => {
  const { facts, targets } = await loadServedInflationData();
  const messages = await getMessages("en", ["inflation", "common", "controls", "format", "main"]);
  html = renderToStaticMarkup(
    <I18nProvider locale="en" messages={messages}>
      <InflationOverview facts={facts} targets={targets} sources={[]} siteOrigin="https://fiscal.ge" />
    </I18nProvider>,
  );
});

describe("inflation overview (server render = default state)", () => {
  it("centres three indicator tabs with annual inflation active", () => {
    expect(html).toContain('data-testid="inflation-tabs"');
    expect(html).toMatch(/data-testid="inflation-tab-yoy" aria-pressed="true"/);
    expect(html).toContain(">Monthly inflation<");
    expect(html).toContain(">Price index<");
  });

  it("states the unit under the heading", () => {
    expect(html).not.toContain('data-testid="inflation-headline"');
    expect(html).toContain("Percent · change on the same month of the previous year");
  });

  it("selects the headline and the target, with the target drawn dashed", () => {
    expect(html.match(/data-testid="series-row"/g)).toHaveLength(4);
    expect(html).toMatch(/data-series-id="cpi"[^]*?aria-pressed="true"/);
    expect(html).toMatch(/data-series-id="core"[^]*?aria-pressed="false"/);
    expect(html).toContain('data-testid="chart-series-target-dashed"');
  });

  it("shows the indicators without a movers board", () => {
    expect(html).toContain('data-testid="inflation-indicators"');
    expect(html).toContain('data-testid="inflation-gauge"');
    expect(html).toContain(">Core inflation<");
    expect(html).not.toContain("period-movers");
  });
});
