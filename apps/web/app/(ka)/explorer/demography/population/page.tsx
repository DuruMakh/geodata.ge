import { demographyPopulationPageMetadata, renderDemographyPopulationPage } from "../../../../../lib/pages/demography-population";

export function generateMetadata() {
  return demographyPopulationPageMetadata("ka");
}

export default function Page() {
  return renderDemographyPopulationPage("ka");
}
