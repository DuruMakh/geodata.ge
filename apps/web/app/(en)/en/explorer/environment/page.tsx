import { environmentHubMetadata, renderEnvironmentHub } from "../../../../../lib/pages/hubs/environment";
export const generateMetadata = () => environmentHubMetadata("en");
export default function Page() { return renderEnvironmentHub("en"); }
