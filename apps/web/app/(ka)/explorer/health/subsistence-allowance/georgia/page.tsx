import { renderSocialPlacePage, socialPlaceMetadata } from "../../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialPlaceMetadata({ kind: "country" }, "ka", "subsistence-allowance");
}

export default function Page() {
  return renderSocialPlacePage({ kind: "country" }, "ka", "subsistence-allowance");
}
