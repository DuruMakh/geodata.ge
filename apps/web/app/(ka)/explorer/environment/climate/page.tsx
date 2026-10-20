import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("ka", "climate");
export default function Page() { return renderEnvironmentPage("ka", "climate"); }
