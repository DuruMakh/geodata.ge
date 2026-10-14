import { inflationHubMetadata, renderInflationHub } from "../../../../../lib/pages/hubs/inflation";

export function generateMetadata() {
  return inflationHubMetadata("en");
}

export default function Page() {
  return renderInflationHub("en");
}
