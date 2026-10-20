import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("ka", "water");
export default function Page() { return renderEnvironmentPage("ka", "water"); }
