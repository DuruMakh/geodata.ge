import type { Metadata } from "next";
import { MunicipalitiesIndex } from "../../../components/municipalities/municipalities-index";
import { PageHeader } from "../../../components/shell/page-header";
import type { RegionMapCity, RegionMapShape } from "../../../components/municipalities/region-map";
import { loadServedLandingData, loadServedMunicipalData } from "../../../lib/data/servedData";
import {
  buildIndexKpis,
  buildMunicipalListRows,
  latestReviewedAtForMunicipalFacts,
} from "../../../lib/explorer/municipalData";
import { buildRegionShapes, MAP_VIEWBOX, projectPoint } from "../../../lib/explorer/municipalGeo";
import { GEORGIA_GEO } from "../../../lib/landing/georgiaGeo";
import { formatAmount } from "../../../lib/explorer/format";

const TITLE = "მუნიციპალიტეტები — GeoData";

export async function generateMetadata(): Promise<Metadata> {
  const { totalFacts } = await loadServedMunicipalData();
  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const description = `საქართველოს მუნიციპალიტეტების ბიუჯეტები ფუნქციების მიხედვით, ${years[0]} წლიდან დღემდე.`;

  return {
    title: TITLE,
    description,
    alternates: { canonical: "/explorer/municipalities" },
    openGraph: {
      type: "website",
      siteName: "GeoData.ge",
      locale: "ka_GE",
      url: "/explorer/municipalities",
      title: TITLE,
      description,
    },
  };
}

/** Quantile classing: with 11 values spanning 22×, equal intervals would put
 *  nine regions in one bucket. Quantiles show rank position instead. */
function bucketize(values: number[]): (value: number) => number {
  const sorted = values.slice().sort((a, b) => a - b);
  const breaks = [1, 2, 3, 4, 5].map((k) => sorted[Math.floor((k / 6) * sorted.length)] ?? Infinity);

  return (value: number) => {
    let index = 0;
    while (index < 5 && value >= (breaks[index] ?? Infinity)) index += 1;
    return index;
  };
}

export default async function MunicipalitiesIndexPage() {
  const { municipalities, regions, totalFacts, functionFacts, functions } = await loadServedMunicipalData();
  const { sourceDocuments } = await loadServedLandingData();

  const years = Array.from(new Set(totalFacts.map((row) => row.year))).sort((a, b) => a - b);
  const firstYear = years[0]!;
  const latestYear = years.at(-1)!;
  const regionLabels = new Map(regions.map((region) => [region.id, region.kaLabel]));

  const list = buildMunicipalListRows({ municipalities, regionLabels, totalFacts, year: latestYear });
  const valueByRegion = new Map(list.regions.map((row) => [row.id, row.valueGel]));
  const valueByMunicipality = new Map(list.municipalities.map((row) => [row.id, row.valueGel]));
  const bucketOf = bucketize(list.regions.map((row) => row.valueGel));

  const shapes: RegionMapShape[] = buildRegionShapes().map((shape) => {
    const valueGel = shape.regionId === null ? null : valueByRegion.get(shape.regionId) ?? null;

    return {
      shapeIso: shape.shapeIso,
      regionId: shape.regionId,
      nameKa: shape.nameKa,
      d: shape.d,
      valueGel,
      bucket: valueGel === null ? -1 : bucketOf(valueGel),
    };
  });

  // Self-governing city dots: the registry flag decides membership, GEORGIA_GEO
  // supplies the coordinates, and projectPoint — the SAME function the shapes
  // use — places them. Never reimplement the projection here.
  const cities: RegionMapCity[] = municipalities
    .filter((municipality) => municipality.isSelfGoverningCity)
    .flatMap((municipality) => {
      const marker = GEORGIA_GEO.cityMarkers.find((city) => city.ka === municipality.displayNameKa);
      if (!marker) return [];
      const { x, y } = projectPoint(marker.lon, marker.lat);
      const valueGel = valueByMunicipality.get(municipality.code) ?? 0;

      return [{ code: municipality.code, nameKa: municipality.displayNameKa, x, y, valueGel }];
    });

  if (cities.length !== municipalities.filter((row) => row.isSelfGoverningCity).length) {
    throw new Error("a self-governing city has no coordinate in GEORGIA_GEO.cityMarkers");
  }

  const lastUpdatedAt = latestReviewedAtForMunicipalFacts(sourceDocuments, functionFacts, totalFacts);
  const values = list.regions.map((row) => row.valueGel);

  return (
    <main data-testid="explorer-shell" className="min-h-screen bg-[var(--paper)] px-5 pb-16 text-[var(--ink)] min-[768px]:px-[34px]">
      <div className="@container mx-auto max-w-[1180px]">
        <PageHeader
          crumbs={[
            { label: "მთავარი", href: "/" },
            { label: "მონაცემები" },
            { label: "ბიუჯეტი", href: "/explorer" },
            { label: "მუნიციპალიტეტები" },
          ]}
          coverage={[`${firstYear}–${latestYear}`, lastUpdatedAt ? `განახლდა ${lastUpdatedAt}` : ""].filter(Boolean).join(" · ")}
        />
        <h1 className="mt-[34px] mb-2.5 max-w-[640px] font-[family-name:var(--font-display)] text-[30px] font-semibold leading-[1.15] tracking-[-0.01em] min-[768px]:text-[36px]">
          რას ხარჯავენ საქართველოს მუნიციპალიტეტები
        </h1>
        <p className="mb-[26px] max-w-[560px] text-[13.5px] leading-relaxed text-[var(--body)]">
          აირჩიე რეგიონი რუკაზე ან მუნიციპალიტეტი სიაში — გაიხსნება შესაბამისი ბიუჯეტის სრული ისტორია ფუნქციების მიხედვით.
        </p>

        <MunicipalitiesIndex
          viewBox={MAP_VIEWBOX}
          shapes={shapes}
          cities={cities}
          legendMin={formatAmount(Math.min(...values))}
          legendMax={formatAmount(Math.max(...values))}
          municipalities={list.municipalities}
          regions={list.regions}
          kpis={buildIndexKpis({ municipalities, totalFacts, functionFacts, functions, firstYear, latestYear })}
          latestYear={latestYear}
          sourceNote={`მონაცემები: ადგილობრივი თვითმმართველი ერთეულების ბიუჯეტების შესრულების ანგარიშები (საქართველოს ფინანსთა სამინისტრო). საზღვრები: geoBoundaries (gbOpen GEO ADM1), CC BY 3.0.${lastUpdatedAt ? ` ბოლო განახლება: ${lastUpdatedAt}.` : ""}`}
        />
      </div>
    </main>
  );
}
