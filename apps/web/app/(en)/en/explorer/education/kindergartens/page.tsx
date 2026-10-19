import { educationIndexMetadata, renderEducationIndexPage } from "../../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationIndexMetadata("en", "kindergartens");
}

export default function Page() {
  return renderEducationIndexPage("en", "kindergartens");
}
