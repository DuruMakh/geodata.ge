import { demographyPageMetadata, renderDemographyPage } from "../../../../../lib/pages/demography";

export function generateMetadata() {
  return demographyPageMetadata("en");
}
export default function Page() {
  return renderDemographyPage("en");
}
