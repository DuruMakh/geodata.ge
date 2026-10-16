import { businessHubMetadata, renderBusinessHub } from "../../../../../lib/pages/business";
export const generateMetadata = () => businessHubMetadata("en");
export default function Page() { return renderBusinessHub("en"); }
