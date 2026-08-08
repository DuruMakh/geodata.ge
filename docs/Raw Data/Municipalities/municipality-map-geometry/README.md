# Reviewed municipality geometry snapshot

Snapshot date: `2026-08-06`.

This directory preserves the approved preview geometry as immutable source data.
The municipality polygons are derived from [OpenStreetMap](https://www.openstreetmap.org/copyright).
Each relation can be opened at `https://www.openstreetmap.org/relation/{relationId}`.
The occupied-area overlays are from [Natural Earth Admin 0 details](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-details/), which is [public domain](https://www.naturalearthdata.com/about/).

## Approved extraction

The reviewed preview is at:

`C:/Users/Mylaptop/.codex/visualizations/2026/08/06/019fd8a6-6e57-7820-8879-5e6681b4761a/municipality-geometry-preview.html`

This one-time extraction writes canonical minified JSON with one trailing newline:

```powershell
@'
const fs = require("node:fs");
const path = require("node:path");

const previewPath = "C:/Users/Mylaptop/.codex/visualizations/2026/08/06/019fd8a6-6e57-7820-8879-5e6681b4761a/municipality-geometry-preview.html";
const outputDirectory = path.resolve("docs/Raw Data/Municipalities/municipality-map-geometry");
const html = fs.readFileSync(previewPath, "utf8");
const municipalityMatch = html.match(/const municipalities = (\{.*?\});\s*const occupiedAreas =/s);
const occupiedMatch = html.match(/const occupiedAreas = (\{.*?\});\s*const cityMarkers =/s);
const markerMatch = html.match(/const cityMarkers = (\[.*?\]);\s*\/\/ The published/s);

if (!municipalityMatch || !occupiedMatch || !markerMatch) {
  throw new Error("Approved preview geometry constants were not found");
}

const rawMunicipalities = JSON.parse(municipalityMatch[1]);
const municipalities = {
  type: "FeatureCollection",
  features: rawMunicipalities.features.map((feature) => ({
    type: "Feature",
    properties: {
      sourceName: feature.properties.sourceName,
      sourceId: feature.properties.sourceId,
      code: feature.properties.code,
      nameKa: feature.properties.nameKa,
      nameEn: feature.properties.nameEn,
      source: feature.properties.source,
    },
    geometry: feature.geometry,
  })),
};
const occupiedAreas = JSON.parse(occupiedMatch[1]);
const cityMarkers = JSON.parse(markerMatch[1]).map(({ code, nameKa, nameEn, lon, lat }) => ({
  code,
  nameKa,
  nameEn,
  lon,
  lat,
}));

fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(path.join(outputDirectory, "municipalities-osm.geojson"), `${JSON.stringify(municipalities)}\n`, "utf8");
fs.writeFileSync(path.join(outputDirectory, "occupied-areas-natural-earth.geojson"), `${JSON.stringify(occupiedAreas)}\n`, "utf8");
fs.writeFileSync(path.join(outputDirectory, "city-markers.json"), `${JSON.stringify(cityMarkers)}\n`, "utf8");
'@ | node -
```

## Pinned source contract

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `municipalities-osm.geojson` | 459040 | `EEE0FF11AED3F6F77A564C44B6B1D4C2779385EB05EC534B3EC6DBD784370539` |
| `occupied-areas-natural-earth.geojson` | 5424 | `4D983CCA1FFC4825D87345550E194BB17ABE1CCBED3C62301D30E4C6DBAD7464` |
| `city-markers.json` | 446 | `CBA85ACCCCE642F595282EFA7064CB3CA4BE4A08A586C7A0764089E4527E0E41` |

The source package contains 60 municipality polygons, five city markers, and
64 unique served municipality codes after their approved overlap. Zugdidi code
`33` is pinned to OSM relation `2016161`.

The preview's `value` property was intentionally removed: budget values come
from the canonical municipal facts at build time.
