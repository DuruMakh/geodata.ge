import { wagesHubMetadata, renderWagesHub } from "../../../../../lib/pages/hubs/wages";
export const generateMetadata = () => wagesHubMetadata("en");
export default function Page() { return renderWagesHub("en"); }
