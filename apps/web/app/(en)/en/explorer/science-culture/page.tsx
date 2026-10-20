import { renderScienceCultureHub, scienceCultureHubMetadata } from "../../../../../lib/pages/hubs/science-culture";
export const generateMetadata = () => scienceCultureHubMetadata("en");
export default function Page() { return renderScienceCultureHub("en"); }
