import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("en", "theatres");
export default function Page() { return renderScienceCulturePage("en", "theatres"); }
