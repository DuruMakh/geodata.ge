import { renderCrimePage } from "../../../../../../lib/pages/crime";
import { crimePageMetadata } from "../../../../../../lib/pages/crime-shared";
export const generateMetadata = () => crimePageMetadata("en", "road-accidents");
export default function Page() { return renderCrimePage("en", "road-accidents"); }
