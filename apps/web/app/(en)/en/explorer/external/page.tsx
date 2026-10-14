import { externalHubMetadata, renderExternalHub } from "../../../../../lib/pages/hubs/external";
export const generateMetadata = () => externalHubMetadata("en");
export default function Page() { return renderExternalHub("en"); }
