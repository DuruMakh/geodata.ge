import { environmentPageMetadata, renderEnvironmentPage } from "../../../../../../lib/pages/environment";
export const generateMetadata = () => environmentPageMetadata("en", "climate");
export default function Page() { return renderEnvironmentPage("en", "climate"); }
