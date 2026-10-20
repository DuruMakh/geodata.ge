import { renderLabourPage } from "../../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("en", "informal");
export default function Page() { return renderLabourPage("en", "informal"); }
