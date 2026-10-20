import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("ka", "patents");
export default function Page() { return renderScienceCulturePage("ka", "patents"); }
