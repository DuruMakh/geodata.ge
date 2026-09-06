import { renderDeficitPage, deficitPageMetadata } from "../../../../../lib/pages/deficit";

export function generateMetadata() { return deficitPageMetadata("en"); }
export default function Page() { return renderDeficitPage("en"); }
