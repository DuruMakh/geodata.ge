import { housingPageMetadata, renderHousingPage } from "../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("ka", "prices");
export default function Page() { return renderHousingPage("ka", "prices"); }
