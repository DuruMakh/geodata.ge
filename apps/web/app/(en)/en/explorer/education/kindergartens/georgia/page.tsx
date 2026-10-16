import { educationPlaceMetadata, renderEducationPlacePage } from "../../../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationPlaceMetadata({ kind: "country" }, "en", "kindergartens");
}

export default function Page() {
  return renderEducationPlacePage({ kind: "country" }, "en", "kindergartens");
}
