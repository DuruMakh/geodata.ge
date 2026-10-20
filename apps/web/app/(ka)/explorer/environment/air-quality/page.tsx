import { environmentAirQualityMetadata, renderEnvironmentAirQualityIndex } from "../../../../../lib/pages/environment-air-quality";
export const generateMetadata = () => environmentAirQualityMetadata("ka");
export default function Page() { return renderEnvironmentAirQualityIndex("ka"); }
