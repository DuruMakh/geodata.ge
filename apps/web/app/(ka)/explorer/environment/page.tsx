import { environmentHubMetadata, renderEnvironmentHub } from "../../../../lib/pages/hubs/environment";
export const generateMetadata = () => environmentHubMetadata("ka");
export default function Page() { return renderEnvironmentHub("ka"); }
