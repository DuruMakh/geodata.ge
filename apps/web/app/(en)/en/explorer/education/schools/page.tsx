import { educationIndexMetadata, renderEducationIndexPage } from "../../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationIndexMetadata("en", "schools");
}

export default function Page() {
  return renderEducationIndexPage("en", "schools");
}
