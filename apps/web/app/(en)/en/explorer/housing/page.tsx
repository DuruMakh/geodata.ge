import { housingHubMetadata, renderHousingHub } from "../../../../../lib/pages/hubs/housing";
export const generateMetadata = () => housingHubMetadata("en");
export default function Page() { return renderHousingHub("en"); }
