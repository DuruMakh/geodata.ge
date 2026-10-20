import { transportPageMetadata, renderTransportPage } from "../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("ka", "vehicle-age");
export default function Page() { return renderTransportPage("ka", "vehicle-age"); }
