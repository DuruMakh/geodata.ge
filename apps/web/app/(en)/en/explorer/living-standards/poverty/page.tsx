import { povertyPageMetadata, renderPovertyPage } from "../../../../../../lib/pages/poverty";
export const generateMetadata = () => povertyPageMetadata("en", "rates");
export default function Page() { return renderPovertyPage("en", "rates"); }
