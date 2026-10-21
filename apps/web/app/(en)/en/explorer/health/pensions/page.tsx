import { renderSocialIndexPage, socialIndexMetadata } from "../../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialIndexMetadata("en", "pensions");
}

export default function Page() {
  return renderSocialIndexPage("en", "pensions");
}
