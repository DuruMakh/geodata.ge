import { povertyPageMetadata, renderPovertyPage } from "../../../../../lib/pages/poverty";
export const generateMetadata = () => povertyPageMetadata("ka", "rates");
export default function Page() { return renderPovertyPage("ka", "rates"); }
