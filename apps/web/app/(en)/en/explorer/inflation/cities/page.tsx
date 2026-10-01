import { inflationCitiesMetadata, renderInflationCities } from "../../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationCitiesMetadata("en");
}

export default function Page() {
  return renderInflationCities("en");
}
