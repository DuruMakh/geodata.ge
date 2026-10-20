import { demographyMarriagesDivorcesPageMetadata, renderDemographyMarriagesDivorcesPage } from "../../../../../lib/pages/demography-marriages-divorces";

export function generateMetadata() {
  return demographyMarriagesDivorcesPageMetadata("ka");
}

export default function Page() {
  return renderDemographyMarriagesDivorcesPage("ka");
}
