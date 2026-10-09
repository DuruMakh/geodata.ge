import { demographyMigrationPageMetadata, renderDemographyMigrationPage } from "../../../../../../lib/pages/demography-migration";

export function generateMetadata() {
  return demographyMigrationPageMetadata("en");
}

export default function Page() {
  return renderDemographyMigrationPage("en");
}
