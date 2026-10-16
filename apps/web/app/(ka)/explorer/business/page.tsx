import { businessHubMetadata, renderBusinessHub } from "../../../../lib/pages/business";
export const generateMetadata = () => businessHubMetadata("ka");
export default function Page() { return renderBusinessHub("ka"); }
