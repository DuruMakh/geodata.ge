import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("ka", "theatres");
export default function Page() { return renderScienceCulturePage("ka", "theatres"); }
