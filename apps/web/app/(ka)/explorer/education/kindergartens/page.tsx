import { educationIndexMetadata, renderEducationIndexPage } from "../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationIndexMetadata("ka", "kindergartens");
}

export default function Page() {
  return renderEducationIndexPage("ka", "kindergartens");
}
