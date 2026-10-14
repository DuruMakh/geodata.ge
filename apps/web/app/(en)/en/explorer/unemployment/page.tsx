import { unemploymentHubMetadata, renderUnemploymentHub } from "../../../../../lib/pages/hubs/unemployment";
export const generateMetadata = () => unemploymentHubMetadata("en");
export default function Page() { return renderUnemploymentHub("en"); }
