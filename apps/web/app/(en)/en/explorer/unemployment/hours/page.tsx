import { renderLabourPage } from "../../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("en", "hours");
export default function Page() { return renderLabourPage("en", "hours"); }
