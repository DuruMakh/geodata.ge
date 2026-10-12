import { demographyAgeSexPageMetadata, renderDemographyAgeSexPage } from "../../../../../../lib/pages/demography-age-sex";

export function generateMetadata() {
  return demographyAgeSexPageMetadata("en");
}

export default function Page() {
  return renderDemographyAgeSexPage("en");
}
