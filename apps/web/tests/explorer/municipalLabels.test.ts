import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REGION_GENITIVE_KA, georgianOrdinal } from "../../lib/explorer/municipalLabels";
import { ACCENT, MAP_NO_DATA_FILL, MAP_NO_DATA_STROKE, MAP_RAMP, SERIES_COLORS } from "../../lib/explorer/colors";

const MUNICIPAL_FUNCTION_IDS = [
  "municipal.general_public_services",
  "municipal.defence",
  "municipal.public_order_safety",
  "municipal.economic_affairs",
  "municipal.environment",
  "municipal.housing_communal",
  "municipal.health",
  "municipal.recreation_culture",
  "municipal.education",
  "municipal.social_protection",
];

describe("georgianOrdinal", () => {
  it("uses პირველი for first place, not მე-1", () => {
    expect(georgianOrdinal(1)).toBe("პირველი");
  });

  it("uses the მე- prefix for every other rank", () => {
    expect(georgianOrdinal(2)).toBe("მე-2");
    expect(georgianOrdinal(11)).toBe("მე-11");
    expect(georgianOrdinal(64)).toBe("მე-64");
  });
});

describe("REGION_GENITIVE_KA", () => {
  it("covers every region in the served taxonomy", () => {
    const taxonomy = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "../../data/taxonomy/municipal-regions.json"), "utf8"),
    ) as Array<{ id: string }>;
    for (const region of taxonomy) {
      expect(REGION_GENITIVE_KA[region.id], `missing genitive for ${region.id}`).toBeTruthy();
    }
    expect(Object.keys(REGION_GENITIVE_KA)).toHaveLength(taxonomy.length);
  });
});

describe("municipal colour tokens", () => {
  it("gives every function a stable token", () => {
    for (const id of MUNICIPAL_FUNCTION_IDS) {
      expect(SERIES_COLORS[id], `missing colour for ${id}`).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("never gives two functions the same colour", () => {
    const used = MUNICIPAL_FUNCTION_IDS.map((id) => SERIES_COLORS[id]);
    expect(new Set(used).size).toBe(MUNICIPAL_FUNCTION_IDS.length);
  });
});

describe("map ramp tokens", () => {
  it("runs six distinct steps ending at the accent", () => {
    expect(MAP_RAMP).toHaveLength(6);
    expect(new Set(MAP_RAMP).size).toBe(6);
    expect(MAP_RAMP.at(-1)).toBe(ACCENT);
    for (const step of MAP_RAMP) {
      expect(step).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("gives no-data shapes a fill and stroke outside the ramp", () => {
    expect(MAP_NO_DATA_FILL).toMatch(/^#[0-9A-F]{6}$/);
    expect(MAP_NO_DATA_STROKE).toMatch(/^#[0-9A-F]{6}$/);
    expect(MAP_RAMP).not.toContain(MAP_NO_DATA_FILL);
    expect(MAP_RAMP).not.toContain(MAP_NO_DATA_STROKE);
  });
});
