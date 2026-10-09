import { demographyBirthsDeathsPageMetadata, renderDemographyBirthsDeathsPage } from "../../../../../../lib/pages/demography-births-deaths";

export function generateMetadata() {
  return demographyBirthsDeathsPageMetadata("en");
}

export default function Page() {
  return renderDemographyBirthsDeathsPage("en");
}
