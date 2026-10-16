import { housingPageMetadata, renderHousingPage } from "../../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("en", "permits");
export default function Page() { return renderHousingPage("en", "permits"); }
