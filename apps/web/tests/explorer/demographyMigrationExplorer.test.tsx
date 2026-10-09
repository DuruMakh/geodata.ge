import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { MigrationExplorer } from "../../components/demography/demography-migration";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { projectMigrationObservation } from "../../lib/explorer/clientData";
import { MIGRATION_GROUPS, MIGRATION_SERIES, migrationSearchLabels } from "../../lib/explorer/demographyMigration";
import { getMessages } from "../../lib/i18n/messages.server";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import { matchesLabelQuery } from "../../lib/i18n/search";
import type { Locale, Presentation } from "../../lib/i18n/types";
import type { ClientMigrationFact } from "../../lib/servedRows";

const GEORGIAN = /\p{Script=Georgian}/u;
let facts: ClientMigrationFact[];
const presentations = {} as Record<Locale, Presentation>;
let searchLabels: ReturnType<typeof migrationSearchLabels>;

beforeAll(async () => {
  const { facts: served } = await loadServedDemographyData();
  facts = served.filter((fact) => MIGRATION_SERIES.includes(fact.seriesId)).map(projectMigrationObservation);
  searchLabels = migrationSearchLabels(await getMessages("ka", ["demography"]), await getMessages("en", ["demography"]));
  for (const locale of ["ka", "en"] as const) {
    presentations[locale] = await getPresentation(locale, ["demography", "common", "controls", "format", "main", "workbook"], []);
  }
});

const render = (locale: Locale) =>
  renderToStaticMarkup(
    <I18nProvider {...presentations[locale]}>
      <MigrationExplorer facts={facts} sources={[]} siteOrigin="https://fiscal.ge" sourceNote="Source." searchLabels={searchLabels} />
    </I18nProvider>,
  );

describe("MigrationExplorer", () => {
  it("opens on columns with all six groups, both directions and the net line", () => {
    const html = render("en");
    expect(html).toContain('data-testid="migration-explorer"');
    expect((html.match(/data-testid="series-row"/g) ?? []).length).toBe(6);
    expect(html).toContain("Arrivals · Russia");
    expect(html).toContain("Departures · Russia");
    expect(html).toContain("Other countries");
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

  it("offers the sex filter as three icon buttons named All, Men and Women", () => {
    const html = render("en");
    for (const [sex, name, icon] of [["total", "All", "lucide-users"], ["male", "Men", "lucide-mars"], ["female", "Women", "lucide-venus"]] as const) {
      const start = html.indexOf(`data-testid="migration-sex-${sex}"`);
      const button = html.slice(html.lastIndexOf("<button", start), html.indexOf("</button>", start));
      expect(button, sex).toContain(`aria-label="${name}"`);
      expect(button, sex).toContain(icon);
      expect(button, sex).not.toContain(`>${name}<`);
    }
  });

  it("lays the key figures out like the other pages: the period at the right, a split bar, the range-start figures", () => {
    const html = render("en");
    const highlights = /<section data-testid="migration-highlights"[\s\S]*<\/section>/.exec(html)?.[0] ?? "";
    expect(highlights).toMatch(/Selected period: <span[^>]*>2012–2025<\/span>/);
    // Arrivals and departures of 2025 as one two-part bar: 131,501 / (131,501 + 114,374).
    expect(highlights).toContain("width:53.5%");
    expect(highlights).toContain("width:46.5%");
    expect(highlights).toContain("lucide-arrow-up");
    expect(highlights).toContain("lucide-arrow-down");
    // The neutral sentence and the cumulative figure share one paragraph.
    expect(highlights).toMatch(/More people arrived than left\.\s*2012–2025 in total: −26,795/);
    expect(highlights).toContain("2012: 69,063");
    expect(highlights).toContain("2012: 90,584");
    expect(highlights).not.toContain(">2025</p>");
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

  // Server rendering starts with an empty query, so the filter itself is pinned through the labels it is given.
  it("finds a group by its Georgian or English name and never by the shared id prefix", () => {
    const labels = searchLabels["citizenship.russian_federation"];
    expect(matchesLabelQuery("russia", labels)).toBe(true);
    expect(matchesLabelQuery("რუსეთი", labels)).toBe(true);
    // The shared id prefix is never searched; "other" finds only the remainder ("Other countries").
    for (const group of MIGRATION_GROUPS) {
      expect(matchesLabelQuery("citizenship", searchLabels[group])).toBe(false);
      expect(matchesLabelQuery("other", searchLabels[group])).toBe(group === "citizenship.all_other_computed");
    }
  });
});
