import { transportRegionsPageMetadata } from "../../../../../../lib/pages/transport-shared";
import { renderTransportRegionsPage } from "../../../../../../lib/pages/transport-regions";
export const generateMetadata = () => transportRegionsPageMetadata("en");
export default function Page() { return renderTransportRegionsPage("en"); }
