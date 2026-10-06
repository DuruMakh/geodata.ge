import { unemploymentHubMetadata, renderUnemploymentHub } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentHubMetadata("en");
export default function Page() { return renderUnemploymentHub("en"); }
