import { renderSocialIndexPage, socialIndexMetadata } from "../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialIndexMetadata("ka", "subsistence-allowance");
}

export default function Page() {
  return renderSocialIndexPage("ka", "subsistence-allowance");
}
