import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { MigrationExplorer } from "../../components/demography/demography-migration";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import { MIGRATION_SERIES } from "../../lib/explorer/demographyMigration";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientMigrationFact[];
const presentations = {} as Record<Locale, Presentation>;

beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  for (const locale of ["ka", "en"] as const) {
    presentations[locale] = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook"], []);
  }
});

const render = (locale: Locale) =>
  renderToStaticMarkup(
    <I18nProvider {...presentations[locale]}>
      <MigrationExplorer facts={facts} sources={[]} siteOrigin="https://fiscal.ge" sourceNote="Source." />
    </I18nProvider>,
  );

describe("MigrationExplorer", () => {
  it("opens on columns with all six groups, both directions and the net line", () => {
    const html = render("en");
    expect(html).toContain('data-testid="migration-explorer"');
    expect((html.match(/data-testid="series-row"/g) ?? []).length).toBe(6);
    expect(html).toContain("Arrivals · Russia");
    expect(html).toContain("Departures · Russia");
    expect(html).toContain("All other citizenships (computed)");
    expect(html).toContain("Net migration:");
    expect(html).not.toContain("Net migration (selected groups)");
    expect(html).toContain('data-testid="migration-sex-total"');
  });

  it("shows the four key figures for 2025", () => {
    const html = render("en");
    expect(html).toContain("Net migration · 2025");
    expect(html).toContain("+17,127");
    expect(html).toContain("More people arrived than left.");
    expect(html).toContain("2012–2025 in total: −26,795");
    expect(html).toContain("131,501");
    expect(html).toContain("114,374");
    expect(html).toContain("52.8%");
    expect((html.match(/data-testid="side-kpi"/g) ?? []).length).toBe(3);
  });

  it("has no Georgian in the English render and no cause words", () => {
    const html = render("en");
    expect(html.replace(/<script[\s\S]*?<\/script>/g, "")).not.toMatch(GEORGIAN);
    expect(html).not.toMatch(/\bwar\b|invasion|because/i);
  });

  it("renders in Georgian", () => {
    const html = render("ka");
    expect(html).toContain("შემოსვლა · რუსეთი");
    expect(html).toContain("წმინდა მიგრაცია · 2025");
  });
});
