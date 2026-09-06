import { renderDeficitPage, deficitPageMetadata } from "../../../../lib/pages/deficit";

export function generateMetadata() { return deficitPageMetadata("ka"); }
export default function Page() { return renderDeficitPage("ka"); }
