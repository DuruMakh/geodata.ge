import { demographyBirthsDeathsPageMetadata, renderDemographyBirthsDeathsPage } from "../../../../../lib/pages/demography-births-deaths";

export function generateMetadata() {
  return demographyBirthsDeathsPageMetadata("ka");
}

export default function Page() {
  return renderDemographyBirthsDeathsPage("ka");
}
