import { demographyPopulationPageMetadata, renderDemographyPopulationPage } from "../../../../../../lib/pages/demography-population";

export function generateMetadata() {
  return demographyPopulationPageMetadata("en");
}

export default function Page() {
  return renderDemographyPopulationPage("en");
}
