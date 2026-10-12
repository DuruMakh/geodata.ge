import { demographyAgeSexPageMetadata, renderDemographyAgeSexPage } from "../../../../../lib/pages/demography-age-sex";

export function generateMetadata() {
  return demographyAgeSexPageMetadata("ka");
}

export default function Page() {
  return renderDemographyAgeSexPage("ka");
}
