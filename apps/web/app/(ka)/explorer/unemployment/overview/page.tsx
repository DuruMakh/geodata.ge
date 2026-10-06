import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("ka", "overview");
export default function Page() { return renderUnemploymentPage("ka", "overview"); }
