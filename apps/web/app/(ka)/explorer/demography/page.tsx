import { demographyPageMetadata, renderDemographyPage } from "../../../../lib/pages/demography";

export function generateMetadata() {
  return demographyPageMetadata("ka");
}
export default function Page() {
  return renderDemographyPage("ka");
}
