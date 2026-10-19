import { educationPlaceMetadata, renderEducationPlacePage } from "../../../../../../lib/pages/education-places";

export function generateMetadata() {
  return educationPlaceMetadata({ kind: "country" }, "ka", "schools");
}

export default function Page() {
  return renderEducationPlacePage({ kind: "country" }, "ka", "schools");
}
