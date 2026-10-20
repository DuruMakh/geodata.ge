import { transportPageMetadata, renderTransportPage } from "../../../../../lib/pages/transport";
export const generateMetadata = () => transportPageMetadata("ka", "passengers");
export default function Page() { return renderTransportPage("ka", "passengers"); }
