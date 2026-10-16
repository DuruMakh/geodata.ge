import { housingPageMetadata, renderHousingPage } from "../../../../../../lib/pages/housing";
export const generateMetadata = () => housingPageMetadata("en", "prices");
export default function Page() { return renderHousingPage("en", "prices"); }
