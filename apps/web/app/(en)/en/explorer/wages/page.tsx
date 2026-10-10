import { wagesHubMetadata, renderWagesHub } from "../../../../../lib/pages/wages";
export const generateMetadata = () => wagesHubMetadata("en");
export default function Page() { return renderWagesHub("en"); }
