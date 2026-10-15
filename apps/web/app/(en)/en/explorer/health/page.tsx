import { healthHubMetadata, renderHealthHub } from "../../../../../lib/pages/hubs/health";
export const generateMetadata = () => healthHubMetadata("en");
export default function Page() { return renderHealthHub("en"); }
