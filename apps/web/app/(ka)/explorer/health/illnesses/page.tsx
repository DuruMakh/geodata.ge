import { renderHealthPage } from "../../../../../lib/pages/health";
import { healthPageMetadata } from "../../../../../lib/pages/health-shared";
export const generateMetadata = () => healthPageMetadata("ka", "illnesses");
export default function Page() { return renderHealthPage("ka", "illnesses"); }
