import { environmentRegionIndexMetadata, renderEnvironmentRegionIndex } from "../../../../../lib/pages/environment-areas";
export const generateMetadata = () => environmentRegionIndexMetadata("ka", "forests");
export default function Page() { return renderEnvironmentRegionIndex("ka", "forests"); }
