import { afterEach, describe, expect, it } from "vitest";
import {
  loadServedMunicipalData,
  resetServedDataCacheForTests,
} from "../../../lib/data/servedData";

afterEach(() => {
  resetServedDataCacheForTests();
});

describe("loadServedMunicipalData", () => {
  it("loads the whole municipal dataset from the reviewed CSVs", async () => {
    const data = await loadServedMunicipalData();

    expect(data.functions).toHaveLength(10);
    expect(data.regions).toHaveLength(12);
    expect(data.municipalities).toHaveLength(69);
    expect(data.functionFacts).toHaveLength(7590);
    expect(data.totalFacts).toHaveLength(759);
  });

  it("returns facts in year-ascending order", async () => {
    const data = await loadServedMunicipalData();
    const years = data.functionFacts.map((fact) => fact.year);

    expect(years).toEqual([...years].sort((a, b) => a - b));
  });

  it("memoises within a process", async () => {
    const first = await loadServedMunicipalData();
    const second = await loadServedMunicipalData();

    expect(second).toBe(first);
  });
});
