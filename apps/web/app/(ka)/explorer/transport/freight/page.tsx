import { transportPageMetadata, renderTransportPage } from "../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("ka", "freight");
export default function Page() { return renderTransportPage("ka", "freight"); }
