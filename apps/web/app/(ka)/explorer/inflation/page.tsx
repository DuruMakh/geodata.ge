import { inflationHubMetadata, renderInflationHub } from "../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationHubMetadata("ka");
}

export default function Page() {
  return renderInflationHub("ka");
}
