import { expect, test } from "vitest";
import registry from "../../../../data/taxonomy/economic-sectors.json";
import { DEFAULT_SECTOR_STATE, parseSectorHash, serializeSectorHash, changeSectorMeasure, buildEconomicSectorsModel, sectorColor, sectorMatchesQuery } from "../../lib/explorer/economicSectors";
import type { ServedSectorObservation } from "../../lib/data/economicSectors/types";
import { sourceIdByMeasure } from "../../lib/explorer/clientData";
import { ACCENT, INK, OTHER_COLOR, SERIES_COLORS } from "../../lib/explorer/colors";
import { contrastRatio } from "../helpers/contrast";
const ids = registry.map(r => r.id);
const make = (seriesId: string, year: number, measure: ServedSectorObservation["measure"], value: number): ServedSectorObservation => ({
  seriesId, year, measure, value, unit: measure === "nominal" ? "gel" : "percent", valuation: seriesId === "economy.gdp_total" ? "market_prices" : "basic_prices",
  priceBasis: measure === "real_growth" ? "volume_change" : "current_prices", calculation: "published", status: "published", sourceId: "test", sourceLocator: "test", lastReviewedAt: "2026-09-11",
});
const facts = [make("economy.gdp_total",2010,"nominal",120),make("sector.a",2010,"nominal",15),make("sector.b",2010,"nominal",45),
  make("economy.gdp_total",2010,"share_of_gdp",100),make("sector.a",2010,"share_of_gdp",12.5),make("sector.b",2010,"share_of_gdp",37.5),
  make("economy.gdp_total",2011,"real_growth",-5),make("sector.a",2011,"real_growth",7.5)];
test("table rows follow end-year values rather than selection or classification order", () => {
  const model = buildEconomicSectorsModel(facts, registry, { ...DEFAULT_SECTOR_STATE, selectedIds: ["sector.a", "sector.b", "economy.gdp_total"] }, sourceIdByMeasure(facts));
  expect(model.rows.map(row => row.itemId)).toEqual(["economy.gdp_total", "sector.b", "sector.a"]);
});
test("sector hash distinguishes missing and empty selection and sanitizes input", () => {
  expect(parseSectorHash("",ids)).toEqual(DEFAULT_SECTOR_STATE);
  expect(parseSectorHash("#sel=",ids).selectedIds).toEqual([]);
  expect(parseSectorHash("#sel=sector.a,sector.a,unknown",ids).selectedIds).toEqual(["sector.a"]);
  const state = { ...DEFAULT_SECTOR_STATE, selectedIds: [], range: { kind: "manual" as const, start:2010,end:2011 } };
  expect(parseSectorHash(serializeSectorHash(state),ids)).toEqual(state);
  expect(parseSectorHash("#measure=bad&view=bad&start=2025&end=2010",ids).range).toEqual({kind:"manual",start:2010,end:2025});
});
test("measure coverage clamps manual years and preserves selection/view", () => {
  const state = { ...DEFAULT_SECTOR_STATE, mode:"table" as const, selectedIds:["sector.a"], range:{kind:"manual" as const,start:2010,end:2010} };
  const next = changeSectorMeasure(state,"real_growth",facts);
  expect(next.range).toEqual({kind:"all"});
  expect(next.selectedIds).toEqual(["sector.a"]);
  expect(next.mode).toBe("table");
  expect(buildEconomicSectorsModel(facts,registry,next,sourceIdByMeasure(facts)).years).toEqual([2011]);
});
test("shares are selection-independent and percent boundaries are correct", () => {
  const state = { ...DEFAULT_SECTOR_STATE, measure:"share_of_gdp" as const,selectedIds:["sector.a"] };
  const model = buildEconomicSectorsModel(facts,registry,state,sourceIdByMeasure(facts));
  expect(model.series[0].vals).toEqual([12.5]);
  expect(model.rows[0].valuesByYear[2010]).toBe(0.125);
  expect(model.headline?.value).toBe(100);
  const growth=buildEconomicSectorsModel(facts,registry,{...state,measure:"real_growth"},sourceIdByMeasure(facts));
  expect(growth.series[0].vals).toEqual([7.5]);
  expect(growth.rows[0].valuesByYear[2011]).toBe(0.075);
  expect(growth.headline?.value).toBe(-5);
});
test("empty and missing rows remain distinct from zero", () => {
  const model=buildEconomicSectorsModel(facts,registry,{...DEFAULT_SECTOR_STATE,measure:"real_growth",selectedIds:["sector.b"]},sourceIdByMeasure(facts));
  expect(model.series[0].vals).toEqual([null]);
  expect(model.endValues["sector.b"]).toBeNull();
  expect(model.hasData).toBe(false);
  expect(buildEconomicSectorsModel(facts,registry,{...DEFAULT_SECTOR_STATE,selectedIds:[]},sourceIdByMeasure(facts)).series).toEqual([]);
});
function hexToLab(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map((offset) => {
    const channel = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > (6 / 29) ** 3 ? Math.cbrt(t) : t / (3 * (6 / 29) ** 2) + 4 / 29);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005). */
function ciede2000(left: string, right: string): number {
  const [L1, a1, b1] = hexToLab(left);
  const [L2, a2, b2] = hexToLab(right);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const hue = (b: number, a: number) => (b === 0 && a === 0 ? 0 : (Math.atan2(b, a) * deg + 360) % 360);
  const h1p = hue(b1, a1p);
  const h2p = hue(b2, a2p);
  let dhp = 0;
  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) hbp += h1p + h2p < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.2 * Math.cos((4 * hbp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

test("every sector has an explicit, concept-safe, distinguishable colour", () => {
  const PAPER = "#F7F2E9";
  const TINT = "#F1EADC";
  // A sector may wear a site concept's colour only when it is that concept (spec §3.2).
  const conceptReuse: Record<string, string> = {
    "sector.a": SERIES_COLORS["spending.agriculture_environment"]!,
    "sector.h": SERIES_COLORS["cpi.cat.07"]!, // transport
    "sector.o": SERIES_COLORS["spending.defence"]!,
    "sector.p": SERIES_COLORS["spending.education"]!,
    "sector.q": SERIES_COLORS["spending.health"]!,
    "sector.r": SERIES_COLORS["spending.culture"]!,
  };
  const conceptHexes = new Set(
    Object.entries(SERIES_COLORS)
      .filter(([id]) => !id.startsWith("sector.") && id !== "economy.gdp_total")
      .map(([, hex]) => hex),
  );
  const colours = ids.map((id) => [id, sectorColor(id)] as const);

  expect(sectorColor("economy.gdp_total")).toBe(INK);
  for (const [id, hex] of colours) {
    expect(SERIES_COLORS[id], id).toBe(hex);
    if (id === "economy.gdp_total") continue;
    expect([ACCENT, OTHER_COLOR, INK], id).not.toContain(hex);
    if (conceptReuse[id]) expect(hex, id).toBe(conceptReuse[id]);
    else expect(conceptHexes.has(hex), `${id} reuses a concept colour`).toBe(false);
    expect(contrastRatio(hex, PAPER), `${id} on paper`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(hex, TINT), `${id} on tint`).toBeGreaterThanOrEqual(3);
  }
  for (let i = 0; i < colours.length; i += 1) {
    for (let j = i + 1; j < colours.length; j += 1) {
      expect(ciede2000(colours[i]![1], colours[j]![1]), `${colours[i]![0]} vs ${colours[j]![0]}`).toBeGreaterThanOrEqual(10);
    }
  }
  expect(ids.map(sectorColor).reverse()).toEqual([...ids].reverse().map(sectorColor));
  expect(() => sectorColor("sector.z")).toThrow("No colour for economic sector sector.z");
});
test("a manual range remains manual after switching through a shorter full coverage",()=>{
  const history=[make("economy.gdp_total",2010,"nominal",100),make("economy.gdp_total",2025,"nominal",120),make("economy.gdp_total",2011,"real_growth",5),make("economy.gdp_total",2025,"real_growth",7.5)];
  const state={...DEFAULT_SECTOR_STATE,range:{kind:"manual" as const,start:2011,end:2025}};
  const growth=changeSectorMeasure(state,"real_growth",history);
  expect(growth.range).toEqual(state.range);
  expect(changeSectorMeasure(growth,"nominal",history).range).toEqual(state.range);
});

test("sector search matches either label or the NACE code with the shared matcher", () => {
  const ict = registry.find((row) => row.id === "sector.j")!;
  expect(sectorMatchesQuery(ict, "information")).toBe(true);
  expect(sectorMatchesQuery(ict, ict.labelKa.slice(0, 5))).toBe(true);
  expect(sectorMatchesQuery(ict, " J ")).toBe(true);
  expect(sectorMatchesQuery(ict, "")).toBe(true);
  expect(sectorMatchesQuery(ict, "no-such-sector")).toBe(false);
});
