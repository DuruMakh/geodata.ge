import { renderSocialPlacePage, socialPlaceMetadata } from "../../../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialPlaceMetadata({ kind: "country" }, "en", "pensions");
}

export default function Page() {
  return renderSocialPlacePage({ kind: "country" }, "en", "pensions");
}
