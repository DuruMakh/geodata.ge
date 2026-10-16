import { crimeHubMetadata, renderCrimeHub } from "../../../../../lib/pages/hubs/crime";
export const generateMetadata = () => crimeHubMetadata("en");
export default function Page() { return renderCrimeHub("en"); }
