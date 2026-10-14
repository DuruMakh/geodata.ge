import { inflationOverviewMetadata, renderInflationOverview } from "../../../../../lib/pages/inflation-overview";

export function generateMetadata() {
  return inflationOverviewMetadata("ka");
}

export default function Page() {
  return renderInflationOverview("ka");
}
