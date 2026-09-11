import { renderGdpPage, gdpPageMetadata } from "../../../../../lib/pages/gdp";
export function generateMetadata() {
  return gdpPageMetadata("ka");
}
export default function Page() {
  return renderGdpPage("ka");
}
