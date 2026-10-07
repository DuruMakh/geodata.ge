import { populationPlaceMetadata, renderPopulationPlacePage } from "../../../../../../lib/pages/demography-population-place";

export function generateMetadata() {
  return populationPlaceMetadata({ kind: "country" }, "ka");
}

export default function Page() {
  return renderPopulationPlacePage({ kind: "country" }, "ka");
}
