import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("ka", "regions");
export default function Page() { return renderUnemploymentPage("ka", "regions"); }
