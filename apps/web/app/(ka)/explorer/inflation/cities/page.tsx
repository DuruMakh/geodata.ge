import { inflationCitiesMetadata, renderInflationCities } from "../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationCitiesMetadata("ka");
}

export default function Page() {
  return renderInflationCities("ka");
}
