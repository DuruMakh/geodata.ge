import { renderLabourPage } from "../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("ka", "hours");
export default function Page() { return renderLabourPage("ka", "hours"); }
