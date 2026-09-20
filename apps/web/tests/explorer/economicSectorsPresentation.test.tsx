import { afterEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import { EconomicSectorsExplorer } from "../../components/economic-sectors/economic-sectors-explorer";
import { SectorSeriesPanel } from "../../components/economic-sectors/sector-series-panel";
import { I18nProvider } from "../../lib/i18n/provider";
import { getMessages } from "../../lib/i18n/messages.server";
import type { ServedSectorObservation } from "../../lib/data/economicSectors/types";
import { sourceIdByMeasure } from "../../lib/explorer/clientData";
import { ExplorerTable } from "../../components/main-explorer/explorer-table";
import { buildTooltipRows } from "../../components/main-explorer/editorial-line-chart";
import * as sectorState from "../../components/economic-sectors/use-economic-sectors-state";
import { DEFAULT_SECTOR_STATE } from "../../lib/explorer/economicSectors";

afterEach(() => vi.restoreAllMocks());

test("sector rows rank by the displayed end-year value with GDP first and missing values last", async () => {
  const messages = await getMessages("en", ["sectors", "common", "controls", "format"]);
  const html = renderToStaticMarkup(<I18nProvider locale="en" messages={messages}>
    <SectorSeriesPanel registry={registry} selectedIds={[]} endYear={2025}
      endValues={{ "sector.a": -2, "sector.b": 0, "sector.c": 5 }} measure="real_growth"
      onSelectionChange={() => {}} downloadAction={null} />
  </I18nProvider>);
  const position = (id: string) => html.indexOf(`data-series-id="${id}"`);
  expect(position("economy.gdp_total")).toBeLessThan(position("sector.c"));
  expect(position("sector.c")).toBeLessThan(position("sector.b"));
  expect(position("sector.b")).toBeLessThan(position("sector.a"));
  expect(position("sector.a")).toBeLessThan(position("sector.d"));
});

test("renders one workspace, a removable GDP default and all activities in both languages", async () => {
  for (const locale of ["en", "ka"] as const) {
    const messages = await getMessages(locale, [
      "sectors",
      "common",
      "controls",
      "format",
      "main",
      "workbook",
    ]);
    const facts: ServedSectorObservation[] = [
      {
        seriesId: "economy.gdp_total",
        year: 2025,
        measure: "nominal",
        value: 120e9,
        unit: "gel",
        valuation: "market_prices",
        priceBasis: "current_prices",
        calculation: "published",
        status: "preliminary",
        sourceId: "nominal",
        sourceLocator: "A1",
        lastReviewedAt: "2026-09-11",
      },
    ];
    const html = renderToStaticMarkup(
      <I18nProvider locale={locale} messages={messages}>
        <EconomicSectorsExplorer
          facts={facts} sourceIdByMeasure={sourceIdByMeasure(facts)}
          registry={registry}
          sources={[]}
          siteOrigin="https://fiscal.ge"
        />
      </I18nProvider>,
    );
    expect(html.match(/data-testid="series-row-toggle"/g) ?? []).toHaveLength(
      21,
    );
    expect(html).toContain("1 / 21");
    expect(html).not.toContain('role="tablist"');
    expect(html).not.toContain('data-testid="sectors-unit"');
    expect(html).toContain(locale === "en" ? "% of GDP" : "% მშპ-ში");
    expect(html).toContain(
      locale === "en" ? "Real growth %" : "რეალური ზრდა %",
    );
    const panel = renderToStaticMarkup(
      <I18nProvider locale={locale} messages={messages}>
        <SectorSeriesPanel
          registry={registry}
          selectedIds={[]}
          endYear={2025}
          endValues={{}}
          measure="nominal"
          onSelectionChange={() => {}}
          downloadAction={null}
        />
      </I18nProvider>,
    );
    expect(panel).toContain("0 / 21");
    expect(panel.indexOf("economy.gdp_total")).toBeLessThan(
      panel.indexOf("sector.a"),
    );
    expect(panel.indexOf("sector.s")).toBeLessThan(panel.indexOf("sector.t"));
    expect(panel).toContain("—");
  }
});

test("shared table and tooltip identify only the preliminary observation", async () => {
  const rows = [
    {
      itemId: "a",
      kaLabel: "A",
      color: "red",
      valuesByYear: { 2025: 1 },
      preliminaryByYear: { 2025: true },
    },
    {
      itemId: "b",
      kaLabel: "B",
      color: "blue",
      valuesByYear: { 2025: 2 },
      preliminaryByYear: { 2025: false },
    },
  ];
  const html = renderToStaticMarkup(
    <I18nProvider locale="ka" messages={await getMessages("ka", ["controls"])}>
      <ExplorerTable
        rows={rows}
        totalRow={null}
        showTotal={false}
        years={[2025]}
        caption="Test"
        firstColumnLabel="Sector"
        unit={{ divisor: 1, label: "GEL", decimals: 1 }}
        share={false}
        showChangeColumn={false}
        preliminaryLabel="Preliminary"
        shareValueForYear={() => null}
      />
    </I18nProvider>,
  );
  expect(html.match(/>Preliminary<\/sup>/g) ?? []).toHaveLength(1);
  const tooltip = buildTooltipRows(
    rows.map((r) => ({
      id: r.itemId,
      label: r.kaLabel,
      color: r.color,
      vals: [r.valuesByYear[2025]],
      planned: [false],
      preliminary: [r.preliminaryByYear[2025]],
    })),
    0,
  );
  expect(tooltip.rows.find((r) => r.id === "a")).toHaveProperty(
    "preliminary",
    true,
  );
  expect(tooltip.rows.find((r) => r.id === "b")).not.toHaveProperty(
    "preliminary",
    true,
  );
});

test("restored selections show empty and no-data states, keeping the national reference independent", async () => {
  const messages = await getMessages("en", [
    "sectors",
    "common",
    "controls",
    "format",
    "main",
    "workbook",
  ]);
  const facts: ServedSectorObservation[] = [
    {
      seriesId: "economy.gdp_total",
      year: 2025,
      measure: "nominal",
      value: 120e9,
      unit: "gel",
      valuation: "market_prices",
      priceBasis: "current_prices",
      calculation: "published",
      status: "published",
      sourceId: "nominal",
      sourceLocator: "A1",
      lastReviewedAt: "2026-09-11",
    },
  ];
  for (const selectedIds of [[], ["sector.a"]]) {
    vi.spyOn(sectorState, "useEconomicSectorsState").mockReturnValue({
      state: { ...DEFAULT_SECTOR_STATE, selectedIds },
      update: () => {},
    });
    const html = renderToStaticMarkup(
      <I18nProvider locale="en" messages={messages}>
        <EconomicSectorsExplorer
          facts={facts} sourceIdByMeasure={sourceIdByMeasure(facts)}
          registry={registry}
          sources={[]}
          siteOrigin="https://fiscal.ge"
        />
      </I18nProvider>,
    );
    expect(html).toContain(
      selectedIds.length
        ? 'data-testid="no-range-data-callout"'
        : 'data-testid="no-selection-callout"',
    );
    expect(html).toContain("120.0 bn GEL");
    expect(html).toMatch(/data-testid="sectors-excel-download"[^>]*disabled/);
    expect(html).toContain('role="status"');
  }
});

test("growth renders negative domains, isolated points and gaps through the shared chart", async () => {
  vi.spyOn(sectorState, "useEconomicSectorsState").mockReturnValue({
    state: {
      ...DEFAULT_SECTOR_STATE,
      measure: "real_growth",
      selectedIds: ["sector.a"],
    },
    update: () => {},
  });
  const facts: ServedSectorObservation[] = [
    2021, 2022, 2023, 2024, 2025,
  ].flatMap((year) => {
    const base: ServedSectorObservation = {
      seriesId: "economy.gdp_total",
      year,
      measure: "real_growth",
      value: 5,
      unit: "percent",
      valuation: "market_prices",
      priceBasis: "volume_change",
      calculation: "published",
      status: "published",
      sourceId: "growth",
      sourceLocator: "A1",
      lastReviewedAt: "2026-09-11",
    };
    return [
      base,
      ...(year === 2023 || year === 2024
        ? []
        : [{ ...base, seriesId: "sector.a", value: year === 2021 ? -7.5 : 2 }]),
    ];
  });
  const html = renderToStaticMarkup(
    <I18nProvider
      locale="en"
      messages={await getMessages("en", [
        "sectors",
        "common",
        "controls",
        "format",
        "main",
        "workbook",
      ])}
    >
      <EconomicSectorsExplorer
        facts={facts} sourceIdByMeasure={sourceIdByMeasure(facts)}
        registry={registry}
        sources={[]}
        siteOrigin="https://fiscal.ge"
      />
    </I18nProvider>,
  );
  expect(html).toContain("−");
  expect(html).toContain("0%");
  expect(html).toMatch(/r="2.5" fill="#B3402A"/);
  const chartHtml = html.slice(html.indexOf('data-testid="chart-frame"')).split("</svg>")[0];
  const paths = [
    ...chartHtml.matchAll(/<path[^>]*d="([^"]+)"[^>]*stroke="#B3402A"/g),
  ];
  expect(paths).toHaveLength(1);
  expect(paths[0][1].match(/L/g)).toHaveLength(1);
});
