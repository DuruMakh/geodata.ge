import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("en", "age");
export default function Page() { return renderUnemploymentPage("en", "age"); }
