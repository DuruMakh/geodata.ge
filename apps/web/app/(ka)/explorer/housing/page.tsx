import { housingHubMetadata, renderHousingHub } from "../../../../lib/pages/hubs/housing";
export const generateMetadata = () => housingHubMetadata("ka");
export default function Page() { return renderHousingHub("ka"); }
