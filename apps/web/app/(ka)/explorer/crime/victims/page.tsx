import { renderCrimePage } from "../../../../../lib/pages/crime";
import { crimePageMetadata } from "../../../../../lib/pages/crime-shared";
export const generateMetadata = () => crimePageMetadata("ka", "victims");
export default function Page() { return renderCrimePage("ka", "victims"); }
