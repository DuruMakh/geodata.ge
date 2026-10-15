import { renderHealthPage } from "../../../../../lib/pages/health";
import { healthPageMetadata } from "../../../../../lib/pages/health-shared";
export const generateMetadata = () => healthPageMetadata("ka", "doctors-hospitals");
export default function Page() { return renderHealthPage("ka", "doctors-hospitals"); }
