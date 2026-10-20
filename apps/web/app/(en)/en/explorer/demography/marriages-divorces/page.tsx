import { demographyMarriagesDivorcesPageMetadata, renderDemographyMarriagesDivorcesPage } from "../../../../../../lib/pages/demography-marriages-divorces";

export function generateMetadata() {
  return demographyMarriagesDivorcesPageMetadata("en");
}

export default function Page() {
  return renderDemographyMarriagesDivorcesPage("en");
}
