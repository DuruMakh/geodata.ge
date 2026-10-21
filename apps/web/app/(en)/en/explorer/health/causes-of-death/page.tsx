import { renderHealthDeathsIndex } from "../../../../../../lib/pages/health-deaths-index";
import { healthPageMetadata } from "../../../../../../lib/pages/health-shared";
export const generateMetadata = () => healthPageMetadata("en", "causes-of-death");
export default function Page() { return renderHealthDeathsIndex("en"); }
