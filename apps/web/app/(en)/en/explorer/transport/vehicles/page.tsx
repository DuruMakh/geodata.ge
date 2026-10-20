import { transportPageMetadata, renderTransportPage } from "../../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("en", "vehicles");
export default function Page() { return renderTransportPage("en", "vehicles"); }
