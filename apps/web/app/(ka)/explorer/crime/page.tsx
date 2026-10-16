import { crimeHubMetadata, renderCrimeHub } from "../../../../lib/pages/hubs/crime";
export const generateMetadata = () => crimeHubMetadata("ka");
export default function Page() { return renderCrimeHub("ka"); }
