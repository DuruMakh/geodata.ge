import { renderSocialIndexPage, socialIndexMetadata } from "../../../../../lib/pages/social-places";

export function generateMetadata() {
  return socialIndexMetadata("ka", "pensions");
}

export default function Page() {
  return renderSocialIndexPage("ka", "pensions");
}
