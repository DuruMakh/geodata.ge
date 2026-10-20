import { environmentRegionIndexMetadata, renderEnvironmentRegionIndex } from "../../../../../../lib/pages/environment-areas";
export const generateMetadata = () => environmentRegionIndexMetadata("en", "forests");
export default function Page() { return renderEnvironmentRegionIndex("en", "forests"); }
