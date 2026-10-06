import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("en", "gender");
export default function Page() { return renderUnemploymentPage("en", "gender"); }
