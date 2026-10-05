import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("en");
export default function Page() { return renderUnemploymentPage("en"); }
