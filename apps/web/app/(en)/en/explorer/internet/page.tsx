import { internetHubMetadata, renderInternetHub } from "../../../../../lib/pages/hubs/internet";
export const generateMetadata = () => internetHubMetadata("en");
export default function Page() { return renderInternetHub("en"); }
