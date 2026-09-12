import { inflationOverviewMetadata, renderInflationOverview } from "../../../../../../lib/pages/inflation";

export function generateMetadata() {
  return inflationOverviewMetadata("en");
}

export default function Page() {
  return renderInflationOverview("en");
}
