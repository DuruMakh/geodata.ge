import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push() {} }), usePathname: () => "/" }));

import { EntityHeading } from "../../components/municipalities/entity-heading";
import { EntityMemberList } from "../../components/municipalities/entity-member-list";
import { EntityPicker } from "../../components/municipalities/entity-picker";
import { EntityWorkspaceShell } from "../../components/municipalities/entity-workspace-shell";
import { MunicipalitiesIndex } from "../../components/municipalities/municipalities-index";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { MUNICIPAL_COUNTRY_ID } from "../../lib/data/municipal/types";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildPopulationMunicipalityMap } from "../../lib/explorer/demographyPopulationMaps";
import type { MunicipalListRow } from "../../lib/explorer/municipalData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

// What this file proves about the Budget pages. Without overrides the shared parts must render what they rendered
// before the Population pages existed. That identity (byte for byte) was established once, when the parts were
// moved out of the Budget components, against the markup of the commit before the move. The one accepted
// difference is the list-header row of the index (commit 86f0c314: it wraps, and the unit label sits at the right).
// What keeps it true from here on is the committed snapshots below: the markup of the five parts WITHOUT
// overrides, from fixture data, with the map left empty. A drift shows as a line diff; update a snapshot only
// for a Budget change you mean to make.
let municipalities: Municipality[];
let map: ReturnType<typeof buildPopulationMunicipalityMap>["model"];
let presentation: Presentation;

const rows: MunicipalListRow[] = [
  { id: "04", kind: "municipality", nameKa: "თბილისი", subtitleKa: "თბილისი", regionId: "region.tbilisi", valueGel: 1_369_356, budgetPerResidentGel: null, rank: 1 },
  { id: "06", kind: "municipality", nameKa: "ბათუმი", subtitleKa: "აჭარა", regionId: "region.adjara", valueGel: 246_267, budgetPerResidentGel: null, rank: 2 },
];
const regionRows: MunicipalListRow[] = [
  { id: "region.adjara", kind: "region", nameKa: "აჭარა", subtitleKa: "6 მუნიციპალიტეტი", regionId: "region.adjara", valueGel: 413_214, budgetPerResidentGel: null, rank: 1 },
];
const country: MunicipalListRow = { id: MUNICIPAL_COUNTRY_ID, kind: "country", nameKa: "საქართველო", subtitleKa: "64 მუნიციპალიტეტი", regionId: null, valueGel: 3_941_103, budgetPerResidentGel: null, rank: null };
// The snapshot of the index uses the same rows with the per-resident figure the Budget index has on its municipality and
// region rows (the country row has none), so a vanished per-resident line changes the snapshot.
const perResidentGel = [1_141.2, 1_368.1];
const budgetRows = rows.map((row, position) => ({ ...row, budgetPerResidentGel: perResidentGel[position] }));
const budgetRegionRows = regionRows.map((row) => ({ ...row, budgetPerResidentGel: 1_147.8 }));
const budgetKpis = [
  { label: "Total", value: "3.9 bn", detail: "2025 · 64 municipal budgets" },
  { label: "Largest", value: "Tbilisi", detail: "35% of the total" },
];
// The snapshots hold no served data: the map gets no shapes and a fixed small view box, so a data refresh cannot churn them.
const EMPTY_MAP_VIEW_BOX = "0 0 100 60";
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;
// Static markup splits at the tag boundaries, so a snapshot drift shows as a line diff instead of one long line.
const readable = (html: string) => html.replace(/></g, ">\n<");
// One list row's markup: the map's accessible labels carry the same figures, so a whole-page check would not prove the row's format.
const listRow = (html: string, code: string) => html.match(new RegExp(`<a [^>]*data-municipality-row-code="${code}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? "";

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  municipalities = municipal.municipalities;
  map = buildPopulationMunicipalityMap({ facts, municipalities }).model;
  const ids = [MUNICIPAL_COUNTRY_ID, ...municipal.regions.map((region) => region.id), ...municipalities.map((m) => m.code)];
  presentation = await getPresentation("en", ["municipal", "common", "controls", "format", "main"], ids);
});

const wrap = (node: ReactNode) => renderToStaticMarkup(<I18nProvider {...presentation}>{node}</I18nProvider>);
const index = (overrides?: Parameters<typeof MunicipalitiesIndex>[0]["overrides"]) =>
  wrap(
    <MunicipalitiesIndex
      viewBox={map.viewBox}
      shapes={map.shapes}
      markers={map.markers}
      occupiedAreas={map.occupiedAreas}
      touchTargets={map.touchTargets}
      legendMin="min"
      legendMax="max"
      municipalities={rows}
      regions={regionRows}
      country={country}
      kpis={[]}
      sourceNote="Source"
      overrides={overrides}
    />,
  );
const budgetIndex = () =>
  wrap(
    <MunicipalitiesIndex
      viewBox={EMPTY_MAP_VIEW_BOX}
      shapes={[]}
      markers={[]}
      occupiedAreas={[]}
      touchTargets={[]}
      legendMin="min"
      legendMax="max"
      municipalities={budgetRows}
      regions={budgetRegionRows}
      country={country}
      kpis={budgetKpis}
      sourceNote="Source"
    />,
  );

describe("MunicipalitiesIndex overrides", () => {
  test("without them it is the budget index: budget links and amounts", () => {
    const html = index();
    expect(html).toContain('href="/en/explorer/municipalities/batumi"');
    expect(html).toContain('href="/en/explorer/municipalities/region/adjara"');
    expect(html).toContain('href="/en/explorer/municipalities/georgia"');
    expect(html).toContain("GEL");
    expect(html).not.toContain("persons");
  });

  test("without them its markup is the Budget index's (snapshot, fixture rows, empty map)", () => {
    expect(readable(budgetIndex())).toMatchSnapshot();
  });

  test("with them it links to the given pages and prints persons, a second line, the unit and the notes", () => {
    const html = index({
      hrefById: {
        "04": "/explorer/demography/population/region/tbilisi",
        "06": "/explorer/demography/population/batumi",
        "region.adjara": "/explorer/demography/population/region/adjara",
        [MUNICIPAL_COUNTRY_ID]: "/explorer/demography/population/georgia",
      },
      valueFormat: "persons",
      secondaryById: { "region.adjara": "142.5/km²" },
      countrySubtitle: "64 municipalities",
      unitLabel: "persons",
      mapWording: { groupAria: "Population map", legendCaption: "persons, 1 January 2026" },
      mapNote: <p data-testid="map-note">A note</p>,
    });
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain('href="/en/explorer/demography/population/region/tbilisi"');
    expect(html).toContain('href="/en/explorer/demography/population/georgia"');
    expect(html).not.toContain("/explorer/municipalities/");
    const batumi = listRow(html, "06");
    expect(batumi).toContain("246,267");
    expect(batumi).not.toContain("GEL");
    expect(html).toContain("3,941,103");
    expect(html).not.toContain("GEL");
    expect(html).toContain("142.5/km²");
    expect(html).toContain("64 municipalities");
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("persons, 1 January 2026");
    expect(count(html, /data-testid="map-note"/g)).toBe(1);
  });
});

describe("EntityPicker overrides", () => {
  const groups = [{ regionId: "region.adjara", nameKa: "აჭარა", valueGel: 413_214, members: [{ code: "06", nameKa: "ბათუმი", valueGel: 246_267 }] }];
  const picker = (overrides?: Parameters<typeof EntityPicker>[0]["overrides"]) =>
    wrap(
      <EntityPicker
        open
        onClose={() => {}}
        country={{ id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო", valueGel: 3_941_103, budgetCount: 64 }}
        groups={groups}
        activeId="06"
        overrides={overrides}
      />,
    );

  test("without them it links to the budget pages", () => {
    const html = picker();
    expect(html).toContain('href="/en/explorer/municipalities/batumi"');
    expect(html).toContain("municipal budgets");
  });

  test("without them its markup is the Budget picker's (snapshot, open, fixture groups)", () => {
    expect(readable(picker())).toMatchSnapshot();
  });

  test("with them it links to the given pages and prints persons and the given country text", () => {
    const html = picker({
      hrefById: { "06": "/explorer/demography/population/batumi", "region.adjara": "/explorer/demography/population/region/adjara", [MUNICIPAL_COUNTRY_ID]: "/explorer/demography/population/georgia" },
      valueFormat: "persons",
      countryDetail: "3,941,103 · 64 municipalities",
    });
    expect(html).toContain('href="/en/explorer/demography/population/batumi"');
    expect(html).toContain('href="/en/explorer/demography/population/region/adjara"');
    expect(html).toContain('href="/en/explorer/demography/population/georgia"');
    expect(html).toContain("246,267");
    expect(html).toContain("3,941,103 · 64 municipalities");
    expect(html).not.toContain("municipal budgets");
  });
});

describe("the place-page shell pieces", () => {
  const headingProps = {
    title: "Population —",
    triggerLabel: "Batumi",
    metaLine: "Adjara · Rank 2 of 64",
    entityId: "06",
    pickerCountry: { id: MUNICIPAL_COUNTRY_ID, nameKa: "საქართველო" as const, valueGel: 1, budgetCount: 64 },
    pickerGroups: [],
  };
  const headingNavigation = { prev: { label: "Kobuleti", href: "/a" }, next: { label: "Keda", href: "/b" } };
  const memberListRows = [{ id: "06", href: "/en/x/batumi", rank: 1, label: "Batumi", value: "246,267" }];

  test("EntityHeading renders the title, the picker trigger, the meta line and previous/next only when given", () => {
    const bare = wrap(<EntityHeading {...headingProps} />);
    expect(bare).toContain('data-testid="entity-picker-trigger"');
    expect(bare).toContain("Population —");
    expect(bare).toContain("Adjara · Rank 2 of 64");
    expect(bare).not.toContain('data-testid="municipal-entity-navigation"');
    const withNav = wrap(<EntityHeading {...headingProps} navigation={headingNavigation} />);
    expect(withNav).toContain('data-testid="municipal-entity-navigation"');
    expect(withNav).toContain("← Kobuleti");
    expect(withNav).toContain("Keda →");
  });

  test("EntityHeading's markup is the Budget heading's, without and with previous/next (snapshots)", () => {
    expect(readable(wrap(<EntityHeading {...headingProps} />))).toMatchSnapshot("without previous/next");
    expect(readable(wrap(<EntityHeading {...headingProps} navigation={headingNavigation} />))).toMatchSnapshot("with previous/next");
  });

  test("EntityWorkspaceShell puts the main column and the sticky aside side by side with its test id", () => {
    const html = wrap(<EntityWorkspaceShell testId="x-workspace" main={<p>main</p>} aside={<p>aside</p>} />);
    expect(html).toContain('data-testid="x-workspace"');
    expect(html).toContain("main");
    expect(html).toContain("sticky top-5");
    expect(html).toContain("340px");
  });

  test("EntityWorkspaceShell's markup is the Budget place page's two columns (snapshot)", () => {
    expect(readable(wrap(<EntityWorkspaceShell testId="x-workspace" main={<p>main</p>} aside={<p>aside</p>} />))).toMatchSnapshot();
  });

  test("EntityMemberList renders one linked row per member", () => {
    const html = wrap(<EntityMemberList heading="Municipalities in this region" rows={memberListRows} />);
    expect(html).toContain("Municipalities in this region");
    expect(count(html, /data-testid="region-member-row"/g)).toBe(1);
    expect(html).toContain('href="/en/x/batumi"');
    expect(html).toContain("01");
  });

  test("EntityMemberList's markup is the Budget region page's list (snapshot)", () => {
    expect(readable(wrap(<EntityMemberList heading="Municipalities in this region" rows={memberListRows} />))).toMatchSnapshot();
  });
});
