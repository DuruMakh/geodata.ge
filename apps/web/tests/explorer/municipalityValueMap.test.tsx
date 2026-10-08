import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, test, vi } from "vitest";

vi.mock("../../assets/municipality-map-definitions.svg", () => ({ default: { src: "/definitions.svg" } }));

import { MunicipalityMap } from "../../components/municipalities/municipality-map";
import { loadServedDemographyData } from "../../lib/data/demography/importDemography";
import { SERIES } from "../../lib/data/demography/series";
import type { Municipality } from "../../lib/data/municipal/types";
import { loadServedMunicipalData } from "../../lib/data/servedData";
import { buildMunicipalityValueMapModel, type MunicipalityMapModel } from "../../lib/explorer/municipalityMapData";
import { getPresentation } from "../../lib/i18n/presentation.server";
import { I18nProvider } from "../../lib/i18n/provider";
import type { Presentation } from "../../lib/i18n/types";

let municipalities: Municipality[];
let values: Map<string, number>;
let model: MunicipalityMapModel;
let presentation: Presentation;
const display = (_code: string, value: number) => `${value} persons`;
const count = (html: string, token: RegExp) => (html.match(token) ?? []).length;

beforeAll(async () => {
  const [{ facts }, municipal] = await Promise.all([loadServedDemographyData(), loadServedMunicipalData()]);
  municipalities = municipal.municipalities;
  values = new Map(
    facts
      .filter((fact) => fact.seriesId === SERIES.populationTotal && fact.year === 2026 && /^\d{2}$/.test(fact.geographyId))
      .map((fact) => [fact.geographyId, fact.value]),
  );
  model = buildMunicipalityValueMapModel({ municipalities, values, display });
  presentation = await getPresentation("en", ["municipal"], municipalities.map((municipality) => municipality.code));
});

describe("buildMunicipalityValueMapModel", () => {
  test("joins every polygon and marker to its value and text", () => {
    expect(model.shapes).toHaveLength(60);
    expect(model.markers).toHaveLength(5);
    // 2026 values: Khulo is 16,098 on 1 January 2026 (16,307 is its 2025 figure).
    expect(model.shapes.find((shape) => shape.code === "11")).toMatchObject({ budgetPerResidentGel: 16_098, display: "16098 persons" });
    expect(model.markers.find((marker) => marker.code === "04")).toMatchObject({ budgetPerResidentGel: 1_369_356, display: "1369356 persons" });
    expect(model.shapes.every((shape) => shape.bucket >= 0 && shape.bucket <= 5 && shape.display !== undefined)).toBe(true);
    const polygonValues = model.shapes.map((shape) => shape.budgetPerResidentGel);
    expect(model.legendMinPerResidentGel).toBe(Math.min(...polygonValues));
    expect(model.legendMaxPerResidentGel).toBe(Math.max(...polygonValues));
  });

  test("rejects a missing, unknown or non-positive value", () => {
    const without = new Map([...values].filter(([code]) => code !== "33"));
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: without, display })).toThrow(/Missing map value for municipality 33/);
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: new Map([...values, ["99", 5]]), display })).toThrow(/Unknown municipality value code 99/);
    expect(() => buildMunicipalityValueMapModel({ municipalities, values: new Map([...values, ["33", 0]]), display })).toThrow(/Invalid map value for municipality 33/);
  });
});

describe("MunicipalityMap population wording", () => {
  const render = (props: Partial<Parameters<typeof MunicipalityMap>[0]> = {}, withText = true) =>
    renderToStaticMarkup(
      <I18nProvider {...presentation}>
        <MunicipalityMap
          viewBox={model.viewBox}
          shapes={withText ? model.shapes : model.shapes.map(({ display: _display, ...shape }) => shape)}
          markers={withText ? model.markers : model.markers.map(({ display: _display, ...marker }) => marker)}
          occupiedAreas={model.occupiedAreas}
          touchTargets={model.touchTargets}
          legendMin="min text"
          legendMax="max text"
          activeCode={null}
          onActiveCodeChange={() => {}}
          onOpenMunicipality={() => {}}
          {...props}
        />
      </I18nProvider>,
    );

  test("keeps all 64 targets links and uses the page's wording", () => {
    const html = render({ wording: { groupAria: "Population map", legendCaption: "persons, 1 January 2026" } });
    expect(count(html, /data-municipality-map-target=""/g)).toBe(64);
    expect(count(html, /role="link"/g)).toBe(64);
    expect(count(html, /role="button"/g)).toBe(0);
    expect(count(html, /aria-pressed/g)).toBe(0);
    expect(count(html, /municipality-chosen-/g)).toBe(0);
    expect(html).toContain('aria-label="Population map"');
    expect(html).toContain("persons, 1 January 2026");
    expect(html).toContain("Khulo, 16098 persons");
    expect(html).not.toContain("per resident");
  });

  test("without the new props it is the budget map's wording", () => {
    const html = render({}, false);
    expect(count(html, /role="link"/g)).toBe(64);
    expect(html).toContain("per resident");
  });
});
