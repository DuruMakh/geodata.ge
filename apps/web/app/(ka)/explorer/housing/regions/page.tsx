import { housingRegionsPageMetadata } from "../../../../../lib/pages/housing-shared";
import { renderHousingRegionsPage } from "../../../../../lib/pages/housing-regions";
export const generateMetadata = () => housingRegionsPageMetadata("ka");
export default function Page() { return renderHousingRegionsPage("ka"); }
