import {
  renderGdpPage,
  gdpPageMetadata,
} from "../../../../../../lib/pages/gdp";
export function generateMetadata() {
  return gdpPageMetadata("en");
}
export default function Page() {
  return renderGdpPage("en");
}
