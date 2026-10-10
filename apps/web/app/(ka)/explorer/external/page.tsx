import { externalHubMetadata, renderExternalHub } from "../../../../lib/pages/external";
export const generateMetadata = () => externalHubMetadata("ka");
export default function Page() { return renderExternalHub("ka"); }
