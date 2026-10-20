import { transportPageMetadata, renderTransportPage } from "../../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("en", "passengers");
export default function Page() { return renderTransportPage("en", "passengers"); }
