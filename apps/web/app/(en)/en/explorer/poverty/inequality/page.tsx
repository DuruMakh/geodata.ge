import { povertyPageMetadata, renderPovertyPage } from "../../../../../../lib/pages/poverty";
export const generateMetadata = () => povertyPageMetadata("en", "inequality");
export default function Page() { return renderPovertyPage("en", "inequality"); }
