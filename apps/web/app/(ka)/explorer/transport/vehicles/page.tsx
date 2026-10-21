import { transportPageMetadata, renderTransportPage } from "../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("ka", "vehicles");
export default function Page() { return renderTransportPage("ka", "vehicles"); }
