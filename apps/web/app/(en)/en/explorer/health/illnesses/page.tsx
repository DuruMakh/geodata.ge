import { renderHealthPage } from "../../../../../../lib/pages/health";
import { healthPageMetadata } from "../../../../../../lib/pages/health-shared";
export const generateMetadata = () => healthPageMetadata("en", "illnesses");
export default function Page() { return renderHealthPage("en", "illnesses"); }
