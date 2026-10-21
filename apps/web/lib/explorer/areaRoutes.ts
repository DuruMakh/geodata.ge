// The area pages of a hub with a Regions index (Business and Housing): Georgia and the eleven regions, each at
// `<regions index>/<slug>`, named on the shared region map and picker by `georgia` or a region's `region.<id>`.

/** The route and map-id helpers of the area pages under `regionsHref`, for areas `georgia` and `region_<id>`. */
export function areaRoutes<Area extends string>(regionsHref: `/${string}`) {
  /** An area's URL slug: a region's drops the `region_` prefix. */
  const areaSlug = (area: Area) => area.replace(/^region_/, "");
  const areaHref = (area: Area): `/${string}` => `${regionsHref}/${areaSlug(area)}`;
  /** An area's id on the shared region map and picker: `georgia`, or a region's `region.<id>`, whose names the shared region labels carry. */
  const mapId = (area: Area) => area === "georgia" ? area : area.replace(/^region_/, "region.");
  /** The area of a map, picker or list row id (`mapId`'s inverse). */
  const areaOfMapId = (id: string) => (id === "georgia" ? id : id.replace(/^region\./, "region_")) as Area;
  /** The area page of a map or list row (as `householdRegionHref` reads it). */
  const regionHref = (id: string): `/${string}` => areaHref(areaOfMapId(id));
  return { areaSlug, areaHref, mapId, areaOfMapId, regionHref };
}
