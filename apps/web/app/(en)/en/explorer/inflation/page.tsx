import { inflationHubMetadata, renderInflationHub } from "../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationHubMetadata("en");
}

export default function Page() {
  return renderInflationHub("en");
}
