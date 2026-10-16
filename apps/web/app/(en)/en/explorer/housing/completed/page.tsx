import { housingPageMetadata, renderHousingPage } from "../../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("en", "completed");
export default function Page() { return renderHousingPage("en", "completed"); }
