import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("en", "research");
export default function Page() { return renderScienceCulturePage("en", "research"); }
