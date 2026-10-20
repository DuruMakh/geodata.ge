import { environmentRegionIndexMetadata, renderEnvironmentRegionIndex } from "../../../../../../lib/pages/environment-areas";
export const generateMetadata = () => environmentRegionIndexMetadata("en", "waste");
export default function Page() { return renderEnvironmentRegionIndex("en", "waste"); }
