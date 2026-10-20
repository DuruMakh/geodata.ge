import { renderLabourPage } from "../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("ka", "industries");
export default function Page() { return renderLabourPage("ka", "industries"); }
