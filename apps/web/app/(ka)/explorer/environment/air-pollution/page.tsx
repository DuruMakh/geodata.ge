import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("ka", "air-pollution");
export default function Page() { return renderEnvironmentPage("ka", "air-pollution"); }
