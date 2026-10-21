import { renderSocialIndexPage, socialIndexMetadata } from "../../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialIndexMetadata("en", "subsistence-allowance");
}

export default function Page() {
  return renderSocialIndexPage("en", "subsistence-allowance");
}
