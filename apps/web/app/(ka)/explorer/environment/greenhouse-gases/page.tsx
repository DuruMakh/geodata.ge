import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("ka", "greenhouse-gases");
export default function Page() { return renderEnvironmentPage("ka", "greenhouse-gases"); }
