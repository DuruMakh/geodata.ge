import { unemploymentPageMetadata, renderUnemploymentPage } from "../../../../../lib/pages/unemployment";
export const generateMetadata = () => unemploymentPageMetadata("ka", "age");
export default function Page() { return renderUnemploymentPage("ka", "age"); }
