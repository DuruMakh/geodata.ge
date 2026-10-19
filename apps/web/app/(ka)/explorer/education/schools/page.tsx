import { educationIndexMetadata, renderEducationIndexPage } from "../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationIndexMetadata("ka", "schools");
}

export default function Page() {
  return renderEducationIndexPage("ka", "schools");
}
