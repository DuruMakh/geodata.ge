import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("en", "regions");
export default function Page() { return renderUnemploymentPage("en", "regions"); }
