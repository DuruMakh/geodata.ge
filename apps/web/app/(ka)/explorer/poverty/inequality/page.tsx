import { povertyPageMetadata, renderPovertyPage } from "../../../../../lib/pages/poverty";
export const generateMetadata = () => povertyPageMetadata("ka", "inequality");
export default function Page() { return renderPovertyPage("ka", "inequality"); }
