import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("ka", "gender");
export default function Page() { return renderUnemploymentPage("ka", "gender"); }
