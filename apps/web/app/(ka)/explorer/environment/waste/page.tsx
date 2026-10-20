import { environmentRegionIndexMetadata, renderEnvironmentRegionIndex } from "../../../../../lib/pages/environment-areas";
export const generateMetadata = () => environmentRegionIndexMetadata("ka", "waste");
export default function Page() { return renderEnvironmentRegionIndex("ka", "waste"); }
