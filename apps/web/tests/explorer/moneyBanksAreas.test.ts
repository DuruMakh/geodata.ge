import { beforeAll, expect, test } from "vitest";
import { loadMoneyBanksFacts, toClientMoneyBanksFact } from "../../lib/data/moneyBanks/importMoneyBanks";
import { MONEY_BANKS_LOAN_AREAS, type ClientMoneyBanksFact } from "../../lib/data/moneyBanks/types";
import { businessAreaSlug } from "../../lib/explorer/businessAreas";
import {
  MONEY_BANKS_REGIONS_HREF, buildMoneyBanksAreaModel, moneyBanksAreaDefaultSelection, moneyBanksAreaHref, moneyBanksAreaOfMapId, moneyBanksAreaSelectionHash,
  moneyBanksAreaSeries, moneyBanksAreaSlug, moneyBanksMapId, moneyBanksRegionHref, parseMoneyBanksAreaHash,
} from "../../lib/explorer/moneyBanksAreas";
import { buildMoneyBanksRegionMapModel } from "../../lib/explorer/moneyBanksRegionMap";

let facts: ClientMoneyBanksFact[];
beforeAll(async () => { facts = (await loadMoneyBanksFacts()).map(toClientMoneyBanksFact); });

test("twelve areas with slugs and map ids", () => {
  expect(MONEY_BANKS_LOAN_AREAS.map(moneyBanksAreaSlug)).toEqual([
    "georgia", "tbilisi", "adjara", "guria", "imereti", "kakheti", "mtskheta_mtianeti", "racha_lechkhumi_kvemo_svaneti", "samegrelo_zemo_svaneti", "samtskhe_javakheti", "kvemo_kartli", "shida_kartli",
  ]);
  expect(MONEY_BANKS_LOAN_AREAS.map(moneyBanksAreaSlug)).toEqual(MONEY_BANKS_LOAN_AREAS.map(businessAreaSlug));
  expect(MONEY_BANKS_REGIONS_HREF).toBe("/explorer/money/regions");
  expect(moneyBanksAreaHref("region_imereti")).toBe("/explorer/money/regions/imereti");
  expect(moneyBanksMapId("region_imereti")).toBe("region.imereti");
  expect(moneyBanksMapId("georgia")).toBe("georgia");
  expect(moneyBanksAreaOfMapId("region.imereti")).toBe("region_imereti");
  expect(moneyBanksRegionHref("region.imereti")).toBe("/explorer/money/regions/imereti");
});

test("the map ranks 2025 all loans, Tbilisi first", () => {
  const map = buildMoneyBanksRegionMapModel(facts);
  expect(map.year).toBe(2025);
  expect(map.firstYear).toBe(2015);
  expect(map.regions).toHaveLength(11);
  const top = [...map.regions].sort((a, b) => a.rank - b.rank)[0];
  expect(top.regionId).toBe("region.tbilisi");
  expect(map.regions[0].regionId).toBe("region.tbilisi");
  // Client facts carry lari, so 52,420.1 million is 52,420,100,000.
  expect(map.regions[0].value / 1e6).toBeCloseTo(52420.1, 1);
});

test("an area page lists all loans, lari and foreign currency", () => {
  const series = moneyBanksAreaSeries("region_imereti");
  expect(series.map(s => s.id)).toEqual(["loans_region.region_imereti.total", "loans_region.region_imereti.gel", "loans_region.region_imereti.fx"]);
  expect(series.map(s => s.reference)).toEqual([true, false, false]);
  expect(series.every(s => s.heading === undefined && s.parentId === undefined)).toBe(true);
  expect(moneyBanksAreaDefaultSelection("region_imereti")).toEqual(["loans_region.region_imereti.total"]);
  const state = parseMoneyBanksAreaHash("", "region_imereti", facts);
  expect(state.selectedIds).toEqual(["loans_region.region_imereti.total"]);
  const model = buildMoneyBanksAreaModel("region_imereti", facts, state);
  expect(model.unit).toBe("gel");
  expect([model.range.start, model.range.end]).toEqual([2015, 2025]);
  expect(model.series.map(s => s.color)).toHaveLength(3);
  expect(new Set(model.series.map(s => s.color)).size).toBe(3);
  expect(model.selected.map(s => s.id)).toEqual(["loans_region.region_imereti.total"]);
  expect(model.series[0].endValue).not.toBeNull();
});

test("a selection moves to another area", () => {
  expect(moneyBanksAreaSelectionHash(["loans_region.region_imereti.fx"], "region_guria")).toBe("#sel=loans_region.region_guria.fx");
  expect(moneyBanksAreaSelectionHash(["loans_region.region_imereti.total"], "georgia")).toBe("");
  expect(moneyBanksAreaSelectionHash(["loans_region.georgia.gel", "loans_region.georgia.fx"], "region_tbilisi")).toBe("#sel=loans_region.region_tbilisi.gel%2Cloans_region.region_tbilisi.fx");
});

test("an unknown id in the hash is ignored", () => {
  expect(parseMoneyBanksAreaHash("#sel=loans_region.region_abkhazeti.total", "georgia", facts).selectedIds).toEqual([]);
});
