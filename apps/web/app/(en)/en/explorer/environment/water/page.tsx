import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("en", "water");
export default function Page() { return renderEnvironmentPage("en", "water"); }
