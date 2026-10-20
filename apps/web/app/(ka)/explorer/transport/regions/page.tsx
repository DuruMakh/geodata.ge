import { transportRegionsPageMetadata } from "../../../../../lib/pages/transport-shared";
import { renderTransportRegionsPage } from "../../../../../lib/pages/transport-regions";
export const generateMetadata = () => transportRegionsPageMetadata("ka");
export default function Page() { return renderTransportRegionsPage("ka"); }
