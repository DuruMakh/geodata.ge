import { demographyMigrationPageMetadata, renderDemographyMigrationPage } from "../../../../../lib/pages/demography-migration";

export function generateMetadata() {
  return demographyMigrationPageMetadata("ka");
}

export default function Page() {
  return renderDemographyMigrationPage("ka");
}
