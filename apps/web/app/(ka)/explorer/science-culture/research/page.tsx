import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("ka", "research");
export default function Page() { return renderScienceCulturePage("ka", "research"); }
