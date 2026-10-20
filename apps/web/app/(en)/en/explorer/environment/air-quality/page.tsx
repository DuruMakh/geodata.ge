import { environmentAirQualityMetadata, renderEnvironmentAirQualityIndex } from "../../../../../../lib/pages/environment-air-quality";
export const generateMetadata = () => environmentAirQualityMetadata("en");
export default function Page() { return renderEnvironmentAirQualityIndex("en"); }
