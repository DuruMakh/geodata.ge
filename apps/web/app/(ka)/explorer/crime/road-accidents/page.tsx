import { renderCrimePage } from "../../../../../lib/pages/crime";
import { crimePageMetadata } from "../../../../../lib/pages/crime-shared";
export const generateMetadata = () => crimePageMetadata("ka", "road-accidents");
export default function Page() { return renderCrimePage("ka", "road-accidents"); }
