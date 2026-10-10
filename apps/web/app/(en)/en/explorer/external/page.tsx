import { externalHubMetadata, renderExternalHub } from "../../../../../lib/pages/external";
export const generateMetadata = () => externalHubMetadata("en");
export default function Page() { return renderExternalHub("en"); }
