import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("en", "air-pollution");
export default function Page() { return renderEnvironmentPage("en", "air-pollution"); }
