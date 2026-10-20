import { renderLabourPage } from "../../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("en", "young-people");
export default function Page() { return renderLabourPage("en", "young-people"); }
