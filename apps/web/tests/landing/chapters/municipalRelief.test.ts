import { describe, expect, it } from "vitest";
import { loadServedMunicipalData } from "../../../lib/data/servedData";
import type { Presentation } from "../../../lib/i18n/types";
import { buildMunicipalListRows, type MunicipalListRow } from "../../../lib/explorer/municipalData";
import { MUNICIPALITY_MAP_ARTIFACT } from "../../../lib/explorer/municipalityMapData";
import { buildMunicipalChapter, rasterizeMunicipalities } from "../../../lib/landing/chapters/municipalRelief";

type Artifact = typeof MUNICIPALITY_MAP_ARTIFACT;

// Two 40x40 squares side by side, a city marker for 06 inside the first, Tbilisi's
// own marker inside the second, and one occupied square that overlaps the second.
const artifact: Artifact = {
  version: 1,
  viewBox: "0 0 1000 540",
  municipalityPaths: [
    { code: "04", relationId: 1, d: "M0 0L40 0L40 40L0 40Z" },
    { code: "07", relationId: 2, d: "M40 0L80 0L80 40L40 40Z" },
  ],
  cityMarkers: [
    { code: "06", x: 20, y: 20 },
    { code: "04", x: 60, y: 20 },
  ],
  occupiedAreas: [{ key: "abkhazia", d: "M60 0L100 0L100 40L60 40Z" }],
};

const CELL = 10;
const COLS = 100;
const at = (cells: number[], c: number, r: number) => cells[r * COLS + c];

describe("rasterizeMunicipalities", () => {
  it("sizes the grid from the viewBox: cols = ceil(1000/cell), rows = ceil(540/cell)", () => {
    const real = rasterizeMunicipalities(MUNICIPALITY_MAP_ARTIFACT, ["04"], 8);
    expect(real.cols).toBe(125);
    expect(real.rows).toBe(68);
    expect(real.cells).toHaveLength(125 * 68);
    const synthetic = rasterizeMunicipalities(artifact, ["04", "07"], 7);
    expect(synthetic.cols).toBe(Math.ceil(1000 / 7));
    expect(synthetic.rows).toBe(Math.ceil(540 / 7));
  });

  it("a cell whose centre lies inside a path belongs to that place; occupied-area cells are -2; others -1", () => {
    const { cells } = rasterizeMunicipalities(artifact, ["04", "07", "06"], CELL);
    expect(at(cells, 0, 0)).toBe(0); // centre (5,5) in the first square
    expect(at(cells, 5, 3)).toBe(1); // centre (55,35) in the second square
    expect(at(cells, 8, 0)).toBe(-2); // centre (85,5) in the occupied square only
    expect(at(cells, 6, 1)).toBe(1); // inside both: the place keeps the cell
    expect(at(cells, 20, 20)).toBe(-1);
    expect(at(cells, 0, 4)).toBe(-1); // centre (5,45) is below the squares
  });

  it("counts a point inside a ring hole as outside (even-odd across rings)", () => {
    const ring = "M0 0L60 0L60 60L0 60Z";
    const hole = "M20 20L40 20L40 40L20 40Z";
    const holey: Artifact = { ...artifact, municipalityPaths: [{ code: "04", relationId: 1, d: ring + hole }], occupiedAreas: artifact.occupiedAreas };
    const { cells } = rasterizeMunicipalities(holey, ["04"], CELL);
    expect(at(cells, 1, 1)).toBe(0);
    expect(at(cells, 2, 2)).toBe(-1);
    expect(at(cells, 3, 3)).toBe(-1);
    expect(at(cells, 4, 4)).toBe(0);
  });

  it("a city marker takes the 4 cells nearest its point that belong to a non-city place", () => {
    const { cells } = rasterizeMunicipalities(artifact, ["04", "07", "06"], CELL);
    const city = [1, 2].flatMap((c) => [1, 2].map((r) => at(cells, c, r)));
    expect(city).toEqual([2, 2, 2, 2]);
    expect(cells.filter((value) => value === 2)).toHaveLength(4);
    // Tbilisi has a marker too but is a shape, so its cell stays its own.
    expect(at(cells, 5, 1)).toBe(1);
    expect(at(cells, 6, 2)).toBe(1);
  });

  it("breaks distance ties by row then column", () => {
    // The marker is the centre of cell (1,1) in a 3x3 shape. Four cells are taken:
    // (1,1) at distance 0, then three of the four edge-adjacent cells, which tie.
    const tied: Artifact = {
      ...artifact,
      municipalityPaths: [{ code: "04", relationId: 1, d: "M0 0L30 0L30 30L0 30Z" }],
      cityMarkers: [{ code: "06", x: 15, y: 15 }],
      occupiedAreas: artifact.occupiedAreas,
    };
    const { cells } = rasterizeMunicipalities(tied, ["04", "06"], CELL);
    // The edge-adjacent cells (1,0), (0,1), (2,1), (1,2) are all at distance 10, so the
    // first three in row, column order are taken and (1,2) stays with the shape.
    expect([at(cells, 1, 1), at(cells, 1, 0), at(cells, 0, 1), at(cells, 2, 1)]).toEqual([1, 1, 1, 1]);
    expect(at(cells, 1, 2)).toBe(0);
  });

  it("a city never takes the last cell of a place", () => {
    // 04 is two cells wide and 07 a single cell; the marker sits on both. Only one of
    // 04's cells is spare, so the city ends up with one cell and each place keeps one.
    const small: Artifact = {
      ...artifact,
      municipalityPaths: [
        { code: "04", relationId: 1, d: "M0 0L20 0L20 10L0 10Z" },
        { code: "07", relationId: 2, d: "M10 10L20 10L20 20L10 20Z" },
      ],
      cityMarkers: [{ code: "06", x: 10, y: 10 }],
      occupiedAreas: artifact.occupiedAreas,
    };
    const { cells } = rasterizeMunicipalities(small, ["04", "07", "06"], CELL);
    expect(cells.filter((value) => value === 0)).toHaveLength(1);
    expect(cells.filter((value) => value === 1)).toHaveLength(1);
    expect(cells.filter((value) => value === 2)).toHaveLength(1);
  });

  it("every place gets at least one cell: a path smaller than one cell gets the cell containing its first point", () => {
    const tiny: Artifact = {
      ...artifact,
      municipalityPaths: [...artifact.municipalityPaths, { code: "09", relationId: 3, d: "M200.5 300.5L201 300.5L201 301L200.5 301Z" }],
    };
    const { cells } = rasterizeMunicipalities(tiny, ["04", "07", "09"], CELL);
    expect(at(cells, 20, 30)).toBe(2);
    expect(cells.filter((value) => value === 2)).toHaveLength(1);
  });

  it("rejects a code with neither a shape nor a marker", () => {
    expect(() => rasterizeMunicipalities(artifact, ["04", "99"], CELL)).toThrow(/99/);
  });
});

const ka: Presentation = { locale: "ka", englishLabels: {}, messages: {} };

function row(id: string, nameKa: string, valueGel: number, budgetPerResidentGel: number | null): MunicipalListRow {
  return { id, kind: "municipality", nameKa, subtitleKa: "", regionId: null, valueGel, budgetPerResidentGel, rank: null };
}

describe("buildMunicipalChapter", () => {
  const rows = [row("07", "ბ", 300, 30), row("06", "ა", 900, 90), row("04", "გ", 300, 10)];

  it("places carry total, per-resident value and rank by total desc (1 = largest, ties by code); city = a marker other than 04", () => {
    const chapter = buildMunicipalChapter(rows, 2025, ka, artifact, CELL);
    expect(chapter.year).toBe(2025);
    expect(chapter.totalGel).toBe(1500);
    expect(chapter.places).toEqual([
      { code: "06", name: "ა", totalGel: 900, perResidentGel: 90, rank: 1, city: true },
      { code: "04", name: "გ", totalGel: 300, perResidentGel: 10, rank: 2, city: false },
      { code: "07", name: "ბ", totalGel: 300, perResidentGel: 30, rank: 3, city: false },
    ]);
  });

  it("grid cells index into places", () => {
    const chapter = buildMunicipalChapter(rows, 2025, ka, artifact, CELL);
    expect(chapter.grid.cols).toBe(100);
    expect(chapter.grid.rows).toBe(54);
    expect(chapter.grid.cells[0]).toBe(1); // 04 is places[1]
    expect(chapter.grid.cells[1 * 100 + 1]).toBe(0); // 06 is places[0]
  });

  it("names come from the locale's label: English labels for en, the Georgian name for ka", () => {
    const en: Presentation = { locale: "en", englishLabels: { "04": "Tbilisi", "06": "Batumi", "07": "Akhmeta" }, messages: {} };
    const names = buildMunicipalChapter(rows, 2025, en, artifact, CELL).places.map((place) => place.name);
    expect(names).toEqual(["Batumi", "Tbilisi", "Akhmeta"]);
  });

  it("refuses a place without a per-resident value rather than showing 0", () => {
    expect(() => buildMunicipalChapter([row("04", "გ", 300, null), row("07", "ბ", 300, 30)], 2025, ka, artifact, CELL)).toThrow(/04/);
  });

  it("ignores rows that are not municipalities", () => {
    const withRegion: MunicipalListRow[] = [...rows, { ...row("region.x", "რეგიონი", 5000, null), kind: "region" }];
    expect(buildMunicipalChapter(withRegion, 2025, ka, artifact, CELL).places).toHaveLength(3);
  });
});

describe("buildMunicipalChapter with served data", () => {
  it("64 places, every list-row code appears, none of 05/42/43/46/64, every place has a cell", async () => {
    const data = await loadServedMunicipalData();
    const regionLabels = new Map(data.regions.map((region) => [region.id, region.kaLabel]));
    const list = buildMunicipalListRows({
      municipalities: data.municipalities,
      regionLabels,
      totalFacts: data.totalFacts,
      populationFacts: data.populationFacts,
      adjaraBudgetAdjustments: data.adjaraBudgetAdjustments,
      year: 2025,
    });
    const chapter = buildMunicipalChapter(list.municipalities, 2025, ka);

    expect(chapter.places).toHaveLength(64);
    expect(chapter.places.map((place) => place.code).sort()).toEqual(list.municipalities.map((row) => row.id).sort());
    for (const excluded of ["05", "42", "43", "46", "64"]) {
      expect(chapter.places.map((place) => place.code)).not.toContain(excluded);
    }
    expect(chapter.places.filter((place) => place.city).map((place) => place.code).sort()).toEqual(["06", "20", "32", "48"]);
    expect(chapter.places.map((place) => place.rank)).toEqual(chapter.places.map((_, index) => index + 1));
    expect(chapter.places[0]!.code).toBe("04");
    expect(chapter.totalGel).toBeCloseTo(list.municipalities.reduce((sum, row) => sum + row.valueGel, 0), 2);

    const counts = new Array<number>(chapter.places.length).fill(0);
    for (const value of chapter.grid.cells) if (value >= 0) counts[value]! += 1;
    expect(counts.every((count) => count >= 1)).toBe(true);
    chapter.places.forEach((place, index) => {
      if (place.city) expect(counts[index]).toBe(4);
    });
    expect(chapter.grid.cells.some((value) => value === -2)).toBe(true);
  }, 30_000);
});
