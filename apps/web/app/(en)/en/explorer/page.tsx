import { renderHubPage, hubPageMetadata } from "../../../../lib/pages/hub";

export function generateMetadata() { return hubPageMetadata("en"); }
export default function Page() { return renderHubPage("en"); }
