import { renderScienceCulturePage, scienceCulturePageMetadata } from "../../../../../../lib/pages/science-culture";
export const generateMetadata = () => scienceCulturePageMetadata("en", "patents");
export default function Page() { return renderScienceCulturePage("en", "patents"); }
