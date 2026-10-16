import { housingPageMetadata, renderHousingPage } from "../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("ka", "permits");
export default function Page() { return renderHousingPage("ka", "permits"); }
