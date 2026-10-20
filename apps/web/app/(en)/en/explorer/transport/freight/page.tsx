import { transportPageMetadata, renderTransportPage } from "../../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("en", "freight");
export default function Page() { return renderTransportPage("en", "freight"); }
