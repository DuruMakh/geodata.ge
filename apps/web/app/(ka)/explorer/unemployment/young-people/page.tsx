import { renderLabourPage } from "../../../../../lib/pages/labour";
import { labourPageMetadata } from "../../../../../lib/pages/labour-shared";
export const generateMetadata = () => labourPageMetadata("ka", "young-people");
export default function Page() { return renderLabourPage("ka", "young-people"); }
