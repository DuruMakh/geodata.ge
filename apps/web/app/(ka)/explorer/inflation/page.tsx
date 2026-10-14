import { inflationHubMetadata, renderInflationHub } from "../../../../lib/pages/hubs/inflation";

export function generateMetadata() {
  return inflationHubMetadata("ka");
}

export default function Page() {
  return renderInflationHub("ka");
}
