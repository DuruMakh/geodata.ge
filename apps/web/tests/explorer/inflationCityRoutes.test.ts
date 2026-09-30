import { describe, expect, it } from "vitest";
import { INK, SERIES_COLORS } from "../../lib/explorer/colors";
import { cityPlaceLabel, cityViewLineColor, cityViewLineLabel } from "../../lib/explorer/inflationCityLabels";
import { CITIES_PATH, CITY_PAGE_PATHS, cityIdForSlug, cityPageHref, citySlug, neighbourCities } from "../../lib/explorer/inflationCityRoutes";
import inflation from "../../lib/i18n/messages/en/inflation.json";

describe("inflation city routes", () => {
  it("builds one page per city under the cities path", () => {
    expect(CITIES_PATH).toBe("/explorer/inflation/cities");
    expect(citySlug("city.batumi")).toBe("batumi");
    expect(cityPageHref("city.batumi")).toBe("/explorer/inflation/cities/batumi");
    expect(CITY_PAGE_PATHS).toEqual([
      "/explorer/inflation/cities/tbilisi",
      "/explorer/inflation/cities/kutaisi",
      "/explorer/inflation/cities/batumi",
      "/explorer/inflation/cities/gori",
      "/explorer/inflation/cities/telavi",
      "/explorer/inflation/cities/zugdidi",
    ]);
  });

  it("maps slugs back to city IDs and refuses anything else", () => {
    expect(cityIdForSlug("zugdidi")).toBe("city.zugdidi");
    expect(cityIdForSlug("georgia")).toBeNull();
    expect(cityIdForSlug("rustavi")).toBeNull();
  });

  it("walks the cities in Geostat's order and wraps at both ends", () => {
    expect(neighbourCities("city.batumi")).toEqual({ previous: "city.kutaisi", next: "city.gori" });
    expect(neighbourCities("city.tbilisi").previous).toBe("city.zugdidi");
    expect(neighbourCities("city.zugdidi").next).toBe("city.tbilisi");
  });
});

describe("view labels", () => {
  const messages = inflation as Record<string, string>;
  it("names the place and the lines for each view", () => {
    expect(cityPlaceLabel(messages, { kind: "georgia" })).toBe("Georgia");
    expect(cityPlaceLabel(messages, { kind: "city", cityId: "city.batumi" })).toBe("Batumi");
    expect(cityViewLineLabel(messages, { kind: "georgia" }, "city.gori")).toBe("Gori");
    expect(cityViewLineLabel(messages, { kind: "city", cityId: "city.gori" }, "cpi.headline")).toBe("Total");
  });
  it("colours the total ink on a city page and keeps city colours on the Georgia page", () => {
    expect(cityViewLineColor({ kind: "city", cityId: "city.gori" }, "cpi.headline")).toBe(INK);
    expect(cityViewLineColor({ kind: "city", cityId: "city.gori" }, "cpi.cat.01")).toBe(SERIES_COLORS["cpi.cat.01"]);
    expect(cityViewLineColor({ kind: "georgia" }, "city.batumi")).toBe("#1F6E56");
  });
});
