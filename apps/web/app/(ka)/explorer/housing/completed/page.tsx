import { housingPageMetadata, renderHousingPage } from "../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("ka", "completed");
export default function Page() { return renderHousingPage("ka", "completed"); }
