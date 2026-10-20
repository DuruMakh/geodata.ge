import { transportPageMetadata, renderTransportPage } from "../../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("en", "vehicle-age");
export default function Page() { return renderTransportPage("en", "vehicle-age"); }
