import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("en", "overview");
export default function Page() { return renderUnemploymentPage("en", "overview"); }
