import { educationPlaceMetadata, renderEducationPlacePage } from "../../../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationPlaceMetadata({ kind: "country" }, "en", "schools");
}

export default function Page() {
  return renderEducationPlacePage({ kind: "country" }, "en", "schools");
}
