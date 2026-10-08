import { populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../../lib/pages/demography-population-place";

export function generateMetadata() {
  return populationPlaceMetadata({ kind: "country" }, "en");
}

export default function Page() {
  return renderPopulationPlacePage({ kind: "country" }, "en");
}
