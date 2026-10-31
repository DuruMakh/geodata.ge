import { describe, expect, it, vi } from "vitest";
import { areaRoutes } from "../../lib/explorer/areaRoutes";
import { HOUSING_AREAS } from "../../lib/explorer/housingAreas";
import { regionAreaFrame } from "../../lib/pages/region-area-frame";

vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));

// Georgia and one region, under an index of its own: the frame works from the config alone.
type Area = (typeof HOUSING_AREAS)[0 | 1];
const AREAS: readonly Area[] = [HOUSING_AREAS[0], HOUSING_AREAS[1]];
const INDEX = "/explorer/test/regions";
const routes = areaRoutes<Area>(INDEX);
const frame = regionAreaFrame<Area, { year: number; lastReviewedAt: string }>({
  hub: "housing", indexHref: INDEX, indexKey: "regions",
  areas: AREAS, areaSlug: routes.areaSlug, areaHref: routes.areaHref, mapId: routes.mapId,
  areaHeadingIds: () => [], load: async () => ({ facts: [] }), latestYear: () => 0, sourceIds: [],
});

describe("regionAreaFrame", () => {
  it("lists Georgia and each region's slug as the static area pages", () => {
    expect(frame.areaStaticParams()).toEqual([{ id: "georgia" }, { id: routes.areaSlug(AREAS[1]) }]);
  });

  it("names Georgia itself and finds each region on the shared region list", () => {
    expect(frame.areaPages.map(page => page.id)).toEqual(["georgia", routes.mapId(AREAS[1])]);
    expect(frame.areaPages[0]).toMatchObject({ kaLabel: "საქართველო", sortOrder: 0 });
  });

  it("finds an area by its slug and sends any other slug to the 404 page", () => {
    expect(frame.areaForSlug(routes.areaSlug(AREAS[1]))).toBe(AREAS[1]);
    expect(() => frame.areaForSlug("nowhere")).toThrow("NEXT_NOT_FOUND");
  });
});
