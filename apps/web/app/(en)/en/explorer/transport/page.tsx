import { transportHubMetadata, renderTransportHub } from "../../../../../lib/pages/hubs/transport";
export const generateMetadata = () => transportHubMetadata("en");
export default function Page() { return renderTransportHub("en"); }
