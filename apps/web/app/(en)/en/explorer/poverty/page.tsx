import { povertyHubMetadata, renderPovertyHub } from "../../../../../lib/pages/poverty";
export const generateMetadata = () => povertyHubMetadata("en");
export default function Page() { return renderPovertyHub("en"); }
