import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("en", "greenhouse-gases");
export default function Page() { return renderEnvironmentPage("en", "greenhouse-gases"); }
