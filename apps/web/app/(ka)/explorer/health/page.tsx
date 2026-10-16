import { healthHubMetadata, renderHealthHub } from "../../../../lib/pages/hubs/health";
export const generateMetadata = () => healthHubMetadata("ka");
export default function Page() { return renderHealthHub("ka"); }
