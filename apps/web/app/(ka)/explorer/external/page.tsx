import { externalHubMetadata, renderExternalHub } from "../../../../lib/pages/hubs/external";
export const generateMetadata = () => externalHubMetadata("ka");
export default function Page() { return renderExternalHub("ka"); }
